"use client";

import { useState } from "react";
import type { CrewRate, EquipmentRate, Material } from "@/types/domain";
import { isRateStale } from "@/lib/rate-utils";
import { addCrewRateAction, addEquipmentRateAction, addMaterialAction } from "../actions";

type Tab = "crew" | "equipment" | "materials";

export function RateLibrary({
  crewRates,
  equipmentRates,
  materials,
}: {
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
}) {
  const [tab, setTab] = useState<Tab>("crew");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(["crew", "equipment", "materials"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t === "crew" ? "Crew" : t}
          </button>
        ))}
      </div>

      {tab === "crew" && <CrewTab rates={crewRates.filter((r) => r.is_current)} />}
      {tab === "equipment" && <EquipmentTab rates={equipmentRates.filter((r) => r.is_current)} />}
      {tab === "materials" && <MaterialsTab materials={materials.filter((m) => m.is_current)} />}
    </div>
  );
}

function StaleBadge({ effectiveDate }: { effectiveDate: string }) {
  if (!isRateStale(effectiveDate)) return null;
  return (
    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
      stale · updated {effectiveDate}
    </span>
  );
}

function CrewTab({ rates }: { rates: CrewRate[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Hourly rate</th>
            <th className="px-4 py-2 font-medium">Fringe</th>
            <th className="px-4 py-2 font-medium">Effective</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rates.map((r) =>
            editing === r.id ? (
              <CrewEditRow key={r.id} rate={r} onDone={() => setEditing(null)} />
            ) : (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.role_name}</td>
                <td className="px-4 py-2">${r.hourly_rate.toFixed(2)}</td>
                <td className="px-4 py-2">${r.fringe.toFixed(2)}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  {r.effective_date}
                  <StaleBadge effectiveDate={r.effective_date} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setEditing(r.id)}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Update rate
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {adding ? (
          <CrewAddRow onDone={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add crew role
          </button>
        )}
      </div>
    </div>
  );
}

function CrewEditRow({ rate, onDone }: { rate: CrewRate; onDone: () => void }) {
  const [hourly, setHourly] = useState(String(rate.hourly_rate));
  const [fringe, setFringe] = useState(String(rate.fringe));
  const [pending, setPending] = useState(false);

  return (
    <tr>
      <td className="px-4 py-2 font-medium">{rate.role_name}</td>
      <td className="px-4 py-2">
        <input
          className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          type="number"
          step="0.01"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          type="number"
          step="0.01"
          value={fringe}
          onChange={(e) => setFringe(e.target.value)}
        />
      </td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">today</td>
      <td className="px-4 py-2 text-right">
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await addCrewRateAction({
              role_name: rate.role_name,
              hourly_rate: Number(hourly),
              fringe: Number(fringe),
            });
            setPending(false);
            onDone();
          }}
          className="mr-2 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
        >
          Save (new entry)
        </button>
        <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
          Cancel
        </button>
      </td>
    </tr>
  );
}

function CrewAddRow({ onDone }: { onDone: () => void }) {
  const [role, setRole] = useState("");
  const [hourly, setHourly] = useState("");
  const [fringe, setFringe] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-zinc-500">
        Role name
        <input
          className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Hourly rate
        <input
          type="number"
          step="0.01"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Fringe
        <input
          type="number"
          step="0.01"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={fringe}
          onChange={(e) => setFringe(e.target.value)}
        />
      </label>
      <button
        disabled={pending || !role || !hourly}
        onClick={async () => {
          setPending(true);
          await addCrewRateAction({ role_name: role, hourly_rate: Number(hourly), fringe: Number(fringe || 0) });
          setPending(false);
          onDone();
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}

function EquipmentTab({ rates }: { rates: EquipmentRate[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 font-medium">Equipment</th>
            <th className="px-4 py-2 font-medium">Hourly rate</th>
            <th className="px-4 py-2 font-medium">Effective</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rates.map((r) =>
            editing === r.id ? (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.equipment_name}</td>
                <EquipmentEditCells rate={r} onDone={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.equipment_name}</td>
                <td className="px-4 py-2">${r.hourly_rate.toFixed(2)}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  {r.effective_date}
                  <StaleBadge effectiveDate={r.effective_date} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setEditing(r.id)}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Update rate
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {adding ? (
          <EquipmentAddRow onDone={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add equipment
          </button>
        )}
      </div>
    </div>
  );
}

function EquipmentEditCells({ rate, onDone }: { rate: EquipmentRate; onDone: () => void }) {
  const [hourly, setHourly] = useState(String(rate.hourly_rate));
  const [pending, setPending] = useState(false);
  return (
    <>
      <td className="px-4 py-2">
        <input
          className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          type="number"
          step="0.01"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
      </td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">today</td>
      <td className="px-4 py-2 text-right">
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await addEquipmentRateAction({ equipment_name: rate.equipment_name, hourly_rate: Number(hourly) });
            setPending(false);
            onDone();
          }}
          className="mr-2 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
        >
          Save (new entry)
        </button>
        <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
          Cancel
        </button>
      </td>
    </>
  );
}

function EquipmentAddRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [hourly, setHourly] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-zinc-500">
        Equipment name
        <input
          className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Hourly rate
        <input
          type="number"
          step="0.01"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
      </label>
      <button
        disabled={pending || !name || !hourly}
        onClick={async () => {
          setPending(true);
          await addEquipmentRateAction({ equipment_name: name, hourly_rate: Number(hourly) });
          setPending(false);
          onDone();
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}

function MaterialsTab({ materials }: { materials: Material[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 font-medium">Material</th>
            <th className="px-4 py-2 font-medium">Unit</th>
            <th className="px-4 py-2 font-medium">Rate</th>
            <th className="px-4 py-2 font-medium">Vendor</th>
            <th className="px-4 py-2 font-medium">Effective</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {materials.map((m) =>
            editing === m.id ? (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium">{m.material_name}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{m.unit}</td>
                <MaterialEditCells material={m} onDone={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium">{m.material_name}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{m.unit}</td>
                <td className="px-4 py-2">${m.rate.toFixed(2)}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{m.vendor ?? "—"}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  {m.effective_date}
                  <StaleBadge effectiveDate={m.effective_date} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setEditing(m.id)}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Update rate
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {adding ? (
          <MaterialAddRow onDone={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add material
          </button>
        )}
      </div>
    </div>
  );
}

function MaterialEditCells({ material, onDone }: { material: Material; onDone: () => void }) {
  const [rate, setRate] = useState(String(material.rate));
  const [vendor, setVendor] = useState(material.vendor ?? "");
  const [pending, setPending] = useState(false);
  return (
    <>
      <td className="px-4 py-2">
        <input
          className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="w-32 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
      </td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">today</td>
      <td className="px-4 py-2 text-right">
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await addMaterialAction({
              material_name: material.material_name,
              unit: material.unit,
              rate: Number(rate),
              vendor: vendor || null,
            });
            setPending(false);
            onDone();
          }}
          className="mr-2 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
        >
          Save (new entry)
        </button>
        <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
          Cancel
        </button>
      </td>
    </>
  );
}

function MaterialAddRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("TON");
  const [rate, setRate] = useState("");
  const [vendor, setVendor] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-zinc-500">
        Material name
        <input
          className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Unit
        <input
          className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Rate
        <input
          type="number"
          step="0.01"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500">
        Vendor
        <input
          className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
      </label>
      <button
        disabled={pending || !name || !rate}
        onClick={async () => {
          setPending(true);
          await addMaterialAction({ material_name: name, unit, rate: Number(rate), vendor: vendor || null });
          setPending(false);
          onDone();
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
      <button onClick={onDone} className="text-xs font-medium text-zinc-500 hover:underline">
        Cancel
      </button>
    </div>
  );
}
