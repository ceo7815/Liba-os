"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  TrendingUp,
  Trophy,
  UserCheck,
  Volume2,
  Wallet,
  XCircle,
} from "lucide-react";
import { SalesTrendChart } from "@/components/sales-dashboard/sales-charts";
import {
  playChaChingSound,
  SalesCelebration,
  speakTest,
} from "@/components/sales-dashboard/sales-celebration";
import "./sales-tv.css";
import { getDemoDashboard } from "@/lib/sales-dashboard/demo";
import type { AgentStat, DashboardData, SaleAlert } from "@/lib/sales-dashboard/types";

const POLL_MS = 5_000;
const MAIN_SCREEN_MS = 3 * 60_000;
const LEADERBOARD_SCREEN_MS = 60_000;
const YELLOW = "#ffd400";
const NAVY = "#1b2a4a";

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const doc = document as FsDoc;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

const PROJECTION_WINDOW_NAME = "liba-sales-tv";

function projectionWindowFeatures(): string {
  const width = window.screen.availWidth || window.screen.width || 1920;
  const height = window.screen.availHeight || window.screen.height || 1080;
  const left = "availLeft" in window.screen ? Number(window.screen.availLeft) || 0 : 0;
  const top = "availTop" in window.screen ? Number(window.screen.availTop) || 0 : 0;
  return [
    "popup=yes",
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "scrollbars=no",
    "resizable=yes",
  ].join(",");
}

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`;
}

type SalesTvScreenProps = {
  token?: string;
  embedded?: boolean;
  initialData?: DashboardData;
};

function ils(n: number): string {
  return Math.round(n).toLocaleString("he-IL");
}

function clockNow(): string {
  return new Date().toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatUpdatedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function SalesTvScreen({
  token,
  embedded = false,
  initialData,
}: SalesTvScreenProps) {
  const presenting = !embedded;
  const [data, setData] = useState<DashboardData>(
    initialData ?? getDemoDashboard,
  );
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">(
    initialData ? "ok" : "loading",
  );
  const [clock, setClock] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [alert, setAlert] = useState<SaleAlert | null>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [deckPage, setDeckPage] = useState<0 | 1>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const projectionWinRef = useRef<Window | null>(null);
  const queueRef = useRef<SaleAlert[]>([]);
  const seenKeysRef = useRef<Set<string> | null>(null);
  const initializedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const closeAlert = useCallback(() => {
    if (queueRef.current.length > 0) queueRef.current.shift();
    setAlert(null);
    window.setTimeout(() => {
      const next = queueRef.current[0];
      if (next) setAlert(next);
    }, 900);
  }, []);

  const enqueueAlerts = useCallback((items: SaleAlert[]) => {
    if (items.length === 0) return;
    queueRef.current.push(...items);
    // Do not shift inside the updater — Strict Mode runs it twice in development.
    setAlert((current) => current ?? queueRef.current[0] ?? null);
  }, []);

  const load = useCallback(async () => {
    const params = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/sales-dashboard${params}`, {
      cache: "no-store",
      credentials: "include",
      headers: token ? { "x-sales-tv-token": token } : undefined,
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? "אין הרשאה" : "שגיאת טעינה");
    }
    const next = (await res.json()) as DashboardData;
    setData(next);
    setLoadState("ok");

    const keys = new Set(next.activePolicies.map((p) => p.key));
    if (!initializedRef.current) {
      seenKeysRef.current = keys;
      initializedRef.current = true;
      return;
    }
    const prev = seenKeysRef.current ?? new Set<string>();
    const fresh = next.activePolicies.filter((p) => !prev.has(p.key));
    seenKeysRef.current = keys;
    enqueueAlerts(fresh);
  }, [enqueueAlerts, token]);

  useEffect(() => {
    setClock(clockNow());
    const t = window.setInterval(() => setClock(clockNow()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const syncFs = () => {
      setNativeFs(Boolean(fullscreenElement()));
    };
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener("webkitfullscreenchange", syncFs);
    };
  }, []);

  const openProjectionWindow = useCallback(() => {
    const existing = projectionWinRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    const url = new URL("/sales-tv", window.location.origin);
    if (token) url.searchParams.set("token", token);
    const popup = window.open(
      url.toString(),
      PROJECTION_WINDOW_NAME,
      projectionWindowFeatures(),
    );
    if (!popup) {
      showToast("הדפדפן חסם את החלון. אפשרו חלונות קופצים לאתר זה.");
      return;
    }
    projectionWinRef.current = popup;
    try {
      const screenWithOrigin = window.screen as Screen & {
        availLeft?: number;
        availTop?: number;
      };
      popup.moveTo(screenWithOrigin.availLeft ?? 0, screenWithOrigin.availTop ?? 0);
      popup.resizeTo(
        window.screen.availWidth || window.innerWidth,
        window.screen.availHeight || window.innerHeight,
      );
      popup.focus();
    } catch {
      /* Some browsers block move/resize after open. */
    }
    showToast("נפתח חלון לטלוויזיה. גררו אותו למסך השני ולחצו מקסם.");
  }, [showToast, token]);

  const toggleNativeFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (fullscreenElement()) {
        const doc = document as FsDoc;
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
        return;
      }
      const node = el as FsEl;
      if (el.requestFullscreen) await el.requestFullscreen();
      else await node.webkitRequestFullscreen?.();
    } catch {
      showToast("לא ניתן להסתיר את שורת המשימות. המקסמו את החלון על הטלוויזיה.");
    }
  }, [showToast]);

  const minimizeKioskWindow = useCallback(async () => {
    try {
      if (fullscreenElement()) {
        const doc = document as FsDoc;
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      }
    } catch {
      /* keep going so the window chrome can appear */
    }
    try {
      const width = Math.min(1600, (window.screen.availWidth || 1600) - 80);
      const height = Math.min(900, (window.screen.availHeight || 900) - 80);
      window.resizeTo(width, height);
      window.moveTo(40, 40);
    } catch {
      /* popup move/resize may be blocked */
    }
    window.blur();
    showToast("אפשר למזער עכשיו מהמקף בשורת הכותרת. כשתפתחו שוב — התצוגה נשארת מלאה בחלון.");
  }, [showToast]);

  const onFullscreenClick = useCallback(() => {
    if (embedded) {
      openProjectionWindow();
      return;
    }
    void toggleNativeFullscreen();
  }, [embedded, openProjectionWindow, toggleNativeFullscreen]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setLoadState((prev) => (prev === "ok" ? prev : "error"));
      showToast(err instanceof Error ? err.message : "שגיאת טעינה");
    });
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, showToast]);

  useEffect(() => {
    if (!presenting) {
      setDeckPage(0);
      return;
    }
    const delay = deckPage === 0 ? MAIN_SCREEN_MS : LEADERBOARD_SCREEN_MS;
    const id = window.setTimeout(() => {
      setDeckPage((page) => (page === 0 ? 1 : 0));
    }, delay);
    return () => window.clearTimeout(id);
  }, [presenting, deckPage]);

  const monthAgents = useMemo(
    () => data.monthAgents ?? [],
    [data.monthAgents],
  );
  const maxAgent = Math.max(...data.agents.map((a) => a.sum), 1);
  const maxMonthAgent = Math.max(...monthAgents.map((a) => a.sum), 1);
  const activationPct = data.currentMonth.totalCount
    ? Math.round(
        (data.currentMonth.activeCount / data.currentMonth.totalCount) * 100,
      )
    : 0;

  const ticks = useMemo(() => {
    const leader = data.agents[0];
    const monthLeader = monthAgents[0];
    const topCompany = data.companies[0];
    return [
      {
        kind: "g" as const,
        label: "חודש",
        text: monthLeader
          ? `מוביל החודש: ${monthLeader.name} – ${ils(monthLeader.sum)}₪`
          : `${data.currentMonth.label}: ${ils(data.currentMonth.totalSum)}₪`,
      },
      {
        kind: "n" as const,
        label: "נתון",
        text: `${data.active} פוליסות פעילות | ${ils(data.premium)}₪ פרמיה כוללת`,
      },
      {
        kind: "c" as const,
        label: "מוביל",
        text: leader
          ? `${leader.name} – ${leader.count} פוליסות | ${ils(leader.sum)}₪`
          : "אין נתוני משווקים",
      },
      {
        kind: "p" as const,
        label: "חברה",
        text: topCompany
          ? `${topCompany.name} – ${topCompany.count} פוליסות`
          : "אין פילוח חברות",
      },
      {
        kind: "g" as const,
        label: "מכירות",
        text: `${data.currentMonth.label}: ${ils(data.currentMonth.totalSum)}₪ · ${data.currentMonth.totalCount} מכירות`,
      },
      {
        kind: "n" as const,
        label: "סנכרון",
        text:
          data.source === "live"
            ? `עודכן ${formatUpdatedAt(data.syncedAt)}`
            : "מצב הדגמה — ממתין לחיבור OneDrive",
      },
    ];
  }, [data, monthAgents]);

  const tickerLoop = [...ticks, ...ticks];
  const avgPremium = data.active ? Math.round(data.premium / data.active) : 0;
  const statusLabel = data.error
    ? "שגיאה"
    : loadState === "loading"
      ? "טוען…"
      : data.source === "live"
        ? "ניטור חי פעיל"
        : "מצב הדגמה";
  const statusClass =
    data.error || loadState === "error"
      ? ""
      : loadState === "loading"
        ? "warn"
        : data.source === "live"
          ? "ok"
          : "warn";
  const updatedLabel = formatUpdatedAt(data.syncedAt);
  const syncSub = data.error
    ? data.error
    : loadState === "loading"
      ? "טוען את דוח המנהלים מ-OneDrive…"
      : data.source === "live"
        ? `מנוטר: ${data.fileName ?? "קובץ OneDrive"}`
        : "אין חיבור ל-OneDrive עדיין — מוצגים נתוני הדגמה עד להגדרת Graph";

  return (
    <div
      ref={rootRef}
      className={`sales-tv${embedded ? " embedded" : " is-fs"}`}
    >
      <header className="sales-tv-header">
        <div className="sales-tv-logo">
          <Image
            src="/brand/liba-logo.png"
            alt="ליבה"
            width={160}
            height={56}
            className="sales-tv-logo-img"
            priority
          />
          <div>
            <div className="sales-tv-logo-name">דשבורד מכירות</div>
            <div className="sales-tv-logo-sub">ליבה ביטוח ופיננסים</div>
          </div>
        </div>
        <div className="sales-tv-hend">
          <div className="sales-tv-clock">
            <span className="sales-tv-dot" />
            <span>{clock}</span>
          </div>
          <div className="sales-tv-ibtn" title="בוטלו / גניזה">
            <Bell size={16} strokeWidth={2.2} />
            <span className="sales-tv-ndot">{data.issues}</span>
          </div>
          {presenting ? (
            <div className="sales-tv-deck-ind">
              <button
                type="button"
                className={deckPage === 0 ? "on" : ""}
                onClick={() => setDeckPage(0)}
              >
                ראשי · 3 דק׳
              </button>
              <button
                type="button"
                className={deckPage === 1 ? "on" : ""}
                onClick={() => setDeckPage(1)}
              >
                לידרבורד · 1 דק׳
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`sales-tv-btn sales-tv-fs-btn${presenting && nativeFs ? " is-on" : ""}`}
            onClick={onFullscreenClick}
            aria-pressed={presenting ? nativeFs : undefined}
            title={
              embedded
                ? "פתח חלון נפרד לטלוויזיה והמשיכו לעבוד כאן"
                : nativeFs
                  ? "החזר את שורת הכותרת כדי שאפשר למזער"
                  : "מלא את המסך על הטלוויזיה"
            }
          >
            {presenting && nativeFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {embedded
              ? "חלון לטלוויזיה"
              : nativeFs
                ? "יציאה"
                : "מסך מלא"}
          </button>
          {presenting ? (
            <button
              type="button"
              className="sales-tv-btn"
              onClick={() => void minimizeKioskWindow()}
              title="החזירו את שורת הכותרת ואפשר למזער בלי לאבד את תצוגת הטלוויזיה"
            >
              <Minimize2 size={15} />
              מזער
            </button>
          ) : null}
        </div>
      </header>

      <div className="sales-tv-ticker">
        <div className="sales-tv-ttrack">
          {tickerLoop.map((tick, i) => (
            <span key={`${tick.label}-${i}`} className="sales-tv-tick">
              <span className={`sales-tv-tb sales-tv-tb-${tick.kind}`}>
                {tick.label}
              </span>
              {tick.text}
            </span>
          ))}
        </div>
      </div>

      <div className="sales-tv-deck">
        <div
          className={`sales-tv-stage${deckPage === 1 ? " is-lb" : ""}`}
        >
          <section className="sales-tv-page sales-tv-page-main">
            <div className="sales-tv-main">
        <div className="sales-tv-sync">
          <div className="sales-tv-sync-info">
            <span className="sales-tv-sync-ico">
              <TrendingUp size={18} strokeWidth={2.4} />
            </span>
            <div>
              <div className="sales-tv-sync-title">ניטור חי — דוח מכירות</div>
              <div className="sales-tv-sync-sub">{syncSub}</div>
              {loadState === "ok" && data.source === "live" ? (
                <div className="sales-tv-updated">
                  עדכון אחרון
                  <strong>{updatedLabel}</strong>
                </div>
              ) : null}
            </div>
          </div>
          <div className="sales-tv-sync-right">
            <span className={`sales-tv-status ${statusClass}`}>{statusLabel}</span>
            <button
              type="button"
              className="sales-tv-btn cyan"
              onClick={() => void load().catch(() => showToast("שגיאת רענון"))}
            >
              <RefreshCw size={14} />
              רענון
            </button>
            <button
              type="button"
              className="sales-tv-btn gold"
              onClick={() =>
                enqueueAlerts([
                  {
                    key: `test-${Date.now()}`,
                    client: "ישראל ישראלי",
                    product: "בריאות + מחלות קשות",
                    company: "מגדל",
                    premium: 1850,
                    agent: "ניב קובי",
                  },
                ])
              }
            >
              <Volume2 size={14} />
              בדיקת צליל
            </button>
            <button
              type="button"
              className="sales-tv-btn gold"
              onClick={() => {
                playChaChingSound();
                showToast("צ'ינג — אם לא שמעת, בדוק ווליום");
              }}
            >
              <Volume2 size={14} />
              {"צ'ינג בלבד"}
            </button>
            <button
              type="button"
              className="sales-tv-btn violet"
              onClick={() => {
                speakTest();
                showToast("בדיקת קול");
              }}
            >
              בדיקת קול
            </button>
          </div>
        </div>

        <div className="sales-tv-g3">
          <div className="sales-tv-kpi n">
            <div className="sales-tv-kpi-ico">
              <ClipboardList size={18} />
            </div>
            <div className="sales-tv-kpi-num">{data.active.toLocaleString("he-IL")}</div>
            <div className="sales-tv-kpi-lbl">פוליסות פעילות</div>
            <span className="sales-tv-badge sales-tv-b-up">פעילות</span>
            <div className="sales-tv-kpi-sub">מתוך הדוח המסונכרן</div>
          </div>
          <div className="sales-tv-kpi c">
            <div className="sales-tv-kpi-ico">
              <Wallet size={18} />
            </div>
            <div className="sales-tv-kpi-num">
              {ils(data.premium)}
              <span className="cur">₪</span>
            </div>
            <div className="sales-tv-kpi-lbl">פרמיה כוללת פעילה</div>
            <span className="sales-tv-badge sales-tv-b-info">
              ממוצע {ils(avgPremium)}₪
            </span>
            <div className="sales-tv-kpi-sub">סכום פרמיות בסטטוס פעילה</div>
          </div>
          <div className="sales-tv-kpi r">
            <div className="sales-tv-kpi-ico">
              <XCircle size={18} />
            </div>
            <div className="sales-tv-kpi-num">{data.issues}</div>
            <div className="sales-tv-kpi-lbl">בוטלו / גניזה</div>
            <span className="sales-tv-badge sales-tv-b-down">גניזה / ביטול</span>
            <div className="sales-tv-kpi-sub">לא נספרות בפרמיה הפעילה</div>
          </div>
        </div>

        <div className="sales-tv-spotlight">
          <div className="sales-tv-spot-head">
            <div className="sales-tv-spot-tag">החודש הנוכחי</div>
            <div className="sales-tv-spot-month">{data.currentMonth.label}</div>
          </div>
          <div className="sales-tv-spot-cell">
            <div className="sales-tv-spot-lbl">סך מכירות החודש</div>
            <div className="sales-tv-spot-num green">
              <span>{ils(data.currentMonth.totalSum)}</span>
              <span className="cur">₪</span>
            </div>
            <div className="sales-tv-spot-sub">
              <b className="green">{data.currentMonth.totalCount}</b> פוליסות נמכרו
            </div>
          </div>
          <div className="sales-tv-spot-cell last">
            <div className="sales-tv-spot-lbl">מכירות פעילות החודש</div>
            <div className="sales-tv-spot-num cyan">
              <span>{ils(data.currentMonth.activeSum)}</span>
              <span className="cur">₪</span>
            </div>
            <div className="sales-tv-spot-sub">
              <b className="cyan">{data.currentMonth.activeCount}</b> פעילות ·{" "}
              {activationPct}% שיעור הפעלה
            </div>
          </div>
        </div>

        <div className="sales-tv-row">
          <div className="sales-tv-c1 sales-tv-card">
            <div className="sales-tv-ch">
              <div className="sales-tv-ch-t">
                <TrendingUp size={16} />
                מגמת מכירות חודשית
              </div>
              <span className="sales-tv-badge sales-tv-b-down">מכירה</span>
            </div>
            <div className="sales-tv-chart">
              <SalesTrendChart
                series={data.sales}
                barColor={YELLOW}
                lineColor={NAVY}
              />
            </div>
          </div>
          <div className="sales-tv-c1 sales-tv-card">
            <div className="sales-tv-ch">
              <div className="sales-tv-ch-t">
                <UserCheck size={16} />
                מגמת מינויים חודשית
              </div>
              <span className="sales-tv-badge sales-tv-b-up">מינוי</span>
            </div>
            <div className="sales-tv-chart">
              <SalesTrendChart
                series={data.appointments}
                barColor={NAVY}
                lineColor={YELLOW}
              />
            </div>
          </div>
        </div>

        <div className="sales-tv-g2 sales-tv-fs-hide">
          <div className="sales-tv-card">
            <div className="sales-tv-ch">
              <div className="sales-tv-ch-t">
                <Building2 size={16} />
                פוליסות לפי חברת ביטוח
              </div>
            </div>
            <BarList items={data.companies} color="var(--navy)" />
          </div>
          <div className="sales-tv-card">
            <div className="sales-tv-ch">
              <div className="sales-tv-ch-t">
                <Radio size={16} />
                מקורות הפנייה
              </div>
            </div>
            <BarList items={data.sources} color="var(--yellow)" />
          </div>
        </div>
            </div>
          </section>

          <section className="sales-tv-page sales-tv-page-lb">
            <div className="sales-tv-main sales-tv-lb-screen">
              <LeaderBoard
                title={`לידרבורד חודשי · ${data.currentMonth.label}`}
                icon={<CalendarDays size={18} />}
                agents={monthAgents}
                maxSum={maxMonthAgent}
                empty="אין מכירות החודש"
              />
              <LeaderBoard
                title="לידרבורד פנימי · פרמיה פעילה"
                icon={<Trophy size={18} />}
                agents={data.agents}
                maxSum={maxAgent}
                empty="אין נתוני משווקים"
              />
            </div>
          </section>
        </div>
      </div>

      <footer className="sales-tv-footer">
        <strong>ליבה סוכנות לביטוח</strong>
        {" • "}
        דשבורד מכירות
        {" • "}© 2026
      </footer>

      {alert ? (
        <div
          className="sales-tv-alert show"
          style={{ display: "flex" }}
          onClick={closeAlert}
          role="presentation"
        >
          <div className="sales-tv-alert-box">
            <Image
              src="/brand/liba-logo.png"
              alt=""
              width={120}
              height={42}
              className="sales-tv-alert-trophy sales-tv-logo-img"
            />
            <div className="sales-tv-alert-tag">מכירה חדשה</div>
            <div className="sales-tv-alert-title">פוליסה הופקה</div>
            <div className="sales-tv-alert-divider" />
            <div className="sales-tv-alert-client">{alert.client || "לקוח חדש"}</div>
            <div className="sales-tv-alert-agent">
              סוכן: <strong>{alert.agent || "—"}</strong>
            </div>
            <div className="sales-tv-alert-premium">
              {ils(alert.premium)}₪
            </div>
            <div className="sales-tv-alert-chips">
              <div className="sales-tv-alert-chip">
                <span>מוצר</span>
                <strong>{alert.product || "—"}</strong>
              </div>
              <div className="sales-tv-alert-chip">
                <span>חברת ביטוח</span>
                <strong>{alert.company || "—"}</strong>
              </div>
            </div>
            <div className="sales-tv-alert-banner">
              כל הכבוד לצוות המכירות של ליבה
            </div>
            <div className="sales-tv-alert-dismiss">לחץ לסגירה</div>
          </div>
        </div>
      ) : null}

      <FxBoundary>
        <SalesCelebration alert={alert} onClose={closeAlert} />
      </FxBoundary>
      {toast ? <div className="sales-tv-toast">{toast}</div> : null}
    </div>
  );
}

class FxBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function LeaderBoard({
  title,
  icon,
  agents,
  maxSum,
  empty,
}: {
  title: string;
  icon: ReactNode;
  agents: AgentStat[];
  maxSum: number;
  empty: string;
}) {
  return (
    <div className="sales-tv-card sales-tv-lb-card">
      <div className="sales-tv-ch">
        <div className="sales-tv-ch-t">
          {icon}
          {title}
        </div>
      </div>
      <div className="sales-tv-lb-list">
        {agents.length === 0 ? (
          <p className="sales-tv-kpi-sub">{empty}</p>
        ) : (
          agents.map((agent, i) => (
            <div key={agent.name} className="sales-tv-lb-item">
              <div
                className={`sales-tv-lb-rank ${
                  i === 0
                    ? "sales-tv-r1"
                    : i === 1
                      ? "sales-tv-r2"
                      : i === 2
                        ? "sales-tv-r3"
                        : "sales-tv-ro"
                }`}
              >
                {i + 1}
              </div>
              <div className="sales-tv-lb-av">{agentInitials(agent.name)}</div>
              <div className="sales-tv-lb-name">{agent.name}</div>
              <div className="sales-tv-lb-bar">
                <div className="sales-tv-lb-trk">
                  <div
                    className="sales-tv-lb-fill"
                    style={
                      {
                        "--w": `${Math.round((agent.sum / maxSum) * 100)}%`,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
              <div className="sales-tv-lb-meta">
                <span className="sales-tv-lb-score">{ils(agent.sum)}₪</span>
                <span className="sales-tv-lb-count">{agent.count} פוליסות</span>
              </div>
            </div>
          ))
        )}
      </div>
      {agents[0] ? (
        <div className="sales-tv-lead">
          {agents[0].name} מוביל · {ils(agents[0].sum)}₪ · {agents[0].count}{" "}
          פוליסות
        </div>
      ) : null}
    </div>
  );
}

function BarList({
  items,
  color,
}: {
  items: { name: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...items.map((x) => x.count), 1);
  if (items.length === 0) {
    return <p className="sales-tv-kpi-sub">אין נתונים</p>;
  }
  return (
    <>
      {items.map((item) => (
        <div key={item.name} className="sales-tv-bar-row">
          <div className="sales-tv-bar-meta">
            <span>{item.name}</span>
            <span>{item.count}</span>
          </div>
          <div className="sales-tv-prog">
            <div
              className="sales-tv-pf"
              style={
                {
                  background: color,
                  "--w": `${Math.round((item.count / max) * 100)}%`,
                } as CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </>
  );
}
