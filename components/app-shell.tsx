import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Building2, CreditCard, LayoutDashboard, LogOut, ReceiptText, Settings } from "lucide-react";
import { auth, signOut } from "@/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileSelect } from "@/components/profile-select";
import { switchProfile } from "@/server/actions/profile";
import { getActiveProfile, getActiveSettings, getProfiles } from "@/server/profile";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [profiles, activeProfile, activeSettings] = await Promise.all([getProfiles(), getActiveProfile(), getActiveSettings()]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card p-4 lg:block">
        <div className="mb-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoice Suite</p>
          <div className="mt-1 flex items-center gap-3">
            <img src={activeSettings?.logoUrl || "/poojaenterpiseslogo.png"} alt={activeProfile.name} className="h-16 w-auto object-contain" />
            <h1 className="text-xl font-semibold">{activeProfile.name}</h1>
          </div>
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur lg:h-16 lg:px-8 lg:py-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="truncate font-medium">{session.user.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <form action={switchProfile} className="hidden sm:block">
              <ProfileSelect
                key={activeProfile.id}
                name="profileId"
                defaultValue={activeProfile.id}
                profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
                className="h-9 rounded-md border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </form>
            <form action="/invoices" className="hidden md:block">
              <input
                name="q"
                className="h-9 w-72 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search invoices, customers, GSTIN"
              />
            </form>
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>
        </header>
        <nav className="no-print flex gap-2 overflow-x-auto border-b bg-card px-4 py-2 lg:hidden">
          <form action={switchProfile} className="flex shrink-0 gap-2">
            <ProfileSelect
              key={activeProfile.id}
              name="profileId"
              defaultValue={activeProfile.id}
              profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
              className="h-9 rounded-md border bg-card px-2 text-sm outline-none"
            />
          </form>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 p-3 sm:p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
