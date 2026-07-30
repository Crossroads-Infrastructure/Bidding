"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectAction } from "./actions";

export function NewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    client: "",
    location: "",
    dot_or_municipality: "",
    bid_date: "",
    default_profit_pct: "10",
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        + New Project
      </button>
    );
  }

  return (
    <form
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const project = await createProjectAction({
          project_name: form.project_name,
          client: form.client || null,
          location: form.location || null,
          dot_or_municipality: form.dot_or_municipality || null,
          bid_date: form.bid_date || null,
          default_profit_pct: Number(form.default_profit_pct) / 100,
        });
        setPending(false);
        setOpen(false);
        router.push(`/projects/${project.id}`);
      }}
    >
      <label className="flex flex-col gap-1 text-sm sm:col-span-2 md:col-span-1">
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
      <label className="flex flex-col gap-1 text-sm">
        Starting profit % <span className="text-xs font-normal text-zinc-500">(set live on Review)</span>
        <input
          type="number"
          step="0.1"
          className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
          value={form.default_profit_pct}
          onChange={(e) => setForm({ ...form, default_profit_pct: e.target.value })}
        />
      </label>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2 md:col-span-3">
        Overhead and contingency come from the company-wide Rate Library defaults automatically.
      </p>
      <div className="flex gap-2 sm:col-span-2 md:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Creating…" : "Create project"}
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
  );
}
