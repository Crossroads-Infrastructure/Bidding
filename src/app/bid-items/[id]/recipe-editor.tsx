"use client";

import { useState } from "react";
import type {
  BidItemEquipment,
  BidItemLabor,
  BidItemMaterial,
  CrewGroup,
  CrewGroupMember,
  CrewRate,
  EquipmentGroup,
  EquipmentGroupMember,
  EquipmentRate,
  Material,
} from "@/types/domain";
import {
  addBidItemEquipmentRowAction,
  addBidItemLaborRowAction,
  addBidItemMaterialRowAction,
  removeBidItemEquipmentRowAction,
  removeBidItemLaborRowAction,
  removeBidItemMaterialRowAction,
  updateBidItemEquipmentRowAction,
  updateBidItemLaborRowAction,
} from "../../actions";
import { UnitRateInput } from "../../unit-rate-input";

// Bid Item Library's own recipe editor -- lets you add/remove labor,
// equipment, and material rows on an EXISTING item. This is distinct from
// the per-project "override" editing on the Estimate Builder screen (which
// only overrides rows a recipe already has, never adds new ones, so a
// project never mutates the shared library recipe behind other projects'
// backs). Editing here IS editing the shared recipe -- that's the point.
export function RecipeEditor({
  bidItemId,
  labor,
  equipment,
  materials,
  crewRates,
  equipmentRates,
  materialsCatalog,
  crewGroups,
  crewGroupMembersByGroup,
  equipmentGroups,
  equipmentGroupMembersByGroup,
}: {
  bidItemId: string;
  labor: BidItemLabor[];
  equipment: BidItemEquipment[];
  materials: BidItemMaterial[];
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materialsCatalog: Material[];
  crewGroups: CrewGroup[];
  crewGroupMembersByGroup: Record<string, CrewGroupMember[]>;
  equipmentGroups: EquipmentGroup[];
  equipmentGroupMembersByGroup: Record<string, EquipmentGroupMember[]>;
}) {
  const [localLabor, setLocalLabor] = useState(labor);
  const [localEquipment, setLocalEquipment] = useState(equipment);
  const [localMaterials, setLocalMaterials] = useState(materials);

  const crewName = new Map(crewRates.map((c) => [c.id, c.role_name]));
  const equipmentName = new Map(equipmentRates.map((e) => [e.id, e.equipment_name]));
  const materialName = new Map(materialsCatalog.map((m) => [m.id, m.material_name]));

  return (
    <div>
      <Section title="Labor">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Role</th>
              <th className="py-1 font-medium">Hours / unit</th>
              <th className="py-1 font-medium">Headcount</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {localLabor.map((l) => (
              <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5">{crewName.get(l.crew_role_id) ?? "Unknown role"}</td>
                <td className="py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={l.hours_per_unit}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      setLocalLabor((rows) => rows.map((r) => (r.id === l.id ? { ...r, hours_per_unit: v } : r)));
                      await updateBidItemLaborRowAction(l.id, { hours_per_unit: v });
                    }}
                    className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </td>
                <td className="py-1.5">
                  <input
                    type="number"
                    defaultValue={l.headcount}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      setLocalLabor((rows) => rows.map((r) => (r.id === l.id ? { ...r, headcount: v } : r)));
                      await updateBidItemLaborRowAction(l.id, { headcount: v });
                    }}
                    className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </td>
                <td className="py-1.5 text-right">
                  <button
                    onClick={async () => {
                      setLocalLabor((rows) => rows.filter((r) => r.id !== l.id));
                      await removeBidItemLaborRowAction(l.id);
                    }}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {localLabor.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  No labor in this recipe yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {crewGroups.length > 0 && (
          <div className="mt-3">
            <PopulateFromCrewGroup
              bidItemId={bidItemId}
              crewGroups={crewGroups}
              crewGroupMembersByGroup={crewGroupMembersByGroup}
              crewRates={crewRates}
              onPopulated={(rows) => setLocalLabor((r) => [...r, ...rows])}
            />
          </div>
        )}
        <div className="mt-3 text-sm">
          <AddLaborRow bidItemId={bidItemId} crewRates={crewRates} onAdded={(row) => setLocalLabor((r) => [...r, row])} />
        </div>
      </Section>

      <Section title="Equipment">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Equipment</th>
              <th className="py-1 font-medium">Hours / unit</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {localEquipment.map((e) => (
              <tr key={e.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5">{equipmentName.get(e.equipment_id) ?? "Unknown"}</td>
                <td className="py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={e.hours_per_unit}
                    onBlur={async (ev) => {
                      const v = Number(ev.target.value);
                      setLocalEquipment((rows) => rows.map((r) => (r.id === e.id ? { ...r, hours_per_unit: v } : r)));
                      await updateBidItemEquipmentRowAction(e.id, { hours_per_unit: v });
                    }}
                    className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </td>
                <td className="py-1.5 text-right">
                  <button
                    onClick={async () => {
                      setLocalEquipment((rows) => rows.filter((r) => r.id !== e.id));
                      await removeBidItemEquipmentRowAction(e.id);
                    }}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {localEquipment.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  No equipment in this recipe yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {equipmentGroups.length > 0 && (
          <div className="mt-3">
            <PopulateFromEquipmentGroup
              bidItemId={bidItemId}
              equipmentGroups={equipmentGroups}
              equipmentGroupMembersByGroup={equipmentGroupMembersByGroup}
              onPopulated={(rows) => setLocalEquipment((r) => [...r, ...rows])}
            />
          </div>
        )}
        <div className="mt-3 text-sm">
          <AddEquipmentRow
            bidItemId={bidItemId}
            equipmentRates={equipmentRates}
            onAdded={(row) => setLocalEquipment((r) => [...r, row])}
          />
        </div>
      </Section>

      <Section title="Materials">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Material</th>
              <th className="py-1 font-medium">Method</th>
              <th className="py-1 font-medium">Details</th>
              <th className="py-1 font-medium">Waste %</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {localMaterials.map((m) => (
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
                <td className="py-1.5 text-right">
                  <button
                    onClick={async () => {
                      setLocalMaterials((rows) => rows.filter((r) => r.id !== m.id));
                      await removeBidItemMaterialRowAction(m.id);
                    }}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {localMaterials.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  No materials in this recipe yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-3 text-sm">
          <AddMaterialRow
            bidItemId={bidItemId}
            materials={materialsCatalog}
            onAdded={(row) => setLocalMaterials((r) => [...r, row])}
          />
        </div>
      </Section>
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

// Group selection is a one-time population shortcut: it copies member
// roles/equipment into normal labor/equipment rows at their default
// headcounts with one shared hours/unit, then each row is independently
// editable. No link back to the group is persisted, so editing or
// deleting the group later never affects items already populated from it
// (same behavior as the "+ New Bid Item" creation form's shortcut).
function PopulateFromCrewGroup({
  bidItemId,
  crewGroups,
  crewGroupMembersByGroup,
  crewRates,
  onPopulated,
}: {
  bidItemId: string;
  crewGroups: CrewGroup[];
  crewGroupMembersByGroup: Record<string, CrewGroupMember[]>;
  crewRates: CrewRate[];
  onPopulated: (rows: BidItemLabor[]) => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");
  const [pending, setPending] = useState(false);
  const crewById = new Map(crewRates.map((c) => [c.id, c]));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-zinc-300 p-2 text-xs dark:border-zinc-700">
      <label className="flex flex-col text-zinc-500">
        Populate from crew group
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-44 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">Select…</option>
          {crewGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-zinc-500">
        Hours / unit (shared)
        <UnitRateInput
          perUnitLabel="hrs/unit"
          rateLabel="units/hr"
          value={hoursPerUnit}
          onChange={setHoursPerUnit}
          widthClassName="w-24"
        />
      </label>
      <button
        type="button"
        disabled={!groupId || !hoursPerUnit || pending}
        onClick={async () => {
          const members = (crewGroupMembersByGroup[groupId] ?? []).filter((m) => crewById.has(m.crew_role_id));
          setPending(true);
          const created = await Promise.all(
            members.map((m) =>
              addBidItemLaborRowAction(bidItemId, {
                crew_role_id: m.crew_role_id,
                hours_per_unit: Number(hoursPerUnit),
                headcount: m.default_headcount,
              })
            )
          );
          onPopulated(created);
          setGroupId("");
          setHoursPerUnit("");
          setPending(false);
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Populating…" : "Populate"}
      </button>
    </div>
  );
}

function PopulateFromEquipmentGroup({
  bidItemId,
  equipmentGroups,
  equipmentGroupMembersByGroup,
  onPopulated,
}: {
  bidItemId: string;
  equipmentGroups: EquipmentGroup[];
  equipmentGroupMembersByGroup: Record<string, EquipmentGroupMember[]>;
  onPopulated: (rows: BidItemEquipment[]) => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-zinc-300 p-2 text-xs dark:border-zinc-700">
      <label className="flex flex-col text-zinc-500">
        Populate from equipment group
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-44 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">Select…</option>
          {equipmentGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-zinc-500">
        Hours / unit (shared)
        <UnitRateInput
          perUnitLabel="hrs/unit"
          rateLabel="units/hr"
          value={hoursPerUnit}
          onChange={setHoursPerUnit}
          widthClassName="w-24"
        />
      </label>
      <button
        type="button"
        disabled={!groupId || !hoursPerUnit || pending}
        onClick={async () => {
          const members = equipmentGroupMembersByGroup[groupId] ?? [];
          setPending(true);
          const created = await Promise.all(
            members.map((m) =>
              addBidItemEquipmentRowAction(bidItemId, {
                equipment_id: m.equipment_id,
                hours_per_unit: Number(hoursPerUnit),
              })
            )
          );
          onPopulated(created);
          setGroupId("");
          setHoursPerUnit("");
          setPending(false);
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Populating…" : "Populate"}
      </button>
    </div>
  );
}

function AddLaborRow({
  bidItemId,
  crewRates,
  onAdded,
}: {
  bidItemId: string;
  crewRates: CrewRate[];
  onAdded: (row: BidItemLabor) => void;
}) {
  const [open, setOpen] = useState(false);
  const [crewRoleId, setCrewRoleId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");
  const [headcount, setHeadcount] = useState("1");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-blue-600 hover:underline dark:text-blue-400">
        + Add labor
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <select
        value={crewRoleId}
        onChange={(e) => setCrewRoleId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Role…</option>
        {crewRates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.role_name}
          </option>
        ))}
      </select>
      <UnitRateInput perUnitLabel="hrs/unit" rateLabel="units/hr" value={hoursPerUnit} onChange={setHoursPerUnit} widthClassName="w-20" />
      <input
        type="number"
        placeholder="headcount"
        value={headcount}
        onChange={(e) => setHeadcount(e.target.value)}
        className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <button
        disabled={!crewRoleId || !hoursPerUnit}
        onClick={async () => {
          const row = await addBidItemLaborRowAction(bidItemId, {
            crew_role_id: crewRoleId,
            hours_per_unit: Number(hoursPerUnit),
            headcount: Number(headcount || 1),
          });
          onAdded(row);
          setOpen(false);
          setCrewRoleId("");
          setHoursPerUnit("");
          setHeadcount("1");
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}

function AddEquipmentRow({
  bidItemId,
  equipmentRates,
  onAdded,
}: {
  bidItemId: string;
  equipmentRates: EquipmentRate[];
  onAdded: (row: BidItemEquipment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [equipmentId, setEquipmentId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-blue-600 hover:underline dark:text-blue-400">
        + Add equipment
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <select
        value={equipmentId}
        onChange={(e) => setEquipmentId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Equipment…</option>
        {equipmentRates.map((e) => (
          <option key={e.id} value={e.id}>
            {e.equipment_name}
          </option>
        ))}
      </select>
      <UnitRateInput perUnitLabel="hrs/unit" rateLabel="units/hr" value={hoursPerUnit} onChange={setHoursPerUnit} widthClassName="w-20" />
      <button
        disabled={!equipmentId || !hoursPerUnit}
        onClick={async () => {
          const row = await addBidItemEquipmentRowAction(bidItemId, {
            equipment_id: equipmentId,
            hours_per_unit: Number(hoursPerUnit),
          });
          onAdded(row);
          setOpen(false);
          setEquipmentId("");
          setHoursPerUnit("");
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}

// Fixed-ratio only, same simplification the project-side "custom item"
// buildup editor already uses -- dimensional/liquid-application material
// rows still need to be set up via "+ New Bid Item" at creation time.
function AddMaterialRow({
  bidItemId,
  materials,
  onAdded,
}: {
  bidItemId: string;
  materials: Material[];
  onAdded: (row: BidItemMaterial) => void;
}) {
  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [qtyPerUnit, setQtyPerUnit] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-blue-600 hover:underline dark:text-blue-400">
        + Add material
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <select
        value={materialId}
        onChange={(e) => setMaterialId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Material…</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.material_name}
          </option>
        ))}
      </select>
      <UnitRateInput perUnitLabel="qty/unit" rateLabel="units/qty" value={qtyPerUnit} onChange={setQtyPerUnit} widthClassName="w-24" />
      <button
        disabled={!materialId || !qtyPerUnit}
        onClick={async () => {
          const row = await addBidItemMaterialRowAction(bidItemId, {
            material_id: materialId,
            calc_method: "fixed_ratio",
            qty_per_unit: Number(qtyPerUnit),
            thickness_in: null,
            width_in: null,
            depth_in: null,
            output_unit: null,
            density_factor: null,
            application_rate: null,
            waste_pct: 0,
          });
          onAdded(row);
          setOpen(false);
          setMaterialId("");
          setQtyPerUnit("");
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}
