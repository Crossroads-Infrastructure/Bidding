// Domain types mirroring supabase/migrations/0001_initial_schema.sql

export type BidItemUnit = "SF" | "LF" | "EA" | "SY" | "LS" | "CY" | "TON" | "GAL";
export type BidItemType = "unit_price" | "lump_sum" | "sub_quote";
export type MaterialCalcMethod = "fixed_ratio" | "dimensional" | "liquid_application";
export type MaterialOutputUnit = "CY" | "TON" | "EA" | "GAL";
export type ProjectStatus = "estimating" | "submitted" | "won" | "lost";
export type BidOutcome = "won" | "lost";

export interface CrewRate {
  id: string;
  role_name: string;
  hourly_rate: number;
  fringe: number;
  effective_date: string;
  is_current: boolean;
  created_at: string;
}

export interface EquipmentRate {
  id: string;
  equipment_name: string;
  hourly_rate: number;
  effective_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  material_name: string;
  unit: string;
  rate: number;
  vendor: string | null;
  effective_date: string;
  is_current: boolean;
  created_at: string;
}

export interface BidItem {
  id: string;
  item_name: string;
  description: string | null;
  unit: BidItemUnit;
  item_type: BidItemType;
  default_overhead_pct: number | null;
  default_profit_pct: number | null;
  default_contingency_pct: number | null;
  notes: string | null;
  created_date: string;
  last_used_date: string | null;
}

export interface BidItemLabor {
  id: string;
  bid_item_id: string;
  crew_role_id: string;
  hours_per_unit: number;
  headcount: number;
}

export interface BidItemEquipment {
  id: string;
  bid_item_id: string;
  equipment_id: string;
  hours_per_unit: number;
}

export interface BidItemMaterial {
  id: string;
  bid_item_id: string;
  material_id: string;
  calc_method: MaterialCalcMethod;
  qty_per_unit: number | null;
  thickness_in: number | null;
  width_in: number | null;
  depth_in: number | null;
  output_unit: MaterialOutputUnit | null;
  density_factor: number | null;
  application_rate: number | null;
  waste_pct: number;
}

// A bid item plus its full recipe, as used by the calc engine and the
// Bid Item Library / Estimate Builder screens.
export interface BidItemRecipe {
  item: BidItem;
  labor: BidItemLabor[];
  equipment: BidItemEquipment[];
  materials: BidItemMaterial[];
}

export interface Project {
  id: string;
  project_name: string;
  client: string | null;
  location: string | null;
  dot_or_municipality: string | null;
  bid_date: string | null;
  status: ProjectStatus;
  default_overhead_pct: number;
  default_profit_pct: number;
  default_contingency_pct: number;
  created_at: string;
}

export interface ProjectLineItem {
  id: string;
  project_id: string;
  bid_item_id: string;
  quantity: number;
  override_overhead_pct: number | null;
  override_profit_pct: number | null;
  override_contingency_pct: number | null;
  manual_rounded_rate: number | null;
  vendor_name: string | null;
  vendor_quote_amount: number | null;
  markup_pct: number | null;
  sort_order: number;
  created_at: string;
}

export interface ProjectLineItemMaterialOverride {
  id: string;
  project_line_item_id: string;
  material_id: string;
  override_rate: number | null;
  override_qty: number | null;
}

export interface BidHistoryEntry {
  id: string;
  project_id: string;
  bid_item_id: string;
  unit_price_bid: number;
  unit_price_awarded: number | null;
  outcome: BidOutcome | null;
  date: string;
  rates_snapshot: unknown;
}
