"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  BidItemUnit,
  BidItemType,
  CrewGroup,
  CrewGroupMember,
  CrewRate,
  EquipmentGroup,
  EquipmentGroupMember,
  EquipmentRate,
  Material,
  MaterialCalcMethod,
  MaterialOutputUnit,
} from "@/types/domain";
import { createBidItemAction } from "../../actions";

const UNITS: BidItemUnit[] = ["SF", "LF", "EA", "SY", "LS", "CY", "TON", "GAL"];
const ITEM_TYPES: BidItemType[] = ["unit_price", "lump_sum", "sub_quote"];
const CALC_METHODS: MaterialCalcMethod[] = ["fixed_ratio", "dimensional", "liquid_application"];
const OUTPUT_UNITS: MaterialOutputUnit[] = ["CY", "TON", "EA", "GAL"];

interface LaborRow {
  crew_role_id: string;
  hours_per_unit: string;
  headcount: string;
}
interface EquipmentRow {
  equipment_id: string;
  hours_per_unit: string;
}
interface MaterialRow {
  material_id: string;
  calc_method: MaterialCalcMethod;
  qty_per_unit: string;
  thickness_in: string;
  width_in: string;
  depth_in: string;
  output_unit: MaterialOutputUnit | "";
  density_factor: string;
  application_rate: string;
  waste_pct: string;
}

export function NewBidItemForm({
  crewRates,
  equipmentRates,
  materials,
  crewGroups,
  crewGroupMembersByGroup,
  equipmentGroups,
  equipmentGroupMembersByGroup,
}: {
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  crewGroups: CrewGroup[];
  crewGroupMembersByGroup: Record<string, CrewGroupMember[]>;
  equipmentGroups: EquipmentGroup[];
  equipmentGroupMembersByGroup: Record<string, EquipmentGroupMember[]>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<BidItemUnit>("SF");
  const [itemType, setItemType] = useState<BidItemType>("unit_price");
  const [notes, setNotes] = useState("");
  const [laborRows, setLaborRows] = useState<LaborRow[]>([]);
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);

  const canSubmit = itemName.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const recipe = await createBidItemAction({
          item_name: itemName,
          description: description || null,
          unit,
          item_type: itemType,
          notes: notes || null,
          labor: laborRows
            .filter((r) => r.crew_role_id)
            .map((r) => ({
              crew_role_id: r.crew_role_id,
              hours_per_unit: Number(r.hours_per_unit || 0),
              headcount: Number(r.headcount || 1),
            })),
          equipment: equipmentRows
            .filter((r) => r.equipment_id)
            .map((r) => ({
              equipment_id: r.equipment_id,
              hours_per_unit: Number(r.hours_per_unit || 0),
            })),
          materials: materialRows
            .filter((r) => r.material_id)
            .map((r) => ({
              material_id: r.material_id,
              calc_method: r.calc_method,
              qty_per_unit: r.qty_per_unit ? Number(r.qty_per_unit) : null,
              thickness_in: r.thickness_in ? Number(r.thickness_in) : null,
              width_in: r.width_in ? Number(r.width_in) : null,
              depth_in: r.depth_in ? Number(r.depth_in) : null,
              output_unit: r.output_unit || null,
              density_factor: r.density_factor ? Number(r.density_factor) : null,
              application_rate: r.application_rate ? Number(r.application_rate) : null,
              waste_pct: Number(r.waste_pct || 0) / 100,
            })),
        });
        setPending(false);
        router.push(`/bid-items/${recipe.item.id}`);
      }}
    >
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Item name
          <input
            required
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Description
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Unit
          <select
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={unit}
            onChange={(e) => setUnit(e.target.value as BidItemUnit)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Item type
          <select
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as BidItemType)}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Notes (inclusions / exclusions)
          <textarea
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      {itemType !== "sub_quote" && (
        <>
          <RowSection title="Labor">
            {crewGroups.length > 0 && (
              <PopulateFromCrewGroup
                crewGroups={crewGroups}
                crewGroupMembersByGroup={crewGroupMembersByGroup}
                crewRates={crewRates}
                onPopulate={(rows) => setLaborRows((prev) => [...prev, ...rows])}
              />
            )}
            {laborRows.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2">
                <Select
                  label="Crew role"
                  value={row.crew_role_id}
                  onChange={(v) => updateRow(setLaborRows, idx, { crew_role_id: v })}
                  options={crewRates.map((c) => ({ value: c.id, label: c.role_name }))}
                />
                <NumberField
                  label="Hours / unit"
                  value={row.hours_per_unit}
                  onChange={(v) => updateRow(setLaborRows, idx, { hours_per_unit: v })}
                />
                <NumberField
                  label="Headcount"
                  value={row.headcount}
                  onChange={(v) => updateRow(setLaborRows, idx, { headcount: v })}
                />
                <RemoveButton onClick={() => removeRow(setLaborRows, idx)} />
              </div>
            ))}
            <AddButton
              label="+ Add labor line"
              onClick={() =>
                setLaborRows((rows) => [...rows, { crew_role_id: "", hours_per_unit: "", headcount: "1" }])
              }
            />
          </RowSection>

          <RowSection title="Equipment">
            {equipmentGroups.length > 0 && (
              <PopulateFromEquipmentGroup
                equipmentGroups={equipmentGroups}
                equipmentGroupMembersByGroup={equipmentGroupMembersByGroup}
                onPopulate={(rows) => setEquipmentRows((prev) => [...prev, ...rows])}
              />
            )}
            {equipmentRows.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2">
                <Select
                  label="Equipment"
                  value={row.equipment_id}
                  onChange={(v) => updateRow(setEquipmentRows, idx, { equipment_id: v })}
                  options={equipmentRates.map((e) => ({ value: e.id, label: e.equipment_name }))}
                />
                <NumberField
                  label="Hours / unit"
                  value={row.hours_per_unit}
                  onChange={(v) => updateRow(setEquipmentRows, idx, { hours_per_unit: v })}
                />
                <RemoveButton onClick={() => removeRow(setEquipmentRows, idx)} />
              </div>
            ))}
            <AddButton
              label="+ Add equipment line"
              onClick={() => setEquipmentRows((rows) => [...rows, { equipment_id: "", hours_per_unit: "" }])}
            />
          </RowSection>

          <RowSection title="Materials">
            {materialRows.map((row, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-end gap-2">
                  <Select
                    label="Material"
                    value={row.material_id}
                    onChange={(v) => updateRow(setMaterialRows, idx, { material_id: v })}
                    options={materials.map((m) => ({ value: m.id, label: m.material_name }))}
                  />
                  <Select
                    label="Calc method"
                    value={row.calc_method}
                    onChange={(v) => updateRow(setMaterialRows, idx, { calc_method: v as MaterialCalcMethod })}
                    options={CALC_METHODS.map((m) => ({ value: m, label: m.replace("_", " ") }))}
                  />
                  <RemoveButton onClick={() => removeRow(setMaterialRows, idx)} />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {row.calc_method === "fixed_ratio" && (
                    <NumberField
                      label="Qty per unit"
                      value={row.qty_per_unit}
                      onChange={(v) => updateRow(setMaterialRows, idx, { qty_per_unit: v })}
                    />
                  )}
                  {row.calc_method === "liquid_application" && (
                    <NumberField
                      label="Gal / SY"
                      value={row.application_rate}
                      onChange={(v) => updateRow(setMaterialRows, idx, { application_rate: v })}
                    />
                  )}
                  {row.calc_method === "dimensional" && (
                    <>
                      <NumberField
                        label="Thickness (in)"
                        value={row.thickness_in}
                        onChange={(v) => updateRow(setMaterialRows, idx, { thickness_in: v })}
                      />
                      <NumberField
                        label="Width (in)"
                        value={row.width_in}
                        onChange={(v) => updateRow(setMaterialRows, idx, { width_in: v })}
                      />
                      <NumberField
                        label="Depth (in)"
                        value={row.depth_in}
                        onChange={(v) => updateRow(setMaterialRows, idx, { depth_in: v })}
                      />
                      <Select
                        label="Output unit"
                        value={row.output_unit}
                        onChange={(v) => updateRow(setMaterialRows, idx, { output_unit: v as MaterialOutputUnit })}
                        options={OUTPUT_UNITS.map((u) => ({ value: u, label: u }))}
                      />
                      {row.output_unit === "TON" && (
                        <NumberField
                          label="Density (lb/CF)"
                          value={row.density_factor}
                          onChange={(v) => updateRow(setMaterialRows, idx, { density_factor: v })}
                        />
                      )}
                    </>
                  )}
                  <NumberField
                    label="Waste %"
                    value={row.waste_pct}
                    onChange={(v) => updateRow(setMaterialRows, idx, { waste_pct: v })}
                  />
                </div>
              </div>
            ))}
            <AddButton
              label="+ Add material line"
              onClick={() =>
                setMaterialRows((rows) => [
                  ...rows,
                  {
                    material_id: "",
                    calc_method: "fixed_ratio",
                    qty_per_unit: "",
                    thickness_in: "",
                    width_in: "",
                    depth_in: "",
                    output_unit: "",
                    density_factor: "",
                    application_rate: "",
                    waste_pct: "0",
                  },
                ])
              }
            />
          </RowSection>
        </>
      )}

      <div>
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Create bid item"}
        </button>
      </div>
    </form>
  );
}

function updateRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, idx: number, patch: Partial<T>) {
  setter((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
}

function removeRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, idx: number) {
  setter((rows) => rows.filter((_, i) => i !== idx));
}

function RowSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col text-xs text-zinc-500">
      {label}
      <select
        className="w-44 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col text-xs text-zinc-500">
      {label}
      <input
        type="number"
        step="any"
        className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
    >
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
    >
      Remove
    </button>
  );
}

// Group selection is a one-time population shortcut: it copies member
// roles/equipment into normal labor/equipment rows at their default
// headcounts with one shared hours/unit, then each row is independently
// editable. No link back to the group is persisted, so editing or
// deleting the group later never affects items already populated from it.
function PopulateFromCrewGroup({
  crewGroups,
  crewGroupMembersByGroup,
  crewRates,
  onPopulate,
}: {
  crewGroups: CrewGroup[];
  crewGroupMembersByGroup: Record<string, CrewGroupMember[]>;
  crewRates: CrewRate[];
  onPopulate: (rows: LaborRow[]) => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");
  const crewById = new Map(crewRates.map((c) => [c.id, c]));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
      <Select
        label="Populate from crew group"
        value={groupId}
        onChange={setGroupId}
        options={crewGroups.map((g) => ({ value: g.id, label: g.group_name }))}
      />
      <NumberField label="Hours / unit (shared)" value={hoursPerUnit} onChange={setHoursPerUnit} />
      <button
        type="button"
        disabled={!groupId || !hoursPerUnit}
        onClick={() => {
          const members = crewGroupMembersByGroup[groupId] ?? [];
          const rows: LaborRow[] = members
            .filter((m) => crewById.has(m.crew_role_id))
            .map((m) => ({
              crew_role_id: m.crew_role_id,
              hours_per_unit: hoursPerUnit,
              headcount: String(m.default_headcount),
            }));
          onPopulate(rows);
          setGroupId("");
          setHoursPerUnit("");
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Populate
      </button>
    </div>
  );
}

function PopulateFromEquipmentGroup({
  equipmentGroups,
  equipmentGroupMembersByGroup,
  onPopulate,
}: {
  equipmentGroups: EquipmentGroup[];
  equipmentGroupMembersByGroup: Record<string, EquipmentGroupMember[]>;
  onPopulate: (rows: EquipmentRow[]) => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [hoursPerUnit, setHoursPerUnit] = useState("");

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
      <Select
        label="Populate from equipment group"
        value={groupId}
        onChange={setGroupId}
        options={equipmentGroups.map((g) => ({ value: g.id, label: g.group_name }))}
      />
      <NumberField label="Hours / unit (shared)" value={hoursPerUnit} onChange={setHoursPerUnit} />
      <button
        type="button"
        disabled={!groupId || !hoursPerUnit}
        onClick={() => {
          const members = equipmentGroupMembersByGroup[groupId] ?? [];
          const rows: EquipmentRow[] = members.map((m) => ({
            equipment_id: m.equipment_id,
            hours_per_unit: hoursPerUnit,
          }));
          onPopulate(rows);
          setGroupId("");
          setHoursPerUnit("");
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Populate
      </button>
    </div>
  );
}
