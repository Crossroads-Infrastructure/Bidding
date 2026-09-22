"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CompanyDefaults,
  CompanyProfile,
  CrewGroup,
  CrewGroupMember,
  CrewRate,
  EquipmentGroup,
  EquipmentGroupMember,
  EquipmentRate,
  InclusionExclusionBankItem,
  InclusionExclusionCategory,
  Material,
} from "@/types/domain";
import { isRateStale } from "@/lib/rate-utils";
import { resizeImageFile } from "@/lib/image-resize";
import {
  addCompanyDefaultsAction,
  addCrewGroupMemberAction,
  addCrewRateAction,
  addEquipmentGroupMemberAction,
  addEquipmentRateAction,
  addInclusionBankItemAction,
  addMaterialAction,
  archiveCrewRateAction,
  archiveEquipmentRateAction,
  archiveMaterialAction,
  createCrewGroupAction,
  createEquipmentGroupAction,
  deleteCrewGroupAction,
  deleteCrewRatePermanentlyAction,
  deleteEquipmentGroupAction,
  deleteEquipmentRatePermanentlyAction,
  deleteMaterialPermanentlyAction,
  removeCrewGroupMemberAction,
  removeEquipmentGroupMemberAction,
  removeInclusionBankItemAction,
  restoreCrewRateAction,
  restoreEquipmentRateAction,
  restoreMaterialAction,
  updateCrewGroupMemberAction,
  uploadCompanyLogoAction,
  upsertCompanyProfileAction,
} from "../actions";

type Tab = "crew" | "equipment" | "materials" | "crew-groups" | "equipment-groups" | "inclusions";

export function RateLibrary({
  crewRates,
  equipmentRates,
  materials,
  companyDefaults,
  crewGroups,
  crewGroupMembersByGroup,
  equipmentGroups,
  equipmentGroupMembersByGroup,
  companyProfile,
  inclusionBankItems,
}: {
  crewRates: CrewRate[];
  equipmentRates: EquipmentRate[];
  materials: Material[];
  companyDefaults: CompanyDefaults | undefined;
  crewGroups: CrewGroup[];
  crewGroupMembersByGroup: Record<string, CrewGroupMember[]>;
  equipmentGroups: EquipmentGroup[];
  equipmentGroupMembersByGroup: Record<string, EquipmentGroupMember[]>;
  companyProfile: CompanyProfile | undefined;
  inclusionBankItems: InclusionExclusionBankItem[];
}) {
  const [tab, setTab] = useState<Tab>("crew");

  return (
    <div>
      <CompanyDefaultsCard companyDefaults={companyDefaults} />
      <CompanyProfileCard companyProfile={companyProfile} />

      <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(["crew", "equipment", "materials", "crew-groups", "equipment-groups", "inclusions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t === "crew" ? "Crew" : t === "inclusions" ? "Inclusions / Exclusions" : t.replace("-", " ")}
          </button>
        ))}
      </div>

      {tab === "crew" && <CrewTab rates={crewRates.filter((r) => r.is_current)} />}
      {tab === "equipment" && <EquipmentTab rates={equipmentRates.filter((r) => r.is_current)} />}
      {tab === "materials" && <MaterialsTab materials={materials.filter((m) => m.is_current)} />}
      {tab === "crew-groups" && (
        <CrewGroupsTab
          groups={crewGroups}
          membersByGroup={crewGroupMembersByGroup}
          crewRates={crewRates.filter((r) => r.is_current)}
        />
      )}
      {tab === "equipment-groups" && (
        <EquipmentGroupsTab
          groups={equipmentGroups}
          membersByGroup={equipmentGroupMembersByGroup}
          equipmentRates={equipmentRates.filter((r) => r.is_current)}
        />
      )}
      {tab === "inclusions" && <InclusionBankTab items={inclusionBankItems} />}
    </div>
  );
}

function CompanyProfileCard({ companyProfile }: { companyProfile: CompanyProfile | undefined }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoPending, setLogoPending] = useState(false);
  const [form, setForm] = useState({
    company_name: companyProfile?.company_name ?? "",
    address_line1: companyProfile?.address_line1 ?? "",
    city_state_zip: companyProfile?.city_state_zip ?? "",
    contact_name: companyProfile?.contact_name ?? "",
    contact_phone: companyProfile?.contact_phone ?? "",
    contact_email: companyProfile?.contact_email ?? "",
    certification_tagline: companyProfile?.certification_tagline ?? "",
    quote_validity_days: String(companyProfile?.quote_validity_days ?? 30),
  });

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Company Profile
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {companyProfile ? "Update" : "Set up"}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Shown on the Quote screen&apos;s header and footer -- name, address, contact info, certification tagline,
        and how many days a quote stays valid.
      </p>
      <div className="mb-3 flex items-center gap-3">
        {companyProfile?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={companyProfile.logo_url} alt="Company logo" className="h-14 w-auto rounded border border-zinc-200 dark:border-zinc-700" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
            No logo
          </div>
        )}
        <label className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
          {logoPending ? "Uploading…" : companyProfile?.logo_url ? "Replace logo" : "Upload logo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={logoPending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLogoPending(true);
              const resized = await resizeImageFile(file);
              const formData = new FormData();
              formData.set("file", resized);
              await uploadCompanyLogoAction(formData);
              setLogoPending(false);
              router.refresh();
            }}
          />
        </label>
      </div>
      <p className="-mt-2 mb-3 text-[10px] text-zinc-400">
        Any image works -- it&apos;s automatically resized before upload, so there&apos;s no need to prepare it first.
      </p>
      {!editing ? (
        companyProfile ? (
          <div className="text-sm">
            <p className="font-medium">{companyProfile.company_name}</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {[companyProfile.address_line1, companyProfile.city_state_zip].filter(Boolean).join(", ") || "—"}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {[companyProfile.contact_name, companyProfile.contact_phone, companyProfile.contact_email]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not set up yet.</p>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            placeholder="Company name"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
          />
          <input
            placeholder="Address line"
            value={form.address_line1}
            onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            placeholder="City, State ZIP"
            value={form.city_state_zip}
            onChange={(e) => setForm({ ...form, city_state_zip: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            placeholder="Contact name"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            placeholder="Contact phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            placeholder="Contact email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="number"
            placeholder="Quote valid for (days)"
            value={form.quote_validity_days}
            onChange={(e) => setForm({ ...form, quote_validity_days: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            placeholder="Certification tagline (e.g. CERTIFIED NCDOT DBE-WBE)"
            value={form.certification_tagline}
            onChange={(e) => setForm({ ...form, certification_tagline: e.target.value })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={pending || !form.company_name}
              onClick={async () => {
                setPending(true);
                await upsertCompanyProfileAction({
                  company_name: form.company_name,
                  address_line1: form.address_line1 || null,
                  city_state_zip: form.city_state_zip || null,
                  contact_name: form.contact_name || null,
                  contact_phone: form.contact_phone || null,
                  contact_email: form.contact_email || null,
                  certification_tagline: form.certification_tagline || null,
                  quote_validity_days: Number(form.quote_validity_days || 30),
                });
                setPending(false);
                setEditing(false);
              }}
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-xs font-medium text-zinc-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const INCLUSION_CATEGORY_LABEL: Record<InclusionExclusionCategory, string> = {
  scope_of_work: "Scope of Work",
  gc_responsibility: "General Contractor Responsibility",
};

// The reusable bank behind "having a bank of prefilled inclusions/
// exclusions would simplify quoting" -- each project picks from this list
// (see the Review screen) and gets its own independently-editable copy.
function InclusionBankTab({ items }: { items: InclusionExclusionBankItem[] }) {
  const [localItems, setLocalItems] = useState(items);

  return (
    <div className="flex flex-col gap-6">
      {(["scope_of_work", "gc_responsibility"] as const).map((category) => (
        <div key={category} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {INCLUSION_CATEGORY_LABEL[category]}
          </h3>
          <ul className="mb-3 flex flex-col gap-1.5 text-sm">
            {localItems
              .filter((i) => i.category === category)
              .map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <span>{item.text}</span>
                  <button
                    onClick={async () => {
                      setLocalItems((rows) => rows.filter((r) => r.id !== item.id));
                      await removeInclusionBankItemAction(item.id);
                    }}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            {localItems.filter((i) => i.category === category).length === 0 && (
              <li className="text-zinc-500 dark:text-zinc-400">Nothing in the bank yet.</li>
            )}
          </ul>
          <InclusionAddRow category={category} onAdded={(row) => setLocalItems((rows) => [...rows, row])} />
        </div>
      ))}
    </div>
  );
}

function InclusionAddRow({
  category,
  onAdded,
}: {
  category: InclusionExclusionCategory;
  onAdded: (row: InclusionExclusionBankItem) => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-end gap-2">
      <input
        placeholder="New bank entry…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
      <button
        disabled={!text.trim() || pending}
        onClick={async () => {
          setPending(true);
          const row = await addInclusionBankItemAction({ category, text: text.trim() });
          onAdded(row);
          setText("");
          setPending(false);
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add
      </button>
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

// Round 3: shared "Active / Archived" switch used by the Crew, Equipment,
// Materials, and Bid Item library views.
function ArchiveViewToggle({
  view,
  onChange,
  archivedCount,
}: {
  view: "active" | "archived";
  onChange: (v: "active" | "archived") => void;
  archivedCount: number;
}) {
  return (
    <div className="mb-3 flex gap-1 text-xs">
      {(["active", "archived"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 font-medium capitalize ${
            view === v
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          {v === "archived" ? `Archived (${archivedCount})` : "Active"}
        </button>
      ))}
    </div>
  );
}

// Round 3: generic "Archived" list -- Restore or Delete Permanently, with
// the permanent-delete reference-check guardrail's error surfaced inline.
function ArchivedTable<T>({
  rows,
  columns,
  onRestore,
  onDelete,
  rowKey,
}: {
  rows: T[];
  columns: (row: T) => string[];
  onRestore: (row: T) => Promise<unknown>;
  onDelete: (row: T) => Promise<void>;
  rowKey: (row: T) => string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns(row).map((c, i) => (
                <td key={i} className="px-4 py-2">
                  {c}
                </td>
              ))}
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <button
                  onClick={async () => {
                    await onRestore(row);
                    router.refresh();
                  }}
                  className="mr-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Restore
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm("Permanently delete this? This cannot be undone.")) return;
                    setError(null);
                    try {
                      await onDelete(row);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  Delete Permanently
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={99} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nothing archived.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CompanyDefaultsCard({ companyDefaults }: { companyDefaults: CompanyDefaults | undefined }) {
  const [editing, setEditing] = useState(false);
  const [overhead, setOverhead] = useState(String((companyDefaults?.overhead_pct ?? 0) * 100));
  const [contingency, setContingency] = useState(String((companyDefaults?.contingency_pct ?? 0) * 100));
  const [pending, setPending] = useState(false);

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Company Defaults
        </h2>
        {companyDefaults && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Effective {companyDefaults.effective_date}
            <StaleBadge effectiveDate={companyDefaults.effective_date} />
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Overhead and contingency applied to every project automatically. Editing creates a new dated
        entry — projects already estimated keep whatever rate was current when they were built.
      </p>
      {!editing ? (
        <div className="flex items-center gap-6 text-sm">
          <span>Overhead: <strong>{((companyDefaults?.overhead_pct ?? 0) * 100).toFixed(1)}%</strong></span>
          <span>Contingency: <strong>{((companyDefaults?.contingency_pct ?? 0) * 100).toFixed(1)}%</strong></span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Update
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-zinc-500">
            Overhead %
            <input
              type="number"
              step="0.1"
              value={overhead}
              onChange={(e) => setOverhead(e.target.value)}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            Contingency %
            <input
              type="number"
              step="0.1"
              value={contingency}
              onChange={(e) => setContingency(e.target.value)}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await addCompanyDefaultsAction({
                overhead_pct: Number(overhead) / 100,
                contingency_pct: Number(contingency) / 100,
              });
              setPending(false);
              setEditing(false);
            }}
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            Save (new entry)
          </button>
          <button onClick={() => setEditing(false)} className="text-xs font-medium text-zinc-500 hover:underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function CrewTab({ rates }: { rates: CrewRate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");

  const activeRates = rates.filter((r) => r.is_active);
  const archivedRates = rates.filter((r) => !r.is_active);

  return (
    <div>
      <ArchiveViewToggle view={view} onChange={setView} archivedCount={archivedRates.length} />
      {view === "active" ? (
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
              {activeRates.map((r) =>
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
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(r.id)}
                        className="mr-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Update rate
                      </button>
                      <button
                        onClick={async () => {
                          await archiveCrewRateAction(r.id);
                          router.refresh();
                        }}
                        className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        Archive
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
      ) : (
        <ArchivedTable
          rows={archivedRates}
          columns={(r) => [r.role_name, `$${r.hourly_rate.toFixed(2)}/hr`]}
          onRestore={(r) => restoreCrewRateAction(r.id)}
          onDelete={(r) => deleteCrewRatePermanentlyAction(r.role_name)}
          rowKey={(r) => r.id}
        />
      )}
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
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");

  const activeRates = rates.filter((r) => r.is_active);
  const archivedRates = rates.filter((r) => !r.is_active);

  return (
    <div>
      <ArchiveViewToggle view={view} onChange={setView} archivedCount={archivedRates.length} />
      {view === "active" ? (
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
              {activeRates.map((r) =>
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
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(r.id)}
                        className="mr-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Update rate
                      </button>
                      <button
                        onClick={async () => {
                          await archiveEquipmentRateAction(r.id);
                          router.refresh();
                        }}
                        className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        Archive
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
      ) : (
        <ArchivedTable
          rows={archivedRates}
          columns={(r) => [r.equipment_name, `$${r.hourly_rate.toFixed(2)}/hr`]}
          onRestore={(r) => restoreEquipmentRateAction(r.id)}
          onDelete={(r) => deleteEquipmentRatePermanentlyAction(r.equipment_name)}
          rowKey={(r) => r.id}
        />
      )}
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
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");

  const activeMaterials = materials.filter((m) => m.is_active);
  const archivedMaterials = materials.filter((m) => !m.is_active);

  return (
    <div>
      <ArchiveViewToggle view={view} onChange={setView} archivedCount={archivedMaterials.length} />
      {view === "active" ? (
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
              {activeMaterials.map((m) =>
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
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(m.id)}
                        className="mr-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Update rate
                      </button>
                      <button
                        onClick={async () => {
                          await archiveMaterialAction(m.id);
                          router.refresh();
                        }}
                        className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        Archive
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
      ) : (
        <ArchivedTable
          rows={archivedMaterials}
          columns={(m) => [m.material_name, m.unit, `$${m.rate.toFixed(2)}`]}
          onRestore={(m) => restoreMaterialAction(m.id)}
          onDelete={(m) => deleteMaterialPermanentlyAction(m.material_name)}
          rowKey={(m) => m.id}
        />
      )}
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

// ---------------- Crew / equipment groups ----------------

function CrewGroupsTab({
  groups,
  membersByGroup,
  crewRates,
}: {
  groups: CrewGroup[];
  membersByGroup: Record<string, CrewGroupMember[]>;
  crewRates: CrewRate[];
}) {
  const [localGroups, setLocalGroups] = useState(groups);
  const [localMembers, setLocalMembers] = useState(membersByGroup);
  const [newGroupName, setNewGroupName] = useState("");

  const crewNameById = new Map(crewRates.map((c) => [c.id, c.role_name]));

  return (
    <div className="flex flex-col gap-4">
      {localGroups.map((group) => (
        <div key={group.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{group.group_name}</h3>
              {group.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>}
            </div>
            <button
              onClick={async () => {
                if (!window.confirm(`Delete crew group "${group.group_name}"? This cannot be undone.`)) return;
                setLocalGroups((gs) => gs.filter((g) => g.id !== group.id));
                await deleteCrewGroupAction(group.id);
              }}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Delete group
            </button>
          </div>
          <table className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(localMembers[group.id] ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="py-1">{crewNameById.get(m.crew_role_id) ?? m.crew_role_id}</td>
                  <td className="py-1">
                    <input
                      type="number"
                      defaultValue={m.default_headcount}
                      onBlur={(e) => updateCrewGroupMemberAction(m.id, Number(e.target.value))}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      onClick={async () => {
                        setLocalMembers((prev) => ({
                          ...prev,
                          [group.id]: (prev[group.id] ?? []).filter((x) => x.id !== m.id),
                        }));
                        await removeCrewGroupMemberAction(m.id);
                      }}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddCrewGroupMemberRow
            crewGroupId={group.id}
            crewRates={crewRates}
            onAdded={(member) =>
              setLocalMembers((prev) => ({ ...prev, [group.id]: [...(prev[group.id] ?? []), member] }))
            }
          />
        </div>
      ))}

      <div className="flex items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <label className="flex flex-col text-xs text-zinc-500">
          New group name
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <button
          disabled={!newGroupName}
          onClick={async () => {
            const group = await createCrewGroupAction({ group_name: newGroupName });
            setLocalGroups((gs) => [...gs, group]);
            setLocalMembers((prev) => ({ ...prev, [group.id]: [] }));
            setNewGroupName("");
          }}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          + Add crew group
        </button>
      </div>
    </div>
  );
}

function AddCrewGroupMemberRow({
  crewGroupId,
  crewRates,
  onAdded,
}: {
  crewGroupId: string;
  crewRates: CrewRate[];
  onAdded: (member: CrewGroupMember) => void;
}) {
  const [crewRoleId, setCrewRoleId] = useState("");
  const [headcount, setHeadcount] = useState("1");

  return (
    <div className="mt-2 flex items-end gap-2 text-xs">
      <select
        value={crewRoleId}
        onChange={(e) => setCrewRoleId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Add role…</option>
        {crewRates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.role_name}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={headcount}
        onChange={(e) => setHeadcount(e.target.value)}
        className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <button
        disabled={!crewRoleId}
        onClick={async () => {
          const member = await addCrewGroupMemberAction(crewGroupId, {
            crew_role_id: crewRoleId,
            default_headcount: Number(headcount || 1),
          });
          onAdded(member);
          setCrewRoleId("");
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add member
      </button>
    </div>
  );
}

function EquipmentGroupsTab({
  groups,
  membersByGroup,
  equipmentRates,
}: {
  groups: EquipmentGroup[];
  membersByGroup: Record<string, EquipmentGroupMember[]>;
  equipmentRates: EquipmentRate[];
}) {
  const [localGroups, setLocalGroups] = useState(groups);
  const [localMembers, setLocalMembers] = useState(membersByGroup);
  const [newGroupName, setNewGroupName] = useState("");

  const equipmentNameById = new Map(equipmentRates.map((e) => [e.id, e.equipment_name]));

  return (
    <div className="flex flex-col gap-4">
      {localGroups.map((group) => (
        <div key={group.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{group.group_name}</h3>
              {group.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>}
            </div>
            <button
              onClick={async () => {
                if (!window.confirm(`Delete equipment group "${group.group_name}"? This cannot be undone.`)) return;
                setLocalGroups((gs) => gs.filter((g) => g.id !== group.id));
                await deleteEquipmentGroupAction(group.id);
              }}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Delete group
            </button>
          </div>
          <table className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(localMembers[group.id] ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="py-1">{equipmentNameById.get(m.equipment_id) ?? m.equipment_id}</td>
                  <td className="py-1 text-right">
                    <button
                      onClick={async () => {
                        setLocalMembers((prev) => ({
                          ...prev,
                          [group.id]: (prev[group.id] ?? []).filter((x) => x.id !== m.id),
                        }));
                        await removeEquipmentGroupMemberAction(m.id);
                      }}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddEquipmentGroupMemberRow
            equipmentGroupId={group.id}
            equipmentRates={equipmentRates}
            onAdded={(member) =>
              setLocalMembers((prev) => ({ ...prev, [group.id]: [...(prev[group.id] ?? []), member] }))
            }
          />
        </div>
      ))}

      <div className="flex items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <label className="flex flex-col text-xs text-zinc-500">
          New group name
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <button
          disabled={!newGroupName}
          onClick={async () => {
            const group = await createEquipmentGroupAction({ group_name: newGroupName });
            setLocalGroups((gs) => [...gs, group]);
            setLocalMembers((prev) => ({ ...prev, [group.id]: [] }));
            setNewGroupName("");
          }}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          + Add equipment group
        </button>
      </div>
    </div>
  );
}

function AddEquipmentGroupMemberRow({
  equipmentGroupId,
  equipmentRates,
  onAdded,
}: {
  equipmentGroupId: string;
  equipmentRates: EquipmentRate[];
  onAdded: (member: EquipmentGroupMember) => void;
}) {
  const [equipmentId, setEquipmentId] = useState("");

  return (
    <div className="mt-2 flex items-end gap-2 text-xs">
      <select
        value={equipmentId}
        onChange={(e) => setEquipmentId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Add equipment…</option>
        {equipmentRates.map((e) => (
          <option key={e.id} value={e.id}>
            {e.equipment_name}
          </option>
        ))}
      </select>
      <button
        disabled={!equipmentId}
        onClick={async () => {
          const member = await addEquipmentGroupMemberAction(equipmentGroupId, { equipment_id: equipmentId });
          onAdded(member);
          setEquipmentId("");
        }}
        className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Add member
      </button>
    </div>
  );
}
