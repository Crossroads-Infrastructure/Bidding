"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/repository";
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
  NewProjectInput,
  NewProjectLineItemInput,
  NewVendorQuoteInput,
  ProjectLineItemUpdate,
  VendorQuoteUpdate,
} from "@/lib/repository/types";
import type { DocumentCategory } from "@/types/domain";

export async function createProjectAction(input: NewProjectInput) {
  const project = await getRepository().createProject(input);
  revalidatePath("/");
  return project;
}

export async function updateProjectStatusAction(
  projectId: string,
  status: "estimating" | "submitted" | "won" | "lost"
) {
  const project = await getRepository().updateProjectStatus(projectId, status);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return project;
}

export async function updateProjectLastUsedProfitAction(projectId: string, profitPct: number) {
  const project = await getRepository().updateProjectLastUsedProfit(projectId, profitPct);
  revalidatePath(`/projects/${projectId}/review`);
  return project;
}

export async function duplicateProjectAction(
  sourceProjectId: string,
  details: DuplicateProjectDetailsInput
) {
  const project = await getRepository().duplicateProject(sourceProjectId, details);
  revalidatePath("/");
  return project;
}

export async function addCrewRateAction(input: NewCrewRateInput) {
  const rate = await getRepository().addCrewRate(input);
  revalidatePath("/rates");
  return rate;
}

export async function archiveCrewRateAction(id: string) {
  const rate = await getRepository().archiveCrewRate(id);
  revalidatePath("/rates");
  return rate;
}

export async function restoreCrewRateAction(id: string) {
  const rate = await getRepository().restoreCrewRate(id);
  revalidatePath("/rates");
  return rate;
}

export async function deleteCrewRatePermanentlyAction(roleName: string) {
  await getRepository().deleteCrewRatePermanently(roleName);
  revalidatePath("/rates");
}

export async function addEquipmentRateAction(input: NewEquipmentRateInput) {
  const rate = await getRepository().addEquipmentRate(input);
  revalidatePath("/rates");
  return rate;
}

export async function archiveEquipmentRateAction(id: string) {
  const rate = await getRepository().archiveEquipmentRate(id);
  revalidatePath("/rates");
  return rate;
}

export async function restoreEquipmentRateAction(id: string) {
  const rate = await getRepository().restoreEquipmentRate(id);
  revalidatePath("/rates");
  return rate;
}

export async function deleteEquipmentRatePermanentlyAction(equipmentName: string) {
  await getRepository().deleteEquipmentRatePermanently(equipmentName);
  revalidatePath("/rates");
}

export async function addMaterialAction(input: NewMaterialInput) {
  const material = await getRepository().addMaterial(input);
  revalidatePath("/rates");
  return material;
}

export async function archiveMaterialAction(id: string) {
  const material = await getRepository().archiveMaterial(id);
  revalidatePath("/rates");
  return material;
}

export async function restoreMaterialAction(id: string) {
  const material = await getRepository().restoreMaterial(id);
  revalidatePath("/rates");
  return material;
}

export async function deleteMaterialPermanentlyAction(materialName: string) {
  await getRepository().deleteMaterialPermanently(materialName);
  revalidatePath("/rates");
}

export async function addCompanyDefaultsAction(input: NewCompanyDefaultsInput) {
  const defaults = await getRepository().addCompanyDefaults(input);
  revalidatePath("/rates");
  return defaults;
}

// ---------------- Crew / equipment groups ----------------

export async function createCrewGroupAction(input: NewCrewGroupInput) {
  const group = await getRepository().createCrewGroup(input);
  revalidatePath("/rates");
  return group;
}

export async function updateCrewGroupAction(id: string, patch: Partial<NewCrewGroupInput>) {
  const group = await getRepository().updateCrewGroup(id, patch);
  revalidatePath("/rates");
  return group;
}

export async function deleteCrewGroupAction(id: string) {
  await getRepository().deleteCrewGroup(id);
  revalidatePath("/rates");
}

export async function addCrewGroupMemberAction(crewGroupId: string, input: NewCrewGroupMemberInput) {
  const member = await getRepository().addCrewGroupMember(crewGroupId, input);
  revalidatePath("/rates");
  return member;
}

export async function updateCrewGroupMemberAction(id: string, defaultHeadcount: number) {
  const member = await getRepository().updateCrewGroupMember(id, { default_headcount: defaultHeadcount });
  revalidatePath("/rates");
  return member;
}

export async function removeCrewGroupMemberAction(id: string) {
  await getRepository().removeCrewGroupMember(id);
  revalidatePath("/rates");
}

export async function createEquipmentGroupAction(input: NewEquipmentGroupInput) {
  const group = await getRepository().createEquipmentGroup(input);
  revalidatePath("/rates");
  return group;
}

export async function updateEquipmentGroupAction(id: string, patch: Partial<NewEquipmentGroupInput>) {
  const group = await getRepository().updateEquipmentGroup(id, patch);
  revalidatePath("/rates");
  return group;
}

export async function deleteEquipmentGroupAction(id: string) {
  await getRepository().deleteEquipmentGroup(id);
  revalidatePath("/rates");
}

export async function addEquipmentGroupMemberAction(
  equipmentGroupId: string,
  input: NewEquipmentGroupMemberInput
) {
  const member = await getRepository().addEquipmentGroupMember(equipmentGroupId, input);
  revalidatePath("/rates");
  return member;
}

export async function removeEquipmentGroupMemberAction(id: string) {
  await getRepository().removeEquipmentGroupMember(id);
  revalidatePath("/rates");
}

// ---------------- Bid item catalog ----------------

export async function createBidItemAction(input: NewBidItemInput) {
  const recipe = await getRepository().createBidItem(input);
  revalidatePath("/bid-items");
  return recipe;
}

export async function duplicateBidItemAction(bidItemId: string, newName: string) {
  const recipe = await getRepository().duplicateBidItem(bidItemId, newName);
  revalidatePath("/bid-items");
  return recipe;
}

export async function saveBidItemToLibraryAction(bidItemId: string) {
  const item = await getRepository().saveBidItemToLibrary(bidItemId);
  revalidatePath("/bid-items");
  return item;
}

export async function archiveBidItemAction(id: string) {
  const item = await getRepository().archiveBidItem(id);
  revalidatePath("/bid-items");
  return item;
}

export async function restoreBidItemAction(id: string) {
  const item = await getRepository().restoreBidItem(id);
  revalidatePath("/bid-items");
  return item;
}

export async function deleteBidItemPermanentlyAction(id: string) {
  await getRepository().deleteBidItemPermanently(id);
  revalidatePath("/bid-items");
}

export async function addBidItemLaborRowAction(bidItemId: string, input: NewBidItemLaborRowInput) {
  const row = await getRepository().addBidItemLaborRow(bidItemId, input);
  revalidatePath("/bid-items");
  return row;
}

export async function updateBidItemLaborRowAction(rowId: string, patch: BidItemLaborRowUpdate) {
  const row = await getRepository().updateBidItemLaborRow(rowId, patch);
  revalidatePath("/bid-items");
  return row;
}

export async function removeBidItemLaborRowAction(rowId: string) {
  await getRepository().removeBidItemLaborRow(rowId);
  revalidatePath("/bid-items");
}

export async function addBidItemEquipmentRowAction(bidItemId: string, input: NewBidItemEquipmentRowInput) {
  const row = await getRepository().addBidItemEquipmentRow(bidItemId, input);
  revalidatePath("/bid-items");
  return row;
}

export async function updateBidItemEquipmentRowAction(rowId: string, patch: BidItemEquipmentRowUpdate) {
  const row = await getRepository().updateBidItemEquipmentRow(rowId, patch);
  revalidatePath("/bid-items");
  return row;
}

export async function removeBidItemEquipmentRowAction(rowId: string) {
  await getRepository().removeBidItemEquipmentRow(rowId);
  revalidatePath("/bid-items");
}

export async function addBidItemMaterialRowAction(bidItemId: string, input: NewBidItemMaterialRowInput) {
  const row = await getRepository().addBidItemMaterialRow(bidItemId, input);
  revalidatePath("/bid-items");
  return row;
}

export async function updateBidItemMaterialRowAction(rowId: string, patch: BidItemMaterialRowUpdate) {
  const row = await getRepository().updateBidItemMaterialRow(rowId, patch);
  revalidatePath("/bid-items");
  return row;
}

export async function removeBidItemMaterialRowAction(rowId: string) {
  await getRepository().removeBidItemMaterialRow(rowId);
  revalidatePath("/bid-items");
}

// ---------------- Project line items ----------------

export async function addProjectLineItemAction(input: NewProjectLineItemInput) {
  const line = await getRepository().addProjectLineItem(input);
  revalidatePath(`/projects/${input.project_id}`);
  return line;
}

export async function updateProjectLineItemAction(
  id: string,
  projectId: string,
  update: ProjectLineItemUpdate
) {
  const line = await getRepository().updateProjectLineItem(id, update);
  revalidatePath(`/projects/${projectId}`);
  return line;
}

export async function removeProjectLineItemAction(id: string, projectId: string) {
  await getRepository().removeProjectLineItem(id);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------- Custom (one-off) line items ----------------

export async function addCustomLineItemAction(
  projectId: string,
  itemName: string,
  unit: NewBidItemInput["unit"],
  quantity: number
) {
  const repository = getRepository();
  const recipe = await repository.createBidItem({
    item_name: itemName,
    unit,
    item_type: "unit_price",
    is_saved_to_library: false,
    labor: [],
    equipment: [],
    materials: [],
  });
  const line = await repository.addProjectLineItem({
    project_id: projectId,
    bid_item_id: recipe.item.id,
    quantity,
  });
  revalidatePath(`/projects/${projectId}`);
  return { line, recipe };
}

// ---------------- Material / labor / equipment overrides ----------------

export async function setMaterialOverrideAction(
  projectLineItemId: string,
  projectId: string,
  materialId: string,
  override: { override_rate?: number | null; override_qty?: number | null }
) {
  const result = await getRepository().setMaterialOverride(projectLineItemId, materialId, override);
  revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function clearMaterialOverrideAction(
  projectLineItemId: string,
  projectId: string,
  materialId: string
) {
  await getRepository().clearMaterialOverride(projectLineItemId, materialId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setLaborOverrideAction(
  projectLineItemId: string,
  projectId: string,
  crewRoleId: string,
  override: LaborOverrideInput
) {
  const result = await getRepository().setLaborOverride(projectLineItemId, crewRoleId, override);
  revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function clearLaborOverrideAction(
  projectLineItemId: string,
  projectId: string,
  crewRoleId: string
) {
  await getRepository().clearLaborOverride(projectLineItemId, crewRoleId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setEquipmentOverrideAction(
  projectLineItemId: string,
  projectId: string,
  equipmentId: string,
  override: EquipmentOverrideInput
) {
  const result = await getRepository().setEquipmentOverride(projectLineItemId, equipmentId, override);
  revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function clearEquipmentOverrideAction(
  projectLineItemId: string,
  projectId: string,
  equipmentId: string
) {
  await getRepository().clearEquipmentOverride(projectLineItemId, equipmentId);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------- Vendor quotes (subcontracting) ----------------

export async function addVendorQuoteAction(
  projectLineItemId: string,
  projectId: string,
  input: NewVendorQuoteInput
) {
  const quote = await getRepository().addVendorQuote(projectLineItemId, input);
  revalidatePath(`/projects/${projectId}`);
  return quote;
}

export async function updateVendorQuoteAction(id: string, projectId: string, patch: VendorQuoteUpdate) {
  const quote = await getRepository().updateVendorQuote(id, patch);
  revalidatePath(`/projects/${projectId}`);
  return quote;
}

export async function selectVendorQuoteAction(
  projectLineItemId: string,
  projectId: string,
  quoteId: string
) {
  const quote = await getRepository().selectVendorQuote(projectLineItemId, quoteId);
  revalidatePath(`/projects/${projectId}`);
  return quote;
}

export async function removeVendorQuoteAction(id: string, projectId: string) {
  await getRepository().removeVendorQuote(id);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------- Documents ----------------

export async function addProjectDocumentAction(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const category = String(formData.get("category")) as DocumentCategory;
  const file = formData.get("file") as File;
  const content = new Uint8Array(await file.arrayBuffer());

  const document = await getRepository().addProjectDocument({
    project_id: projectId,
    category,
    file_name: file.name,
    file_size: file.size,
    content,
  });
  revalidatePath(`/projects/${projectId}`);
  return document;
}

export async function removeProjectDocumentAction(id: string, projectId: string) {
  await getRepository().removeProjectDocument(id);
  revalidatePath(`/projects/${projectId}`);
}
