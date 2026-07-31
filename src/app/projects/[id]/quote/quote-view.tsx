"use client";

import { useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { RateContext, computeProjectEstimate, type SelectedVendorQuote } from "@/lib/calc-engine";
import type {
  BidItemRecipe,
  BidItemUnit,
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

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface QuoteRow {
  itemNumber: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: BidItemUnit;
  unitPrice: number;
  total: number;
}

// Client-facing only: pricing and quantities as the bid document should
// read, matching the original spreadsheet's "Quote" tab. No labor/
// equipment/material breakdown, and no distinction between self-performed
// and subcontracted lines -- the client never sees who's doing the work,
// only what it costs (round 3 #1, confirmed by round 4 #3).
export function QuoteView({
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
}) {
  const rateContext = useMemo(
    () => new RateContext(crewRates, equipmentRates, materials),
    [crewRates, equipmentRates, materials]
  );
  const recipesMap = useMemo(() => new Map(Object.entries(recipesByBidItemId)), [recipesByBidItemId]);

  const overridesByLineId = useMemo(() => {
    const map = new Map();
    for (const li of lineItems) {
      map.set(li.id, {
        materials: new Map((materialOverridesByLine[li.id] ?? []).map((o) => [o.material_id, o])),
        labor: new Map((laborOverridesByLine[li.id] ?? []).map((o) => [o.crew_role_id, o])),
        equipment: new Map((equipmentOverridesByLine[li.id] ?? []).map((o) => [o.equipment_id, o])),
      });
    }
    return map;
  }, [lineItems, materialOverridesByLine, laborOverridesByLine, equipmentOverridesByLine]);

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

  const rows: QuoteRow[] = lineItems
    .map((line) => {
      const recipe = recipesByBidItemId[line.bid_item_id];
      const lineEstimate = estimateByLineId.get(line.id);
      if (!recipe || !lineEstimate) return null;
      return {
        itemNumber: line.item_number_override ?? "",
        itemName: line.item_name_override || recipe.item.item_name,
        description: line.notes_override ?? recipe.item.notes ?? "",
        quantity: line.quantity,
        unit: recipe.item.unit,
        unitPrice: line.quantity > 0 ? lineEstimate.finalTotal / line.quantity : 0,
        total: lineEstimate.finalTotal,
      };
    })
    .filter((r): r is QuoteRow => r !== null);

  function handleExportExcel() {
    const header = ["Item #", "Item", "Description", "Qty", "Unit", "Unit Price", "Total"];
    const body = rows.map((r) => [r.itemNumber, r.itemName, r.description, r.quantity, r.unit, r.unitPrice, r.total]);
    const footer = ["", "", "", "", "", "Grand Total", estimate.grandTotal];
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, [], footer]);
    ws["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quote");
    XLSX.writeFile(wb, `${project.project_name.replace(/[^\w-]+/g, "_")}-quote.xlsx`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quote — {project.project_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {[project.client, project.location, project.dot_or_municipality].filter(Boolean).join(" · ") || "—"}
            {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.id}/review`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ← Back to Review
          </Link>
          <button
            onClick={handleExportExcel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Export to Excel
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="mb-6 hidden print:block">
        <h1 className="text-2xl font-semibold">{project.project_name}</h1>
        <p className="text-sm text-zinc-600">
          {[project.client, project.location, project.dot_or_municipality].filter(Boolean).join(" · ") || "—"}
          {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 print:bg-transparent">
            <tr>
              <th className="px-4 py-2 font-medium">Item #</th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Unit Price</th>
              <th className="px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="px-4 py-2">{r.itemNumber || "—"}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.itemName}</div>
                  {r.description && (
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{r.description}</div>
                  )}
                </td>
                <td className="px-4 py-2">{r.quantity}</td>
                <td className="px-4 py-2">{r.unit}</td>
                <td className="px-4 py-2">{formatCurrency(r.unitPrice)}</td>
                <td className="px-4 py-2 font-medium">{formatCurrency(r.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No line items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ml-auto max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-base font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:border-0">
        <div className="flex justify-between">
          <span>Total</span>
          <span>{formatCurrency(estimate.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
