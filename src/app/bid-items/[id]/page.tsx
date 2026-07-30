import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { DuplicateButton } from "./duplicate-button";

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
  const crewName = new Map(crewRates.map((c) => [c.id, c.role_name]));
  const equipmentName = new Map(equipmentRates.map((e) => [e.id, e.equipment_name]));
  const materialName = new Map(materials.map((m) => [m.id, m.material_name]));

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

      {labor.length > 0 && (
        <Section title="Labor">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 font-medium">Role</th>
                <th className="py-1 font-medium">Hours / unit</th>
                <th className="py-1 font-medium">Headcount</th>
              </tr>
            </thead>
            <tbody>
              {labor.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{crewName.get(l.crew_role_id) ?? "Unknown role"}</td>
                  <td className="py-1.5">{l.hours_per_unit}</td>
                  <td className="py-1.5">{l.headcount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {equipment.length > 0 && (
        <Section title="Equipment">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 font-medium">Equipment</th>
                <th className="py-1 font-medium">Hours / unit</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{equipmentName.get(e.equipment_id) ?? "Unknown"}</td>
                  <td className="py-1.5">{e.hours_per_unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {itemMaterials.length > 0 && (
        <Section title="Materials">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 font-medium">Material</th>
                <th className="py-1 font-medium">Method</th>
                <th className="py-1 font-medium">Details</th>
                <th className="py-1 font-medium">Waste %</th>
              </tr>
            </thead>
            <tbody>
              {itemMaterials.map((m) => (
                <tr key={m.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{materialName.get(m.material_id) ?? "Unknown"}</td>
                  <td className="py-1.5 capitalize">{m.calc_method.replace("_", " ")}</td>
                  <td className="py-1.5 text-zinc-500 dark:text-zinc-400">
                    {m.calc_method === "fixed_ratio" && `${m.qty_per_unit} per unit`}
                    {m.calc_method === "liquid_application" && `${m.application_rate} gal/SY`}
                    {m.calc_method === "dimensional" &&
                      [
                        m.thickness_in ? `${m.thickness_in}" thick` : null,
                        m.width_in ? `${m.width_in}" wide` : null,
                        m.depth_in ? `${m.depth_in}" deep` : null,
                        m.density_factor ? `${m.density_factor} lb/CF` : null,
                        m.output_unit ? `→ ${m.output_unit}` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                  </td>
                  <td className="py-1.5">{(m.waste_pct * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {item.notes && (
        <Section title="Inclusions / Exclusions">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.notes}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  );
}
