import { getRepository } from "@/lib/repository";
import { NewBidItemForm } from "./new-bid-item-form";

export default async function NewBidItemPage() {
  const repository = getRepository();
  const [crewRates, equipmentRates, materials, crewGroups, equipmentGroups] = await Promise.all([
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
    repository.listCrewGroups(),
    repository.listEquipmentGroups(),
  ]);

  const crewGroupMembersByGroup = Object.fromEntries(
    await Promise.all(crewGroups.map(async (g) => [g.id, await repository.listCrewGroupMembers(g.id)] as const))
  );
  const equipmentGroupMembersByGroup = Object.fromEntries(
    await Promise.all(
      equipmentGroups.map(async (g) => [g.id, await repository.listEquipmentGroupMembers(g.id)] as const)
    )
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New Bid Item</h1>
      <NewBidItemForm
        crewRates={crewRates.filter((r) => r.is_current)}
        equipmentRates={equipmentRates.filter((r) => r.is_current)}
        materials={materials.filter((m) => m.is_current)}
        crewGroups={crewGroups}
        crewGroupMembersByGroup={crewGroupMembersByGroup}
        equipmentGroups={equipmentGroups}
        equipmentGroupMembersByGroup={equipmentGroupMembersByGroup}
      />
    </div>
  );
}
