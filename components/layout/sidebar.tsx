"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronDown,
  Contact,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Users,
  Wallet,
} from "lucide-react";
import { LogoBadge } from "@/components/brand/logo-badge";
import { agents } from "@/lib/agents.config";
import { portals } from "@/lib/portals.config";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type SidebarProps = {
  profile: Profile;
  className?: string;
};

type OpenSection = "agents" | "portals" | null;

function sectionFromPath(pathname: string): OpenSection {
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return "agents";
  if (pathname === "/portals" || pathname.startsWith("/portals/")) return "portals";
  return null;
}

export function Sidebar({ profile, className }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = profile.role === "admin";

  const agentsActive = pathname === "/agents" || pathname.startsWith("/agents/");
  const portalsActive = pathname === "/portals" || pathname.startsWith("/portals/");
  const vaultActive = pathname === "/vault" || pathname.startsWith("/vault/");
  const financeActive =
    pathname === "/finance" || pathname.startsWith("/finance/");
  const employeesActive =
    pathname === "/employees" || pathname.startsWith("/employees/");

  const [openSection, setOpenSection] = useState<OpenSection>(() =>
    sectionFromPath(pathname),
  );

  useEffect(() => {
    const fromPath = sectionFromPath(pathname);
    if (fromPath) setOpenSection(fromPath);
  }, [pathname]);

  function toggleSection(section: Exclude<OpenSection, null>) {
    setOpenSection((current) => (current === section ? null : section));
  }

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-e border-black/[0.08] bg-white",
        className,
      )}
    >
      <div className="flex flex-col items-center px-5 pb-5 pt-7">
        <LogoBadge centered className="w-full" />
        <div className="mt-5 h-px w-full bg-black/[0.06]">
          <div className="mx-auto h-px w-10 bg-highlight" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <NavSection title="סקירה">
          <NavItem
            href="/dashboard"
            label="לוח בקרה"
            icon={LayoutDashboard}
            active={pathname === "/dashboard"}
          />
        </NavSection>

        <NavSection title="עבודה">
          <ExpandableNav
            href="/agents"
            label="סוכני AI"
            icon={Bot}
            sectionActive={agentsActive}
            overviewActive={pathname === "/agents"}
            open={openSection === "agents"}
            onToggle={() => toggleSection("agents")}
            toggleLabel={
              openSection === "agents"
                ? "סגירת רשימת סוכנים"
                : "פתיחת רשימת סוכנים"
            }
          >
            {agents.map((agent) => (
              <SubNavItem
                key={agent.slug}
                href={agent.href}
                label={agent.name}
                active={
                  pathname === agent.href ||
                  pathname.startsWith(`${agent.href}/`)
                }
              />
            ))}
          </ExpandableNav>

          <ExpandableNav
            href="/portals"
            label="איחוד פורטלים"
            icon={Layers3}
            sectionActive={portalsActive}
            overviewActive={pathname === "/portals"}
            open={openSection === "portals"}
            onToggle={() => toggleSection("portals")}
            toggleLabel={
              openSection === "portals"
                ? "סגירת רשימת פורטלים"
                : "פתיחת רשימת פורטלים"
            }
          >
            {portals.map((portal) => (
              <SubNavItem
                key={portal.slug}
                href={portal.href}
                label={portal.name}
                active={pathname === portal.href}
              />
            ))}
          </ExpandableNav>

          <NavItem
            href="/vault"
            label="כספת סיסמאות"
            icon={KeyRound}
            active={vaultActive}
          />
          {isAdmin ? (
            <NavItem
              href="/finance"
              label="פיננסים"
              icon={Wallet}
              active={financeActive}
            />
          ) : null}
        </NavSection>

        {isAdmin ? (
          <NavSection title="עובדים">
            <NavItem
              href="/employees"
              label="רשימת עובדים"
              icon={Contact}
              active={employeesActive}
            />
          </NavSection>
        ) : null}

        {isAdmin && (
          <NavSection title="ארגון">
            <NavItem
              href="/dashboard/users"
              label="ניהול משתמשים"
              icon={Users}
              active={pathname.startsWith("/dashboard/users")}
            />
          </NavSection>
        )}
      </nav>

      <div className="border-t border-black/[0.06] px-5 py-4 text-center">
        <p className="text-[11px] font-semibold text-foreground">ליבה OS</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          מערכת ניהול פנימית
        </p>
      </div>
    </aside>
  );
}

function ExpandableNav({
  href,
  label,
  icon: Icon,
  sectionActive,
  overviewActive,
  open,
  onToggle,
  toggleLabel,
  children,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionActive: boolean;
  overviewActive: boolean;
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={href}
          className={cn(
            "relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
            sectionActive
              ? "bg-background text-foreground"
              : "text-black/55 hover:bg-background/80 hover:text-foreground",
          )}
        >
          {overviewActive && (
            <span className="absolute inset-y-1.5 start-0 w-[2px] rounded-full bg-highlight" />
          )}
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              sectionActive ? "text-foreground" : "text-black/35",
            )}
          />
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={open}
          onClick={onToggle}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-background hover:text-foreground",
            open && "text-foreground",
          )}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>
      {open && (
        <ul className="mt-0.5 space-y-0.5 border-s border-black/[0.06] ms-4 ps-2">
          {children}
        </ul>
      )}
    </div>
  );
}

function SubNavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "relative block rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
          active
            ? "bg-background text-foreground"
            : "text-black/50 hover:bg-background/80 hover:text-foreground",
        )}
      >
        {active && (
          <span className="absolute inset-y-1 start-0 w-[2px] rounded-full bg-highlight" />
        )}
        {label}
      </Link>
    </li>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-background text-foreground"
          : "text-black/55 hover:bg-background/80 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 start-0 w-[2px] rounded-full bg-highlight" />
      )}
      <Icon
        className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-black/35")}
      />
      <span>{label}</span>
    </Link>
  );
}
