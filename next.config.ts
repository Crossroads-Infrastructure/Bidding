import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BidItem,
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectLineItem,
  ProjectLineItemMaterialOverride,
} from "@/types/domain";
import type {
  NewBidItemInput,
  NewCrewRateInput,
  NewEquipmentRateInput,
  NewMaterialInput,
  NewProjectInput,
  NewProjectLineItemInput,
  ProjectLineItemUpdate,
  Repository,
} from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("supabase query returned no data");
  return data;
}

export class SupabaseRepository implements Repository {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async listCrewRates() {
    return unwrap<CrewRate[]>(
      await this.client.from("crew_rates").select("*").order("role_name")
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
    return data ?? undefined;
  }

  async addCrewRate(input: NewCrewRateInput) {
    const { error: updateError } = await this.client
      .from("crew_rates")
      .update({ is_current: false })
      .eq("role_name", input.role_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return unwrap<CrewRate>(
      await this.client
        .from("crew_rates")
        .insert({ ...input, is_current: true })
        .select()
        .single()
    );
  }

  async listEquipmentRates() {
    return unwrap<EquipmentRate[]>(
      await this.client.from("equipment_rates").select("*").order("equipment_name")
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
    return data ?? undefined;
  }

  async addEquipmentRate(input: NewEquipmentRateInput) {
    const { error: updateError } = await this.client
      .from("equipment_rates")
      .update({ is_current: false })
      .eq("equipment_name", input.equipment_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return unwrap<EquipmentRate>(
      await this.client
        .from("equipment_rates")
        .insert({ ...input, is_current: true })
        .select()
        .single()
    );
  }

  async listMaterials() {
    return unwrap<Material[]>(
      await this.client.from("materials").select("*").order("material_name")
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
    return data ?? undefined;
  }

  async addMaterial(input: NewMaterialInput) {
    const { error: updateError } = await this.client
      .from("materials")
      .update({ is_current: false })
      .eq("material_name", input.material_name)
      .eq("is_current", true);
    if (updateError) throw new Error(updateError.message);

    return unwrap<Material>(
      await this.client
        .from("materials")
        .insert({ ...input, is_current: true })
        .select()
        .single()
    );
  }

  async listBidItems() {
    return unwrap<BidItem[]>(
      await this.client.from("bid_items").select("*").order("item_name")
    );
  }

  async searchBidItems(query: string) {
    const q = query.trim();
    if (!q) return this.listBidItems();
    return unwrap<BidItem[]>(
      await this.client
        .from("bid_items")
        .select("*")
        .or(`item_name.ilike.%${q}%,description.ilike.%${q}%`)
        .order("item_name")
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
      unwrap(await this.client.from("bid_item_labor").select("*").eq("bid_item_id", bidItemId)),
      unwrap(
        await this.client.from("bid_item_equipment").select("*").eq("bid_item_id", bidItemId)
      ),
      unwrap(
        await this.client.from("bid_item_materials").select("*").eq("bid_item_id", bidItemId)
      ),
    ]);

    return { item, labor, equipment, materials };
  }

  async createBidItem(input: NewBidItemInput): Promise<BidItemRecipe> {
    const item = unwrap<BidItem>(
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
        })
        .select()
        .single()
    );

    const labor = input.labor.length
      ? unwrap(
          await this.client
            .from("bid_item_labor")
            .insert(input.labor.map((l) => ({ ...l, bid_item_id: item.id })))
            .select()
        )
      : [];
    const equipment = input.equipment.length
      ? unwrap(
          await this.client
            .from("bid_item_equipment")
            .insert(input.equipment.map((e) => ({ ...e, bid_item_id: item.id })))
            .select()
        )
      : [];
    const materials = input.materials.length
      ? unwrap(
          await this.client
            .from("bid_item_materials")
            .insert(input.materials.map((m) => ({ ...m, bid_item_id: item.id })))
            .select()
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

  async listProjects() {
    return unwrap<Project[]>(
      await this.client.from("projects").select("*").order("created_at", { ascending: false })
    );
  }

  async getProject(projectId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? undefined;
  }

  async createProject(input: NewProjectInput) {
    return unwrap<Project>(
      await this.client
        .from("projects")
        .insert({ ...input, status: "estimating" })
        .select()
        .single()
    );
  }

  async updateProjectStatus(projectId: string, status: Project["status"]) {
    return unwrap<Project>(
      await this.client
        .from("projects")
        .update({ status })
        .eq("id", projectId)
        .select()
        .single()
    );
  }

  async listProjectLineItems(projectId: string) {
    return unwrap<ProjectLineItem[]>(
      await this.client
        .from("project_line_items")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")
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

    const created = unwrap<ProjectLineItem>(
      await this.client
        .from("project_line_items")
        .insert({ ...input, sort_order: nextSort })
        .select()
        .single()
    );

    await this.client
      .from("bid_items")
      .update({ last_used_date: new Date().toISOString() })
      .eq("id", input.bid_item_id);

    return created;
  }

  async updateProjectLineItem(id: string, update: ProjectLineItemUpdate) {
    return unwrap<ProjectLineItem>(
      await this.client.from("project_line_items").update(update).eq("id", id).select().single()
    );
  }

  async removeProjectLineItem(id: string) {
    const { error } = await this.client.from("project_line_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listMaterialOverrides(projectLineItemId: string) {
    return unwrap<ProjectLineItemMaterialOverride[]>(
      await this.client
        .from("project_line_item_material_overrides")
        .select("*")
        .eq("project_line_item_id", projectLineItemId)
    );
  }

  async setMaterialOverride(
    projectLineItemId: string,
    materialId: string,
    override: { override_rate?: number | null; override_qty?: number | null }
  ) {
    return unwrap<ProjectLineItemMaterialOverride>(
      await this.client
        .from("project_line_item_material_overrides")
        .upsert(
          {
            project_line_item_id: projectLineItemId,
            material_id: materialId,
            ...override,
          },
          { onConflict: "project_line_item_id,material_id" }
        )
        .select()
        .single()
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
}
