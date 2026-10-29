"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrmPeek, type PeekCard } from "@/components/admin/crm-peek";
import { CrmPill } from "@/components/admin/crm-pill";
import { MenuField } from "@/components/admin/menu-field";
import { changeActive, changeRole } from "@/lib/crm/team-actions";
import { teamRoles, type TeamMember, type TeamRole } from "@/lib/admin/team-roles";

export function TeamTable({
  members,
  canEdit,
  me,
  owner,
}: {
  members: TeamMember[];
  canEdit: boolean;
  me: string;
  owner: boolean;
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [rows, setRows] = useState(members);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setRows(members), [members]);

  const roles = teamRoles
    .filter((role) => owner || role !== "owner")
    .map((role) => ({ value: role, label: t(`team.roles.${role}`) }));

  function setRole(id: string, role: TeamRole) {
    const before = rows;
    setNotice(null);
    setRows(rows.map((row) => (row.id === id ? { ...row, role } : row)));
    start(async () => {
      const result = await changeRole(id, role).catch(() => ({ ok: false, lastOwner: false }));
      if (!result.ok) {
        setRows(before);
        setNotice(result.lastOwner ? t("team.errors.lastOwner") : t("team.errors.save"));
        return;
      }
      router.refresh();
    });
  }

  function setActive(id: string, active: boolean) {
    const before = rows;
    setNotice(null);
    setRows(rows.map((row) => (row.id === id ? { ...row, active } : row)));
    start(async () => {
      const result = await changeActive(id, active).catch(() => ({ ok: false, lastOwner: false }));
      if (!result.ok) {
        setRows(before);
        setNotice(result.lastOwner ? t("team.errors.lastOwner") : t("team.errors.save"));
        return;
      }
      router.refresh();
    });
  }

  const open = rows.find((row) => row.id === openId) ?? null;
  const peek: PeekCard | null = open
    ? {
        kind: "member",
        id: open.id,
        number: open.number,
        name: open.name || t("team.unnamed"),
        href: `/admin/crm/leads?owner=${open.id}`,
        statusLabel: t(`team.roles.${open.role}`),
        tone: open.active ? "success" : "neutral",
        email: open.email,
        when: open.at,
        extra: [
          { label: t("leads"), value: String(open.leads) },
          { label: t("deals.listTitle"), value: String(open.deals) },
          { label: t("customers.tabs.customers"), value: String(open.customers) },
          { label: t("tickets.short"), value: String(open.tickets) },
        ],
        links: [
          { href: `/admin/crm/leads?owner=${open.id}`, label: t("team.openLeads") },
          { href: `/admin/crm/deals?owner=${open.id}`, label: t("team.openDeals") },
          { href: `/admin/crm/customers?owner=${open.id}`, label: t("team.openCustomers") },
          { href: `/admin/crm/tickets?owner=${open.id}`, label: t("team.openTickets") },
          { href: `/admin/crm/calendar?owner=${open.id}`, label: t("team.openCalendar") },
        ],
      }
    : null;

  return (
    <div className="grid gap-3" aria-busy={pending}>
      {notice ? (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}
      <section className="work-sheet overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">{t("number")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("team.role")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("leads")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("deals.listTitle")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("customers.tabs.customers")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("tickets.short")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("team.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.id} className={`border-b border-border last:border-b-0 ${member.active ? "" : "opacity-60"}`}>
                <td className="px-4 py-3 align-top">
                  <button type="button" onClick={() => setOpenId(member.id)} className="crm-no hover:underline">
                    {t("ref.member", { number: member.number })}
                  </button>
                </td>
                <td className="px-4 py-3 align-top">
                  <button type="button" onClick={() => setOpenId(member.id)} className="crm-name" aria-label={`${t("peek.open")}: ${member.name || t("team.unnamed")}`}>
                    {member.name || t("team.unnamed")}
                    {member.id === me ? <span className="text-xs font-normal text-muted-foreground">{t("bulk.me")}</span> : null}
                  </button>
                  {member.email ? (
                    <span className="mt-1 block break-all text-xs text-muted-foreground">
                      <bdi>{member.email}</bdi>
                    </span>
                  ) : null}
                </td>
                <td className="min-w-40 px-4 py-3 align-top">
                  {canEdit ? (
                    <MenuField
                      ariaLabel={`${t("team.role")}: ${member.name}`}
                      value={member.role}
                      onChange={(role) => setRole(member.id, role as TeamRole)}
                      options={roles}
                    />
                  ) : (
                    <CrmPill tone={member.role === "owner" ? "success" : "neutral"}>{t(`team.roles.${member.role}`)}</CrmPill>
                  )}
                </td>
                <td className="px-4 py-3 align-top tabular-nums">
                  <Link href={`/admin/crm/leads?owner=${member.id}`} className="hover:underline">
                    {member.leads}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top tabular-nums">
                  <Link href={`/admin/crm/deals?owner=${member.id}`} className="hover:underline">
                    {member.deals}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top tabular-nums">
                  <Link href={`/admin/crm/customers?owner=${member.id}`} className="hover:underline">
                    {member.customers}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top tabular-nums">
                  <Link href={`/admin/crm/tickets?owner=${member.id}`} className="hover:underline">
                    {member.tickets}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setActive(member.id, !member.active)}
                      className="h-10 rounded-full border border-border px-3 text-sm hover:bg-muted"
                    >
                      {member.active ? t("team.pause") : t("team.resume")}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{member.active ? t("team.active") : t("team.paused")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <CrmPeek card={peek} open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }} />
    </div>
  );
}
