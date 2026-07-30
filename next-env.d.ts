import type {
  BidItem,
  BidItemMaterial,
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectLineItem,
  ProjectLineItemMaterialOverride,
} from "@/types/domain";

export interface NewCrewRateInput {
  role_name: string;
  hourly_rate: number;
  fringe: number;
  effective_date?: string;
}

export interface NewEquipmentRateInput {
  equipment_name: string;
  hourly_rate: number;
  effective_date?: string;
}

export interface NewMaterialInput {
  material_name: string;
  unit: string;
  rate: number;
  vendor?: string | null;
  effective_date?: string;
}

export interface NewBidItemInput {
  item_name: string;
  description?: string | null;
  unit: BidItem["unit"];
  item_type: BidItem["item_type"];
  default_overhead_pct?: number | null;
  default_profit_pct?: number | null;
  default_contingency_pct?: number | null;
  notes?: string | null;
  labor: Array<{ crew_role_id: string; hours_per_unit: number; headcount: number }>;
  equipment: Array<{ equipment_id: string; hours_per_unit: number }>;
  materials: Array<Omit<BidItemMaterial, "id" | "bid_item_id">>;
}

export interface NewProjectInput {
  project_name: string;
  client?: string | null;
  location?: string | null;
  dot_or_municipality?: string | null;
  bid_date?: string | null;
  default_overhead_pct: number;
  default_profit_pct: number;
  default_contingency_pct: number;
}

export interface NewProjectLineItemInput {
  project_id: string;
  bid_item_id: string;
  quantity: number;
  override_overhead_pct?: number | null;
  override_profit_pct?: number | null;
  override_contingency_pct?: number | null;
  vendor_name?: string | null;
  vendor_quote_amount?: number | null;
  markup_pct?: number | null;
}

export interface ProjectLineItemUpdate {
  quantity?: number;
  override_overhead_pct?: number | null;
  override_profit_pct?: number | null;
  override_contingency_pct?: number | null;
  manual_rounded_rate?: number | null;
  vendor_name?: string | null;
  vendor_quote_amount?: number | null;
  markup_pct?: number | null;
}

/**
 * Data access boundary for the whole app. Two implementations exist:
 * - InMemoryRepository: seeded, in-process store used whenever Supabase env
 *   vars are absent, so the app is fully usable in local dev without a
 *   live database.
 * - SupabaseRepository: thin wrapper over @supabase/supabase-js, used once
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 *
 * Rate lookups resolve "current" by name, not by a pinned row id, so
 * recipes automatically pick up rate updates (see migration comment).
 */
export interface Repository {
  // Rates
  listCrewRates(): Promise<CrewRate[]>;
  getCurrentCrewRate(roleName: string): Promise<CrewRate | undefined>;
  addCrewRate(input: NewCrewRateInput): Promise<CrewRate>;

  listEquipmentRates(): Promise<EquipmentRate[]>;
  getCurrentEquipmentRate(equipmentName: string): Promise<EquipmentRate | undefined>;
  addEquipmentRate(input: NewEquipmentRateInput): Promise<EquipmentRate>;

  listMaterials(): Promise<Material[]>;
  getCurrentMaterial(materialName: string): Promise<Material | undefined>;
  addMaterial(input: NewMaterialInput): Promise<Material>;

  // Bid item catalog
  listBidItems(): Promise<BidItem[]>;
  searchBidItems(query: string): Promise<BidItem[]>;
  getBidItemRecipe(bidItemId: string): Promise<BidItemRecipe | undefined>;
  createBidItem(input: NewBidItemInput): Promise<BidItemRecipe>;
  duplicateBidItem(bidItemId: string, newName: string): Promise<BidItemRecipe>;

  // Projects
  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  createProject(input: NewProjectInput): Promise<Project>;
  updateProjectStatus(projectId: string, status: Project["status"]): Promise<Project>;

  // Project line items
  listProjectLineItems(projectId: string): Promise<ProjectLineItem[]>;
  addProjectLineItem(input: NewProjectLineItemInput): Promise<ProjectLineItem>;
  updateProjectLineItem(id: string, update: ProjectLineItemUpdate): Promise<ProjectLineItem>;
  removeProjectLineItem(id: string): Promise<void>;

  listMaterialOverrides(projectLineItemId: string): Promise<ProjectLineItemMaterialOverride[]>;
  setMaterialOverride(
    projectLineItemId: string,
    materialId: string,
    override: { override_rate?: number | null; override_qty?: number | null }
  ): Promise<ProjectLineItemMaterialOverride>;
  clearMaterialOverride(projectLineItemId: string, materialId: string): Promise<void>;
}
