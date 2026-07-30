"use client";

import { useMemo, useState } from "react";
import {
  RateContext,
  computeProjectEstimate,
  type LineItemEstimate,
  type MaterialOverrideInput,
} from "@/lib/calc-engine";
import type {
  BidItem,
  BidItemRecipe,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectLineItem,
  ProjectLineItemMaterialOverride,
  ProjectStatus,
} from "@/types/domain";
import {
  addProjectLineItemAction,
  clearMaterialOverrideAction,
  removeProjectLineItemAction,
  setMaterialOverrideAction,
  updateProjectLineItemAction,
  updateProjectStatusAction,
} from "../../actions";

type OverrideMap = Map<string, MaterialOverrideInput>;

const STATUSES: ProjectStatus[] = ["estimating", "submitted", "won", "lost"];

export function EstimateBuilder({
  project,
  initialLineItems,
  bidItems,
  recipesByBidItemId,
  crewRates,
  equipmentRates,
  materials,
  materialOverridesByLine,
}: {
  project: Project;
  initialLineItems: ProjectLineItem[];
  bidItems: BidItem[];
  recipesByBidItemId: Record<string, BidItemRecipe>;
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  materialOverridesByLine: Record<string, ProjectLineItemMaterialOverride[]>;
}) {
  const [status, setStatus] = useState(project.status);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [overridesByLine, setOverridesByLine] = useState<Record<string, OverrideMap>>(() => {
    const init: Record<string, OverrideMap> = {};
    for (const [lineId, overrides] of Object.entries(materialOverridesByLine)) {
      init[lineId] = new Map(overrides.map((o) => [o.material_id, o]));
    }
    return init;
  });
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [addBidItemId, setAddBidItemId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addPending, setAddPending] = useState(false);

  const rateContext = useMemo(
    () => new RateContext(crewRates, equipmentRates, materials),
    [crewRates, equipmentRates, materials]
  );
  const recipesMap = useMemo(
    () => new Map(Object.entries(recipesByBidItemId)),
    [recipesByBidItemId]
  );
  const materialsById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const estimate = useMemo(
    () =>
      computeProjectEstimate(
        project,
        lineItems,
        recipesMap,
        rateContext,
        new Map(Object.entries(overridesByLine))
      ),
    [project, lineItems, recipesMap, rateContext, overridesByLine]
  );
  const estimateByLineId = useMemo(
    () => new Map(estimate.lines.map((l) => [l.lineItemId, l])),
    [estimate.lines]
  );

  async function handleAdd() {
    if (!addBidItemId || !addQuantity) return;
    setAddPending(true);
    const created = await addProjectLineItemAction({
      project_id: project.id,
      bid_item_id: addBidItemId,
      quantity: Number(addQuantity),
    });
    setLineItems((rows) => [...rows, created]);
    setAddBidItemId("");
    setAddQuantity("");
    setAddPending(false);
  }

  async function handleRemove(lineId: string) {
    setLineItems((rows) => rows.filter((r) => r.id !== lineId));
    await removeProjectLineItemAction(lineId, project.id);
  }

  function patchLineLocal(lineId: string, patch: Partial<ProjectLineItem>) {
    setLineItems((rows) => rows.map((r) => (r.id === lineId ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.project_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {[project.client, project.location, project.dot_or_municipality].filter(Boolean).join(" · ") || "—"}
            {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Default markup: {(project.default_overhead_pct * 100).toFixed(1)}% overhead ·{" "}
            {(project.default_profit_pct * 100).toFixed(1)}% profit ·{" "}
            {(project.default_contingency_pct * 100).toFixed(1)}% contingency
          </p>
        </div>
        <select
          value={status}
          onChange={async (e) => {
            const next = e.target.value as ProjectStatus;
            setStatus(next);
            await updateProjectStatusAction(project.id, next);
          }}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium capitalize dark:border-zinc-700 dark:bg-zinc-800"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col text-xs text-zinc-500">
          Bid item
          <select
            value={addBidItemId}
            onChange={(e) => setAddBidItemId(e.target.value)}
            className="w-64 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">Select a bid item…</option>
            {bidItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.item_name} ({i.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Quantity
          <input
            type="number"
            step="any"
            value={addQuantity}
            onChange={(e) => setAddQuantity(e.target.value)}
            className="w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <button
          disabled={!addBidItemId || !addQuantity || addPending}
          onClick={handleAdd}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {addPending ? "Adding…" : "Add item"}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit price (raw)</th>
              <th className="px-4 py-2 font-medium">Rounded rate</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {lineItems.map((line) => {
              const recipe = recipesByBidItemId[line.bid_item_id];
              const lineEstimate = estimateByLineId.get(line.id);
              if (!recipe || !lineEstimate) return null;
              const expanded = expandedLine === line.id;
              return (
                <LineRow
                  key={line.id}
                  line={line}
                  recipe={recipe}
                  estimate={lineEstimate}
                  expanded={expanded}
                  overrides={overridesByLine[line.id] ?? new Map()}
                  materialsById={materialsById}
                  onToggleExpand={() => setExpandedLine(expanded ? null : line.id)}
                  onRemove={() => handleRemove(line.id)}
                  onQuantityChange={(q) => patchLineLocal(line.id, { quantity: q })}
                  onQuantityCommit={(q) =>
                    updateProjectLineItemAction(line.id, project.id, { quantity: q })
                  }
                  onRoundedRateChange={(rate) => patchLineLocal(line.id, { manual_rounded_rate: rate })}
                  onRoundedRateCommit={(rate) =>
                    updateProjectLineItemAction(line.id, project.id, { manual_rounded_rate: rate })
                  }
                  onOverridePctChange={(patch) => patchLineLocal(line.id, patch)}
                  onOverridePctCommit={(patch) => updateProjectLineItemAction(line.id, project.id, patch)}
                  onVendorFieldChange={(patch) => patchLineLocal(line.id, patch)}
                  onVendorFieldCommit={(patch) => updateProjectLineItemAction(line.id, project.id, patch)}
                  onMaterialOverrideChange={(materialId, patch) =>
                    setOverridesByLine((prev) => {
                      const next = { ...prev };
                      const lineMap = new Map(next[line.id] ?? []);
                      const existing = lineMap.get(materialId) ?? {};
                      lineMap.set(materialId, { ...existing, ...patch });
                      next[line.id] = lineMap;
                      return next;
                    })
                  }
                  onMaterialOverrideCommit={(materialId, patch) =>
                    setMaterialOverrideAction(line.id, project.id, materialId, patch)
                  }
                  onMaterialOverrideClear={(materialId) => {
                    setOverridesByLine((prev) => {
                      const next = { ...prev };
                      const lineMap = new Map(next[line.id] ?? []);
                      lineMap.delete(materialId);
                      next[line.id] = lineMap;
                      return next;
                    });
                    clearMaterialOverrideAction(line.id, project.id, materialId);
                  }}
                />
              );
            })}
            {lineItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No line items yet. Add a bid item above to start the estimate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ml-auto max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <TotalsRow label="Base cost" value={estimate.totalBaseCost} />
        <TotalsRow label="Overhead" value={estimate.totalOverhead} />
        <TotalsRow label="Profit" value={estimate.totalProfit} />
        <TotalsRow label="Contingency" value={estimate.totalContingency} />
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
          <span>Grand total</span>
          <span>{formatCurrency(estimate.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function TotalsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function LineRow({
  line,
  recipe,
  estimate,
  expanded,
  overrides,
  materialsById,
  onToggleExpand,
  onRemove,
  onQuantityChange,
  onQuantityCommit,
  onRoundedRateChange,
  onRoundedRateCommit,
  onOverridePctChange,
  onOverridePctCommit,
  onVendorFieldChange,
  onVendorFieldCommit,
  onMaterialOverrideChange,
  onMaterialOverrideCommit,
  onMaterialOverrideClear,
}: {
  line: ProjectLineItem;
  recipe: BidItemRecipe;
  estimate: LineItemEstimate;
  expanded: boolean;
  overrides: OverrideMap;
  materialsById: Map<string, Material>;
  onToggleExpand: () => void;
  onRemove: () => void;
  onQuantityChange: (q: number) => void;
  onQuantityCommit: (q: number) => void;
  onRoundedRateChange: (rate: number | null) => void;
  onRoundedRateCommit: (rate: number | null) => void;
  onOverridePctChange: (patch: Partial<ProjectLineItem>) => void;
  onOverridePctCommit: (patch: Partial<ProjectLineItem>) => void;
  onVendorFieldChange: (patch: Partial<ProjectLineItem>) => void;
  onVendorFieldCommit: (patch: Partial<ProjectLineItem>) => void;
  onMaterialOverrideChange: (
    materialId: string,
    patch: { override_rate?: number | null; override_qty?: number | null }
  ) => void;
  onMaterialOverrideCommit: (
    materialId: string,
    patch: { override_rate?: number | null; override_qty?: number | null }
  ) => void;
  onMaterialOverrideClear: (materialId: string) => void;
}) {
  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2">
          <div className="font-medium">{recipe.item.item_name}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{recipe.item.unit}</div>
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
        <td className="px-4 py-2">{formatCurrency(estimate.rawUnitPrice)}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            placeholder={estimate.rawUnitPrice.toFixed(2)}
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
            {expanded ? "Hide details" : "Overrides"}
          </button>
          <button onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
            Remove
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-800/40">
            {recipe.item.item_type === "sub_quote" ? (
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <label className="flex flex-col text-zinc-500">
                  Vendor
                  <input
                    defaultValue={line.vendor_name ?? ""}
                    onBlur={(e) => {
                      onVendorFieldChange({ vendor_name: e.target.value });
                      onVendorFieldCommit({ vendor_name: e.target.value });
                    }}
                    className="w-40 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label className="flex flex-col text-zinc-500">
                  Vendor quote amount
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={line.vendor_quote_amount ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      onVendorFieldChange({ vendor_quote_amount: v });
                      onVendorFieldCommit({ vendor_quote_amount: v });
                    }}
                    className="w-32 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label className="flex flex-col text-zinc-500">
                  Markup %
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={line.markup_pct != null ? line.markup_pct * 100 : ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value) / 100;
                      onVendorFieldChange({ markup_pct: v });
                      onVendorFieldCommit({ markup_pct: v });
                    }}
                    className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
                  <PctOverride
                    label="Overhead override %"
                    value={line.override_overhead_pct}
                    effectivePct={estimate.markup.overheadPct}
                    onChange={(v) => {
                      onOverridePctChange({ override_overhead_pct: v });
                      onOverridePctCommit({ override_overhead_pct: v });
                    }}
                  />
                  <PctOverride
                    label="Profit override %"
                    value={line.override_profit_pct}
                    effectivePct={estimate.markup.profitPct}
                    onChange={(v) => {
                      onOverridePctChange({ override_profit_pct: v });
                      onOverridePctCommit({ override_profit_pct: v });
                    }}
                  />
                  <PctOverride
                    label="Contingency override %"
                    value={line.override_contingency_pct}
                    effectivePct={estimate.markup.contingencyPct}
                    onChange={(v) => {
                      onOverridePctChange({ override_contingency_pct: v });
                      onOverridePctCommit({ override_contingency_pct: v });
                    }}
                  />
                </div>
                {estimate.base && estimate.base.materials.length > 0 && (
                  <table className="w-full max-w-2xl text-xs">
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
                        const override = overrides.get(m.material_id);
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
                              {m.overridden && (
                                <button
                                  onClick={() => onMaterialOverrideClear(m.material_id)}
                                  className="text-red-600 hover:underline dark:text-red-400"
                                >
                                  Clear
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function PctOverride({
  label,
  value,
  effectivePct,
  onChange,
}: {
  label: string;
  value: number | null;
  effectivePct: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col text-zinc-500">
      {label}
      <input
        type="number"
        step="0.1"
        placeholder={(effectivePct * 100).toFixed(1)}
        defaultValue={value != null ? value * 100 : ""}
        onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value) / 100)}
        className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
    </label>
  );
}
