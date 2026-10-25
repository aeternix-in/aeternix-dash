import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, statusTone } from "@/components/ui/primitives";
import { CLAIM_STATUSES, INSURERS } from "@/lib/enums";
import { formatDate, formatINR } from "@/lib/utils";

type SearchParams = Promise<{ status?: string; insurer?: string; q?: string }>;

export default async function ClaimsPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, insurer, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("claims")
    .select(
      "claim_id, admission_at, department, insurer, tpa, payer_channel, preauth_requested, preauth_approved_initial, claim_status",
      { count: "exact" }
    )
    .order("admission_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("claim_status", status);
  if (insurer) query = query.eq("insurer", insurer);
  if (q) query = query.ilike("claim_id", `%${q.trim()}%`);

  const { data: claims, count, error } = await query;
  const filtered = Boolean(status || insurer || q);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <p className="mt-1 text-sm text-muted">
            {count ?? 0} {filtered ? "matching " : ""}cashless {count === 1 ? "claim" : "claims"}
          </p>
        </div>
        <Link
          href="/claims/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Plus size={16} aria-hidden /> New claim
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search claim ID"
          className="h-9 w-48 rounded-md border border-line-strong bg-surface px-3 text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm">
          <option value="">All statuses</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="insurer" defaultValue={insurer ?? ""} className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm">
          <option value="">All insurers</option>
          {INSURERS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="h-9 rounded-md border border-line-strong bg-surface px-4 text-sm hover:bg-canvas">Apply</button>
        {filtered && (
          <Link href="/claims" className="inline-flex h-9 items-center px-2 text-sm text-muted hover:text-ink">
            Clear filters
          </Link>
        )}
      </form>

      {error && (
        <p className="mt-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&apos;t load claims: {error.message}. Check that the migration has been run and your .env.local keys are correct.
        </p>
      )}

      <Card className="mt-6 overflow-x-auto">
        {claims && claims.length > 0 ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Claim</th>
                <th className="px-4 py-3 font-medium">Admitted</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Payer</th>
                <th className="px-4 py-3 text-right font-medium">Pre-auth requested</th>
                <th className="px-4 py-3 text-right font-medium">Initial approval</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.claim_id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/claims/${c.claim_id}`} className="text-accent hover:underline">
                      {c.claim_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.admission_at)}</td>
                  <td className="px-4 py-3">{c.department}</td>
                  <td className="px-4 py-3">
                    {c.insurer}
                    {c.tpa && <span className="text-muted"> via {c.tpa}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(c.preauth_requested)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(c.preauth_approved_initial)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(c.claim_status)}>{c.claim_status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="font-medium">{filtered ? "No claims match these filters" : "No claims yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {filtered ? "Clear the filters or try a different search." : "Add the first cashless admission to start tracking."}
            </p>
            {!filtered && (
              <Link
                href="/claims/new"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
              >
                <Plus size={16} aria-hidden /> New claim
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
