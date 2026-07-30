import { describe, expect, it } from "vitest";
import {
  RateContext,
  computeLineItemBaseCost,
  computeLineItemEstimate,
  computeMarkup,
  computeMaterialQuantity,
  computeProjectEstimate,
  resolveOverheadPct,
  resolveProfitPct,
} from "./calc-engine";
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

function baseMaterial(overrides: Partial<BidItemMaterial>): BidItemMaterial {
  return {
    id: "mat-line-1",
    bid_item_id: "item-1",
    material_id: "material-1",
    calc_method: "fixed_ratio",
    qty_per_unit: null,
    thickness_in: null,
    width_in: null,
    depth_in: null,
    output_unit: null,
    density_factor: null,
    application_rate: null,
    waste_pct: 0,
    ...overrides,
  };
}

describe("computeMaterialQuantity", () => {
  it("fixed_ratio: qty = quantity * qty_per_unit * (1 + waste)", () => {
    const m = baseMaterial({ calc_method: "fixed_ratio", qty_per_unit: 1, waste_pct: 0.02 });
    expect(computeMaterialQuantity(m, 100, "LF")).toBeCloseTo(100 * 1 * 1.02);
  });

  it("dimensional SF: CY = qty * (thickness/12) / 27", () => {
    const m = baseMaterial({
      calc_method: "dimensional",
      thickness_in: 6,
      output_unit: "CY",
      waste_pct: 0,
    });
    expect(computeMaterialQuantity(m, 270, "SF")).toBeCloseTo((270 * (6 / 12)) / 27);
  });

  it("dimensional SY: converts to SF (x9) before applying thickness", () => {
    const m = baseMaterial({
      calc_method: "dimensional",
      thickness_in: 6,
      output_unit: "CY",
      waste_pct: 0,
    });
    const sfResult = computeMaterialQuantity(m, 270 * 9, "SF");
    const syResult = computeMaterialQuantity(m, 270, "SY");
    expect(syResult).toBeCloseTo(sfResult);
  });

  it("dimensional LF: CY = qty * (width/12) * (depth/12) / 27", () => {
    const m = baseMaterial({
      calc_method: "dimensional",
      width_in: 30,
      depth_in: 12,
      output_unit: "CY",
      waste_pct: 0,
    });
    const qty = 100;
    expect(computeMaterialQuantity(m, qty, "LF")).toBeCloseTo(
      (qty * (30 / 12) * (12 / 12)) / 27
    );
  });

  it("dimensional TON: TONS = SF * (thickness/12) * density / 2000", () => {
    const m = baseMaterial({
      calc_method: "dimensional",
      thickness_in: 2,
      output_unit: "TON",
      density_factor: 148,
      waste_pct: 0,
    });
    const qtySY = 1000;
    const areaSF = qtySY * 9;
    expect(computeMaterialQuantity(m, qtySY, "SY")).toBeCloseTo(
      (areaSF * (2 / 12) * 148) / 2000
    );
  });

  it("applies waste_pct on top of the base formula", () => {
    const noWaste = baseMaterial({
      calc_method: "dimensional",
      thickness_in: 2,
      output_unit: "TON",
      density_factor: 148,
      waste_pct: 0,
    });
    const withWaste = baseMaterial({ ...noWaste, waste_pct: 0.05 });
    const base = computeMaterialQuantity(noWaste, 500, "SY");
    const wasted = computeMaterialQuantity(withWaste, 500, "SY");
    expect(wasted).toBeCloseTo(base * 1.05);
  });

  it("liquid_application: GAL = qty(SY) * application_rate", () => {
    const m = baseMaterial({ calc_method: "liquid_application", application_rate: 0.05 });
    expect(computeMaterialQuantity(m, 900, "SY")).toBeCloseTo(900 * 0.05);
  });

  it("throws a clear error for missing required fields", () => {
    const m = baseMaterial({ calc_method: "fixed_ratio", qty_per_unit: null });
    expect(() => computeMaterialQuantity(m, 10, "LF")).toThrow(/qty_per_unit/);
  });
});

describe("RateContext (rate fluidity)", () => {
  it("resolves the current rate by name, even when the FK points at a superseded row", () => {
    const oldRow: CrewRate = {
      id: "crew-old",
      role_name: "Operator",
      hourly_rate: 30,
      fringe: 12,
      effective_date: "2024-01-01",
      is_current: false,
      created_at: "2024-01-01T00:00:00.000Z",
    };
    const newRow: CrewRate = {
      id: "crew-new",
      role_name: "Operator",
      hourly_rate: 35,
      fringe: 14,
      effective_date: "2026-01-01",
      is_current: true,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const rates = new RateContext([oldRow, newRow], [], []);

    // A recipe authored back when "crew-old" was current still resolves
    // to today's current rate, not the stale one on the FK'd row.
    const resolved = rates.resolveCrewRate("crew-old");
    expect(resolved.hourly_rate).toBe(35);
    expect(resolved.fringe).toBe(14);
  });
});

function makeRecipe(): { recipe: BidItemRecipe; rates: RateContext } {
  const crew: CrewRate = {
    id: "crew-1",
    role_name: "Operator",
    hourly_rate: 30,
    fringe: 10,
    effective_date: "2026-01-01",
    is_current: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const equip: EquipmentRate = {
    id: "equip-1",
    equipment_name: "Excavator",
    hourly_rate: 80,
    effective_date: "2026-01-01",
    is_current: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const material: Material = {
    id: "material-1",
    material_name: "Stone",
    unit: "TON",
    rate: 20,
    vendor: null,
    effective_date: "2026-01-01",
    is_current: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const item: BidItem = {
    id: "item-1",
    item_name: "Test Item",
    description: null,
    unit: "CY",
    item_type: "unit_price",
    default_overhead_pct: null,
    default_profit_pct: null,
    default_contingency_pct: null,
    notes: null,
    created_date: "2026-01-01T00:00:00.000Z",
    last_used_date: null,
    is_saved_to_library: true,
  };
  const recipe: BidItemRecipe = {
    item,
    labor: [{ id: "l1", bid_item_id: "item-1", crew_role_id: "crew-1", hours_per_unit: 0.02, headcount: 2 }],
    equipment: [{ id: "e1", bid_item_id: "item-1", equipment_id: "equip-1", hours_per_unit: 0.02 }],
    materials: [
      baseMaterial({ calc_method: "fixed_ratio", qty_per_unit: 0.5, material_id: "material-1" }),
    ],
  };
  return { recipe, rates: new RateContext([crew], [equip], [material]) };
}

function makeLine(overrides: Partial<ProjectLineItem> = {}): ProjectLineItem {
  return {
    id: "line-1",
    project_id: "proj-1",
    bid_item_id: "item-1",
    quantity: 100,
    override_overhead_pct: null,
    override_profit_pct: null,
    override_contingency_pct: null,
    manual_rounded_rate: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    notes_override: null,
    item_number_override: null,
    item_name_override: null,
    is_subcontracted: false,
    sub_markup_pct: null,
    ...overrides,
  };
}

function makeCompany(overrides: Partial<CompanyDefaults> = {}): CompanyDefaults {
  return {
    id: "company-1",
    overhead_pct: 0.1,
    contingency_pct: 0.05,
    effective_date: "2026-01-01",
    is_current: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeLineItemBaseCost", () => {
  it("sums labor + equipment + material cost", () => {
    const { recipe, rates } = makeRecipe();
    const quantity = 100;
    const result = computeLineItemBaseCost(recipe, quantity, rates);

    const expectedLabor = quantity * 0.02 * 2 * (30 + 10); // hours * headcount * (rate+fringe)
    const expectedEquipment = quantity * 0.02 * 80;
    const expectedMaterial = quantity * 0.5 * 20; // fixed_ratio, waste 0

    expect(result.laborCost).toBeCloseTo(expectedLabor);
    expect(result.equipmentCost).toBeCloseTo(expectedEquipment);
    expect(result.materialCost).toBeCloseTo(expectedMaterial);
    expect(result.baseCost).toBeCloseTo(expectedLabor + expectedEquipment + expectedMaterial);
  });

  it("applies a material rate/qty override", () => {
    const { recipe, rates } = makeRecipe();
    const overrides = { materials: new Map([["material-1", { override_rate: 25 }]]) };
    const result = computeLineItemBaseCost(recipe, 100, rates, overrides);
    const materialLine = result.materials[0];
    expect(materialLine.rate).toBe(25);
    expect(materialLine.overridden).toBe(true);
  });

  it("applies a labor hours_per_unit/headcount override (project-only, mirrors material pattern)", () => {
    const { recipe, rates } = makeRecipe();
    const overrides = { labor: new Map([["crew-1", { override_hours: 0.05, override_headcount: 3 }]]) };
    const result = computeLineItemBaseCost(recipe, 100, rates, overrides);
    const laborLine = result.labor[0];
    expect(laborLine.hours).toBeCloseTo(100 * 0.05 * 3);
    expect(laborLine.overridden).toBe(true);
  });

  it("applies an equipment hours_per_unit override", () => {
    const { recipe, rates } = makeRecipe();
    const overrides = { equipment: new Map([["equip-1", { override_hours: 0.03 }]]) };
    const result = computeLineItemBaseCost(recipe, 100, rates, overrides);
    const equipmentLine = result.equipment[0];
    expect(equipmentLine.hours).toBeCloseTo(100 * 0.03);
    expect(equipmentLine.overridden).toBe(true);
  });
});

describe("markup override hierarchy", () => {
  const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0.05 });
  const item: BidItem = {
    id: "item-1",
    item_name: "Item",
    description: null,
    unit: "CY",
    item_type: "unit_price",
    default_overhead_pct: null,
    default_profit_pct: null,
    default_contingency_pct: null,
    notes: null,
    created_date: "2026-01-01T00:00:00.000Z",
    last_used_date: null,
    is_saved_to_library: true,
  };
  const line = makeLine();

  it("falls back to company defaults when nothing is overridden", () => {
    expect(resolveOverheadPct(line, item, company)).toBe(0.1);
  });

  it("item default wins over company default", () => {
    const itemWithDefault = { ...item, default_overhead_pct: 0.2 };
    expect(resolveOverheadPct(line, itemWithDefault, company)).toBe(0.2);
  });

  it("line override wins over item default and company default", () => {
    const itemWithDefault = { ...item, default_overhead_pct: 0.2 };
    const lineWithOverride = makeLine({ override_overhead_pct: 0.35 });
    expect(resolveOverheadPct(lineWithOverride, itemWithDefault, company)).toBe(0.35);
  });

  it("profit falls back to the live Review-screen value, not a stored project field", () => {
    expect(resolveProfitPct(line, item, 0.12)).toBeCloseTo(0.12);
    const lineWithOverride = makeLine({ override_profit_pct: 0.2 });
    expect(resolveProfitPct(lineWithOverride, item, 0.12)).toBeCloseTo(0.2);
  });

  it("computeMarkup sums independently (not compounded) off base cost", () => {
    const markup = computeMarkup(1000, 0.1, 0.08, 0.05);
    expect(markup.overhead).toBeCloseTo(100);
    expect(markup.profit).toBeCloseTo(80);
    expect(markup.contingency).toBeCloseTo(50);
    expect(markup.total).toBeCloseTo(1230);
  });
});

describe("computeLineItemEstimate: self-performed", () => {
  it("preProfitTotal excludes profit; rawTotal/finalTotal include it", () => {
    const { recipe, rates } = makeRecipe();
    const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0.05 });
    const line = makeLine({ quantity: 100 });
    const estimate = computeLineItemEstimate(line, recipe, company, 0.1, rates);

    expect(estimate.isSubcontracted).toBe(false);
    expect(estimate.preProfitTotal).toBeCloseTo(estimate.base!.baseCost * 1.15);
    expect(estimate.rawTotal).toBeCloseTo(estimate.base!.baseCost * 1.25);
    expect(estimate.rawTotal).toBeGreaterThan(estimate.preProfitTotal);
  });
});

describe("computeLineItemEstimate: subcontracted", () => {
  it("prices the selected vendor quote * (1 + sub_markup_pct), skipping company overhead/contingency/profit", () => {
    const { recipe, rates } = makeRecipe();
    const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0.05 });
    const line = makeLine({ quantity: 1, is_subcontracted: true, sub_markup_pct: 0.1 });
    const quote = { id: "q1", vendor_name: "ABC Traffic", quote_amount: 10000 };

    const estimate = computeLineItemEstimate(line, recipe, company, 0.15, rates, {}, quote);
    expect(estimate.isSubcontracted).toBe(true);
    expect(estimate.base).toBeNull();
    expect(estimate.rawTotal).toBeCloseTo(11000);
    expect(estimate.preProfitTotal).toBeCloseTo(11000); // no separate profit stage for subs
    expect(estimate.finalTotal).toBeCloseTo(11000);
  });

  it("is available on any item type, not just item_type sub_quote", () => {
    const { recipe, rates } = makeRecipe();
    expect(recipe.item.item_type).toBe("unit_price");
    const company = makeCompany();
    const line = makeLine({ is_subcontracted: true, sub_markup_pct: 0 });
    const quote = { id: "q1", vendor_name: "V", quote_amount: 5000 };
    const estimate = computeLineItemEstimate(line, recipe, company, 0.1, rates, {}, quote);
    expect(estimate.isSubcontracted).toBe(true);
    expect(estimate.rawTotal).toBeCloseTo(5000);
  });
});

describe("computeProjectEstimate: self-performed vs subcontracted split", () => {
  it("keeps subcontracted totals out of the pooled self-performed markup calculation", () => {
    const { recipe, rates } = makeRecipe();
    const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0.05 });

    const selfPerformedLine = makeLine({ id: "line-self", quantity: 100 });
    const subLine = makeLine({
      id: "line-sub",
      quantity: 1,
      is_subcontracted: true,
      sub_markup_pct: 0.1,
    });

    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const selectedQuotes = new Map([
      ["line-sub", { id: "q1", vendor_name: "V", quote_amount: 10000 }],
    ]);

    const estimate = computeProjectEstimate(
      [selfPerformedLine, subLine],
      recipesByBidItemId,
      company,
      0.1,
      rates,
      new Map(),
      selectedQuotes
    );

    const selfLine = estimate.lines.find((l) => l.lineItemId === "line-self")!;
    const subEstimate = estimate.lines.find((l) => l.lineItemId === "line-sub")!;

    // Self-performed pool reflects only the self-performed line's base cost.
    expect(estimate.selfPerformed.totalBaseCost).toBeCloseTo(selfLine.base!.baseCost);
    expect(estimate.selfPerformed.total).toBeCloseTo(selfLine.finalTotal);
    expect(estimate.subcontracted.total).toBeCloseTo(subEstimate.finalTotal);
    expect(estimate.subcontracted.total).toBeCloseTo(11000);

    // Grand total is a simple sum of the two separate totals, never pooled.
    expect(estimate.grandTotal).toBeCloseTo(estimate.selfPerformed.total + estimate.subcontracted.total);
    expect(estimate.grandTotalPreProfit).toBeCloseTo(
      estimate.selfPerformed.preProfitTotal + estimate.subcontracted.total
    );
  });

  it("an overridden self-performed line is priced at its own rate and excluded from the shared default pool", () => {
    const { recipe, rates } = makeRecipe();
    const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0.05 });

    const normalLine = makeLine({ id: "line-a", quantity: 100 });
    const overriddenLine = makeLine({
      id: "line-b",
      quantity: 50,
      override_overhead_pct: 0.2,
      override_contingency_pct: 0,
    });

    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const estimate = computeProjectEstimate(
      [normalLine, overriddenLine],
      recipesByBidItemId,
      company,
      0.1,
      rates
    );

    const normalEstimate = estimate.lines.find((l) => l.lineItemId === "line-a")!;
    const overriddenEstimate = estimate.lines.find((l) => l.lineItemId === "line-b")!;

    expect(normalEstimate.markup.overheadPct).toBeCloseTo(0.1);
    expect(overriddenEstimate.markup.overheadPct).toBeCloseTo(0.2);
    expect(overriddenEstimate.markup.contingency).toBeCloseTo(0);
  });

  it("manual_rounded_rate overrides the raw calculated total for that line", () => {
    const { recipe, rates } = makeRecipe();
    const company = makeCompany({ overhead_pct: 0.1, contingency_pct: 0 });
    const line = makeLine({ quantity: 100, manual_rounded_rate: 50 });
    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const estimate = computeProjectEstimate([line], recipesByBidItemId, company, 0, rates);
    expect(estimate.lines[0].finalTotal).toBeCloseTo(50 * 100);
    expect(estimate.grandTotal).toBeCloseTo(5000);
  });
});
