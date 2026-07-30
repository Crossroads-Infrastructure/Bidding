"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RateContext, computeProjectEstimate, type SelectedVendorQuote } from "@/lib/calc-engine";
import type {
  BidItem,
  BidItemRecipe,
  CompanyDefaults,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectDocument,
  ProjectLineItem,
  ProjectLineItemEquipmentOverride,
  ProjectLineItemLaborOverride,
  ProjectLineItemMaterialOverride,
  ProjectLineItemVendorQuote,
  ProjectStatus,
} from "@/types/domain";
import {
  addCustomLineItemAction,
  addProjectLineItemAction,
  clearEquipmentOverrideAction,
  clearLaborOverrideAction,
  clearMaterialOverrideAction,
  removeProjectLineItemAction,
  setEquipmentOverrideAction,
  setLaborOverrideAction,
  setMaterialOverrideAction,
  updateProjectLineItemAction,
  updateProjectStatusAction,
} from "../../actions";
import { LineItemRow } from "./line-item-row";
import { DocumentsPanel } from "./documents-panel";
import Link from "next/link";

const STATUSES: ProjectStatus[] = ["estimating", "submitted", "won", "lost"];

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function EstimateBuilder({
  project,
  initialLineItems,
  catalogBidItems,
  recipesByBidItemId: recipesByBidItemIdProp,
  crewRates,
  equipmentRates,
  materials,
  companyDefaults,
  materialOverridesByLine,
  laborOverridesByLine,
  equipmentOverridesByLine,
  vendorQuotesByLine,
  initialDocuments,
}: {
  project: Project;
  initialLineItems: ProjectLineItem[];
  catalogBidItems: BidItem[];
  recipesByBidItemId: Record<string, BidItemRecipe>;
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  companyDefaults: CompanyDefaults;
  materialOverridesByLine: Record<string, ProjectLineItemMaterialOverride[]>;
  laborOverridesByLine: Record<string, ProjectLineItemLaborOverride[]>;
  equipmentOverridesByLine: Record<string, ProjectLineItemEquipmentOverride[]>;
  vendorQuotesByLine: Record<string, ProjectLineItemVendorQuote[]>;
  initialDocuments: ProjectDocument[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [recipesByBidItemId, setRecipesByBidItemId] = useState(recipesByBidItemIdProp);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  const [materialOverrides, setMaterialOverrides] = useState(() => toOverrideMaps(materialOverridesByLine, "material_id"));
  const [laborOverrides, setLaborOverrides] = useState(() => toOverrideMaps(laborOverridesByLine, "crew_role_id"));
  const [equipmentOverrides, setEquipmentOverrides] = useState(() => toOverrideMaps(equipmentOverridesByLine, "equipment_id"));
  const vendorQuotes = vendorQuotesByLine;

  const [addBidItemId, setAddBidItemId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<BidItem["unit"]>("LS");
  const [customQuantity, setCustomQuantity] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Recipe-row mutations (custom item buildup edits) happen via server
  // actions that don't return the full updated recipe, so onRecipeChanged
  // asks the server component to refetch; this resyncs local state from
  // the freshly-fetched prop during render (React's documented escape
  // hatch for this pattern), avoiding an extra effect-triggered render.
  const [prevRecipesProp, setPrevRecipesProp] = useState(recipesByBidItemIdProp);
  if (recipesByBidItemIdProp !== prevRecipesProp) {
    setPrevRecipesProp(recipesByBidItemIdProp);
    setRecipesByBidItemId(recipesByBidItemIdProp);
  }

  function refreshRecipes() {
    router.refresh();
  }

  const rateContext = useMemo(
    () => new RateContext(crewRates, equipmentRates, materials),
    [crewRates, equipmentRates, materials]
  );
  const recipesMap = useMemo(() => new Map(Object.entries(recipesByBidItemId)), [recipesByBidItemId]);
  const materialsById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const overridesByLineId = useMemo(() => {
    const map = new Map<string, { materials?: Map<string, unknown>; labor?: Map<string, unknown>; equipment?: Map<string, unknown> }>();
    const lineIds = new Set([
      ...Object.keys(materialOverrides),
      ...Object.keys(laborOverrides),
      ...Object.keys(equipmentOverrides),
    ]);
    for (const id of lineIds) {
      map.set(id, {
        materials: materialOverrides[id],
        labor: laborOverrides[id],
        equipment: equipmentOverrides[id],
      });
    }
    return map;
  }, [materialOverrides, laborOverrides, equipmentOverrides]);

  const selectedVendorQuoteByLineId = useMemo(() => {
    const map = new Map<string, SelectedVendorQuote>();
    for (const [lineId, quotes] of Object.entries(vendorQuotes)) {
      const selected = quotes.find((q) => q.is_selected);
      if (selected) {
        map.set(lineId, { id: selected.id, vendor_name: selected.vendor_name, quote_amount: selected.quote_amount });
      }
    }
    return map;
  }, [vendorQuotes]);

  const estimate = useMemo(
    () =>
      computeProjectEstimate(
        lineItems,
        recipesMap,
        companyDefaults,
        project.default_profit_pct,
        rateContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overridesByLineId as any,
        selectedVendorQuoteByLineId
      ),
    [lineItems, recipesMap, companyDefaults, project.default_profit_pct, rateContext, overridesByLineId, selectedVendorQuoteByLineId]
  );
  const estimateByLineId = useMemo(() => new Map(estimate.lines.map((l) => [l.lineItemId, l])), [estimate.lines]);

  async function handleAddFromCatalog() {
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

  async function handleAddCustom() {
    if (!customName || !customQuantity) return;
    setAddPending(true);
    const { line, recipe } = await addCustomLineItemAction(project.id, customName, customUnit, Number(customQuantity));
    setLineItems((rows) => [...rows, line]);
    setRecipesByBidItemId((prev) => ({ ...prev, [recipe.item.id]: recipe }));
    setCustomName("");
    setCustomQuantity("");
    setShowCustomForm(false);
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
            Company markup: {(companyDefaults.overhead_pct * 100).toFixed(1)}% overhead ·{" "}
            {(companyDefaults.contingency_pct * 100).toFixed(1)}% contingency
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.id}/review`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Review & Quote →
          </Link>
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
            {catalogBidItems.map((i) => (
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
          onClick={handleAddFromCatalog}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {addPending ? "Adding…" : "Add item"}
        </button>

        <div className="ml-auto">
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add custom item
            </button>
          ) : (
            <div className="flex items-end gap-2">
              <input
                placeholder="Item name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as BidItem["unit"])}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {(["SF", "LF", "EA", "SY", "LS", "CY", "TON", "GAL"] as const).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Qty"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                disabled={!customName || !customQuantity || addPending}
                onClick={handleAddCustom}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                Add
              </button>
              <button
                onClick={() => setShowCustomForm(false)}
                className="text-sm text-zinc-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit price (pre-profit)</th>
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
                <LineItemRow
                  key={line.id}
                  line={line}
                  recipe={recipe}
                  estimate={lineEstimate}
                  expanded={expanded}
                  materialOverrides={materialOverrides[line.id] ?? new Map()}
                  laborOverrides={laborOverrides[line.id] ?? new Map()}
                  equipmentOverrides={equipmentOverrides[line.id] ?? new Map()}
                  materialsById={materialsById}
                  crewRates={crewRates}
                  equipmentRates={equipmentRates}
                  materials={materials}
                  vendorQuotes={vendorQuotes[line.id] ?? []}
                  projectId={project.id}
                  onToggleExpand={() => setExpandedLine(expanded ? null : line.id)}
                  onRemove={() => handleRemove(line.id)}
                  onQuantityChange={(q) => patchLineLocal(line.id, { quantity: q })}
                  onQuantityCommit={(q) => updateProjectLineItemAction(line.id, project.id, { quantity: q })}
                  onRoundedRateChange={(rate) => patchLineLocal(line.id, { manual_rounded_rate: rate })}
                  onRoundedRateCommit={(rate) =>
                    updateProjectLineItemAction(line.id, project.id, { manual_rounded_rate: rate })
                  }
                  onFieldChange={(patch) => patchLineLocal(line.id, patch)}
                  onFieldCommit={(patch) => updateProjectLineItemAction(line.id, project.id, patch)}
                  onMaterialOverrideChange={(materialId, patch) =>
                    setMaterialOverrides((prev) => patchOverrideMap(prev, line.id, materialId, patch))
                  }
                  onMaterialOverrideCommit={(materialId, patch) =>
                    setMaterialOverrideAction(line.id, project.id, materialId, patch)
                  }
                  onMaterialOverrideClear={(materialId) => {
                    setMaterialOverrides((prev) => clearOverrideMap(prev, line.id, materialId));
                    clearMaterialOverrideAction(line.id, project.id, materialId);
                  }}
                  onLaborOverrideChange={(crewRoleId, patch) =>
                    setLaborOverrides((prev) => patchOverrideMap(prev, line.id, crewRoleId, patch))
                  }
                  onLaborOverrideCommit={(crewRoleId, patch) =>
                    setLaborOverrideAction(line.id, project.id, crewRoleId, patch)
                  }
                  onLaborOverrideClear={(crewRoleId) => {
                    setLaborOverrides((prev) => clearOverrideMap(prev, line.id, crewRoleId));
                    clearLaborOverrideAction(line.id, project.id, crewRoleId);
                  }}
                  onEquipmentOverrideChange={(equipmentId, patch) =>
                    setEquipmentOverrides((prev) => patchOverrideMap(prev, line.id, equipmentId, patch))
                  }
                  onEquipmentOverrideCommit={(equipmentId, patch) =>
                    setEquipmentOverrideAction(line.id, project.id, equipmentId, patch)
                  }
                  onEquipmentOverrideClear={(equipmentId) => {
                    setEquipmentOverrides((prev) => clearOverrideMap(prev, line.id, equipmentId));
                    clearEquipmentOverrideAction(line.id, project.id, equipmentId);
                  }}
                  onRecipeChanged={refreshRecipes}
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
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Not final — profit applied on Review
        </p>
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>Self-performed (base + OH + contingency)</span>
          <span>{formatCurrency(estimate.selfPerformed.preProfitTotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>Subcontracted</span>
          <span>{formatCurrency(estimate.subcontracted.total)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
          <span>Total (pre-profit)</span>
          <span>{formatCurrency(estimate.grandTotalPreProfit)}</span>
        </div>
      </div>

      <DocumentsPanel projectId={project.id} initialDocuments={initialDocuments} />
    </div>
  );
}

function toOverrideMaps<T extends object, K extends keyof T>(
  byLine: Record<string, T[]>,
  keyField: K
): Record<string, Map<string, T>> {
  const result: Record<string, Map<string, T>> = {};
  for (const [lineId, rows] of Object.entries(byLine)) {
    result[lineId] = new Map(rows.map((r) => [String(r[keyField]), r]));
  }
  return result;
}

function patchOverrideMap<T extends object>(
  prev: Record<string, Map<string, T>>,
  lineId: string,
  key: string,
  patch: Partial<T>
): Record<string, Map<string, T>> {
  const next = { ...prev };
  const lineMap = new Map(next[lineId] ?? []);
  const existing = lineMap.get(key) ?? ({} as T);
  lineMap.set(key, { ...existing, ...patch });
  next[lineId] = lineMap;
  return next;
}

function clearOverrideMap<T>(
  prev: Record<string, Map<string, T>>,
  lineId: string,
  key: string
): Record<string, Map<string, T>> {
  const next = { ...prev };
  const lineMap = new Map(next[lineId] ?? []);
  lineMap.delete(key);
  next[lineId] = lineMap;
  return next;
}
