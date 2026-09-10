"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createFinanceFixedCost,
  deactivateFinanceFixedCost,
  analyzeExpenseInvoice,
  getFixedCostInvoiceUrl,
  listExpenseAllocationSources,
  listFinanceFixedCosts,
  removeFixedCostInvoice,
  updateFinanceFixedCost,
  uploadFixedCostInvoice,
} from "@/app/actions/finance-fixed-costs";
import {
  isFinanceOk,
  type ExpenseAllocationType,
  type ExpenseKind,
  type ExpenseSourceAllocation,
  type FinanceFixedCostWithMeta,
} from "@/lib/finance/categories";
import {
  fixedCostLooksLikeShemesh,
  matchesOperatingBrand,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "office" | "sources" | "invoice";

type FixedExpensesScreenProps = {
  initialCosts: FinanceFixedCostWithMeta[];
  embedded?: boolean;
  loadError?: string | null;
  /** Hide local summary when parent page shows period summary. */
  hideSummary?: boolean;
  periodFrom?: string;
  periodTo?: string;
  onCostsChange?: (costs: FinanceFixedCostWithMeta[]) => void;
  /** When set, only show costs of this kind (fixed / variable). */
  kindFilter?: ExpenseKind;
  /** Prefill new expense kind when opening create dialog. */
  defaultExpenseKind?: ExpenseKind;
  /** Show expense kind badge on each row (e.g. in «כל ההוצאות»). */
  showKindBadge?: boolean;
  brandFilter?: OperatingBrandId;
};

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/["״']/g, "")
    .replace(/\s+/g, " ");
}

function ils(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("he-IL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}₪`;
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function equalShares(sources: string[]): ExpenseSourceAllocation[] {
  if (!sources.length) return [];
  const base = Math.floor((10000 / sources.length)) / 100;
  const rows = sources.map((source_name) => ({
    source_name,
    share_percent: base,
  }));
  const sum = rows.reduce((a, r) => a + r.share_percent, 0);
  rows[0] = {
    ...rows[0],
    share_percent: Math.round((rows[0].share_percent + (100 - sum)) * 100) / 100,
  };
  return rows;
}

export function FixedExpensesScreen({
  initialCosts,
  loadError: initialLoadError,
  embedded = false,
  hideSummary = false,
  periodFrom,
  periodTo,
  onCostsChange,
  kindFilter,
  defaultExpenseKind = "fixed",
  showKindBadge = false,
  brandFilter = "all",
}: FixedExpensesScreenProps) {
  const [costs, setCosts] = useState(initialCosts);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pending, startTransition] = useTransition();
  const [bootLoading, setBootLoading] = useState(initialCosts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(
    initialLoadError ?? null,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceFixedCostWithMeta | null>(null);
  const [previewCost, setPreviewCost] =
    useState<FinanceFixedCostWithMeta | null>(null);

  function applyCosts(next: FinanceFixedCostWithMeta[]) {
    setCosts(next);
    onCostsChange?.(next);
  }

  async function reload() {
    const res = await listFinanceFixedCosts({
      from: periodFrom,
      to: periodTo,
    });
    if (res.error) {
      setLoadError(res.error);
      return;
    }
    setLoadError(null);
    applyCosts(res.costs);
  }

  useEffect(() => {
    applyCosts(initialCosts);
    setBootLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCosts]);

  // If rendered without parent-managed period data, load once.
  useEffect(() => {
    if (periodFrom && periodTo) return;
    if (initialCosts.length > 0) return;
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      const res = await listFinanceFixedCosts();
      if (cancelled) return;
      if (res.error) setLoadError(res.error);
      else {
        setLoadError(null);
        applyCosts(res.costs);
      }
      setBootLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return costs.filter((cost) => {
      if (kindFilter && cost.expense_kind !== kindFilter) return false;
      if (
        !matchesOperatingBrand(
          fixedCostLooksLikeShemesh(cost) ? "shemesh" : "liba",
          brandFilter,
        )
      ) {
        return false;
      }
      if (statusFilter === "office" && cost.allocation_type !== "office") {
        return false;
      }
      if (statusFilter === "sources" && cost.allocation_type !== "sources") {
        return false;
      }
      if (statusFilter === "invoice" && !cost.invoice_storage_path) return false;
      if (!q) return true;
      const hay = normalizeSearch(
        [
          cost.title,
          cost.vendor_name ?? "",
          cost.notes ?? "",
          cost.invoice_file_name ?? "",
          ...cost.allocations.map((a) => a.source_name),
        ].join(" "),
      );
      return hay.includes(q);
    });
  }, [costs, query, statusFilter, kindFilter, brandFilter]);

  const summary = useMemo(() => {
    const scoped = kindFilter
      ? costs.filter((c) => c.expense_kind === kindFilter)
      : costs;
    const paidAmount = scoped.reduce(
      (s, c) => s + (c.this_month_amount ?? c.default_amount ?? 0),
      0,
    );
    const withInvoice = scoped.filter((c) => Boolean(c.invoice_storage_path))
      .length;
    return { paidAmount, withInvoice, count: scoped.length };
  }, [costs, kindFilter]);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5",
        !embedded && "mx-auto max-w-6xl px-4 py-6 sm:px-6",
      )}
    >
      {!embedded ? (
        <header className="space-y-1 text-start">
          <p className="text-xs font-semibold text-muted-foreground">
            חשבונות ליבה
          </p>
          <h1 className="text-2xl font-bold tracking-tight">הוצאות קבועות</h1>
        </header>
      ) : bootLoading ? (
        <p className="text-sm text-muted-foreground">טוען הוצאות קבועות…</p>
      ) : null}

      {loadError ? (
        <p className="app-surface px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {!hideSummary ? (
        <div className="app-surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="font-semibold">{summary.count} הוצאות</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-emerald-800">
            סה״כ שולם{" "}
            <span className="font-semibold tabular-nums">
              {ils(summary.paidAmount)}
            </span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>עם חשבונית {summary.withInvoice}</span>
        </div>
      ) : null}

      <div className="app-surface flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם הוצאה, ספק, מקור או שם קובץ חשבונית…"
              className="h-10 rounded-xl ps-10 text-start"
            />
          </div>
          <Button
            type="button"
            className="h-10 shrink-0 rounded-xl"
            disabled={pending}
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="size-4" />
            הוצאה חדשה
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: "הכל" },
              { id: "office", label: "משרד" },
              { id: "sources", label: "לפי מקור" },
              { id: "invoice", label: "עם חשבונית" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === opt.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="app-surface flex flex-col items-center px-5 py-14 text-center">
          <CircleDashed className="size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">
            {costs.length === 0
              ? showKindBadge || kindFilter
                ? "אין הוצאות בתקופה — הוסיפו הוצאה חדשה"
                : "אין הוצאות קבועות — התחילו בהוצאה חדשה"
              : "אין תוצאות לסינון הנוכחי"}
          </p>
          {(showKindBadge || kindFilter) && costs.length === 0 ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              כל הוצאה שנרשמת כאן היא הוצאה ששולמה — בחרו בפופאפ אם היא קבועה או
              משתנה.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="app-surface overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-black/[0.08] bg-black/[0.02] text-start text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">שם הוצאה</th>
                  <th className="px-3 py-3 font-semibold">ספק</th>
                  <th className="px-3 py-3 font-semibold">סכום ששולם</th>
                  <th className="px-3 py-3 font-semibold">סוג</th>
                  <th className="px-3 py-3 font-semibold">שיוך</th>
                  <th className="px-3 py-3 font-semibold">תאריך תשלום</th>
                  <th className="px-4 py-3 text-end font-semibold">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cost) => {
                  const amount = cost.this_month_amount ?? cost.default_amount;
                  const sourcesLabel =
                    cost.allocation_type === "sources" && cost.allocations.length
                      ? cost.allocations
                          .map((a) => `${a.source_name} ${a.share_percent}%`)
                          .join(" · ")
                      : null;
                  return (
                    <tr
                      key={cost.id}
                      className="border-b border-black/[0.05] last:border-b-0 hover:bg-black/[0.015]"
                    >
                      <td className="max-w-[16rem] px-4 py-3 align-middle">
                        <p className="truncate font-semibold text-foreground">
                          {cost.title}
                        </p>
                        {cost.due_day ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            יום חיוב {cost.due_day}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-3 align-middle text-muted-foreground">
                        {cost.vendor_name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle font-semibold tabular-nums text-foreground">
                        {ils(amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            cost.expense_kind === "fixed"
                              ? "bg-emerald-100 text-emerald-950"
                              : "bg-amber-100 text-amber-950",
                          )}
                        >
                          {cost.expense_kind === "fixed" ? "קבועה" : "משתנה"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            cost.allocation_type === "office"
                              ? "bg-sky-100 text-sky-950"
                              : "bg-violet-100 text-violet-950",
                          )}
                        >
                          {cost.allocation_type === "office"
                            ? "משרד"
                            : "מקורות"}
                        </span>
                        {sourcesLabel ? (
                          <p
                            className="mt-1 max-w-[12rem] truncate text-[11px] text-muted-foreground"
                            title={sourcesLabel}
                          >
                            {sourcesLabel}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle">
                        <span className="inline-flex items-center gap-1 text-emerald-800">
                          <CheckCircle2 className="size-3.5 shrink-0" />
                          <span className="tabular-nums">
                            {cost.last_paid_at ?? "—"}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs"
                            onClick={() => {
                              setEditing(cost);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            עריכה
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs"
                            disabled={!cost.invoice_storage_path}
                            title={
                              cost.invoice_storage_path
                                ? "תצוגה מקדימה של חשבונית"
                                : "אין חשבונית מצורפת — העלו בעריכה"
                            }
                            onClick={() => {
                              if (!cost.invoice_storage_path) {
                                toast.message(
                                  "אין חשבונית מצורפת — העלו בעריכה",
                                );
                                return;
                              }
                              setPreviewCost(cost);
                            }}
                          >
                            <FileText className="size-3.5" />
                            תצוגה מקדימה
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              void (async () => {
                                if (!confirm(`למחוק את «${cost.title}»?`)) return;
                                const res = await deactivateFinanceFixedCost(
                                  cost.id,
                                );
                                if (!isFinanceOk(res)) {
                                  toast.error(res.error);
                                  return;
                                }
                                toast.success("ההוצאה נמחקה");
                                startTransition(() => {
                                  void reload();
                                });
                              })();
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            מחיקה
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExpenseEditorDialog
        open={editorOpen}
        cost={editing}
        pending={pending}
        defaultExpenseKind={defaultExpenseKind}
        onOpenChange={setEditorOpen}
        onSaved={() => {
          startTransition(() => {
            void reload();
          });
        }}
      />

      <InvoicePreviewDialog
        cost={previewCost}
        open={Boolean(previewCost)}
        onOpenChange={(open) => {
          if (!open) setPreviewCost(null);
        }}
      />
    </div>
  );
}

function ExpenseEditorDialog({
  open,
  cost,
  pending,
  defaultExpenseKind = "fixed",
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  cost: FinanceFixedCostWithMeta | null;
  pending: boolean;
  defaultExpenseKind?: ExpenseKind;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(cost);
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [dueDay, setDueDay] = useState("");
  const [notes, setNotes] = useState("");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>(defaultExpenseKind);
  const [allocationType, setAllocationType] =
    useState<ExpenseAllocationType>("office");
  const [allocations, setAllocations] = useState<ExpenseSourceAllocation[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [localCostId, setLocalCostId] = useState<string | null>(null);
  const [invoiceName, setInvoiceName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [detection, setDetection] = useState<{
    vendor: string | null;
    amount: number | null;
    title: string | null;
    paidAt: string | null;
    vatIncluded: boolean | null;
    source: "ai" | "filename";
    confirmed: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindSectionRef = useRef<HTMLDivElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  function clearLocalPreview() {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;
    clearLocalPreview();
    setTitle(cost?.title ?? "");
    setVendor(cost?.vendor_name ?? "");
    setAmount(cost?.default_amount != null ? String(cost.default_amount) : "");
    setPaidAt(cost?.last_paid_at ?? todayIso());
    setDueDay(cost?.due_day != null ? String(cost.due_day) : "");
    setNotes(cost?.notes ?? "");
    setVatIncluded(cost?.payments?.[0]?.vat_included ?? true);
    setExpenseKind(cost?.expense_kind ?? defaultExpenseKind);
    setAllocationType(cost?.allocation_type ?? "office");
    setAllocations(cost?.allocations ?? []);
    setLocalCostId(cost?.id ?? null);
    setInvoiceName(cost?.invoice_file_name ?? null);
    setPreviewUrl(null);
    setPreviewMime(cost?.invoice_mime_type ?? null);
    setPendingFile(null);
    setDetection(null);
    setSourceQuery("");
    void listExpenseAllocationSources().then((res) => {
      if (!res.error) setSourceOptions(res.sources);
    });
    if (cost?.id && cost.invoice_storage_path) {
      void getFixedCostInvoiceUrl(cost.id).then((res) => {
        if (res.url) {
          setPreviewUrl(res.url);
          setPreviewMime(res.mimeType);
          setInvoiceName(res.fileName);
        }
      });
    }
    return () => {
      clearLocalPreview();
    };
  }, [open, cost, defaultExpenseKind]);

  const selectedNames = new Set(allocations.map((a) => a.source_name));
  const filteredSources = sourceOptions.filter((name) => {
    if (selectedNames.has(name)) return false;
    const q = normalizeSearch(sourceQuery);
    if (!q) return true;
    return normalizeSearch(name).includes(q);
  });

  const allocSum = allocations.reduce((s, a) => s + Number(a.share_percent || 0), 0);

  async function uploadPendingInvoice(costId: string, file: File) {
    const fd = new FormData();
    fd.set("fixed_cost_id", costId);
    fd.set("file", file);
    fd.set("file_name", file.name);
    const res = await uploadFixedCostInvoice(fd);
    if (!isFinanceOk(res)) {
      toast.error(res.error ?? "העלאת החשבונית נכשלה");
      return false;
    }
    setInvoiceName(res.invoice?.file_name ?? file.name);
    setPendingFile(null);
    const urlRes = await getFixedCostInvoiceUrl(costId);
    if (urlRes.url) {
      clearLocalPreview();
      setPreviewUrl(urlRes.url);
      setPreviewMime(urlRes.mimeType);
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pendingFile && detection && !detection.confirmed) {
      toast.message("אשרו קודם את פרטי החשבונית שזוהו");
      return;
    }
    setSaving(true);
    const payload = {
      title,
      vendor_name: vendor,
      default_amount: amount,
      due_day: expenseKind === "variable" ? null : dueDay,
      notes,
      allocation_type: allocationType,
      allocations,
      expense_kind: expenseKind,
      paid_at: paidAt,
      vat_included: vatIncluded,
    };
    const res =
      isEdit && cost
        ? await updateFinanceFixedCost({ id: cost.id, ...payload })
        : await createFinanceFixedCost(payload);
    if (!isFinanceOk(res) || !res.id) {
      setSaving(false);
      toast.error(res.error);
      return;
    }
    setLocalCostId(res.id);
    if (pendingFile) {
      setUploading(true);
      const uploaded = await uploadPendingInvoice(res.id, pendingFile);
      setUploading(false);
      if (!uploaded) {
        setSaving(false);
        toast.message("ההוצאה נשמרה — אבל החשבונית לא הועלתה. נסו שוב מהעריכה.");
        onSaved();
        return;
      }
    }
    setSaving(false);
    toast.success(isEdit ? "ההוצאה עודכנה" : "ההוצאה נרשמה כשולמה");
    onSaved();
    onOpenChange(false);
  }

  async function onPickInvoice(file: File | null) {
    if (!file) return;
    clearLocalPreview();
    const objectUrl = URL.createObjectURL(file);
    localPreviewRef.current = objectUrl;
    setPendingFile(file);
    setInvoiceName(file.name);
    setPreviewUrl(objectUrl);
    setPreviewMime(file.type || "application/octet-stream");
    setDetection(null);
    setAnalyzing(true);

    const fd = new FormData();
    fd.set("file", file);
    const res = await analyzeExpenseInvoice(fd);
    setAnalyzing(false);
    if (res.error) {
      toast.error(res.error);
      setDetection({
        vendor: null,
        amount: null,
        title: null,
        paidAt: null,
        vatIncluded: true,
        source: "filename",
        confirmed: false,
      });
      return;
    }
    setDetection({
      vendor: res.vendor,
      amount: res.amount,
      title: res.title,
      paidAt: res.paidAt,
      vatIncluded: res.vatIncluded,
      source: res.source ?? "filename",
      confirmed: false,
    });
    if (res.source === "ai") {
      toast.message("זוהו פרטים מהחשבונית — אשרו לפני השמירה");
    } else {
      toast.message(
        "זיהוי אוטומטי חלקי / לפי שם קובץ — בדקו ואשרו (או מלאו ידנית)",
      );
    }
  }

  function confirmDetection() {
    if (!detection) return;
    if (detection.vendor) {
      setVendor(detection.vendor);
      if (!title.trim()) setTitle(detection.title || detection.vendor);
    } else if (detection.title && !title.trim()) {
      setTitle(detection.title);
    }
    if (detection.amount != null) setAmount(String(detection.amount));
    if (detection.paidAt) setPaidAt(detection.paidAt);
    if (typeof detection.vatIncluded === "boolean") {
      setVatIncluded(detection.vatIncluded);
    }
    setDetection({ ...detection, confirmed: true });
    toast.success("הפרטים אושרו — בחרו עכשיו קבועה או משתנה");
    requestAnimationFrame(() => {
      kindSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  async function handleDelete() {
    if (!cost) return;
    if (!confirm(`למחוק את «${cost.title}»?`)) return;
    const res = await deactivateFinanceFixedCost(cost.id);
    if (!isFinanceOk(res)) {
      toast.error(res.error);
      return;
    }
    toast.success("ההוצאה נמחקה");
    onOpenChange(false);
    onSaved();
  }

  const showPreview = Boolean(previewUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl",
          showPreview ? "max-w-6xl" : "max-w-2xl",
        )}
      >
        <DialogHeader className="border-b border-black/[0.06] px-6 py-4 text-start">
          <DialogTitle>{isEdit ? "עריכת הוצאה" : "הוצאה ששולמה"}</DialogTitle>
          <DialogDescription>
            העלו חשבונית · אשרו פרטים · בחרו קבועה או משתנה · ואז שמרו.
          </DialogDescription>
        </DialogHeader>

        <form
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            showPreview
              ? "grid gap-0 lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]"
              : "",
          )}
          onSubmit={handleSubmit}
        >
          <div
            className={cn(
              "space-y-4 px-6 py-5",
              showPreview && "lg:overflow-y-auto",
            )}
          >
            <div className="space-y-2 rounded-2xl border border-dashed border-black/[0.12] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">חשבונית</p>
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onPickInvoice(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={analyzing || uploading || saving || pending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    {analyzing
                      ? "מזהה…"
                      : showPreview
                        ? "החלפת חשבונית"
                        : "העלאת חשבונית"}
                  </Button>
                  {localCostId && invoiceName && !pendingFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive"
                      onClick={async () => {
                        const res = await removeFixedCostInvoice(localCostId);
                        if (!isFinanceOk(res)) {
                          toast.error(res.error);
                          return;
                        }
                        setInvoiceName(null);
                        setPreviewUrl(null);
                        setPreviewMime(null);
                        setDetection(null);
                        onSaved();
                      }}
                    >
                      הסר
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF או תמונה — המערכת מזהה ספק וסכום. הפרטים נכנסים רק אחרי
                אישור.
              </p>
              {analyzing ? (
                <p className="text-sm font-medium text-sky-900">
                  מזהה ספק וסכום מהחשבונית… (עד כ־20 שניות)
                </p>
              ) : null}
              {detection && !detection.confirmed ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3">
                  <p className="text-sm font-semibold text-amber-950">
                    זוהו מהחשבונית — אשרו לפני שמירה
                  </p>
                  <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">ספק</dt>
                      <dd className="font-medium">
                        {detection.vendor || "לא זוהה"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">סכום</dt>
                      <dd className="font-medium tabular-nums" dir="ltr">
                        {detection.amount != null
                          ? `${detection.amount.toLocaleString("he-IL")} ₪`
                          : "לא זוהה"}
                      </dd>
                    </div>
                    {detection.title ? (
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] text-muted-foreground">
                          שם מוצע
                        </dt>
                        <dd className="font-medium">{detection.title}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      onClick={confirmDetection}
                    >
                      אשר פרטים
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        setDetection({ ...detection, confirmed: true })
                      }
                    >
                      המשך בלי למלא
                    </Button>
                  </div>
                </div>
              ) : null}
              {detection?.confirmed ? (
                <p className="text-xs font-medium text-emerald-800">
                  פרטי החשבונית אושרו
                  {detection.source === "ai" ? " · זוהו אוטומטית" : ""}
                </p>
              ) : null}
            </div>

            <div
              ref={kindSectionRef}
              className="space-y-2 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3"
            >
              <p className="text-sm font-semibold">סוג הוצאה</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseKind("fixed")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-bold",
                    expenseKind === "fixed"
                      ? "border-emerald-800 bg-emerald-800 text-white"
                      : "border-transparent bg-white text-foreground hover:border-black/10",
                  )}
                >
                  הוצאה קבועה
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpenseKind("variable");
                    setDueDay("");
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-bold",
                    expenseKind === "variable"
                      ? "border-amber-800 bg-amber-700 text-white"
                      : "border-transparent bg-white text-foreground hover:border-black/10",
                  )}
                >
                  הוצאה משתנה
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {expenseKind === "fixed"
                  ? "תקורה חוזרת / חודשית"
                  : "חד־פעמית / לא קבועה"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exp-title">שם ההוצאה</Label>
                <Input
                  id="exp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="למשל: שכירות משרד"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-vendor">ספק</Label>
                <Input
                  id="exp-vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="מתמלא אחרי אישור החשבונית"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">סכום ששולם (₪)</Label>
                <Input
                  id="exp-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-paid-at">תאריך תשלום</Label>
                <Input
                  id="exp-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              {expenseKind === "fixed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="exp-due">יום חיוב בחודש (אופציונלי)</Label>
                  <Input
                    id="exp-due"
                    inputMode="numeric"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="1–28"
                    className="rounded-xl"
                  />
                </div>
              ) : null}
              <label
                className={cn(
                  "flex items-center gap-2 self-end pb-2 text-sm",
                  expenseKind === "variable" && "sm:col-span-2",
                )}
              >
                <input
                  type="checkbox"
                  checked={vatIncluded}
                  onChange={(e) => setVatIncluded(e.target.checked)}
                />
                הסכום כולל מע״מ
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exp-notes">הערות</Label>
                <Input
                  id="exp-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-black/[0.06] p-3">
              <p className="text-sm font-semibold">שיוך</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAllocationType("office");
                    setAllocations([]);
                  }}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-semibold",
                    allocationType === "office"
                      ? "bg-sky-600 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  הוצאות משרד כלליות
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationType("sources")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-semibold",
                    allocationType === "sources"
                      ? "bg-violet-600 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  לפי מקור / מקורות
                </button>
              </div>

              {allocationType === "sources" ? (
                <div className="space-y-3 pt-2">
                  <Input
                    value={sourceQuery}
                    onChange={(e) => setSourceQuery(e.target.value)}
                    placeholder="חיפוש מקור מהרשימה…"
                    className="rounded-xl"
                  />
                  <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-muted/40 p-2">
                    {filteredSources.length === 0 ? (
                      <p className="px-1 text-xs text-muted-foreground">
                        אין מקורות נוספים להצגה
                      </p>
                    ) : (
                      filteredSources.slice(0, 40).map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-medium hover:bg-violet-50"
                          onClick={() => {
                            const nextNames = [
                              ...allocations.map((a) => a.source_name),
                              name,
                            ];
                            setAllocations(equalShares(nextNames));
                          }}
                        >
                          + {name}
                        </button>
                      ))
                    )}
                  </div>
                  {allocations.length ? (
                    <div className="space-y-2">
                      {allocations.map((row) => (
                        <div
                          key={row.source_name}
                          className="flex items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {row.source_name}
                          </span>
                          <Input
                            className="h-9 w-20 rounded-lg text-center"
                            inputMode="decimal"
                            value={String(row.share_percent)}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setAllocations((prev) =>
                                prev.map((a) =>
                                  a.source_name === row.source_name
                                    ? {
                                        ...a,
                                        share_percent: Number.isFinite(n)
                                          ? n
                                          : 0,
                                      }
                                    : a,
                                ),
                              );
                            }}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              const next = allocations
                                .filter((a) => a.source_name !== row.source_name)
                                .map((a) => a.source_name);
                              setAllocations(equalShares(next));
                            }}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                      <p
                        className={cn(
                          "text-xs font-medium",
                          Math.abs(allocSum - 100) < 0.05
                            ? "text-emerald-700"
                            : "text-amber-800",
                        )}
                      >
                        סה״כ חלוקה: {allocSum.toFixed(1)}% (חייב 100%)
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      בחרו מקור אחד או יותר מהרשימה
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 border-t border-black/[0.06] px-0 pb-1 pt-4 sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-destructive"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-4" />
                  מחק
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => onOpenChange(false)}
                >
                  סגור
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={
                    saving ||
                    pending ||
                    uploading ||
                    analyzing ||
                    Boolean(pendingFile && detection && !detection.confirmed)
                  }
                >
                  {saving || uploading
                    ? "שומר…"
                    : isEdit
                      ? "שמור שינויים"
                      : "שמור כשולם"}
                </Button>
              </div>
            </DialogFooter>
          </div>

          {showPreview ? (
            <aside className="flex min-h-[18rem] flex-col border-t border-black/[0.06] bg-black/[0.02] lg:border-s lg:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    תצוגה מקדימה · חשבונית
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {invoiceName}
                  </p>
                </div>
                {previewUrl ? (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={() =>
                        window.open(previewUrl, "_blank", "noopener,noreferrer")
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      פתח PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = previewUrl;
                        a.download = invoiceName ?? "invoice.pdf";
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                    >
                      <Download className="size-3.5" />
                      הורד PDF
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {previewMime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl!}
                    alt={invoiceName ?? "חשבונית"}
                    className="mx-auto max-h-[70vh] w-full object-contain"
                  />
                ) : (
                  <iframe
                    title={invoiceName ?? "חשבונית"}
                    src={previewUrl!}
                    className="h-[70vh] w-full rounded-xl border border-black/[0.06] bg-white"
                  />
                )}
              </div>
            </aside>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoicePreviewDialog({
  cost,
  open,
  onOpenChange,
}: {
  cost: FinanceFixedCostWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !cost?.id) return;
    let cancelled = false;
    setUrl(null);
    setMime(null);
    setFileName(null);
    setError(null);
    void getFixedCostInvoiceUrl(cost.id).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else if (!res.url) setError("לא נמצאה חשבונית");
      else {
        setUrl(res.url);
        setMime(res.mimeType);
        setFileName(res.fileName);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, cost?.id]);

  const isPdf =
    Boolean(mime?.includes("pdf")) ||
    Boolean(fileName?.toLowerCase().endsWith(".pdf")) ||
    Boolean(cost?.invoice_file_name?.toLowerCase().endsWith(".pdf"));
  const displayName =
    fileName ?? cost?.invoice_file_name ?? cost?.title ?? "חשבונית";

  async function downloadInvoice() {
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("הורדה נכשלה");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = displayName.includes(".")
        ? displayName
        : `${displayName}${isPdf ? ".pdf" : ""}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open signed URL if fetch is blocked by CORS.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-black/[0.06] px-6 py-4 text-start">
          <DialogTitle>תצוגה מקדימה — חשבונית</DialogTitle>
          <DialogDescription className="truncate">
            {displayName}
          </DialogDescription>
          {url ? (
            <div className="!mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-3.5" />
                {isPdf ? "פתח PDF" : "פתח קובץ"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                disabled={downloading}
                onClick={() => void downloadInvoice()}
              >
                <Download className="size-3.5" />
                {downloading
                  ? "מוריד…"
                  : isPdf
                    ? "הורד PDF"
                    : "הורד קובץ"}
              </Button>
            </div>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? (
            <p className="text-sm text-muted-foreground">טוען…</p>
          ) : mime?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={displayName}
              className="mx-auto max-h-[70vh] w-full rounded-xl object-contain"
            />
          ) : (
            <iframe
              title={displayName}
              src={url}
              className="h-[70vh] w-full rounded-xl border border-black/[0.06] bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
