import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { EstimateBuilder } from "./estimate-builder";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = getRepository();
  const project = await repository.getProject(id);
  if (!project) notFound();

  const [lineItems, catalogBidItems, crewRates, equipmentRates, materials, companyDefaults, documents] =
    await Promise.all([
      repository.listProjectLineItems(id),
      repository.listBidItems(),
      repository.listCrewRates(),
      repository.listEquipmentRates(),
      repository.listMaterials(),
      repository.getCurrentCompanyDefaults(),
      repository.listProjectDocuments(id),
    ]);

  // Recipes are needed for every catalog item (the "add item" dropdown) plus
  // any bid item actually used on this project's line items -- which may
  // include one-off custom items that never appear in the catalog.
  const neededBidItemIds = new Set([
    ...catalogBidItems.map((i) => i.id),
    ...lineItems.map((li) => li.bid_item_id),
  ]);
  const recipes = await Promise.all(
    [...neededBidItemIds].map((bidItemId) => repository.getBidItemRecipe(bidItemId))
  );
  const recipesByBidItemId = Object.fromEntries(
    recipes.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => [r.item.id, r])
  );

  const materialOverridesByLine = Object.fromEntries(
    await Promise.all(
      lineItems.map(async (li) => [li.id, await repository.listMaterialOverrides(li.id)] as const)
    )
  );
  const laborOverridesByLine = Object.fromEntries(
    await Promise.all(
      lineItems.map(async (li) => [li.id, await repository.listLaborOverrides(li.id)] as const)
    )
  );
  const equipmentOverridesByLine = Object.fromEntries(
    await Promise.all(
      lineItems.map(async (li) => [li.id, await repository.listEquipmentOverrides(li.id)] as const)
    )
  );
  const vendorQuotesByLine = Object.fromEntries(
    await Promise.all(
      lineItems.map(async (li) => [li.id, await repository.listVendorQuotes(li.id)] as const)
    )
  );

  if (!companyDefaults) {
    throw new Error(
      "No company defaults configured yet -- set overhead/contingency % in the Rate Library first."
    );
  }

  return (
    <EstimateBuilder
      project={project}
      initialLineItems={lineItems}
      catalogBidItems={catalogBidItems}
      recipesByBidItemId={recipesByBidItemId}
      crewRates={crewRates}
      equipmentRates={equipmentRates}
      materials={materials}
      companyDefaults={companyDefaults}
      materialOverridesByLine={materialOverridesByLine}
      laborOverridesByLine={laborOverridesByLine}
      equipmentOverridesByLine={equipmentOverridesByLine}
      vendorQuotesByLine={vendorQuotesByLine}
      initialDocuments={documents}
    />
  );
}
