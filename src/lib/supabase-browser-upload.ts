"use client";

import { createClient } from "@supabase/supabase-js";

// Server Actions (and Vercel's serverless functions underneath them)
// enforce request body limits far below what a real plan set PDF needs --
// routing the file itself through the Next.js server doesn't scale for
// document uploads. Uploading straight from the browser to Supabase
// Storage is the standard pattern for this: the file never touches our
// server at all, only its resulting metadata does (see
// recordProjectDocumentAction). Falls back to the server-routed path in
// demo mode, where there's no real Supabase project to upload to.

const DOCUMENTS_BUCKET = "project-documents";

export function canUploadDirect(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function uploadFileDirect(file: File, pathPrefix: string): Promise<{ url: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase isn't configured -- can't upload directly.");

  const client = createClient(url, anonKey);
  const path = `${pathPrefix}/${Date.now()}-${file.name}`;
  const { error } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
