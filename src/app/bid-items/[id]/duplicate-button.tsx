"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duplicateBidItemAction } from "../../actions";

export function DuplicateButton({
  bidItemId,
  defaultName,
}: {
  bidItemId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      disabled={pending}
      onClick={async () => {
        const name = window.prompt("Name for the duplicated bid item:", defaultName);
        if (!name) return;
        setPending(true);
        const copy = await duplicateBidItemAction(bidItemId, name);
        setPending(false);
        router.push(`/bid-items/${copy.item.id}`);
      }}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {pending ? "Duplicating…" : "Duplicate & Modify"}
    </button>
  );
}
