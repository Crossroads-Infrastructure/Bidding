"use client";

import { useRef, useState } from "react";
import type { DocumentCategory, ProjectDocument } from "@/types/domain";
import { addProjectDocumentAction, removeProjectDocumentAction } from "../../actions";

const CATEGORIES: DocumentCategory[] = ["Plans", "Proposal", "Addenda", "Other"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({
  projectId,
  initialDocuments,
}: {
  projectId: string;
  initialDocuments: ProjectDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [category, setCategory] = useState<DocumentCategory>("Plans");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("project_id", projectId);
    formData.set("category", category);
    formData.set("file", file);
    const doc = await addProjectDocumentAction(formData);
    setDocuments((docs) => [doc, ...docs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
  }

  async function handleRemove(id: string) {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    await removeProjectDocumentAction(id, projectId);
  }

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Documents
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-zinc-500">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          File
          <input ref={fileInputRef} type="file" className="text-sm" />
        </label>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {CATEGORIES.map((cat) => {
        const inCategory = documents.filter((d) => d.category === cat);
        if (inCategory.length === 0) return null;
        return (
          <div key={cat} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {cat}
            </h3>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {inCategory.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-1.5 text-sm">
                  <a
                    href={doc.file_url}
                    download={doc.file_name}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {doc.file_name}
                  </a>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{formatSize(doc.file_size)}</span>
                    <button
                      onClick={() => handleRemove(doc.id)}
                      className="font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {documents.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No documents attached yet.</p>
      )}
    </div>
  );
}
