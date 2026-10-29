import type { CSSProperties } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { KpiBoard, type KpiModel } from "@/components/admin/kpi-board";
import { TrendChart } from "@/components/admin/trend-chart";
import type { CalendarItem } from "@/lib/admin/calendar";
import type { LeadRow } from "@/lib/admin/crm";
import type { StoredOrder } from "@/lib/admin/orders";
import type { StockRow } from "@/lib/admin/stock";
import type { TicketRow } from "@/lib/admin/tickets";
import { money } from "@/lib/admin/site-snapshot";

const day = 24 * 60 * 60 * 1000;
const paid = new Set(["paid", "processing", "installed", "completed", "partially_refunded", "refunded"]);

function dubaiDay(time: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
}

function tally(rows: { key: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.key, (map.get(row.key) ?? 0) + row.value);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export async function OpsHome({
  orders,
  leads,
  tickets,
  events,
  stock,
}: {
  orders: StoredOrder[];
  leads: LeadRow[];
  tickets: TicketRow[];
  events: CalendarItem[];
  stock: StockRow[];
}) {
  const t = await getTranslations();
  const now = Date.now();
  const today = dubaiDay(now);
  const days = Array.from({ length: 90 }, (_, index) => dubaiDay(now - (89 - index) * day));
  const onDay = (iso: string, key: string) => dubaiDay(new Date(iso).getTime()) === key;
  const salesPoints = days.map((key) => ({
    day: key,
    value: orders.filter((order) => paid.has(order.status) && onDay(order.placedAt, key)).reduce((sum, order) => sum + order.total, 0),
  }));
  const leadPoints = days.map((key) => ({ day: key, value: leads.filter((lead) => onDay(lead.at, key)).length }));
  const unpaidPoints = days.map((key) => ({ day: key, value: orders.filter((order) => order.status === "pending_payment" && onDay(order.placedAt, key)).length }));
  const ticketPoints = days.map((key) => ({ day: key, value: tickets.filter((ticket) => onDay(ticket.at, key)).length }));
  const salesWeek = salesPoints.slice(-7).reduce((sum, point) => sum + point.value, 0);
  const openLeads = leads.filter((lead) => lead.status !== "won" && lead.status !== "lost");
  const unpaid = orders.filter((order) => order.status === "pending_payment");
  const openTickets = tickets.filter((ticket) => !ticket.closed);
  const stages = ["new", "qualified", "won", "lost"] as const;
  const stageCount = stages.map((stage) => leads.filter((lead) => lead.status === stage).length);
  const funnel = stages.map((stage, index) => {
    const count = stageCount[index];
    const baseline = stage === "lost" || index === 0 ? stageCount[0] : stageCount[index - 1];
    return { stage, count, conversion: index === 0 || baseline === 0 ? (index === 0 ? 100 : 0) : Math.round((count / baseline) * 100) };
  });
  const funnelMax = Math.max(stageCount[0] ?? 0, 1);
  const stale = openLeads.filter((lead) => now - new Date(lead.since).getTime() > 7 * day);
  const low = stock.filter((item) => item.onHand != null && item.onHand <= 2);
  const agenda = [
    ...events
      .filter((item) => dubaiDay(new Date(item.start).getTime()) === today)
      .map((item) => ({ href: "/admin/crm/calendar", title: item.title, meta: t(`crm.calendar.kinds.${item.kind}`), tone: "forest" })),
    ...openTickets.slice(0, 4).map((ticket) => ({ href: `/admin/crm/tickets/${ticket.id}`, title: ticket.title, meta: t(`crm.tickets.priorities.${ticket.priority}`), tone: ticket.priority === "urgent" || ticket.priority === "high" ? "hot" : "forest" })),
  ].slice(0, 6);
  const activity = [
    ...orders.slice(0, 5).map((order) => ({ href: `/admin/orders/${order.id}`, title: `IMB-${order.number}`, meta: money(order.total), at: order.placedAt })),
    ...leads.slice(0, 5).map((lead) => ({ href: `/admin/crm/leads/${lead.id}`, title: lead.name, meta: lead.title, at: lead.at })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);
  const kpis: KpiModel[] = [
    {
      id: "sales",
      label: t("dashboard.salesWeek"),
      href: "/admin/orders",
      headline: salesWeek,
      money: true,
      ink: "#1d4333",
      points: salesPoints,
      breakdown: tally(orders.filter((order) => paid.has(order.status)).map((order) => ({ key: order.emirate || "—", value: order.total }))),
      top: [...orders].filter((order) => paid.has(order.status)).sort((a, b) => b.total - a.total).slice(0, 5).map((order) => ({
        name: `IMB-${order.number}`,
        detail: money(order.total),
        href: `/admin/orders/${order.id}`,
      })),
    },
    {
      id: "leads",
      label: t("dashboard.openLeads"),
      href: "/admin/crm/leads",
      headline: openLeads.length,
      money: false,
      ink: "#2f6b52",
      points: leadPoints,
      breakdown: tally(leads.map((lead) => ({ key: t(`crm.statuses.${lead.status}`), value: 1 }))),
      top: openLeads.slice(0, 5).map((lead) => ({ name: lead.name, detail: lead.title, href: `/admin/crm/leads/${lead.id}` })),
    },
    {
      id: "unpaid",
      label: t("dashboard.unpaid"),
      href: "/admin/orders",
      headline: unpaid.length,
      money: false,
      ink: "#9f2d2d",
      points: unpaidPoints,
      breakdown: tally(unpaid.map((order) => ({ key: order.emirate || "—", value: 1 }))),
      top: unpaid.slice(0, 5).map((order) => ({ name: `IMB-${order.number}`, detail: money(order.total), href: `/admin/orders/${order.id}` })),
    },
    {
      id: "tickets",
      label: t("dashboard.openTickets"),
      href: "/admin/crm/tickets",
      headline: openTickets.length,
      money: false,
      ink: "#52514e",
      points: ticketPoints,
      breakdown: tally(openTickets.map((ticket) => ({ key: t(`crm.tickets.priorities.${ticket.priority}`), value: 1 }))),
      top: openTickets.slice(0, 5).map((ticket) => ({ name: ticket.title, detail: ticket.name, href: `/admin/crm/tickets/${ticket.id}` })),
    },
  ];
  const trend = salesPoints.slice(-14).map((point, index) => ({
    label: point.day.slice(5),
    sales: point.value,
    leads: leadPoints.slice(-14)[index]?.value ?? 0,
  }));
  const attention = [
    ...stale.slice(0, 2).map((lead) => ({ href: `/admin/crm/leads/${lead.id}`, name: lead.name, detail: lead.title, pill: t("dashboard.staleLeads"), hot: true, at: lead.since })),
    ...unpaid.slice(0, 2).map((order) => ({ href: `/admin/orders/${order.id}`, name: `IMB-${order.number}`, detail: money(order.total), pill: t("dashboard.unpaid"), hot: true, at: order.placedAt })),
    ...low.slice(0, 2).map((item) => ({ href: "/admin/store/inventory", name: item.name, detail: String(item.onHand ?? 0), pill: t("dashboard.lowStock"), hot: false, at: "" })),
  ];

  const funnelTone: Record<string, string> = { new: "#8aa898", qualified: "#2f6b52", won: "#1d4333", lost: "#c4b8a4" };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="enter flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="console-title text-3xl">{t("dashboard.afternoon")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/crm/leads" className="press nudge inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm text-primary-foreground">{t("dashboard.newLead")}</Link>
          <Link href="/admin/orders" className="press nudge inline-flex h-10 items-center rounded-full border border-border bg-secondary px-4 text-sm text-secondary-foreground">{t("dashboard.newOrder")}</Link>
        </div>
      </header>

      <KpiBoard cards={kpis} />

      <section className="enter enter-2 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <article className="work-sheet px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t("dashboard.trend")}</h2>
            <Link href="/admin/orders" className="text-xs text-primary">{t("dashboard.viewAll")}</Link>
          </div>
          <TrendChart data={trend} salesLabel={t("dashboard.salesWeek")} leadsLabel={t("dashboard.openLeads")} />
          <p className="text-xs text-muted-foreground">{t("dashboard.trendKey")}</p>
        </article>
        <article className="work-sheet px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t("dashboard.funnel")}</h2>
            <Link href="/admin/crm/leads" className="text-xs text-primary">{t("dashboard.viewAll")}</Link>
          </div>
          <ul className="mt-4 grid gap-3">
            {funnel.map((item, index) => (
              <li key={item.stage}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{t(`crm.statuses.${item.stage}`)}</span>
                  <span dir="ltr" className="tabular-nums text-muted-foreground">{item.count} · {item.conversion}%</span>
                </div>
                <div className="meter mt-1 h-2 overflow-hidden rounded-full">
                  <div className="funnel-bar meter-fill h-full rounded-full" style={{ width: `${item.count === 0 ? 0 : Math.max(6, (item.count / funnelMax) * 100)}%`, "--bar": funnelTone[item.stage] ?? "#1d4333", animationDelay: `${index * 70}ms` } as CSSProperties} />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="enter enter-3 grid gap-3 lg:grid-cols-3">
        <article className="work-sheet px-4 py-4">
          <h2 className="text-sm font-semibold">{t("dashboard.agenda")}</h2>
          <ul className="mt-3 grid gap-2">
            {agenda.length === 0 ? <li className="text-sm text-muted-foreground">{t("dashboard.agendaEmpty")}</li> : null}
            {agenda.map((item) => (
              <li key={item.href + item.title}>
                <Link href={item.href} className="row-link flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                  <span className="truncate text-sm">{item.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${item.tone === "hot" ? "bg-[#fde8e6] text-[#9f2d2d]" : "bg-[#e7f0eb] text-[#1d4333]"}`}>{item.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="work-sheet px-4 py-4">
          <h2 className="text-sm font-semibold">{t("dashboard.attention")}</h2>
          <ul className="mt-3 grid gap-1">
            {attention.map((item) => (
              <li key={item.href + item.name}>
                <Link href={item.href} className="row-link flex items-center gap-3 rounded-xl px-2 py-2">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e7f0eb] text-xs font-semibold text-primary">{item.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${item.hot ? "bg-[#fde8e6] text-[#9f2d2d]" : "bg-[#e7f0eb] text-[#1d4333]"}`}>{item.pill}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="work-sheet px-4 py-4">
          <h2 className="text-sm font-semibold">{t("dashboard.activity")}</h2>
          <ul className="mt-3 grid gap-2">
            {activity.map((item) => (
              <li key={item.href + item.title}>
                <Link href={item.href} className="row-link flex items-center gap-3 rounded-xl px-2 py-2">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f4f4f2] text-xs font-semibold">{item.title.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.meta}</span>
                  </span>
                  <time dir="ltr" className="shrink-0 text-[11px] text-muted-foreground">{item.at.slice(5, 10)}</time>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
