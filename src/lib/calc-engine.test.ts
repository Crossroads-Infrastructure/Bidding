import { describe, expect, it } from "vitest";
import {
  RateContext,
  computeLineItemBaseCost,
  computeLineItemEstimate,
  computeMarkup,
  computeMaterialQuantity,
  computeProjectEstimate,
  resolveOverheadPct,
} from "./calc-engine";
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
    const overrides = new Map([["material-1", { override_rate: 25, override_qty: undefined }]]);
    const result = computeLineItemBaseCost(recipe, 100, rates, overrides as never);
    const materialLine = result.materials[0];
    expect(materialLine.rate).toBe(25);
    expect(materialLine.overridden).toBe(true);
  });
});

describe("markup override hierarchy", () => {
  const project: Project = {
    id: "proj-1",
    project_name: "Test Project",
    client: null,
    location: null,
    dot_or_municipality: null,
    bid_date: null,
    status: "estimating",
    default_overhead_pct: 0.1,
    default_profit_pct: 0.08,
    default_contingency_pct: 0.05,
    created_at: "2026-01-01T00:00:00.000Z",
  };
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
  };
  const line: ProjectLineItem = {
    id: "line-1",
    project_id: "proj-1",
    bid_item_id: "item-1",
    quantity: 10,
    override_overhead_pct: null,
    override_profit_pct: null,
    override_contingency_pct: null,
    manual_rounded_rate: null,
    vendor_name: null,
    vendor_quote_amount: null,
    markup_pct: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  it("falls back to project default when nothing is overridden", () => {
    expect(resolveOverheadPct(line, item, project)).toBe(0.1);
  });

  it("item default wins over project default", () => {
    const itemWithDefault = { ...item, default_overhead_pct: 0.2 };
    expect(resolveOverheadPct(line, itemWithDefault, project)).toBe(0.2);
  });

  it("line override wins over item default and project default", () => {
    const itemWithDefault = { ...item, default_overhead_pct: 0.2 };
    const lineWithOverride = { ...line, override_overhead_pct: 0.35 };
    expect(resolveOverheadPct(lineWithOverride, itemWithDefault, project)).toBe(0.35);
  });

  it("computeMarkup sums independently (not compounded) off base cost", () => {
    const markup = computeMarkup(1000, 0.1, 0.08, 0.05);
    expect(markup.overhead).toBeCloseTo(100);
    expect(markup.profit).toBeCloseTo(80);
    expect(markup.contingency).toBeCloseTo(50);
    expect(markup.total).toBeCloseTo(1230);
  });
});

describe("computeLineItemEstimate: sub_quote", () => {
  it("prices vendor_quote_amount * (1 + markup_pct), bypassing labor/equipment/material", () => {
    const project: Project = {
      id: "proj-1",
      project_name: "P",
      client: null,
      location: null,
      dot_or_municipality: null,
      bid_date: null,
      status: "estimating",
      default_overhead_pct: 0.1,
      default_profit_pct: 0.1,
      default_contingency_pct: 0.05,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const item: BidItem = {
      id: "sub-1",
      item_name: "Traffic Control",
      description: null,
      unit: "LS",
      item_type: "sub_quote",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: null,
      created_date: "2026-01-01T00:00:00.000Z",
      last_used_date: null,
    };
    const line: ProjectLineItem = {
      id: "line-1",
      project_id: "proj-1",
      bid_item_id: "sub-1",
      quantity: 1,
      override_overhead_pct: null,
      override_profit_pct: null,
      override_contingency_pct: null,
      manual_rounded_rate: null,
      vendor_name: "ABC Traffic",
      vendor_quote_amount: 10000,
      markup_pct: 0.1,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const recipe: BidItemRecipe = { item, labor: [], equipment: [], materials: [] };
    const estimate = computeLineItemEstimate(project, line, recipe, new RateContext([], [], []));
    expect(estimate.isSubQuote).toBe(true);
    expect(estimate.rawTotal).toBeCloseTo(11000);
    expect(estimate.finalTotal).toBeCloseTo(11000);
  });
});

describe("computeProjectEstimate", () => {
  it("un-overridden lines behave as if the project default were applied once to the pooled base cost", () => {
    const { recipe, rates } = makeRecipe();
    const project: Project = {
      id: "proj-1",
      project_name: "P",
      client: null,
      location: null,
      dot_or_municipality: null,
      bid_date: null,
      status: "estimating",
      default_overhead_pct: 0.1,
      default_profit_pct: 0.08,
      default_contingency_pct: 0.05,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const lineA: ProjectLineItem = {
      id: "line-a",
      project_id: "proj-1",
      bid_item_id: "item-1",
      quantity: 100,
      override_overhead_pct: null,
      override_profit_pct: null,
      override_contingency_pct: null,
      manual_rounded_rate: null,
      vendor_name: null,
      vendor_quote_amount: null,
      markup_pct: null,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const lineB: ProjectLineItem = { ...lineA, id: "line-b", quantity: 50 };

    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const estimate = computeProjectEstimate(project, [lineA, lineB], recipesByBidItemId, rates);

    const pooledBase = estimate.totalBaseCost;
    const expectedPooledTotal = pooledBase * (1 + 0.1 + 0.08 + 0.05);
    expect(estimate.grandTotal).toBeCloseTo(expectedPooledTotal);
  });

  it("an overridden line is priced at its own rate and excluded from the shared default pool", () => {
    const { recipe, rates } = makeRecipe();
    const project: Project = {
      id: "proj-1",
      project_name: "P",
      client: null,
      location: null,
      dot_or_municipality: null,
      bid_date: null,
      status: "estimating",
      default_overhead_pct: 0.1,
      default_profit_pct: 0.08,
      default_contingency_pct: 0.05,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const normalLine: ProjectLineItem = {
      id: "line-a",
      project_id: "proj-1",
      bid_item_id: "item-1",
      quantity: 100,
      override_overhead_pct: null,
      override_profit_pct: null,
      override_contingency_pct: null,
      manual_rounded_rate: null,
      vendor_name: null,
      vendor_quote_amount: null,
      markup_pct: null,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const overriddenLine: ProjectLineItem = {
      ...normalLine,
      id: "line-b",
      quantity: 50,
      override_overhead_pct: 0.2,
      override_profit_pct: 0.2,
      override_contingency_pct: 0,
    };

    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const estimate = computeProjectEstimate(
      project,
      [normalLine, overriddenLine],
      recipesByBidItemId,
      rates
    );

    const normalEstimate = estimate.lines.find((l) => l.lineItemId === "line-a")!;
    const overriddenEstimate = estimate.lines.find((l) => l.lineItemId === "line-b")!;

    expect(normalEstimate.markup.overheadPct).toBeCloseTo(0.1);
    expect(overriddenEstimate.markup.overheadPct).toBeCloseTo(0.2);
    expect(overriddenEstimate.markup.contingency).toBeCloseTo(0);
    expect(estimate.grandTotal).toBeCloseTo(normalEstimate.finalTotal + overriddenEstimate.finalTotal);
  });

  it("manual_rounded_rate overrides the raw calculated total for that line", () => {
    const { recipe, rates } = makeRecipe();
    const project: Project = {
      id: "proj-1",
      project_name: "P",
      client: null,
      location: null,
      dot_or_municipality: null,
      bid_date: null,
      status: "estimating",
      default_overhead_pct: 0.1,
      default_profit_pct: 0,
      default_contingency_pct: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const line: ProjectLineItem = {
      id: "line-a",
      project_id: "proj-1",
      bid_item_id: "item-1",
      quantity: 100,
      override_overhead_pct: null,
      override_profit_pct: null,
      override_contingency_pct: null,
      manual_rounded_rate: 50,
      vendor_name: null,
      vendor_quote_amount: null,
      markup_pct: null,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const recipesByBidItemId = new Map([[recipe.item.id, recipe]]);
    const estimate = computeProjectEstimate(project, [line], recipesByBidItemId, rates);
    expect(estimate.lines[0].finalTotal).toBeCloseTo(50 * 100);
    expect(estimate.grandTotal).toBeCloseTo(5000);
  });
});
