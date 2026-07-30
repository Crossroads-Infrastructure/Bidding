import { randomUUID } from "node:crypto";
import type {
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
} from "@/types/domain";

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);

function crew(role_name: string, hourly_rate: number, fringe: number): CrewRate {
  return {
    id: randomUUID(),
    role_name,
    hourly_rate,
    fringe,
    effective_date: sixMonthsAgo,
    is_current: true,
    created_at: new Date().toISOString(),
  };
}

function equipment(equipment_name: string, hourly_rate: number): EquipmentRate {
  return {
    id: randomUUID(),
    equipment_name,
    hourly_rate,
    effective_date: today,
    is_current: true,
    created_at: new Date().toISOString(),
  };
}

function material(
  material_name: string,
  unit: string,
  rate: number,
  vendor: string | null = null
): Material {
  return {
    id: randomUUID(),
    material_name,
    unit,
    rate,
    vendor,
    effective_date: today,
    is_current: true,
    created_at: new Date().toISOString(),
  };
}

export const seedCrewRates: CrewRate[] = [
  crew("Operator", 32.5, 14),
  crew("Foreman", 38, 16),
  crew("Laborer", 24, 11),
  crew("Truck Driver", 26, 11),
];

export const seedEquipmentRates: EquipmentRate[] = [
  equipment("Excavator (Mid-size)", 85),
  equipment("Dozer (D6)", 95),
  equipment("Asphalt Paver", 165),
  equipment("Double Drum Roller", 60),
  equipment("Motor Grader", 90),
];

export const seedMaterials: Material[] = [
  material("Hot Mix Asphalt (Surface)", "TON", 78, "Valley Asphalt"),
  material("Tack Coat (Emulsion)", "GAL", 3.1, "Valley Asphalt"),
  material("Aggregate Base, Crushed", "TON", 18.5, "Ridge Quarry"),
  material("Bedding Stone (#57)", "TON", 21, "Ridge Quarry"),
  material('RCP Pipe, 15"', "LF", 34, "Regional Concrete Pipe"),
];

function byName<T extends { role_name?: string; equipment_name?: string; material_name?: string }>(
  list: T[],
  name: string
): T {
  const found = list.find(
    (x) => x.role_name === name || x.equipment_name === name || x.material_name === name
  );
  if (!found) throw new Error(`seed lookup failed: ${name}`);
  return found;
}

const operator = byName(seedCrewRates, "Operator");
const foreman = byName(seedCrewRates, "Foreman");
const laborer = byName(seedCrewRates, "Laborer");

const excavator = byName(seedEquipmentRates, "Excavator (Mid-size)");
const paver = byName(seedEquipmentRates, "Asphalt Paver");
const roller = byName(seedEquipmentRates, "Double Drum Roller");

const hma = byName(seedMaterials, "Hot Mix Asphalt (Surface)");
const tackCoat = byName(seedMaterials, "Tack Coat (Emulsion)");
const aggBase = byName(seedMaterials, "Aggregate Base, Crushed");
const beddingStone = byName(seedMaterials, "Bedding Stone (#57)");
const rcpPipe = byName(seedMaterials, 'RCP Pipe, 15"');

function recipe(
  overrides: Omit<BidItemRecipe["item"], "id" | "created_date" | "last_used_date">,
  labor: Array<{ crew_role_id: string; hours_per_unit: number; headcount: number }>,
  equipmentLines: Array<{ equipment_id: string; hours_per_unit: number }>,
  materials: Array<Omit<BidItemRecipe["materials"][number], "id" | "bid_item_id">>
): BidItemRecipe {
  const item_id = randomUUID();
  return {
    item: {
      ...overrides,
      id: item_id,
      created_date: new Date().toISOString(),
      last_used_date: null,
    },
    labor: labor.map((l) => ({ id: randomUUID(), bid_item_id: item_id, ...l })),
    equipment: equipmentLines.map((e) => ({ id: randomUUID(), bid_item_id: item_id, ...e })),
    materials: materials.map((m) => ({ ...m, id: randomUUID(), bid_item_id: item_id })),
  };
}

export const seedBidItems: BidItemRecipe[] = [
  recipe(
    {
      item_name: "Unclassified Excavation",
      description: "Roadway grading excavation, common material",
      unit: "CY",
      item_type: "unit_price",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: "Includes excavation and haul to on-site stockpile. Excludes rock excavation.",
    },
    [{ crew_role_id: operator.id, hours_per_unit: 0.018, headcount: 1 }],
    [{ equipment_id: excavator.id, hours_per_unit: 0.018 }],
    []
  ),
  recipe(
    {
      item_name: 'HMA Surface Course, 2" Depth',
      description: "Hot mix asphalt surface course, compacted in place",
      unit: "SY",
      item_type: "unit_price",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: "Includes placement and compaction. Tack coat priced separately.",
    },
    [
      { crew_role_id: operator.id, hours_per_unit: 0.006, headcount: 2 },
      { crew_role_id: laborer.id, hours_per_unit: 0.006, headcount: 1 },
    ],
    [
      { equipment_id: paver.id, hours_per_unit: 0.006 },
      { equipment_id: roller.id, hours_per_unit: 0.006 },
    ],
    [
      {
        material_id: hma.id,
        calc_method: "dimensional",
        qty_per_unit: null,
        thickness_in: 2,
        width_in: null,
        depth_in: null,
        output_unit: "TON",
        density_factor: 148,
        application_rate: null,
        waste_pct: 0.03,
      },
    ]
  ),
  recipe(
    {
      item_name: "Tack Coat",
      description: "Bituminous tack coat applied prior to HMA overlay",
      unit: "SY",
      item_type: "unit_price",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: null,
    },
    [{ crew_role_id: laborer.id, hours_per_unit: 0.003, headcount: 1 }],
    [],
    [
      {
        material_id: tackCoat.id,
        calc_method: "liquid_application",
        qty_per_unit: null,
        thickness_in: null,
        width_in: null,
        depth_in: null,
        output_unit: "GAL",
        density_factor: null,
        application_rate: 0.05,
        waste_pct: 0,
      },
    ]
  ),
  recipe(
    {
      item_name: 'Aggregate Base Course, 8" Depth',
      description: "Crushed stone aggregate base, placed and compacted",
      unit: "SY",
      item_type: "unit_price",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: null,
    },
    [{ crew_role_id: operator.id, hours_per_unit: 0.007, headcount: 1 }],
    [{ equipment_id: excavator.id, hours_per_unit: 0.007 }],
    [
      {
        material_id: aggBase.id,
        calc_method: "dimensional",
        qty_per_unit: null,
        thickness_in: 8,
        width_in: null,
        depth_in: null,
        output_unit: "TON",
        density_factor: 135,
        application_rate: null,
        waste_pct: 0.05,
      },
    ]
  ),
  recipe(
    {
      item_name: '15" RCP Storm Drain Pipe',
      description: "Reinforced concrete pipe, installed with trench bedding",
      unit: "LF",
      item_type: "unit_price",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: "Includes pipe, bedding stone, and installation. Excludes structures.",
    },
    [
      { crew_role_id: operator.id, hours_per_unit: 0.05, headcount: 1 },
      { crew_role_id: laborer.id, hours_per_unit: 0.05, headcount: 2 },
      { crew_role_id: foreman.id, hours_per_unit: 0.05, headcount: 1 },
    ],
    [{ equipment_id: excavator.id, hours_per_unit: 0.05 }],
    [
      {
        material_id: rcpPipe.id,
        calc_method: "fixed_ratio",
        qty_per_unit: 1,
        thickness_in: null,
        width_in: null,
        depth_in: null,
        output_unit: "EA",
        density_factor: null,
        application_rate: null,
        waste_pct: 0.02,
      },
      {
        material_id: beddingStone.id,
        calc_method: "dimensional",
        qty_per_unit: null,
        thickness_in: null,
        width_in: 30,
        depth_in: 12,
        output_unit: "TON",
        density_factor: 110,
        application_rate: null,
        waste_pct: 0.05,
      },
    ]
  ),
  recipe(
    {
      item_name: "Mobilization",
      description: "Mobilization / demobilization of equipment and crew",
      unit: "LS",
      item_type: "lump_sum",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: null,
    },
    [],
    [],
    []
  ),
  recipe(
    {
      item_name: "Traffic Control (Subcontracted)",
      description: "Maintenance of traffic, subcontracted",
      unit: "LS",
      item_type: "sub_quote",
      default_overhead_pct: null,
      default_profit_pct: null,
      default_contingency_pct: null,
      notes: null,
    },
    [],
    [],
    []
  ),
];
