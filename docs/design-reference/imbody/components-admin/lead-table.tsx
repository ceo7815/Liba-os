"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { CrmPeek, type PeekCard } from "@/components/admin/crm-peek";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";
import { MenuField } from "@/components/admin/menu-field";
import type { CrmKind } from "@/lib/admin/crm-ref";
import { maskPhone } from "@/lib/admin/phone";
import { bulkLeads, moveLead } from "@/lib/crm/actions";

type BulkInput = {
  ids: string[];
  status?: string;
  owner?: string;
  addTags?: string[];
  removeTags?: string[];
};

export type TableLead = {
  id: string;
  number: number;
  name: string;
  title: string;
  phone: string;
  email: string;
  source: string;
  temperature: string;
  status: string;
  owner: string | null;
  tags: string[];
  value: string;
  when: string;
  age: string;
  customerId?: string;
};

type Option = { value: string; label: string };

const pick = "__pick";

export function LeadTable({
  leads,
  statuses,
  statusMeta,
  members,
  canEdit,
  hrefBase = "/admin/crm/leads",
  kind = "lead",
  emptyKey = "emptyLeads",
  showSource = true,
  showTemperature = true,
  onBulk = bulkLeads,
  onMove = moveLead,
}: {
  leads: TableLead[];
  statuses: Option[];
  statusMeta: Record<string, { label: string; tone: Tone }>;
  members: Option[];
  canEdit: boolean;
  hrefBase?: string;
  kind?: CrmKind;
  emptyKey?: "emptyLeads" | "emptyDeals";
  showSource?: boolean;
  showTemperature?: boolean;
  onBulk?: (input: BulkInput) => Promise<{ ok: boolean; count: number }>;
  onMove?: (id: string, status: string) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [rows, setRows] = useState(leads);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagDraft, setTagDraft] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setRows(leads);
    setSelected((current) => new Set([...current].filter((id) => leads.some((lead) => lead.id === id))));
  }, [leads]);

  const ownerName = useMemo(() => new Map(members.map((member) => [member.value, member.label])), [members]);
  const allChecked = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const selectedTags = useMemo(
    () => [...new Set(rows.filter((row) => selected.has(row.id)).flatMap((row) => row.tags))].sort(),
    [rows, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply(
    ids: string[],
    change: { status?: string; owner?: string; addTags?: string[]; removeTags?: string[] },
    local: (row: TableLead) => TableLead,
  ) {
    const before = rows;
    setNotice(null);
    setRows(rows.map((row) => (ids.includes(row.id) ? local(row) : row)));
    start(async () => {
      const result = await onBulk({ ids, ...change }).catch(() => ({ ok: false, count: 0 }));
      if (!result.ok) {
        setRows(before);
        setNotice({ kind: "error", text: t("bulk.failed") });
        return;
      }
      if (ids.length > 1) setNotice({ kind: "ok", text: t("bulk.done", { count: result.count }) });
      router.refresh();
    });
  }

  function moveOne(id: string, status: string) {
    const before = rows;
    setRows(rows.map((row) => (row.id === id ? { ...row, status } : row)));
    start(async () => {
      const result = await onMove(id, status).catch(() => ({ ok: false }));
      if (!result.ok) {
        setRows(before);
        setNotice({ kind: "error", text: t("bulk.failed") });
      }
    });
  }

  const ids = [...selected];
  const cleanTag = tagDraft.trim().slice(0, 40);
  const open = rows.find((row) => row.id === openId) ?? null;
  const peek: PeekCard | null = open
    ? {
        kind,
        id: open.id,
        number: open.number,
        name: open.name,
        href: `${hrefBase}/${open.id}`,
        title: open.title,
        statusLabel: statusMeta[open.status]?.label ?? open.status,
        tone: statusMeta[open.status]?.tone,
        phone: open.phone,
        email: open.email,
        owner: open.owner ? (ownerName.get(open.owner) ?? t("bulk.teammate")) : t("bulk.noOwner"),
        sourceLabel: showSource ? t(`sources.${open.source}`) : undefined,
        temperature: showTemperature ? open.temperature : undefined,
        temperatureLabel: showTemperature
          ? t(`temperatures.${["hot", "warm", "cold"].includes(open.temperature) ? open.temperature : "warm"}`)
          : undefined,
        value: open.value,
        when: open.when,
        age: open.age,
        tags: open.tags,
        links: open.customerId ? [{ href: `/admin/crm/customers/${open.customerId}`, label: t("customers.openCard") }] : [],
      }
    : null;

  return (
    <div className="grid gap-3" aria-busy={pending}>
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`text-sm ${notice.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {notice.text}
        </p>
      ) : null}
      <section className="work-sheet overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              {canEdit ? (
                <th className="w-10 px-4 py-3 text-start">
                  <input
                    type="checkbox"
                    aria-label={t("bulk.selectAll")}
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))}
                    className="size-4 accent-[var(--primary)]"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 text-start font-medium">{t("number")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("contact")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("owner")}</th>
              {showSource ? <th className="px-4 py-3 text-start font-medium">{t("source")}</th> : null}
              <th className="px-4 py-3 text-start font-medium">{t("value")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={(canEdit ? 7 : 6) + (showSource ? 1 : 0)} className="px-4 py-10 text-muted-foreground">
                  {t(emptyKey)}
                </td>
              </tr>
            ) : null}
            {rows.map((lead) => {
              const meta = statusMeta[lead.status];
              return (
                <tr key={lead.id} className={`border-b border-border last:border-b-0 hover:bg-[#f7f6f3] ${selected.has(lead.id) ? "bg-muted/60" : ""}`}>
                  {canEdit ? (
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        aria-label={`${t("bulk.select")}: ${lead.name}`}
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        className="mt-1 size-4 accent-[var(--primary)]"
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 align-top">
                    <button type="button" onClick={() => setOpenId(lead.id)} className="crm-no hover:underline">
                      {t(`ref.${kind}`, { number: lead.number })}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button type="button" onClick={() => setOpenId(lead.id)} className="crm-name inline-flex items-center gap-2" aria-label={`${t("peek.open")}: ${lead.name}`}>
                      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e7f0eb] text-xs font-semibold text-primary">{lead.name.slice(0, 1)}</span>
                      {lead.name}
                    </button>
                    {lead.title ? <span className="block text-xs text-muted-foreground">{lead.title}</span> : null}
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {showTemperature ? (
                        <CrmPill kind="temperature" value={lead.temperature}>
                          {t(`temperatures.${["hot", "warm", "cold"].includes(lead.temperature) ? lead.temperature : "warm"}`)}
                        </CrmPill>
                      ) : null}
                      {lead.tags.map((item) => (
                        <span key={item} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{lead.when}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {lead.phone ? <bdi className="block">{maskPhone(lead.phone, Boolean(lead.owner), process.env.NEXT_PUBLIC_PHONE_MASK)}</bdi> : null}
                    {lead.email ? <bdi className="block">{lead.email}</bdi> : null}
                  </td>
                  <td className="min-w-44 px-4 py-3 align-top">
                    {canEdit ? (
                      <MenuField
                        ariaLabel={`${t("status")}: ${lead.name}`}
                        value={statuses.some((item) => item.value === lead.status) ? lead.status : (statuses[0]?.value ?? lead.status)}
                        onChange={(status) => moveOne(lead.id, status)}
                        options={statuses}
                      />
                    ) : (
                      <CrmPill tone={meta?.tone ?? "neutral"}>{meta?.label ?? lead.status}</CrmPill>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">{lead.age}</span>
                  </td>
                  <td className="min-w-40 px-4 py-3 align-top">
                    {canEdit && members.length > 0 ? (
                      <MenuField
                        ariaLabel={`${t("owner")}: ${lead.name}`}
                        value={lead.owner ?? pick}
                        onChange={(owner) => {
                          if (owner === pick) return;
                          apply([lead.id], { owner }, (row) => ({ ...row, owner }));
                        }}
                        options={[...(lead.owner ? [] : [{ value: pick, label: t("bulk.noOwner") }]), ...members]}
                      />
                    ) : (
                      <span>{lead.owner ? (ownerName.get(lead.owner) ?? t("bulk.teammate")) : t("bulk.noOwner")}</span>
                    )}
                  </td>
                  {showSource ? <td className="px-4 py-3 align-top">{t(`sources.${lead.source}`)}</td> : null}
                  <td className="px-4 py-3 align-top">{lead.value ? <bdi>{lead.value}</bdi> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canEdit && selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label={t("bulk.title")}
          className="sticky bottom-4 z-20 mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 rounded-3xl border border-border bg-card p-2 shadow-lg"
        >
          <span className="px-3 text-sm font-medium">{t("bulk.selected", { count: selected.size })}</span>
          <div className="w-44">
            <MenuField
              ariaLabel={t("bulk.status")}
              value={pick}
              onChange={(status) => {
                if (status !== pick) apply(ids, { status }, (row) => ({ ...row, status }));
              }}
              options={[{ value: pick, label: t("bulk.status") }, ...statuses]}
            />
          </div>
          {members.length > 0 ? (
            <div className="w-44">
              <MenuField
                ariaLabel={t("bulk.owner")}
                value={pick}
                onChange={(owner) => {
                  if (owner !== pick) apply(ids, { owner }, (row) => ({ ...row, owner }));
                }}
                options={[{ value: pick, label: t("bulk.owner") }, ...members]}
              />
            </div>
          ) : null}
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (!cleanTag) return;
              apply(ids, { addTags: [cleanTag] }, (row) => ({ ...row, tags: [...new Set([...row.tags, cleanTag])].sort() }));
              setTagDraft("");
            }}
          >
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              maxLength={40}
              placeholder={t("bulk.tagPlaceholder")}
              aria-label={t("bulk.addTag")}
              className="h-10 w-36 rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button type="submit" disabled={!cleanTag || pending} className="h-10 rounded-full border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">
              {t("bulk.addTag")}
            </button>
          </form>
          {selectedTags.length > 0 ? (
            <div className="w-40">
              <MenuField
                ariaLabel={t("bulk.removeTag")}
                value={pick}
                onChange={(item) => {
                  if (item !== pick) apply(ids, { removeTags: [item] }, (row) => ({ ...row, tags: row.tags.filter((value) => value !== item) }));
                }}
                options={[{ value: pick, label: t("bulk.removeTag") }, ...selectedTags.map((item) => ({ value: item, label: item }))]}
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label={t("bulk.clear")}
            className="ms-auto grid size-10 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <CrmPeek card={peek} open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }} />
    </div>
  );
}
