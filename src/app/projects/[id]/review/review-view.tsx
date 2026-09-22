"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  RateContext,
  computeProjectEstimate,
  type LineItemEstimate,
  type SelectedVendorQuote,
} from "@/lib/calc-engine";
import type {
  BidItemRecipe,
  CompanyDefaults,
  CrewRate,
  EquipmentRate,
  InclusionExclusionBankItem,
  InclusionExclusionCategory,
  Material,
  Project,
  ProjectInclusion,
  ProjectLineItem,
  ProjectLineItemEquipmentOverride,
  ProjectLineItemLaborOverride,
  ProjectLineItemMaterialOverride,
  ProjectLineItemVendorQuote,
} from "@/types/domain";
import {
  addProjectInclusionAction,
  removeProjectInclusionAction,
  updateProjectInclusionAction,
  updateProjectLineItemAction,
} from "../../../actions";

type BidHistoryRow = { unit_price_bid: number; outcome: string | null; date: string };

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function historyRange(history: BidHistoryRow[]): { min: number; max: number } | null {
  if (history.length === 0) return null;
  const prices = history.map((h) => h.unit_price_bid);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function ReviewView({
  project,
  lineItems,
  recipesByBidItemId,
  crewRates,
  equipmentRates,
  materials,
  companyDefaults,
  materialOverridesByLine,
  laborOverridesByLine,
  equipmentOverridesByLine,
  vendorQuotesByLine,
  bidHistoryByBidItemId,
  inclusionBankItems,
  projectInclusions,
}: {
  project: Project;
  lineItems: ProjectLineItem[];
  recipesByBidItemId: Record<string, BidItemRecipe>;
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  companyDefaults: CompanyDefaults;
  materialOverridesByLine: Record<string, ProjectLineItemMaterialOverride[]>;
  laborOverridesByLine: Record<string, ProjectLineItemLaborOverride[]>;
  equipmentOverridesByLine: Record<string, ProjectLineItemEquipmentOverride[]>;
  vendorQuotesByLine: Record<string, ProjectLineItemVendorQuote[]>;
  bidHistoryByBidItemId: Record<string, BidHistoryRow[]>;
  inclusionBankItems: InclusionExclusionBankItem[];
  projectInclusions: ProjectInclusion[];
}) {
  const [lineItemsState, setLineItemsState] = useState(lineItems);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  const rateContext = useMemo(
    () => new RateContext(crewRates, equipmentRates, materials),
    [crewRates, equipmentRates, materials]
  );
  const recipesMap = useMemo(() => new Map(Object.entries(recipesByBidItemId)), [recipesByBidItemId]);

  const overridesByLineId = useMemo(() => {
    const map = new Map();
    const lineIds = new Set(lineItemsState.map((li) => li.id));
    for (const id of lineIds) {
      map.set(id, {
        materials: new Map((materialOverridesByLine[id] ?? []).map((o) => [o.material_id, o])),
        labor: new Map((laborOverridesByLine[id] ?? []).map((o) => [o.crew_role_id, o])),
        equipment: new Map((equipmentOverridesByLine[id] ?? []).map((o) => [o.equipment_id, o])),
      });
    }
    return map;
  }, [lineItemsState, materialOverridesByLine, laborOverridesByLine, equipmentOverridesByLine]);

  const selectedVendorQuoteByLineId = useMemo(() => {
    const map = new Map<string, SelectedVendorQuote>();
    for (const [lineId, quotes] of Object.entries(vendorQuotesByLine)) {
      const selected = quotes.find((q) => q.is_selected);
      if (selected) {
        map.set(lineId, { id: selected.id, vendor_name: selected.vendor_name, quote_amount: selected.quote_amount });
      }
    }
    return map;
  }, [vendorQuotesByLine]);

  const estimate = useMemo(
    () =>
      computeProjectEstimate(
        lineItemsState,
        recipesMap,
        companyDefaults,
        project.default_profit_pct,
        rateContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overridesByLineId as any,
        selectedVendorQuoteByLineId
      ),
    [lineItemsState, recipesMap, companyDefaults, project.default_profit_pct, rateContext, overridesByLineId, selectedVendorQuoteByLineId]
  );
  const estimateByLineId = useMemo(() => new Map(estimate.lines.map((l) => [l.lineItemId, l])), [estimate.lines]);

  // Self-performed lines only -- subcontracted lines have no labor/
  // equipment/material breakdown, just a vendor quote (base is null).
  const costBreakdown = useMemo(() => {
    let labor = 0;
    let equipment = 0;
    let material = 0;
    for (const line of estimate.lines) {
      if (!line.base) continue;
      labor += line.base.laborCost;
      equipment += line.base.equipmentCost;
      material += line.base.materialCost;
    }
    return { labor, equipment, material };
  }, [estimate.lines]);

  function patchLine(lineId: string, patch: Partial<ProjectLineItem>) {
    setLineItemsState((rows) => rows.map((r) => (r.id === lineId ? { ...r, ...patch } : r)));
    updateProjectLineItemAction(lineId, project.id, patch);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review & Quote — {project.project_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Company markup: {(companyDefaults.overhead_pct * 100).toFixed(1)}% overhead ·{" "}
            {(companyDefaults.contingency_pct * 100).toFixed(1)}% contingency (auto-applied)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.id}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ← Back to Estimate Builder
          </Link>
          <Link
            href={`/projects/${project.id}/quote`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            View Quote →
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-zinc-500 dark:text-zinc-400">Profit %:</span>
        <span className="font-medium">{(project.default_profit_pct * 100).toFixed(1)}%</span>
        <Link
          href={`/projects/${project.id}`}
          className="ml-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          set on Estimate Builder
        </Link>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          (applies to all self-performed items unless overridden below)
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit price</th>
              <th className="px-4 py-2 font-medium">Rounded rate (bid price)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {lineItemsState.map((line) => {
              const recipe = recipesByBidItemId[line.bid_item_id];
              const lineEstimate = estimateByLineId.get(line.id);
              if (!recipe || !lineEstimate) return null;
              const history = bidHistoryByBidItemId[line.bid_item_id] ?? [];
              const range = historyRange(history);
              const outsideRange = range != null && (lineEstimate.rawUnitPrice < range.min || lineEstimate.rawUnitPrice > range.max);
              const expanded = expandedLine === line.id;

              return (
                <ReviewLineRow
                  key={line.id}
                  line={line}
                  recipe={recipe}
                  estimate={lineEstimate}
                  expanded={expanded}
                  outsideRange={outsideRange}
                  range={range}
                  onToggleExpand={() => setExpandedLine(expanded ? null : line.id)}
                  onProfitOverrideChange={(v) => patchLine(line.id, { override_profit_pct: v })}
                  onRoundedRateChange={(v) => patchLine(line.id, { manual_rounded_rate: v })}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-4">
        <div className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cost breakdown
          </h3>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Total labor</span>
            <span>{formatCurrency(costBreakdown.labor)}</span>
          </div>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Total equipment</span>
            <span>{formatCurrency(costBreakdown.equipment)}</span>
          </div>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Total material</span>
            <span>{formatCurrency(costBreakdown.material)}</span>
          </div>
        </div>

        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Self-performed base cost</span>
            <span>{formatCurrency(estimate.selfPerformed.totalBaseCost)}</span>
          </div>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Overhead</span>
            <span>{formatCurrency(estimate.selfPerformed.totalOverhead)}</span>
          </div>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Contingency</span>
            <span>{formatCurrency(estimate.selfPerformed.totalContingency)}</span>
          </div>
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Profit</span>
            <span>{formatCurrency(estimate.selfPerformed.totalProfit)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-medium dark:border-zinc-800">
            <span>Self-performed total</span>
            <span>{formatCurrency(estimate.selfPerformed.total)}</span>
          </div>
          <div className="mt-2 flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Subcontracted total</span>
            <span>{formatCurrency(estimate.subcontracted.total)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
            <span>Grand total</span>
            <span>{formatCurrency(estimate.grandTotal)}</span>
          </div>
        </div>
      </div>

      <InclusionsEditor projectId={project.id} bankItems={inclusionBankItems} projectInclusions={projectInclusions} />
    </div>
  );
}

const CATEGORY_LABEL: Record<InclusionExclusionCategory, string> = {
  scope_of_work: "Scope of Work",
  gc_responsibility: "General Contractor Responsibility",
};

// Fills in "before we get to the final quote screen i need somewhere to
// enter inclusion/exclusions" -- both sections that show up on the Quote
// screen's footer. "Add from bank" copies a saved snippet's text into a
// fresh, independently-editable line (same shortcut pattern as crew/
// equipment groups); nothing here is a live link back to the bank, so
// editing wording here never touches the shared bank entry.
function InclusionsEditor({
  projectId,
  bankItems,
  projectInclusions,
}: {
  projectId: string;
  bankItems: InclusionExclusionBankItem[];
  projectInclusions: ProjectInclusion[];
}) {
  const [items, setItems] = useState(projectInclusions);

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Inclusions / Exclusions
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        Shown on the Quote screen. Pull from the bank as a starting point, then edit freely -- this is
        this job&apos;s wording, not the bank&apos;s.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {(["scope_of_work", "gc_responsibility"] as const).map((category) => (
          <InclusionCategoryList
            key={category}
            category={category}
            projectId={projectId}
            bankItems={bankItems.filter((b) => b.category === category)}
            rows={items.filter((i) => i.category === category)}
            onAdded={(row) => setItems((rows) => [...rows, row])}
            onUpdated={(id, text) => setItems((rows) => rows.map((r) => (r.id === id ? { ...r, text } : r)))}
            onRemoved={(id) => setItems((rows) => rows.filter((r) => r.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

function InclusionCategoryList({
  category,
  projectId,
  bankItems,
  rows,
  onAdded,
  onUpdated,
  onRemoved,
}: {
  category: InclusionExclusionCategory;
  projectId: string;
  bankItems: InclusionExclusionBankItem[];
  rows: ProjectInclusion[];
  onAdded: (row: ProjectInclusion) => void;
  onUpdated: (id: string, text: string) => void;
  onRemoved: (id: string) => void;
}) {
  const [bankSelection, setBankSelection] = useState("");
  const [customText, setCustomText] = useState("");

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {CATEGORY_LABEL[category]}
      </h3>
      <ul className="mb-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 text-zinc-400">–</span>
            <textarea
              defaultValue={row.text}
              rows={1}
              onBlur={async (e) => {
                if (e.target.value === row.text) return;
                onUpdated(row.id, e.target.value);
                await updateProjectInclusionAction(row.id, projectId, e.target.value);
              }}
              className="min-w-0 flex-1 resize-y rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={async () => {
                onRemoved(row.id);
                await removeProjectInclusionAction(row.id, projectId);
              }}
              className="mt-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-zinc-500 dark:text-zinc-400">Nothing entered yet.</li>}
      </ul>
      <div className="flex flex-wrap items-end gap-2 text-xs">
        {bankItems.length > 0 && (
          <>
            <select
              value={bankSelection}
              onChange={(e) => setBankSelection(e.target.value)}
              className="max-w-[14rem] rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Add from bank…</option>
              {bankItems.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.text.length > 60 ? `${b.text.slice(0, 60)}…` : b.text}
                </option>
              ))}
            </select>
            <button
              disabled={!bankSelection}
              onClick={async () => {
                const bankItem = bankItems.find((b) => b.id === bankSelection);
                if (!bankItem) return;
                const row = await addProjectInclusionAction(projectId, { category, text: bankItem.text });
                onAdded(row);
                setBankSelection("");
              }}
              className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              Add
            </button>
          </>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2 text-xs">
        <input
          placeholder="Custom line…"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          disabled={!customText.trim()}
          onClick={async () => {
            const row = await addProjectInclusionAction(projectId, { category, text: customText.trim() });
            onAdded(row);
            setCustomText("");
          }}
          className="rounded border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          + Add custom
        </button>
      </div>
    </div>
  );
}

function ReviewLineRow({
  line,
  recipe,
  estimate,
  expanded,
  outsideRange,
  range,
  onToggleExpand,
  onProfitOverrideChange,
  onRoundedRateChange,
}: {
  line: ProjectLineItem;
  recipe: BidItemRecipe;
  estimate: LineItemEstimate;
  expanded: boolean;
  outsideRange: boolean;
  range: { min: number; max: number } | null;
  onToggleExpand: () => void;
  onProfitOverrideChange: (v: number | null) => void;
  onRoundedRateChange: (v: number | null) => void;
}) {
  const displayName = line.item_name_override || recipe.item.item_name;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2">
          <div className="font-medium">{displayName}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {recipe.item.unit}
            {line.item_number_override ? ` · #${line.item_number_override}` : ""}
            {estimate.isSubcontracted && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                subcontracted
              </span>
            )}
            {outsideRange && range && (
              <span
                className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                title={`Historical range: ${formatCurrency(range.min)} - ${formatCurrency(range.max)}`}
              >
                outside historical range
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2">{line.quantity}</td>
        <td className="px-4 py-2">{formatCurrency(estimate.rawUnitPrice)}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            placeholder={estimate.rawUnitPrice.toFixed(2)}
            defaultValue={line.manual_rounded_rate ?? ""}
            onBlur={(e) => onRoundedRateChange(e.target.value === "" ? null : Number(e.target.value))}
            className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </td>
        <td className="px-4 py-2 font-medium">{formatCurrency(estimate.finalTotal)}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={onToggleExpand} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            {expanded ? "Collapse" : "Expand"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-800/40">
            {!estimate.isSubcontracted && (
              <label className="mb-3 flex w-40 flex-col text-xs text-zinc-500">
                Profit override % (this item)
                <input
                  type="number"
                  step="0.1"
                  placeholder={(estimate.markup.profitPct * 100).toFixed(1)}
                  defaultValue={line.override_profit_pct != null ? line.override_profit_pct * 100 : ""}
                  onBlur={(e) => onProfitOverrideChange(e.target.value === "" ? null : Number(e.target.value) / 100)}
                  className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>
            )}
            {estimate.base ? (
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <h4 className="mb-1 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Labor</h4>
                  {estimate.base.labor.map((l) => (
                    <div key={l.crew_role_id} className="flex justify-between">
                      <span>{l.name}</span>
                      <span>{formatCurrency(l.cost)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="mb-1 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Equipment</h4>
                  {estimate.base.equipment.map((e) => (
                    <div key={e.equipment_id} className="flex justify-between">
                      <span>{e.name}</span>
                      <span>{formatCurrency(e.cost)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="mb-1 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Materials</h4>
                  {estimate.base.materials.map((m) => (
                    <div key={m.material_id} className="flex justify-between">
                      <span>{m.name}</span>
                      <span>{formatCurrency(m.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Subcontracted: {estimate.selectedVendorQuote?.vendor_name ?? "no vendor selected"} —{" "}
                {estimate.selectedVendorQuote ? formatCurrency(estimate.selectedVendorQuote.quote_amount) : "—"}
              </p>
            )}
            {(line.notes_override || recipe.item.notes) && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                {line.notes_override ?? recipe.item.notes}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
