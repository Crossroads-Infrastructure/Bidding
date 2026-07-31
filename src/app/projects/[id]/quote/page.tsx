import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { QuoteView } from "./quote-view";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = getRepository();
  const project = await repository.getProject(id);
  if (!project) notFound();

  const [lineItems, crewRates, equipmentRates, materials, companyDefaults] = await Promise.all([
    repository.listProjectLineItems(id),
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
    repository.getCurrentCompanyDefaults(),
  ]);

  const bidItemIds = [...new Set(lineItems.map((li) => li.bid_item_id))];
  const recipes = await Promise.all(bidItemIds.map((bidItemId) => repository.getBidItemRecipe(bidItemId)));
  const recipesByBidItemId = Object.fromEntries(
    recipes.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => [r.item.id, r])
  );

  const materialOverridesByLine = Object.fromEntries(
    await Promise.all(lineItems.map(async (li) => [li.id, await repository.listMaterialOverrides(li.id)] as const))
  );
  const laborOverridesByLine = Object.fromEntries(
    await Promise.all(lineItems.map(async (li) => [li.id, await repository.listLaborOverrides(li.id)] as const))
  );
  const equipmentOverridesByLine = Object.fromEntries(
    await Promise.all(lineItems.map(async (li) => [li.id, await repository.listEquipmentOverrides(li.id)] as const))
  );
  const vendorQuotesByLine = Object.fromEntries(
    await Promise.all(lineItems.map(async (li) => [li.id, await repository.listVendorQuotes(li.id)] as const))
  );

  if (!companyDefaults) {
    throw new Error(
      "No company defaults configured yet -- set overhead/contingency % in the Rate Library first."
    );
  }

  return (
    <QuoteView
      project={project}
      lineItems={lineItems}
      recipesByBidItemId={recipesByBidItemId}
      crewRates={crewRates}
      equipmentRates={equipmentRates}
      materials={materials}
      companyDefaults={companyDefaults}
      materialOverridesByLine={materialOverridesByLine}
      laborOverridesByLine={laborOverridesByLine}
      equipmentOverridesByLine={equipmentOverridesByLine}
      vendorQuotesByLine={vendorQuotesByLine}
    />
  );
}
