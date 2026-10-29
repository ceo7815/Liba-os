"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, LayoutDashboard, LogOut, Menu, MessageCircle, PanelLeft, Plus, Receipt, Search, UserPlus } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { moduleForPath } from "@/lib/admin/semantic-color";
import { AmbientPause } from "@/components/admin/ambient-pause";
import { CommandPalette } from "@/components/admin/command-palette";
import { LocaleSwitch } from "@/components/admin/locale-switch";
import { NavPrefetch } from "@/components/admin/nav-prefetch";
import { StoreNav } from "@/components/admin/store-nav";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const RAIL_KEY = "imbody-admin-rail";

export function AdminChrome({
  email,
  local,
  products,
  children,
}: {
  email: string;
  local: boolean;
  products: { name: string; handle: string }[];
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [mod, setMod] = useState("Ctrl");

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
    const saved = localStorage.getItem(RAIL_KEY);
    if (saved === "collapsed" || saved === "open") setCollapsed(saved === "collapsed");
    else if (window.innerWidth < 1024) setCollapsed(true);
    const densitySaved = localStorage.getItem("imbody-admin-density");
    if (densitySaved === "compact" || densitySaved === "comfortable") setDensity(densitySaved);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onClick = (event: MouseEvent) => {
      if (reduce.matches || !("startViewTransition" in document)) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      document.startViewTransition(() => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest(".work-sheet");
      if (!(card instanceof HTMLElement)) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--sx", `${event.clientX - box.left}px`);
      card.style.setProperty("--sy", `${event.clientY - box.top}px`);
    };
    document.addEventListener("click", onClick, true);
    document.getElementById("admin-main")?.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.getElementById("admin-main")?.removeEventListener("pointermove", onMove);
    };
  }, [router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "Escape") setPalette(false);
      if (!typing && (event.key === "[" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b"))) {
        event.preventDefault();
        setCollapsed((current) => {
          const next = !current;
          localStorage.setItem(RAIL_KEY, next ? "collapsed" : "open");
          return next;
        });
        return;
      }
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setPalette(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function setRail(next: boolean) {
    setCollapsed(next);
    localStorage.setItem(RAIL_KEY, next ? "collapsed" : "open");
  }

  const rail = (collapsedRail: boolean, onNavigate?: () => void) => (
    <>
      <div className="flex items-center justify-center px-3 pt-5 pb-3">
        <Link href="/admin" aria-label="IMBODY" className={collapsedRail ? "grid size-11 place-items-center overflow-hidden rounded-md" : "grid place-items-center rounded-md"} onClick={onNavigate}>
          <Image src="/imbody/logo.webp" alt="" width={140} height={32} priority className={collapsedRail ? "h-6 w-6 object-cover object-left dark:brightness-0 dark:invert" : "h-8 w-auto dark:brightness-0 dark:invert"} />
        </Link>
      </div>
      <div className="admin-rail-scroll">
        <StoreNav collapsed={collapsedRail} onNavigate={onNavigate} />
      </div>
      <div className="admin-rail-foot">
        <LocaleSwitch tone="console" />
        {collapsedRail ? (
          <span aria-hidden className="mx-auto grid size-9 place-items-center rounded-full bg-[#e7f0eb] text-xs font-semibold text-[#1d4333]">{email.slice(0, 1).toUpperCase()}</span>
        ) : (
          <div className="flex items-center gap-2 px-2">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e7f0eb] text-xs font-semibold text-[#1d4333]">{email.slice(0, 1).toUpperCase()}</span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">{email}</p>
          </div>
        )}
        <form action={signOut}>
          <Button type="submit" variant="ghost" title={t("dashboard.signOut")} className="press nudge w-full justify-start text-foreground/80 hover:bg-[#f4f4f2]">
            <LogOut />
            {collapsedRail ? <span className="sr-only">{t("dashboard.signOut")}</span> : <span>{t("dashboard.signOut")}</span>}
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className={`admin-app ${density === "compact" ? "is-compact-density" : ""}`} data-module={moduleForPath(pathname)}>
        <AmbientPause />
      <NavPrefetch />
        {local ? <p className="admin-env">{t("shell.local")}</p> : null}
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          {t("shell.skip")}
        </a>
        <div className="admin-frame">
          <aside className={`admin-rail admin-rail-desktop ${collapsed ? "is-collapsed" : ""}`}>
            {rail(collapsed)}
            <button
              type="button"
              className="press nudge admin-rail-toggle absolute top-16 hidden size-8 -translate-y-1/2 place-items-center rounded-full shadow-md md:grid"
              aria-pressed={collapsed}
              aria-label={collapsed ? t("shell.expand") : t("shell.collapse")}
              onClick={() => setRail(!collapsed)}
            >
              <PanelLeft className="size-4 rtl:-scale-x-100" />
            </button>
          </aside>
          <div className="admin-maincol">
            <header className={`admin-top ${collapsed ? "is-compact" : ""}`}>
              <Button type="button" variant="ghost" className="admin-menu-mobile press" aria-label={t("shell.menu")} onClick={() => setDrawer(true)}>
                <Menu />
              </Button>
              <p className="hidden min-w-0 items-center gap-2 truncate px-2 text-sm font-medium sm:flex"><span className="live-dot" aria-hidden />{titleFor(pathname, t)}</p>
              <button type="button" className="admin-search press" onClick={() => setPalette(true)}>
                <Search className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t("shell.searchPlaceholder")}</span>
                <kbd className="kbd hidden sm:inline">{mod} K</kbd>
              </button>
              <Link href="/admin/crm/leads" className="press nudge grid size-10 place-items-center rounded-full hover:bg-muted" aria-label={t("shell.create")}>
                <Plus className="size-4" />
              </Link>
              <Link href="/admin/notices" className="press nudge relative grid size-10 place-items-center rounded-full hover:bg-muted" aria-label={t("shell.bell")}>
                <Bell className="size-4" />
                <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-[#d85a4a]" />
              </Link>
              <ThemeToggle />
              <button
                type="button"
                className="press hidden h-8 items-center rounded-full px-2 text-xs text-muted-foreground hover:bg-muted sm:inline-flex"
                aria-pressed={density === "compact"}
                onClick={() => setDensity((current) => {
                  const next = current === "compact" ? "comfortable" : "compact";
                  localStorage.setItem("imbody-admin-density", next);
                  return next;
                })}
              >
                {density === "compact" ? t("shell.comfortable") : t("shell.compact")}
              </button>
              <span aria-hidden className="me-1 grid size-8 place-items-center rounded-full bg-[#e7f0eb] text-xs font-semibold text-[#1d4333]">{email.slice(0, 1).toUpperCase()}</span>
            </header>
            <main id="admin-main" className="admin-stage">
              {children}
            </main>
          </div>
        </div>
        {drawer ? (
          <div className="admin-drawer cursor-pointer" onClick={() => setDrawer(false)}>
            <aside className="admin-rail" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={t("shell.menu")}>
              {rail(false, () => setDrawer(false))}
            </aside>
          </div>
        ) : null}
        <CommandPalette
          open={palette}
          onOpenChange={setPalette}
          products={products}
          onGo={(href) => {
            setPalette(false);
            setDrawer(false);
            router.push(href);
          }}
        />
        <nav className="admin-tabs" aria-label={t("shell.menu")}>
          <Link prefetch href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}><LayoutDashboard className="size-4" />{t("shell.tabs.home")}</Link>
          <Link prefetch href="/admin/crm/leads" aria-current={pathname.startsWith("/admin/crm/leads") ? "page" : undefined}><UserPlus className="size-4" />{t("shell.tabs.leads")}</Link>
          <Link prefetch href="/admin/orders" aria-current={pathname.startsWith("/admin/orders") ? "page" : undefined}><Receipt className="size-4" />{t("shell.tabs.orders")}</Link>
          <Link prefetch href="/admin/crm/inbox" aria-current={pathname.startsWith("/admin/crm/inbox") ? "page" : undefined}><MessageCircle className="size-4" />{t("shell.tabs.inbox")}</Link>
          <button type="button" onClick={() => setDrawer(true)}><Menu className="size-4" />{t("shell.tabs.menu")}</button>
        </nav>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function titleFor(pathname: string, t: (key: string) => string) {
  const hit = [
    ["/admin/settings/readiness", "nav.items.readiness"],
    ["/admin/crm/leads", "nav.items.leads"],
    ["/admin/crm/deals", "nav.items.deals"],
    ["/admin/crm/customers", "nav.items.customers"],
    ["/admin/crm/tickets", "nav.items.tickets"],
    ["/admin/crm/installs", "nav.items.installs"],
    ["/admin/crm/calendar", "nav.items.calendar"],
    ["/admin/crm/inbox", "nav.items.inbox"],
    ["/admin/crm/tasks", "nav.items.tasks"],
    ["/admin/crm/team", "nav.items.team"],
    ["/admin/crm/automations", "nav.items.automations"],
    ["/admin/crm/import", "nav.items.import"],
    ["/admin/crm/sequence", "nav.items.sequence"],
    ["/admin/crm/commissions", "nav.items.commissions"],
    ["/admin/crm/settings", "nav.items.crmSettings"],
    ["/admin/store/inventory", "nav.items.inventory"],
    ["/admin/store/products", "nav.items.products"],
    ["/admin/store/promotions", "nav.items.promotions"],
    ["/admin/store/coupons", "nav.items.coupons"],
    ["/admin/store/parts", "nav.items.parts"],
    ["/admin/store/carts", "nav.items.carts"],
    ["/admin/store/pages", "nav.items.pages"],
    ["/admin/store/banners", "nav.items.banners"],
    ["/admin/store/faqs", "nav.items.faqs"],
    ["/admin/store/reviews", "nav.items.reviews"],
    ["/admin/store/redirects", "nav.items.redirects"],
    ["/admin/analytics/traffic", "nav.items.traffic"],
    ["/admin/analytics/funnel", "nav.items.funnel"],
    ["/admin/reports/sales", "nav.items.sales"],
    ["/admin/segments", "nav.items.segments"],
    ["/admin/orders", "nav.items.orders"],
    ["/admin/finance", "nav.groups.finance"],
    ["/admin/marketing", "nav.groups.marketing"],
    ["/admin/studio", "nav.groups.studio"],
    ["/admin/agents", "nav.groups.agents"],
    ["/admin/settings", "nav.groups.settings"],
    ["/admin/notices", "noticeDesk.title"],
  ].find(([href]) => pathname === href || pathname.startsWith(`${href}/`));
  if (pathname === "/admin") return t("nav.groups.overview");
  return hit ? t(hit[1]) : t("nav.groups.overview");
}
