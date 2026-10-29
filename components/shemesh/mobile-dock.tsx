"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Megaphone, Menu, Users, Wallet } from "lucide-react";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activePath } from "@/lib/nav-path";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/shemesh", label: "בקרה", icon: LayoutDashboard, exact: true },
  { href: "/shemesh/marketing", label: "שיווק", icon: Megaphone, exact: false },
  { href: "/shemesh/leads", label: "לידים", icon: Users, exact: false },
  { href: "/shemesh/revenue", label: "כספים", icon: Wallet, exact: false },
];

export function ShemeshMobileDock() {
  const pathname = activePath(usePathname(), useSearchParams().get("view"));

  return (
    <nav className="mobile-dock shemesh-os lg:hidden print:hidden" aria-label="ניווט שמש">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          className="shemesh-os w-[min(18rem,88vw)] border-s border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
          <ShemeshSidebar className="h-full w-full border-e-0" />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
