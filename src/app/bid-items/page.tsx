import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { BidItemSearch } from "./bid-item-search";

export default async function BidItemLibraryPage() {
  const repository = getRepository();
  const [items, archivedItems] = await Promise.all([
    repository.listBidItems(),
    repository.listArchivedBidItems(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bid Item Library</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Recipes are entered once and reused on every future project.
          </p>
        </div>
        <Link
          href="/bid-items/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Bid Item
        </Link>
      </div>
      <BidItemSearch items={items} archivedItems={archivedItems} />
    </div>
  );
}
