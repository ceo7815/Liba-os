"use client";

import { useEffect, useState, type ComponentProps } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, BadgeDollarSign, BadgePercent, Bot, Boxes, CalendarDays, ChartColumn, ChartNoAxesCombined, ChevronDown, CircleHelp, Clapperboard, Contact, FileText, FileUp, Filter, Handshake, HardHat, ImageIcon, LayoutDashboard, LifeBuoy, ListTodo, type LucideIcon, MailCheck, Megaphone, MessageCircle, Package, PanelsTopLeft, Receipt, Settings, ShoppingBag, ShoppingCart, SlidersHorizontal, Star, Ticket, UserPlus, Users, UsersRound, Wallet, Wrench, Zap } from "lucide-react";
import { adminNav, isAdminNavActive, openGroupKey } from "@/lib/admin/nav";
import { accentForNavKey, moduleAccent } from "@/lib/admin/semantic-color";

const icons: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  store: ShoppingBag,
  products: Package,
  promotions: BadgePercent,
  coupons: Ticket,
  orders: Receipt,
  carts: ShoppingCart,
  segments: Filter,
  site: PanelsTopLeft,
  pages: FileText,
  banners: ImageIcon,
  faqs: CircleHelp,
  reviews: Star,
  redirects: ArrowRightLeft,
  traffic: ChartNoAxesCombined,
  funnel: Filter,
  crm: Contact,
  inbox: MessageCircle,
  leads: UserPlus,
  deals: Handshake,
  customers: Users,
  tasks: ListTodo,
  tickets: LifeBuoy,
  installs: HardHat,
  calendar: CalendarDays,
  automations: Zap,
  team: UsersRound,
  crmSettings: SlidersHorizontal,
  parts: Wrench,
  sales: ChartColumn,
  import: FileUp,
  sequence: MailCheck,
  commissions: BadgeDollarSign,
  inventory: Boxes,
  finance: Wallet,
  marketing: Megaphone,
  studio: Clapperboard,
  agents: Bot,
  settings: Settings,
};

function ItemIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? LayoutDashboard;
  return <Icon className="size-4 shrink-0" style={{ color: moduleAccent[accentForNavKey(name)] }} aria-hidden />;
}

export function StoreNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(() => openGroupKey(pathname));

  useEffect(() => {
    setOpenKey(openGroupKey(pathname));
  }, [pathname]);

  if (collapsed) {
    const leaves: { href: string; key: string; label: string }[] = [];
    for (const group of adminNav) {
      if (group.children.length > 0) {
        for (const item of group.children) leaves.push({ href: item.href, key: item.key, label: t(`nav.items.${item.key}`) });
      } else if ("href" in group && group.href) {
        leaves.push({ href: group.href, key: group.key, label: t(`nav.groups.${group.key}`) });
      }
    }
    return (
      <nav aria-label={t("shell.menu")} className="nav-face flex flex-col items-center gap-1 px-2 py-2">
        {leaves.map((item) => {
          const active = isAdminNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onMouseEnter={() => router.prefetch(item.href)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`press nudge grid size-11 place-items-center rounded-xl ${active ? "bg-[#e7f0eb] text-[#1d4333]" : "text-foreground/70 hover:bg-[#f4f4f2]"}`}
            >
              <ItemIcon name={item.key} />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={t("shell.menu")} className="nav-face flex flex-col gap-1 px-2 py-2">
      {adminNav.map((group) => {
        const label = t(`nav.groups.${group.key}`);
        const childActive = group.children.some((item) => isAdminNavActive(pathname, item.href));
        const selfActive = "href" in group && group.href ? isAdminNavActive(pathname, group.href) : false;
        const isOpen = openKey === group.key;
        const panelId = `nav-${group.key}`;

        return (
          <div key={group.key}>
            <div className="flex items-center">
              {"href" in group && group.href ? (
                <DeskLink
                  href={group.href}
                  onClick={onNavigate}
                  aria-current={selfActive ? "page" : undefined}
                  className={rowClass(selfActive || childActive)}
                >
                  <ItemIcon name={group.key} />
                  {label}
                </DeskLink>
              ) : (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenKey(isOpen ? null : group.key)}
                  className={`${rowClass(childActive)} w-full`}
                >
                  <ItemIcon name={group.key} />
                  <span className="flex-1 text-start">{label}</span>
                  <ChevronDown data-slot="nav-chevron" className={isOpen ? "size-4 rotate-180" : "size-4"} />
                </button>
              )}
              {"href" in group && group.href && group.children.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={label}
                  onClick={() => setOpenKey(isOpen ? null : group.key)}
                  className="press grid size-11 shrink-0 place-items-center text-foreground/60"
                >
                  <ChevronDown data-slot="nav-chevron" className={isOpen ? "size-4 rotate-180" : "size-4"} />
                </button>
              ) : null}
            </div>
            {group.children.length > 0 ? (
              <div
                id={panelId}
                data-slot="nav-fold"
                inert={isOpen ? undefined : true}
                className={isOpen ? "grid grid-rows-[1fr]" : "grid grid-rows-[0fr]"}
              >
                <ul className="overflow-hidden">
                  {group.children.map((item) => {
                    const active = isAdminNavActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <DeskLink
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                          tabIndex={isOpen ? undefined : -1}
                          className={childClass(active)}
                        >
                          <ItemIcon name={item.key} />
                          {t(`nav.items.${item.key}`)}
                        </DeskLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function DeskLink({
  href,
  className,
  children,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  return (
    <Link href={href} prefetch={true} onMouseEnter={() => { if (typeof href === "string") router.prefetch(href); }} className={`relative ${className ?? ""}`} {...props}>
      {children}
      <NavPulse />
    </Link>
  );
}

function NavPulse() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    document.documentElement.dataset.nav = "busy";
    return () => {
      delete document.documentElement.dataset.nav;
    };
  }, [pending]);
  if (!pending) return null;
  return <span className="nav-pulse" aria-hidden />;
}

function rowClass(active: boolean) {
  return [
    "press nudge flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-4 text-[15px] tracking-[-0.02em]",
    "gap-2",
    active ? "bg-[#e7f0eb] font-semibold text-[#1d4333]" : "font-medium text-foreground/70 hover:bg-[#f4f4f2]",
  ].join(" ");
}

function childClass(active: boolean) {
  return [
    "press nudge flex min-h-10 items-center rounded-xl px-4 ps-8 text-sm tracking-[-0.02em]",
    "gap-2",
    active ? "bg-[#e7f0eb] font-semibold text-[#1d4333]" : "font-medium text-foreground/65 hover:bg-[#f4f4f2]",
  ].join(" ");
}
