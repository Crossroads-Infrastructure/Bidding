import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server Component / Server Action / Route Handler client. Reads and
// writes the session via Next.js's cookies() API so auth state stays in
// sync across requests (see the proxy, which does the same on every
// request to keep tokens refreshed).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies can't
            // be written -- the proxy's updateSession call covers the
            // refresh in that case instead.
          }
        },
      },
    }
  );
}
