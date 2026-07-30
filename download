import type {
  BidItem,
  BidItemMaterial,
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectLineItem,
} from "@/types/domain";

export type MaterialOverrideInput = { override_rate?: number | null; override_qty?: number | null };

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

export interface LaborLineCost {
  crew_role_id: string;
  name: string;
  hours: number;
  rate: number;
  cost: number;
}

export interface EquipmentLineCost {
  equipment_id: string;
  name: string;
  hours: number;
  rate: number;
  cost: number;
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
  materialOverrides: Map<string, MaterialOverrideInput> = new Map()
): LineItemBaseCost {
  const labor: LaborLineCost[] = recipe.labor.map((l) => {
    const resolved = rates.resolveCrewRate(l.crew_role_id);
    const hours = quantity * l.hours_per_unit * l.headcount;
    const rate = resolved.hourly_rate + (resolved.fringe ?? 0);
    return { crew_role_id: l.crew_role_id, name: resolved.name, hours, rate, cost: hours * rate };
  });

  const equipment: EquipmentLineCost[] = recipe.equipment.map((e) => {
    const resolved = rates.resolveEquipmentRate(e.equipment_id);
    const hours = quantity * e.hours_per_unit;
    return {
      equipment_id: e.equipment_id,
      name: resolved.name,
      hours,
      rate: resolved.hourly_rate,
      cost: hours * resolved.hourly_rate,
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
// Overhead/profit/contingency resolve line override -> bid item default ->
// project default. Each is calculated independently off base cost and
// summed (not compounded): total = base * (1 + overhead% + profit% + contingency%).
//
// Note on "project-level by default": since the project default % is the
// same for every non-overridden line, summing each line's
// base*(1+sum of pcts) is arithmetically identical to summing all bases
// and marking the pool up once -- there's no separate "pooling" step to
// implement, the per-line formula already collapses to that when nothing
// is overridden.

export function resolveOverheadPct(line: ProjectLineItem, item: BidItem, project: Project): number {
  return line.override_overhead_pct ?? item.default_overhead_pct ?? project.default_overhead_pct;
}

export function resolveProfitPct(line: ProjectLineItem, item: BidItem, project: Project): number {
  return line.override_profit_pct ?? item.default_profit_pct ?? project.default_profit_pct;
}

export function resolveContingencyPct(line: ProjectLineItem, item: BidItem, project: Project): number {
  return (
    line.override_contingency_pct ?? item.default_contingency_pct ?? project.default_contingency_pct
  );
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

export interface LineItemEstimate {
  lineItemId: string;
  bidItemId: string;
  quantity: number;
  isSubQuote: boolean;
  base: LineItemBaseCost | null; // null for sub_quote lines
  markup: MarkupBreakdown;
  rawTotal: number;
  rawUnitPrice: number;
  roundedRate: number | null;
  finalTotal: number;
}

export function computeLineItemEstimate(
  project: Project,
  line: ProjectLineItem,
  recipe: BidItemRecipe,
  rates: RateContext,
  materialOverrides: Map<string, MaterialOverrideInput> = new Map()
): LineItemEstimate {
  const item = recipe.item;
  const hasExplicitOverride =
    line.override_overhead_pct != null ||
    line.override_profit_pct != null ||
    line.override_contingency_pct != null;

  if (item.item_type === "sub_quote" && !hasExplicitOverride) {
    const vendorAmount = line.vendor_quote_amount ?? 0;
    const markupPct = line.markup_pct ?? 0;
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
      isSubQuote: true,
      base: null,
      markup,
      rawTotal: total,
      rawUnitPrice,
      roundedRate: line.manual_rounded_rate,
      finalTotal: line.manual_rounded_rate != null ? line.manual_rounded_rate * line.quantity : total,
    };
  }

  const base = computeLineItemBaseCost(recipe, line.quantity, rates, materialOverrides);
  const overheadPct = resolveOverheadPct(line, item, project);
  const profitPct = resolveProfitPct(line, item, project);
  const contingencyPct = resolveContingencyPct(line, item, project);
  const markup = computeMarkup(base.baseCost, overheadPct, profitPct, contingencyPct);
  const rawUnitPrice = line.quantity > 0 ? markup.total / line.quantity : 0;

  return {
    lineItemId: line.id,
    bidItemId: item.id,
    quantity: line.quantity,
    isSubQuote: false,
    base,
    markup,
    rawTotal: markup.total,
    rawUnitPrice,
    roundedRate: line.manual_rounded_rate,
    finalTotal: line.manual_rounded_rate != null ? line.manual_rounded_rate * line.quantity : markup.total,
  };
}

export interface ProjectEstimate {
  lines: LineItemEstimate[];
  totalBaseCost: number;
  totalOverhead: number;
  totalProfit: number;
  totalContingency: number;
  grandTotal: number;
}

export function computeProjectEstimate(
  project: Project,
  lines: ProjectLineItem[],
  recipesByBidItemId: Map<string, BidItemRecipe>,
  rates: RateContext,
  materialOverridesByLineId: Map<string, Map<string, MaterialOverrideInput>> = new Map()
): ProjectEstimate {
  const estimates = lines.map((line) => {
    const recipe = recipesByBidItemId.get(line.bid_item_id);
    if (!recipe) throw new Error(`bid item recipe not found: ${line.bid_item_id}`);
    return computeLineItemEstimate(
      project,
      line,
      recipe,
      rates,
      materialOverridesByLineId.get(line.id) ?? new Map()
    );
  });

  return {
    lines: estimates,
    totalBaseCost: sum(estimates.map((e) => e.base?.baseCost ?? e.markup.total - e.markup.overhead - e.markup.profit - e.markup.contingency)),
    totalOverhead: sum(estimates.map((e) => e.markup.overhead)),
    totalProfit: sum(estimates.map((e) => e.markup.profit)),
    totalContingency: sum(estimates.map((e) => e.markup.contingency)),
    grandTotal: sum(estimates.map((e) => e.finalTotal)),
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
