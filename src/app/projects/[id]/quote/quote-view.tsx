"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { RateContext, computeProjectEstimate, type SelectedVendorQuote } from "@/lib/calc-engine";
import { formatDate } from "@/lib/format";
import { updateProjectClientAction } from "../../../actions";
import type {
  BidItemRecipe,
  BidItemUnit,
  CompanyDefaults,
  CompanyProfile,
  CrewRate,
  EquipmentRate,
  Material,
  Project,
  ProjectInclusion,
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
// read, matching the original spreadsheet's "Quote" tab and, as of round
// 7, the layout of the company's real quote template (header block,
// "Total Bid Price," Inclusions/Exclusions with Scope of Work + GC
// Responsibility). No labor/equipment/material breakdown, and no
// distinction between self-performed and subcontracted lines -- the
// client never sees who's doing the work, only what it costs (round 3 #1,
// confirmed by round 4 #3).
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
  companyProfile,
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
  companyProfile: CompanyProfile | undefined;
  projectInclusions: ProjectInclusion[];
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

  const scopeOfWork = projectInclusions.filter((i) => i.category === "scope_of_work");
  const gcResponsibility = projectInclusions.filter((i) => i.category === "gc_responsibility");
  const validityDays = companyProfile?.quote_validity_days ?? 30;
  const [bidToValue, setBidToValue] = useState(project.client ?? "");
  const bidTo = bidToValue.trim() || "Prime Contractor";

  function handleExportExcel() {
    const rowsOut: (string | number)[][] = [];
    rowsOut.push([`Quote for: ${project.project_name}`]);
    if (companyProfile) {
      rowsOut.push([companyProfile.company_name]);
      if (companyProfile.address_line1) rowsOut.push([companyProfile.address_line1]);
      if (companyProfile.city_state_zip) rowsOut.push([companyProfile.city_state_zip]);
      rowsOut.push([]);
      if (companyProfile.contact_name) rowsOut.push([`Contact: ${companyProfile.contact_name}`]);
      if (companyProfile.contact_phone) rowsOut.push([`Cell: ${companyProfile.contact_phone}`]);
      if (companyProfile.contact_email) rowsOut.push([`Email: ${companyProfile.contact_email}`]);
    }
    rowsOut.push([]);
    rowsOut.push([`Bid Date: ${formatDate(project.bid_date)}`]);
    rowsOut.push([`Quote is valid for ${validityDays} days`]);
    rowsOut.push([`Bid to: ${bidTo}`]);
    rowsOut.push([]);

    const header = ["Item #", "Description", "Quantity", "Unit", "Rate", "Total"];
    const body = rows.map((r) => [r.itemNumber, r.itemName, r.quantity, r.unit, r.unitPrice, r.total]);
    rowsOut.push(header, ...body, [], ["", "", "", "", "Total Bid Price", estimate.grandTotal]);

    if (scopeOfWork.length || gcResponsibility.length || companyProfile?.certification_tagline) {
      rowsOut.push([], ["Inclusion/Exclusions:"]);
      if (companyProfile?.certification_tagline) rowsOut.push([companyProfile.certification_tagline]);
      if (scopeOfWork.length) {
        rowsOut.push([], ["Scope of Work:"]);
        scopeOfWork.forEach((i) => rowsOut.push([`• ${i.text}`]));
      }
      if (gcResponsibility.length) {
        rowsOut.push([], ["General Contractor Responsibility:"]);
        gcResponsibility.forEach((i) => rowsOut.push([`• ${i.text}`]));
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rowsOut);
    ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
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
            {project.bid_date ? ` · Bid ${formatDate(project.bid_date)}` : ""}
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

      {/* Quote header -- shown both on screen and when printed, matching the company's real quote template */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800 print:border-black">
        <div>
          <p className="text-lg font-semibold">Quote for: {project.project_name}</p>
          <div className="mt-2 flex items-center gap-4">
            {companyProfile?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyProfile.logo_url} alt={`${companyProfile.company_name} logo`} className="h-[70px] w-auto" />
            )}
            {companyProfile && (
              <div>
                <p className="font-medium">{companyProfile.company_name}</p>
                {companyProfile.address_line1 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 print:text-black">{companyProfile.address_line1}</p>
                )}
                {companyProfile.city_state_zip && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 print:text-black">{companyProfile.city_state_zip}</p>
                )}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm print:hidden">
            <span>Bid to:</span>
            <input
              value={bidToValue}
              placeholder="Prime Contractor"
              onChange={(e) => setBidToValue(e.target.value)}
              onBlur={() => updateProjectClientAction(project.id, bidToValue.trim() || null)}
              className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <p className="mt-2 hidden text-sm print:block">Bid to: {bidTo}</p>
        </div>
        <div className="text-right text-sm">
          {companyProfile?.contact_name && <p>Contact: {companyProfile.contact_name}</p>}
          {companyProfile?.contact_phone && <p>Cell: {companyProfile.contact_phone}</p>}
          {companyProfile?.contact_email && <p>Email: {companyProfile.contact_email}</p>}
          <p className="mt-2">Bid Date: {formatDate(project.bid_date)}</p>
          <p>Quote is valid for {validityDays} days</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 print:bg-transparent">
            <tr>
              <th className="px-4 py-2 font-medium">Item #</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Quantity</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Rate</th>
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
            {rows.length > 0 && (
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td colSpan={5} className="px-4 py-2 text-right font-semibold">
                  Total Bid Price
                </td>
                <td className="px-4 py-2 text-base font-semibold">{formatCurrency(estimate.grandTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(scopeOfWork.length > 0 || gcResponsibility.length > 0 || companyProfile?.certification_tagline) && (
        <div className="mt-6 text-sm">
          <p className="font-medium">Inclusion/Exclusions:</p>
          {companyProfile?.certification_tagline && (
            <p className="my-2 text-center text-lg font-bold">{companyProfile.certification_tagline}</p>
          )}
          {scopeOfWork.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold">Scope of Work:</p>
              <ul className="mt-1 list-disc pl-5">
                {scopeOfWork.map((i) => (
                  <li key={i.id}>{i.text}</li>
                ))}
              </ul>
            </div>
          )}
          {gcResponsibility.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold">General Contractor Responsibility:</p>
              <ul className="mt-1 list-disc pl-5">
                {gcResponsibility.map((i) => (
                  <li key={i.id}>{i.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
