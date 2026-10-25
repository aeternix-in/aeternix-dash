# Manual entry sheet: 12 claims to type in by hand

Enter these through the UI, not the seed script, because the point is to feel the form. All data is
invented. Use the UHIDs as written (they are hashed in the browser). Dates are examples; use any
past dates. Log every snag in `FRICTION_LOG.md` section B.

For each claim, note: did a dropdown lack the value you needed, did a validation message confuse you,
how long did it take, and did you have to leave a field blank or fake a value.

| # | UHID | Probes | Key values to enter |
|---|------|--------|---------------------|
| 1 | HAND-0001 | Plain happy path, day care | Planned, Ophthalmology, ICD H25.1, PKG-OPH-PHACO, Package, Day care, rent 0, room days 0, Insurer via TPA / Star Health / Medi Assist, Individual, Hospital tariff, portal, limit "No limit", estimate 40000, requested 38000, approved 35000 |
| 2 | HAND-0002 | Emergency with ICU then ward | Emergency, Cardiology, I21.4, PKG-CAR-PCI-1, Open, room Single, rent 6000, room days 5, ICU days 2, limit "1% of SI", SI balance 500000, requested 250000, approved 180000 |
| 3 | HAND-0003 | PM-JAY: no real insurer or TPA | Orthopaedics, S72.0, PM-JAY channel, insurer ?, tariff ?, policy type Government (what did you pick for insurer and tariff?) |
| 4 | HAND-0004 | CGHS | Urology, N20.0, CGHS channel, room Ward rent 1500, limit "As per entitlement" (does the field accept that?) |
| 5 | HAND-0005 | Corporate direct, group policy | General surgery, K80.2, Corporate direct, Group (employer), no TPA, limit "No limit", co-pay blank |
| 6 | HAND-0006 | Co-pay and deductible together | Obstetrics and gynaecology, O82, Insurer in-house, co-pay 10, deductible 5000 |
| 7 | HAND-0007 | Per-eye sub-limit | Ophthalmology, H25.9, sub-limit 30000, condition "Cataract per eye", consumables cover Yes |
| 8 | HAND-0008 | Sum insured nearly exhausted | Orthopaedics, M17.1, SI balance 40000, estimate 280000, requested 280000, approved 40000 |
| 9 | HAND-0009 | Still admitted | Emergency, General medicine, J18.9, discharge left blank, status Under query |
| 10 | HAND-0010 | Unusual ICD-10 codes | Try `z51.11`, `O80`, `H25.1 ` (trailing space), `H251`, `E11.65`. Which are accepted, which rejected, are the messages clear? |
| 11 | HAND-0011 | Validation traps (each should be refused) | Discharge before admission; ICU days 6 with room days 4; approved above requested; discount above gross bill; Insurer via TPA with TPA blank |
| 12 | HAND-0012 | Duplicate entry | Re-enter HAND-0001 with the same admission time. Does anything warn you? (Expected: nothing, see A11.) |

Also try once: close the browser halfway through a claim and reopen it (draft restore), and enter a
claim on a phone-sized window.
