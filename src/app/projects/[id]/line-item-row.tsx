"use client";

import { useState } from "react";
import type { LineItemEstimate } from "@/lib/calc-engine";
import type {
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  ProjectLineItem,
  ProjectLineItemVendorQuote,
} from "@/types/domain";
import {
  addBidItemEquipmentRowAction,
  addBidItemLaborRowAction,
  addBidItemMaterialRowAction,
  addVendorQuoteAction,
  removeBidItemEquipmentRowAction,
  removeBidItemLaborRowAction,
  removeBidItemMaterialRowAction,
  removeVendorQuoteAction,
  saveBidItemToLibraryAction,
  selectVendorQuoteAction,
  updateBidItemEquipmentRowAction,
  updateBidItemLaborRowAction,
} from "../../actions";

type OverrideMap<T> = Map<string, T>;

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface LineItemRowProps {
  line: ProjectLineItem;
  recipe: BidItemRecipe;
  estimate: LineItemEstimate;
  expanded: boolean;
  materialOverrides: OverrideMap<{ override_rate?: number | null; override_qty?: number | null }>;
  laborOverrides: OverrideMap<{ override_hours?: number | null; override_headcount?: number | null }>;
  equipmentOverrides: OverrideMap<{ override_hours?: number | null }>;
  materialsById: Map<string, Material>;
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  vendorQuotes: ProjectLineItemVendorQuote[];
  projectId: string;
  onToggleExpand: () => void;
  onRemove: () => void;
  onQuantityChange: (q: number) => void;
  onQuantityCommit: (q: number) => void;
  onRoundedRateChange: (rate: number | null) => void;
  onRoundedRateCommit: (rate: number | null) => void;
  onFieldChange: (patch: Partial<ProjectLineItem>) => void;
  onFieldCommit: (patch: Partial<ProjectLineItem>) => void;
  onMaterialOverrideChange: (materialId: string, patch: { override_rate?: number | null; override_qty?: number | null }) => void;
  onMaterialOverrideCommit: (materialId: string, patch: { override_rate?: number | null; override_qty?: number | null }) => void;
  onMaterialOverrideClear: (materialId: string) => void;
  onLaborOverrideChange: (crewRoleId: string, patch: { override_hours?: number | null; override_headcount?: number | null }) => void;
  onLaborOverrideCommit: (crewRoleId: string, patch: { override_hours?: number | null; override_headcount?: number | null }) => void;
  onLaborOverrideClear: (crewRoleId: string) => void;
  onEquipmentOverrideChange: (equipmentId: string, patch: { override_hours?: number | null }) => void;
  onEquipmentOverrideCommit: (equipmentId: string, patch: { override_hours?: number | null }) => void;
  onEquipmentOverrideClear: (equipmentId: string) => void;
  onRecipeChanged: () => void;
}

export function LineItemRow(props: LineItemRowProps) {
  const {
    line,
    recipe,
    estimate,
    expanded,
    materialOverrides,
    laborOverrides,
    equipmentOverrides,
    materialsById,
    crewRates,
    equipmentRates,
    materials,
    vendorQuotes,
    projectId,
    onToggleExpand,
    onRemove,
    onQuantityChange,
    onQuantityCommit,
    onRoundedRateChange,
    onRoundedRateCommit,
    onFieldChange,
    onFieldCommit,
    onMaterialOverrideChange,
    onMaterialOverrideCommit,
    onMaterialOverrideClear,
    onLaborOverrideChange,
    onLaborOverrideCommit,
    onLaborOverrideClear,
    onEquipmentOverrideChange,
    onEquipmentOverrideCommit,
    onEquipmentOverrideClear,
    onRecipeChanged,
  } = props;

  const isCustom = !recipe.item.is_saved_to_library;
  const displayName = line.item_name_override || recipe.item.item_name;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2">
          <div className="font-medium">{displayName}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {recipe.item.unit}
            {line.item_number_override ? ` · #${line.item_number_override}` : ""}
            {isCustom && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                custom
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="any"
            value={line.quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
            onBlur={(e) => onQuantityCommit(Number(e.target.value))}
            className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </td>
        <td className="px-4 py-2">{formatCurrency(estimate.preProfitUnitPrice)}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            placeholder={estimate.preProfitUnitPrice.toFixed(2)}
            value={line.manual_rounded_rate ?? ""}
            onChange={(e) => onRoundedRateChange(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={(e) => onRoundedRateCommit(e.target.value === "" ? null : Number(e.target.value))}
            className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </td>
        <td className="px-4 py-2 font-medium">{formatCurrency(estimate.finalTotal)}</td>
        <td className="px-4 py-2 text-right whitespace-nowrap">
          <button
            onClick={onToggleExpand}
            className="mr-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
            Remove
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className="bg-zinc-50 px-4 py-4 dark:bg-zinc-800/40">
            <div className="mb-4 flex flex-wrap items-end gap-3 text-xs">
              <label className="flex flex-col text-zinc-500">
                Item # (this proposal)
                <input
                  defaultValue={line.item_number_override ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    onFieldChange({ item_number_override: v });
                    onFieldCommit({ item_number_override: v });
                  }}
                  className="w-32 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>
              <label className="flex flex-col text-zinc-500">
                Item name (this proposal)
                <input
                  defaultValue={line.item_name_override ?? ""}
                  placeholder={recipe.item.item_name}
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    onFieldChange({ item_name_override: v });
                    onFieldCommit({ item_name_override: v });
                  }}
                  className="w-56 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center gap-2 text-zinc-500">
                <input
                  type="checkbox"
                  checked={line.is_subcontracted}
                  onChange={(e) => {
                    onFieldChange({ is_subcontracted: e.target.checked });
                    onFieldCommit({ is_subcontracted: e.target.checked });
                  }}
                />
                Subcontracted
              </label>
              {isCustom && (
                <button
                  onClick={async () => {
                    await saveBidItemToLibraryAction(recipe.item.id);
                    onRecipeChanged();
                  }}
                  className="rounded border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Save to Library
                </button>
              )}
            </div>

            <label className="mb-4 flex flex-col text-xs text-zinc-500">
              Notes / inclusions-exclusions (this proposal)
              <textarea
                defaultValue={line.notes_override ?? ""}
                placeholder={recipe.item.notes ?? ""}
                rows={2}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  onFieldChange({ notes_override: v });
                  onFieldCommit({ notes_override: v });
                }}
                className="w-full max-w-xl rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>

            {line.is_subcontracted ? (
              <VendorQuotesPanel
                projectLineItemId={line.id}
                projectId={projectId}
                quotes={vendorQuotes}
                subMarkupPct={line.sub_markup_pct}
                onFieldChange={onFieldChange}
                onFieldCommit={onFieldCommit}
              />
            ) : (
              <BuildupPanel
                bidItemId={recipe.item.id}
                recipe={recipe}
                estimate={estimate}
                isCustom={isCustom}
                crewRates={crewRates}
                equipmentRates={equipmentRates}
                materials={materials}
                materialsById={materialsById}
                materialOverrides={materialOverrides}
                laborOverrides={laborOverrides}
                equipmentOverrides={equipmentOverrides}
                onMaterialOverrideChange={onMaterialOverrideChange}
                onMaterialOverrideCommit={onMaterialOverrideCommit}
                onMaterialOverrideClear={onMaterialOverrideClear}
                onLaborOverrideChange={onLaborOverrideChange}
                onLaborOverrideCommit={onLaborOverrideCommit}
                onLaborOverrideClear={onLaborOverrideClear}
                onEquipmentOverrideChange={onEquipmentOverrideChange}
                onEquipmentOverrideCommit={onEquipmentOverrideCommit}
                onEquipmentOverrideClear={onEquipmentOverrideClear}
                onRecipeChanged={onRecipeChanged}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BuildupPanel({
  bidItemId,
  recipe,
  isCustom,
  crewRates,
  equipmentRates,
  materials,
  materialsById,
  estimate,
  materialOverrides,
  laborOverrides,
  equipmentOverrides,
  onMaterialOverrideChange,
  onMaterialOverrideCommit,
  onMaterialOverrideClear,
  onLaborOverrideChange,
  onLaborOverrideCommit,
  onLaborOverrideClear,
  onEquipmentOverrideChange,
  onEquipmentOverrideCommit,
  onEquipmentOverrideClear,
  onRecipeChanged,
}: {
  bidItemId: string;
  recipe: BidItemRecipe;
  isCustom: boolean;
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  materialsById: Map<string, Material>;
  estimate: LineItemEstimate;
} & Pick<
  LineItemRowProps,
  | "materialOverrides"
  | "laborOverrides"
  | "equipmentOverrides"
  | "onMaterialOverrideChange"
  | "onMaterialOverrideCommit"
  | "onMaterialOverrideClear"
  | "onLaborOverrideChange"
  | "onLaborOverrideCommit"
  | "onLaborOverrideClear"
  | "onEquipmentOverrideChange"
  | "onEquipmentOverrideCommit"
  | "onEquipmentOverrideClear"
  | "onRecipeChanged"
>) {
  const currentCrew = crewRates.filter((c) => c.is_current);
  const currentEquipment = equipmentRates.filter((e) => e.is_current);
  const currentMaterials = materials.filter((m) => m.is_current);

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Labor</h4>
          {isCustom && (
            <AddLaborRow
              bidItemId={bidItemId}
              crewRates={currentCrew}
              onAdded={onRecipeChanged}
            />
          )}
        </div>
        <table className="w-full max-w-2xl">
          <thead className="text-left text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Role</th>
              <th className="py-1 font-medium">Hours/unit</th>
              <th className="py-1 font-medium">Headcount</th>
              <th className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {recipe.labor.map((l) => {
              const override = laborOverrides.get(l.crew_role_id);
              const laborEstimate = estimate.base?.labor.find((x) => x.crew_role_id === l.crew_role_id);
              return (
                <tr key={l.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="py-1">{laborEstimate?.name ?? l.crew_role_id}</td>
                  <td className="py-1">
                    <input
                      type="number"
                      step="any"
                      defaultValue={isCustom ? l.hours_per_unit : override?.override_hours ?? ""}
                      placeholder={isCustom ? undefined : String(l.hours_per_unit)}
                      onBlur={async (e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (isCustom) {
                          if (v != null) await updateBidItemLaborRowAction(l.id, { hours_per_unit: v });
                          onRecipeChanged();
                        } else {
                          onLaborOverrideChange(l.crew_role_id, { override_hours: v });
                          onLaborOverrideCommit(l.crew_role_id, { override_hours: v });
                        }
                      }}
                      className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="number"
                      step="1"
                      defaultValue={isCustom ? l.headcount : override?.override_headcount ?? ""}
                      placeholder={isCustom ? undefined : String(l.headcount)}
                      onBlur={async (e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (isCustom) {
                          if (v != null) await updateBidItemLaborRowAction(l.id, { headcount: v });
                          onRecipeChanged();
                        } else {
                          onLaborOverrideChange(l.crew_role_id, { override_headcount: v });
                          onLaborOverrideCommit(l.crew_role_id, { override_headcount: v });
                        }
                      }}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </td>
                  <td className="py-1">
                    {isCustom ? (
                      <button
                        onClick={async () => {
                          await removeBidItemLaborRowAction(l.id);
                          onRecipeChanged();
                        }}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Remove
                      </button>
                    ) : (
                      laborEstimate?.overridden && (
                        <button
                          onClick={() => onLaborOverrideClear(l.crew_role_id)}
                          className="text-red-600 hover:underline dark:text-red-400"
                        >
                          Reset
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {recipe.labor.length === 0 && (
              <tr>
                <td colSpan={4} className="py-1 text-zinc-400">
                  No labor lines.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Equipment</h4>
          {isCustom && (
            <AddEquipmentRow
              bidItemId={bidItemId}
              equipmentRates={currentEquipment}
              onAdded={onRecipeChanged}
            />
          )}
        </div>
        <table className="w-full max-w-2xl">
          <thead className="text-left text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Equipment</th>
              <th className="py-1 font-medium">Hours/unit</th>
              <th className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {recipe.equipment.map((e) => {
              const override = equipmentOverrides.get(e.equipment_id);
              const equipEstimate = estimate.base?.equipment.find((x) => x.equipment_id === e.equipment_id);
              return (
                <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="py-1">{equipEstimate?.name ?? e.equipment_id}</td>
                  <td className="py-1">
                    <input
                      type="number"
                      step="any"
                      defaultValue={isCustom ? e.hours_per_unit : override?.override_hours ?? ""}
                      placeholder={isCustom ? undefined : String(e.hours_per_unit)}
                      onBlur={async (ev) => {
                        const v = ev.target.value === "" ? null : Number(ev.target.value);
                        if (isCustom) {
                          if (v != null) await updateBidItemEquipmentRowAction(e.id, { hours_per_unit: v });
                          onRecipeChanged();
                        } else {
                          onEquipmentOverrideChange(e.equipment_id, { override_hours: v });
                          onEquipmentOverrideCommit(e.equipment_id, { override_hours: v });
                        }
                      }}
                      className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </td>
                  <td className="py-1">
                    {isCustom ? (
                      <button
                        onClick={async () => {
                          await removeBidItemEquipmentRowAction(e.id);
                          onRecipeChanged();
                        }}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Remove
                      </button>
                    ) : (
                      equipEstimate?.overridden && (
                        <button
                          onClick={() => onEquipmentOverrideClear(e.equipment_id)}
                          className="text-red-600 hover:underline dark:text-red-400"
                        >
                          Reset
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {recipe.equipment.length === 0 && (
              <tr>
                <td colSpan={3} className="py-1 text-zinc-400">
                  No equipment lines.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Materials</h4>
          {isCustom && (
            <AddMaterialRow bidItemId={bidItemId} materials={currentMaterials} onAdded={onRecipeChanged} />
          )}
        </div>
        {estimate.base && estimate.base.materials.length > 0 ? (
          <table className="w-full max-w-2xl">
            <thead className="text-left text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 font-medium">Material</th>
                <th className="py-1 font-medium">Qty</th>
                <th className="py-1 font-medium">Rate</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody>
              {estimate.base.materials.map((m) => {
                const materialRow = materialsById.get(m.material_id);
                const recipeRow = recipe.materials.find((r) => r.material_id === m.material_id);
                const override = materialOverrides.get(m.material_id);
                return (
                  <tr key={m.material_id} className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="py-1">{m.name}</td>
                    <td className="py-1">
                      <input
                        type="number"
                        step="any"
                        placeholder={m.quantity.toFixed(2)}
                        defaultValue={override?.override_qty ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          onMaterialOverrideChange(m.material_id, { override_qty: v });
                          onMaterialOverrideCommit(m.material_id, { override_qty: v });
                        }}
                        className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={(materialRow?.rate ?? m.rate).toFixed(2)}
                        defaultValue={override?.override_rate ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          onMaterialOverrideChange(m.material_id, { override_rate: v });
                          onMaterialOverrideCommit(m.material_id, { override_rate: v });
                        }}
                        className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="py-1">
                      {isCustom ? (
                        recipeRow && (
                          <button
                            onClick={async () => {
                              await removeBidItemMaterialRowAction(recipeRow.id);
                              onRecipeChanged();
                            }}
                            className="text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        )
                      ) : (
                        m.overridden && (
                          <button
                            onClick={() => onMaterialOverrideClear(m.material_id)}
                            className="text-red-600 hover:underline dark:text-red-400"
                          >
                            Reset
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-400">No material lines.</p>
        )}
      </div>
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
  onAdded: () => void;
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
      <input
        type="number"
        placeholder="hrs/unit"
        value={hoursPerUnit}
        onChange={(e) => setHoursPerUnit(e.target.value)}
        className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
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
          await addBidItemLaborRowAction(bidItemId, {
            crew_role_id: crewRoleId,
            hours_per_unit: Number(hoursPerUnit),
            headcount: Number(headcount || 1),
          });
          setOpen(false);
          setCrewRoleId("");
          setHoursPerUnit("");
          onAdded();
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
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
  onAdded: () => void;
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
      <input
        type="number"
        placeholder="hrs/unit"
        value={hoursPerUnit}
        onChange={(e) => setHoursPerUnit(e.target.value)}
        className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <button
        disabled={!equipmentId || !hoursPerUnit}
        onClick={async () => {
          await addBidItemEquipmentRowAction(bidItemId, {
            equipment_id: equipmentId,
            hours_per_unit: Number(hoursPerUnit),
          });
          setOpen(false);
          setEquipmentId("");
          setHoursPerUnit("");
          onAdded();
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
    </div>
  );
}

function AddMaterialRow({
  bidItemId,
  materials,
  onAdded,
}: {
  bidItemId: string;
  materials: Material[];
  onAdded: () => void;
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
      <input
        type="number"
        placeholder="qty/unit"
        value={qtyPerUnit}
        onChange={(e) => setQtyPerUnit(e.target.value)}
        className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <span className="text-zinc-400">fixed ratio</span>
      <button
        disabled={!materialId || !qtyPerUnit}
        onClick={async () => {
          await addBidItemMaterialRowAction(bidItemId, {
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
          setOpen(false);
          setMaterialId("");
          setQtyPerUnit("");
          onAdded();
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
    </div>
  );
}

function VendorQuotesPanel({
  projectLineItemId,
  projectId,
  quotes,
  subMarkupPct,
  onFieldChange,
  onFieldCommit,
}: {
  projectLineItemId: string;
  projectId: string;
  quotes: ProjectLineItemVendorQuote[];
  subMarkupPct: number | null;
  onFieldChange: (patch: Partial<ProjectLineItem>) => void;
  onFieldCommit: (patch: Partial<ProjectLineItem>) => void;
}) {
  const [localQuotes, setLocalQuotes] = useState(quotes);
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div className="text-xs">
      <div className="mb-3 flex items-end gap-3">
        <label className="flex flex-col text-zinc-500">
          Sub markup %
          <input
            type="number"
            step="0.1"
            defaultValue={subMarkupPct != null ? subMarkupPct * 100 : ""}
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value) / 100;
              onFieldChange({ sub_markup_pct: v });
              onFieldCommit({ sub_markup_pct: v });
            }}
            className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
      </div>

      <table className="w-full max-w-2xl">
        <thead className="text-left text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 font-medium">Selected</th>
            <th className="py-1 font-medium">Vendor</th>
            <th className="py-1 font-medium">Quote amount</th>
            <th className="py-1 font-medium" />
          </tr>
        </thead>
        <tbody>
          {localQuotes.map((q) => (
            <tr key={q.id} className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="py-1">
                <input
                  type="radio"
                  checked={q.is_selected}
                  onChange={async () => {
                    setLocalQuotes((qs) => qs.map((x) => ({ ...x, is_selected: x.id === q.id })));
                    await selectVendorQuoteAction(projectLineItemId, projectId, q.id);
                  }}
                />
              </td>
              <td className="py-1">{q.vendor_name}</td>
              <td className="py-1">{formatCurrency(q.quote_amount)}</td>
              <td className="py-1">
                <button
                  onClick={async () => {
                    setLocalQuotes((qs) => qs.filter((x) => x.id !== q.id));
                    await removeVendorQuoteAction(q.id, projectId);
                  }}
                  className="text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {localQuotes.length === 0 && (
            <tr>
              <td colSpan={4} className="py-1 text-zinc-400">
                No quotes entered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-2 flex items-end gap-2">
        <input
          placeholder="Vendor name"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          className="w-40 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          disabled={!vendorName || !amount}
          onClick={async () => {
            const created = await addVendorQuoteAction(projectLineItemId, projectId, {
              vendor_name: vendorName,
              quote_amount: Number(amount),
            });
            setLocalQuotes((qs) => [
              ...qs.map((x) => (created.is_selected ? { ...x, is_selected: false } : x)),
              created,
            ]);
            setVendorName("");
            setAmount("");
          }}
          className="rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          Add quote
        </button>
      </div>
    </div>
  );
}
