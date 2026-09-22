# Heavy Highway Estimator

A web app for DOT roadway (grading, paving, drainage) bid estimating: reusable
bid item "recipes" (labor + equipment + material costs), versioned rate
history, project-level markup with per-item override, and a live-calculating
Estimate Builder.

## Stack

- Next.js (App Router, TypeScript) + Tailwind
- Supabase (Postgres) for persistence — schema in `supabase/migrations/`
- Vitest for the calc engine

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. **No Supabase project is required to try the
app** — without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
set, it runs on a seeded in-memory store (`src/lib/repository/in-memory.ts`)
with sample crew/equipment/material rates and a handful of grading/paving/
drainage bid items.

To connect a real Supabase project: create one, run the SQL in
`supabase/migrations/0001_initial_schema.sql` against it, then copy
`.env.local.example` to `.env.local` and fill in the URL/anon key.

## Authentication

Once `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the
whole app is gated behind login (Supabase Auth — email/password). There's no
public sign-up; add each team member yourself in the Supabase dashboard under
**Authentication → Users → Add user** (set an email + password, no email
confirmation needed for an internal tool like this). Remove a user there to
revoke their access. Without those env vars set (local demo mode), auth is
skipped entirely.

## Tests

```bash
npm test
```

Covers the calc engine: material quantity formulas (fixed ratio, dimensional
CY/TON, liquid application), rate-fluidity resolution (current rate by name,
not a pinned row id), and the overhead/profit/contingency override hierarchy.

## Layout

- `src/lib/calc-engine.ts` — pure cost/markup calculations, no I/O
- `src/lib/repository/` — data access; `Repository` interface with
  `InMemoryRepository` and `SupabaseRepository` implementations
- `src/app/` — screens: Dashboard, Rate Library, Bid Item Library, and the
  Estimate Builder (`projects/[id]`)

## Not yet built

Quick Quote mode and the Excel import script — next up per the build order.
