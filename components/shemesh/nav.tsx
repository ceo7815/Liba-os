"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Cable,
  Calculator,
  FileText,
  BadgeDollarSign,
  Landmark,
  LayoutDashboard,
  LineChart,
  Shield,
  Megaphone,
  Receipt,
  Rows3,
  Scale,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS: {
  title: string;
  items: { href: string; label: string; icon: LucideIcon; exact?: boolean }[];
}[] = [
  {
    title: "עבודה",
    items: [
      { href: "/shemesh", label: "לוח בקרה", icon: LayoutDashboard, exact: true },
      { href: "/shemesh/gviya", label: "פדיונות", icon: BadgeDollarSign },
      { href: "/shemesh/tax-refunds", label: "החזרי מס", icon: Scale },
      { href: "/shemesh/marketing", label: "שיווק", icon: Megaphone },
      { href: "/shemesh/leads", label: "לידים", icon: Users },
      { href: "/shemesh/sales", label: "שורות מכירה", icon: Rows3 },
      { href: "/shemesh/portfolio-report", label: "השוואת תיק", icon: FileText },
    ],
  },
  {
    title: "כספים",
    items: [
      { href: "/shemesh/revenue", label: "הכנסות", icon: Wallet },
      { href: "/shemesh/expenses", label: "הוצאות", icon: Receipt },
      { href: "/shemesh/reports", label: "רווח והפסד", icon: LineChart },
    ],
  },
  {
    title: "מערכת",
    items: [
      { href: "/shemesh/costs", label: "הוצאות קבועות", icon: Receipt },
      { href: "/shemesh/receipts", label: "קבלות", icon: Landmark },
      { href: "/shemesh/insurance", label: "ביטוח", icon: Shield },
      { href: "/shemesh/settlement", label: "התחשבנות", icon: Wallet },
      { href: "/shemesh/payroll", label: "שכר", icon: Users },
      { href: "/shemesh/sources", label: "מקורות", icon: Cable },
      { href: "/shemesh/formulas", label: "נוסחאות שמש", icon: Calculator },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShemeshSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-e border-black/[0.08] bg-white",
        className,
      )}
    >
      <div className="flex flex-col items-center px-6 pb-3 pt-5">
        <Link href="/shemesh" className="block">
          <Image
            src="/brand/shemesh-logo.png"
            alt="שמש מימוש זכויות"
            width={605}
            height={782}
            priority
            className="h-28 w-auto object-contain"
          />
        </Link>
        <div className="mt-3 h-px w-full bg-black/[0.06]">
          <div className="mx-auto h-px w-10 bg-highlight" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <ShemeshNavItem
                  key={item.href}
                  {...item}
                  active={isActive(pathname, item.href, item.exact)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-black/[0.06] px-5 py-4 text-center">
        <p className="text-[11px] font-semibold text-foreground">שמש</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">מימוש זכויות</p>
        <Link
          href="/login?pick=1"
          className="mt-2 inline-block text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          החלפת מערכת
        </Link>
      </div>
    </aside>
  );
}

function ShemeshNavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-highlight/10 text-foreground"
          : "text-black/55 hover:bg-highlight/10 hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1.5 start-0 w-[2px] rounded-full bg-highlight" />
      ) : null}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-black/35")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
