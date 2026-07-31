"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Project } from "@/types/domain";
import { duplicateProjectAction } from "./actions";

export function DuplicateProjectButton({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    project_name: `${project.project_name} (copy)`,
    client: project.client ?? "",
    location: project.location ?? "",
    dot_or_municipality: project.dot_or_municipality ?? "",
    bid_date: "",
  });

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Duplicate
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const newProject = await duplicateProjectAction(project.id, {
            project_name: form.project_name,
            client: form.client || null,
            location: form.location || null,
            dot_or_municipality: form.dot_or_municipality || null,
            bid_date: form.bid_date || null,
          });
          setPending(false);
          setOpen(false);
          router.push(`/projects/${newProject.id}`);
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Duplicate &ldquo;{project.project_name}&rdquo;
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Line items and their customizations carry over, repriced at today&apos;s current rates. Vendor
          quotes, item numbers, and rounded rates reset -- this is a fresh proposal, not a snapshot.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Project name
          <input
            required
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={form.project_name}
            onChange={(e) => setForm({ ...form, project_name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Client
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Location / State
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          DOT / Municipality
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={form.dot_or_municipality}
            onChange={(e) => setForm({ ...form, dot_or_municipality: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bid date
          <input
            type="date"
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            value={form.bid_date}
            onChange={(e) => setForm({ ...form, bid_date: e.target.value })}
          />
        </label>
        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Duplicating…" : "Duplicate project"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
