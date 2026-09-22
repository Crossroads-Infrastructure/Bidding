"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoFocus
          className="mt-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          className="mt-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
