"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Project, ProjectStatus } from "@/types/domain";
import { archiveProjectAction, deleteProjectPermanentlyAction, restoreProjectAction } from "./actions";
import { DuplicateProjectButton } from "./duplicate-project-button";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  estimating: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  lost: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export function ProjectList({
  projects,
  archivedProjects,
}: {
  projects: Project[];
  archivedProjects: Project[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"active" | "archived">("active");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = view === "active" ? projects : archivedProjects;

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
            {v === "archived" ? `Archived (${archivedProjects.length})` : "Active"}
          </button>
        ))}
      </div>

      {deleteError && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {deleteError}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {view === "active" ? "No projects yet. Create one to start an estimate." : "Nothing archived."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {rows.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              {view === "active" ? (
                <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <div className="font-medium">{project.project_name}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {[project.client, project.location, project.dot_or_municipality]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
                  </div>
                </Link>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{project.project_name}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {[project.client, project.location, project.dot_or_municipality]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                {view === "active" ? (
                  <>
                    <DuplicateProjectButton project={project} />
                    <button
                      onClick={async () => {
                        await archiveProjectAction(project.id);
                        router.refresh();
                      }}
                      className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        await restoreProjectAction(project.id);
                        router.refresh();
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Restore
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Permanently delete "${project.project_name}"? This cannot be undone.`))
                          return;
                        setDeleteError(null);
                        try {
                          await deleteProjectPermanentlyAction(project.id);
                          router.refresh();
                        } catch (e) {
                          setDeleteError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete Permanently
                    </button>
                  </>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[project.status]}`}
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
