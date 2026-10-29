"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Calculator, Contact, FileSpreadsheet, GraduationCap, KeyRound, Layers3, LayoutDashboard, ListChecks, Megaphone, PieChart, Search, UserRound, Users, Wallet, X } from "lucide-react";
import { agents } from "@/lib/agents.config";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { portals } from "@/lib/portals.config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FORMULAS_PATH } from "@/lib/formulas/access";
import { cn } from "@/lib/utils";

type SearchItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
};

type CustomerHit = {
  id: string;
  client: string;
  description: string;
  href: string;
  haystack: string;
  digits: string;
  nameRank: string;
};

function foldSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function customerHref(client: string): string {
  return `/sales-dashboard/excel?q=${encodeURIComponent(client)}`;
}

type GlobalSearchProps = {
  isAdmin: boolean;
  canAccessFinance?: boolean;
  canAccessSalesDashboard?: boolean;
  canViewFormulas?: boolean;
  canAccessAcademy?: boolean;
};

export function GlobalSearch({
  isAdmin,
  canAccessFinance = false,
  canAccessSalesDashboard = false,
  canViewFormulas = false,
  canAccessAcademy = false,
}: GlobalSearchProps) {
  const router = useRouter();
  const { dashboard } = useLiveDashboard();
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      items.push(
        {
          id: "lead-control",
          label: "בקרת לידים",
          description: "סטטוסים של לידים ותהליכים, ושעון הזמן של כל אחד",
          href: "/lead-control",
          icon: ListChecks,
          keywords: [
            "בקרת לידים",
            "לידים",
            "תהליכים",
            "סטטוס",
            "סופיה",
            "משי",
            "מינוי סוכן",
            "שיקוף",
            "הפקה",
          ],
        },
        {
          id: "sales-by-source",
          label: "פילוח מכירות",
          description: "לפי מקור, לפי עובד ולפי חברה",
          href: "/sales-dashboard/by-source",
          icon: PieChart,
          keywords: [
            "מכירות לפי מקור",
            "מקור",
            "צנורת",
            "ממתינה",
            "קמפיין",
            "גוגל",
            "פייסבוק",
            "שיווק",
          ],
        },
        {
          id: "campaigns",
          label: "קמפיינים",
          description: "קמפיינים בגוגל ובפייסבוק, מחיר לליד ושיחות נכנסות",
          href: "/sales-dashboard/campaigns",
          icon: Megaphone,
          keywords: [
            "קמפיינים",
            "קמפיין",
            "גוגל",
            "פייסבוק",
            "מודעות",
            "ליד",
            "שיחות נכנסות",
            "cpl",
          ],
        },
        {
          id: "sales-excel-report",
          label: "שורות מכירה",
          description: "כל השורות והעמודות מהקובץ, בטבלה לעבודה",
          href: "/sales-dashboard/excel",
          icon: FileSpreadsheet,
          keywords: [
            "דוח מכירות",
            "דוח אקסל מכירות",
            "אקסל",
            "דוח מנהלים",
            "טבלה",
            "excel",
            "גיליון",
            "משווק",
            "פוליסה",
          ],
        },
      );
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

    if (canAccessAcademy) {
      items.push({
        id: "academy",
        label: "הדרכה",
        description: "מסלולי הכשרה, שיעורים ומבחנים",
        href: "/academy",
        icon: GraduationCap,
        keywords: [
          "הדרכה",
          "academy",
          "קורס",
          "שיעור",
          "מבחן",
          "הכשרה",
          "לימוד",
        ],
      });
    }

    if (canViewFormulas) {
      items.push({
        id: "formulas",
        label: "נוסחאות חישוב",
        description: "לידים, שכר עצמאים וכל נוסחאות המערכת",
        href: FORMULAS_PATH,
        icon: Calculator,
        keywords: [
          "נוסחאות",
          "חישוב",
          "לידים",
          "עצמאים",
          "שכר",
          "CPL",
          "אלכסנדר",
          "רועי",
          "אביחי",
          "formula",
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
  }, [isAdmin, canAccessFinance, canAccessSalesDashboard, canViewFormulas, canAccessAcademy]);

  const customers = useMemo<CustomerHit[]>(() => {
    if (!canAccessSalesDashboard) return [];
    const rows = dashboard?.marketing?.productions ?? [];
    const byClient = new Map<string, CustomerHit & { count: number }>();
    for (const row of rows) {
      const client = row.client?.trim() ?? "";
      const named = client !== "" && client !== "—" && client !== "-";
      const label = named ? client : "";
      const group = named ? foldSearch(client) : row.key;
      const bits = [
        label,
        row.agent,
        row.product,
        row.company,
        row.source,
        row.process,
        row.statusRaw,
        row.transferDate,
        row.startDate,
        row.premium ? String(row.premium) : "",
        ...Object.values(row.fields ?? {}),
      ].filter((part) => part && part !== "—" && part !== "-");
      const haystack = foldSearch(bits.join(" "));
      const digits = haystack.replace(/\D/g, "");
      const detail = [row.statusRaw, row.product, row.agent]
        .filter((part) => part && part !== "—" && part !== "-")
        .join(" · ");
      const existing = byClient.get(group);
      if (!existing) {
        byClient.set(group, {
          id: `customer-${group}`,
          client: label || "לקוח ללא שם",
          description: detail,
          href: customerHref(label || bits[0] || row.key),
          haystack,
          digits,
          nameRank: foldSearch(label),
          count: 1,
        });
        continue;
      }
      existing.count += 1;
      existing.haystack = `${existing.haystack} ${haystack}`;
      existing.digits += digits;
    }
    return Array.from(byClient.values()).map((item) => ({
      ...item,
      description: item.description
        ? `${item.count} שורות בדוח · ${item.description}`
        : `${item.count} שורות בדוח`,
    }));
  }, [canAccessSalesDashboard, dashboard]);

  const q = foldSearch(query);
  const qDigits = q.replace(/\D/g, "");
  const customerResults = useMemo(() => {
    if (q.length < 2) return [];
    return customers
      .filter((item) => {
        if (item.haystack.includes(q) || item.nameRank.includes(q)) return true;
        return qDigits.length >= 3 && item.digits.includes(qDigits);
      })
      .sort((a, b) => {
        const rank = (item: CustomerHit) => {
          if (item.nameRank.startsWith(q)) return 0;
          if (item.nameRank.includes(q)) return 1;
          return 2;
        };
        return rank(a) - rank(b) || a.client.localeCompare(b.client, "he");
      })
      .slice(0, 8);
  }, [customers, q, qDigits]);

  const pageResults = useMemo(() => {
    if (!q) return catalog.slice(0, 5);
    return catalog
      .filter((item) => {
        const haystack = foldSearch([item.label, item.description, ...item.keywords].join(" "));
        return haystack.includes(q);
      })
      .slice(0, 6);
  }, [catalog, q]);

  const salesLoading =
    canAccessSalesDashboard && q.length >= 2 && !(dashboard?.marketing?.productions?.length);

  function goTo(href: string) {
    setSheetOpen(false);
    setPaletteOpen(false);
    setQuery("");
    router.push(href);
  }

  const field = (inputId: string) => (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        id={inputId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setPaletteOpen(false);
            setSheetOpen(false);
            setQuery("");
          }
          if (e.key === "Enter" && (customerResults[0] || pageResults[0])) {
            e.preventDefault();
            goTo((customerResults[0]?.href ?? pageResults[0]?.href) as string);
          }
        }}
        placeholder="חיפוש במערכת..."
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-border bg-background pe-9 ps-9 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-rise ease-out placeholder:text-muted-foreground focus:border-ring focus:shadow-[0_0_0_3px_hsl(var(--highlight)/0.35)]"
      />
      {query ? (
        <button
          type="button"
          aria-label="ניקוי חיפוש"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setQuery("")}
          className="absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );

  const resultsList = (
    <>
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {q ? (customerResults.length > 0 ? "לקוחות" : "תוצאות") : "מעבר מהיר"}
      </div>
      {customerResults.length === 0 && pageResults.length === 0 && !salesLoading ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          אין תוצאות עבור &quot;{query}&quot;
        </p>
      ) : (
        <div className="max-h-[min(60vh,26rem)] overflow-auto sm:max-h-80">
          {salesLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">טוען את דוח המכירות…</p>
          ) : null}
          {customerResults.length > 0 ? (
            <ul className="p-1">
              {customerResults.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors active:bg-highlight/25 hover:bg-background sm:rounded-lg sm:py-2"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background sm:h-8 sm:w-8 sm:rounded-md">
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{item.client}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {pageResults.length > 0 ? (
            <ul className="p-1">
              {q && customerResults.length > 0 ? (
                <li className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  מסכים
                </li>
              ) : null}
              {pageResults.map((item) => {
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
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
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
          ) : null}
        </div>
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
            className="flex h-[min(92dvh,40rem)] flex-col gap-0 border-b border-border bg-card p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">חיפוש במערכת</SheetTitle>
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
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
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-[border-color,box-shadow,transform] duration-rise ease-out hover:-translate-y-px hover:border-module/50 hover:shadow-card"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="min-w-0 flex-1 truncate text-start">חיפוש או מעבר מהיר</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
        <Dialog
          open={paletteOpen}
          onOpenChange={(next) => {
            setPaletteOpen(next);
            if (!next) setQuery("");
          }}
        >
          <DialogContent className="motion-instant top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
            <DialogTitle className="sr-only">חיפוש במערכת</DialogTitle>
            <div className="border-b border-border px-3 py-3">{field("global-search")}</div>
            <div className="max-h-[min(60vh,26rem)] overflow-auto">{resultsList}</div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
