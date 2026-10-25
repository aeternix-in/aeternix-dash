/**
 * Browser-side helper. The raw UHID is sent over HTTPS to /api/hash-uhid, which hashes it with a
 * secret salt that only exists on the server. The raw UHID is never stored or logged.
 * (Name and signature are unchanged, so existing imports keep working.)
 */
export async function hashUhid(raw: string): Promise<string> {
  const res = await fetch("/api/hash-uhid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uhid: raw }),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Your session expired. Sign in again and retry.");
  if (!res.ok) throw new Error("Could not secure the UHID. Try again.");
  const { hash } = (await res.json()) as { hash: string };
  return hash;
}
