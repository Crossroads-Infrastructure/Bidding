import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Renamed from `middleware.ts` in this Next.js version -- see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Runs on every request (Server Function/Action POSTs included, since they
// hit the same route as the page), so this is also what protects Server
// Actions from being called while logged out, not just page loads.
export async function proxy(request: NextRequest) {
  // No Supabase project configured -> local demo mode, no login to enforce.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
