import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { EstimateBuilder } from "./estimate-builder";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = getRepository();
  const project = await repository.getProject(id);
  if (!project) notFound();

  const [lineItems, bidItems, crewRates, equipmentRates, materials] = await Promise.all([
    repository.listProjectLineItems(id),
    repository.listBidItems(),
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
  ]);

  const recipes = await Promise.all(bidItems.map((i) => repository.getBidItemRecipe(i.id)));
  const recipesByBidItemId = Object.fromEntries(
    recipes.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => [r.item.id, r])
  );

  const materialOverridesByLine = Object.fromEntries(
    await Promise.all(
      lineItems.map(async (li) => [li.id, await repository.listMaterialOverrides(li.id)] as const)
    )
  );

  return (
    <EstimateBuilder
      project={project}
      initialLineItems={lineItems}
      bidItems={bidItems}
      recipesByBidItemId={recipesByBidItemId}
      crewRates={crewRates}
      equipmentRates={equipmentRates}
      materials={materials}
      materialOverridesByLine={materialOverridesByLine}
    />
  );
}
