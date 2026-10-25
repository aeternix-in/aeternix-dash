import { Card } from "@/components/ui/primitives";
import { formatINR } from "@/lib/utils";
import { summarize } from "@/lib/finance";
import type { Claim } from "@/lib/types";

type Summary = ReturnType<typeof summarize>;

function Cell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function FinancialSummary({ claim, s }: { claim: Claim; s: Summary }) {
  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
  return (
    <Card>
      <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
        <Cell label="Final bill claimed" value={formatINR(claim.final_bill_claimed)} />
        <Cell label="Approved at discharge" value={formatINR(claim.final_approved_at_discharge)} />
        <Cell label="Paid by payer" value={s.hasPayments ? formatINR(s.payerPaid) : "—"} note={s.tds ? `includes ${formatINR(s.tds)} TDS credit` : undefined} />
        <Cell label="Collected from patient" value={formatINR(s.collected)} />
        <Cell label="Recovered in disputes" value={formatINR(s.recovered)} />
        <div className={`px-4 py-4 ${s.shortfall != null && s.shortfall > 0 ? "bg-danger-soft" : "bg-ok-soft"}`}>
          <p className="text-xs text-muted">Unrecovered shortfall</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums ${s.shortfall != null && s.shortfall > 0 ? "text-danger" : "text-ok"}`}>
            {formatINR(s.shortfall)}
          </p>
          {s.shortfall != null ? (
            <p className="mt-0.5 text-xs text-muted">
              {formatINR(s.writtenOff)} written off · {formatINR(s.outstanding)} outstanding
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">Add the final bill via Update claim</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-line px-4 py-3 text-sm text-muted">
        <span>Pre-auth under-approval <b className="font-medium text-ink">{formatINR(s.preauthUnder)}</b></span>
        <span>Post-approval cut <b className="font-medium text-ink">{formatINR(s.postApprovalCut)}</b></span>
        <span>Realization <b className="font-medium text-ink">{pct(s.realization)}</b></span>
      </div>
    </Card>
  );
}
