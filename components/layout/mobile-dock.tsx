"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Megaphone, Menu, Wallet } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { canAccessFinance } from "@/lib/finance/access";
import { LEAD_CONTROL_PATH } from "@/lib/lead-control/rules";
import { CAMPAIGNS_PATH, canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function MobileDock({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items: Item[] = [{ href: "/dashboard", label: "בקרה", icon: LayoutDashboard }];
  if (canAccessSalesDashboard(profile)) {
    items.push({ href: LEAD_CONTROL_PATH, label: "לידים", icon: ListChecks });
    items.push({ href: CAMPAIGNS_PATH, label: "קמפיינים", icon: Megaphone });
  }
  if (canAccessFinance(profile)) {
    items.push({ href: "/finance", label: "כספים", icon: Wallet });
  }

  return (
    <nav className="mobile-dock lg:hidden" aria-label="ניווט ראשי">
      {items.slice(0, 4).map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard" || pathname === "/design-lab"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("mobile-dock-item", active && "mobile-dock-item-active")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger className="mobile-dock-item" aria-label="כל התפריט">
          <Menu className="size-5" />
          <span>תפריט</span>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-[min(18rem,88vw)] border-s border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
          <Sidebar profile={profile} className="h-full w-full" />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
