import { createHash } from "node:crypto";

/**
 * Server-only. Hashes a UHID with the secret salt (UHID_SALT, no NEXT_PUBLIC_ prefix, so it is
 * never sent to browsers). Same recipe as before (SHA-256 over "salt:UHID"), so hashes made with
 * the old browser version and the same salt value still match.
 */
export function hashUhidServer(raw: string): string {
  const salt = process.env.UHID_SALT;
  if (!salt || salt.length < 16) {
    throw new Error("UHID_SALT is missing or too short. Set it in .env.local and in Vercel.");
  }
  return createHash("sha256").update(`${salt}:${raw.trim().toUpperCase()}`).digest("hex");
}
