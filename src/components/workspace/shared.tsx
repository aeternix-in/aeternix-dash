"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { syncClaimTotals } from "@/lib/sync";
import { Button } from "@/components/ui/primitives";

export function useZodForm<S extends z.ZodTypeAny>(schema: S, defaults?: Partial<z.input<S>>) {
  return useForm<z.input<S>>({
    resolver: zodResolver(schema) as unknown as Resolver<z.input<S>>,
    mode: "onTouched",
    defaultValues: defaults as DefaultValues<z.input<S>>,
  });
}

/** "" and undefined become null so Postgres gets clean values. */
export function clean(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" || v === undefined ? null : v]));
}

export const isoOrNull = (s?: string | null) => (s ? new Date(s).toISOString() : null);

export function useWorkspaceActions(claimId: string) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);

  async function afterWrite(table: string) {
    if (table === "stage_log" || table === "settlement_txns") await syncClaimTotals(supabase, claimId);
    router.refresh();
  }

  async function insert(table: string, row: Record<string, unknown>) {
    setError(null);
    const { error } = await supabase.from(table).insert({ ...clean(row), claim_id: claimId });
    if (error) {
      setError(error.message);
      return false;
    }
    await afterWrite(table);
    return true;
  }

  async function update(table: string, keyCol: string, id: string, patch: Record<string, unknown>) {
    setError(null);
    const { error } = await supabase.from(table).update(clean(patch)).eq(keyCol, id);
    if (error) {
      setError(error.message);
      return false;
    }
    await afterWrite(table);
    return true;
  }

  async function remove(table: string, keyCol: string, id: string) {
    const { error } = await supabase.from(table).delete().eq(keyCol, id);
    if (error) {
      window.alert(`Couldn't delete: ${error.message}`);
      return false;
    }
    await afterWrite(table);
    return true;
  }

  return { supabase, router, error, setError, insert, update, remove };
}

export function FormFooter({ error, saving, label = "Save" }: { error: string | null; saving: boolean; label?: string }) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      {error && <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : label}
      </Button>
    </div>
  );
}

export function DeleteButton({ onDelete, what }: { onDelete: () => void; what: string }) {
  return (
    <button
      onClick={() => window.confirm(`Delete this ${what}? This can't be undone.`) && onDelete()}
      className="rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger"
      aria-label={`Delete ${what}`}
      title={`Delete ${what}`}
    >
      <Trash2 size={15} />
    </button>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const th = "px-4 py-3 text-left font-medium";
export const td = "px-4 py-3 align-top";
