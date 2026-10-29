"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MessageCircle, Search } from "lucide-react";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";
import { Avatar, listTime, previewText, useNow } from "@/components/admin/inbox/inbox-format";
import { InboxThread } from "@/components/admin/inbox/inbox-thread";
import { MenuField } from "@/components/admin/menu-field";
import type { InboxConversation } from "@/lib/admin/inbox";
import { moveLead } from "@/lib/crm/actions";
import { browserClient } from "@/lib/supabase/client";
import { createTicket } from "@/lib/crm/ticket-actions";
import { createConversationLead, linkConversationLead, linkConversationTicket, simulateIncoming } from "@/lib/whatsapp/actions";
import type { InboxMessage } from "@/lib/whatsapp/shape";

export type InboxLead = {
  id: string;
  name: string;
  title: string;
  status: string;
  tone: Tone;
  temperature: string;
  temperatureLabel: string;
  value: string;
  email: string;
  openTasks: number;
  nextTask: string;
};

export type LeadPick = { id: string; number: number; name: string };

export type InboxTicket = {
  id: string;
  number: number;
  title: string;
  statusLabel: string;
  tone: Tone;
  priority: string;
  late: boolean;
};

export type TicketPick = { id: string; number: number; name: string };

const priorities = ["low", "normal", "high", "urgent"] as const;
const filters = ["all", "unread", "mine", "unassigned"] as const;
type Filter = (typeof filters)[number];

function LeadPane({
  conversationId,
  lead,
  picks,
  statuses,
}: {
  conversationId: string;
  lead: InboxLead | null;
  picks: LeadPick[];
  statuses: { value: string; label: string }[];
}) {
  const t = useTranslations("crm.inbox.lead");
  const [status, setStatus] = useState(lead?.status ?? "");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setStatus(lead?.status ?? ""), [lead?.status]);

  if (!lead) {
    return (
      <div className="grid gap-4 text-sm">
        <div className="grid gap-1">
          <p className="font-medium">{t("title")}</p>
          <p className="text-muted-foreground">{t("none")}</p>
        </div>
        {picks.length > 0 ? (
          <form action={linkConversationLead} className="grid gap-2">
            <input type="hidden" name="conversation" value={conversationId} />
            <MenuField
              name="lead"
              label={t("pick")}
              value={picks[0].id}
              options={picks.map((item) => ({ value: item.id, label: `LD-${item.number} ${item.name}`.trim() }))}
            />
            <button type="submit" className="press h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground">
              {t("link")}
            </button>
          </form>
        ) : null}
        <form action={createConversationLead}>
          <input type="hidden" name="conversation" value={conversationId} />
          <button type="submit" className="press h-10 rounded-full border border-border px-4 text-sm hover:bg-muted">
            {t("create")}
          </button>
        </form>
      </div>
    );
  }

  function change(next: string) {
    const before = status;
    setStatus(next);
    setFailed(false);
    start(async () => {
      const result = await moveLead(lead!.id, next).catch(() => ({ ok: false }));
      if (!result.ok) {
        setStatus(before);
        setFailed(true);
      }
    });
  }

  return (
    <div className="grid gap-5" aria-busy={pending}>
      <div className="grid gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("title")}</p>
        <p className="text-lg font-semibold">{lead.name}</p>
        {lead.title ? <p className="text-sm text-muted-foreground">{lead.title}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <CrmPill kind="temperature" value={lead.temperature}>
            {lead.temperatureLabel}
          </CrmPill>
          {lead.value ? <bdi className="text-sm font-medium">{lead.value}</bdi> : null}
        </div>
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm text-muted-foreground">{t("status")}</p>
        <MenuField ariaLabel={t("status")} value={status} onChange={change} options={statuses} />
        {failed ? (
          <p role="alert" className="text-xs text-destructive">
            {t("failed")}
          </p>
        ) : null}
      </div>
      {lead.email ? (
        <div className="grid gap-0.5 text-sm">
          <p className="text-muted-foreground">{t("email")}</p>
          <bdi className="truncate">{lead.email}</bdi>
        </div>
      ) : null}
      <div className="grid gap-0.5 text-sm">
        <p className="text-muted-foreground">{t("tasks")}</p>
        <p>{lead.openTasks > 0 ? t("openTasks", { count: lead.openTasks }) : t("noTasks")}</p>
        {lead.nextTask ? <p className="text-muted-foreground">{lead.nextTask}</p> : null}
      </div>
      <Link href={`/admin/crm/leads/${lead.id}`} className="h-10 w-fit content-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted">
        {t("open")}
      </Link>
    </div>
  );
}

function TicketPane({
  conversationId,
  customerId,
  leadId,
  title,
  ticket,
  picks,
}: {
  conversationId: string;
  customerId: string | null;
  leadId: string | null;
  title: string;
  ticket: InboxTicket | null;
  picks: TicketPick[];
}) {
  const t = useTranslations("crm.inbox.ticket");
  const tickets = useTranslations("crm.tickets");
  const field = "h-10 rounded-full border border-border bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  return (
    <div className="grid gap-3 border-t border-border pt-5 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("title")}</p>
      {ticket ? (
        <div className="grid gap-2">
          <p className="font-medium">{ticket.title}</p>
          <div className="flex flex-wrap gap-1.5">
            <CrmPill tone={ticket.tone}>{ticket.statusLabel}</CrmPill>
            <CrmPill tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>
              {tickets(`priorities.${ticket.priority}`)}
            </CrmPill>
            {ticket.late ? <CrmPill tone="danger">{tickets("breached")}</CrmPill> : null}
          </div>
          <Link href={`/admin/crm/tickets/${ticket.id}`} className="h-10 w-fit content-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted">
            {t("open")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-muted-foreground">{t("none")}</p>
          {picks.length > 0 ? (
            <form action={linkConversationTicket} className="grid gap-2">
              <input type="hidden" name="conversation" value={conversationId} />
              <MenuField
                name="ticket"
                label={t("pick")}
                value={picks[0].id}
                options={picks.map((item) => ({ value: item.id, label: `TK-${item.number} ${item.name}`.trim() }))}
              />
              <button type="submit" className="press h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground">
                {t("link")}
              </button>
            </form>
          ) : null}
          {customerId ? (
            <form action={createTicket} className="grid gap-2">
              <input type="hidden" name="customer" value={customerId} />
              <input type="hidden" name="conversation" value={conversationId} />
              {leadId ? <input type="hidden" name="lead" value={leadId} /> : null}
              <input type="hidden" name="back" value={`/admin/crm/inbox?c=${conversationId}`} />
              <input name="title" required maxLength={160} defaultValue={title} className={field} />
              <MenuField name="priority" label={tickets("priority")} value="normal" options={priorities.map((item) => ({ value: item, label: tickets(`priorities.${item}`) }))} />
              <button type="submit" className="press h-10 rounded-full border border-border px-4 text-sm hover:bg-muted">
                {t("create")}
              </button>
            </form>
          ) : (
            <p className="text-muted-foreground">{t("needCustomer")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Simulator() {
  const t = useTranslations("crm.inbox.sandbox");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState("");
  const field = "h-9 rounded-full border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  return (
    <details className="border-t border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none py-1 font-medium">{t("title")}</summary>
      <form
        className="mt-2 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setFailed("");
          start(async () => {
            const result = await simulateIncoming({
              waId: String(data.get("waId") ?? "").replace(/\D/g, ""),
              name: String(data.get("name") ?? ""),
              body: String(data.get("body") ?? ""),
            }).catch(() => ({ ok: false as const, reason: t("failed") }));
            if (result.ok) {
              (form.elements.namedItem("body") as HTMLInputElement).value = "";
              router.refresh();
            } else setFailed(result.reason || t("failed"));
          });
        }}
      >
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        <input name="waId" required inputMode="tel" dir="ltr" defaultValue="971500000001" aria-label={t("phone")} placeholder={t("phone")} className={field} />
        <input name="name" aria-label={t("name")} placeholder={t("name")} className={field} />
        <input name="body" required aria-label={t("body")} placeholder={t("body")} className={field} />
        {failed ? <p role="alert" className="text-xs text-destructive">{failed}</p> : null}
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-primary px-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {t("send")}
        </button>
      </form>
    </details>
  );
}

export function InboxApp({
  sandbox,
  conversations,
  active,
  messages,
  me,
  quickReplies,
  lead,
  picks,
  statuses,
  ticket,
  ticketPicks,
  locale,
}: {
  sandbox: boolean;
  conversations: InboxConversation[];
  active: InboxConversation | null;
  messages: InboxMessage[];
  me: { uid: string; admin: boolean };
  quickReplies: { id: string; shortcut: string; body: string }[];
  lead: InboxLead | null;
  picks: LeadPick[];
  statuses: { value: string; label: string }[];
  ticket: InboxTicket | null;
  ticketPicks: TicketPick[];
  locale: string;
}) {
  const t = useTranslations("crm.inbox");
  const router = useRouter();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel(`wa-inbox-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => router.refresh(), 350);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((item) => item.unread > 0).length,
      mine: conversations.filter((item) => item.assignedTo === me.uid).length,
      unassigned: conversations.filter((item) => !item.assignedTo).length,
    }),
    [conversations, me.uid],
  );

  const term = query.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const shown = conversations.filter((item) => {
    if (filter === "unread" && item.unread === 0) return false;
    if (filter === "mine" && item.assignedTo !== me.uid) return false;
    if (filter === "unassigned" && item.assignedTo) return false;
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || (digits.length > 2 && item.waId.includes(digits)) || item.preview.toLowerCase().includes(term);
  });

  return (
    <div className="wa-face grid h-[calc(100dvh-10rem)] min-h-[34rem] overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_18rem]">
      <nav aria-label={t("listLabel")} className={`min-h-0 flex-col ${active ? "hidden lg:flex" : "flex"}`}>
        <div className="grid gap-2 border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">{t("search")}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              className="h-10 w-full rounded-full bg-muted ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          <div role="tablist" aria-label={t("filterLabel")} className="flex gap-1 overflow-x-auto">
            {filters.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium ${filter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {t(`filters.${key}`)}
                {key !== "all" && counts[key] > 0 ? <span className="ms-1 tabular-nums opacity-80">{counts[key]}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{conversations.length === 0 ? t("empty") : t("emptyFilter")}</li>
          ) : null}
          {shown.map((item) => {
            const selected = item.id === active?.id;
            return (
              <li key={item.id}>
                <Link
                  href={`/admin/crm/inbox?c=${item.id}`}
                  aria-current={selected ? "true" : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 ${selected ? "bg-muted" : "hover:bg-muted/60"}`}
                >
                  <Avatar name={item.name} seed={item.waId} />
                  <span className="min-w-0 flex-1 border-b border-border/60 pb-2.5 pt-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${item.unread > 0 ? "font-semibold" : "font-medium"}`}>{item.name}</span>
                      <time dateTime={item.lastAt} suppressHydrationWarning className={`shrink-0 text-[11px] ${item.unread > 0 ? "text-[color:var(--wa-unread)]" : "text-muted-foreground"}`}>
                        {listTime(item.lastAt, locale, now)}
                      </time>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="min-w-0 flex-1 truncate">
                        {item.direction === "out" ? <span className="text-foreground/70">{t("youPrefix")} </span> : null}
                        {previewText(t, item.preview)}
                      </span>
                      {item.unread > 0 ? (
                        <span className="wa-unread grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                          <span className="sr-only">{t("unread", { count: item.unread })}</span>
                          <span aria-hidden>{item.unread}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {sandbox && me.admin ? <Simulator /> : null}
      </nav>

      {active ? (
        <InboxThread
          key={`thread-${active.id}`}
          conversation={active}
          initial={messages}
          me={me}
          quickReplies={quickReplies}
          locale={locale}
          sandbox={sandbox}
        />
      ) : (
        <section className="wa-wall hidden flex-col items-center justify-center gap-3 border-s border-border p-8 text-center lg:flex">
          <span className="grid size-16 place-items-center rounded-full bg-card shadow-sm">
            <MessageCircle className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-lg font-medium">{t("pick")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("pickHint")}</p>
        </section>
      )}

      {active ? (
        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-s border-border p-5 xl:flex">
          <LeadPane key={`lead-${active.id}`} conversationId={active.id} lead={lead} picks={picks} statuses={statuses} />
          <TicketPane
            key={`ticket-${active.id}`}
            conversationId={active.id}
            customerId={active.customerId}
            leadId={active.leadId}
            title={active.name}
            ticket={ticket}
            picks={ticketPicks}
          />
        </aside>
      ) : (
        <div className="hidden border-s border-border xl:block" />
      )}
    </div>
  );
}
