"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import {
  APPROVER_ROLES, DISPUTE_LEVELS, DISPUTE_OUTCOMES, MATCH_STATUSES, TXN_TYPES, WRITEOFF_REASONS,
} from "@/lib/enums";
import { settlementSchema } from "@/lib/workspace-schemas";
import { toNum } from "@/lib/zod-helpers";
import { daysBetween, formatDate, formatINR } from "@/lib/utils";
import type { Claim, TxnRow } from "@/lib/types";
import { DeleteButton, EmptyState, FormFooter, td, th, useWorkspaceActions, useZodForm } from "./shared";

export function SettlementTab({ claim, txns }: { claim: Claim; txns: TxnRow[] }) {
  const [open, setOpen] = useState(false);
  const act = useWorkspaceActions(claim.claim_id);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Every movement of money after discharge: payments, collections, recoveries and write-offs.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add transaction
        </Button>
      </div>

      <Card className="overflow-x-auto">
        {txns.length === 0 ? (
          <EmptyState
            title="No money movements yet"
            hint="Add each payer payment from the remittance advice, each patient collection from the receipts, and any write-off from the register."
          />
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={th}>Date</th>
                <th className={th}>Type</th>
                <th className={`${th} text-right`}>Gross</th>
                <th className={`${th} text-right`}>TDS</th>
                <th className={`${th} text-right`}>Net received</th>
                <th className={th}>UTR</th>
                <th className={th}>Match</th>
                <th className={th}>Last document to payment</th>
                <th className={th}>Detail</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.txn_id} className="border-b border-line last:border-0">
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(t.payment_at)}</td>
                  <td className={`${td} font-medium`}>{t.txn_type}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(t.amount_gross)}</td>
                  <td className={`${td} text-right tabular-nums text-muted`}>{formatINR(t.tds)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(t.amount_net_received)}</td>
                  <td className={`${td} text-muted`}>{t.utr ?? "—"}</td>
                  <td className={td}>
                    <Badge tone={t.match_status === "Unmatched" ? "danger" : "neutral"}>{t.match_status}</Badge>
                  </td>
                  <td className={td}>
                    {t.days_last_doc_to_payment != null ? (
                      <span className="inline-flex items-center gap-2">
                        {t.days_last_doc_to_payment} days
                        {t.days_last_doc_to_payment > 30 && <Badge tone="danger">Over 30</Badge>}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${td} text-muted`}>
                    {[t.dispute_level, t.dispute_outcome, t.writeoff_reason].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className={`${td} text-right`}>
                    <DeleteButton what="transaction" onDelete={() => act.remove("settlement_txns", "txn_id", t.txn_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        TDS is a tax credit, not a loss. Over-30-day payments are escalation evidence, not money owed: whether the hospital can claim penal interest depends on its agreement with the payer.
      </p>

      <Drawer open={open} onClose={() => setOpen(false)} title="Add transaction">
        <SettlementForm act={act} onSaved={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

function SettlementForm({ act, onSaved }: { act: ReturnType<typeof useWorkspaceActions>; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors, dirtyFields } } = useZodForm(settlementSchema);
  const err = (n: keyof typeof errors) => errors[n]?.message as string | undefined;
  const num = (n: Parameters<typeof register>[0]) => register(n, { setValueAs: toNum });

  const type = watch("txn_type");
  const gross = toNum(watch("amount_gross"));
  const tds = toNum(watch("tds"));
  useEffect(() => {
    if (!dirtyFields.amount_net_received && gross != null) setValue("amount_net_received", gross - (tds ?? 0));
  }, [gross, tds, dirtyFields.amount_net_received, setValue]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setSaving(true);
        const isPayer = v.txn_type === "Payer payment";
        const ok = await act.insert("settlement_txns", {
          ...v,
          tds: isPayer ? v.tds : null,
          last_document_sent_at: isPayer ? v.last_document_sent_at : null,
          days_last_doc_to_payment:
            isPayer && v.last_document_sent_at ? daysBetween(v.last_document_sent_at, v.payment_at) : null,
          dispute_level: v.txn_type === "Dispute recovery" ? v.dispute_level : null,
          dispute_outcome: v.txn_type === "Dispute recovery" ? v.dispute_outcome : null,
          writeoff_reason: v.txn_type === "Write-off" ? v.writeoff_reason : null,
          approved_by_role: v.txn_type === "Write-off" ? v.approved_by_role : null,
        });
        setSaving(false);
        if (ok) onSaved();
      })}
      className="flex flex-col gap-4"
    >
      <Field label="Type" error={err("txn_type")}>
        <Select options={TXN_TYPES} {...register("txn_type")} />
      </Field>
      <Field label="Date" error={err("payment_at")}>
        <Input type="date" {...register("payment_at")} />
      </Field>
      <Field label="Gross amount (₹)" error={err("amount_gross")} hint={type === "Payer payment" ? "Including TDS." : undefined}>
        <Input type="number" min={0} step="any" {...num("amount_gross")} />
      </Field>
      {type === "Payer payment" && (
        <Field label="TDS (₹)" error={err("tds")} hint="A tax credit, not leakage.">
          <Input type="number" min={0} step="any" {...num("tds")} />
        </Field>
      )}
      <Field label="Net received (₹)" error={err("amount_net_received")} hint="Filled in as gross minus TDS; change it if the bank credit differs.">
        <Input type="number" min={0} step="any" {...num("amount_net_received")} />
      </Field>
      {type === "Payer payment" && (
        <>
          <Field label="Last necessary document sent on" error={err("last_document_sent_at")} hint="Starts the 30-day settlement clock.">
            <Input type="date" {...register("last_document_sent_at")} />
          </Field>
          <Field label="Settlement letter received on" optional>
            <Input type="date" {...register("settlement_letter_at")} />
          </Field>
        </>
      )}
      {type === "Dispute recovery" && (
        <>
          <Field label="Dispute level" optional>
            <Select options={DISPUTE_LEVELS} {...register("dispute_level")} />
          </Field>
          <Field label="Dispute outcome" error={err("dispute_outcome")}>
            <Select options={DISPUTE_OUTCOMES} {...register("dispute_outcome")} />
          </Field>
        </>
      )}
      {type === "Write-off" && (
        <>
          <Field label="Write-off reason" error={err("writeoff_reason")}>
            <Select options={WRITEOFF_REASONS} {...register("writeoff_reason")} />
          </Field>
          <Field label="Approved by" optional hint="A role, never a name.">
            <Select options={APPROVER_ROLES} {...register("approved_by_role")} />
          </Field>
        </>
      )}
      <Field label="Bank reference (UTR)" optional hint="Never enter bank account numbers.">
        <Input {...register("utr")} />
      </Field>
      <Field label="Bulk payment reference" optional hint="One bank credit often covers many claims.">
        <Input {...register("bulk_payment_ref")} />
      </Field>
      <Field label="Match status" error={err("match_status")} hint="Unmatched means cash arrived but the claim still shows unpaid.">
        <Select options={MATCH_STATUSES} {...register("match_status")} />
      </Field>
      <FormFooter error={act.error} saving={saving} label="Add transaction" />
    </form>
  );
}
