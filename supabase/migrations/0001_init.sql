-- Aeternix Claim Leakage Tracker: initial schema
-- Run once in Supabase Dashboard -> SQL Editor. Safe to read top to bottom.
-- Dropdown values are plain text on purpose (see src/lib/enums.ts) so lists can
-- change during the pilot without a migration.

create sequence if not exists claim_seq start 1;

-- ───────────── Table 1: claim header ─────────────
create table if not exists claims (
  claim_id text primary key default ('CLM-' || lpad(nextval('claim_seq')::text, 5, '0')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),

  -- identity and clinical
  uhid_hash text not null,
  admission_at timestamptz not null,
  discharge_at timestamptz,
  admission_type text not null,
  department text not null,
  treating_doctor_code text,
  primary_diagnosis_icd10 text not null,
  procedure_code text not null,
  billing_mode text not null,
  age_band text,
  room_category_occupied text not null,
  room_rent_charged_per_day numeric(12,2) not null,
  icu_days numeric(5,1),
  room_days numeric(5,1),

  -- policy and payer
  payer_channel text not null,
  insurer text not null,
  tpa text,
  policy_type text not null,
  tariff_basis text not null,
  submission_channel text not null,
  room_rent_limit_per_day text not null,
  sum_insured_balance numeric(14,2),
  copay_pct numeric(5,2),
  deductible_amount numeric(12,2),
  disease_sublimit_amount numeric(12,2),
  disease_sublimit_condition text,
  consumables_cover text,
  policy_years_continuous numeric(4,1),

  -- money snapshot
  estimate_at_admission numeric(14,2) not null,
  preauth_requested numeric(14,2) not null,
  preauth_approved_initial numeric(14,2) not null,
  enhancement_approved_total numeric(14,2),
  final_bill_gross numeric(14,2),
  hospital_discount numeric(14,2),
  final_bill_claimed numeric(14,2),
  final_approved_at_discharge numeric(14,2),
  collected_from_patient numeric(14,2),
  settled_by_payer_gross numeric(14,2),   -- includes TDS
  tds numeric(14,2),
  claim_status text not null default 'Open'
);
create index if not exists claims_status_idx on claims (claim_status);
create index if not exists claims_insurer_idx on claims (insurer);
create index if not exists claims_admission_idx on claims (admission_at desc);

-- ───────────── Table 2: stage log ─────────────
create table if not exists stage_log (
  event_id uuid primary key default gen_random_uuid(),
  claim_id text not null references claims(claim_id) on delete cascade,
  stage text not null,
  event_at timestamptz not null,
  direction text,
  channel text,
  payer_reference text,
  amount_requested numeric(14,2),
  amount_approved numeric(14,2),
  decision text,
  staff_role text,
  minutes_since_request integer,
  sla_breached boolean,
  patient_waiting boolean,
  delay_charges_raised numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists stage_log_claim_idx on stage_log (claim_id, event_at);

-- ───────────── Table 3: query log ─────────────
create table if not exists query_log (
  query_id uuid primary key default gen_random_uuid(),
  claim_id text not null references claims(claim_id) on delete cascade,
  event_id uuid references stage_log(event_id) on delete set null,
  query_stage text not null,
  raised_at timestamptz not null,
  answered_at timestamptz,
  closed_at timestamptz,
  query_category text not null,
  documents_asked text[],
  already_submitted text not null,        -- Yes / No
  rounds integer,
  root_cause_owner text not null,
  avoidable text not null,                -- Yes / No / Unclear
  amount_at_stake numeric(14,2),
  outcome text not null,
  payer_text text,
  created_at timestamptz not null default now()
);
create index if not exists query_log_claim_idx on query_log (claim_id);

-- ───────────── Table 4: deduction lines ─────────────
create table if not exists deduction_lines (
  line_id uuid primary key default gen_random_uuid(),
  claim_id text not null references claims(claim_id) on delete cascade,
  detected_at text not null,
  bill_head text not null,
  item_description text,
  amount_billed numeric(14,2) not null,
  amount_deducted numeric(14,2) not null,
  deduction_reason text not null,
  policy_clause_cited text not null,
  attribution text not null,
  rule_check text not null,
  recoverable_from text not null,
  recovered_amount numeric(14,2) default 0,
  payer_text text,
  created_at timestamptz not null default now()
);
create index if not exists deduction_claim_idx on deduction_lines (claim_id);

-- ───────────── Table 5: settlement and recovery ─────────────
create table if not exists settlement_txns (
  txn_id uuid primary key default gen_random_uuid(),
  claim_id text not null references claims(claim_id) on delete cascade,
  txn_type text not null,
  last_document_sent_at date,
  settlement_letter_at date,
  payment_at date not null,
  amount_gross numeric(14,2) not null,
  tds numeric(14,2),
  amount_net_received numeric(14,2) not null,
  utr text,
  bulk_payment_ref text,
  match_status text not null,
  days_to_match integer,
  days_last_doc_to_payment integer,
  dispute_level text,
  dispute_outcome text,
  writeoff_reason text,
  approved_by_role text,
  created_at timestamptz not null default now()
);
create index if not exists settlement_claim_idx on settlement_txns (claim_id);

-- ───────────── Documents (uploads; not in the spec's five tables) ─────────────
create table if not exists claim_documents (
  doc_id uuid primary key default gen_random_uuid(),
  claim_id text not null references claims(claim_id) on delete cascade,
  doc_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid() references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists docs_claim_idx on claim_documents (claim_id);

-- ───────────── Derived numbers ─────────────
-- Shortfall = final bill claimed - payer paid (incl. TDS) - collected from patient - recovered in disputes
create or replace view claim_metrics with (security_invoker = true) as
select
  c.claim_id,
  coalesce(r.recovered, 0) as recovered_in_disputes,
  case when c.final_bill_claimed is null then null
       else c.final_bill_claimed
            - coalesce(c.settled_by_payer_gross, 0)
            - coalesce(c.collected_from_patient, 0)
            - coalesce(r.recovered, 0)
  end as unrecovered_shortfall,
  (select count(*) from query_log q where q.claim_id = c.claim_id) as query_count
from claims c
left join (
  select claim_id, sum(amount_gross) as recovered
  from settlement_txns where txn_type = 'Dispute recovery' group by claim_id
) r on r.claim_id = c.claim_id;

-- ───────────── Row level security ─────────────
-- Study team only: any signed-in user can read and write. Turn OFF public
-- sign-ups in Authentication -> Providers -> Email, and create users by hand.
do $$
declare t text;
begin
  foreach t in array array['claims','stage_log','query_log','deduction_lines','settlement_txns','claim_documents']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists team_all on %I', t);
    execute format('create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ───────────── Storage bucket for documents ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-documents', 'claim-documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists team_docs_all on storage.objects;
create policy team_docs_all on storage.objects for all to authenticated
  using (bucket_id = 'claim-documents') with check (bucket_id = 'claim-documents');
