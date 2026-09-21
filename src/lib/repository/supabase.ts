import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import type {
  BidItemEquipmentRowUpdate,
  BidItemLaborRowUpdate,
  BidItemMaterialRowUpdate,
  DuplicateProjectDetailsInput,
  EquipmentOverrideInput,
  LaborOverrideInput,
  NewBidItemEquipmentRowInput,
  NewBidItemInput,
  NewBidItemLaborRowInput,
  NewBidItemMaterialRowInput,
  NewCompanyDefaultsInput,
  NewCrewGroupInput,
  NewCrewGroupMemberInput,
  NewCrewRateInput,
  NewEquipmentGroupInput,
  NewEquipmentGroupMemberInput,
  NewEquipmentRateInput,
  NewMaterialInput,
  NewProjectDocumentInput,
  NewProjectInput,
  NewProjectLineItemInput,
  NewVendorQuoteInput,
  ProjectLineItemUpdate,
  Repository,
  VendorQuoteUpdate,
} from "./types";

const DOCUMENTS_BUCKET = "project-documents";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("supabase query returned no data");
  return data;
}

// PostgREST returns Postgres `numeric` and `bigint` columns as JSON strings
// (to avoid precision loss when a client parses them as IEEE-754 doubles),
// not as JSON numbers. Every domain type in src/types/domain.ts declares
// these fields as `number`, so without this coercion step the app receives
// strings where its own types promise numbers -- harmless until something
// calls .toFixed() (crashes: strings don't have that method) or does
// arithmetic on the value (silently produces NaN / wrong totals instead of
// a crash). This coerces right at the repository boundary so every caller
// can trust the TypeScript types.
function coerceNumeric<T extends object>(row: T, fields: (keyof T)[]): T {
  const mutable = row as Record<string, unknown>;
  for (const field of fields) {
    const value = mutable[field as string];
    if (value !== null && value !== undefined && typeof value !== "number") {
      mutable[field as string] = Number(value);
    }
  }
  return row;
}

function coerceNumericList<T extends object>(rows: T[], fields: (keyof T)[]): T[] {
  return rows.map((row) => coerceNumeric(row, fields));
}

const CREW_RATE_NUMERIC_FIELDS: (keyof CrewRate)[] = ["hourly_rate", "fringe"];
const EQUIPMENT_RATE_NUMERIC_FIELDS: (keyof EquipmentRate)[] = ["hourly_rate"];
const MATERIAL_NUMERIC_FIELDS: (keyof Material)[] = ["rate"];
const COMPANY_DEFAULTS_NUMERIC_FIELDS: (keyof CompanyDefaults)[] = ["overhead_pct", "contingency_pct"];
const BID_ITEM_NUMERIC_FIELDS: (keyof BidItem)[] = [
  "default_overhead_pct",
  "default_profit_pct",
  "default_contingency_pct",
];
const BID_ITEM_LABOR_NUMERIC_FIELDS: (keyof BidItemLabor)[] = ["hours_per_unit"];
const BID_ITEM_EQUIPMENT_NUMERIC_FIELDS: (keyof BidItemEquipment)[] = ["hours_per_unit"];
const BID_ITEM_MATERIAL_NUMERIC_FIELDS: (keyof BidItemMaterial)[] = [
  "qty_per_unit",
  "thickness_in",
  "width_in",
  "depth_in",
  "density_factor",
  "application_rate",
  "waste_pct",
];
const PROJECT_NUMERIC_FIELDS: (keyof Project)[] = ["default_profit_pct"];
const PROJECT_LINE_ITEM_NUMERIC_FIELDS: (keyof ProjectLineItem)[] = [
  "quantity",
  "override_overhead_pct",
  "override_profit_pct",
  "override_contingency_pct",
  "manual_rounded_rate",
];
const MATERIAL_OVERRIDE_NUMERIC_FIELDS: (keyof ProjectLineItemMaterialOverride)[] = [
  "override_rate",
  "override_qty",
];
const LABOR_OVERRIDE_NUMERIC_FIELDS: (keyof ProjectLineItemLaborOverride)[] = ["override_hours"];
const EQUIPMENT_OVERRIDE_NUMERIC_FIELDS: (keyof ProjectLineItemEquipmentOverride)[] = ["override_hours"];
const VENDOR_QUOTE_NUMERIC_FIELDS: (keyof ProjectLineItemVendorQuote)[] = ["quote_amount"];
const PROJECT_DOCUMENT_NUMERIC_FIELDS: (keyof ProjectDocument)[] = ["file_size"];

// Mirrors in-memory.ts's referenceBlockMessage: builds the round-3
// permanent-delete guardrail message from named reference counts. Returns
// null (safe to delete) when every count is zero.
function referenceBlockMessage(parts: Array<{ label: string; count: number }>): string | null {
  const nonZero = parts.filter((p) => p.count > 0);
  if (nonZero.length === 0) return null;
  const joined = nonZero.map((p) => `${p.count} ${p.label}${p.count === 1 ? "" : "s"}`).join(" and ");
  return `Can't permanently delete -- still referenced by ${joined}. Archive keeps it safely out of the way instead.`;
}

function distinctCount<T>(values: Array<T | null | undefined>): number {
  return new Set(values.filter((v): v is T => v != null)).size;
}

export class SupabaseRepository implements Repository {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async listCrewRates() {
    return coerceNumericList(
      unwrap<CrewRate[]>(await this.client.from("crew_rates").select("*").order("role_name")),
      CREW_RATE_NUMERIC_FIELDS
    );
  }

  async getCurrentCrewRate(roleName: string) {
    const { data, error } = await this.client
      .from("crew_rates")
      .select("*")
      .eq("role_name", roleName)
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceNumeric(data as CrewRate, CREW_RATE_NUMERIC_FIELDS) : undefined;
  }

  async addCrewRate(input: NewCrewRateInput) {
    const { error: updateError } = await this.client
      .from("crew_rates")
      .update({ is_current: false })
      .eq("role_name", input.role_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return coerceNumeric(
      unwrap<CrewRate>(
        await this.client.from("crew_rates").insert({ ...input, is_current: true }).select().single()
      ),
      CREW_RATE_NUMERIC_FIELDS
    );
  }

  async archiveCrewRate(id: string) {
    return coerceNumeric(
      unwrap<CrewRate>(
        await this.client.from("crew_rates").update({ is_active: false }).eq("id", id).select().single()
      ),
      CREW_RATE_NUMERIC_FIELDS
    );
  }

  async restoreCrewRate(id: string) {
    return coerceNumeric(
      unwrap<CrewRate>(
        await this.client.from("crew_rates").update({ is_active: true }).eq("id", id).select().single()
      ),
      CREW_RATE_NUMERIC_FIELDS
    );
  }

  async deleteCrewRatePermanently(roleName: string) {
    const rows = unwrap<Pick<CrewRate, "id">[]>(
      await this.client.from("crew_rates").select("id").eq("role_name", roleName)
    );
    const ids = rows.map((r) => r.id);
    const [labor, overrides, groupMembers] = await Promise.all([
      unwrap<{ bid_item_id: string }[]>(
        await this.client.from("bid_item_labor").select("bid_item_id").in("crew_role_id", ids)
      ),
      unwrap<{ project_line_item_id: string }[]>(
        await this.client
          .from("project_line_item_labor_overrides")
          .select("project_line_item_id")
          .in("crew_role_id", ids)
      ),
      unwrap<{ crew_group_id: string }[]>(
        await this.client.from("crew_group_members").select("crew_group_id").in("crew_role_id", ids)
      ),
    ]);
    const overrideLineIds = overrides.map((o) => o.project_line_item_id);
    const overrideProjectIds = overrideLineIds.length
      ? unwrap<{ project_id: string }[]>(
          await this.client.from("project_line_items").select("project_id").in("id", overrideLineIds)
        )
      : [];

    const blockMessage = referenceBlockMessage([
      { label: "bid item", count: distinctCount(labor.map((l) => l.bid_item_id)) },
      { label: "project", count: distinctCount(overrideProjectIds.map((p) => p.project_id)) },
      { label: "crew group", count: distinctCount(groupMembers.map((m) => m.crew_group_id)) },
    ]);
    if (blockMessage) throw new Error(blockMessage);

    const { error } = await this.client.from("crew_rates").delete().eq("role_name", roleName);
    if (error) throw new Error(error.message);
  }

  async listEquipmentRates() {
    return coerceNumericList(
      unwrap<EquipmentRate[]>(await this.client.from("equipment_rates").select("*").order("equipment_name")),
      EQUIPMENT_RATE_NUMERIC_FIELDS
    );
  }

  async getCurrentEquipmentRate(equipmentName: string) {
    const { data, error } = await this.client
      .from("equipment_rates")
      .select("*")
      .eq("equipment_name", equipmentName)
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceNumeric(data as EquipmentRate, EQUIPMENT_RATE_NUMERIC_FIELDS) : undefined;
  }

  async addEquipmentRate(input: NewEquipmentRateInput) {
    const { error: updateError } = await this.client
      .from("equipment_rates")
      .update({ is_current: false })
      .eq("equipment_name", input.equipment_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return coerceNumeric(
      unwrap<EquipmentRate>(
        await this.client
          .from("equipment_rates")
          .insert({ ...input, is_current: true })
          .select()
          .single()
      ),
      EQUIPMENT_RATE_NUMERIC_FIELDS
    );
  }

  async archiveEquipmentRate(id: string) {
    return coerceNumeric(
      unwrap<EquipmentRate>(
        await this.client.from("equipment_rates").update({ is_active: false }).eq("id", id).select().single()
      ),
      EQUIPMENT_RATE_NUMERIC_FIELDS
    );
  }

  async restoreEquipmentRate(id: string) {
    return coerceNumeric(
      unwrap<EquipmentRate>(
        await this.client.from("equipment_rates").update({ is_active: true }).eq("id", id).select().single()
      ),
      EQUIPMENT_RATE_NUMERIC_FIELDS
    );
  }

  async deleteEquipmentRatePermanently(equipmentName: string) {
    const rows = unwrap<Pick<EquipmentRate, "id">[]>(
      await this.client.from("equipment_rates").select("id").eq("equipment_name", equipmentName)
    );
    const ids = rows.map((r) => r.id);
    const [equipment, overrides, groupMembers] = await Promise.all([
      unwrap<{ bid_item_id: string }[]>(
        await this.client.from("bid_item_equipment").select("bid_item_id").in("equipment_id", ids)
      ),
      unwrap<{ project_line_item_id: string }[]>(
        await this.client
          .from("project_line_item_equipment_overrides")
          .select("project_line_item_id")
          .in("equipment_id", ids)
      ),
      unwrap<{ equipment_group_id: string }[]>(
        await this.client.from("equipment_group_members").select("equipment_group_id").in("equipment_id", ids)
      ),
    ]);
    const overrideLineIds = overrides.map((o) => o.project_line_item_id);
    const overrideProjectIds = overrideLineIds.length
      ? unwrap<{ project_id: string }[]>(
          await this.client.from("project_line_items").select("project_id").in("id", overrideLineIds)
        )
      : [];

    const blockMessage = referenceBlockMessage([
      { label: "bid item", count: distinctCount(equipment.map((e) => e.bid_item_id)) },
      { label: "project", count: distinctCount(overrideProjectIds.map((p) => p.project_id)) },
      { label: "equipment group", count: distinctCount(groupMembers.map((m) => m.equipment_group_id)) },
    ]);
    if (blockMessage) throw new Error(blockMessage);

    const { error } = await this.client.from("equipment_rates").delete().eq("equipment_name", equipmentName);
    if (error) throw new Error(error.message);
  }

  async listMaterials() {
    return coerceNumericList(
      unwrap<Material[]>(await this.client.from("materials").select("*").order("material_name")),
      MATERIAL_NUMERIC_FIELDS
    );
  }

  async getCurrentMaterial(materialName: string) {
    const { data, error } = await this.client
      .from("materials")
      .select("*")
      .eq("material_name", materialName)
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceNumeric(data as Material, MATERIAL_NUMERIC_FIELDS) : undefined;
  }

  async addMaterial(input: NewMaterialInput) {
    const { error: updateError } = await this.client
      .from("materials")
      .update({ is_current: false })
      .eq("material_name", input.material_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return coerceNumeric(
      unwrap<Material>(
        await this.client.from("materials").insert({ ...input, is_current: true }).select().single()
      ),
      MATERIAL_NUMERIC_FIELDS
    );
  }

  async archiveMaterial(id: string) {
    return coerceNumeric(
      unwrap<Material>(
        await this.client.from("materials").update({ is_active: false }).eq("id", id).select().single()
      ),
      MATERIAL_NUMERIC_FIELDS
    );
  }

  async restoreMaterial(id: string) {
    return coerceNumeric(
      unwrap<Material>(
        await this.client.from("materials").update({ is_active: true }).eq("id", id).select().single()
      ),
      MATERIAL_NUMERIC_FIELDS
    );
  }

  async deleteMaterialPermanently(materialName: string) {
    const rows = unwrap<Pick<Material, "id">[]>(
      await this.client.from("materials").select("id").eq("material_name", materialName)
    );
    const ids = rows.map((r) => r.id);
    const [materials, overrides] = await Promise.all([
      unwrap<{ bid_item_id: string }[]>(
        await this.client.from("bid_item_materials").select("bid_item_id").in("material_id", ids)
      ),
      unwrap<{ project_line_item_id: string }[]>(
        await this.client
          .from("project_line_item_material_overrides")
          .select("project_line_item_id")
          .in("material_id", ids)
      ),
    ]);
    const overrideLineIds = overrides.map((o) => o.project_line_item_id);
    const overrideProjectIds = overrideLineIds.length
      ? unwrap<{ project_id: string }[]>(
          await this.client.from("project_line_items").select("project_id").in("id", overrideLineIds)
        )
      : [];

    const blockMessage = referenceBlockMessage([
      { label: "bid item", count: distinctCount(materials.map((m) => m.bid_item_id)) },
      { label: "project", count: distinctCount(overrideProjectIds.map((p) => p.project_id)) },
    ]);
    if (blockMessage) throw new Error(blockMessage);

    const { error } = await this.client.from("materials").delete().eq("material_name", materialName);
    if (error) throw new Error(error.message);
  }

  async getCurrentCompanyDefaults() {
    const { data, error } = await this.client
      .from("company_defaults")
      .select("*")
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceNumeric(data as CompanyDefaults, COMPANY_DEFAULTS_NUMERIC_FIELDS) : undefined;
  }

  async addCompanyDefaults(input: NewCompanyDefaultsInput) {
    const { error: updateError } = await this.client
      .from("company_defaults")
      .update({ is_current: false })
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return coerceNumeric(
      unwrap<CompanyDefaults>(
        await this.client
          .from("company_defaults")
          .insert({ ...input, is_current: true })
          .select()
          .single()
      ),
      COMPANY_DEFAULTS_NUMERIC_FIELDS
    );
  }

  // ---------------- Crew / equipment groups ----------------

  async listCrewGroups() {
    return unwrap<CrewGroup[]>(await this.client.from("crew_groups").select("*").order("group_name"));
  }

  async listCrewGroupMembers(crewGroupId: string) {
    return unwrap<CrewGroupMember[]>(
      await this.client.from("crew_group_members").select("*").eq("crew_group_id", crewGroupId)
    );
  }

  async createCrewGroup(input: NewCrewGroupInput) {
    return unwrap<CrewGroup>(await this.client.from("crew_groups").insert(input).select().single());
  }

  async updateCrewGroup(id: string, patch: Partial<NewCrewGroupInput>) {
    return unwrap<CrewGroup>(
      await this.client.from("crew_groups").update(patch).eq("id", id).select().single()
    );
  }

  async deleteCrewGroup(id: string) {
    const { error } = await this.client.from("crew_groups").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async addCrewGroupMember(crewGroupId: string, input: NewCrewGroupMemberInput) {
    return unwrap<CrewGroupMember>(
      await this.client
        .from("crew_group_members")
        .insert({ ...input, crew_group_id: crewGroupId })
        .select()
        .single()
    );
  }

  async updateCrewGroupMember(id: string, patch: { default_headcount: number }) {
    return unwrap<CrewGroupMember>(
      await this.client.from("crew_group_members").update(patch).eq("id", id).select().single()
    );
  }

  async removeCrewGroupMember(id: string) {
    const { error } = await this.client.from("crew_group_members").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listEquipmentGroups() {
    return unwrap<EquipmentGroup[]>(
      await this.client.from("equipment_groups").select("*").order("group_name")
    );
  }

  async listEquipmentGroupMembers(equipmentGroupId: string) {
    return unwrap<EquipmentGroupMember[]>(
      await this.client
        .from("equipment_group_members")
        .select("*")
        .eq("equipment_group_id", equipmentGroupId)
    );
  }

  async createEquipmentGroup(input: NewEquipmentGroupInput) {
    return unwrap<EquipmentGroup>(
      await this.client.from("equipment_groups").insert(input).select().single()
    );
  }

  async updateEquipmentGroup(id: string, patch: Partial<NewEquipmentGroupInput>) {
    return unwrap<EquipmentGroup>(
      await this.client.from("equipment_groups").update(patch).eq("id", id).select().single()
    );
  }

  async deleteEquipmentGroup(id: string) {
    const { error } = await this.client.from("equipment_groups").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async addEquipmentGroupMember(equipmentGroupId: string, input: NewEquipmentGroupMemberInput) {
    return unwrap<EquipmentGroupMember>(
      await this.client
        .from("equipment_group_members")
        .insert({ ...input, equipment_group_id: equipmentGroupId })
        .select()
        .single()
    );
  }

  async removeEquipmentGroupMember(id: string) {
    const { error } = await this.client.from("equipment_group_members").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // ---------------- Bid item catalog ----------------

  async listBidItems() {
    return coerceNumericList(
      unwrap<BidItem[]>(
        await this.client
          .from("bid_items")
          .select("*")
          .eq("is_saved_to_library", true)
          .eq("is_active", true)
          .order("item_name")
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async listArchivedBidItems() {
    return coerceNumericList(
      unwrap<BidItem[]>(
        await this.client
          .from("bid_items")
          .select("*")
          .eq("is_saved_to_library", true)
          .eq("is_active", false)
          .order("item_name")
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async archiveBidItem(id: string) {
    return coerceNumeric(
      unwrap<BidItem>(
        await this.client.from("bid_items").update({ is_active: false }).eq("id", id).select().single()
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async restoreBidItem(id: string) {
    return coerceNumeric(
      unwrap<BidItem>(
        await this.client.from("bid_items").update({ is_active: true }).eq("id", id).select().single()
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async deleteBidItemPermanently(id: string) {
    const [lineItems, history] = await Promise.all([
      unwrap<{ project_id: string }[]>(
        await this.client.from("project_line_items").select("project_id").eq("bid_item_id", id)
      ),
      unwrap<{ id: string }[]>(await this.client.from("bid_history").select("id").eq("bid_item_id", id)),
    ]);
    const blockMessage = referenceBlockMessage([
      { label: "project", count: distinctCount(lineItems.map((li) => li.project_id)) },
      { label: "historical bid record", count: history.length },
    ]);
    if (blockMessage) throw new Error(blockMessage);

    const { error } = await this.client.from("bid_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async searchBidItems(query: string) {
    const q = query.trim();
    if (!q) return this.listBidItems();
    return coerceNumericList(
      unwrap<BidItem[]>(
        await this.client
          .from("bid_items")
          .select("*")
          .eq("is_saved_to_library", true)
          .eq("is_active", true)
          .or(`item_name.ilike.%${q}%,description.ilike.%${q}%`)
          .order("item_name")
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async getBidItemRecipe(bidItemId: string): Promise<BidItemRecipe | undefined> {
    const { data: item, error: itemError } = await this.client
      .from("bid_items")
      .select("*")
      .eq("id", bidItemId)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item) return undefined;

    const [labor, equipment, materials] = await Promise.all([
      unwrap<BidItemLabor[]>(await this.client.from("bid_item_labor").select("*").eq("bid_item_id", bidItemId)),
      unwrap<BidItemEquipment[]>(
        await this.client.from("bid_item_equipment").select("*").eq("bid_item_id", bidItemId)
      ),
      unwrap<BidItemMaterial[]>(
        await this.client.from("bid_item_materials").select("*").eq("bid_item_id", bidItemId)
      ),
    ]);

    return {
      item: coerceNumeric(item as BidItem, BID_ITEM_NUMERIC_FIELDS),
      labor: coerceNumericList(labor, BID_ITEM_LABOR_NUMERIC_FIELDS),
      equipment: coerceNumericList(equipment, BID_ITEM_EQUIPMENT_NUMERIC_FIELDS),
      materials: coerceNumericList(materials, BID_ITEM_MATERIAL_NUMERIC_FIELDS),
    };
  }

  async createBidItem(input: NewBidItemInput): Promise<BidItemRecipe> {
    const item = coerceNumeric(
      unwrap<BidItem>(
        await this.client
          .from("bid_items")
          .insert({
            item_name: input.item_name,
            description: input.description ?? null,
            unit: input.unit,
            item_type: input.item_type,
            default_overhead_pct: input.default_overhead_pct ?? null,
            default_profit_pct: input.default_profit_pct ?? null,
            default_contingency_pct: input.default_contingency_pct ?? null,
            notes: input.notes ?? null,
            is_saved_to_library: input.is_saved_to_library ?? true,
          })
          .select()
          .single()
      ),
      BID_ITEM_NUMERIC_FIELDS
    );

    const labor = input.labor.length
      ? coerceNumericList(
          unwrap<BidItemLabor[]>(
            await this.client
              .from("bid_item_labor")
              .insert(input.labor.map((l) => ({ ...l, bid_item_id: item.id })))
              .select()
          ),
          BID_ITEM_LABOR_NUMERIC_FIELDS
        )
      : [];
    const equipment = input.equipment.length
      ? coerceNumericList(
          unwrap<BidItemEquipment[]>(
            await this.client
              .from("bid_item_equipment")
              .insert(input.equipment.map((e) => ({ ...e, bid_item_id: item.id })))
              .select()
          ),
          BID_ITEM_EQUIPMENT_NUMERIC_FIELDS
        )
      : [];
    const materials = input.materials.length
      ? coerceNumericList(
          unwrap<BidItemMaterial[]>(
            await this.client
              .from("bid_item_materials")
              .insert(input.materials.map((m) => ({ ...m, bid_item_id: item.id })))
              .select()
          ),
          BID_ITEM_MATERIAL_NUMERIC_FIELDS
        )
      : [];

    return { item, labor, equipment, materials };
  }

  async duplicateBidItem(bidItemId: string, newName: string): Promise<BidItemRecipe> {
    const source = await this.getBidItemRecipe(bidItemId);
    if (!source) throw new Error(`bid item not found: ${bidItemId}`);
    return this.createBidItem({
      item_name: newName,
      description: source.item.description,
      unit: source.item.unit,
      item_type: source.item.item_type,
      default_overhead_pct: source.item.default_overhead_pct,
      default_profit_pct: source.item.default_profit_pct,
      default_contingency_pct: source.item.default_contingency_pct,
      notes: source.item.notes,
      is_saved_to_library: true,
      labor: source.labor.map((l) => ({
        crew_role_id: l.crew_role_id,
        hours_per_unit: l.hours_per_unit,
        headcount: l.headcount,
      })),
      equipment: source.equipment.map((e) => ({
        equipment_id: e.equipment_id,
        hours_per_unit: e.hours_per_unit,
      })),
      materials: source.materials.map(({ id: _id, bid_item_id: _bid_item_id, ...rest }) => rest),
    });
  }

  async saveBidItemToLibrary(bidItemId: string) {
    return coerceNumeric(
      unwrap<BidItem>(
        await this.client
          .from("bid_items")
          .update({ is_saved_to_library: true })
          .eq("id", bidItemId)
          .select()
          .single()
      ),
      BID_ITEM_NUMERIC_FIELDS
    );
  }

  async addBidItemLaborRow(bidItemId: string, input: NewBidItemLaborRowInput) {
    return coerceNumeric(
      unwrap<BidItemLabor>(
        await this.client
          .from("bid_item_labor")
          .insert({ ...input, bid_item_id: bidItemId })
          .select()
          .single()
      ),
      BID_ITEM_LABOR_NUMERIC_FIELDS
    );
  }

  async updateBidItemLaborRow(rowId: string, patch: BidItemLaborRowUpdate) {
    return coerceNumeric(
      unwrap<BidItemLabor>(
        await this.client.from("bid_item_labor").update(patch).eq("id", rowId).select().single()
      ),
      BID_ITEM_LABOR_NUMERIC_FIELDS
    );
  }

  async removeBidItemLaborRow(rowId: string) {
    const { error } = await this.client.from("bid_item_labor").delete().eq("id", rowId);
    if (error) throw new Error(error.message);
  }

  async addBidItemEquipmentRow(bidItemId: string, input: NewBidItemEquipmentRowInput) {
    return coerceNumeric(
      unwrap<BidItemEquipment>(
        await this.client
          .from("bid_item_equipment")
          .insert({ ...input, bid_item_id: bidItemId })
          .select()
          .single()
      ),
      BID_ITEM_EQUIPMENT_NUMERIC_FIELDS
    );
  }

  async updateBidItemEquipmentRow(rowId: string, patch: BidItemEquipmentRowUpdate) {
    return coerceNumeric(
      unwrap<BidItemEquipment>(
        await this.client.from("bid_item_equipment").update(patch).eq("id", rowId).select().single()
      ),
      BID_ITEM_EQUIPMENT_NUMERIC_FIELDS
    );
  }

  async removeBidItemEquipmentRow(rowId: string) {
    const { error } = await this.client.from("bid_item_equipment").delete().eq("id", rowId);
    if (error) throw new Error(error.message);
  }

  async addBidItemMaterialRow(bidItemId: string, input: NewBidItemMaterialRowInput) {
    return coerceNumeric(
      unwrap<BidItemMaterial>(
        await this.client
          .from("bid_item_materials")
          .insert({ ...input, bid_item_id: bidItemId })
          .select()
          .single()
      ),
      BID_ITEM_MATERIAL_NUMERIC_FIELDS
    );
  }

  async updateBidItemMaterialRow(rowId: string, patch: BidItemMaterialRowUpdate) {
    return coerceNumeric(
      unwrap<BidItemMaterial>(
        await this.client.from("bid_item_materials").update(patch).eq("id", rowId).select().single()
      ),
      BID_ITEM_MATERIAL_NUMERIC_FIELDS
    );
  }

  async removeBidItemMaterialRow(rowId: string) {
    const { error } = await this.client.from("bid_item_materials").delete().eq("id", rowId);
    if (error) throw new Error(error.message);
  }

  // ---------------- Projects ----------------

  async listProjects() {
    return coerceNumericList(
      unwrap<Project[]>(
        await this.client.from("projects").select("*").order("created_at", { ascending: false })
      ),
      PROJECT_NUMERIC_FIELDS
    );
  }

  async getProject(projectId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceNumeric(data as Project, PROJECT_NUMERIC_FIELDS) : undefined;
  }

  async createProject(input: NewProjectInput) {
    let defaultProfitPct = input.default_profit_pct;
    if (defaultProfitPct === undefined) {
      // Round 4 #1: profit is no longer collected on the New Project form --
      // new projects silently inherit the most recently used profit %,
      // editable only on the Review screen.
      const { data: lastProject } = await this.client
        .from("projects")
        .select("default_profit_pct")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      defaultProfitPct = lastProject?.default_profit_pct !== undefined && lastProject?.default_profit_pct !== null
        ? Number(lastProject.default_profit_pct)
        : 0;
    }
    return coerceNumeric(
      unwrap<Project>(
        await this.client
          .from("projects")
          .insert({ ...input, default_profit_pct: defaultProfitPct, status: "estimating" })
          .select()
          .single()
      ),
      PROJECT_NUMERIC_FIELDS
    );
  }

  // Round 4 #2: rebuilds a new project from an existing one's line-item
  // structure and customization choices, but never its stale pricing --
  // manual rounded rates, vendor quotes, and item #/name overrides all
  // reset, and every line recalculates off today's current rates because
  // the calc engine always resolves rates by name at read time, never off
  // a frozen snapshot.
  async duplicateProject(sourceProjectId: string, details: DuplicateProjectDetailsInput) {
    const source = await this.getProject(sourceProjectId);
    if (!source) throw new Error(`project not found: ${sourceProjectId}`);

    const newProject = await this.createProject({
      project_name: details.project_name,
      client: details.client,
      location: details.location,
      dot_or_municipality: details.dot_or_municipality,
      bid_date: details.bid_date,
    });

    const sourceLines = unwrap<ProjectLineItem[]>(
      await this.client
        .from("project_line_items")
        .select("*")
        .eq("project_id", sourceProjectId)
        .order("sort_order")
    );

    for (const sourceLine of sourceLines) {
      const newLine = unwrap<ProjectLineItem>(
        await this.client
          .from("project_line_items")
          .insert({
            project_id: newProject.id,
            bid_item_id: sourceLine.bid_item_id,
            quantity: sourceLine.quantity,
            override_overhead_pct: sourceLine.override_overhead_pct,
            override_profit_pct: null,
            override_contingency_pct: sourceLine.override_contingency_pct,
            manual_rounded_rate: null,
            sort_order: sourceLine.sort_order,
            notes_override: sourceLine.notes_override,
            item_number_override: null,
            item_name_override: null,
            is_subcontracted: sourceLine.is_subcontracted,
            sub_markup_pct: sourceLine.sub_markup_pct,
          })
          .select()
          .single()
      );

      const [materialOverrides, laborOverrides, equipmentOverrides] = await Promise.all([
        unwrap<ProjectLineItemMaterialOverride[]>(
          await this.client
            .from("project_line_item_material_overrides")
            .select("*")
            .eq("project_line_item_id", sourceLine.id)
        ),
        unwrap<ProjectLineItemLaborOverride[]>(
          await this.client
            .from("project_line_item_labor_overrides")
            .select("*")
            .eq("project_line_item_id", sourceLine.id)
        ),
        unwrap<ProjectLineItemEquipmentOverride[]>(
          await this.client
            .from("project_line_item_equipment_overrides")
            .select("*")
            .eq("project_line_item_id", sourceLine.id)
        ),
      ]);

      if (materialOverrides.length) {
        await this.client.from("project_line_item_material_overrides").insert(
          materialOverrides.map((o) => ({
            project_line_item_id: newLine.id,
            material_id: o.material_id,
            override_rate: o.override_rate,
            override_qty: o.override_qty,
          }))
        );
      }
      if (laborOverrides.length) {
        await this.client.from("project_line_item_labor_overrides").insert(
          laborOverrides.map((o) => ({
            project_line_item_id: newLine.id,
            crew_role_id: o.crew_role_id,
            override_hours: o.override_hours,
            override_headcount: o.override_headcount,
          }))
        );
      }
      if (equipmentOverrides.length) {
        await this.client.from("project_line_item_equipment_overrides").insert(
          equipmentOverrides.map((o) => ({
            project_line_item_id: newLine.id,
            equipment_id: o.equipment_id,
            override_hours: o.override_hours,
          }))
        );
      }
      // Vendor quotes are intentionally NOT copied.
    }

    return newProject;
  }

  async updateProjectStatus(projectId: string, status: Project["status"]) {
    return coerceNumeric(
      unwrap<Project>(
        await this.client.from("projects").update({ status }).eq("id", projectId).select().single()
      ),
      PROJECT_NUMERIC_FIELDS
    );
  }

  async updateProjectLastUsedProfit(projectId: string, profitPct: number) {
    return coerceNumeric(
      unwrap<Project>(
        await this.client
          .from("projects")
          .update({ default_profit_pct: profitPct })
          .eq("id", projectId)
          .select()
          .single()
      ),
      PROJECT_NUMERIC_FIELDS
    );
  }

  // ---------------- Project line items ----------------

  async listProjectLineItems(projectId: string) {
    return coerceNumericList(
      unwrap<ProjectLineItem[]>(
        await this.client
          .from("project_line_items")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order")
      ),
      PROJECT_LINE_ITEM_NUMERIC_FIELDS
    );
  }

  async addProjectLineItem(input: NewProjectLineItemInput) {
    const existing = unwrap<Pick<ProjectLineItem, "sort_order">[]>(
      await this.client
        .from("project_line_items")
        .select("sort_order")
        .eq("project_id", input.project_id)
        .order("sort_order", { ascending: false })
        .limit(1)
    );
    const nextSort = existing.length ? existing[0].sort_order + 1 : 0;

    let isSubcontracted = input.is_subcontracted;
    if (isSubcontracted === undefined) {
      const { data: bidItem } = await this.client
        .from("bid_items")
        .select("item_type")
        .eq("id", input.bid_item_id)
        .maybeSingle();
      isSubcontracted = bidItem?.item_type === "sub_quote";
    }

    const created = coerceNumeric(
      unwrap<ProjectLineItem>(
        await this.client
          .from("project_line_items")
          .insert({ ...input, is_subcontracted: isSubcontracted, sort_order: nextSort })
          .select()
          .single()
      ),
      PROJECT_LINE_ITEM_NUMERIC_FIELDS
    );

    await this.client
      .from("bid_items")
      .update({ last_used_date: new Date().toISOString() })
      .eq("id", input.bid_item_id);

    return created;
  }

  async updateProjectLineItem(id: string, update: ProjectLineItemUpdate) {
    return coerceNumeric(
      unwrap<ProjectLineItem>(
        await this.client.from("project_line_items").update(update).eq("id", id).select().single()
      ),
      PROJECT_LINE_ITEM_NUMERIC_FIELDS
    );
  }

  async removeProjectLineItem(id: string) {
    const { error } = await this.client.from("project_line_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // ---------------- Material / labor / equipment overrides ----------------

  async listMaterialOverrides(projectLineItemId: string) {
    return coerceNumericList(
      unwrap<ProjectLineItemMaterialOverride[]>(
        await this.client
          .from("project_line_item_material_overrides")
          .select("*")
          .eq("project_line_item_id", projectLineItemId)
      ),
      MATERIAL_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async setMaterialOverride(
    projectLineItemId: string,
    materialId: string,
    override: { override_rate?: number | null; override_qty?: number | null }
  ) {
    return coerceNumeric(
      unwrap<ProjectLineItemMaterialOverride>(
        await this.client
          .from("project_line_item_material_overrides")
          .upsert(
            { project_line_item_id: projectLineItemId, material_id: materialId, ...override },
            { onConflict: "project_line_item_id,material_id" }
          )
          .select()
          .single()
      ),
      MATERIAL_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async clearMaterialOverride(projectLineItemId: string, materialId: string) {
    const { error } = await this.client
      .from("project_line_item_material_overrides")
      .delete()
      .eq("project_line_item_id", projectLineItemId)
      .eq("material_id", materialId);
    if (error) throw new Error(error.message);
  }

  async listLaborOverrides(projectLineItemId: string) {
    return coerceNumericList(
      unwrap<ProjectLineItemLaborOverride[]>(
        await this.client
          .from("project_line_item_labor_overrides")
          .select("*")
          .eq("project_line_item_id", projectLineItemId)
      ),
      LABOR_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async setLaborOverride(projectLineItemId: string, crewRoleId: string, override: LaborOverrideInput) {
    return coerceNumeric(
      unwrap<ProjectLineItemLaborOverride>(
        await this.client
          .from("project_line_item_labor_overrides")
          .upsert(
            { project_line_item_id: projectLineItemId, crew_role_id: crewRoleId, ...override },
            { onConflict: "project_line_item_id,crew_role_id" }
          )
          .select()
          .single()
      ),
      LABOR_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async clearLaborOverride(projectLineItemId: string, crewRoleId: string) {
    const { error } = await this.client
      .from("project_line_item_labor_overrides")
      .delete()
      .eq("project_line_item_id", projectLineItemId)
      .eq("crew_role_id", crewRoleId);
    if (error) throw new Error(error.message);
  }

  async listEquipmentOverrides(projectLineItemId: string) {
    return coerceNumericList(
      unwrap<ProjectLineItemEquipmentOverride[]>(
        await this.client
          .from("project_line_item_equipment_overrides")
          .select("*")
          .eq("project_line_item_id", projectLineItemId)
      ),
      EQUIPMENT_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async setEquipmentOverride(projectLineItemId: string, equipmentId: string, override: EquipmentOverrideInput) {
    return coerceNumeric(
      unwrap<ProjectLineItemEquipmentOverride>(
        await this.client
          .from("project_line_item_equipment_overrides")
          .upsert(
            { project_line_item_id: projectLineItemId, equipment_id: equipmentId, ...override },
            { onConflict: "project_line_item_id,equipment_id" }
          )
          .select()
          .single()
      ),
      EQUIPMENT_OVERRIDE_NUMERIC_FIELDS
    );
  }

  async clearEquipmentOverride(projectLineItemId: string, equipmentId: string) {
    const { error } = await this.client
      .from("project_line_item_equipment_overrides")
      .delete()
      .eq("project_line_item_id", projectLineItemId)
      .eq("equipment_id", equipmentId);
    if (error) throw new Error(error.message);
  }

  // ---------------- Vendor quotes (subcontracting) ----------------

  async listVendorQuotes(projectLineItemId: string) {
    return coerceNumericList(
      unwrap<ProjectLineItemVendorQuote[]>(
        await this.client
          .from("project_line_item_vendor_quotes")
          .select("*")
          .eq("project_line_item_id", projectLineItemId)
      ),
      VENDOR_QUOTE_NUMERIC_FIELDS
    );
  }

  async addVendorQuote(projectLineItemId: string, input: NewVendorQuoteInput) {
    const existing = unwrap<ProjectLineItemVendorQuote[]>(
      await this.client
        .from("project_line_item_vendor_quotes")
        .select("*")
        .eq("project_line_item_id", projectLineItemId)
    );
    return coerceNumeric(
      unwrap<ProjectLineItemVendorQuote>(
        await this.client
          .from("project_line_item_vendor_quotes")
          .insert({
            project_line_item_id: projectLineItemId,
            vendor_name: input.vendor_name,
            quote_amount: input.quote_amount,
            notes: input.notes ?? null,
            is_selected: existing.length === 0,
          })
          .select()
          .single()
      ),
      VENDOR_QUOTE_NUMERIC_FIELDS
    );
  }

  async updateVendorQuote(id: string, patch: VendorQuoteUpdate) {
    if (patch.is_selected) {
      const { data: quote } = await this.client
        .from("project_line_item_vendor_quotes")
        .select("project_line_item_id")
        .eq("id", id)
        .maybeSingle();
      if (quote) {
        await this.client
          .from("project_line_item_vendor_quotes")
          .update({ is_selected: false })
          .eq("project_line_item_id", quote.project_line_item_id);
      }
    }
    return coerceNumeric(
      unwrap<ProjectLineItemVendorQuote>(
        await this.client
          .from("project_line_item_vendor_quotes")
          .update(patch)
          .eq("id", id)
          .select()
          .single()
      ),
      VENDOR_QUOTE_NUMERIC_FIELDS
    );
  }

  async selectVendorQuote(projectLineItemId: string, quoteId: string) {
    await this.client
      .from("project_line_item_vendor_quotes")
      .update({ is_selected: false })
      .eq("project_line_item_id", projectLineItemId);
    return coerceNumeric(
      unwrap<ProjectLineItemVendorQuote>(
        await this.client
          .from("project_line_item_vendor_quotes")
          .update({ is_selected: true })
          .eq("id", quoteId)
          .select()
          .single()
      ),
      VENDOR_QUOTE_NUMERIC_FIELDS
    );
  }

  async removeVendorQuote(id: string) {
    const { error } = await this.client.from("project_line_item_vendor_quotes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // ---------------- Bid history ----------------

  async listBidHistory(bidItemId: string) {
    return coerceNumericList(
      unwrap<Array<{ unit_price_bid: number; outcome: string | null; date: string }>>(
        await this.client
          .from("bid_history")
          .select("unit_price_bid, outcome, date")
          .eq("bid_item_id", bidItemId)
      ),
      ["unit_price_bid"]
    );
  }

  // ---------------- Documents ----------------

  async listProjectDocuments(projectId: string) {
    return coerceNumericList(
      unwrap<ProjectDocument[]>(
        await this.client
          .from("project_documents")
          .select("*")
          .eq("project_id", projectId)
          .order("uploaded_date", { ascending: false })
      ),
      PROJECT_DOCUMENT_NUMERIC_FIELDS
    );
  }

  async addProjectDocument(input: NewProjectDocumentInput) {
    const path = `${input.project_id}/${input.category}/${Date.now()}-${input.file_name}`;
    const { error: uploadError } = await this.client.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, input.content, { contentType: "application/octet-stream" });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = this.client.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);

    return coerceNumeric(
      unwrap<ProjectDocument>(
        await this.client
          .from("project_documents")
          .insert({
            project_id: input.project_id,
            category: input.category,
            file_name: input.file_name,
            file_size: input.file_size,
            file_url: publicUrl.publicUrl,
          })
          .select()
          .single()
      ),
      PROJECT_DOCUMENT_NUMERIC_FIELDS
    );
  }

  async removeProjectDocument(id: string) {
    const { error } = await this.client.from("project_documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
