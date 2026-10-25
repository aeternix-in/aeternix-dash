# Aeternix claim leakage tracker

Phase 1 and 2: scaffold, login, claims list, new-claim wizard. Next.js 15, TypeScript, Tailwind 4, Supabase.

## Setup on Xubuntu

```bash
# 1. Node.js 22 via nvm (no sudo needed for npm packages afterwards)
sudo apt update && sudo apt install -y curl unzip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
node -v && npm -v

# 2. Install dependencies
cd aeternix-dash
npm install

# 3. Environment
cp .env.example .env.local
openssl rand -hex 32        # paste this as UHID_SALT
nano .env.local             # fill in the Supabase URL, publishable key and UHID_SALT

# 4. Run
npm run dev                 # http://localhost:3000
```

## Supabase (one time, in the dashboard)

1. SQL Editor: paste `supabase/migrations/0001_init.sql` and run it.
2. Authentication, Users: add each team member with email and password, tick auto-confirm.
3. Authentication, Sign In / Providers: turn off "Allow new users to sign up".

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build
- `npm run lint` type check

## Notes

- Dropdown lists live in `src/lib/enums.ts`. Edit them freely; the DB stores plain text.
- UHID is hashed on the server (`/api/hash-uhid`, `src/lib/hash-server.ts`) with the secret `UHID_SALT`; keep it fixed once data exists. Never prefix it with `NEXT_PUBLIC_`.
- The wizard keeps an unfinished draft in browser storage (never the raw UHID).
- Never put the Supabase secret / service-role key in this app.

## Phase 5: seed data and friction log

```bash
# one time: add a study-team login to .env.local (the one you use to sign in to the app)
nano .env.local        # SEED_EMAIL=...  SEED_PASSWORD=...

npm run seed:dry       # builds and validates the 40 mock claims, prints a table, writes nothing
npm run seed           # inserts them (header, stage log, queries, deductions, settlement)
npm run seed:clean     # deletes exactly the claims the seed inserted (safe to re-run the seed after)
```

- The 40 claims are deterministic. The first 20 are deliberate edge cases (eye-pad cuts, ICU proportionate cut,
  consumables cut despite add-on, agreed-rate cut, denial with write-off, exhausted sum insured, unmatched payment,
  reversal, still admitted, PM-JAY, CGHS, per-eye sub-limit, no clause cited). The other 20 are a random mix.
- Every header is validated with the same zod schema as the wizard before it is inserted.
- All values are invented; payer references and UTRs are prefixed `MOCK`.
- `docs/manual-entry-sheet.md` lists 12 claims to type in by hand; log findings in `FRICTION_LOG.md`.
