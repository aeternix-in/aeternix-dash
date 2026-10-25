/**
 * Dropdown lists for Tables 2-5 that the seed script needs.
 * The wizard lists (Table 1) come from src/lib/enums.ts; these are the workspace-tab lists.
 * If your workspace phase already defines the same lists in enums.ts, import them from there
 * instead and delete this file.
 */
export const DIRECTIONS = ["Hospital → payer", "Payer → hospital"] as const;
export const STAGE_CHANNELS = ["Portal", "Email", "NHCX", "Phone", "Courier"] as const;
export const STAFF_ROLES = ["Desk executive", "Billing", "Doctor", "Other"] as const;
export const DECISIONS = ["Approved", "Partly approved", "Query", "Denied", "Pending"] as const;

export const QUERY_STAGES = ["Pre-auth", "Enhancement", "Discharge", "Post-discharge claim"] as const;
export const QUERY_CATEGORIES = [
  "Missing document",
  "Clinical justification",
  "Past history or pre-existing disease",
  "Diagnosis–procedure mismatch",
  "Bill breakup",
  "Tariff mismatch",
  "Policy terms",
  "Investigation report",
  "Repeat of an earlier query",
  "Other",
] as const;
export const DOCUMENTS_ASKED = [
  "Discharge summary",
  "Investigation reports",
  "Indoor case papers",
  "Implant invoice or sticker",
  "Past records",
  "Signed claim form",
  "ID",
  "Other",
] as const;
export const ROOT_CAUSE_OWNERS = ["Doctor's notes", "Billing", "Insurance desk", "Payer", "Patient"] as const;
export const AVOIDABLE = ["Yes", "No", "Unclear"] as const;
export const QUERY_OUTCOMES = ["Approved as asked", "Approved reduced", "Denied", "Still open", "Closed unanswered"] as const;

export const DETECTED_AT = ["Pre-auth", "Final auth at discharge", "Settlement after discharge"] as const;
export const BILL_HEADS = [
  "Room", "Nursing", "ICU", "Doctor fees", "OT", "Package", "Pharmacy",
  "Consumables", "Implants", "Investigations", "Other",
] as const;
export const DEDUCTION_REASONS = [
  "Non-payable item (IRDAI List I)",
  "Item to be subsumed (Lists II–IV) billed separately",
  "Proportionate deduction",
  "Room rent above limit",
  "Co-pay",
  "Deductible",
  "Disease or procedure sub-limit",
  "Above agreed tariff or package",
  "Not reasonable and customary",
  "Unrelated to this admission",
  "Stay not justified",
  "Waiting period, pre-existing disease or exclusion",
  "Sum insured exhausted",
  "Document missing",
  "No reason given",
] as const;
export const ATTRIBUTIONS = [
  "Contractual (policy terms)",
  "Hospital billing error",
  "Hospital documentation gap",
  "Payer error",
  "Tariff dispute",
  "Unclear",
] as const;
export const RULE_CHECKS = [
  "OK",
  "Proportionate cut on an excluded head",
  "Consumable cut despite add-on",
  "Tariff cut at agreed rate",
  "No clause cited",
  "Other",
] as const;
export const RECOVERABLE_FROM = ["Patient", "Payer via dispute", "Nobody"] as const;

export const TXN_TYPES = ["Payer payment", "Patient collection", "Dispute recovery", "Write-off", "Reversal"] as const;
export const MATCH_STATUSES = ["Auto", "Manual", "Unmatched"] as const;
export const DISPUTE_LEVELS = ["TPA", "Insurer", "Grievance officer"] as const;
export const DISPUTE_OUTCOMES = ["Won", "Partly won", "Lost", "Pending"] as const;
export const WRITEOFF_REASONS = [
  "Patient refused", "Patient untraceable", "Not worth pursuing", "Hospital error accepted", "Other",
] as const;
