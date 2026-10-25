/**
 * Mock claim generator. Pure functions, no network: produces 40 linked claim "bundles"
 * (header + stage log + queries + deductions + settlement) with deliberately awkward cases.
 * Everything here is invented. No real patient, payer reference or bank data.
 */
import { claimFormSchema, type ClaimFormValues } from "../../src/lib/schemas";
import * as L from "./lists";

// ───────────── tiny seeded RNG so every run produces the same 40 claims ─────────────
export function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    between: (a: number, b: number) => a + next() * (b - a),
    chance: (p: number) => next() < p,
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
  };
}
type Rng = ReturnType<typeof makeRng>;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MIN);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const round = (n: number, to = 1) => Math.round(n / to) * to;

// ───────────── clinical profiles ─────────────
interface Profile {
  dept: string; icd: string[]; proc: string[]; base: [number, number];
  rooms: string[]; days: [number, number]; icu: [number, number]; openProb: number;
}
const P = {
  eye: { dept: "Ophthalmology", icd: ["H25.1", "H25.9", "H40.1"], proc: ["PKG-OPH-PHACO", "PKG-OPH-PHACO-TORIC", "PKG-OPH-TRAB"], base: [28000, 65000], rooms: ["Day care"], days: [0, 0], icu: [0, 0], openProb: 0.15 },
  cardio: { dept: "Cardiology", icd: ["I25.1", "I21.4", "I20.0"], proc: ["PKG-CAR-PCI-1", "PKG-CAR-PCI-2", "PKG-CAR-ANGIO"], base: [120000, 340000], rooms: ["Single", "Twin"], days: [3, 6], icu: [1, 3], openProb: 0.5 },
  ortho: { dept: "Orthopaedics", icd: ["M17.1", "S72.0", "M16.1"], proc: ["PKG-ORT-TKR", "PKG-ORT-THR", "PKG-ORT-ORIF"], base: [160000, 380000], rooms: ["Single", "Twin", "Deluxe"], days: [3, 6], icu: [0, 1], openProb: 0.4 },
  surg: { dept: "General surgery", icd: ["K80.2", "K40.9", "K35.8"], proc: ["PKG-SUR-LAPCHOLE", "PKG-SUR-HERNIA", "PKG-SUR-APPENDIX"], base: [60000, 115000], rooms: ["Twin", "Single", "Ward"], days: [2, 4], icu: [0, 0], openProb: 0.3 },
  med: { dept: "General medicine", icd: ["J18.9", "A91", "E11.65"], proc: ["MED-IP-PNEUMONIA", "MED-IP-DENGUE", "MED-IP-DIABETES"], base: [35000, 95000], rooms: ["Ward", "Twin", "Single"], days: [3, 7], icu: [0, 2], openProb: 0.85 },
  obg: { dept: "Obstetrics and gynaecology", icd: ["O82", "O80", "N83.2"], proc: ["PKG-OBG-LSCS", "PKG-OBG-NVD", "PKG-OBG-HYST"], base: [55000, 105000], rooms: ["Twin", "Single", "Deluxe"], days: [2, 4], icu: [0, 0], openProb: 0.2 },
  ent: { dept: "ENT", icd: ["J34.2", "J35.0", "H66.9"], proc: ["PKG-ENT-SEPTO", "PKG-ENT-TONSIL", "PKG-ENT-TYMPANO"], base: [38000, 65000], rooms: ["Day care", "Ward"], days: [0, 1], icu: [0, 0], openProb: 0.15 },
  uro: { dept: "Urology", icd: ["N20.0", "N40", "N13.2"], proc: ["PKG-URO-PCNL", "PKG-URO-TURP", "PKG-URO-URS"], base: [50000, 98000], rooms: ["Twin", "Single", "Ward"], days: [1, 3], icu: [0, 0], openProb: 0.3 },
} satisfies Record<string, Profile>;
const PROFILE_POOL: Profile[] = [P.eye, P.eye, P.eye, P.cardio, P.ortho, P.surg, P.surg, P.med, P.obg, P.ent, P.uro];

const RENT_BY_ROOM: Record<string, number> = { "Day care": 0, Ward: 2500, Twin: 4000, Single: 6000, Deluxe: 9000, ICU: 12000 };

// ───────────── scenario flags ─────────────
type Channel = (typeof import("../../src/lib/enums").PAYER_CHANNELS)[number];
export interface Flags {
  note: string;
  profile?: Profile; channel?: Channel; emergency?: boolean; enh?: number; open?: boolean;
  icuProp?: boolean; eyePads?: boolean; writeoff?: boolean; exhausted?: boolean; denied?: boolean;
  dispute?: (typeof L.DISPUTE_OUTCOMES)[number]; unmatched?: boolean; reversal?: boolean;
  slaBreach?: boolean; slowPay?: boolean; consumablesCut?: boolean; tariffCut?: boolean;
  noClause?: boolean; stillAdmitted?: boolean; copay?: number; sublimit?: boolean;
  noQueries?: boolean; manyQueries?: boolean; pending?: boolean; clean?: boolean; insurer?: string; tpa?: string;
}

const SCENARIOS: Flags[] = [
  { note: "Cataract, eye pads billed separately", profile: P.eye, eyePads: true, open: true, channel: "Insurer via TPA", insurer: "United India", tpa: "Paramount" },
  { note: "Cataract, eye pads again, PSU PPN package", profile: P.eye, eyePads: true, open: true, channel: "Insurer via TPA", insurer: "New India Assurance", tpa: "MDIndia" },
  { note: "ICU proportionate cut, won on dispute", profile: P.cardio, icuProp: true, open: true, dispute: "Won", channel: "Insurer via TPA", insurer: "Star Health", tpa: "Medi Assist" },
  { note: "Emergency ortho, 2 enhancements, slow payer, many queries", profile: P.ortho, emergency: true, enh: 2, slaBreach: true, manyQueries: true, channel: "Insurer via TPA", insurer: "HDFC ERGO", tpa: "Medi Assist" },
  { note: "Emergency medicine, ICU, 3 enhancements, payment over 45 days", profile: P.med, emergency: true, enh: 3, slowPay: true, open: true, channel: "Insurer via TPA", insurer: "Bajaj Allianz", tpa: "Vidal" },
  { note: "Consumables cut despite add-on, partly won", profile: P.surg, consumablesCut: true, open: true, dispute: "Partly won", channel: "Insurer via TPA", insurer: "ICICI Lombard", tpa: "FHPL" },
  { note: "Cut at agreed MoU rate, dispute lost", profile: P.ortho, tariffCut: true, dispute: "Lost", channel: "Insurer via TPA", insurer: "Care Health", tpa: "Raksha" },
  { note: "Denied: pre-existing disease, patient refused to pay, written off", profile: P.cardio, denied: true, writeoff: true, channel: "Insurer in-house", insurer: "Niva Bupa" },
  { note: "Sum insured exhausted, patient did not pay", profile: P.ortho, exhausted: true, writeoff: true, channel: "Insurer via TPA", insurer: "Oriental Insurance", tpa: "Paramount" },
  { note: "PM-JAY package", profile: P.ortho, channel: "PM-JAY", noQueries: true },
  { note: "CGHS urology package", profile: P.uro, channel: "CGHS" },
  { note: "Corporate direct group policy, clean first pass", profile: P.surg, channel: "Corporate direct", clean: true, noQueries: true },
  { note: "Payment received but unmatched in the bank reconciliation", profile: P.surg, unmatched: true, channel: "Insurer via TPA", insurer: "Tata AIG", tpa: "Safeway" },
  { note: "Payer payment then reversal", profile: P.med, reversal: true, channel: "Insurer via TPA", insurer: "Aditya Birla Health", tpa: "Heritage" },
  { note: "Still admitted, emergency, pre-auth pending", profile: P.cardio, stillAdmitted: true, emergency: true, channel: "Insurer via TPA", insurer: "Star Health", tpa: "Medi Assist" },
  { note: "Cataract with per-eye sub-limit", profile: P.eye, sublimit: true, channel: "Insurer in-house", insurer: "Care Health" },
  { note: "Cut with no reason or clause, dispute pending", profile: P.uro, noClause: true, dispute: "Pending", channel: "Insurer via TPA", insurer: "National Insurance", tpa: "Good Health" },
  { note: "Still admitted, planned, query open", profile: P.obg, stillAdmitted: true, channel: "Insurer via TPA", insurer: "ICICI Lombard", tpa: "FHPL" },
  { note: "Group policy in-house insurer with 10% co-pay", profile: P.obg, copay: 10, channel: "Insurer in-house", insurer: "HDFC ERGO" },
  { note: "Part-settled, ICU proportionate dispute pending", profile: P.cardio, icuProp: true, dispute: "Pending", open: true, channel: "Insurer via TPA", insurer: "Bajaj Allianz", tpa: "East West Assist" },
];

// ───────────── output shapes ─────────────
export interface Bundle {
  uhidRaw: string;
  note: string;
  claim: Record<string, unknown>;
  stages: Record<string, unknown>[];
  queries: Record<string, unknown>[];
  deductions: Record<string, unknown>[];
  txns: Record<string, unknown>[];
  summary: { shortfall: number; claimed: number; status: string; lines: number; queries: number };
}

// ───────────── payer set-up ─────────────
function payerFor(f: Flags, r: Rng) {
  const channel = f.channel ?? r.pick(["Insurer via TPA", "Insurer via TPA", "Insurer via TPA", "Insurer in-house", "Insurer in-house", "Corporate direct", "PM-JAY", "CGHS"] as const);
  const gov = ["PM-JAY", "CGHS", "ECHS", "State scheme"].includes(channel);
  const privateInsurers = ["Star Health", "HDFC ERGO", "ICICI Lombard", "Bajaj Allianz", "Niva Bupa", "Care Health", "Aditya Birla Health", "Tata AIG"];
  const psu = ["New India Assurance", "United India", "Oriental Insurance", "National Insurance"];
  const tpas = ["Medi Assist", "Paramount", "MDIndia", "Vidal", "Heritage", "FHPL", "Raksha", "Safeway", "Health India", "Good Health"];
  const insurer = gov ? "Government scheme" : channel === "Corporate direct" ? "Other" : f.insurer ?? r.pick([...privateInsurers, ...psu]);
  const tpa = channel === "Insurer via TPA" ? f.tpa ?? r.pick(tpas) : undefined;
  const isPsu = psu.includes(insurer);
  const policy_type = gov ? "Government" : channel === "Corporate direct" ? "Group (employer)" : r.pick(["Individual", "Family floater", "Family floater", "Group (employer)"] as const);
  const tariff_basis = gov ? "Insurer-specific MoU" : isPsu ? "PPN (PSU insurers) package" : r.pick(["Hospital tariff", "Insurer-specific MoU"] as const);
  const submission_channel = r.pick(["Insurer or TPA portal", "Insurer or TPA portal", "Email", "NHCX"] as const);
  const consumables_cover = gov ? undefined : r.pick(["Yes", "No", "Unknown"] as const);
  return { payer_channel: channel, insurer, tpa, policy_type, tariff_basis, submission_channel, consumables_cover };
}

// ───────────── one claim ─────────────
export function buildClaim(i: number, f: Flags, r: Rng, now: Date): Bundle {
  const uhidRaw = `MOCK-${String(i + 1).padStart(4, "0")}`;
  const prof = f.profile ?? r.pick(PROFILE_POOL);
  const payer = payerFor(f, r);
  if (f.consumablesCut) payer.consumables_cover = "Yes";
  if (f.tariffCut) payer.tariff_basis = "Insurer-specific MoU";
  const emergency = f.emergency ?? (prof !== P.eye && r.chance(0.25));
  const billingOpen = f.open ?? r.chance(prof.openProb);

  // timeline
  const daysAgo = f.stillAdmitted ? r.int(1, 3) : f.pending ? r.int(8, 20) : r.int(14, 200);
  const stayDays = r.int(prof.days[0], prof.days[1]);
  const admission = addMin(addDays(now, -daysAgo), -r.int(0, 600));
  const discharge = f.stillAdmitted ? undefined : stayDays === 0 ? addMin(admission, r.int(150, 360)) : addDays(admission, stayDays);

  // clinical and room
  const roomCat = r.pick(prof.rooms);
  const icuDays = f.icuProp ? Math.max(1, r.int(1, 3)) : r.int(prof.icu[0], prof.icu[1]);
  const roomDays = stayDays === 0 ? 0 : Math.max(stayDays, icuDays);
  const rentPerDay = RENT_BY_ROOM[roomCat] + (r.chance(0.3) ? 500 : 0) * (roomCat === "Day care" ? 0 : 1);
  const rentLimitOptions = ["3000", "4000", "5000", "6000", "1% of SI", "2% of SI", "No limit"];
  const limitText = roomCat === "Day care" ? "No limit" : r.pick(rentLimitOptions);
  const si = r.int(3, 10) * 100000;
  const limitNum = limitText === "No limit" ? Infinity : limitText.endsWith("% of SI") ? (parseFloat(limitText) / 100) * si : Number(limitText);

  const copay = f.copay ?? (payer.policy_type !== "Government" && r.chance(0.2) ? r.pick([10, 20]) : undefined);

  // money
  const base = r.int(prof.base[0] / 1000, prof.base[1] / 1000) * 1000;
  const estimate = round(base * r.between(0.95, 1.05), 1000);
  const requested = round(estimate * r.between(0.9, 1), 1000);
  const initialApproved = f.denied ? 0 : round(requested * r.between(0.7, 1), 1000);
  const gross = round(billingOpen ? estimate * r.between(1.05, 1.5) : estimate * r.between(0.98, 1.12), 100);
  const discount = r.chance(0.3) ? round(gross * r.between(0.01, 0.05), 100) : 0;
  const claimed = gross - discount;
  const siBalance = f.exhausted ? round(claimed * 0.7, 1000) : payer.payer_channel.startsWith("Insurer") ? si : undefined;

  const stageRows: Record<string, unknown>[] = [];
  const evId = () => crypto.randomUUID();
  const refNo = `MOCKREF-${i + 1}-${r.int(1000, 9999)}`;
  const submitCh = ({ "Insurer or TPA portal": "Portal", Email: "Email", NHCX: "NHCX", Other: "Phone" } as Record<string, string>)[payer.submission_channel];
  const ev = (stage: string, at: Date, p: Record<string, unknown> = {}) => {
    const id = evId();
    stageRows.push({ event_id: id, stage, event_at: iso(at), payer_reference: refNo, ...p });
    return { id, at };
  };

  // eligibility and pre-auth
  const preSent = emergency ? addMin(admission, r.int(60, 240)) : addMin(admission, -r.int(300, 2400));
  if (!emergency) ev("Eligibility check", addMin(preSent, -r.int(20, 120)), { direction: "Hospital → payer", channel: submitCh, staff_role: "Desk executive" });
  const preSentEv = ev("Pre-auth sent", preSent, { direction: "Hospital → payer", channel: submitCh, amount_requested: requested, staff_role: "Desk executive", patient_waiting: emergency });
  const preMin = f.slaBreach ? r.int(75, 200) : r.chance(0.8) ? r.int(15, 58) : r.int(62, 110);
  const preDecision = f.denied ? "Denied" : initialApproved < requested ? "Partly approved" : "Approved";
  const preDecEv = f.stillAdmitted && f.note.includes("pre-auth pending") ? undefined : ev("Pre-auth decision", addMin(preSent, preMin), {
    direction: "Payer → hospital", channel: submitCh, amount_approved: initialApproved, decision: preDecision,
    minutes_since_request: preMin, sla_breached: preMin > 60, patient_waiting: emergency || preMin > 60 ? true : false, staff_role: "Other",
  });

  // enhancements
  const nEnh = f.denied || f.stillAdmitted ? 0 : f.enh ?? (stayDays > 0 && billingOpen && r.chance(0.4) ? 1 : 0);
  const enhDecs: { id: string; at: Date }[] = [];
  let enhApproved = 0;
  if (nEnh > 0) {
    const need = Math.max(round(gross * 0.9 - initialApproved, 1000), 10000);
    for (let k = 1; k <= nEnh; k++) {
      const sentAt = addMin(admission, Math.round((stayDays * 24 * 60 * k) / (nEnh + 1)));
      const asked = round(need / nEnh, 1000);
      const got = round(asked * r.between(0.75, 1), 1000);
      enhApproved += got;
      ev("Enhancement sent", sentAt, { direction: "Hospital → payer", channel: submitCh, amount_requested: asked, staff_role: "Billing" });
      const m = r.int(30, 170);
      enhDecs.push(ev("Enhancement decision", addMin(sentAt, m), {
        direction: "Payer → hospital", channel: submitCh, amount_approved: got, decision: got < asked ? "Partly approved" : "Approved",
        minutes_since_request: m, staff_role: "Other",
      }));
    }
  }

  // discharge and final auth
  let finalDecEv: { id: string; at: Date } | undefined;
  let finalMin = 0;
  const dischargeHospDelay = r.chance(0.2) ? r.int(200, 300) : r.int(25, 120);
  if (discharge && !f.denied) {
    const adv = ev("Discharge advised by doctor", addMin(discharge, -r.int(30, 120)), { direction: "Hospital → payer", staff_role: "Doctor" });
    const billReady = ev("Final bill ready", addMin(adv.at, dischargeHospDelay), { staff_role: "Billing" });
    const sent = ev("Final auth sent", addMin(billReady.at, r.int(5, 20)), { direction: "Hospital → payer", channel: submitCh, amount_requested: claimed, staff_role: "Billing", patient_waiting: true });
    finalMin = f.slaBreach ? r.int(190, 330) : r.chance(0.82) ? r.int(30, 170) : r.int(181, 260);
    finalDecEv = ev("Final auth decision", addMin(sent.at, finalMin), {
      direction: "Payer → hospital", channel: submitCh, decision: "Approved", minutes_since_request: finalMin,
      sla_breached: finalMin > 180, patient_waiting: true, staff_role: "Other",
      delay_charges_raised: finalMin > 180 && r.chance(0.4) ? r.int(1, 3) * 1000 : undefined,
    });
  }

  // deduction lines
  type Line = Record<string, unknown> & { amount_deducted: number; recoverable_from: string; detected_at: string };
  const lines: Line[] = [];
  const addLine = (l: { head: string; desc: string; billed: number; cut: number; reason: string; clause: string; attr: string; rule?: string; rec: string; at: string; text: string }) => {
    if (l.cut <= 0) return;
    lines.push({
      detected_at: l.at, bill_head: l.head, item_description: l.desc, amount_billed: Math.round(l.billed), amount_deducted: Math.round(l.cut),
      deduction_reason: l.reason, policy_clause_cited: l.clause, attribution: l.attr, rule_check: l.rule ?? "OK",
      recoverable_from: l.rec, recovered_amount: 0, payer_text: l.text,
    });
  };
  const DS = "Final auth at discharge", SA = "Settlement after discharge";
  const status0 = { discharged: Boolean(discharge) };

  if (status0.discharged) {
    if (f.denied) {
      addLine({ head: "Package", desc: "Entire claim", billed: claimed, cut: claimed, reason: "Waiting period, pre-existing disease or exclusion", clause: "Excl. 4.1 pre-existing disease, 48 months", attr: "Contractual (policy terms)", rec: "Patient", at: "Pre-auth", text: "Claim repudiated: pre-existing condition within waiting period" });
    } else if (!f.clean) {
      if (r.chance(0.85)) addLine({ head: "Other", desc: "Admission kit and registration charges", billed: claimed * 0.01, cut: claimed * r.between(0.01, 0.03), reason: L.DEDUCTION_REASONS[0], clause: "IRDAI List I item 12", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: "Non payable as per IRDAI list" });
      if (r.chance(0.3)) addLine({ head: "Nursing", desc: "Nursing charges billed separately from room", billed: claimed * 0.03, cut: claimed * 0.03, reason: L.DEDUCTION_REASONS[1], clause: "IRDAI List II item 3", attr: "Hospital billing error", rec: "Nobody", at: r.pick([DS, SA]), text: "Included in room charges" });
      if (copay) addLine({ head: "Package", desc: `Co-pay ${copay}%`, billed: claimed, cut: claimed * (copay / 100), reason: "Co-pay", clause: "Policy sec 3.2 co-payment", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: `Co-payment ${copay}% applicable` });
      if (roomCat !== "Day care" && rentPerDay > limitNum) {
        const roomCut = (rentPerDay - limitNum) * roomDays;
        addLine({ head: "Room", desc: "Room rent above policy limit", billed: rentPerDay * roomDays, cut: roomCut, reason: "Room rent above limit", clause: "Policy sec 5.1 room rent", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: `Room rent limit ${limitText}` });
        addLine({ head: "Doctor fees", desc: "Proportionate deduction on doctor fees due to room category", billed: claimed * 0.15, cut: claimed * 0.15 * Math.min(0.4, (rentPerDay - limitNum) / rentPerDay), reason: "Proportionate deduction", clause: "Policy sec 5.1 room rent", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: "Proportionate deduction applied" });
      }
    }
    if (f.eyePads) addLine({ head: "Consumables", desc: "Eye pad, eye shield and eye drape billed separately", billed: 1800, cut: r.int(12, 24) * 100, reason: L.DEDUCTION_REASONS[1], clause: "IRDAI List III (eye kit)", attr: "Hospital billing error", rec: "Nobody", at: SA, text: "Eye pad/shield/drape included in procedure charges" });
    if (f.icuProp) {
      const icuBilled = icuDays * 12000;
      addLine({ head: "ICU", desc: "ICU charges reduced proportionately", billed: icuBilled, cut: icuBilled * 0.3, reason: "Proportionate deduction", clause: "Policy sec 5.1 room rent", attr: "Payer error", rec: "Payer via dispute", at: SA, text: "Proportionate deduction applied on all heads", rule: "Proportionate cut on an excluded head" });
      addLine({ head: "Pharmacy", desc: "Medicines reduced proportionately", billed: claimed * 0.12, cut: claimed * 0.12 * 0.3, reason: "Proportionate deduction", clause: "Policy sec 5.1 room rent", attr: "Payer error", rec: "Payer via dispute", at: SA, text: "Proportionate deduction applied on all heads", rule: "Proportionate cut on an excluded head" });
    }
    if (f.consumablesCut) addLine({ head: "Consumables", desc: "Gloves, syringes, disposables", billed: claimed * 0.05, cut: claimed * 0.05, reason: L.DEDUCTION_REASONS[1], clause: "IRDAI List IV", attr: "Payer error", rec: "Payer via dispute", at: SA, text: "Consumables not payable", rule: "Consumable cut despite add-on" });
    if (f.tariffCut) addLine({ head: "Package", desc: "Package rate reduced below MoU rate", billed: claimed, cut: claimed * 0.08, reason: "Above agreed tariff or package", clause: "MoU schedule B", attr: "Tariff dispute", rec: "Payer via dispute", at: SA, text: "Reduced to network tariff", rule: "Tariff cut at agreed rate" });
    if (f.noClause) addLine({ head: "Pharmacy", desc: "Medicines disallowed", billed: claimed * 0.1, cut: claimed * 0.1, reason: "No reason given", clause: "None", attr: "Unclear", rec: "Payer via dispute", at: SA, text: "Disallowed", rule: "No clause cited" });
    if (f.sublimit) addLine({ head: "Package", desc: "Cataract per-eye sub-limit", billed: claimed, cut: Math.max(claimed - 30000, 0), reason: "Disease or procedure sub-limit", clause: "Policy sec 6.4 sub-limits", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: "Sub-limit INR 30000 per eye" });
    if (f.exhausted) addLine({ head: "Package", desc: "Sum insured exhausted", billed: claimed, cut: claimed - (siBalance ?? 0), reason: "Sum insured exhausted", clause: "Policy sec 2 sum insured", attr: "Contractual (policy terms)", rec: "Patient", at: DS, text: "Balance sum insured exhausted" });
    if (!f.clean && !f.denied && billingOpen && r.chance(0.15)) addLine({ head: "Implants", desc: "Implant invoice and sticker not attached", billed: claimed * 0.2, cut: claimed * 0.2, reason: "Document missing", clause: "Claim form sec 7", attr: "Hospital documentation gap", rec: "Nobody", at: SA, text: "Implant invoice not received" });
    if (!f.clean && !f.denied && r.chance(0.1)) addLine({ head: "Doctor fees", desc: "Surgeon fee above customary", billed: claimed * 0.1, cut: claimed * 0.03, reason: "Not reasonable and customary", clause: "Policy sec 8 reasonable charges", attr: "Tariff dispute", rec: "Nobody", at: SA, text: "Charges exceed reasonable and customary" });
  }

  const dischargeCuts = lines.filter((l) => l.detected_at !== SA).reduce((s, l) => s + l.amount_deducted, 0);
  const settleCuts = lines.filter((l) => l.detected_at === SA).reduce((s, l) => s + l.amount_deducted, 0);
  const approvedAtDischarge = discharge && !f.denied ? Math.max(claimed - dischargeCuts, 0) : undefined;
  const paidGross = f.denied ? 0 : approvedAtDischarge != null ? Math.max(approvedAtDischarge - settleCuts, 0) : 0;
  if (finalDecEv) stageRows.find((s) => s.event_id === finalDecEv!.id)!.amount_approved = approvedAtDischarge;

  // settlement timeline
  const txns: Record<string, unknown>[] = [];
  const lastDoc = discharge ? addDays(discharge, r.int(1, 6)) : undefined;
  const gap = f.slowPay ? r.int(46, 95) : r.chance(0.25) ? r.int(31, 55) : r.int(12, 30);
  const paymentAt = lastDoc ? addDays(lastDoc, gap) : undefined;
  const paidYet = Boolean(paymentAt && paymentAt <= now && !f.denied && paidGross > 0);

  if (discharge && lastDoc && !f.denied) {
    const disp = addMin(lastDoc, r.int(60, 600));
    ev("Claim documents dispatched", disp, { direction: "Hospital → payer", channel: r.pick(["Courier", "Portal", "Email"] as const), staff_role: "Desk executive" });
    ev("Documents acknowledged", addDays(disp, r.int(1, 3)), { direction: "Payer → hospital", staff_role: "Other" });
  }
  const bulk = payer.tpa && r.chance(0.35) ? `MOCKBULK-${payer.tpa.replace(/\W/g, "").slice(0, 4).toUpperCase()}-${paymentAt ? ymd(paymentAt).slice(0, 7) : "NA"}` : undefined;
  let tdsTotal = 0, payerGrossBooked = 0;
  if (paidYet && paymentAt && lastDoc) {
    const tds = Math.round(paidGross * 0.1);
    const unmatched = Boolean(f.unmatched);
    const days = Math.round((paymentAt.getTime() - lastDoc.getTime()) / DAY);
    txns.push({
      txn_type: "Payer payment", last_document_sent_at: ymd(lastDoc), settlement_letter_at: ymd(addDays(paymentAt, -r.int(1, 5))),
      payment_at: ymd(paymentAt), amount_gross: paidGross, tds, amount_net_received: paidGross - tds, utr: `MOCKUTR${r.int(10 ** 11, 10 ** 12 - 1)}`,
      bulk_payment_ref: bulk, match_status: unmatched ? "Unmatched" : r.chance(0.8) ? "Auto" : "Manual", days_to_match: unmatched ? undefined : r.int(0, 6),
      days_last_doc_to_payment: days,
    });
    ev("Settlement letter received", addDays(paymentAt, -r.int(1, 5)), { direction: "Payer → hospital", staff_role: "Billing" });
    ev("Payment received", paymentAt, { direction: "Payer → hospital", amount_approved: paidGross, staff_role: "Billing" });
    if (!unmatched) { tdsTotal = tds; payerGrossBooked = paidGross; }
    if (f.reversal) txns.push({
      txn_type: "Reversal", payment_at: ymd(addDays(paymentAt, 9)), amount_gross: Math.round(paidGross * 0.1), amount_net_received: Math.round(paidGross * 0.1),
      utr: `MOCKUTR${r.int(10 ** 11, 10 ** 12 - 1)}`, match_status: "Manual", approved_by_role: "Billing",
    });
  }

  // patient collections
  let collected = 0;
  const patientLines = lines.filter((l) => l.recoverable_from === "Patient");
  let writtenOff = 0;
  const biggest = patientLines.reduce((m, l, k) => (l.amount_deducted > (patientLines[m]?.amount_deducted ?? 0) ? k : m), 0);
  patientLines.forEach((l, idx) => {
    const writeThis = f.writeoff && idx === biggest;
    if (writeThis) { writtenOff += l.amount_deducted; return; }
    if (r.chance(0.88)) collected += l.amount_deducted;
  });
  if (collected > 0 && discharge) txns.push({
    txn_type: "Patient collection", payment_at: ymd(discharge), amount_gross: collected, amount_net_received: collected, match_status: r.chance(0.7) ? "Auto" : "Manual",
  });
  if (writtenOff > 0 && discharge) {
    const wd = addDays(discharge, r.int(35, 70));
    if (wd <= now) txns.push({
      txn_type: "Write-off", payment_at: ymd(wd), amount_gross: writtenOff, amount_net_received: 0, match_status: "Manual",
      writeoff_reason: f.denied ? "Patient refused" : "Not worth pursuing", approved_by_role: "Billing",
    });
    else writtenOff = 0;
  }

  // dispute recovery
  const disputeLines = lines.filter((l) => l.recoverable_from === "Payer via dispute");
  const disputed = disputeLines.reduce((s, l) => s + l.amount_deducted, 0);
  let recovered = 0;
  let disputeOutcome = f.dispute ?? (disputed > 0 ? r.pick(["Won", "Partly won", "Lost"] as const) : undefined);
  if (disputed > 0 && disputeOutcome && paidYet && paymentAt) {
    const closeAt = addDays(paymentAt, r.int(25, 70));
    const level = r.pick(L.DISPUTE_LEVELS);
    ev("Dispute raised", addDays(paymentAt, r.int(3, 12)), { direction: "Hospital → payer", staff_role: "Billing", amount_requested: disputed });
    if (disputeOutcome !== "Pending" && closeAt <= now) {
      recovered = disputeOutcome === "Won" ? disputed : disputeOutcome === "Partly won" ? Math.round(disputed * 0.5) : 0;
      ev("Dispute closed", closeAt, { direction: "Payer → hospital", staff_role: "Billing", amount_approved: recovered });
      let left = recovered;
      disputeLines.forEach((l) => { const x = Math.min(left, l.amount_deducted); l.recovered_amount = x; left -= x; });
      txns.push({
        txn_type: "Dispute recovery", payment_at: ymd(closeAt), amount_gross: recovered, amount_net_received: recovered, utr: recovered ? `MOCKUTR${r.int(10 ** 11, 10 ** 12 - 1)}` : undefined,
        match_status: "Manual", dispute_level: level, dispute_outcome: disputeOutcome, approved_by_role: "Billing",
      });
    } else disputeOutcome = "Pending";
  }

  // queries
  const queries: Record<string, unknown>[] = [];
  const nQ = f.noQueries || f.clean ? 0 : f.manyQueries ? r.int(3, 5) : r.chance(0.45) ? r.int(1, 2) : 0;
  for (let q = 0; q < nQ; q++) {
    const avail: { stage: (typeof L.QUERY_STAGES)[number]; ev?: { id: string; at: Date } }[] = [{ stage: "Pre-auth", ev: preDecEv }];
    if (enhDecs.length) avail.push({ stage: "Enhancement", ev: enhDecs[0] });
    if (finalDecEv) avail.push({ stage: "Discharge", ev: finalDecEv }, { stage: "Post-discharge claim", ev: finalDecEv });
    const a = r.pick(avail);
    const anchor = a.ev?.at ?? addMin(preSent, 45);
    const category = r.pick(L.QUERY_CATEGORIES);
    const repeat = category === "Repeat of an earlier query";
    const already = repeat || (category === "Missing document" ? r.chance(0.35) : r.chance(0.1));
    const owner = already ? "Payer" : ({
      "Missing document": "Insurance desk", "Clinical justification": "Doctor's notes", "Past history or pre-existing disease": r.pick(["Doctor's notes", "Patient"] as const),
      "Diagnosis–procedure mismatch": r.pick(["Doctor's notes", "Insurance desk"] as const), "Bill breakup": "Billing", "Tariff mismatch": r.pick(["Billing", "Payer"] as const),
      "Policy terms": "Payer", "Investigation report": r.pick(["Insurance desk", "Doctor's notes"] as const), "Repeat of an earlier query": "Payer", Other: r.pick(L.ROOT_CAUSE_OWNERS),
    } as Record<string, string>)[category];
    const avoidable = ["Payer", "Patient"].includes(owner) ? "No" : r.chance(0.1) ? "Unclear" : "Yes";
    const raised = addMin(anchor, r.int(2, 40));
    const open = f.stillAdmitted && q === 0;
    const answered = open ? undefined : addMin(raised, r.int(30, 600));
    const closed = open || !answered ? undefined : addMin(answered, r.int(20, 1500));
    const outcome = open ? "Still open" : r.chance(0.05) ? "Closed unanswered" : r.pick(["Approved as asked", "Approved as asked", "Approved as asked", "Approved reduced", "Approved reduced", "Denied"] as const);
    queries.push({
      event_id: a.ev?.id, query_stage: a.stage, raised_at: iso(raised), answered_at: answered && iso(answered), closed_at: closed && iso(closed),
      query_category: category, documents_asked: category === "Missing document" ? [r.pick(L.DOCUMENTS_ASKED), r.pick(L.DOCUMENTS_ASKED)].filter((x, k, arr) => arr.indexOf(x) === k) : undefined,
      already_submitted: already ? "Yes" : "No", rounds: repeat ? r.int(2, 4) : r.int(1, 2), root_cause_owner: owner, avoidable,
      amount_at_stake: r.chance(0.6) ? round(claimed * r.between(0.05, 0.4), 1000) : undefined, outcome, payer_text: "Please provide clarification / documents as per policy terms",
    });
  }

  // header + status
  const settledGross = payerGrossBooked || undefined;
  let status = "Open";
  if (f.stillAdmitted) status = queries.some((x) => x.outcome === "Still open") ? "Under query" : "Open";
  else if (f.denied) status = writtenOff > 0 ? "Written off" : "Denied";
  else if (paidYet && !f.unmatched) status = disputeOutcome === "Pending" || (disputed > 0 && recovered === 0 && disputeOutcome === undefined) ? "Part-settled" : "Settled";
  else if (discharge && lastDoc && discharge < addDays(now, -5)) status = "Awaiting settlement";
  else if (discharge) status = "Approved";

  const form = {
    uhid_raw: uhidRaw, admission_type: emergency ? "Emergency" : "Planned", admission_at: iso(admission), discharge_at: discharge && iso(discharge),
    department: prof.dept, age_band: r.pick(["18–40", "41–60", "61+", "61+", "0–17"] as const), primary_diagnosis_icd10: r.pick(prof.icd), procedure_code: r.pick(prof.proc),
    billing_mode: billingOpen ? "Open (itemised)" : "Package", treating_doctor_code: `DR-${r.int(100, 130)}`, room_category_occupied: roomCat, room_rent_charged_per_day: rentPerDay,
    room_days: roomDays, icu_days: icuDays, payer_channel: payer.payer_channel, insurer: payer.insurer, tpa: payer.tpa, policy_type: payer.policy_type,
    tariff_basis: payer.tariff_basis, submission_channel: payer.submission_channel, room_rent_limit_per_day: limitText, sum_insured_balance: siBalance, copay_pct: copay,
    disease_sublimit_amount: f.sublimit ? 30000 : undefined, disease_sublimit_condition: f.sublimit ? "Cataract per eye" : undefined, consumables_cover: payer.consumables_cover,
    policy_years_continuous: payer.policy_type === "Government" ? undefined : r.int(1, 12), estimate_at_admission: estimate, preauth_requested: requested,
    preauth_approved_initial: initialApproved, final_bill_gross: discharge ? gross : undefined, hospital_discount: discharge && discount ? discount : undefined,
    final_approved_at_discharge: approvedAtDischarge, claim_status: status,
  } as unknown as ClaimFormValues;
  const parsed = claimFormSchema.safeParse(form);
  if (!parsed.success) throw new Error(`Mock claim ${uhidRaw} fails the wizard schema: ` + parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "));
  const { uhid_raw: _drop, ...f2 } = parsed.data;
  void _drop;

  const claim = {
    ...f2, admission_at: iso(admission), discharge_at: discharge ? iso(discharge) : null,
    enhancement_approved_total: nEnh ? enhApproved : null, final_bill_gross: discharge ? gross : null, hospital_discount: discharge && discount ? discount : null,
    final_bill_claimed: discharge ? claimed : null, final_approved_at_discharge: approvedAtDischarge ?? null,
    collected_from_patient: discharge ? collected : null, settled_by_payer_gross: settledGross ?? null, tds: tdsTotal || null,
  };
  const shortfall = discharge ? claimed - payerGrossBooked - collected - recovered : 0;
  return { uhidRaw, note: f.note, claim, stages: stageRows.sort((a, b) => String(a.event_at).localeCompare(String(b.event_at))), queries, deductions: lines, txns, summary: { shortfall, claimed: discharge ? claimed : 0, status, lines: lines.length, queries: queries.length } };
}

/** Build the standard set of 40: 20 deliberate cases, then 20 random ones. */
export function buildAll(now = new Date()): Bundle[] {
  const r = makeRng(20261026);
  const out: Bundle[] = [];
  for (let i = 0; i < 40; i++) {
    const f: Flags = SCENARIOS[i] ?? { note: "Random mix" };
    out.push(buildClaim(i, f, r, now));
  }
  return out;
}
