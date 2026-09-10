"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Contact, KeyRound, Layers3, LayoutDashboard, Search, TrendingUp, Users, Wallet, X } from "lucide-react";
import { agents } from "@/lib/agents.config";
import { portals } from "@/lib/portals.config";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SearchItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
};

type GlobalSearchProps = {
  isAdmin: boolean;
  canAccessFinance?: boolean;
  canAccessSalesDashboard?: boolean;
};

export function GlobalSearch({
  isAdmin,
  canAccessFinance = false,
  canAccessSalesDashboard = false,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const catalog = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [
      {
        id: "dashboard",
        label: "לוח בקרה",
        description: "סקירה כללית של המערכת",
        href: "/dashboard",
        icon: LayoutDashboard,
        keywords: ["dashboard", "לוח", "בקרה", "בית"],
      },
      {
        id: "agents",
        label: "סוכני AI",
        description: "רשימת הסוכנים במערכת",
        href: "/agents",
        icon: Bot,
        keywords: ["ai", "סוכן", "סוכנים", "agents"],
      },
      {
        id: "portals",
        label: "איחוד פורטלים",
        description: "ריכוז נתונים מחברות הביטוח",
        href: "/portals",
        icon: Layers3,
        keywords: ["פורטל", "פורטלים", "ביטוח", "portals", "איחוד"],
      },
      {
        id: "vault",
        label: "כספת סיסמאות",
        description: "סיסמאות לאתרים, שרתים ופורטלי ביטוח",
        href: "/vault",
        icon: KeyRound,
        keywords: [
          "כספת",
          "סיסמה",
          "סיסמאות",
          "vault",
          "password",
          "פייסבוק",
          "שרת",
        ],
      },
      ...agents.map((agent) => ({
        id: `agent-${agent.slug}`,
        label: agent.name,
        description: agent.description,
        href: agent.href,
        icon: Bot,
        keywords: [agent.slug, agent.name, "ai", "סוכן"],
      })),
      ...portals.map((portal) => ({
        id: `portal-${portal.slug}`,
        label: `פורטל ${portal.name}`,
        description: portal.description,
        href: portal.href,
        icon: Layers3,
        keywords: [portal.slug, portal.name, "פורטל", "ביטוח"],
      })),
    ];

    if (canAccessSalesDashboard) {
      items.push({
        id: "sales-dashboard",
        label: "דשבורד מכירות",
        description: "מסך מכירות חי מאקסל OneDrive",
        href: "/sales-dashboard",
        icon: TrendingUp,
        keywords: [
          "מכירות",
          "דשבורד",
          "sales",
          "excel",
          "onedrive",
          "פרמיה",
          "פוליסות",
          "tv",
        ],
      });
    }

    if (canAccessFinance) {
      items.push({
        id: "finance",
        label: "חשבונות ליבה",
        description: "הכנסות, הוצאות, משכורות עובדים ורווח והפסד",
        href: "/finance",
        icon: Wallet,
        keywords: [
          "חשבונות ליבה",
          "חשבונות",
          "פיננסים",
          "finance",
          "הכנסות",
          "הוצאות",
          "משכורות",
          "רווח",
          "הפסד",
          "עמלות",
          "בנק",
        ],
      });
    }

    if (isAdmin) {
      items.push(
        {
          id: "employees",
          label: "עובדים",
          description: "רשימת עובדי הסוכנות — שמות, חיוג וטלפונים",
          href: "/employees",
          icon: Contact,
          keywords: [
            "עובדים",
            "עובד",
            "employees",
            "צוות",
            "חיוג",
            "טלפון",
            "מחלקה",
          ],
        },
        {
          id: "users",
          label: "ניהול משתמשים",
          description: "תפקידים והשבתה",
          href: "/dashboard/users",
          icon: Users,
          keywords: ["users", "משתמשים", "admin", "ניהול", "כניסה"],
        },
      );
    }

    return items;
  }, [isAdmin, canAccessFinance, canAccessSalesDashboard]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 5);
    return catalog
      .filter((item) => {
        const haystack = [item.label, item.description, ...item.keywords]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 6);
  }, [catalog, query]);

  function goTo(href: string) {
    setOpen(false);
    setSheetOpen(false);
    setQuery("");
    router.push(href);
  }

  const field = (inputId: string) => (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" />
      <input
        id={inputId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            goTo(results[0].href);
          }
        }}
        placeholder="חיפוש במערכת..."
        autoComplete="off"
        className="h-10 w-full rounded-2xl border border-black/[0.06] bg-background pe-9 ps-9 text-sm text-foreground outline-none transition-[border-color,background-color,box-shadow] placeholder:text-muted-foreground focus:border-black/15 focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,212,0,0.28)] sm:h-9 sm:rounded-lg"
      />
      {query ? (
        <button
          type="button"
          aria-label="ניקוי חיפוש"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setQuery("")}
          className="absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-black/35 hover:bg-black/[0.04] hover:text-black"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );

  const resultsList = (
    <>
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {query.trim() ? "תוצאות" : "מעבר מהיר"}
      </div>
      {results.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          אין תוצאות עבור &quot;{query}&quot;
        </p>
      ) : (
        <ul className="max-h-[min(60vh,22rem)] overflow-auto p-1 sm:max-h-72">
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors active:bg-highlight/25 hover:bg-background sm:rounded-lg sm:py-2",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background sm:h-8 sm:w-8 sm:rounded-md">
                    <Icon className="h-3.5 w-3.5 text-black/50" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <>
      <div className="sm:hidden">
        <Sheet
          open={sheetOpen}
          onOpenChange={(next) => {
            setSheetOpen(next);
            if (!next) setQuery("");
          }}
        >
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl active:scale-95"
              aria-label="חיפוש במערכת"
            >
              <Search className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="top"
            className="flex h-[min(92dvh,40rem)] flex-col gap-0 border-b border-black/[0.08] bg-white p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">חיפוש במערכת</SheetTitle>
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-3">
              <div className="min-w-0 flex-1">{field("global-search-mobile")}</div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold"
                onClick={() => {
                  setSheetOpen(false);
                  setQuery("");
                }}
              >
                סגור
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">{resultsList}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative hidden w-full max-w-md sm:block">
        <label htmlFor="global-search" className="sr-only">
          חיפוש במערכת
        </label>
        {field("global-search")}
        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_16px_40px_-20px_rgba(17,17,17,0.35)]">
            {resultsList}
          </div>
        ) : null}
      </div>
    </>
  );
}
