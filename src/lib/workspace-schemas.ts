import { z } from "zod";
import {
  APPROVER_ROLES, ATTRIBUTIONS, BILL_HEADS, CHANNELS, CLAIM_STATUSES, DECISIONS, DEDUCTION_REASONS,
  DETECTED_AT, DIRECTIONS, DISPUTE_LEVELS, DISPUTE_OUTCOMES, MATCH_STATUSES, QUERY_CATEGORIES,
  QUERY_OUTCOMES, QUERY_STAGES, RECOVERABLE_FROM, ROOT_CAUSE_OWNERS, RULE_CHECKS, STAFF_ROLES,
  STAGES, TXN_TYPES, WRITEOFF_REASONS, YES_NO, YES_NO_UNCLEAR,
} from "./enums";
import { DECISION_STAGES, REQUEST_STAGES } from "./finance";
import { money, oneOf, optEnum, optInt, optMoney, optText, req } from "./zod-helpers";

export const stageSchema = z
  .object({
    stage: oneOf(STAGES, "Choose the stage"),
    event_at: req("Enter the date and time, to the minute"),
    direction: oneOf(DIRECTIONS, "Choose who sent it"),
    channel: optEnum(CHANNELS),
    payer_reference: optText,
    amount_requested: optMoney,
    amount_approved: optMoney,
    decision: optEnum(DECISIONS),
    staff_role: optEnum(STAFF_ROLES),
    patient_waiting: optEnum(YES_NO),
    delay_charges_raised: optMoney,
  })
  .superRefine((v, ctx) => {
    if (REQUEST_STAGES.includes(v.stage) && v.amount_requested == null)
      ctx.addIssue({ code: "custom", path: ["amount_requested"], message: "Enter the amount requested" });
    if (DECISION_STAGES.includes(v.stage)) {
      if (v.amount_approved == null)
        ctx.addIssue({ code: "custom", path: ["amount_approved"], message: "Enter the amount approved (0 if none)" });
      if (!v.decision) ctx.addIssue({ code: "custom", path: ["decision"], message: "Choose the decision" });
    }
  });

export const querySchema = z
  .object({
    event_id: optText,
    query_stage: oneOf(QUERY_STAGES, "Choose the stage"),
    raised_at: req("Enter when the query was raised"),
    answered_at: optText,
    closed_at: optText,
    query_category: oneOf(QUERY_CATEGORIES, "Choose a category"),
    documents_asked: z.array(z.string()).optional(),
    already_submitted: oneOf(YES_NO, "Say whether it was already submitted"),
    rounds: optInt,
    root_cause_owner: oneOf(ROOT_CAUSE_OWNERS, "Choose who must change"),
    avoidable: oneOf(YES_NO_UNCLEAR, "Choose yes, no or unclear"),
    amount_at_stake: optMoney,
    outcome: oneOf(QUERY_OUTCOMES, "Choose the outcome"),
    payer_text: optText,
  })
  .superRefine((v, ctx) => {
    const t = (s?: string) => (s ? new Date(s).getTime() : null);
    if (t(v.answered_at) && t(v.answered_at)! < t(v.raised_at)!)
      ctx.addIssue({ code: "custom", path: ["answered_at"], message: "Answer cannot be before the query" });
    if (t(v.closed_at) && t(v.answered_at) && t(v.closed_at)! < t(v.answered_at)!)
      ctx.addIssue({ code: "custom", path: ["closed_at"], message: "Closure cannot be before the answer" });
  });

export const deductionSchema = z
  .object({
    detected_at: oneOf(DETECTED_AT, "Choose when the cut was made"),
    bill_head: oneOf(BILL_HEADS, "Choose the bill head"),
    item_description: optText,
    amount_billed: money("Enter the amount billed"),
    amount_deducted: money("Enter the amount deducted"),
    deduction_reason: oneOf(DEDUCTION_REASONS, "Choose the coded reason"),
    policy_clause_cited: req("Enter the clause, or None"),
    attribution: oneOf(ATTRIBUTIONS, "Choose an attribution"),
    rule_check: oneOf(RULE_CHECKS, "Choose a rule check"),
    recoverable_from: oneOf(RECOVERABLE_FROM, "Choose who it is recoverable from"),
    recovered_amount: optMoney,
    payer_text: optText,
  })
  .superRefine((v, ctx) => {
    if (v.amount_deducted > v.amount_billed)
      ctx.addIssue({ code: "custom", path: ["amount_deducted"], message: "Cannot exceed the amount billed" });
  });

export const settlementSchema = z
  .object({
    txn_type: oneOf(TXN_TYPES, "Choose the type"),
    payment_at: req("Enter the date"),
    amount_gross: money("Enter the gross amount"),
    tds: optMoney,
    amount_net_received: money("Enter the net amount received"),
    utr: optText,
    bulk_payment_ref: optText,
    match_status: oneOf(MATCH_STATUSES, "Choose a match status"),
    last_document_sent_at: optText,
    settlement_letter_at: optText,
    dispute_level: optEnum(DISPUTE_LEVELS),
    dispute_outcome: optEnum(DISPUTE_OUTCOMES),
    writeoff_reason: optEnum(WRITEOFF_REASONS),
    approved_by_role: optEnum(APPROVER_ROLES),
  })
  .superRefine((v, ctx) => {
    if (v.txn_type === "Payer payment") {
      if (!v.last_document_sent_at)
        ctx.addIssue({ code: "custom", path: ["last_document_sent_at"], message: "Needed to start the 30-day clock" });
      if (v.tds == null) ctx.addIssue({ code: "custom", path: ["tds"], message: "Enter TDS (0 if none)" });
      if (v.last_document_sent_at && v.payment_at && v.payment_at < v.last_document_sent_at)
        ctx.addIssue({ code: "custom", path: ["payment_at"], message: "Payment cannot be before the last document was sent" });
    }
    if (v.txn_type === "Write-off" && !v.writeoff_reason)
      ctx.addIssue({ code: "custom", path: ["writeoff_reason"], message: "Say why it was written off" });
    if (v.txn_type === "Dispute recovery" && !v.dispute_outcome)
      ctx.addIssue({ code: "custom", path: ["dispute_outcome"], message: "Choose the dispute outcome" });
  });

export const claimUpdateSchema = z
  .object({
    discharge_at: optText,
    claim_status: oneOf(CLAIM_STATUSES, "Choose a status"),
    final_bill_gross: optMoney,
    hospital_discount: optMoney,
    final_approved_at_discharge: optMoney,
  })
  .superRefine((v, ctx) => {
    if (v.hospital_discount != null && v.final_bill_gross != null && v.hospital_discount > v.final_bill_gross)
      ctx.addIssue({ code: "custom", path: ["hospital_discount"], message: "Discount cannot exceed the gross bill" });
  });

/** Suggest the rule_check value from the deduction's facts. */
export function suggestRuleCheck(
  v: { bill_head?: string; deduction_reason?: string; policy_clause_cited?: string },
  consumablesCover: string | null
): (typeof RULE_CHECKS)[number] {
  const excluded = ["ICU", "Pharmacy", "Consumables", "Implants", "Investigations"];
  if (v.deduction_reason === "Proportionate deduction" && v.bill_head && excluded.includes(v.bill_head))
    return "Proportionate cut on an excluded head";
  if (v.bill_head === "Consumables" && consumablesCover === "Yes") return "Consumable cut despite add-on";
  if (v.policy_clause_cited?.trim().toLowerCase() === "none") return "No clause cited";
  return "OK";
}
