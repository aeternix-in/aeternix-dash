"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { CHANNELS, DECISIONS, DIRECTIONS, STAFF_ROLES, STAGES, YES_NO } from "@/lib/enums";
import { DECISION_STAGES, PAYER_STAGES, REQUEST_STAGES } from "@/lib/finance";
import { stageSchema } from "@/lib/workspace-schemas";
import { toNum } from "@/lib/zod-helpers";
import { formatDateTime, formatINR, formatMinutes } from "@/lib/utils";
import type { Claim, StageEvent } from "@/lib/types";
import { DeleteButton, EmptyState, FormFooter, isoOrNull, td, th, useWorkspaceActions, useZodForm } from "./shared";

export function TimelineTab({ claim, events }: { claim: Claim; events: StageEvent[] }) {
  const [open, setOpen] = useState(false);
  const act = useWorkspaceActions(claim.claim_id);

  const last = (stage: string) => [...events].reverse().find((e) => e.stage === stage);
  const preauth = last("Pre-auth decision");
  const finalAuth = last("Final auth decision");
  const advised = last("Discharge advised by doctor");
  const finalSent = advised
    ? events.find((e) => e.stage === "Final auth sent" && new Date(e.event_at) >= new Date(advised.event_at))
    : undefined;
  const hospitalDelay = advised && finalSent
    ? Math.round((new Date(finalSent.event_at).getTime() - new Date(advised.event_at).getTime()) / 60000)
    : null;

  const insights = [
    preauth && { label: "Pre-auth turnaround", value: formatMinutes(preauth.minutes_since_request), bad: preauth.sla_breached, note: "limit 60 min" },
    finalAuth && { label: "Final-auth turnaround", value: formatMinutes(finalAuth.minutes_since_request), bad: finalAuth.sla_breached, note: "limit 180 min" },
    hospitalDelay != null && { label: "Hospital-side delay before final auth was sent", value: formatMinutes(hospitalDelay), bad: null, note: "the payer clock hasn't started yet" },
  ].filter(Boolean) as { label: string; value: string; bad: boolean | null; note: string }[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Each step of the workflow, to the minute.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add event
        </Button>
      </div>

      {insights.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {insights.map((i) => (
            <Card key={i.label} className="p-4">
              <p className="text-xs text-muted">{i.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{i.value}</p>
              <p className={`text-xs ${i.bad ? "text-danger" : "text-muted"}`}>{i.bad ? `Over the ${i.note}` : i.note}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-x-auto">
        {events.length === 0 ? (
          <EmptyState
            title="No events yet"
            hint="Start with Pre-auth sent, then add each decision, enhancement and the discharge steps as they happen."
          />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={th}>When</th>
                <th className={th}>Stage</th>
                <th className={th}>Direction</th>
                <th className={th}>Decision</th>
                <th className={`${th} text-right`}>Requested</th>
                <th className={`${th} text-right`}>Approved</th>
                <th className={th}>Turnaround</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-b border-line last:border-0">
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(e.event_at)}</td>
                  <td className={`${td} font-medium`}>
                    {e.stage}
                    {e.patient_waiting && <span className="ml-2"><Badge tone="warn">Patient waiting</Badge></span>}
                  </td>
                  <td className={`${td} text-muted`}>{e.direction ?? "—"}</td>
                  <td className={td}>{e.decision ?? "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(e.amount_requested)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(e.amount_approved)}</td>
                  <td className={td}>
                    {e.minutes_since_request != null ? (
                      <span className="inline-flex items-center gap-2">
                        {formatMinutes(e.minutes_since_request)}
                        {e.sla_breached != null && (
                          <Badge tone={e.sla_breached ? "danger" : "ok"}>{e.sla_breached ? "Over limit" : "Within limit"}</Badge>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <DeleteButton what="event" onDelete={() => act.remove("stage_log", "event_id", e.event_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Add timeline event">
        <StageForm act={act} onSaved={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

function StageForm({ act, onSaved }: { act: ReturnType<typeof useWorkspaceActions>; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useZodForm(stageSchema);
  const stage = watch("stage");
  const err = (n: keyof typeof errors) => errors[n]?.message as string | undefined;
  const num = (n: Parameters<typeof register>[0]) => register(n, { setValueAs: toNum });

  useEffect(() => {
    if (stage) setValue("direction", PAYER_STAGES.includes(stage) ? "Payer → hospital" : "Hospital → payer");
  }, [stage, setValue]);

  const isRequest = REQUEST_STAGES.includes(stage as string);
  const isDecision = DECISION_STAGES.includes(stage as string);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setSaving(true);
        const ok = await act.insert("stage_log", {
          ...v,
          event_at: isoOrNull(v.event_at),
          patient_waiting: v.patient_waiting ? v.patient_waiting === "Yes" : null,
        });
        setSaving(false);
        if (ok) onSaved();
      })}
      className="flex flex-col gap-4"
    >
      <Field label="Stage" error={err("stage")}>
        <Select options={STAGES} {...register("stage")} />
      </Field>
      <Field label="When" error={err("event_at")} hint="To the minute. The 1-hour and 3-hour rules are measured in minutes.">
        <Input type="datetime-local" {...register("event_at")} />
      </Field>
      <Field label="Direction" error={err("direction")}>
        <Select options={DIRECTIONS} {...register("direction")} />
      </Field>
      {isRequest && (
        <Field label="Amount requested (₹)" error={err("amount_requested")}>
          <Input type="number" min={0} step="any" {...num("amount_requested")} />
        </Field>
      )}
      {isDecision && (
        <>
          <Field label="Decision" error={err("decision")}>
            <Select options={DECISIONS} {...register("decision")} />
          </Field>
          <Field
            label="Amount approved (₹)"
            error={err("amount_approved")}
            hint={stage === "Enhancement decision" ? "The additional amount approved in this decision." : undefined}
          >
            <Input type="number" min={0} step="any" {...num("amount_approved")} />
          </Field>
        </>
      )}
      <Field label="Channel" optional>
        <Select options={CHANNELS} {...register("channel")} />
      </Field>
      <Field label="Payer reference" optional hint="Auth or claim control number.">
        <Input {...register("payer_reference")} />
      </Field>
      <Field label="Handled by" optional hint="A role, never a name.">
        <Select options={STAFF_ROLES} {...register("staff_role")} />
      </Field>
      <Field label="Was a patient physically waiting?" optional>
        <Select options={YES_NO} {...register("patient_waiting")} />
      </Field>
      {isDecision && (
        <Field label="Delay charges raised (₹)" optional error={err("delay_charges_raised")} hint="Charges for payer-caused delay past 3 hours.">
          <Input type="number" min={0} step="any" {...num("delay_charges_raised")} />
        </Field>
      )}
      <FormFooter error={act.error} saving={saving} label="Add event" />
    </form>
  );
}
