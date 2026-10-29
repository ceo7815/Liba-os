"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  CornerUpLeft,
  FileText,
  LayoutTemplate,
  Lock,
  Paperclip,
  SendHorizontal,
  StickyNote,
  X,
} from "lucide-react";
import type { InboxConversation } from "@/lib/admin/inbox";
import { browserClient } from "@/lib/supabase/client";
import {
  loadTemplates,
  markConversationRead,
  releaseConversation,
  sendFile,
  sendTemplate,
  sendText,
  takeConversation,
  type SendResult,
} from "@/lib/whatsapp/actions";
import type { WaTemplate } from "@/lib/whatsapp/cloud";
import { toMessage, type InboxMessage } from "@/lib/whatsapp/shape";
import { Avatar, bubbleTime, dayKey, dayLabel, fullTime, kindLabel, useNow, windowLeft } from "@/components/admin/inbox/inbox-format";

type QuickReply = { id: string; shortcut: string; body: string };

const offline: SendResult = { ok: false, error: "send" };

function attempt<T>(run: () => Promise<T>, fallback: T) {
  return run().catch(() => fallback);
}

function upsert(list: InboxMessage[], message: InboxMessage) {
  const index = list.findIndex((item) => item.id === message.id);
  if (index === -1) return [...list, message].sort((a, b) => a.at.localeCompare(b.at));
  const next = [...list];
  next[index] = message;
  return next;
}

function Ticks({ status, label }: { status: string; label: string }) {
  const icon = "size-3.5 shrink-0";
  if (status === "queued") return <Clock3 aria-label={label} className={icon} />;
  if (status === "failed") return <AlertCircle aria-label={label} className={`${icon} text-destructive`} />;
  if (status === "read") return <CheckCheck aria-label={label} className={`${icon} wa-tick-read`} />;
  if (status === "delivered") return <CheckCheck aria-label={label} className={icon} />;
  return <Check aria-label={label} className={icon} />;
}

function Media({ message, labels }: { message: InboxMessage; labels: { download: string; unavailable: string } }) {
  if (!message.media) return null;
  const src = `/api/whatsapp/media/${message.id}`;
  if (message.kind === "image" || message.kind === "sticker") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="mb-1 block overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={message.body || labels.download}
          loading="lazy"
          className={message.kind === "sticker" ? "size-32 object-contain" : "max-h-80 w-full min-w-48 object-cover"}
        />
      </a>
    );
  }
  if (message.kind === "video") return <video src={src} controls preload="metadata" className="mb-1 max-h-80 w-full rounded-md" />;
  if (message.kind === "audio") return <audio src={src} controls preload="none" className="mb-1 h-10 w-64 max-w-full" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="wa-quote mb-1 flex items-center gap-2 px-3 py-2 text-sm">
      <FileText className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{message.fileName || labels.download}</span>
    </a>
  );
}

export function InboxThread({
  conversation,
  initial,
  me,
  quickReplies,
  locale,
  sandbox,
}: {
  conversation: InboxConversation;
  initial: InboxMessage[];
  me: { uid: string; admin: boolean };
  quickReplies: QuickReply[];
  locale: string;
  sandbox: boolean;
}) {
  const t = useTranslations("crm.inbox");
  const now = useNow();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [template, setTemplate] = useState<WaTemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [below, setBelow] = useState(false);
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stick = useRef(true);

  useEffect(() => setMessages((current) => initial.reduce(upsert, current)), [initial]);

  const left = windowLeft(conversation.lastInboundAt, now);
  const open = left > 0;
  const lockedByOther =
    Boolean(conversation.lockedBy) &&
    conversation.lockedBy !== me.uid &&
    Boolean(conversation.lockedUntil) &&
    new Date(conversation.lockedUntil ?? 0).getTime() > now;
  const blocked = lockedByOther && !me.admin;
  const mine = conversation.assignedTo === me.uid;

  const read = useCallback(() => {
    if (document.visibilityState === "visible") markConversationRead(conversation.id).catch(() => undefined);
  }, [conversation.id]);

  useEffect(() => {
    if (conversation.unread > 0) read();
  }, [conversation.unread, read]);

  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel(`wa-thread-${conversation.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row || !row.id) return;
          const message = toMessage(row);
          setMessages((current) => upsert(current, message));
          if (payload.eventType === "INSERT" && message.direction === "in") read();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, read]);

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    if (stick.current) {
      box.scrollTop = box.scrollHeight;
      setBelow(false);
    } else {
      setBelow(true);
    }
  }, [messages]);

  function onScroll() {
    const box = scroller.current;
    if (!box) return;
    stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (stick.current) setBelow(false);
  }

  function toBottom() {
    const box = scroller.current;
    if (!box) return;
    stick.current = true;
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    setBelow(false);
  }

  const byId = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const slash = draft.startsWith("/") && !draft.includes("\n") ? draft.slice(1).toLowerCase() : null;
  const matches = slash === null ? [] : quickReplies.filter((reply) => reply.shortcut.toLowerCase().startsWith(slash)).slice(0, 6);

  function applyReply(reply: QuickReply) {
    setDraft(reply.body);
    setPick(0);
    requestAnimationFrame(() => input.current?.focus());
  }

  function settle(result: SendResult, restore: () => void) {
    if (result.ok) {
      stick.current = true;
      setMessages((current) => upsert(current, result.message));
      if (result.message.status === "failed") setError(t("errors.send"));
      return;
    }
    restore();
    setError(t(`errors.${result.error}`));
  }

  function submit() {
    if (pending) return;
    const body = draft.trim();
    setError(null);
    if (file && !note) {
      const form = new FormData();
      form.set("conversationId", conversation.id);
      form.set("file", file);
      form.set("caption", body);
      const chosen = file;
      setFile(null);
      setDraft("");
      start(async () => settle(await attempt(() => sendFile(form), offline), () => (setFile(chosen), setDraft(body))));
      return;
    }
    if (!body) return;
    const reply = replyTo;
    setDraft("");
    setReplyTo(null);
    start(async () =>
      settle(await attempt(() => sendText({ conversationId: conversation.id, body, replyTo: reply?.id ?? null, note }), offline), () => {
        setDraft(body);
        setReplyTo(reply);
      }),
    );
  }

  function onKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setPick((value) => (value + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyReply(matches[Math.min(pick, matches.length - 1)]);
        return;
      }
    }
    if (event.key === "Escape") {
      setReplyTo(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  useLayoutEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }, [draft]);

  function openTemplates() {
    setTemplatesOpen(true);
    if (templates === null) start(async () => setTemplates(await attempt(() => loadTemplates(), [])));
  }

  function chooseTemplate(next: WaTemplate) {
    setTemplate(next);
    setParams(Array.from({ length: next.params }, () => ""));
  }

  const preview = template ? template.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] || `{{${n}}}`) : "";

  function submitTemplate() {
    if (!template || params.some((value) => !value.trim())) return;
    setError(null);
    const chosen = template;
    start(async () => {
      const result = await attempt(
        () =>
          sendTemplate({
            conversationId: conversation.id,
            name: chosen.name,
            language: chosen.language,
            params: params.map((value) => value.trim()),
            preview: preview || chosen.name,
          }),
        offline,
      );
      settle(result, () => undefined);
      if (result.ok) {
        setTemplate(null);
        setTemplatesOpen(false);
      }
    });
  }

  function act(run: () => Promise<{ ok: boolean }>) {
    setError(null);
    start(async () => {
      const result = await attempt(run, { ok: false });
      if (!result.ok) setError(t("errors.send"));
    });
  }

  let lastDay = "";
  let lastSide = "";
  const statusLabel = (status: string) => t(`status.${["queued", "sent", "delivered", "read", "failed"].includes(status) ? status : "sent"}`);

  return (
    <section aria-label={conversation.name} className="flex min-h-0 min-w-0 flex-col border-border lg:border-s">
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <Link href="/admin/crm/inbox" aria-label={t("back")} className="grid size-9 place-items-center rounded-full hover:bg-muted lg:hidden">
          <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
        </Link>
        <Avatar name={conversation.name} seed={conversation.waId} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{conversation.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <bdi dir="ltr">+{conversation.waId}</bdi>
            <span aria-hidden> · </span>
            {mine ? t("assigned.you") : conversation.assignedTo ? t("assigned.teammate") : t("assigned.none")}
          </p>
        </div>
        <span
          suppressHydrationWarning
          className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${open ? "bg-[color-mix(in_srgb,var(--wa-unread)_16%,transparent)] text-foreground" : "bg-muted text-muted-foreground"}`}
        >
          {open ? t("window.open", { hours: Math.max(1, Math.ceil(left / 3_600_000)) }) : t("window.closed")}
        </span>
        {me.admin && !mine ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => takeConversation(conversation.id))}
            className="h-9 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {lockedByOther ? t("takeOver") : t("take")}
          </button>
        ) : null}
        {conversation.lockedBy && (conversation.lockedBy === me.uid || me.admin) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => releaseConversation(conversation.id))}
            className="h-9 rounded-full border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            {t("release")}
          </button>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="wa-wall absolute inset-0 overflow-y-auto px-3 py-4 sm:px-8" aria-live="polite">
          {messages.length === 0 ? <p className="mx-auto mt-10 w-fit rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">{t("noMessages")}</p> : null}
          <ol className="flex flex-col gap-0.5">
            {messages.map((message) => {
              const day = dayKey(message.at);
              const side = message.note ? "note" : message.direction;
              const showDay = day !== lastDay;
              const tail = showDay || side !== lastSide;
              lastDay = day;
              lastSide = side;
              const quoted = message.replyTo ? byId.get(message.replyTo) : undefined;
              const placeholder = /^\[(\w+)\]$/.test(message.body);
              const body = placeholder ? "" : message.body;
              return (
                <li key={message.id} className="contents">
                  {showDay ? (
                    <div className="sticky top-1 z-10 my-2 flex justify-center">
                      <span className="rounded-lg bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm" suppressHydrationWarning>{dayLabel(message.at, locale, now)}</span>
                    </div>
                  ) : null}
                  <div className={`group flex ${side === "in" ? "justify-start" : "justify-end"} ${tail ? "mt-2" : ""}`}>
                    <div className="wa-bubble" data-side={side} data-tail={tail}>
                      {message.note ? (
                        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-[color:var(--wa-note-line)]">
                          <Lock className="size-3" aria-hidden />
                          {t("internal")}
                        </p>
                      ) : null}
                      {message.kind === "template" ? (
                        <p className="mb-0.5 flex items-center gap-1 text-[11px] wa-meta">
                          <LayoutTemplate className="size-3" aria-hidden />
                          {t("kinds.template")}
                        </p>
                      ) : null}
                      {quoted ? (
                        <div className="wa-quote mb-1 px-2 py-1 text-xs">
                          <p className="font-medium">{quoted.direction === "in" ? conversation.name : t("assigned.you")}</p>
                          <p className="line-clamp-2 wa-meta">{quoted.body || kindLabel(t, quoted.kind)}</p>
                        </div>
                      ) : null}
                      <Media message={message} labels={{ download: t("download"), unavailable: t("mediaUnavailable") }} />
                      {!message.media && !body && message.kind !== "text" ? (
                        <p className="text-sm italic wa-meta">{kindLabel(t, message.kind)}</p>
                      ) : null}
                      {body ? <p className="whitespace-pre-wrap text-[0.9375rem] leading-snug">{body}</p> : null}
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] wa-meta">
                        <time dateTime={message.at} title={fullTime(message.at, locale)} suppressHydrationWarning>
                          {bubbleTime(message.at, locale)}
                        </time>
                        {side === "out" ? <Ticks status={message.status} label={statusLabel(message.status)} /> : null}
                      </p>
                      {message.status === "failed" && message.error ? <p className="mt-0.5 text-[11px] text-destructive">{message.error}</p> : null}
                      {message.reaction ? (
                        <span className="absolute -bottom-3 end-2 rounded-full bg-card px-1.5 text-sm shadow-sm">{message.reaction}</span>
                      ) : null}
                      {!message.note && open && !blocked ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(message);
                            input.current?.focus();
                          }}
                          aria-label={t("reply")}
                          className="absolute top-1 -end-9 grid size-7 place-items-center rounded-full bg-card opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <CornerUpLeft className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {message.reaction ? <div className="h-3" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
        {below ? (
          <button
            type="button"
            onClick={toBottom}
            aria-label={t("newBelow")}
            className="absolute bottom-3 end-4 grid size-10 place-items-center rounded-full bg-card shadow-md hover:bg-muted"
          >
            <ArrowDown className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <footer className="border-t border-border bg-card px-3 py-2">
        {error ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {blocked ? <p className="mb-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{t("lockedHint")}</p> : null}
        {!open && !note ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("window.closedHint")}</span>
            {sandbox ? null : (
              <button type="button" onClick={openTemplates} className="h-8 rounded-full bg-primary px-3 font-medium text-primary-foreground hover:opacity-90">
                {t("templates.open")}
              </button>
            )}
          </div>
        ) : null}

        {templatesOpen ? (
          <div className="mb-2 grid gap-2 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t("templates.title")}</p>
              <button type="button" aria-label={t("close")} onClick={() => (setTemplatesOpen(false), setTemplate(null))} className="grid size-7 place-items-center rounded-full hover:bg-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {templates === null ? <p className="text-sm text-muted-foreground">{t("templates.loading")}</p> : null}
            {templates?.length === 0 ? <p className="text-sm text-muted-foreground">{t("templates.empty")}</p> : null}
            {templates && templates.length > 0 && !template ? (
              <ul className="grid max-h-48 gap-1 overflow-y-auto">
                {templates.map((item) => (
                  <li key={`${item.name}.${item.language}`}>
                    <button type="button" onClick={() => chooseTemplate(item)} className="w-full rounded-xl px-3 py-2 text-start text-sm hover:bg-muted">
                      <span className="font-medium">{item.name}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {item.language} · {item.category.toLowerCase()}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{item.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {template ? (
              <div className="grid gap-2">
                {params.map((value, index) => (
                  <input
                    key={index}
                    value={value}
                    onChange={(event) => setParams(params.map((item, at) => (at === index ? event.target.value : item)))}
                    placeholder={t("templates.param", { n: index + 1 })}
                    aria-label={t("templates.param", { n: index + 1 })}
                    className="h-9 rounded-full border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                ))}
                <p className="wa-bubble ms-auto whitespace-pre-wrap text-sm" data-side="out">
                  {preview}
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setTemplate(null)} className="h-9 rounded-full border border-border px-3 text-sm hover:bg-muted">
                    {t("templates.back")}
                  </button>
                  <button
                    type="button"
                    disabled={pending || params.some((value) => !value.trim())}
                    onClick={submitTemplate}
                    className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {t("templates.send")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {replyTo ? (
          <div className="wa-quote mb-2 flex items-start gap-2 px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{replyTo.direction === "in" ? conversation.name : t("assigned.you")}</p>
              <p className="truncate text-muted-foreground">{replyTo.body || kindLabel(t, replyTo.kind)}</p>
            </div>
            <button type="button" aria-label={t("cancelReply")} onClick={() => setReplyTo(null)} className="grid size-6 place-items-center rounded-full hover:bg-muted">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        {file ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
            <Paperclip className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" aria-label={t("removeFile")} onClick={() => setFile(null)} className="grid size-6 place-items-center rounded-full hover:bg-card">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className="relative flex items-end gap-1.5">
          {matches.length > 0 ? (
            <ul role="listbox" aria-label={t("quick.title")} className="absolute inset-x-0 bottom-full z-20 mb-2 grid gap-0.5 rounded-2xl border border-border bg-card p-1 shadow-lg">
              {matches.map((reply, index) => (
                <li key={reply.id} role="option" aria-selected={index === pick}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyReply(reply)}
                    className={`w-full rounded-xl px-3 py-2 text-start text-sm ${index === pick ? "bg-muted" : "hover:bg-muted"}`}
                  >
                    <span className="font-medium">/{reply.shortcut}</span>
                    <span className="ms-2 line-clamp-1 text-muted-foreground">{reply.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            aria-pressed={note}
            aria-label={t("note")}
            title={t("note")}
            onClick={() => setNote((value) => !value)}
            className={`grid size-10 shrink-0 place-items-center rounded-full ${note ? "bg-[color:var(--wa-note)] text-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <StickyNote className="size-5" aria-hidden />
          </button>
          {!note && open && !blocked ? (
            <>
              <button
                type="button"
                aria-label={t("attach")}
                title={sandbox ? t("sandbox.noMedia") : t("attach")}
                disabled={sandbox}
                onClick={() => fileInput.current?.click()}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <Paperclip className="size-5" aria-hidden />
              </button>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              {!sandbox ? (
                <button
                  type="button"
                  aria-label={t("templates.open")}
                  title={t("templates.open")}
                  onClick={openTemplates}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <LayoutTemplate className="size-5" aria-hidden />
                </button>
              ) : null}
            </>
          ) : null}
          <textarea
            ref={input}
            rows={1}
            value={draft}
            disabled={!note && (!open || blocked)}
            onChange={(event) => {
              setDraft(event.target.value);
              setPick(0);
            }}
            onKeyDown={onKey}
            aria-label={note ? t("placeholderNote") : t("placeholder")}
            placeholder={note ? t("placeholderNote") : file ? t("caption") : t("placeholder")}
            className={`max-h-40 min-h-10 flex-1 resize-none rounded-3xl px-4 py-2.5 text-[0.9375rem] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 ${note ? "bg-[color:var(--wa-note)]" : "bg-muted"}`}
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || (!draft.trim() && !(file && !note)) || (!note && (!open || blocked))}
            aria-label={note ? t("saveNote") : t("send")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <SendHorizontal className="size-5 rtl:rotate-180" aria-hidden />
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">{note ? t("noteHint") : t("keysHint")}</p>
      </footer>
    </section>
  );
}
