"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { CLAIM_STATUSES } from "@/lib/enums";
import { claimUpdateSchema } from "@/lib/workspace-schemas";
import { toNum } from "@/lib/zod-helpers";
import { formatINR } from "@/lib/utils";
import type { Claim } from "@/lib/types";
import { FormFooter, isoOrNull, useWorkspaceActions, useZodForm } from "./shared";

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function EditClaim({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const act = useWorkspaceActions(claim.claim_id);
  const { register, handleSubmit, watch, formState: { errors } } = useZodForm(claimUpdateSchema, {
    discharge_at: localInput(claim.discharge_at),
    claim_status: claim.claim_status as never,
    final_bill_gross: claim.final_bill_gross ?? undefined,
    hospital_discount: claim.hospital_discount ?? undefined,
    final_approved_at_discharge: claim.final_approved_at_discharge ?? undefined,
  });
  const err = (n: keyof typeof errors) => errors[n]?.message as string | undefined;
  const num = (n: Parameters<typeof register>[0]) => register(n, { setValueAs: toNum });
  const gross = toNum(watch("final_bill_gross"));
  const disc = toNum(watch("hospital_discount"));

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden /> Update claim
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Update claim">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (v) => {
            setSaving(true);
            const ok = await act.update("claims", "claim_id", claim.claim_id, {
              discharge_at: isoOrNull(v.discharge_at),
              claim_status: v.claim_status,
              final_bill_gross: v.final_bill_gross,
              hospital_discount: v.hospital_discount,
              final_bill_claimed: v.final_bill_gross != null ? v.final_bill_gross - (v.hospital_discount ?? 0) : null,
              final_approved_at_discharge: v.final_approved_at_discharge,
            });
            setSaving(false);
            if (ok) setOpen(false);
          })}
        >
          <Field label="Status" error={err("claim_status")}>
            <Select options={CLAIM_STATUSES} {...register("claim_status")} />
          </Field>
          <Field label="Discharged on" optional error={err("discharge_at")}>
            <Input type="datetime-local" {...register("discharge_at")} />
          </Field>
          <Field label="Final bill, gross (₹)" optional error={err("final_bill_gross")}>
            <Input type="number" min={0} step="any" {...num("final_bill_gross")} />
          </Field>
          <Field label="Hospital discount (₹)" optional error={err("hospital_discount")} hint="Agreed discounts aren't leakage.">
            <Input type="number" min={0} step="any" {...num("hospital_discount")} />
          </Field>
          <Field label="Final bill claimed (₹)" hint="Gross minus discount.">
            <Input readOnly disabled value={gross != null ? formatINR(gross - (disc ?? 0)) : ""} />
          </Field>
          <Field label="Approved at discharge (₹)" optional error={err("final_approved_at_discharge")} hint="The baseline for any cut made after discharge.">
            <Input type="number" min={0} step="any" {...num("final_approved_at_discharge")} />
          </Field>
          <FormFooter error={act.error} saving={saving} label="Save changes" />
        </form>
      </Drawer>
    </>
  );
}
