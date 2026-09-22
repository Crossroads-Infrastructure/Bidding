import Link from "next/link";
import { getRepository } from "@/lib/repository";

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_STYLES = {
  won: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  lost: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function BidHistoryPage() {
  const repository = getRepository();
  const projects = (await repository.listProjects()).filter(
    (p) => p.status === "won" || p.status === "lost"
  );

  const won = projects.filter((p) => p.status === "won");
  const lost = projects.filter((p) => p.status === "lost");
  const wonTotal = won.reduce((sum, p) => sum + (p.final_bid_total ?? 0), 0);
  const winRate = projects.length > 0 ? (won.length / projects.length) * 100 : null;

  const rows = [...projects].sort((a, b) => {
    const ad = a.bid_date ?? a.created_at;
    const bd = b.bid_date ?? b.created_at;
    return new Date(bd).getTime() - new Date(ad).getTime();
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bid History</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Every project marked Won or Lost, with the bid price that was quoted at the time.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Won</div>
          <div className="mt-1 text-xl font-semibold">{won.length}</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{formatCurrency(wonTotal)}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Lost</div>
          <div className="mt-1 text-xl font-semibold">{lost.length}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Win rate</div>
          <div className="mt-1 text-xl font-semibold">{winRate == null ? "—" : `${winRate.toFixed(0)}%`}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No projects marked Won or Lost yet. Set a project&apos;s status on the Estimate Builder screen once a bid
          is decided.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {rows.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                <div className="font-medium">{project.project_name}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {[project.client, project.location, project.dot_or_municipality].filter(Boolean).join(" · ") ||
                    "—"}
                  {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
                </div>
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {project.final_bid_total != null ? formatCurrency(project.final_bid_total) : "—"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[project.status as "won" | "lost"]}`}
                >
                  {project.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
