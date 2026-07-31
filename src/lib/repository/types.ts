import type {
  BidItem,
  BidItemEquipment,
  BidItemLabor,
  BidItemMaterial,
  BidItemRecipe,
  CompanyDefaults,
  CrewGroup,
  CrewGroupMember,
  CrewRate,
  DocumentCategory,
  EquipmentGroup,
  EquipmentGroupMember,
  EquipmentRate,
  Material,
  Project,
  ProjectDocument,
  ProjectLineItem,
  ProjectLineItemEquipmentOverride,
  ProjectLineItemLaborOverride,
  ProjectLineItemMaterialOverride,
  ProjectLineItemVendorQuote,
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

export interface NewCompanyDefaultsInput {
  overhead_pct: number;
  contingency_pct: number;
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
  is_saved_to_library?: boolean;
  labor: Array<{ crew_role_id: string; hours_per_unit: number; headcount: number }>;
  equipment: Array<{ equipment_id: string; hours_per_unit: number }>;
  materials: Array<Omit<BidItemMaterial, "id" | "bid_item_id">>;
}

export type NewBidItemLaborRowInput = { crew_role_id: string; hours_per_unit: number; headcount: number };
export type BidItemLaborRowUpdate = { hours_per_unit?: number; headcount?: number };
export type NewBidItemEquipmentRowInput = { equipment_id: string; hours_per_unit: number };
export type BidItemEquipmentRowUpdate = { hours_per_unit?: number };
export type NewBidItemMaterialRowInput = Omit<BidItemMaterial, "id" | "bid_item_id">;
export type BidItemMaterialRowUpdate = Partial<NewBidItemMaterialRowInput>;

export interface NewProjectInput {
  project_name: string;
  client?: string | null;
  location?: string | null;
  dot_or_municipality?: string | null;
  bid_date?: string | null;
  default_profit_pct?: number;
}

export interface DuplicateProjectDetailsInput {
  project_name: string;
  client?: string | null;
  location?: string | null;
  dot_or_municipality?: string | null;
  bid_date?: string | null;
}

export interface NewProjectLineItemInput {
  project_id: string;
  bid_item_id: string;
  quantity: number;
  override_overhead_pct?: number | null;
  override_profit_pct?: number | null;
  override_contingency_pct?: number | null;
  is_subcontracted?: boolean;
  sub_markup_pct?: number | null;
}

export interface ProjectLineItemUpdate {
  quantity?: number;
  override_overhead_pct?: number | null;
  override_profit_pct?: number | null;
  override_contingency_pct?: number | null;
  manual_rounded_rate?: number | null;
  notes_override?: string | null;
  item_number_override?: string | null;
  item_name_override?: string | null;
  is_subcontracted?: boolean;
  sub_markup_pct?: number | null;
}

export type NewVendorQuoteInput = { vendor_name: string; quote_amount: number; notes?: string | null };
export type VendorQuoteUpdate = {
  vendor_name?: string;
  quote_amount?: number;
  notes?: string | null;
  is_selected?: boolean;
};

export type LaborOverrideInput = { override_hours?: number | null; override_headcount?: number | null };
export type EquipmentOverrideInput = { override_hours?: number | null };

export type NewCrewGroupInput = { group_name: string; description?: string | null };
export type NewCrewGroupMemberInput = { crew_role_id: string; default_headcount: number };
export type NewEquipmentGroupInput = { group_name: string; description?: string | null };
export type NewEquipmentGroupMemberInput = { equipment_id: string };

export interface NewProjectDocumentInput {
  project_id: string;
  category: DocumentCategory;
  file_name: string;
  file_size: number;
  content: Uint8Array;
}

/**
 * Data access boundary for the whole app. Two implementations exist:
 * - InMemoryRepository: seeded, in-process store used whenever Supabase env
 *   vars are absent, so the app is fully usable in local dev without a
 *   live database.
 * - SupabaseRepository: thin wrapper over @supabase/supabase-js (+ Storage
 *   for documents), used once NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are set.
 *
 * Rate lookups resolve "current" by name, not by a pinned row id, so
 * recipes automatically pick up rate updates (see migration comment).
 */
export interface Repository {
  // Rates
  listCrewRates(): Promise<CrewRate[]>;
  getCurrentCrewRate(roleName: string): Promise<CrewRate | undefined>;
  addCrewRate(input: NewCrewRateInput): Promise<CrewRate>;
  archiveCrewRate(id: string): Promise<CrewRate>;
  restoreCrewRate(id: string): Promise<CrewRate>;
  deleteCrewRatePermanently(roleName: string): Promise<void>;

  listEquipmentRates(): Promise<EquipmentRate[]>;
  getCurrentEquipmentRate(equipmentName: string): Promise<EquipmentRate | undefined>;
  addEquipmentRate(input: NewEquipmentRateInput): Promise<EquipmentRate>;
  archiveEquipmentRate(id: string): Promise<EquipmentRate>;
  restoreEquipmentRate(id: string): Promise<EquipmentRate>;
  deleteEquipmentRatePermanently(equipmentName: string): Promise<void>;

  listMaterials(): Promise<Material[]>;
  getCurrentMaterial(materialName: string): Promise<Material | undefined>;
  addMaterial(input: NewMaterialInput): Promise<Material>;
  archiveMaterial(id: string): Promise<Material>;
  restoreMaterial(id: string): Promise<Material>;
  deleteMaterialPermanently(materialName: string): Promise<void>;

  getCurrentCompanyDefaults(): Promise<CompanyDefaults | undefined>;
  addCompanyDefaults(input: NewCompanyDefaultsInput): Promise<CompanyDefaults>;

  // Crew / equipment groups (recipe-building shortcuts)
  listCrewGroups(): Promise<CrewGroup[]>;
  listCrewGroupMembers(crewGroupId: string): Promise<CrewGroupMember[]>;
  createCrewGroup(input: NewCrewGroupInput): Promise<CrewGroup>;
  updateCrewGroup(id: string, patch: Partial<NewCrewGroupInput>): Promise<CrewGroup>;
  deleteCrewGroup(id: string): Promise<void>;
  addCrewGroupMember(crewGroupId: string, input: NewCrewGroupMemberInput): Promise<CrewGroupMember>;
  updateCrewGroupMember(id: string, patch: { default_headcount: number }): Promise<CrewGroupMember>;
  removeCrewGroupMember(id: string): Promise<void>;

  listEquipmentGroups(): Promise<EquipmentGroup[]>;
  listEquipmentGroupMembers(equipmentGroupId: string): Promise<EquipmentGroupMember[]>;
  createEquipmentGroup(input: NewEquipmentGroupInput): Promise<EquipmentGroup>;
  updateEquipmentGroup(id: string, patch: Partial<NewEquipmentGroupInput>): Promise<EquipmentGroup>;
  deleteEquipmentGroup(id: string): Promise<void>;
  addEquipmentGroupMember(
    equipmentGroupId: string,
    input: NewEquipmentGroupMemberInput
  ): Promise<EquipmentGroupMember>;
  removeEquipmentGroupMember(id: string): Promise<void>;

  // Bid item catalog
  listBidItems(): Promise<BidItem[]>;
  searchBidItems(query: string): Promise<BidItem[]>;
  getBidItemRecipe(bidItemId: string): Promise<BidItemRecipe | undefined>;
  createBidItem(input: NewBidItemInput): Promise<BidItemRecipe>;
  duplicateBidItem(bidItemId: string, newName: string): Promise<BidItemRecipe>;
  saveBidItemToLibrary(bidItemId: string): Promise<BidItem>;
  listArchivedBidItems(): Promise<BidItem[]>;
  archiveBidItem(id: string): Promise<BidItem>;
  restoreBidItem(id: string): Promise<BidItem>;
  deleteBidItemPermanently(id: string): Promise<void>;

  addBidItemLaborRow(bidItemId: string, input: NewBidItemLaborRowInput): Promise<BidItemLabor>;
  updateBidItemLaborRow(rowId: string, patch: BidItemLaborRowUpdate): Promise<BidItemLabor>;
  removeBidItemLaborRow(rowId: string): Promise<void>;

  addBidItemEquipmentRow(bidItemId: string, input: NewBidItemEquipmentRowInput): Promise<BidItemEquipment>;
  updateBidItemEquipmentRow(rowId: string, patch: BidItemEquipmentRowUpdate): Promise<BidItemEquipment>;
  removeBidItemEquipmentRow(rowId: string): Promise<void>;

  addBidItemMaterialRow(bidItemId: string, input: NewBidItemMaterialRowInput): Promise<BidItemMaterial>;
  updateBidItemMaterialRow(rowId: string, patch: BidItemMaterialRowUpdate): Promise<BidItemMaterial>;
  removeBidItemMaterialRow(rowId: string): Promise<void>;

  // Projects
  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  createProject(input: NewProjectInput): Promise<Project>;
  duplicateProject(sourceProjectId: string, details: DuplicateProjectDetailsInput): Promise<Project>;
  updateProjectStatus(projectId: string, status: Project["status"]): Promise<Project>;
  updateProjectLastUsedProfit(projectId: string, profitPct: number): Promise<Project>;

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

  listLaborOverrides(projectLineItemId: string): Promise<ProjectLineItemLaborOverride[]>;
  setLaborOverride(
    projectLineItemId: string,
    crewRoleId: string,
    override: LaborOverrideInput
  ): Promise<ProjectLineItemLaborOverride>;
  clearLaborOverride(projectLineItemId: string, crewRoleId: string): Promise<void>;

  listEquipmentOverrides(projectLineItemId: string): Promise<ProjectLineItemEquipmentOverride[]>;
  setEquipmentOverride(
    projectLineItemId: string,
    equipmentId: string,
    override: EquipmentOverrideInput
  ): Promise<ProjectLineItemEquipmentOverride>;
  clearEquipmentOverride(projectLineItemId: string, equipmentId: string): Promise<void>;

  listVendorQuotes(projectLineItemId: string): Promise<ProjectLineItemVendorQuote[]>;
  addVendorQuote(projectLineItemId: string, input: NewVendorQuoteInput): Promise<ProjectLineItemVendorQuote>;
  updateVendorQuote(id: string, patch: VendorQuoteUpdate): Promise<ProjectLineItemVendorQuote>;
  selectVendorQuote(projectLineItemId: string, quoteId: string): Promise<ProjectLineItemVendorQuote>;
  removeVendorQuote(id: string): Promise<void>;

  listBidHistory(bidItemId: string): Promise<
    Array<{ unit_price_bid: number; outcome: string | null; date: string }>
  >;

  listProjectDocuments(projectId: string): Promise<ProjectDocument[]>;
  addProjectDocument(input: NewProjectDocumentInput): Promise<ProjectDocument>;
  removeProjectDocument(id: string): Promise<void>;
}
