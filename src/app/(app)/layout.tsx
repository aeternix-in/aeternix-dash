import { FilePlus2, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/layout/nav-link";
import { SignOutButton } from "@/components/layout/sign-out";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="px-2 pb-6">
          <p className="font-semibold tracking-tight">Aeternix</p>
          <p className="text-xs text-muted">Claim leakage tracker</p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink href="/claims">
            <ListChecks size={16} aria-hidden /> Claims
          </NavLink>
          <NavLink href="/claims/new">
            <FilePlus2 size={16} aria-hidden /> New claim
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <p className="truncate px-2 text-xs text-muted" title={user?.email ?? ""}>
            {user?.email}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <p className="font-semibold tracking-tight">Aeternix</p>
          <div className="flex items-center gap-1">
            <NavLink href="/claims">Claims</NavLink>
            <NavLink href="/claims/new">New</NavLink>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
