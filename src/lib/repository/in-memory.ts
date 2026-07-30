import { randomUUID } from "node:crypto";
import type {
  BidHistoryEntry,
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
import {
  seedBidItems,
  seedCompanyDefaults,
  seedCrewGroupMembers,
  seedCrewGroups,
  seedCrewRates,
  seedEquipmentGroupMembers,
  seedEquipmentGroups,
  seedEquipmentRates,
  seedMaterials,
} from "@/lib/seed-data";
import type {
  BidItemEquipmentRowUpdate,
  BidItemMaterialRowUpdate,
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
  BidItemLaborRowUpdate,
  ProjectLineItemUpdate,
  Repository,
  VendorQuoteUpdate,
} from "./types";

// Single in-process store. Re-seeded on server restart. This is intentional:
// it exists so the app is runnable and demoable before a real Supabase
// project is wired up, not as a persistence layer.
class Store {
  crewRates: CrewRate[] = [...seedCrewRates];
  equipmentRates: EquipmentRate[] = [...seedEquipmentRates];
  materials: Material[] = [...seedMaterials];
  companyDefaults: CompanyDefaults[] = [...seedCompanyDefaults];

  crewGroups: CrewGroup[] = [...seedCrewGroups];
  crewGroupMembers: CrewGroupMember[] = [...seedCrewGroupMembers];
  equipmentGroups: EquipmentGroup[] = [...seedEquipmentGroups];
  equipmentGroupMembers: EquipmentGroupMember[] = [...seedEquipmentGroupMembers];

  bidItems: BidItem[] = seedBidItems.map((r) => r.item);
  bidItemLabor: BidItemLabor[] = seedBidItems.flatMap((r) => r.labor);
  bidItemEquipment: BidItemEquipment[] = seedBidItems.flatMap((r) => r.equipment);
  bidItemMaterials: BidItemMaterial[] = seedBidItems.flatMap((r) => r.materials);

  projects: Project[] = [];
  projectLineItems: ProjectLineItem[] = [];
  materialOverrides: ProjectLineItemMaterialOverride[] = [];
  laborOverrides: ProjectLineItemLaborOverride[] = [];
  equipmentOverrides: ProjectLineItemEquipmentOverride[] = [];
  vendorQuotes: ProjectLineItemVendorQuote[] = [];
  documents: ProjectDocument[] = [];
  // No write path exists yet (historical tracking / mark-won-lost is future
  // work); kept empty so listBidHistory has somewhere real to read from.
  bidHistory: BidHistoryEntry[] = [];
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

  async getCurrentCompanyDefaults() {
    return store.companyDefaults.find((c) => c.is_current);
  }

  async addCompanyDefaults(input: NewCompanyDefaultsInput) {
    store.companyDefaults.filter((c) => c.is_current).forEach((c) => (c.is_current = false));
    const created: CompanyDefaults = {
      id: randomUUID(),
      overhead_pct: input.overhead_pct,
      contingency_pct: input.contingency_pct,
      effective_date: input.effective_date ?? new Date().toISOString().slice(0, 10),
      is_current: true,
      created_at: new Date().toISOString(),
    };
    store.companyDefaults.push(created);
    return created;
  }

  // ---------------- Crew / equipment groups ----------------

  async listCrewGroups() {
    return [...store.crewGroups].sort((a, b) => a.group_name.localeCompare(b.group_name));
  }

  async listCrewGroupMembers(crewGroupId: string) {
    return store.crewGroupMembers.filter((m) => m.crew_group_id === crewGroupId);
  }

  async createCrewGroup(input: NewCrewGroupInput) {
    const created: CrewGroup = { id: randomUUID(), group_name: input.group_name, description: input.description ?? null };
    store.crewGroups.push(created);
    return created;
  }

  async updateCrewGroup(id: string, patch: Partial<NewCrewGroupInput>) {
    const group = store.crewGroups.find((g) => g.id === id);
    if (!group) throw new Error(`crew group not found: ${id}`);
    Object.assign(group, patch);
    return group;
  }

  async deleteCrewGroup(id: string) {
    store.crewGroups = store.crewGroups.filter((g) => g.id !== id);
    store.crewGroupMembers = store.crewGroupMembers.filter((m) => m.crew_group_id !== id);
  }

  async addCrewGroupMember(crewGroupId: string, input: NewCrewGroupMemberInput) {
    const created: CrewGroupMember = {
      id: randomUUID(),
      crew_group_id: crewGroupId,
      crew_role_id: input.crew_role_id,
      default_headcount: input.default_headcount,
    };
    store.crewGroupMembers.push(created);
    return created;
  }

  async updateCrewGroupMember(id: string, patch: { default_headcount: number }) {
    const member = store.crewGroupMembers.find((m) => m.id === id);
    if (!member) throw new Error(`crew group member not found: ${id}`);
    member.default_headcount = patch.default_headcount;
    return member;
  }

  async removeCrewGroupMember(id: string) {
    store.crewGroupMembers = store.crewGroupMembers.filter((m) => m.id !== id);
  }

  async listEquipmentGroups() {
    return [...store.equipmentGroups].sort((a, b) => a.group_name.localeCompare(b.group_name));
  }

  async listEquipmentGroupMembers(equipmentGroupId: string) {
    return store.equipmentGroupMembers.filter((m) => m.equipment_group_id === equipmentGroupId);
  }

  async createEquipmentGroup(input: NewEquipmentGroupInput) {
    const created: EquipmentGroup = {
      id: randomUUID(),
      group_name: input.group_name,
      description: input.description ?? null,
    };
    store.equipmentGroups.push(created);
    return created;
  }

  async updateEquipmentGroup(id: string, patch: Partial<NewEquipmentGroupInput>) {
    const group = store.equipmentGroups.find((g) => g.id === id);
    if (!group) throw new Error(`equipment group not found: ${id}`);
    Object.assign(group, patch);
    return group;
  }

  async deleteEquipmentGroup(id: string) {
    store.equipmentGroups = store.equipmentGroups.filter((g) => g.id !== id);
    store.equipmentGroupMembers = store.equipmentGroupMembers.filter((m) => m.equipment_group_id !== id);
  }

  async addEquipmentGroupMember(equipmentGroupId: string, input: NewEquipmentGroupMemberInput) {
    const created: EquipmentGroupMember = {
      id: randomUUID(),
      equipment_group_id: equipmentGroupId,
      equipment_id: input.equipment_id,
    };
    store.equipmentGroupMembers.push(created);
    return created;
  }

  async removeEquipmentGroupMember(id: string) {
    store.equipmentGroupMembers = store.equipmentGroupMembers.filter((m) => m.id !== id);
  }

  // ---------------- Bid item catalog ----------------

  async listBidItems() {
    return store.bidItems
      .filter((i) => i.is_saved_to_library)
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }

  async searchBidItems(query: string) {
    const q = query.trim().toLowerCase();
    const saved = store.bidItems.filter((i) => i.is_saved_to_library);
    if (!q) return saved;
    return saved.filter(
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
      is_saved_to_library: input.is_saved_to_library ?? true,
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
    const item = store.bidItems.find((i) => i.id === bidItemId);
    if (!item) throw new Error(`bid item not found: ${bidItemId}`);
    item.is_saved_to_library = true;
    return item;
  }

  async addBidItemLaborRow(bidItemId: string, input: NewBidItemLaborRowInput) {
    const created: BidItemLabor = { id: randomUUID(), bid_item_id: bidItemId, ...input };
    store.bidItemLabor.push(created);
    return created;
  }

  async updateBidItemLaborRow(rowId: string, patch: BidItemLaborRowUpdate) {
    const row = store.bidItemLabor.find((r) => r.id === rowId);
    if (!row) throw new Error(`bid item labor row not found: ${rowId}`);
    Object.assign(row, patch);
    return row;
  }

  async removeBidItemLaborRow(rowId: string) {
    store.bidItemLabor = store.bidItemLabor.filter((r) => r.id !== rowId);
  }

  async addBidItemEquipmentRow(bidItemId: string, input: NewBidItemEquipmentRowInput) {
    const created: BidItemEquipment = { id: randomUUID(), bid_item_id: bidItemId, ...input };
    store.bidItemEquipment.push(created);
    return created;
  }

  async updateBidItemEquipmentRow(rowId: string, patch: BidItemEquipmentRowUpdate) {
    const row = store.bidItemEquipment.find((r) => r.id === rowId);
    if (!row) throw new Error(`bid item equipment row not found: ${rowId}`);
    Object.assign(row, patch);
    return row;
  }

  async removeBidItemEquipmentRow(rowId: string) {
    store.bidItemEquipment = store.bidItemEquipment.filter((r) => r.id !== rowId);
  }

  async addBidItemMaterialRow(bidItemId: string, input: NewBidItemMaterialRowInput) {
    const created: BidItemMaterial = { id: randomUUID(), bid_item_id: bidItemId, ...input };
    store.bidItemMaterials.push(created);
    return created;
  }

  async updateBidItemMaterialRow(rowId: string, patch: BidItemMaterialRowUpdate) {
    const row = store.bidItemMaterials.find((r) => r.id === rowId);
    if (!row) throw new Error(`bid item material row not found: ${rowId}`);
    Object.assign(row, patch);
    return row;
  }

  async removeBidItemMaterialRow(rowId: string) {
    store.bidItemMaterials = store.bidItemMaterials.filter((r) => r.id !== rowId);
  }

  // ---------------- Projects ----------------

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
      default_profit_pct: input.default_profit_pct ?? 0,
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

  async updateProjectLastUsedProfit(projectId: string, profitPct: number) {
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) throw new Error(`project not found: ${projectId}`);
    project.default_profit_pct = profitPct;
    return project;
  }

  // ---------------- Project line items ----------------

  async listProjectLineItems(projectId: string) {
    return store.projectLineItems
      .filter((li) => li.project_id === projectId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async addProjectLineItem(input: NewProjectLineItemInput) {
    const maxSort = store.projectLineItems
      .filter((li) => li.project_id === input.project_id)
      .reduce((max, li) => Math.max(max, li.sort_order), -1);
    const bidItem = store.bidItems.find((i) => i.id === input.bid_item_id);
    const created: ProjectLineItem = {
      id: randomUUID(),
      project_id: input.project_id,
      bid_item_id: input.bid_item_id,
      quantity: input.quantity,
      override_overhead_pct: input.override_overhead_pct ?? null,
      override_profit_pct: input.override_profit_pct ?? null,
      override_contingency_pct: input.override_contingency_pct ?? null,
      manual_rounded_rate: null,
      sort_order: maxSort + 1,
      created_at: new Date().toISOString(),
      notes_override: null,
      item_number_override: null,
      item_name_override: null,
      is_subcontracted: input.is_subcontracted ?? bidItem?.item_type === "sub_quote",
      sub_markup_pct: input.sub_markup_pct ?? null,
    };
    store.projectLineItems.push(created);

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
    store.materialOverrides = store.materialOverrides.filter((o) => o.project_line_item_id !== id);
    store.laborOverrides = store.laborOverrides.filter((o) => o.project_line_item_id !== id);
    store.equipmentOverrides = store.equipmentOverrides.filter((o) => o.project_line_item_id !== id);
    store.vendorQuotes = store.vendorQuotes.filter((q) => q.project_line_item_id !== id);
  }

  // ---------------- Material / labor / equipment overrides ----------------

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

  async listLaborOverrides(projectLineItemId: string) {
    return store.laborOverrides.filter((o) => o.project_line_item_id === projectLineItemId);
  }

  async setLaborOverride(projectLineItemId: string, crewRoleId: string, override: LaborOverrideInput) {
    let existing = store.laborOverrides.find(
      (o) => o.project_line_item_id === projectLineItemId && o.crew_role_id === crewRoleId
    );
    if (!existing) {
      existing = {
        id: randomUUID(),
        project_line_item_id: projectLineItemId,
        crew_role_id: crewRoleId,
        override_hours: null,
        override_headcount: null,
      };
      store.laborOverrides.push(existing);
    }
    if (override.override_hours !== undefined) existing.override_hours = override.override_hours;
    if (override.override_headcount !== undefined) existing.override_headcount = override.override_headcount;
    return existing;
  }

  async clearLaborOverride(projectLineItemId: string, crewRoleId: string) {
    store.laborOverrides = store.laborOverrides.filter(
      (o) => !(o.project_line_item_id === projectLineItemId && o.crew_role_id === crewRoleId)
    );
  }

  async listEquipmentOverrides(projectLineItemId: string) {
    return store.equipmentOverrides.filter((o) => o.project_line_item_id === projectLineItemId);
  }

  async setEquipmentOverride(projectLineItemId: string, equipmentId: string, override: EquipmentOverrideInput) {
    let existing = store.equipmentOverrides.find(
      (o) => o.project_line_item_id === projectLineItemId && o.equipment_id === equipmentId
    );
    if (!existing) {
      existing = {
        id: randomUUID(),
        project_line_item_id: projectLineItemId,
        equipment_id: equipmentId,
        override_hours: null,
      };
      store.equipmentOverrides.push(existing);
    }
    if (override.override_hours !== undefined) existing.override_hours = override.override_hours;
    return existing;
  }

  async clearEquipmentOverride(projectLineItemId: string, equipmentId: string) {
    store.equipmentOverrides = store.equipmentOverrides.filter(
      (o) => !(o.project_line_item_id === projectLineItemId && o.equipment_id === equipmentId)
    );
  }

  // ---------------- Vendor quotes (subcontracting) ----------------

  async listVendorQuotes(projectLineItemId: string) {
    return store.vendorQuotes.filter((q) => q.project_line_item_id === projectLineItemId);
  }

  async addVendorQuote(projectLineItemId: string, input: NewVendorQuoteInput) {
    const created: ProjectLineItemVendorQuote = {
      id: randomUUID(),
      project_line_item_id: projectLineItemId,
      vendor_name: input.vendor_name,
      quote_amount: input.quote_amount,
      is_selected: false,
      notes: input.notes ?? null,
    };
    store.vendorQuotes.push(created);
    // First quote entered for a line is selected by default.
    const siblings = store.vendorQuotes.filter((q) => q.project_line_item_id === projectLineItemId);
    if (siblings.length === 1) created.is_selected = true;
    return created;
  }

  async updateVendorQuote(id: string, patch: VendorQuoteUpdate) {
    const quote = store.vendorQuotes.find((q) => q.id === id);
    if (!quote) throw new Error(`vendor quote not found: ${id}`);
    if (patch.is_selected) {
      store.vendorQuotes
        .filter((q) => q.project_line_item_id === quote.project_line_item_id)
        .forEach((q) => (q.is_selected = false));
    }
    Object.assign(quote, patch);
    return quote;
  }

  async selectVendorQuote(projectLineItemId: string, quoteId: string) {
    store.vendorQuotes
      .filter((q) => q.project_line_item_id === projectLineItemId)
      .forEach((q) => (q.is_selected = q.id === quoteId));
    const selected = store.vendorQuotes.find((q) => q.id === quoteId);
    if (!selected) throw new Error(`vendor quote not found: ${quoteId}`);
    return selected;
  }

  async removeVendorQuote(id: string) {
    store.vendorQuotes = store.vendorQuotes.filter((q) => q.id !== id);
  }

  // ---------------- Bid history ----------------

  async listBidHistory(bidItemId: string) {
    return store.bidHistory
      .filter((h) => h.bid_item_id === bidItemId)
      .map((h) => ({ unit_price_bid: h.unit_price_bid, outcome: h.outcome, date: h.date }));
  }

  // ---------------- Documents ----------------

  async listProjectDocuments(projectId: string) {
    return store.documents
      .filter((d) => d.project_id === projectId)
      .sort((a, b) => new Date(b.uploaded_date).getTime() - new Date(a.uploaded_date).getTime());
  }

  async addProjectDocument(input: NewProjectDocumentInput) {
    // No real object storage backing the in-memory repo: stash the file as
    // a data URL so "download" still works within the demo session.
    const base64 = Buffer.from(input.content).toString("base64");
    const created: ProjectDocument = {
      id: randomUUID(),
      project_id: input.project_id,
      category: input.category,
      file_name: input.file_name,
      file_url: `data:application/octet-stream;base64,${base64}`,
      file_size: input.file_size,
      uploaded_date: new Date().toISOString(),
    };
    store.documents.push(created);
    return created;
  }

  async removeProjectDocument(id: string) {
    store.documents = store.documents.filter((d) => d.id !== id);
  }
}
