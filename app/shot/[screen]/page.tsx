import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshTheme } from "@/components/shemesh/theme";
import { GviyaScreen } from "@/components/shemesh/gviya-screen";
import { TaxRefundsScreen } from "@/components/shemesh/tax-refunds-screen";
import { ShemeshMarketingReport } from "@/components/shemesh/marketing-report";
import { ShemeshOverview } from "@/components/shemesh/overview-screen";
import { FixedCostsScreen } from "@/components/shemesh/costs-screen";
import { ReceiptsScreen } from "@/components/shemesh/receipts-screen";
import { InsuranceScreen } from "@/components/shemesh/insurance-screen";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { PayrollScreen } from "@/components/shemesh/payroll-screen";
import { AgencyScreen } from "@/components/shemesh/agency-screen";
import { RevivalScreen } from "@/components/shemesh/revival-screen";
import { ShemeshDesk } from "@/components/shemesh/desk";
import { ShemeshConnectPanel } from "@/components/shemesh/connect-panel";
import { ShemeshHub } from "@/components/shemesh/hub";
import { CaseBoard } from "@/components/shemesh/case-board";
import { MonthSheet } from "@/components/shemesh/money-desk";
import { createShemeshCase, createShemeshCaseChildForm, createShemeshLedger, setShemeshDocumentForm, setShemeshLedgerStatus, updateShemeshCase } from "@/app/actions/shemesh-ops";
import type { CaseFile } from "@/lib/shemesh/ops";

const DEMO_CASES: CaseFile[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    clientName: "מיכל כהן",
    phone: "050-1000001",
    stage: "documents",
    stageLabel: "מסמכים",
    status: "open",
    handler: "מתן בריזלי",
    openedOn: "2026-10-01",
    deadline: "2026-10-08",
    notes: "חסר טופס 106",
    serviceType: "redemption",
    overdue: true,
    tasks: [{ id: "t1", title: "לאסוף טופס 106", status: "open", assignee: "מתן בריזלי", dueOn: "2026-10-06" }],
    documents: [
      { id: "d1", label: "תעודת זהות", received: true, required: true, state: "received" },
      { id: "d2", label: "טופס 106", received: false, required: true, state: "missing" },
    ],
    notesList: [{ id: "n1", body: "הלקוחה ביקשה לחזור ביום ראשון", author: "מתן בריזלי" }],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    clientName: "אורן דהן",
    phone: "050-1000002",
    stage: "filed",
    stageLabel: "הוגש",
    status: "waiting",
    handler: "לירון כהן",
    openedOn: "2026-10-20",
    deadline: "2026-11-10",
    notes: "הוגש למס הכנסה",
    serviceType: "tax_refund",
    overdue: false,
    tasks: [],
    documents: [{ id: "d3", label: "ייפוי כוח", received: true, required: true, state: "received" }],
    notesList: [],
  },
];
import type { GviyaDeal } from "@/lib/shemesh/gviya";

const SAMPLE: (GviyaDeal & { surense: "matched" | "unmatched" })[] = [
  {
    id: "demo-1",
    client: "דוגמה א׳",
    rep: "נציג לדוגמה",
    source: "קמפיין שמש",
    status: "נגבה",
    signed: true,
    dealDate: "2026-10-03",
    dealAmount: 12000,
    collected: 8000,
    invoiceDate: "2026-10-18",
    cycleDays: 15,
    stage: "collected",
    surense: "matched",
  },
  {
    id: "demo-2",
    client: "דוגמה ב׳",
    rep: "נציג לדוגמה",
    source: "שיחה נכנסת שמש",
    status: "בדיקה",
    signed: false,
    dealDate: "2026-10-12",
    dealAmount: 6400,
    collected: 0,
    invoiceDate: null,
    cycleDays: null,
    stage: "eligibility",
    surense: "unmatched",
  },
];

export default function ShotPage({ params }: { params: { screen: string } }) {
  const screen = params.screen;
  return (
    <div className="shemesh-os flex min-h-screen bg-background">
      <ShemeshTheme />
      <ShemeshSidebar className="hidden lg:flex" />
      <main className="min-w-0 flex-1 overflow-auto px-4 py-5">
        {screen === "home" ? (
          <ShemeshOverview stages={{ lead: 1, eligibility: 1, poa: 0, documents: 0, filed: 0, followup: 0, refund: 0, collected: 1 }} hasWorkbook sales={{ month: "2026-10", sold: 18400, collected: 8000, count: 2, cycleDays: 4 }} />
        ) : null}
        {screen === "gviya" ? (
          <GviyaScreen
            fileName="דוגמה.xlsx"
            syncedAt="2026-10-29T08:00:00.000Z"
            deals={SAMPLE}
            contacts={[{ id: "c1", name: "איש קשר לדוגמה", phone: "050-0000000", idNumber: "", surense: "unmatched" }]}
            reps={["נציג לדוגמה"]}
            sources={["קמפיין שמש", "שיחה נכנסת שמש"]}
            surenseError={null}
            surenseConfigured
            scanned={1}
          />
        ) : null}
        {screen === "tax" ? <TaxRefundsScreen fileName={null} rows={[]} statuses={[]} /> : null}
        {screen === "marketing" ? (
          <ShemeshMarketingReport accountId="2542541459538449" error={null} rows={[]} />
        ) : null}
        {screen === "costs" ? <FixedCostsScreen /> : null}
        {screen === "receipts" ? <ReceiptsScreen /> : null}
        {screen === "insurance" ? <InsuranceScreen /> : null}
        {screen === "payroll" ? <PayrollScreen /> : null}
        {screen === "agency" ? <AgencyScreen missing rows={[]} error={null} /> : null}
        {screen === "revival" ? <RevivalScreen /> : null}
        {screen === "cases" || screen === "case" ? (
          <CaseBoard
            cases={DEMO_CASES}
            missing={false}
            error={null}
            audit={[{ id: "a1", summary: "נפתח תיק למיכל כהן", createdAt: "2026-10-01" }]}
            initialOpenId={screen === "case" ? "11111111-1111-4111-8111-111111111111" : null}
            canManage
            createAction={createShemeshCase}
            updateAction={updateShemeshCase}
            childAction={createShemeshCaseChildForm}
            documentAction={setShemeshDocumentForm}
          />
        ) : null}
        {screen === "ledger" ? (
          <ShemeshDesk
            title="ספר פדיונות"
            description="עמלה לפי השיעור השמור."
            rows={[{ id: "l1", title: "מיכל כהן", subtitle: "עמלה 1500 · נטו 8500", status: "open", amount: 10000, when: "2026-10-12", assignee: "", overdue: false, kind: "redemption" }]}
            missing={false}
            error={null}
            audit={[]}
            exportKind="ledger:redemption"
            createAction={createShemeshLedger}
            statusAction={setShemeshLedgerStatus}
          >
            <input name="clientName" placeholder="לקוח" />
          </ShemeshDesk>
        ) : null}
        {screen === "taxledger" ? (
          <ShemeshDesk
            title="ספר החזרי מס"
            description="עמלה לפי שיעור המס השמור."
            rows={[{ id: "t1", title: "נועה ברק", subtitle: "עמלה 400 · נטו 3600", status: "done", amount: 4000, when: "2026-10-18", assignee: "", overdue: false, kind: "tax_refund" }]}
            missing={false}
            error={null}
            audit={[]}
            exportKind="ledger:tax_refund"
            createAction={createShemeshLedger}
            statusAction={setShemeshLedgerStatus}
          >
            <input name="clientName" placeholder="לקוח" />
          </ShemeshDesk>
        ) : null}
        {screen === "month" ? (
          <MonthSheet
            month="2026-10"
            total={8000 + 450 + 3600 + 9000 + 1800 + 2500}
            rows={[
              { ruleId: "1", title: "שכירות משרד", amount: 8000 },
              { ruleId: "2", title: "תוכנה", amount: 450 },
              { ruleId: "3", title: "החזרי מס שנגבו", amount: 3600 },
              { ruleId: "4", title: "שכר צוות", amount: 9000 },
              { ruleId: "5", title: "עמלת מטפל", amount: 1800 },
              { ruleId: "6", title: "הלוואת ציוד", amount: 2500 },
            ]}
          />
        ) : null}
        {screen === "settlement" ? (
          <SettlementScreen
            view={{
              missing: false,
              error: null,
              premium: 18000,
              owed: 2700,
              sales: [
                { id: "s1", client: "מיכל כהן", company: "מגדל", product: "בריאות", process: "מכירה", status: "פעיל", transferDate: "2026-10-12", premium: 10000 },
                { id: "s2", client: "אורן דהן", company: "הראל", product: "חיים", process: "מכירה", status: "פעיל", transferDate: "2026-10-18", premium: 8000 },
              ],
            }}
          />
        ) : null}
        {screen === "clients" ? (
          <ShemeshHub
            groupId="clients"
            numbers={{
              "/shemesh/cases": "4 תיקים",
              "/shemesh/gviya": "1 שורות פדיון",
              "/shemesh/tax-refunds": "1 שורות מס",
            }}
          />
        ) : null}
        {screen === "sources" ? (
          <ShemeshConnectPanel
            missing={false}
            googleChoices={["1111111111", "2222222222"]}
            links={[
              { id: "shemesh-facebook", name: "שמש · פייסבוק", connected: false, syncedAt: null, checkedAt: null, detail: "act_2542541459538449", note: "לא מחובר", href: "/shemesh/sources" },
              { id: "shemesh-google-ads", name: "שמש · גוגל", connected: false, syncedAt: null, checkedAt: null, detail: "MCC 2888742858", note: "2 חשבונות ברשימה", href: "/shemesh/sources" },
              { id: "shemesh-sales-excel", name: "שמש · דוח מכירות", connected: false, syncedAt: null, checkedAt: null, detail: "דוח מכירות שמש פדיונות 2 · תפעול שמש", note: "מזהה הפריט לא נשמר", href: "/shemesh/sources" },
              { id: "shemesh-surense", name: "שמש · שורנס", connected: false, syncedAt: null, checkedAt: null, detail: "אותה סוכנות, סינון שמש", note: "אין משיכה נפרדת", href: "/shemesh/agency" },
              { id: "shemesh-rivhit", name: "שמש · ריווחית", connected: false, syncedAt: null, checkedAt: null, detail: "חסר company_id", note: "לא מחובר", href: "/shemesh/sources" },
              { id: "shemesh-grow", name: "שמש · גרואו", connected: false, syncedAt: null, checkedAt: null, detail: "סנדבוקס", note: "לא מחובר", href: "/shemesh/sources" },
              { id: "shemesh-insurance", name: "שמש · ביטוח", connected: false, syncedAt: null, checkedAt: null, detail: "ייבוא אקסל או מסלקה", note: "עמלות מגדל אוקטובר.xlsx", href: "/shemesh/insurance" },
            ]}
          />
        ) : null}
      </main>
    </div>
  );
}
