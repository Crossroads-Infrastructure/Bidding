import { getRepository } from "@/lib/repository";
import { NewProjectForm } from "./new-project-form";
import { ProjectList } from "./project-list";

export default async function DashboardPage() {
  const repository = getRepository();
  const [projects, archivedProjects] = await Promise.all([
    repository.listProjects(),
    repository.listArchivedProjects(),
  ]);

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

      <ProjectList projects={projects} archivedProjects={archivedProjects} />
    </div>
  );
}
