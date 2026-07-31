// Domain types mirroring supabase/migrations/0001_initial_schema.sql
// and 0002_round2.sql

export type BidItemUnit = "SF" | "LF" | "EA" | "SY" | "LS" | "CY" | "TON" | "GAL";
export type BidItemType = "unit_price" | "lump_sum" | "sub_quote";
export type MaterialCalcMethod = "fixed_ratio" | "dimensional" | "liquid_application";
export type MaterialOutputUnit = "CY" | "TON" | "EA" | "GAL";
export type ProjectStatus = "estimating" | "submitted" | "won" | "lost";
export type BidOutcome = "won" | "lost";
export type DocumentCategory = "Plans" | "Proposal" | "Addenda" | "Other";

export interface CrewRate {
  id: string;
  role_name: string;
  hourly_rate: number;
  fringe: number;
  effective_date: string;
  is_current: boolean;
  created_at: string;
  // Round 3: archived roles are hidden from search/dropdowns but existing
  // recipes/overrides keep resolving against them unchanged.
  is_active: boolean;
}

export interface EquipmentRate {
  id: string;
  equipment_name: string;
  hourly_rate: number;
  effective_date: string;
  is_current: boolean;
  created_at: string;
  is_active: boolean;
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
  is_active: boolean;
}

// Fluid-history company-wide overhead/contingency (round 2 #6). Replaces
// per-project default_overhead_pct/default_contingency_pct.
export interface CompanyDefaults {
  id: string;
  overhead_pct: number;
  contingency_pct: number;
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
  // false for one-off items created inline mid-estimate; only items with
  // this set to true appear in Bid Item Library search (round 2 #5).
  is_saved_to_library: boolean;
  // Round 3: archived items are hidden from search/dropdowns but existing
  // project line items keep resolving against them unchanged.
  is_active: boolean;
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
  // "Last used profit %" -- a starting point offered on the Review screen,
  // not auto-applied (round 2 #7). Overhead/contingency now come from
  // company_defaults, not per-project fields.
  default_profit_pct: number;
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
  sort_order: number;
  created_at: string;
  // Round 2 #4: per-project customization, separate from the library recipe.
  notes_override: string | null;
  item_number_override: string | null;
  item_name_override: string | null;
  // Round 2 #8: subcontracting is a per-line toggle available on any item;
  // the selected row in project_line_item_vendor_quotes feeds the calc.
  is_subcontracted: boolean;
  sub_markup_pct: number | null;
}

export interface ProjectLineItemMaterialOverride {
  id: string;
  project_line_item_id: string;
  material_id: string;
  override_rate: number | null;
  override_qty: number | null;
}

// Round 2 #2: per-line labor/equipment overrides, same fallback pattern as
// material overrides (missing row -> use the bid item's default recipe).
export interface ProjectLineItemLaborOverride {
  id: string;
  project_line_item_id: string;
  crew_role_id: string;
  override_hours: number | null;
  override_headcount: number | null;
}

export interface ProjectLineItemEquipmentOverride {
  id: string;
  project_line_item_id: string;
  equipment_id: string;
  override_hours: number | null;
}

// Round 2 #8: multiple vendor quotes per subcontracted line; the selected
// one feeds the estimate.
export interface ProjectLineItemVendorQuote {
  id: string;
  project_line_item_id: string;
  vendor_name: string;
  quote_amount: number;
  is_selected: boolean;
  notes: string | null;
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

// Round 2 #9: project document attachments (Supabase Storage-backed).
export interface ProjectDocument {
  id: string;
  project_id: string;
  category: DocumentCategory;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_date: string;
}

// Round 2 #10: crew/equipment groups -- recipe-building shortcuts only.
// Populating a bid item's recipe from a group copies values into normal
// bid_item_labor/bid_item_equipment rows; there is no persistent link, so
// editing or deleting a group never affects items that already used it.
export interface CrewGroup {
  id: string;
  group_name: string;
  description: string | null;
}

export interface CrewGroupMember {
  id: string;
  crew_group_id: string;
  crew_role_id: string;
  default_headcount: number;
}

export interface EquipmentGroup {
  id: string;
  group_name: string;
  description: string | null;
}

export interface EquipmentGroupMember {
  id: string;
  equipment_group_id: string;
  equipment_id: string;
}
