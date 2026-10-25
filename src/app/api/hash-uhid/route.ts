import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashUhidServer } from "@/lib/hash-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { uhid } -> { hash }. Signed-in team members only. Never logs or stores the raw UHID. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let uhid: unknown;
  try {
    ({ uhid } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (typeof uhid !== "string" || uhid.trim().length === 0 || uhid.length > 64) {
    return NextResponse.json({ error: "Enter a valid UHID" }, { status: 400 });
  }
  try {
    return NextResponse.json({ hash: hashUhidServer(uhid) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }
}
