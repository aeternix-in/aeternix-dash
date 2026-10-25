export interface Claim {
  claim_id: string;
  admission_at: string;
  discharge_at: string | null;
  admission_type: string;
  department: string;
  treating_doctor_code: string | null;
  primary_diagnosis_icd10: string;
  procedure_code: string;
  billing_mode: string;
  age_band: string | null;
  room_category_occupied: string;
  room_rent_charged_per_day: number;
  icu_days: number | null;
  room_days: number | null;
  payer_channel: string;
  insurer: string;
  tpa: string | null;
  policy_type: string;
  tariff_basis: string;
  submission_channel: string;
  room_rent_limit_per_day: string;
  consumables_cover: string | null;
  estimate_at_admission: number;
  preauth_requested: number;
  preauth_approved_initial: number;
  enhancement_approved_total: number | null;
  final_bill_gross: number | null;
  hospital_discount: number | null;
  final_bill_claimed: number | null;
  final_approved_at_discharge: number | null;
  collected_from_patient: number | null;
  settled_by_payer_gross: number | null;
  tds: number | null;
  claim_status: string;
}

export interface StageEvent {
  event_id: string;
  claim_id: string;
  stage: string;
  event_at: string;
  direction: string | null;
  channel: string | null;
  payer_reference: string | null;
  amount_requested: number | null;
  amount_approved: number | null;
  decision: string | null;
  staff_role: string | null;
  minutes_since_request: number | null;
  sla_breached: boolean | null;
  patient_waiting: boolean | null;
  delay_charges_raised: number | null;
}

export interface QueryRow {
  query_id: string;
  claim_id: string;
  event_id: string | null;
  query_stage: string;
  raised_at: string;
  answered_at: string | null;
  closed_at: string | null;
  query_category: string;
  documents_asked: string[] | null;
  already_submitted: string;
  rounds: number | null;
  root_cause_owner: string;
  avoidable: string;
  amount_at_stake: number | null;
  outcome: string;
  payer_text: string | null;
}

export interface DeductionRow {
  line_id: string;
  claim_id: string;
  detected_at: string;
  bill_head: string;
  item_description: string | null;
  amount_billed: number;
  amount_deducted: number;
  deduction_reason: string;
  policy_clause_cited: string;
  attribution: string;
  rule_check: string;
  recoverable_from: string;
  recovered_amount: number | null;
  payer_text: string | null;
}

export interface TxnRow {
  txn_id: string;
  claim_id: string;
  txn_type: string;
  last_document_sent_at: string | null;
  settlement_letter_at: string | null;
  payment_at: string;
  amount_gross: number;
  tds: number | null;
  amount_net_received: number;
  utr: string | null;
  bulk_payment_ref: string | null;
  match_status: string;
  days_last_doc_to_payment: number | null;
  dispute_level: string | null;
  dispute_outcome: string | null;
  writeoff_reason: string | null;
  approved_by_role: string | null;
}

export interface DocRow {
  doc_id: string;
  claim_id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}
