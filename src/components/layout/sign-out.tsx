"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-canvas hover:text-ink"
    >
      <LogOut size={15} aria-hidden /> Sign out
    </button>
  );
}
