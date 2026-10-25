"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, UploadCloud } from "lucide-react";
import { Card, Select } from "@/components/ui/primitives";
import { DOC_TYPES } from "@/lib/enums";
import { formatDateTime } from "@/lib/utils";
import type { Claim, DocRow } from "@/lib/types";
import { DeleteButton, EmptyState, useWorkspaceActions } from "./shared";

const BUCKET = "claim-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmtSize = (b: number | null) => (b == null ? "—" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export function DocumentsTab({ claim, docs }: { claim: Claim; docs: DocRow[] }) {
  const act = useWorkspaceActions(claim.claim_id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  async function upload(files: FileList | File[]) {
    setBusy(true);
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        problems.push(`${file.name}: only PDF, JPG and PNG files are accepted.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: larger than 10 MB. Compress it or split it and try again.`);
        continue;
      }
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
      const path = `${claim.claim_id}/${slug(docType)}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await act.supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        problems.push(`${file.name}: ${upErr.message}`);
        continue;
      }
      const ok = await act.insert("claim_documents", {
        doc_type: docType,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (!ok) {
        await act.supabase.storage.from(BUCKET).remove([path]);
        problems.push(`${file.name}: uploaded but couldn't be recorded (${act.error ?? "unknown error"}).`);
      }
    }
    setMessages(problems);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function open(d: DocRow) {
    const w = window.open("", "_blank");
    const { data, error } = await act.supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60);
    if (error || !data) {
      w?.close();
      window.alert(`Couldn't open the file: ${error?.message ?? "no link returned"}`);
      return;
    }
    if (w) w.location.href = data.signedUrl;
  }

  async function remove(d: DocRow) {
    await act.supabase.storage.from(BUCKET).remove([d.storage_path]);
    await act.remove("claim_documents", "doc_id", d.doc_id);
  }

  return (
    <div>
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[240px] flex-col gap-1.5">
            <span className="text-sm font-medium">Document type</span>
            <Select options={DOC_TYPES} placeholder="Choose a type" value={docType} onChange={(e) => setDocType(e.target.value)} />
          </label>
          <p className="pb-2 text-sm text-muted">PDF, JPG or PNG, up to 10 MB each. Pick the type first, then add files.</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (docType && e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
          onClick={() => docType && inputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center ${
            dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-canvas"
          } ${!docType ? "pointer-events-none opacity-50" : ""}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && docType && inputRef.current?.click()}
        >
          <UploadCloud size={22} className="text-muted" aria-hidden />
          <p className="text-sm font-medium">{busy ? "Uploading…" : "Drop files here or click to choose"}</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </div>
        {messages.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {messages.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </Card>

      <Card className="mt-4 overflow-x-auto">
        {docs.length === 0 ? (
          <EmptyState title="No documents yet" hint="Upload the pre-auth letter, final bill, deduction sheet or settlement letter, and remittance advice for this claim." />
        ) : (
          <ul>
            {docs.map((d) => (
              <li key={d.doc_id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
                {d.mime_type === "application/pdf" ? <FileText size={18} className="text-muted" aria-hidden /> : <ImageIcon size={18} className="text-muted" aria-hidden />}
                <button onClick={() => open(d)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-accent hover:underline">{d.file_name}</p>
                  <p className="text-xs text-muted">{d.doc_type} · {fmtSize(d.size_bytes)} · {formatDateTime(d.uploaded_at)}</p>
                </button>
                <DeleteButton what="document" onDelete={() => remove(d)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
