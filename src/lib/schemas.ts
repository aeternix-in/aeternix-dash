import { z } from "zod";
import {
  ADMISSION_TYPES, AGE_BANDS, BILLING_MODES, CONSUMABLES_COVER, DEPARTMENTS,
  PAYER_CHANNELS, POLICY_TYPES, ROOM_CATEGORIES, SUBMISSION_CHANNELS, TARIFF_BASES,
  CLAIM_STATUSES,
} from "./enums";

// An untouched optional dropdown submits "" — treat that as "not provided".
const optEnum = <T extends readonly [string, ...string[]]>(list: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(list).optional());

const req = (msg: string) => z.string({ required_error: msg }).min(1, msg);
const oneOf = <T extends readonly [string, ...string[]]>(list: T, msg: string) =>
  z.enum(list, { errorMap: () => ({ message: msg }) });

// Empty inputs arrive as "" or NaN; treat them as "not provided".
const money = (msg: string) =>
  z.number({ required_error: msg, invalid_type_error: msg }).min(0, "Cannot be negative");
const optMoney = z.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").optional();
const optDays = z.number({ invalid_type_error: "Enter a number" }).min(0).max(365).optional();

export const claimFormSchema = z
  .object({
    // Step 1 – admission
    uhid_raw: req("Enter the UHID"),
    admission_type: oneOf(ADMISSION_TYPES, "Choose planned or emergency"),
    admission_at: req("Enter the admission date and time"),
    discharge_at: z.string().optional(),
    department: oneOf(DEPARTMENTS, "Choose a department"),
    age_band: optEnum(AGE_BANDS),

    // Step 2 – clinical and room
    primary_diagnosis_icd10: req("Enter the ICD-10 code")
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(v), "Use an ICD-10 code such as H25.1"),
    procedure_code: req("Enter the package or procedure code"),
    billing_mode: oneOf(BILLING_MODES, "Choose package or open billing"),
    treating_doctor_code: z.string().optional(),
    room_category_occupied: oneOf(ROOM_CATEGORIES, "Choose a room category"),
    room_rent_charged_per_day: money("Enter the room rent per day (0 for day care)"),
    room_days: optDays,
    icu_days: optDays,

    // Step 3 – payer and policy
    payer_channel: oneOf(PAYER_CHANNELS, "Choose a payer channel"),
    insurer: req("Choose an insurer"),
    tpa: z.string().optional(),
    policy_type: oneOf(POLICY_TYPES, "Choose a policy type"),
    tariff_basis: oneOf(TARIFF_BASES, "Choose a tariff basis"),
    submission_channel: oneOf(SUBMISSION_CHANNELS, "Choose a submission channel"),
    room_rent_limit_per_day: req("Enter the limit as stated, e.g. 5000 or 1% of SI"),
    sum_insured_balance: optMoney,
    copay_pct: z.number({ invalid_type_error: "Enter a number" }).min(0).max(100).optional(),
    deductible_amount: optMoney,
    disease_sublimit_amount: optMoney,
    disease_sublimit_condition: z.string().optional(),
    consumables_cover: optEnum(CONSUMABLES_COVER),
    policy_years_continuous: optDays,

    // Step 4 – money
    estimate_at_admission: money("Enter the estimate given at admission"),
    preauth_requested: money("Enter the amount requested in pre-auth"),
    preauth_approved_initial: money("Enter the initial approval (0 if none yet)"),
    final_bill_gross: optMoney,
    hospital_discount: optMoney,
    final_approved_at_discharge: optMoney,
    claim_status: z.enum(CLAIM_STATUSES).default("Open"),
  })
  .superRefine((v, ctx) => {
    if (v.discharge_at && v.admission_at && new Date(v.discharge_at) < new Date(v.admission_at)) {
      ctx.addIssue({ code: "custom", path: ["discharge_at"], message: "Discharge cannot be before admission" });
    }
    if (v.payer_channel === "Insurer via TPA" && !v.tpa) {
      ctx.addIssue({ code: "custom", path: ["tpa"], message: "Choose the TPA for this channel" });
    }
    if (v.preauth_approved_initial > v.preauth_requested) {
      ctx.addIssue({
        code: "custom",
        path: ["preauth_approved_initial"],
        message: "Initial approval cannot exceed the amount requested",
      });
    }
    if (v.icu_days != null && v.room_days != null && v.icu_days > v.room_days) {
      ctx.addIssue({ code: "custom", path: ["icu_days"], message: "ICU days cannot exceed total room days" });
    }
    if (v.hospital_discount != null && v.final_bill_gross != null && v.hospital_discount > v.final_bill_gross) {
      ctx.addIssue({ code: "custom", path: ["hospital_discount"], message: "Discount cannot exceed the gross bill" });
    }
  });

export type ClaimFormValues = z.input<typeof claimFormSchema>;
export type ClaimFormOutput = z.output<typeof claimFormSchema>;

/** Fields validated when the user presses Next on each step. */
export const STEP_FIELDS: (keyof ClaimFormValues)[][] = [
  ["uhid_raw", "admission_type", "admission_at", "discharge_at", "department", "age_band"],
  ["primary_diagnosis_icd10", "procedure_code", "billing_mode", "treating_doctor_code",
   "room_category_occupied", "room_rent_charged_per_day", "room_days", "icu_days"],
  ["payer_channel", "insurer", "tpa", "policy_type", "tariff_basis", "submission_channel",
   "room_rent_limit_per_day", "sum_insured_balance", "copay_pct", "deductible_amount",
   "disease_sublimit_amount", "disease_sublimit_condition", "consumables_cover", "policy_years_continuous"],
  ["estimate_at_admission", "preauth_requested", "preauth_approved_initial", "final_bill_gross",
   "hospital_discount", "final_approved_at_discharge", "claim_status"],
];

export const STEP_TITLES = ["Admission", "Clinical and room", "Payer and policy", "Money", "Review"];
