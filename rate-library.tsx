"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/repository";
import type {
  NewBidItemInput,
  NewCrewRateInput,
  NewEquipmentRateInput,
  NewMaterialInput,
  NewProjectInput,
  NewProjectLineItemInput,
  ProjectLineItemUpdate,
} from "@/lib/repository/types";

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

export async function addCrewRateAction(input: NewCrewRateInput) {
  const rate = await getRepository().addCrewRate(input);
  revalidatePath("/rates");
  return rate;
}

export async function addEquipmentRateAction(input: NewEquipmentRateInput) {
  const rate = await getRepository().addEquipmentRate(input);
  revalidatePath("/rates");
  return rate;
}

export async function addMaterialAction(input: NewMaterialInput) {
  const material = await getRepository().addMaterial(input);
  revalidatePath("/rates");
  return material;
}

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

export async function setMaterialOverrideAction(
  projectLineItemId: string,
  projectId: string,
  materialId: string,
  override: { override_rate?: number | null; override_qty?: number | null }
) {
  const result = await getRepository().setMaterialOverride(
    projectLineItemId,
    materialId,
    override
  );
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
