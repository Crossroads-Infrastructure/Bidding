"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { BidItem } from "@/types/domain";
import {
  archiveBidItemAction,
  deleteBidItemPermanentlyAction,
  restoreBidItemAction,
} from "../actions";

const TYPE_LABEL: Record<BidItem["item_type"], string> = {
  unit_price: "Unit price",
  lump_sum: "Lump sum",
  sub_quote: "Sub quote",
};

export function BidItemSearch({
  items,
  archivedItems,
}: {
  items: BidItem[];
  archivedItems: BidItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = view === "active" ? items : archivedItems;
    if (!q) return source;
    return source.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)
    );
  }, [items, archivedItems, view, query]);

  return (
    <div>
      <div className="mb-3 flex gap-1 text-xs">
        {(["active", "archived"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 font-medium capitalize ${
              view === v
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {v === "archived" ? `Archived (${archivedItems.length})` : "Active"}
          </button>
        ))}
      </div>
      <input
        placeholder="Search bid items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
      {deleteError && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {deleteError}
        </p>
      )}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {filtered.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <Link href={`/bid-items/${item.id}`} className="min-w-0 flex-1">
              <div className="font-medium">{item.item_name}</div>
              {item.description && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</div>
              )}
            </Link>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                {TYPE_LABEL[item.item_type]}
              </span>
              <span className="font-mono">{item.unit}</span>
              {view === "active" ? (
                <button
                  onClick={async () => {
                    await archiveBidItemAction(item.id);
                    router.refresh();
                  }}
                  className="font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Archive
                </button>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      await restoreBidItemAction(item.id);
                      router.refresh();
                    }}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Restore
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Permanently delete this bid item? This cannot be undone.")) return;
                      setDeleteError(null);
                      try {
                        await deleteBidItemPermanentlyAction(item.id);
                        router.refresh();
                      } catch (e) {
                        setDeleteError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete Permanently
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {view === "active" ? "No matching bid items." : "Nothing archived."}
          </li>
        )}
      </ul>
    </div>
  );
}
