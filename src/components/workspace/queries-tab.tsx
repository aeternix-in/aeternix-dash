"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, controlClass } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import {
  DOCUMENTS_ASKED, QUERY_CATEGORIES, QUERY_OUTCOMES, QUERY_STAGES, ROOT_CAUSE_OWNERS, YES_NO, YES_NO_UNCLEAR,
} from "@/lib/enums";
import { querySchema } from "@/lib/workspace-schemas";
import { toNum } from "@/lib/zod-helpers";
import { formatDateTime, formatINR, formatMinutes } from "@/lib/utils";
import type { Claim, QueryRow, StageEvent } from "@/lib/types";
import { DeleteButton, EmptyState, FormFooter, isoOrNull, td, th, useWorkspaceActions, useZodForm } from "./shared";

export function QueriesTab({ claim, queries, events }: { claim: Claim; queries: QueryRow[]; events: StageEvent[] }) {
  const [open, setOpen] = useState(false);
  const act = useWorkspaceActions(claim.claim_id);
  const avoidable = queries.filter((q) => q.avoidable === "Yes").length;
  const already = queries.filter((q) => q.already_submitted === "Yes").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {queries.length === 0
            ? "Queries raised by the insurer or TPA on this claim."
            : `${queries.length} ${queries.length === 1 ? "query" : "queries"} · ${avoidable} avoidable · ${already} already submitted`}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add query
        </Button>
      </div>

      <Card className="overflow-x-auto">
        {queries.length === 0 ? (
          <EmptyState
            title="No queries logged"
            hint="A claim with no queries counts towards the first-pass approval rate. Add each query the payer raises."
          />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={th}>Raised</th>
                <th className={th}>Stage</th>
                <th className={th}>Category</th>
                <th className={th}>Avoidable</th>
                <th className={th}>Already sent</th>
                <th className={th}>Owner</th>
                <th className={th}>Our response</th>
                <th className={th}>Outcome</th>
                <th className={`${th} text-right`}>At stake</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q.query_id} className="border-b border-line last:border-0" title={q.payer_text ?? undefined}>
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(q.raised_at)}</td>
                  <td className={td}>{q.query_stage}</td>
                  <td className={`${td} font-medium`}>{q.query_category}</td>
                  <td className={td}>
                    <Badge tone={q.avoidable === "Yes" ? "warn" : "neutral"}>{q.avoidable}</Badge>
                  </td>
                  <td className={td}>{q.already_submitted === "Yes" ? <Badge tone="accent">Payer friction</Badge> : "No"}</td>
                  <td className={td}>{q.root_cause_owner}</td>
                  <td className={td}>
                    {q.answered_at
                      ? formatMinutes(Math.round((new Date(q.answered_at).getTime() - new Date(q.raised_at).getTime()) / 60000))
                      : "—"}
                  </td>
                  <td className={td}>{q.outcome}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(q.amount_at_stake)}</td>
                  <td className={`${td} text-right`}>
                    <DeleteButton what="query" onDelete={() => act.remove("query_log", "query_id", q.query_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Add query">
        <QueryForm act={act} events={events} onSaved={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

function QueryForm({
  act, events, onSaved,
}: { act: ReturnType<typeof useWorkspaceActions>; events: StageEvent[]; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useZodForm(querySchema, { documents_asked: [] });
  const err = (n: keyof typeof errors) => errors[n]?.message as string | undefined;
  const num = (n: Parameters<typeof register>[0]) => register(n, { setValueAs: toNum });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setSaving(true);
        const ok = await act.insert("query_log", {
          ...v,
          event_id: v.event_id || null,
          raised_at: isoOrNull(v.raised_at),
          answered_at: isoOrNull(v.answered_at),
          closed_at: isoOrNull(v.closed_at),
          documents_asked: v.documents_asked?.length ? v.documents_asked : null,
        });
        setSaving(false);
        if (ok) onSaved();
      })}
      className="flex flex-col gap-4"
    >
      <Field label="Stage" error={err("query_stage")} hint="Discharge queries hold patients in beds; post-discharge queries hold cash.">
        <Select options={QUERY_STAGES} {...register("query_stage")} />
      </Field>
      <Field label="Category" error={err("query_category")}>
        <Select options={QUERY_CATEGORIES} {...register("query_category")} />
      </Field>
      <Field label="Raised at" error={err("raised_at")}>
        <Input type="datetime-local" {...register("raised_at")} />
      </Field>
      <Field label="Answered at" optional error={err("answered_at")}>
        <Input type="datetime-local" {...register("answered_at")} />
      </Field>
      <Field label="Closed at" optional error={err("closed_at")}>
        <Input type="datetime-local" {...register("closed_at")} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          Documents asked for <span className="ml-1 font-normal text-faint">optional</span>
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {DOCUMENTS_ASKED.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={d} {...register("documents_asked")} className="h-4 w-4 accent-[var(--color-accent)]" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Did we already submit what they asked for?" error={err("already_submitted")} hint="If yes, this is payer friction, not a hospital gap.">
        <Select options={YES_NO} {...register("already_submitted")} />
      </Field>
      <Field label="Who must change for this to stop recurring?" error={err("root_cause_owner")}>
        <Select options={ROOT_CAUSE_OWNERS} {...register("root_cause_owner")} />
      </Field>
      <Field label="Avoidable?" error={err("avoidable")} hint="Coded by one clinical reviewer, not the desk.">
        <Select options={YES_NO_UNCLEAR} {...register("avoidable")} />
      </Field>
      <Field label="Outcome" error={err("outcome")}>
        <Select options={QUERY_OUTCOMES} {...register("outcome")} />
      </Field>
      <Field label="Rounds of back-and-forth" optional error={err("rounds")}>
        <Input type="number" min={0} step={1} {...num("rounds")} />
      </Field>
      <Field label="Amount at stake (₹)" optional error={err("amount_at_stake")}>
        <Input type="number" min={0} step="any" {...num("amount_at_stake")} />
      </Field>
      <Field label="Linked timeline event" optional>
        <select className={controlClass} {...register("event_id")}>
          <option value="">None</option>
          {events.map((e) => (
            <option key={e.event_id} value={e.event_id}>
              {e.stage} · {formatDateTime(e.event_at)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Payer's wording" optional hint="Verbatim, for audit only.">
        <textarea rows={3} className={`${controlClass} h-auto py-2`} {...register("payer_text")} />
      </Field>
      <FormFooter error={act.error} saving={saving} label="Add query" />
    </form>
  );
}
