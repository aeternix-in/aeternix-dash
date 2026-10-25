/**
 * Seed 40 mock claims into Supabase through the same row-level-security rules the app uses.
 * Signs in as one of your study-team users (no service-role key needed).
 *
 *   npm run seed:dry     build and validate the 40 claims, print a summary, touch nothing
 *   npm run seed         insert them
 *   npm run seed:clean   delete every claim this script inserted (ids saved in scripts/.seeded-ids.json)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { hashUhidServer } from "../src/lib/hash-server";
import { buildAll, type Bundle } from "./seed/generate";

const IDS_FILE = new URL("./.seeded-ids.json", import.meta.url).pathname;
const mode = process.argv[2] ?? "--insert";

function summarise(all: Bundle[]) {
  const pad = (s: string | number, n: number) => String(s).padEnd(n).slice(0, n);
  console.log(`\n${pad("#", 4)}${pad("status", 22)}${pad("dept", 28)}${pad("payer", 26)}${pad("lines", 6)}${pad("queries", 8)}${pad("shortfall", 10)} scenario`);
  all.forEach((b, i) => {
    const c = b.claim as Record<string, string>;
    console.log(`${pad(i + 1, 4)}${pad(b.summary.status, 22)}${pad(c.department, 28)}${pad(c.insurer + (c.tpa ? "/" + c.tpa : ""), 26)}${pad(b.summary.lines, 6)}${pad(b.summary.queries, 8)}${pad(Math.round(b.summary.shortfall), 10)} ${b.note}`);
  });
  const count = (f: (b: Bundle) => number) => all.reduce((s, b) => s + f(b), 0);
  console.log(`\nclaims ${all.length} | stage events ${count((b) => b.stages.length)} | queries ${count((b) => b.queries.length)} | deduction lines ${count((b) => b.deductions.length)} | settlement rows ${count((b) => b.txns.length)}`);
  const bad = all.filter((b) => b.summary.shortfall < 0);
  if (bad.length) throw new Error(`Negative shortfall in ${bad.map((b) => b.uhidRaw).join(", ")}`);
}

async function signedIn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.SEED_EMAIL, password = process.env.SEED_PASSWORD;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  if (!email || !password) throw new Error("Add SEED_EMAIL and SEED_PASSWORD (a study-team login) to .env.local");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Sign-in failed: " + error.message);
  return sb;
}

const clean = (rows: Record<string, unknown>[], claim_id: string) =>
  rows.map((r) => ({ ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)), claim_id }));

async function main() {
  const all = buildAll();
  if (mode === "--dry") { summarise(all); console.log("\nDry run only. Nothing was written."); return; }

  const sb = await signedIn();
  if (mode === "--clean") {
    if (!existsSync(IDS_FILE)) { console.log("No seeded ids on record. Nothing to delete."); return; }
    const ids: string[] = JSON.parse(readFileSync(IDS_FILE, "utf8"));
    const { error } = await sb.from("claims").delete().in("claim_id", ids); // child rows cascade
    if (error) throw new Error(error.message);
    unlinkSync(IDS_FILE);
    console.log(`Deleted ${ids.length} mock claims and their child rows.`);
    return;
  }

  if (existsSync(IDS_FILE)) throw new Error("Mock claims were already seeded. Run `npm run seed:clean` first.");
  summarise(all);
  const ids: string[] = [];
  try {
    for (const b of all) {
      const uhid_hash = hashUhidServer(b.uhidRaw);
      const { data, error } = await sb.from("claims").insert({ ...b.claim, uhid_hash }).select("claim_id").single();
      if (error) throw new Error(`${b.uhidRaw}: ${error.message}`);
      const id = data.claim_id as string;
      ids.push(id);
      const steps: [string, Record<string, unknown>[]][] = [
        ["stage_log", b.stages], ["query_log", b.queries], ["deduction_lines", b.deductions], ["settlement_txns", b.txns],
      ];
      for (const [table, rows] of steps) {
        if (!rows.length) continue;
        const { error: e } = await sb.from(table).insert(clean(rows, id));
        if (e) throw new Error(`${b.uhidRaw} → ${table}: ${e.message}`);
      }
      process.stdout.write(".");
    }
  } finally {
    if (ids.length) writeFileSync(IDS_FILE, JSON.stringify(ids)); // so seed:clean can undo a partial run
  }
  console.log(`\nInserted ${ids.length} mock claims (${ids[0]} to ${ids[ids.length - 1]}).`);
}

main().catch((e) => { console.error("\n" + (e instanceof Error ? e.message : e)); process.exit(1); });
