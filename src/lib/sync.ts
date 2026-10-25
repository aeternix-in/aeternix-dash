import type { SupabaseClient } from "@supabase/supabase-js";
import { computeClocks, summarize } from "./finance";
import type { Claim, StageEvent, TxnRow } from "./types";

/**
 * Keeps the derived columns in step with the logs:
 *  - minutes_since_request / sla_breached on decision events (stage_log)
 *  - enhancement_approved_total, settled_by_payer_gross, tds, collected_from_patient (claims)
 * Called after every insert or delete on stage_log and settlement_txns.
 */
export async function syncClaimTotals(supabase: SupabaseClient, claimId: string) {
  const [{ data: events }, { data: txns }, { data: claim }] = await Promise.all([
    supabase.from("stage_log").select("*").eq("claim_id", claimId),
    supabase.from("settlement_txns").select("*").eq("claim_id", claimId),
    supabase.from("claims").select("*").eq("claim_id", claimId).single(),
  ]);
  if (!claim) return;
  const ev = (events ?? []) as StageEvent[];
  const tx = (txns ?? []) as TxnRow[];

  for (const c of computeClocks(ev)) {
    const cur = ev.find((e) => e.event_id === c.event_id);
    if (cur && (cur.minutes_since_request !== c.minutes || cur.sla_breached !== c.breached)) {
      await supabase
        .from("stage_log")
        .update({ minutes_since_request: c.minutes, sla_breached: c.breached })
        .eq("event_id", c.event_id);
    }
  }

  const enh = ev.filter((e) => e.stage === "Enhancement decision" && e.amount_approved != null);
  const s = summarize(claim as Claim, tx);
  await supabase
    .from("claims")
    .update({
      enhancement_approved_total: enh.length ? enh.reduce((a, e) => a + Number(e.amount_approved), 0) : null,
      settled_by_payer_gross: tx.some((t) => t.txn_type === "Payer payment" || t.txn_type === "Reversal") ? s.payerPaid : null,
      tds: tx.some((t) => t.txn_type === "Payer payment") ? s.tds : null,
      collected_from_patient: tx.some((t) => t.txn_type === "Patient collection") ? s.collected : null,
    })
    .eq("claim_id", claimId);
}
