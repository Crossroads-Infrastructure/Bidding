import { randomUUID } from "node:crypto";
import type {
  BidItem,
  BidItemEquipment,
  BidItemLabor,
  BidItemMaterial,
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectLineItem,
  ProjectLineItemMaterialOverride,
} from "@/types/domain";
import {
  seedBidItems,
  seedCrewRates,
  seedEquipmentRates,
  seedMaterials,
} from "@/lib/seed-data";
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

// Single in-process store. Re-seeded on server restart. This is intentional:
// it exists so the app is runnable and demoable before a real Supabase
// project is wired up, not as a persistence layer.
class Store {
  crewRates: CrewRate[] = [...seedCrewRates];
  equipmentRates: EquipmentRate[] = [...seedEquipmentRates];
  materials: Material[] = [...seedMaterials];

  bidItems: BidItem[] = seedBidItems.map((r) => r.item);
  bidItemLabor: BidItemLabor[] = seedBidItems.flatMap((r) => r.labor);
  bidItemEquipment: BidItemEquipment[] = seedBidItems.flatMap((r) => r.equipment);
  bidItemMaterials: BidItemMaterial[] = seedBidItems.flatMap((r) => r.materials);

  projects: Project[] = [];
  projectLineItems: ProjectLineItem[] = [];
  materialOverrides: ProjectLineItemMaterialOverride[] = [];
}

// A module-level singleton so state survives across requests within the
// same server process (Next.js dev server keeps one Node process).
const globalForStore = globalThis as unknown as { __estimatorStore?: Store };
const store = globalForStore.__estimatorStore ?? new Store();
globalForStore.__estimatorStore = store;

export class InMemoryRepository implements Repository {
  async listCrewRates() {
    return [...store.crewRates].sort((a, b) => a.role_name.localeCompare(b.role_name));
  }

  async getCurrentCrewRate(roleName: string) {
    return store.crewRates.find((r) => r.role_name === roleName && r.is_current);
  }

  async addCrewRate(input: NewCrewRateInput) {
    store.crewRates
      .filter((r) => r.role_name === input.role_name && r.is_current)
      .forEach((r) => (r.is_current = false));
    const created: CrewRate = {
      id: randomUUID(),
      role_name: input.role_name,
      hourly_rate: input.hourly_rate,
      fringe: input.fringe,
      effective_date: input.effective_date ?? new Date().toISOString().slice(0, 10),
      is_current: true,
      created_at: new Date().toISOString(),
    };
    store.crewRates.push(created);
    return created;
  }

  async listEquipmentRates() {
    return [...store.equipmentRates].sort((a, b) => a.equipment_name.localeCompare(b.equipment_name));
  }

  async getCurrentEquipmentRate(equipmentName: string) {
    return store.equipmentRates.find((r) => r.equipment_name === equipmentName && r.is_current);
  }

  async addEquipmentRate(input: NewEquipmentRateInput) {
    store.equipmentRates
      .filter((r) => r.equipment_name === input.equipment_name && r.is_current)
      .forEach((r) => (r.is_current = false));
    const created: EquipmentRate = {
      id: randomUUID(),
      equipment_name: input.equipment_name,
      hourly_rate: input.hourly_rate,
      effective_date: input.effective_date ?? new Date().toISOString().slice(0, 10),
      is_current: true,
      created_at: new Date().toISOString(),
    };
    store.equipmentRates.push(created);
    return created;
  }

  async listMaterials() {
    return [...store.materials].sort((a, b) => a.material_name.localeCompare(b.material_name));
  }

  async getCurrentMaterial(materialName: string) {
    return store.materials.find((m) => m.material_name === materialName && m.is_current);
  }

  async addMaterial(input: NewMaterialInput) {
    store.materials
      .filter((m) => m.material_name === input.material_name && m.is_current)
      .forEach((m) => (m.is_current = false));
    const created: Material = {
      id: randomUUID(),
      material_name: input.material_name,
      unit: input.unit,
      rate: input.rate,
      vendor: input.vendor ?? null,
      effective_date: input.effective_date ?? new Date().toISOString().slice(0, 10),
      is_current: true,
      created_at: new Date().toISOString(),
    };
    store.materials.push(created);
    return created;
  }

  async listBidItems() {
    return [...store.bidItems].sort((a, b) => a.item_name.localeCompare(b.item_name));
  }

  async searchBidItems(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return this.listBidItems();
    return store.bidItems.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
    );
  }

  async getBidItemRecipe(bidItemId: string): Promise<BidItemRecipe | undefined> {
    const item = store.bidItems.find((i) => i.id === bidItemId);
    if (!item) return undefined;
    return {
      item,
      labor: store.bidItemLabor.filter((l) => l.bid_item_id === bidItemId),
      equipment: store.bidItemEquipment.filter((e) => e.bid_item_id === bidItemId),
      materials: store.bidItemMaterials.filter((m) => m.bid_item_id === bidItemId),
    };
  }

  async createBidItem(input: NewBidItemInput): Promise<BidItemRecipe> {
    const id = randomUUID();
    const item: BidItem = {
      id,
      item_name: input.item_name,
      description: input.description ?? null,
      unit: input.unit,
      item_type: input.item_type,
      default_overhead_pct: input.default_overhead_pct ?? null,
      default_profit_pct: input.default_profit_pct ?? null,
      default_contingency_pct: input.default_contingency_pct ?? null,
      notes: input.notes ?? null,
      created_date: new Date().toISOString(),
      last_used_date: null,
    };
    store.bidItems.push(item);

    const labor = input.labor.map((l) => ({ id: randomUUID(), bid_item_id: id, ...l }));
    const equipment = input.equipment.map((e) => ({ id: randomUUID(), bid_item_id: id, ...e }));
    const materials = input.materials.map((m) => ({ ...m, id: randomUUID(), bid_item_id: id }));

    store.bidItemLabor.push(...labor);
    store.bidItemEquipment.push(...equipment);
    store.bidItemMaterials.push(...materials);

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
    return [...store.projects].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getProject(projectId: string) {
    return store.projects.find((p) => p.id === projectId);
  }

  async createProject(input: NewProjectInput) {
    const created: Project = {
      id: randomUUID(),
      project_name: input.project_name,
      client: input.client ?? null,
      location: input.location ?? null,
      dot_or_municipality: input.dot_or_municipality ?? null,
      bid_date: input.bid_date ?? null,
      status: "estimating",
      default_overhead_pct: input.default_overhead_pct,
      default_profit_pct: input.default_profit_pct,
      default_contingency_pct: input.default_contingency_pct,
      created_at: new Date().toISOString(),
    };
    store.projects.push(created);
    return created;
  }

  async updateProjectStatus(projectId: string, status: Project["status"]) {
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) throw new Error(`project not found: ${projectId}`);
    project.status = status;
    return project;
  }

  async listProjectLineItems(projectId: string) {
    return store.projectLineItems
      .filter((li) => li.project_id === projectId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async addProjectLineItem(input: NewProjectLineItemInput) {
    const maxSort = store.projectLineItems
      .filter((li) => li.project_id === input.project_id)
      .reduce((max, li) => Math.max(max, li.sort_order), -1);
    const created: ProjectLineItem = {
      id: randomUUID(),
      project_id: input.project_id,
      bid_item_id: input.bid_item_id,
      quantity: input.quantity,
      override_overhead_pct: input.override_overhead_pct ?? null,
      override_profit_pct: input.override_profit_pct ?? null,
      override_contingency_pct: input.override_contingency_pct ?? null,
      manual_rounded_rate: null,
      vendor_name: input.vendor_name ?? null,
      vendor_quote_amount: input.vendor_quote_amount ?? null,
      markup_pct: input.markup_pct ?? null,
      sort_order: maxSort + 1,
      created_at: new Date().toISOString(),
    };
    store.projectLineItems.push(created);

    const bidItem = store.bidItems.find((i) => i.id === input.bid_item_id);
    if (bidItem) bidItem.last_used_date = new Date().toISOString();

    return created;
  }

  async updateProjectLineItem(id: string, update: ProjectLineItemUpdate) {
    const li = store.projectLineItems.find((x) => x.id === id);
    if (!li) throw new Error(`project line item not found: ${id}`);
    Object.assign(li, update);
    return li;
  }

  async removeProjectLineItem(id: string) {
    store.projectLineItems = store.projectLineItems.filter((li) => li.id !== id);
    store.materialOverrides = store.materialOverrides.filter(
      (o) => o.project_line_item_id !== id
    );
  }

  async listMaterialOverrides(projectLineItemId: string) {
    return store.materialOverrides.filter((o) => o.project_line_item_id === projectLineItemId);
  }

  async setMaterialOverride(
    projectLineItemId: string,
    materialId: string,
    override: { override_rate?: number | null; override_qty?: number | null }
  ) {
    let existing = store.materialOverrides.find(
      (o) => o.project_line_item_id === projectLineItemId && o.material_id === materialId
    );
    if (!existing) {
      existing = {
        id: randomUUID(),
        project_line_item_id: projectLineItemId,
        material_id: materialId,
        override_rate: null,
        override_qty: null,
      };
      store.materialOverrides.push(existing);
    }
    if (override.override_rate !== undefined) existing.override_rate = override.override_rate;
    if (override.override_qty !== undefined) existing.override_qty = override.override_qty;
    return existing;
  }

  async clearMaterialOverride(projectLineItemId: string, materialId: string) {
    store.materialOverrides = store.materialOverrides.filter(
      (o) => !(o.project_line_item_id === projectLineItemId && o.material_id === materialId)
    );
  }
}
