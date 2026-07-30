import { getRepository } from "@/lib/repository";
import { RateLibrary } from "./rate-library";

export default async function RatesPage() {
  const repository = getRepository();
  const [
    crewRates,
    equipmentRates,
    materials,
    companyDefaults,
    crewGroups,
    equipmentGroups,
  ] = await Promise.all([
    repository.listCrewRates(),
    repository.listEquipmentRates(),
    repository.listMaterials(),
    repository.getCurrentCompanyDefaults(),
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
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Rate Library</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Editing a rate never overwrites history — it adds a new dated entry and
        every existing estimate keeps recalculating with whatever rate was
        current when it was built.
      </p>
      <RateLibrary
        crewRates={crewRates}
        equipmentRates={equipmentRates}
        materials={materials}
        companyDefaults={companyDefaults}
        crewGroups={crewGroups}
        crewGroupMembersByGroup={crewGroupMembersByGroup}
        equipmentGroups={equipmentGroups}
        equipmentGroupMembersByGroup={equipmentGroupMembersByGroup}
      />
    </div>
  );
}
