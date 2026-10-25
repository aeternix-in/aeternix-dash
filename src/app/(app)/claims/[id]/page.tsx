import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, statusTone } from "@/components/ui/primitives";
import { FinancialSummary } from "@/components/workspace/summary";
import { Workspace } from "@/components/workspace/workspace";
import { EditClaim } from "@/components/workspace/edit-claim";
import { summarize } from "@/lib/finance";
import { formatDate, formatINR } from "@/lib/utils";
import type { Claim, DeductionRow, DocRow, QueryRow, StageEvent, TxnRow } from "@/lib/types";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claim } = await supabase.from("claims").select("*").eq("claim_id", id).maybeSingle();
  if (!claim) notFound();

  const [events, queries, deductions, txns, docs] = await Promise.all([
    supabase.from("stage_log").select("*").eq("claim_id", id).order("event_at"),
    supabase.from("query_log").select("*").eq("claim_id", id).order("raised_at"),
    supabase.from("deduction_lines").select("*").eq("claim_id", id).order("created_at"),
    supabase.from("settlement_txns").select("*").eq("claim_id", id).order("payment_at"),
    supabase.from("claim_documents").select("*").eq("claim_id", id).order("uploaded_at", { ascending: false }),
  ]);

  const c = claim as Claim;
  const s = summarize(c, (txns.data ?? []) as TxnRow[]);

  const details: [string, string][] = [
    ["Admitted", formatDate(c.admission_at)],
    ["Discharged", formatDate(c.discharge_at)],
    ["Admission type", c.admission_type],
    ["Department", c.department],
    ["Diagnosis", c.primary_diagnosis_icd10],
    ["Procedure", c.procedure_code],
    ["Billing mode", c.billing_mode],
    ["Room", `${c.room_category_occupied}, ${formatINR(c.room_rent_charged_per_day)}/day`],
    ["Payer channel", c.payer_channel],
    ["Policy", `${c.policy_type} · ${c.tariff_basis}`],
    ["Room rent limit", c.room_rent_limit_per_day],
    ["Consumables cover", c.consumables_cover ?? "—"],
    ["Estimate at admission", formatINR(c.estimate_at_admission)],
    ["Pre-auth requested / initial approval", `${formatINR(c.preauth_requested)} / ${formatINR(c.preauth_approved_initial)}`],
    ["Enhancements approved", formatINR(c.enhancement_approved_total)],
  ];

  return (
    <div>
      <Link href="/claims" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> All claims
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.claim_id}</h1>
          <Badge tone={statusTone(c.claim_status)}>{c.claim_status}</Badge>
          <span className="text-sm text-muted">
            {c.insurer}
            {c.tpa && ` via ${c.tpa}`} · {c.department}
          </span>
        </div>
        <EditClaim claim={c} />
      </div>

      <div className="mt-5">
        <FinancialSummary claim={c} s={s} />
      </div>

      <details className="mt-4 rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-accent">Claim details</summary>
        <dl className="grid gap-x-8 gap-y-3 px-4 pb-4 sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line pb-2 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </details>

      <Workspace
        claim={c}
        events={(events.data ?? []) as StageEvent[]}
        queries={(queries.data ?? []) as QueryRow[]}
        deductions={(deductions.data ?? []) as DeductionRow[]}
        txns={(txns.data ?? []) as TxnRow[]}
        docs={(docs.data ?? []) as DocRow[]}
      />
    </div>
  );
}
