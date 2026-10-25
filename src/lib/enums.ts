/**
 * Every dropdown in the tracker lives here. Columns are plain text in Postgres,
 * so edit these lists freely as real deduction sheets arrive.
 */

export const ADMISSION_TYPES = ["Planned", "Emergency"] as const;

export const DEPARTMENTS = [
  "Ophthalmology",
  "Cardiology",
  "Orthopaedics",
  "General surgery",
  "General medicine",
  "Obstetrics and gynaecology",
  "ENT",
  "Urology",
  "Neurology",
  "Oncology",
  "Nephrology",
  "Gastroenterology",
  "Paediatrics",
  "Other",
] as const;

export const AGE_BANDS = ["0–17", "18–40", "41–60", "61+"] as const;

export const BILLING_MODES = ["Package", "Open (itemised)"] as const;

export const ROOM_CATEGORIES = ["Day care", "Ward", "Twin", "Single", "Deluxe", "ICU"] as const;

export const PAYER_CHANNELS = [
  "Insurer via TPA",
  "Insurer in-house",
  "PM-JAY",
  "CGHS",
  "ECHS",
  "State scheme",
  "Corporate direct",
] as const;

export const INSURERS = [
  "Star Health",
  "HDFC ERGO",
  "ICICI Lombard",
  "Bajaj Allianz",
  "Niva Bupa",
  "Care Health",
  "Aditya Birla Health",
  "Tata AIG",
  "New India Assurance",
  "United India",
  "Oriental Insurance",
  "National Insurance",
  "Government scheme",
  "Other",
] as const;

export const TPAS = [
  "Medi Assist",
  "Paramount",
  "MDIndia",
  "Vidal",
  "Heritage",
  "FHPL",
  "Raksha",
  "Safeway",
  "Health India",
  "Good Health",
  "East West Assist",
  "Other",
] as const;

export const POLICY_TYPES = ["Individual", "Family floater", "Group (employer)", "Government"] as const;

export const TARIFF_BASES = [
  "Hospital tariff",
  "PPN (PSU insurers) package",
  "Insurer-specific MoU",
] as const;

export const SUBMISSION_CHANNELS = ["Insurer or TPA portal", "Email", "NHCX", "Other"] as const;

export const CONSUMABLES_COVER = ["Yes", "No", "Unknown"] as const;

export const CLAIM_STATUSES = [
  "Open",
  "Under query",
  "Approved",
  "Awaiting settlement",
  "Settled",
  "Part-settled",
  "Denied",
  "Written off",
  "Moved to reimbursement",
] as const;

// Used in later phases (workspace tabs). Kept here so every list sits in one file.
export const STAGES = [
  "Eligibility check",
  "Pre-auth sent",
  "Pre-auth decision",
  "Enhancement sent",
  "Enhancement decision",
  "Discharge advised by doctor",
  "Final bill ready",
  "Final auth sent",
  "Final auth decision",
  "Claim documents dispatched",
  "Documents acknowledged",
  "Settlement letter received",
  "Payment received",
  "Dispute raised",
  "Dispute closed",
] as const;

export const DOC_TYPES = [
  "Pre-auth letter",
  "Enhancement letter",
  "Final bill",
  "Deduction sheet or settlement letter",
  "Remittance advice",
  "Query email",
  "Other",
] as const;

// ───────── Workspace lists (phase 3) ─────────
export const DIRECTIONS = ["Hospital → payer", "Payer → hospital"] as const;
export const CHANNELS = ["Portal", "Email", "NHCX", "Phone", "Courier"] as const;
export const DECISIONS = ["Approved", "Partly approved", "Query", "Denied", "Pending"] as const;
export const STAFF_ROLES = ["Desk executive", "Billing", "Doctor", "Other"] as const;
export const YES_NO = ["Yes", "No"] as const;
export const YES_NO_UNCLEAR = ["Yes", "No", "Unclear"] as const;

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
export const APPROVER_ROLES = ["Billing", "Finance", "Management", "Other"] as const;
