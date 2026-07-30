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
  Material,
  Project,
  ProjectLineItem,
  ProjectLineItemEquipmentOverride,
  ProjectLineItemLaborOverride,
  ProjectLineItemMaterialOverride,
  ProjectLineItemVendorQuote,
} from "@/types/domain";
import { updateProjectLastUsedProfitAction, updateProjectLineItemAction } from "../../../actions";

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
}) {
  const [liveProfitPct, setLiveProfitPct] = useState(project.default_profit_pct * 100);
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
        liveProfitPct / 100,
        rateContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overridesByLineId as any,
        selectedVendorQuoteByLineId
      ),
    [lineItemsState, recipesMap, companyDefaults, liveProfitPct, rateContext, overridesByLineId, selectedVendorQuoteByLineId]
  );
  const estimateByLineId = useMemo(() => new Map(estimate.lines.map((l) => [l.lineItemId, l])), [estimate.lines]);

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
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ← Back to Estimate Builder
        </Link>
      </div>

      <div className="mb-6 flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col text-sm">
          Profit % <span className="text-xs font-normal text-zinc-500">(live — applies to all self-performed items unless overridden below)</span>
          <input
            type="number"
            step="0.1"
            value={liveProfitPct}
            onChange={(e) => setLiveProfitPct(Number(e.target.value))}
            onBlur={() => updateProjectLastUsedProfitAction(project.id, liveProfitPct / 100)}
            className="w-32 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit price</th>
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
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ml-auto max-w-md rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
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
}: {
  line: ProjectLineItem;
  recipe: BidItemRecipe;
  estimate: LineItemEstimate;
  expanded: boolean;
  outsideRange: boolean;
  range: { min: number; max: number } | null;
  onToggleExpand: () => void;
  onProfitOverrideChange: (v: number | null) => void;
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
        <td className="px-4 py-2 font-medium">{formatCurrency(estimate.finalTotal)}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={onToggleExpand} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            {expanded ? "Collapse" : "Expand"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-800/40">
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
