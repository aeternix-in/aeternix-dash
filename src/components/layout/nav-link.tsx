"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/claims" && pathname.startsWith(href));
  const isClaimsRoot = href === "/claims" && pathname.startsWith("/claims") && !pathname.startsWith("/claims/new");
  const on = href === "/claims" ? isClaimsRoot : active;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}
