"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, controlClass } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import {
  ATTRIBUTIONS, BILL_HEADS, DEDUCTION_REASONS, DETECTED_AT, RECOVERABLE_FROM, RULE_CHECKS,
} from "@/lib/enums";
import { deductionSchema, suggestRuleCheck } from "@/lib/workspace-schemas";
import { toNum } from "@/lib/zod-helpers";
import { formatINR } from "@/lib/utils";
import type { Claim, DeductionRow } from "@/lib/types";
import { DeleteButton, EmptyState, FormFooter, td, th, useWorkspaceActions, useZodForm } from "./shared";

export function DeductionsTab({ claim, lines }: { claim: Claim; lines: DeductionRow[] }) {
  const [open, setOpen] = useState(false);
  const act = useWorkspaceActions(claim.claim_id);

  const total = lines.reduce((a, l) => a + Number(l.amount_deducted), 0);
  const flagged = lines.filter((l) => l.rule_check !== "OK").reduce((a, l) => a + Number(l.amount_deducted), 0);
  const hospitalSide = lines
    .filter((l) => l.attribution === "Hospital billing error" || l.attribution === "Hospital documentation gap")
    .reduce((a, l) => a + Number(l.amount_deducted), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Every bill item the payer cut, coded by reason and who can fix it.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add deduction
        </Button>
      </div>

      {lines.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Total deducted" value={formatINR(total)} />
          <Stat label="Flagged by rule check" value={formatINR(flagged)} note="Possibly recoverable by dispute" />
          <Stat label="Hospital-side causes" value={formatINR(hospitalSide)} note="Billing errors and documentation gaps" />
        </div>
      )}

      <Card className="overflow-x-auto">
        {lines.length === 0 ? (
          <EmptyState
            title="No deductions logged"
            hint="Copy each cut from the TPA's deduction sheet or settlement letter, one line per bill item."
          />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={th}>Bill head</th>
                <th className={th}>Item</th>
                <th className={`${th} text-right`}>Billed</th>
                <th className={`${th} text-right`}>Deducted</th>
                <th className={th}>Reason</th>
                <th className={th}>Attribution</th>
                <th className={th}>Rule check</th>
                <th className={th}>Recoverable from</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.line_id} className="border-b border-line last:border-0" title={l.payer_text ?? undefined}>
                  <td className={`${td} font-medium`}>{l.bill_head}</td>
                  <td className={`${td} text-muted`}>{l.item_description ?? "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(l.amount_billed)}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{formatINR(l.amount_deducted)}</td>
                  <td className={td}>
                    {l.deduction_reason}
                    <div className="text-xs text-muted">Clause: {l.policy_clause_cited}</div>
                  </td>
                  <td className={td}>{l.attribution}</td>
                  <td className={td}>
                    <Badge tone={l.rule_check === "OK" ? "neutral" : "warn"}>{l.rule_check}</Badge>
                  </td>
                  <td className={td}>{l.recoverable_from}</td>
                  <td className={`${td} text-right`}>
                    <DeleteButton what="deduction" onDelete={() => act.remove("deduction_lines", "line_id", l.line_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Add deduction">
        <DeductionForm claim={claim} act={act} onSaved={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </Card>
  );
}

function DeductionForm({
  claim, act, onSaved,
}: { claim: Claim; act: ReturnType<typeof useWorkspaceActions>; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors, dirtyFields } } = useZodForm(deductionSchema, {
    rule_check: "OK",
    recovered_amount: 0,
  });
  const err = (n: keyof typeof errors) => errors[n]?.message as string | undefined;
  const num = (n: Parameters<typeof register>[0]) => register(n, { setValueAs: toNum });

  const [head, reason, clause] = watch(["bill_head", "deduction_reason", "policy_clause_cited"]);
  const suggestion = suggestRuleCheck({ bill_head: head, deduction_reason: reason, policy_clause_cited: clause }, claim.consumables_cover);
  useEffect(() => {
    if (!dirtyFields.rule_check) setValue("rule_check", suggestion);
  }, [suggestion, dirtyFields.rule_check, setValue]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setSaving(true);
        const ok = await act.insert("deduction_lines", { ...v, recovered_amount: v.recovered_amount ?? 0 });
        setSaving(false);
        if (ok) onSaved();
      })}
      className="flex flex-col gap-4"
    >
      <Field label="Cut made at" error={err("detected_at")} hint="Cuts after final approval are the ones patients blame on the hospital.">
        <Select options={DETECTED_AT} {...register("detected_at")} />
      </Field>
      <Field label="Bill head" error={err("bill_head")}>
        <Select options={BILL_HEADS} {...register("bill_head")} />
      </Field>
      <Field label="Item description" optional hint="As on the deduction sheet.">
        <Input {...register("item_description")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount billed (₹)" error={err("amount_billed")}>
          <Input type="number" min={0} step="any" {...num("amount_billed")} />
        </Field>
        <Field label="Amount deducted (₹)" error={err("amount_deducted")}>
          <Input type="number" min={0} step="any" {...num("amount_deducted")} />
        </Field>
      </div>
      <Field label="Reason (coded)" error={err("deduction_reason")}>
        <Select options={DEDUCTION_REASONS} {...register("deduction_reason")} />
      </Field>
      <Field label="Policy clause cited" error={err("policy_clause_cited")} hint="Type None if the payer cited no clause. A cut with no clause is itself a flag.">
        <Input {...register("policy_clause_cited")} />
      </Field>
      <Field label="Attribution" error={err("attribution")} hint="Decides whether the rupee is fixable, and by whom. Agree this with the clinical reviewer.">
        <Select options={ATTRIBUTIONS} {...register("attribution")} />
      </Field>
      <Field
        label="Rule check"
        error={err("rule_check")}
        hint={suggestion !== "OK" ? `Suggested from the details above: ${suggestion}.` : "Filled in automatically; change it if the facts say otherwise."}
      >
        <Select options={RULE_CHECKS} {...register("rule_check")} />
      </Field>
      <Field label="Recoverable from" error={err("recoverable_from")}>
        <Select options={RECOVERABLE_FROM} {...register("recoverable_from")} />
      </Field>
      <Field label="Recovered so far (₹)" optional error={err("recovered_amount")}>
        <Input type="number" min={0} step="any" {...num("recovered_amount")} />
      </Field>
      <Field label="Payer's wording" optional hint="Verbatim, for audit only.">
        <textarea rows={3} className={`${controlClass} h-auto py-2`} {...register("payer_text")} />
      </Field>
      <FormFooter error={act.error} saving={saving} label="Add deduction" />
    </form>
  );
}
