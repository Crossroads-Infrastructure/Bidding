import type {
  BidItem,
  BidItemMaterial,
  BidItemRecipe,
  CompanyDefaults,
  CrewRate,
  EquipmentRate,
  Material,
  ProjectLineItem,
} from "@/types/domain";

export type MaterialOverrideInput = { override_rate?: number | null; override_qty?: number | null };
export type LaborOverrideInput = { override_hours?: number | null; override_headcount?: number | null };
export type EquipmentOverrideInput = { override_hours?: number | null };

export interface LineOverrides {
  materials?: Map<string, MaterialOverrideInput>;
  labor?: Map<string, LaborOverrideInput>;
  equipment?: Map<string, EquipmentOverrideInput>;
}

export interface SelectedVendorQuote {
  id: string;
  vendor_name: string;
  quote_amount: number;
}

// ============================================================
// Rate resolution
// ============================================================
//
// A recipe's bid_item_labor/equipment/materials rows store an FK to a
// specific (possibly historical) rate row. Per the rate-fluidity design,
// live estimates should always price off the *current* rate for that
// role/equipment/material name -- not whatever row id happened to be
// selected when the recipe was authored. RateContext does that two-step
// resolution: id -> name -> current row for that name.

export interface ResolvedRate {
  name: string;
  hourly_rate: number;
  fringe?: number;
}

export interface ResolvedMaterialRate {
  name: string;
  rate: number;
  unit: string;
}

export class RateContext {
  private crewById = new Map<string, CrewRate>();
  private crewCurrentByName = new Map<string, CrewRate>();
  private equipmentById = new Map<string, EquipmentRate>();
  private equipmentCurrentByName = new Map<string, EquipmentRate>();
  private materialById = new Map<string, Material>();
  private materialCurrentByName = new Map<string, Material>();

  constructor(crewRates: CrewRate[], equipmentRates: EquipmentRate[], materials: Material[]) {
    for (const r of crewRates) {
      this.crewById.set(r.id, r);
      if (r.is_current) this.crewCurrentByName.set(r.role_name, r);
    }
    for (const r of equipmentRates) {
      this.equipmentById.set(r.id, r);
      if (r.is_current) this.equipmentCurrentByName.set(r.equipment_name, r);
    }
    for (const m of materials) {
      this.materialById.set(m.id, m);
      if (m.is_current) this.materialCurrentByName.set(m.material_name, m);
    }
  }

  resolveCrewRate(crewRoleId: string): ResolvedRate {
    const row = this.crewById.get(crewRoleId);
    if (!row) throw new Error(`crew rate not found: ${crewRoleId}`);
    const current = this.crewCurrentByName.get(row.role_name) ?? row;
    return { name: current.role_name, hourly_rate: current.hourly_rate, fringe: current.fringe };
  }

  resolveEquipmentRate(equipmentId: string): ResolvedRate {
    const row = this.equipmentById.get(equipmentId);
    if (!row) throw new Error(`equipment rate not found: ${equipmentId}`);
    const current = this.equipmentCurrentByName.get(row.equipment_name) ?? row;
    return { name: current.equipment_name, hourly_rate: current.hourly_rate };
  }

  resolveMaterialRate(materialId: string): ResolvedMaterialRate {
    const row = this.materialById.get(materialId);
    if (!row) throw new Error(`material not found: ${materialId}`);
    const current = this.materialCurrentByName.get(row.material_name) ?? row;
    return { name: current.material_name, rate: current.rate, unit: current.unit };
  }
}

// ============================================================
// Material quantity + cost
// ============================================================

export function computeMaterialQuantity(
  material: BidItemMaterial,
  lineQuantity: number,
  bidItemUnit: BidItem["unit"]
): number {
  const waste = 1 + (material.waste_pct ?? 0);

  switch (material.calc_method) {
    case "fixed_ratio": {
      if (material.qty_per_unit == null) {
        throw new Error("fixed_ratio material requires qty_per_unit");
      }
      return lineQuantity * material.qty_per_unit * waste;
    }

    case "liquid_application": {
      if (material.application_rate == null) {
        throw new Error("liquid_application material requires application_rate");
      }
      return lineQuantity * material.application_rate * waste;
    }

    case "dimensional": {
      let volumeCF: number;
      if (material.width_in != null && material.depth_in != null) {
        // LF item: trench-style cross section (e.g. pipe bedding).
        volumeCF = lineQuantity * (material.width_in / 12) * (material.depth_in / 12);
      } else if (material.thickness_in != null) {
        // SF/SY item: area x thickness. SY items convert to SF first (1 SY = 9 SF).
        const areaSF = lineQuantity * (bidItemUnit === "SY" ? 9 : 1);
        volumeCF = areaSF * (material.thickness_in / 12);
      } else {
        throw new Error(
          "dimensional material requires either thickness_in, or width_in and depth_in"
        );
      }
      volumeCF *= waste;

      switch (material.output_unit) {
        case "CY":
          return volumeCF / 27;
        case "TON": {
          if (material.density_factor == null) {
            throw new Error("TON output requires density_factor");
          }
          return (volumeCF * material.density_factor) / 2000;
        }
        default:
          throw new Error(
            `dimensional calc does not support output_unit "${material.output_unit}"`
          );
      }
    }

    default:
      throw new Error(`unknown calc_method: ${material.calc_method}`);
  }
}

export interface MaterialLineCost {
  material_id: string;
  name: string;
  quantity: number;
  rate: number;
  cost: number;
  overridden: boolean;
}

export function computeMaterialLineCost(
  material: BidItemMaterial,
  lineQuantity: number,
  bidItemUnit: BidItem["unit"],
  rates: RateContext,
  override?: MaterialOverrideInput
): MaterialLineCost {
  const resolved = rates.resolveMaterialRate(material.material_id);
  const quantity = override?.override_qty ?? computeMaterialQuantity(material, lineQuantity, bidItemUnit);
  const rate = override?.override_rate ?? resolved.rate;
  return {
    material_id: material.material_id,
    name: resolved.name,
    quantity,
    rate,
    cost: quantity * rate,
    overridden: Boolean(override && (override.override_rate != null || override.override_qty != null)),
  };
}

// ============================================================
// Line item base cost (labor + equipment + material)
// ============================================================
//
// Labor/equipment overrides (round 2) mirror the material override pattern:
// a project-only tweak to hours_per_unit/headcount that shadows the bid
// item's master recipe for this project without altering it. Missing
// override -> fall back to the recipe's value.

export interface LaborLineCost {
  crew_role_id: string;
  name: string;
  hours: number;
  rate: number;
  cost: number;
  overridden: boolean;
}

export interface EquipmentLineCost {
  equipment_id: string;
  name: string;
  hours: number;
  rate: number;
  cost: number;
  overridden: boolean;
}

export interface LineItemBaseCost {
  labor: LaborLineCost[];
  equipment: EquipmentLineCost[];
  materials: MaterialLineCost[];
  laborCost: number;
  equipmentCost: number;
  materialCost: number;
  baseCost: number;
}

export function computeLineItemBaseCost(
  recipe: BidItemRecipe,
  quantity: number,
  rates: RateContext,
  overrides: LineOverrides = {}
): LineItemBaseCost {
  const materialOverrides = overrides.materials ?? new Map();
  const laborOverrides = overrides.labor ?? new Map();
  const equipmentOverrides = overrides.equipment ?? new Map();

  const labor: LaborLineCost[] = recipe.labor.map((l) => {
    const resolved = rates.resolveCrewRate(l.crew_role_id);
    const override = laborOverrides.get(l.crew_role_id);
    const hoursPerUnit = override?.override_hours ?? l.hours_per_unit;
    const headcount = override?.override_headcount ?? l.headcount;
    const hours = quantity * hoursPerUnit * headcount;
    const rate = resolved.hourly_rate + (resolved.fringe ?? 0);
    return {
      crew_role_id: l.crew_role_id,
      name: resolved.name,
      hours,
      rate,
      cost: hours * rate,
      overridden: Boolean(override && (override.override_hours != null || override.override_headcount != null)),
    };
  });

  const equipment: EquipmentLineCost[] = recipe.equipment.map((e) => {
    const resolved = rates.resolveEquipmentRate(e.equipment_id);
    const override = equipmentOverrides.get(e.equipment_id);
    const hoursPerUnit = override?.override_hours ?? e.hours_per_unit;
    const hours = quantity * hoursPerUnit;
    return {
      equipment_id: e.equipment_id,
      name: resolved.name,
      hours,
      rate: resolved.hourly_rate,
      cost: hours * resolved.hourly_rate,
      overridden: Boolean(override && override.override_hours != null),
    };
  });

  const materials: MaterialLineCost[] = recipe.materials.map((m) =>
    computeMaterialLineCost(m, quantity, recipe.item.unit, rates, materialOverrides.get(m.material_id))
  );

  const laborCost = sum(labor.map((l) => l.cost));
  const equipmentCost = sum(equipment.map((e) => e.cost));
  const materialCost = sum(materials.map((m) => m.cost));

  return {
    labor,
    equipment,
    materials,
    laborCost,
    equipmentCost,
    materialCost,
    baseCost: laborCost + equipmentCost + materialCost,
  };
}

// ============================================================
// Markup / override hierarchy
// ============================================================
//
// Overhead and contingency now come from the company-wide CompanyDefaults
// (fluid history, like crew/equipment/material rates) instead of a
// per-project field. Profit is entered live on the Review screen rather
// than stored as an auto-applied project setting -- resolveProfitPct takes
// whatever the Review screen's current input value is as its bottom
// fallback tier. Each is calculated independently off base cost and summed
// (not compounded): total = base * (1 + overhead% + profit% + contingency%).

export function resolveOverheadPct(line: ProjectLineItem, item: BidItem, company: CompanyDefaults): number {
  return line.override_overhead_pct ?? item.default_overhead_pct ?? company.overhead_pct;
}

export function resolveContingencyPct(line: ProjectLineItem, item: BidItem, company: CompanyDefaults): number {
  return line.override_contingency_pct ?? item.default_contingency_pct ?? company.contingency_pct;
}

export function resolveProfitPct(line: ProjectLineItem, item: BidItem, liveProfitPct: number): number {
  return line.override_profit_pct ?? item.default_profit_pct ?? liveProfitPct;
}

export interface MarkupBreakdown {
  overheadPct: number;
  profitPct: number;
  contingencyPct: number;
  overhead: number;
  profit: number;
  contingency: number;
  total: number;
}

export function computeMarkup(baseCost: number, overheadPct: number, profitPct: number, contingencyPct: number): MarkupBreakdown {
  const overhead = baseCost * overheadPct;
  const profit = baseCost * profitPct;
  const contingency = baseCost * contingencyPct;
  return {
    overheadPct,
    profitPct,
    contingencyPct,
    overhead,
    profit,
    contingency,
    total: baseCost + overhead + profit + contingency,
  };
}

// ============================================================
// Full line item calculation
// ============================================================
//
// Two totals are tracked per self-performed line: preProfitTotal (base +
// company overhead + contingency -- what the Estimate Builder's live total
// bar shows, since profit isn't decided yet) and the full total including
// profit (what the Review screen shows). Subcontracted lines skip company
// overhead/contingency/profit entirely: their cost is the selected vendor
// quote marked up by the line's own sub_markup_pct, and that's already
// "final" at both stages (round 2 #8).

export interface LineItemEstimate {
  lineItemId: string;
  bidItemId: string;
  quantity: number;
  isSubcontracted: boolean;
  base: LineItemBaseCost | null; // null for subcontracted lines
  markup: MarkupBreakdown;
  preProfitTotal: number;
  preProfitUnitPrice: number;
  rawTotal: number;
  rawUnitPrice: number;
  roundedRate: number | null;
  finalTotal: number;
  selectedVendorQuote: SelectedVendorQuote | null;
}

export function computeLineItemEstimate(
  line: ProjectLineItem,
  recipe: BidItemRecipe,
  company: CompanyDefaults,
  liveProfitPct: number,
  rates: RateContext,
  overrides: LineOverrides = {},
  selectedVendorQuote: SelectedVendorQuote | null = null
): LineItemEstimate {
  const item = recipe.item;

  if (line.is_subcontracted) {
    const vendorAmount = selectedVendorQuote?.quote_amount ?? 0;
    const markupPct = line.sub_markup_pct ?? 0;
    const total = vendorAmount * (1 + markupPct);
    const markup: MarkupBreakdown = {
      overheadPct: 0,
      profitPct: 0,
      contingencyPct: markupPct,
      overhead: 0,
      profit: 0,
      contingency: total - vendorAmount,
      total,
    };
    const rawUnitPrice = line.quantity > 0 ? total / line.quantity : 0;
    return {
      lineItemId: line.id,
      bidItemId: item.id,
      quantity: line.quantity,
      isSubcontracted: true,
      base: null,
      markup,
      preProfitTotal: total,
      preProfitUnitPrice: rawUnitPrice,
      rawTotal: total,
      rawUnitPrice,
      roundedRate: line.manual_rounded_rate,
      finalTotal: line.manual_rounded_rate != null ? line.manual_rounded_rate * line.quantity : total,
      selectedVendorQuote,
    };
  }

  const base = computeLineItemBaseCost(recipe, line.quantity, rates, overrides);
  const overheadPct = resolveOverheadPct(line, item, company);
  const contingencyPct = resolveContingencyPct(line, item, company);
  const profitPct = resolveProfitPct(line, item, liveProfitPct);
  const markup = computeMarkup(base.baseCost, overheadPct, profitPct, contingencyPct);
  const preProfitTotal = base.baseCost + markup.overhead + markup.contingency;
  const rawUnitPrice = line.quantity > 0 ? markup.total / line.quantity : 0;
  const preProfitUnitPrice = line.quantity > 0 ? preProfitTotal / line.quantity : 0;

  return {
    lineItemId: line.id,
    bidItemId: item.id,
    quantity: line.quantity,
    isSubcontracted: false,
    base,
    markup,
    preProfitTotal,
    preProfitUnitPrice,
    rawTotal: markup.total,
    rawUnitPrice,
    roundedRate: line.manual_rounded_rate,
    finalTotal: line.manual_rounded_rate != null ? line.manual_rounded_rate * line.quantity : markup.total,
    selectedVendorQuote: null,
  };
}

export interface ProjectEstimate {
  lines: LineItemEstimate[];
  selfPerformed: {
    totalBaseCost: number;
    totalOverhead: number;
    totalContingency: number;
    totalProfit: number;
    preProfitTotal: number;
    total: number;
  };
  subcontracted: {
    total: number;
  };
  grandTotalPreProfit: number;
  grandTotal: number;
}

export function computeProjectEstimate(
  lines: ProjectLineItem[],
  recipesByBidItemId: Map<string, BidItemRecipe>,
  company: CompanyDefaults,
  liveProfitPct: number,
  rates: RateContext,
  overridesByLineId: Map<string, LineOverrides> = new Map(),
  selectedVendorQuoteByLineId: Map<string, SelectedVendorQuote> = new Map()
): ProjectEstimate {
  const estimates = lines.map((line) => {
    const recipe = recipesByBidItemId.get(line.bid_item_id);
    if (!recipe) throw new Error(`bid item recipe not found: ${line.bid_item_id}`);
    return computeLineItemEstimate(
      line,
      recipe,
      company,
      liveProfitPct,
      rates,
      overridesByLineId.get(line.id) ?? {},
      selectedVendorQuoteByLineId.get(line.id) ?? null
    );
  });

  const selfPerformedLines = estimates.filter((e) => !e.isSubcontracted);
  const subcontractedLines = estimates.filter((e) => e.isSubcontracted);

  const selfPerformed = {
    totalBaseCost: sum(selfPerformedLines.map((e) => e.base?.baseCost ?? 0)),
    totalOverhead: sum(selfPerformedLines.map((e) => e.markup.overhead)),
    totalContingency: sum(selfPerformedLines.map((e) => e.markup.contingency)),
    totalProfit: sum(selfPerformedLines.map((e) => e.markup.profit)),
    preProfitTotal: sum(selfPerformedLines.map((e) => e.preProfitTotal)),
    total: sum(selfPerformedLines.map((e) => e.finalTotal)),
  };
  const subcontracted = {
    total: sum(subcontractedLines.map((e) => e.finalTotal)),
  };

  return {
    lines: estimates,
    selfPerformed,
    subcontracted,
    grandTotalPreProfit: selfPerformed.preProfitTotal + subcontracted.total,
    grandTotal: selfPerformed.total + subcontracted.total,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
