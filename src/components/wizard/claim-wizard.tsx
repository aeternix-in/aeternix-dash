"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hashUhid } from "@/lib/hash";
import { cn, formatINR } from "@/lib/utils";
import {
  ADMISSION_TYPES, AGE_BANDS, BILLING_MODES, CLAIM_STATUSES, CONSUMABLES_COVER, DEPARTMENTS,
  INSURERS, PAYER_CHANNELS, POLICY_TYPES, ROOM_CATEGORIES, SUBMISSION_CHANNELS, TARIFF_BASES, TPAS,
} from "@/lib/enums";
import {
  claimFormSchema, STEP_FIELDS, STEP_TITLES, type ClaimFormValues,
} from "@/lib/schemas";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";

const DRAFT_KEY = "aeternix:claim-draft:v1";

const toNum = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));

export function ClaimWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const {
    register, handleSubmit, trigger, watch, reset, setValue, getValues,
    formState: { errors },
  } = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema) as unknown as Resolver<ClaimFormValues>,
    mode: "onTouched",
    defaultValues: { claim_status: "Open" },
  });

  const num = (name: keyof ClaimFormValues) => register(name, { setValueAs: toNum });
  const err = (name: keyof ClaimFormValues) => (errors[name]?.message as string | undefined);

  // Restore an unfinished draft. The raw UHID is never written to storage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        reset({ claim_status: "Open", ...JSON.parse(raw) });
        setRestored(true);
      }
    } catch {
      /* storage unavailable: ignore */
    }
  }, [reset]);

  useEffect(() => {
    const sub = watch((values) => {
      try {
        const { uhid_raw, ...safe } = values;
        void uhid_raw;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
      } catch {
        /* ignore */
      }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const payerChannel = watch("payer_channel");
  const viaTpa = payerChannel === "Insurer via TPA";
  useEffect(() => {
    if (payerChannel && !viaTpa) setValue("tpa", "");
  }, [payerChannel, viaTpa, setValue]);

  const gross = toNum(watch("final_bill_gross"));
  const discount = toNum(watch("hospital_discount"));
  const claimed = gross != null ? gross - (discount ?? 0) : undefined;

  async function next() {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1);
  }

  function onInvalid(errs: FieldErrors<ClaimFormValues>) {
    const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]));
    if (bad >= 0) setStep(bad);
  }

  async function onSubmit(values: ClaimFormValues) {
    setSaving(true);
    setSubmitError(null);
    try {
      const out = claimFormSchema.parse(values);
      const { uhid_raw, ...rest } = out;
      const iso = (s?: string) => (s ? new Date(s).toISOString() : null);
      const payload = Object.fromEntries(
        Object.entries({
          ...rest,
          uhid_hash: await hashUhid(uhid_raw),
          admission_at: iso(out.admission_at),
          discharge_at: iso(out.discharge_at),
          tpa: viaTpa ? out.tpa : null,
          final_bill_claimed: out.final_bill_gross != null ? out.final_bill_gross - (out.hospital_discount ?? 0) : null,
        }).map(([k, v]) => [k, v === "" || v === undefined ? null : v])
      );

      const { data, error } = await createClient().from("claims").insert(payload).select("claim_id").single();
      if (error) throw new Error(error.message);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      router.push(`/claims/${data.claim_id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong while saving.");
      setSaving(false);
    }
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    reset({ claim_status: "Open" });
    setRestored(false);
    setStep(0);
  }

  const v = getValues();
  const policyOptErr = STEP_FIELDS[2].slice(7).some((f) => errors[f]);
  const finalOptErr = ["final_bill_gross", "hospital_discount", "final_approved_at_discharge"].some(
    (f) => errors[f as keyof ClaimFormValues]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
        {STEP_TITLES.map((title, i) => (
          <li key={title} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                i < step && "bg-accent text-white",
                i === step && "border-2 border-accent text-accent",
                i > step && "border border-line-strong text-faint"
              )}
            >
              {i < step ? <Check size={13} aria-hidden /> : i + 1}
            </span>
            <span className={cn(i === step ? "font-medium text-ink" : "text-muted")}>{title}</span>
          </li>
        ))}
      </ol>

      {restored && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-accent-soft px-4 py-2.5 text-sm text-accent">
          <span>Restored your unfinished draft. Re-enter the UHID, which is never saved.</span>
          <button type="button" onClick={discardDraft} className="font-medium underline">
            Discard draft
          </button>
        </div>
      )}

      <Card className="p-6">
        {step === 0 && (
          <Section title="Admission" blurb="Who was admitted, when, and under which department.">
            <Field label="UHID" error={err("uhid_raw")} hint="Hashed in your browser. The raw UHID is never sent or stored.">
              <Input autoComplete="off" aria-invalid={!!err("uhid_raw")} {...register("uhid_raw")} />
            </Field>
            <Field label="Admission type" error={err("admission_type")}>
              <Select options={ADMISSION_TYPES} {...register("admission_type")} />
            </Field>
            <Field label="Admitted on" error={err("admission_at")}>
              <Input type="datetime-local" {...register("admission_at")} />
            </Field>
            <Field label="Discharged on" optional error={err("discharge_at")} hint="Leave blank if still admitted.">
              <Input type="datetime-local" {...register("discharge_at")} />
            </Field>
            <Field label="Department" error={err("department")}>
              <Select options={DEPARTMENTS} {...register("department")} />
            </Field>
            <Field label="Age band" optional error={err("age_band")}>
              <Select options={AGE_BANDS} {...register("age_band")} />
            </Field>
          </Section>
        )}

        {step === 1 && (
          <Section title="Clinical and room" blurb="Diagnosis, procedure and the room the patient occupied.">
            <Field label="Primary diagnosis (ICD-10)" error={err("primary_diagnosis_icd10")} hint="For example H25.1">
              <Input autoComplete="off" {...register("primary_diagnosis_icd10")} />
            </Field>
            <Field label="Procedure or package code" error={err("procedure_code")}>
              <Input autoComplete="off" {...register("procedure_code")} />
            </Field>
            <Field label="Billing mode" error={err("billing_mode")}>
              <Select options={BILLING_MODES} {...register("billing_mode")} />
            </Field>
            <Field label="Treating doctor code" optional error={err("treating_doctor_code")} hint="Pseudonymous code, never a name.">
              <Input autoComplete="off" {...register("treating_doctor_code")} />
            </Field>
            <Field label="Room category occupied" error={err("room_category_occupied")}>
              <Select options={ROOM_CATEGORIES} {...register("room_category_occupied")} />
            </Field>
            <Field label="Room rent charged per day (₹)" error={err("room_rent_charged_per_day")} hint="Enter 0 for day care.">
              <Input type="number" min={0} step="any" inputMode="decimal" {...num("room_rent_charged_per_day")} />
            </Field>
            <Field label="Room days" optional error={err("room_days")}>
              <Input type="number" min={0} step="0.5" {...num("room_days")} />
            </Field>
            <Field label="ICU days" optional error={err("icu_days")}>
              <Input type="number" min={0} step="0.5" {...num("icu_days")} />
            </Field>
          </Section>
        )}

        {step === 2 && (
          <>
            <Section title="Payer and policy" blurb="Who pays and on what terms.">
              <Field label="Payer channel" error={err("payer_channel")}>
                <Select options={PAYER_CHANNELS} {...register("payer_channel")} />
              </Field>
              <Field label="Insurer" error={err("insurer")}>
                <Select options={INSURERS} {...register("insurer")} />
              </Field>
              <Field label="TPA" error={err("tpa")} hint={viaTpa ? undefined : "Only needed when the channel is Insurer via TPA."}>
                <Select options={TPAS} disabled={!viaTpa} {...register("tpa")} />
              </Field>
              <Field label="Policy type" error={err("policy_type")}>
                <Select options={POLICY_TYPES} {...register("policy_type")} />
              </Field>
              <Field label="Tariff basis" error={err("tariff_basis")}>
                <Select options={TARIFF_BASES} {...register("tariff_basis")} />
              </Field>
              <Field label="Submission channel" error={err("submission_channel")}>
                <Select options={SUBMISSION_CHANNELS} {...register("submission_channel")} />
              </Field>
              <Field label="Room rent limit per day" error={err("room_rent_limit_per_day")} hint="As stated in the policy: an amount or a % of sum insured.">
                <Input autoComplete="off" {...register("room_rent_limit_per_day")} />
              </Field>
            </Section>
            <details open={policyOptErr || undefined} className="mt-6 border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">More policy details (optional)</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Sum insured balance (₹)" optional error={err("sum_insured_balance")}>
                  <Input type="number" min={0} step="any" {...num("sum_insured_balance")} />
                </Field>
                <Field label="Co-pay (%)" optional error={err("copay_pct")}>
                  <Input type="number" min={0} max={100} step="any" {...num("copay_pct")} />
                </Field>
                <Field label="Deductible (₹)" optional error={err("deductible_amount")}>
                  <Input type="number" min={0} step="any" {...num("deductible_amount")} />
                </Field>
                <Field label="Disease sub-limit (₹)" optional error={err("disease_sublimit_amount")}>
                  <Input type="number" min={0} step="any" {...num("disease_sublimit_amount")} />
                </Field>
                <Field label="Sub-limit applies to" optional error={err("disease_sublimit_condition")} hint="For example cataract, per eye.">
                  <Input {...register("disease_sublimit_condition")} />
                </Field>
                <Field label="Consumables cover" optional error={err("consumables_cover")}>
                  <Select options={CONSUMABLES_COVER} {...register("consumables_cover")} />
                </Field>
                <Field label="Years of continuous cover" optional error={err("policy_years_continuous")}>
                  <Input type="number" min={0} step="0.5" {...num("policy_years_continuous")} />
                </Field>
              </div>
            </details>
          </>
        )}

        {step === 3 && (
          <>
            <Section title="Money at pre-auth" blurb="The estimate and what the payer approved first.">
              <Field label="Estimate given at admission (₹)" error={err("estimate_at_admission")}>
                <Input type="number" min={0} step="any" inputMode="decimal" {...num("estimate_at_admission")} />
              </Field>
              <Field label="Pre-auth requested (₹)" error={err("preauth_requested")}>
                <Input type="number" min={0} step="any" inputMode="decimal" {...num("preauth_requested")} />
              </Field>
              <Field label="Initial approval (₹)" error={err("preauth_approved_initial")} hint="Enter 0 if the payer hasn't decided yet.">
                <Input type="number" min={0} step="any" inputMode="decimal" {...num("preauth_approved_initial")} />
              </Field>
            </Section>
            <details open={finalOptErr || undefined} className="mt-6 border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">
                Already discharged or settled? Add final figures (optional)
              </summary>
              <p className="mt-2 text-sm text-muted">
                Useful when entering historical claims. Payments and deductions go in the claim workspace.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Final bill, gross (₹)" optional error={err("final_bill_gross")}>
                  <Input type="number" min={0} step="any" {...num("final_bill_gross")} />
                </Field>
                <Field label="Hospital discount (₹)" optional error={err("hospital_discount")} hint="Agreed discounts aren't leakage.">
                  <Input type="number" min={0} step="any" {...num("hospital_discount")} />
                </Field>
                <Field label="Final bill claimed (₹)" hint="Gross minus discount.">
                  <Input readOnly disabled value={claimed != null ? formatINR(claimed) : ""} />
                </Field>
                <Field label="Approved at discharge (₹)" optional error={err("final_approved_at_discharge")}>
                  <Input type="number" min={0} step="any" {...num("final_approved_at_discharge")} />
                </Field>
                <Field label="Claim status" error={err("claim_status")}>
                  <Select options={CLAIM_STATUSES} {...register("claim_status")} />
                </Field>
              </div>
            </details>
          </>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Review</h2>
            <p className="mt-1 text-sm text-muted">Check the details, then create the claim. You can edit most fields later.</p>
            <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row k="UHID" v={v.uhid_raw ? "•••" + String(v.uhid_raw).slice(-3) + " (will be hashed)" : "—"} />
              <Row k="Admission type" v={v.admission_type} />
              <Row k="Admitted" v={v.admission_at && new Date(v.admission_at).toLocaleString("en-IN")} />
              <Row k="Discharged" v={v.discharge_at && new Date(v.discharge_at).toLocaleString("en-IN")} />
              <Row k="Department" v={v.department} />
              <Row k="Diagnosis" v={v.primary_diagnosis_icd10?.toUpperCase()} />
              <Row k="Procedure" v={v.procedure_code} />
              <Row k="Billing mode" v={v.billing_mode} />
              <Row k="Room" v={v.room_category_occupied && `${v.room_category_occupied}, ${formatINR(v.room_rent_charged_per_day)}/day`} />
              <Row k="Payer" v={[v.insurer, viaTpa && v.tpa ? `via ${v.tpa}` : null].filter(Boolean).join(" ")} />
              <Row k="Channel" v={v.payer_channel} />
              <Row k="Policy" v={[v.policy_type, v.tariff_basis].filter(Boolean).join(" · ")} />
              <Row k="Room rent limit" v={v.room_rent_limit_per_day} />
              <Row k="Estimate" v={formatINR(v.estimate_at_admission)} />
              <Row k="Pre-auth requested" v={formatINR(v.preauth_requested)} />
              <Row k="Initial approval" v={formatINR(v.preauth_approved_initial)} />
              {claimed != null && <Row k="Final bill claimed" v={formatINR(claimed)} />}
              <Row k="Status" v={v.claim_status} />
            </dl>
            {submitError && <p className="mt-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{submitError}</p>}
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || saving}>
          Back
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create claim"}
          </Button>
        )}
      </div>
    </form>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
