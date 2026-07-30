import { getRepository } from "@/lib/repository";
import { NewBidItemForm } from "./new-bid-item-form";

export default async function NewBidItemPage() {
  const repository = getRepository();
  const [crewRates, equipmentRates, materials] = await Promise.all([
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New Bid Item</h1>
      <NewBidItemForm
        crewRates={crewRates.filter((r) => r.is_current)}
        equipmentRates={equipmentRates.filter((r) => r.is_current)}
        materials={materials.filter((m) => m.is_current)}
      />
    </div>
  );
}
