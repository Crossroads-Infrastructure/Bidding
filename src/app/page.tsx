import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { NewProjectForm } from "./new-project-form";
import type { ProjectStatus } from "@/types/domain";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  estimating: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  lost: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function DashboardPage() {
  const repository = getRepository();
  const projects = await repository.listProjects();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Grading, paving, and drainage bid estimates.
          </p>
        </div>
        <NewProjectForm />
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No projects yet. Create one to start an estimate.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div>
                  <div className="font-medium">{project.project_name}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {[project.client, project.location, project.dot_or_municipality]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {project.bid_date ? ` · Bid ${project.bid_date}` : ""}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[project.status]}`}
                >
                  {project.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
