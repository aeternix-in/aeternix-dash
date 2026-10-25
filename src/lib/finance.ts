import type { Claim, StageEvent, TxnRow } from "./types";

const n = (v: unknown) => (v == null ? 0 : Number(v));
const sum = (rows: TxnRow[], type: string, key: "amount_gross" | "tds" = "amount_gross") =>
  rows.filter((r) => r.txn_type === type).reduce((a, r) => a + n(r[key]), 0);

/** Every money figure in the workspace summary, computed from the rows. */
export function summarize(claim: Claim, txns: TxnRow[]) {
  const payerPaid = sum(txns, "Payer payment") - sum(txns, "Reversal");
  const tds = sum(txns, "Payer payment", "tds");
  const collected = sum(txns, "Patient collection");
  const recovered = sum(txns, "Dispute recovery");
  const writtenOff = sum(txns, "Write-off");
  const claimed = claim.final_bill_claimed;

  const shortfall = claimed == null ? null : claimed - payerPaid - collected - recovered;
  return {
    payerPaid,
    tds,
    collected,
    recovered,
    writtenOff,
    claimed,
    shortfall,
    outstanding: shortfall == null ? null : shortfall - writtenOff,
    realization: claimed ? (payerPaid + collected + recovered) / claimed : null,
    preauthUnder: n(claim.preauth_requested) - n(claim.preauth_approved_initial),
    postApprovalCut:
      claim.final_approved_at_discharge == null ? null : n(claim.final_approved_at_discharge) - payerPaid,
    hasPayments: txns.length > 0,
  };
}

// ── Stage clocks ──
export const REQUEST_FOR: Record<string, { request: string; slaMin: number | null }> = {
  "Pre-auth decision": { request: "Pre-auth sent", slaMin: 60 },
  "Enhancement decision": { request: "Enhancement sent", slaMin: null },
  "Final auth decision": { request: "Final auth sent", slaMin: 180 },
};
export const REQUEST_STAGES = Object.values(REQUEST_FOR).map((v) => v.request);
export const DECISION_STAGES = Object.keys(REQUEST_FOR);

/** Stages that originate from the payer, used to pre-fill direction. */
export const PAYER_STAGES = [
  ...DECISION_STAGES,
  "Documents acknowledged",
  "Settlement letter received",
  "Payment received",
];

/** For each decision event: minutes since the latest earlier matching request, and SLA breach. */
export function computeClocks(events: Pick<StageEvent, "event_id" | "stage" | "event_at">[]) {
  return events
    .filter((e) => REQUEST_FOR[e.stage])
    .map((e) => {
      const { request, slaMin } = REQUEST_FOR[e.stage];
      const t = new Date(e.event_at).getTime();
      const prior = events
        .filter((r) => r.stage === request && new Date(r.event_at).getTime() <= t)
        .map((r) => new Date(r.event_at).getTime())
        .sort((a, b) => b - a)[0];
      const minutes = prior == null ? null : Math.round((t - prior) / 60000);
      const breached = minutes == null || slaMin == null ? null : minutes > slaMin;
      return { event_id: e.event_id, minutes, breached };
    });
}
