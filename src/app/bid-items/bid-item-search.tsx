"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BidItem } from "@/types/domain";

const TYPE_LABEL: Record<BidItem["item_type"], string> = {
  unit_price: "Unit price",
  lump_sum: "Lump sum",
  sub_quote: "Sub quote",
};

export function BidItemSearch({ items }: { items: BidItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div>
      <input
        placeholder="Search bid items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {filtered.map((item) => (
          <li key={item.id}>
            <Link
              href={`/bid-items/${item.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <div>
                <div className="font-medium">{item.item_name}</div>
                {item.description && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                  {TYPE_LABEL[item.item_type]}
                </span>
                <span className="font-mono">{item.unit}</span>
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No matching bid items.
          </li>
        )}
      </ul>
    </div>
  );
}
