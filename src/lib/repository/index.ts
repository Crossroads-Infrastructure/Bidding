import { InMemoryRepository } from "./in-memory";
import { SupabaseRepository } from "./supabase";
import type { Repository } from "./types";

export type { Repository } from "./types";
export * from "./types";

let repository: Repository | undefined;

/**
 * Returns the app-wide data repository. Uses Supabase when
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
 * otherwise falls back to a seeded in-memory store so the app runs without
 * a live database (see repository/in-memory.ts).
 */
export function getRepository(): Repository {
  if (repository) return repository;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  repository =
    url && anonKey ? new SupabaseRepository(url, anonKey) : new InMemoryRepository();

  return repository;
}

export function usingLiveSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
