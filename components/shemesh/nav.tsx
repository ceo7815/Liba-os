"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  Building2,
  Cable,
  Calculator,
  ChevronDown,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageSquare,
  Receipt,
  Rows3,
  Scale,
  Settings,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SHEMESH_IA } from "@/lib/shemesh/ia";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/shemesh": LayoutDashboard,
  "/shemesh/clients": Users,
  "/shemesh/alerts": Bell,
  "/shemesh/cases": ClipboardList,
  "/shemesh/gviya": BadgeDollarSign,
  "/shemesh/tax-refunds": Scale,
  "/shemesh/portfolio-report": FileText,
  "/shemesh/insurance": Shield,
  "/shemesh/commercial": Megaphone,
  "/shemesh/leads": Users,
  "/shemesh/revival": MessageSquare,
  "/shemesh/marketing": Megaphone,
  "/shemesh/sales": Rows3,
  "/shemesh/sources": Cable,
  "/shemesh/finance": Wallet,
  "/shemesh/revenue": Wallet,
  "/shemesh/income": Wallet,
  "/shemesh/expenses": Receipt,
  "/shemesh/costs": Receipt,
  "/shemesh/debts": Landmark,
  "/shemesh/commissions": BadgeDollarSign,
  "/shemesh/receipts": Landmark,
  "/shemesh/payroll": Users,
  "/shemesh/reports": LineChart,
  "/shemesh/settlement": Wallet,
  "/shemesh/system": Settings,
  "/shemesh/agency": Building2,
  "/shemesh/formulas": Calculator,
  "/shemesh/settings": Settings,
  "/shemesh/permissions": Shield,
};

const STORAGE_KEY = "shemesh-nav-open";

function activeHref(pathname: string, href: string, exact?: boolean) {
  if (exact || href === "/shemesh") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShemeshSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let stored: Record<string, boolean> = {};
    let hasStored = false;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
      hasStored = Object.keys(stored).length > 0;
    } catch {
      stored = {};
    }
    const next: Record<string, boolean> = {};
    for (const group of SHEMESH_IA) {
      if (group.items.length === 0) continue;
      const contains = group.items.some((item) => activeHref(pathname, item.href)) || pathname === group.href;
      next[group.id] = contains || (hasStored ? Boolean(stored[group.id]) : true);
    }
    setOpen(next);
  }, [pathname]);

  function toggle(id: string) {
    setOpen((current) => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside className={cn("side-glass m-3 me-2 flex w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-[28px] shadow-card backdrop-blur-xl", className)}>
      <div className="flex flex-col items-center px-6 pb-3 pt-5">
        <Link href="/shemesh" className="logo-plate block rounded-lg px-3 py-2">
          <Image src="/brand/shemesh-logo.png" alt="שמש מימוש זכויות" width={605} height={782} priority className="h-24 w-auto object-contain" />
        </Link>
        <div className="mt-3 h-px w-full bg-white/80">
          <div className="mx-auto h-px w-10 bg-[#2f86ea]/40" />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {SHEMESH_IA.map((group) => {
          const Icon = ICONS[group.href] ?? LayoutDashboard;
          const childActive = group.items.some((item) => activeHref(pathname, item.href));
          const groupActive = activeHref(pathname, group.href, group.exact) || childActive;
          if (group.items.length === 0) {
            return <NavLink key={group.id} href={group.href} label={group.label} icon={Icon} active={groupActive} />;
          }
          const expanded = open[group.id] ?? groupActive;
          return (
            <div key={group.id}>
              <div className="flex items-center gap-0.5">
                <Link href={group.href} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold", groupActive && !childActive && "nav-live")}>
                  <Icon className={cn("nav-icon h-4 w-4 shrink-0", groupActive && !childActive ? "text-inherit" : "text-[#2f86ea]")} />
                  <span className="truncate">{group.label}</span>
                </Link>
                <button type="button" aria-expanded={expanded} aria-label={expanded ? "סגירה" : "פתיחה"} onClick={() => toggle(group.id)} className="me-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "")} />
                </button>
              </div>
              {expanded ? (
                <div className="ms-4 space-y-0.5 border-s border-white/70 ps-2">
                  {group.items.map((item) => (
                    <NavLink key={item.href} href={item.href} label={item.label} icon={ICONS[item.href] ?? Icon} active={activeHref(pathname, item.href)} nested />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/70 px-5 py-4 text-center">
        <p className="text-[11px] font-semibold">שמש</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">מימוש זכויות</p>
        <Link href="/login?pick=1" className="mt-2 inline-block text-[11px] text-muted-foreground underline-offset-4 hover:underline">החלפת מערכת</Link>
      </div>
    </aside>
  );
}

function NavLink({ href, label, icon: Icon, active, nested }: { href: string; label: string; icon: LucideIcon; active: boolean; nested?: boolean }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className={cn(
        "relative flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition-colors",
        nested ? "font-medium" : "font-semibold",
        active ? "nav-live" : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
      )}
    >
      {active ? <span className="size-1.5 shrink-0 rounded-full bg-white/80" /> : null}
      <Icon className={cn("nav-icon h-4 w-4 shrink-0", active ? "text-inherit" : "text-[#0e8f9c]")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
