import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { DuplicateButton } from "./duplicate-button";
import { RecipeEditor } from "./recipe-editor";

export default async function BidItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repository = getRepository();
  const recipe = await repository.getBidItemRecipe(id);
  if (!recipe) notFound();

  const [crewRates, equipmentRates, materials] = await Promise.all([
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
  ]);

  const { item, labor, equipment, materials: itemMaterials } = recipe;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{item.item_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {item.unit} · {item.item_type.replace("_", " ")}
          </p>
          {item.description && <p className="mt-2 max-w-2xl text-sm">{item.description}</p>}
        </div>
        <DuplicateButton bidItemId={item.id} defaultName={`${item.item_name} (copy)`} />
      </div>

      <RecipeEditor
        bidItemId={item.id}
        labor={labor}
        equipment={equipment}
        materials={itemMaterials}
        crewRates={crewRates}
        equipmentRates={equipmentRates}
        materialsCatalog={materials}
      />

      {item.notes && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Inclusions / Exclusions
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.notes}</p>
        </div>
      )}
    </div>
  );
}
