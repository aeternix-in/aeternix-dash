# Friction log

Running list of form friction, missing dropdown options, awkward fields and edge cases found while
entering claims. Report the "schema" rows back to Shashank as schema feedback (or open a GitHub Issue
labelled `schema-feedback`).

Severity: **H** blocks or corrupts data, **M** slows entry or loses detail, **L** cosmetic.

## A. Found by reading the code and building the seed data (before any manual entry)

| # | Area | What I found | Sev | Suggested fix | Status |
|---|------|--------------|-----|---------------|--------|
| A1 | Privacy | (Salt moved to a server-only `UHID_SALT` and hashing to `/api/hash-uhid`; raw UHID now reaches our server over HTTPS for the moment of hashing. Hospital-side hashing still the long-term option.) Was: `NEXT_PUBLIC_UHID_SALT` compiled into the browser JavaScript, so anyone who can load the site can read it. The spec says the key stays on hospital premises. Acceptable for a closed pilot with mock data, not for real UHIDs. | H | Before real data: hospital-side hashing later. | server-side hashing done; hospital-side open |
| A2 | Privacy | `treating_doctor_code` is visible to every logged-in user in the wizard; the plan said it would sit behind an admin role. | M | Hide behind a role, or drop from the wizard and capture later. | open |
| A3 | Schema | `room_rent_limit_per_day` is free text ("5000", "1% of SI", "No limit"). The proportionate-deduction check cannot be computed from it. | M | Split into `limit_type` (Rs / % of SI / No limit) and `limit_value`. | open |
| A4 | Schema | `room_category_occupied` holds one value, but ICU patients usually move ICU to ward. Seed data uses the post-ICU room and records `icu_days` separately. | M | Allow a main room category plus ICU days (as now) and say so in the field hint, or add a room-stay table. | open |
| A5 | Dropdown | `insurer` is required, so PM-JAY, CGHS and Corporate direct claims need a dummy value ("Government scheme" / "Other"). | M | Make insurer optional for non-insurer channels, or add "Not applicable". | open |
| A6 | Dropdown | `tariff_basis` has no option for government package rates (PM-JAY, CGHS). Seed data uses "Insurer-specific MoU". | M | Add "Government scheme rate". | open |
| A7 | Schema | `settlement_txns.payment_at` is NOT NULL, so a dispute that was lost or refused (no money moved) has no natural date. Seed data uses the dispute close date with amount 0; pending disputes have no row, only a stage event. | M | Add `event_date` (required) and make `payment_at` optional, or track disputes in their own table. | open |
| A8 | Schema | No sign convention for `Reversal` rows and nothing nets them: `claim_metrics` and `claims.settled_by_payer_gross` ignore reversals. | M | Decide: reversal amounts are stored positive and subtracted in the view. | open |
| A9 | Schema | Unmatched receipts: the payment row exists but `claims.settled_by_payer_gross` stays empty, so the claim shows as unpaid, which matches the spec's description of reconciliation breakage. Needs a visible "unmatched cash" flag in the workspace. | L | Workspace Settlement tab badge. | open |
| A10 | Schema | `minutes_since_request`, `sla_breached`, `days_last_doc_to_payment` and `rule_check` are plain stored columns, not computed. They can drift from the timestamps they come from. The seed script fills them itself. | H | DB trigger or generated column / view; the first three `rule_check` values can be computed too. | open |
| A11 | Data | Nothing stops two claims with the same `uhid_hash` and `admission_at` (accidental double entry). | M | Unique index on (`uhid_hash`, `admission_at`). | open |
| A12 | Access | Any signed-in user can update or delete any row (`team_all` policy). Fine for a small pilot, but one mis-click deletes a claim and all child rows (cascade). | L | Restrict delete to an admin, or use soft delete. | open |
| A13 | Workflow | The wizard also asks for final bill, discount and approval at discharge, but the spec says these come later from different documents. Check during entry whether people skip them or guess. | L | Observe, then decide. | open |

## B. Found during manual entry

Use `docs/manual-entry-sheet.md` (12 awkward claims). Add one row per finding.

| # | Claim / step | What happened | Sev | Suggested fix | Status |
|---|--------------|---------------|-----|---------------|--------|
| B1 | | | | | |
