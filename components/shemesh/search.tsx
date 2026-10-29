"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cable,
  Calculator,
  FileText,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Receipt,
  Rows3,
  Search,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SearchItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

const PAGES: SearchItem[] = [
  {
    id: "dashboard",
    label: "לוח בקרה",
    description: "פרסום, לידים ועלות לליד לחודש",
    href: "/shemesh",
    icon: LayoutDashboard,
    keywords: ["לוח", "בקרה", "בית", "דשבורד", "סקירה", "חודש", "פרסום", "עלות", "cpl"],
  },
  {
    id: "marketing",
    label: "שיווק",
    description: "קמפיינים בגוגל ובפייסבוק",
    href: "/shemesh/marketing",
    icon: Megaphone,
    keywords: [
      "שיווק",
      "קמפיין",
      "קמפיינים",
      "גוגל",
      "פייסבוק",
      "מודעה",
      "מודעות",
      "פיננסים",
      "ביטוחים",
      "ליד",
      "טופס",
      "טפסים",
      "שיחה",
      "שיחות",
      "מחיר",
    ],
  },
  {
    id: "leads",
    label: "לידים",
    description: "כמות, מקור הגעה, סטטוס והמרה",
    href: "/shemesh/leads",
    icon: Users,
    keywords: ["ליד", "לידים", "המרה", "עסקה", "עסקאות", "סטטוס", "מקור", "הגעה"],
  },
  {
    id: "sales",
    label: "שורות מכירה",
    description: "דוח המכירות של שמש, גיליון אחרי גיליון",
    href: "/shemesh/sales",
    icon: Rows3,
    keywords: [
      "מכירה",
      "מכירות",
      "דוח",
      "אקסל",
      "גיליון",
      "פדיון",
      "פדיונות",
      "גביה",
      "גבייה",
      "חשבונית",
      "נציג",
      "לקוח",
      "תפעול",
    ],
  },
  {
    id: "revenue",
    label: "הכנסות",
    description: "גבייה, חשבוניות ופיננסים מתוך דוח המכירות",
    href: "/shemesh/revenue",
    icon: Wallet,
    keywords: ["הכנסה", "הכנסות", "גבייה", "גביה", "חשבונית", "פיננסים", "נציג", "שולם", "עמלה", "נפרע"],
  },
  {
    id: "expenses",
    label: "הוצאות",
    description: "משכורות, הוצאות שוטפות וחשבוניות",
    href: "/shemesh/expenses",
    icon: Receipt,
    keywords: ["הוצאה", "הוצאות", "משכורת", "משכורות", "עובד", "עובדים", "חשבונית", "חשבוניות", "שוטף"],
  },
  {
    id: "reports",
    label: "רווח והפסד",
    description: "הכנסות פחות פרסום ופחות הוצאות",
    href: "/shemesh/reports",
    icon: LineChart,
    keywords: ["רווח", "הפסד", "דוח", "דוחות", "תוצאה", "פלוס", "מינוס"],
  },
  {
    id: "portfolio-report",
    label: "השוואת תיק",
    description: "דוח מצב קיים מול מצב חדש לפוליסות",
    href: "/shemesh/portfolio-report",
    icon: FileText,
    keywords: ["השוואה", "השוואת", "תיק", "פוליסה", "פוליסות", "ביטוח", "מגדל", "מנורה", "דוח", "קיים", "חדש"],
  },
  {
    id: "sources",
    label: "מקורות",
    description: "גוגל, פייסבוק, ביטוח, ריווחית, Grow והתיקייה",
    href: "/shemesh/sources",
    icon: Cable,
    keywords: [
      "מקור",
      "מקורות",
      "חיבור",
      "סנכרון",
      "גוגל",
      "פייסבוק",
      "ביטוח",
      "insurance",
      "ריווחית",
      "grow",
      "תיקייה",
      "אקסל",
    ],
  },
  {
    id: "formulas",
    label: "נוסחאות שמש",
    description: "מודל מכפלה 8 וסטטוס 100% נפרע",
    href: "/shemesh/formulas",
    icon: Calculator,
    keywords: ["נוסחה", "נוסחאות", "מכפלה", "נפרע", "אישור", "כלל", "כללים"],
  },
];

function foldSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function ShemeshSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const q = foldSearch(query);

  const results = useMemo(() => {
    const tokens = q.split(" ").filter(Boolean);
    const ranked = PAGES.map((item) => {
      const haystack = foldSearch([item.label, item.description, ...item.keywords].join(" "));
      const matched = tokens.every((word) => haystack.includes(word));
      const rank = foldSearch(item.label).startsWith(q) ? 0 : haystack.startsWith(q) ? 1 : 2;
      return { item, matched, rank };
    }).filter((row) => (tokens.length === 0 ? true : row.matched));
    ranked.sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label, "he"));
    return ranked.map((row) => row.item);
  }, [q]);

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
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            goTo(results[0].href);
          }
        }}
        placeholder="חיפוש במערכת..."
        autoComplete="off"
        className="h-10 w-full rounded-2xl border border-border bg-background pe-9 ps-9 text-sm text-foreground outline-none transition-[border-color,background-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--ring)/0.28)] sm:h-9 sm:rounded-lg"
      />
      {query ? (
        <button
          type="button"
          aria-label="ניקוי חיפוש"
          onMouseDown={(event) => event.preventDefault()}
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
        {q ? "תוצאות" : "מעבר מהיר"}
      </div>
      {results.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">אין תוצאות עבור &quot;{query}&quot;</p>
      ) : (
        <ul className="max-h-[min(60vh,26rem)] overflow-auto p-1 sm:max-h-80">
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goTo(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors hover:bg-highlight/10 active:bg-highlight/20 sm:rounded-lg sm:py-2",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-highlight/10 sm:h-8 sm:w-8 sm:rounded-md">
                    <Icon className="h-3.5 w-3.5 text-highlight" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
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
            className="shemesh-os flex h-[min(92dvh,40rem)] flex-col gap-0 border-b border-black/[0.08] bg-white p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">חיפוש במערכת</SheetTitle>
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-3">
              <div className="min-w-0 flex-1">{field("shemesh-search-mobile")}</div>
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

      <div className="relative hidden w-full sm:block">
        <label htmlFor="shemesh-search" className="sr-only">
          חיפוש במערכת
        </label>
        {field("shemesh-search")}
        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_16px_40px_-20px_rgba(17,17,17,0.35)]">
            {resultsList}
          </div>
        ) : null}
      </div>
    </>
  );
}
