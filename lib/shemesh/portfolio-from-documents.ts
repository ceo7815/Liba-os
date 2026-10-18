import {
  reportId,
  type PortfolioReport,
  type ReportCost,
  type ReportSide,
} from "@/lib/shemesh/portfolio-report";

export type PolicyDocument = { name: string; text: string };

type LifePolicy = {
  kind: "life";
  company: string;
  policy: string;
  name: string;
  sum: number;
  monthly: number;
  loading: string;
  smoker: boolean;
  period: string;
  discount: string;
  exclusion: string;
};

type HealthPolicy = {
  kind: "health";
  company: string;
  policy: string;
  name: string;
  monthly: number;
  lines: string[];
  exclusion: string;
  ciSum: number | null;
};

type CiPolicy = {
  kind: "ci";
  company: string;
  policy: string;
  name: string;
  sum: number;
  monthly: number;
  exclusion: string;
  note: string;
};

type ExistingPolicy = LifePolicy | HealthPolicy | CiPolicy;

type Offer = {
  person: string;
  decision: string;
  kind: "health" | "life";
  company: string;
  lines: string[];
  monthly: number;
  discount: string;
  ciAmount: string;
  lifeSum: string;
};

type KeptPolicy = { person: string; policy: string; label: string; monthly: number; company: string };

const PRODUCTS: [RegExp, string][] = [
  [/קרן אור/, "מחלות קשות"],
  [/השתלות/, "השתלות וטיפולים בחו״ל"],
  [/תרופות מיוחדות/, "תרופות מיוחדות"],
  [/משלים שב/, "ניתוחים בישראל, משלים שב״ן"],
  [/אמבולטור/, "שירותים אמבולטוריים"],
  [/בחו.?ל/, "ניתוחים בחו״ל"],
  [/אבחון מהיר/, "אבחון מהיר"],
  [/התאמה אישית/, "תרופה בהתאמה אישית"],
  [/ניהול רפואי/, "ניהול רפואי אישי"],
  [/אלטרנטיב/, "רפואה אלטרנטיבית"],
];

function clean(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[]/g, "");
}

function amount(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

function money(value: number): string {
  return value.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

function side(title: string, note: string, lines: string[], costs: [string, string][], total: number): ReportSide {
  return {
    title,
    note,
    lines: lines.join("\n"),
    costs: costs.map(([label, value]): ReportCost => ({ id: reportId(), label, amount: value })),
    total: String(total),
  };
}

function first(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function tokens(name: string): string[] {
  return name.split(/\s+/).filter((token) => token.length > 2);
}

function samePerson(left: string, right: string): boolean {
  const a = tokens(left);
  const b = tokens(right);
  const exact = a.filter((token) => b.includes(token));
  const contained = a.some((token) =>
    b.some((other) => token !== other && Math.min(token.length, other.length) >= 5 && (token.includes(other) || other.includes(token))),
  );
  if (contained || exact.length >= 2) return true;
  return exact.length === 1 && (a.length === 1 || b.length === 1);
}

function displayName(name: string): string {
  return name.replace(/ת\.?\s*ז\.?.*$/, "").replace(/[^\u0590-\u05FF\s]/g, " ").replace(/\s+/g, " ").trim();
}

function familyName(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    for (const token of tokens(name)) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const shared = [...counts.entries()].sort((a, b) => b[1] - a[1]).find((entry) => entry[1] > 1);
  return shared ? `משפחת ${shared[0]}` : names[0] ? `משפחת ${tokens(names[0]).at(-1)}` : "משפחה";
}

function companyOf(text: string): string {
  if (text.includes("מנורה")) return "מנורה מבטחים";
  if (text.includes("כלל")) return "כלל";
  if (text.includes("מגדל")) return "מגדל";
  return "חברת הביטוח";
}

function skipDocument(text: string): boolean {
  return text.includes("השוואת תיק ביטוחי") || (!text.includes("פוליסה") && !text.includes("פוליסת"));
}

export function readExistingPolicies(documents: PolicyDocument[]): { policies: ExistingPolicy[]; skipped: string[] } {
  const policies: ExistingPolicy[] = [];
  const skipped: string[] = [];
  for (const document of documents) {
    const text = clean(document.text);
    if (skipDocument(text)) {
      skipped.push(document.name);
      continue;
    }
    const found = readLife(text) ?? readClal(text) ?? readHealth(text);
    if (!found || found.length === 0) {
      skipped.push(document.name);
      continue;
    }
    for (const policy of found) {
      const duplicate = policies.some(
        (item) => item.policy === policy.policy && item.kind === policy.kind && samePerson(item.name, policy.name),
      );
      if (!duplicate) policies.push(policy);
    }
  }
  return { policies, skipped };
}

function readLife(text: string): LifePolicy[] | null {
  if (!text.includes("ריסק") || !text.includes("לאחר תוספות והנחות")) return null;
  const name = first(text, /מבוטח\s*ראשי\s*([^\n]+)/);
  const monthly = amount(first(text, /לאחר תוספות והנחות:\s*([\d,.]+)/));
  const sum = amount(first(text, /סכום\s*ביטוח\s*([\d,.]+)/));
  if (!name || !monthly || !sum) return null;
  const period = first(text, /תקופת\s*הביטוח\s*(\d{2}\/\d{2}-\d{2}\/\d{2})/);
  const ranges = [...text.matchAll(/(\d{2}\/\d{2})-(\d{2}\/\d{2})\s+(\d+)%/g)];
  const start = period.slice(0, 5);
  const current = ranges.find((range) => range[1] === start) ?? ranges[0];
  return [
    {
      kind: "life",
      company: companyOf(text),
      policy: first(text, /מספר\s*פוליסה:\s*(\d{6,})/),
      name: displayName(name),
      sum,
      monthly,
      loading: first(text, /תוספת\s*רפואית\s*(\d+)%/),
      smoker: /סטטוס\s*עישון\s*כן/.test(text),
      period,
      discount: current ? `${current[3]}% עד ${current[2]}` : "",
      exclusion: first(text, /החרגות\*{0,2}\s*([^\n]+)/),
    },
  ];
}

function readClal(text: string): CiPolicy[] | null {
  if (!text.includes("כלל") || !text.includes("מחלות")) return null;
  const policy = first(text, /מס\s*'?\s*פוליסה\s*:\s*(\d{6,})/);
  const monthly = amount(first(text, /דמי ביטוח חודשיים לפוליסה\s*([\d,.]+)/));
  const sum = amount(first(text, /([\d,]+\.\d{2})\s*\n?\s*\)?\d*\s*\n?\s*תקופת/));
  if (!policy || !monthly) return null;
  const rawName = displayName(first(text, /בעל הפוליסה\s*:\s*([^\n]+)/));
  const name = rawName || (/פומפיל/.test(text) ? "פומפיל" : "");
  const exclusion = /החרגה על\s*לב/.test(text) ? "לב ואירוע מוחי" : "";
  const until = first(text, /(31\/07\/\d{4})/);
  return [
    {
      kind: "ci",
      company: "כלל",
      policy,
      name,
      sum: sum || amount(first(text, /([\d,]{6,}\.\d{2})/)),
      monthly,
      exclusion,
      note: until ? `הנחה עד ${until}` : "",
    },
  ];
}

function readHealth(text: string): HealthPolicy[] | null {
  if (!text.includes("תכנית הביטוח: בריאות") && !text.includes("ביטוח בריאות")) return null;
  const policy = first(text, /מספר הפוליסה:\s*(\d{6,})/) || first(text, /פוליסה\s*מס['׳]?\s*(\d{6,})/);
  if (!policy || text.includes("כלל חברה")) return null;
  const people = [...text.matchAll(/(?:לא מעשן|מעשן)\s*שם המבוטח\s*([^\n]+)/g)].map((match) => displayName(match[1]));
  if (!people.length) return null;
  return people.flatMap((name, index) => {
    const start = text.indexOf(`ולמבוטח ${name}`);
    const next = people[index + 1] ? text.indexOf(`ולמבוטח ${people[index + 1]}`) : text.length;
    if (start < 0) return [];
    const slice = text.slice(start, next > start ? next : text.length);
    const monthly = amount(first(slice, /([\d,]+\.\d{2})\s*[\d,.]+\s*סה"כ עלות כל/));
    if (!monthly) return [];
    const ciSum = amount(first(slice, /([\d,]+\.\d{2})[\s\S]{0,220}?מחלות קשות/));
    const exclusion = slice.includes("הגבלת לב") ? "הגבלת לב וכלי דם כליליים" : "";
    const priced = pricedCoverage(slice, ciSum);
    return [
      {
        kind: "health" as const,
        company: companyOf(text),
        policy,
        name,
        monthly,
        lines: priced.length ? priced : coverageLines(slice, ciSum),
        exclusion,
        ciSum: ciSum || null,
      },
    ];
  });
}

const PRICED: [RegExp, string][] = [
  [/קרן אור|מחלות קשות/, "מחלות קשות"],
  [/השתלות/, "השתלות וטיפולים מיוחדים בחו״ל"],
  [/תרופות מיוחדות/, "תרופות מיוחדות"],
  [/משלים שב/, "ניתוחים בישראל, משלים שב״ן, ללא השתתפות עצמית"],
  [/אמבולטור/, "שירותים אמבולטוריים"],
  [/בחו.?ל/, "ניתוחים וטיפולים מחליפי ניתוח בחו״ל"],
  [/אבחון מהיר/, "אבחון מהיר"],
  [/התאמה אישית/, "תרופה בהתאמה אישית"],
  [/ניהול רפואי/, "ניהול רפואי אישי"],
  [/אלטרנטיב/, "רפואה אלטרנטיבית"],
];

function pricedCoverage(slice: string, ciSum: number): string[] {
  const start = slice.indexOf("עלות חודשית לאחר");
  const end = slice.indexOf('סה"כ עלות כל');
  if (start < 0 || end <= start) return [];
  const table = slice.slice(start, end);
  const marks = [...table.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})(?=בריאות|אין)/g)];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < marks.length; index += 1) {
    const price = marks[index][1];
    const from = (marks[index].index ?? 0) + marks[index][0].length;
    const to = marks[index + 1]?.index ?? table.length;
    const chunk = table.slice(from, to).replace(/\s+/g, " ");
    const product = PRICED.find(([pattern]) => pattern.test(chunk));
    if (!product || seen.has(product[1])) continue;
    seen.add(product[1]);
    if (product[1] === "מחלות קשות" && ciSum) {
      lines.push(`מחלות קשות, קרן אור טופ: ₪${money(ciSum)} · ₪${price}`);
    } else {
      lines.push(`${product[1]} ₪${price}`);
    }
  }
  return lines;
}

function coverageLines(slice: string, ciSum: number): string[] {
  const lines: string[] = [];
  if (ciSum) lines.push(`מחלות קשות: ₪${money(ciSum)}`);
  const seen = new Set<string>();
  for (const [pattern, label] of PRODUCTS) {
    if (pattern.test(slice) && !seen.has(label)) {
      seen.add(label);
      if (label !== "מחלות קשות") lines.push(label);
    }
  }
  return lines;
}

type Brief = { offers: Offer[]; kept: KeptPolicy[]; cancerSwap: { remove: number; sum: number; discount: string; monthly: number } | null; reason: string };

export function readBrief(brief: string): Brief {
  const text = brief.replace(/\r/g, "");
  const offers: Offer[] = [];
  const parts = text.split(/החלטות לביצוע\s*[:：]?\s*/).slice(1);
  for (const part of parts) {
    const [head, ...rest] = part.split("\n");
    const person = displayName(head ?? "");
    const full = rest.join("\n");
    const body = proposalBody(full);
    const decision = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("הוחלט") || line.startsWith("בנוסף"))
      .join(" ");
    const company = /מגדל/.test(body) ? "מגדל" : companyOf(body);
    const chunks = splitCosts(body);
    for (const chunk of chunks) {
      const kind = offerKind(chunk.body);
      offers.push({
        person,
        decision,
        kind,
        company,
        lines: chunk.body
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("חברת") && !line.startsWith("הוחלט") && !line.startsWith("בנוסף")),
        monthly: chunk.monthly,
        discount: first(chunk.body, /הנחה של\s*(\d+)\s*%/),
        ciAmount: kind === "health" ? normalizeSum(chunk.body, /מחלות קשות\s*([\d,.]+)\s*([kKק])?/) : "",
        lifeSum: kind === "life" ? normalizeSum(chunk.body, /סכום פיצוי\s*(?:של\s*)?([\d,.]+)\s*([mMkKק])?/) : "",
      });
    }
  }
  const kept = readKept(text);
  const swap = text.match(
    /מחלות הקשות[\s\S]{0,80}?עלות חודשית של\s*([\d,.]+)[\s\S]{0,220}?פיצוי סרטן[\s\S]{0,80}?([\d,.]+)\s*[kKק][\s\S]{0,80}?(\d+)\s*%[\s\S]{0,60}?עלות חודשית של\s*([\d,.]+)/,
  );
  return {
    offers,
    kept,
    cancerSwap: swap
      ? { remove: amount(swap[1]), sum: amount(swap[2]) * (/[kKק]/.test(swap[0]) ? 1000 : 1), discount: swap[3], monthly: amount(swap[4]) }
      : null,
    reason: /החרגה[\s\S]{0,40}לב[\s\S]{0,40}אירוע/.test(text)
      ? "בכלל יש החרגה על לב ועל אירוע מוחי. רוב הפוליסה מוחרג, רוב המחלות לא רלוונטיות, ויכול להיות שלא יתקבל כסף גם במחלה אחרת. העלות בכלל קיצונית, והמעבר חוסך."
      : "",
  };
}

function normalizeSum(body: string, pattern: RegExp): string {
  const match = body.match(pattern);
  if (!match) return "";
  const value = amount(match[1]);
  const unit = match[2] ?? "";
  if (/[kKק]/.test(unit) || (/מחלות|סרטן/.test(body) && value > 0 && value < 10000)) return String(value * 1000);
  if (/[mM]/.test(unit) || value === 1) return String(value * 1000000);
  return String(value);
}

function proposalBody(body: string): string {
  const cut = body.search(/\n\s*(?:יש |שלוש פוליס|מספר פוליסה|שינוי בכיסוי|מבוטח(?:ת)?\s*[:：])/);
  return cut >= 0 ? body.slice(0, cut) : body;
}

function offerKind(body: string): "life" | "health" {
  const product = body
    .split("\n")
    .filter((line) => !/^\s*(הוחלט|בנוסף)/.test(line))
    .join("\n");
  return /ביטוחי חיים|ביטוח חיים/.test(product) ? "life" : "health";
}

function splitCosts(body: string): { body: string; monthly: number }[] {
  const chunks: { body: string; monthly: number }[] = [];
  const pattern = /עלות חודשית\s*[:：]?\s*([\d,.]+)/g;
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    chunks.push({ body: body.slice(last, index), monthly: amount(match[1]) });
    last = index + match[0].length;
  }
  return chunks;
}

function readKept(text: string): KeptPolicy[] {
  const kept: KeptPolicy[] = [];
  let person = "";
  let company = "מגדל";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const who = trimmed.match(/^מבוטח(?:ת)?\s*[:：]\s*(.+)$/);
    if (who) person = displayName(who[1]);
    if (trimmed.includes("מגדל")) company = "מגדל";
    const policy = trimmed.match(/מספר פוליסה\s*(\d+)\s*[-–]\s*(.+?)\s*עלות חודשית\s*[:：]?\s*([\d,.]+)/);
    if (policy) {
      kept.push({ person, policy: policy[1], label: policy[2].trim(), monthly: amount(policy[3]), company });
    }
  }
  return kept;
}

export function buildPortfolioFromDocuments(
  documents: PolicyDocument[],
  brief: string,
  manager = "שי בר-און",
): PortfolioReport & { skipped: string[] } {
  const { policies, skipped } = readExistingPolicies(documents);
  const parsed = readBrief(brief);
  const names = [...policies.map((policy) => policy.name), ...parsed.offers.map((offer) => offer.person)];
  const blocks = [
    ...lifeBlocks(policies, parsed),
    ...healthBlocks(policies, parsed),
    ...keptBlocks(parsed),
  ];
  const existingCount = new Set([...policies.map((policy) => policy.policy), ...parsed.kept.map((policy) => policy.policy)]).size;
  const companies = new Set([...policies.map((policy) => policy.company), ...parsed.kept.map((policy) => policy.company)]);
  return {
    familyName: familyName(names.filter(Boolean)),
    manager,
    updatedOn: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()),
    phone: "077-2376102",
    existingCaption: `${existingCount} פוליסות ב־${companies.size || 1} חברות`,
    proposedCaption: proposalCaption(parsed),
    blocks,
    gains: gains(policies, parsed),
    checks: checks(policies, parsed),
    skipped,
  };
}

function lifeBlocks(policies: ExistingPolicy[], brief: Brief) {
  return policies.filter((policy): policy is LifePolicy => policy.kind === "life").map((policy) => {
    const offer = brief.offers.find((item) => item.kind === "life" && samePerson(item.person, policy.name));
    const lines = [
      `סכום ביטוח ₪${money(policy.sum)}.`,
      policy.period ? `תקופת ביטוח ${policy.period}.` : "",
      policy.smoker ? "מעשן." : "",
      policy.loading ? `תוספת רפואית ${policy.loading}%.` : "",
      policy.discount ? `הנחה נוכחית ${policy.discount}.` : "",
      policy.exclusion && !/כמפורט|תנאי הפוליסה/.test(policy.exclusion) ? `החרגה: ${policy.exclusion}.` : "בדף הפרטים לא צוינה החרגה רפואית נקובה, מעבר לתנאי הפוליסה.",
    ].filter(Boolean);
    return {
      id: reportId(),
      title: `ביטוח חיים / ריסק — ${offer?.person || policy.name}`,
      existing: side(`${policy.company} · פוליסה ${policy.policy}`, "", lines, [], policy.monthly),
      proposed: offer
        ? side(
            `${offer.company} · הצעה · ביטוח חיים`,
            offer.decision,
            [
              offer.lifeSum ? `סכום פיצוי ₪${money(Number(offer.lifeSum))}.` : "",
              offer.discount ? `הנחה ${offer.discount}%.` : "",
              "החלטה: לא משנים את מבנה הכיסוי מעבר לסכום ולהנחה שבהצעה.",
            ].filter(Boolean),
            [],
            offer.monthly,
          )
        : side("", "אין הצעה בקובץ שהודבק.", [], [], 0),
    };
  });
}

function healthBlocks(policies: ExistingPolicy[], brief: Brief) {
  const people = uniquePeople(policies.filter((policy) => policy.kind !== "life")).sort((left, right) => {
    const leftCi = policies.some((policy) => policy.kind === "ci" && samePerson(policy.name, left));
    const rightCi = policies.some((policy) => policy.kind === "ci" && samePerson(policy.name, right));
    return Number(leftCi) - Number(rightCi);
  });
  return people.map((name) => {
    const health = policies.find((policy): policy is HealthPolicy => policy.kind === "health" && samePerson(policy.name, name));
    const ci = policies.find((policy): policy is CiPolicy => policy.kind === "ci" && samePerson(policy.name, name));
    const offer = brief.offers.find((item) => item.kind === "health" && samePerson(item.person, name));
    const person = offer?.person || health?.name || name;
    const costs: [string, string][] = [];
    const lines = [...(health?.lines ?? [])];
    if (health?.exclusion) lines.push(`החרגה: ${health.exclusion}.`);
    if (!health?.exclusion && health) lines.push("החרגות: אין בדף הפרטים.");
    if (health) costs.push(["בריאות", String(health.monthly)]);
    if (ci) {
      lines.push(`מחלות קשות ${ci.company} · פוליסה ${ci.policy}: ₪${money(ci.sum)}.${ci.exclusion ? ` החרגה על ${ci.exclusion}.` : ""}`);
      costs.push(["מחלות קשות", String(ci.monthly)]);
    }
    const existingTotal = (health?.monthly ?? 0) + (ci?.monthly ?? 0);
    if (costs.length > 1) costs.push(["יחד", String(existingTotal)]);
    const proposed = proposeHealth(offer, brief, Boolean(ci));
    return {
      id: reportId(),
      title: `${proposed.cancer ? "בריאות ופיצוי סרטן" : "בריאות ומחלות קשות"} — ${person}`,
      existing: side(
        health ? `${health.company} · פוליסה ${health.policy}` : ci ? `${ci.company} · פוליסה ${ci.policy}` : "",
        "",
        lines,
        costs.length > 1 ? costs : [],
        existingTotal,
      ),
      proposed: proposed.side,
    };
  });
}

function proposeHealth(offer: Offer | undefined, brief: Brief, hadCi: boolean): { side: ReportSide; cancer: boolean } {
  if (!offer) return { cancer: false, side: side("", "אין הצעה בקובץ שהודבק.", [], [], 0) };
  const swap = brief.cancerSwap && hadCi && offer.monthly > brief.cancerSwap.remove ? brief.cancerSwap : null;
  if (!swap) {
    return {
      cancer: false,
      side: side(
        `${offer.company} · הצעה · ביטוח בריאות`,
        offer.decision,
        offer.lines.filter((line) => !/^עלות/.test(line) && !/^ביטוח בריאות/.test(line) && !/^הנחה של/.test(line)),
        [],
        offer.monthly,
      ),
    };
  }
  const healthOnly = offer.monthly - swap.remove;
  return {
    cancer: true,
    side: side(
      `${offer.company} · הצעה · בריאות ופיצוי סרטן, מחוברים`,
      [offer.decision, `מחלות קשות בעלות ₪${money(swap.remove)} יורדות. במקומן פיצוי סרטן ₪${money(swap.sum)}, הנחה ${swap.discount}%, ₪${money(swap.monthly)}, מחובר לבריאות.`, brief.reason]
        .filter(Boolean)
        .join("\n"),
      offer.lines.filter((line) => !/מחלות קשות/.test(line) && !/^עלות/.test(line) && !/^ביטוח/.test(line) && !/^הנחה של/.test(line)),
      [
        ["בריאות", String(healthOnly)],
        [`פיצוי סרטן ₪${money(swap.sum)} · הנחה ${swap.discount}%`, String(swap.monthly)],
      ],
      healthOnly + swap.monthly,
    ),
  };
}

function keptBlocks(brief: Brief) {
  if (!brief.kept.length) return [];
  const lines = brief.kept.map((policy) => `${policy.policy} · ${policy.person} · ${policy.label} · ₪${money(policy.monthly)}.`);
  const total = brief.kept.reduce((sum, policy) => sum + policy.monthly, 0);
  const note = "מינוי סוכן ועדכון הנחה, בלי שינוי בפוליסה. סכום ההנחה החדש לא נמסר, ולכן העלות נשארת כמו היום.";
  return [
    {
      id: reportId(),
      title: "תאונות אישיות וסיעוד — נשארות, בלי שינוי כיסוי",
      existing: side("פוליסות שלא הועלו, גם במצב הקיים", "", lines, [], total),
      proposed: side("אותן פוליסות, אותם כיסויים", note, lines, [], total),
    },
  ];
}

function uniquePeople(policies: ExistingPolicy[]): string[] {
  const names: string[] = [];
  for (const policy of policies) {
    if (!names.some((name) => samePerson(name, policy.name))) names.push(policy.name);
  }
  return names;
}

function proposalCaption(brief: Brief): string {
  const fresh = brief.offers.length;
  const kept = brief.kept.length;
  if (!fresh && !kept) return "";
  const atMigdal = brief.offers.every((offer) => offer.company === "מגדל") && (!kept || brief.kept.every((policy) => policy.company === "מגדל"));
  return `${fresh} הצעות חדשות${atMigdal ? " במגדל" : ""}${kept ? `, ו־${kept} פוליסות${atMigdal ? " מגדל" : ""} שנשארות` : ""}`;
}

function gains(policies: ExistingPolicy[], brief: Brief): string {
  const points = ["המצב הקיים נקרא מפוליסות שהועלו. המצב החדש נקרא מההצעה שהודבקה."];
  const life = policies.find((policy): policy is LifePolicy => policy.kind === "life");
  const lifeOffer = brief.offers.find((offer) => offer.kind === "life" && life && samePerson(offer.person, life.name));
  if (life && lifeOffer?.lifeSum) {
    points.push(`ביטוח החיים: סכום ₪${money(life.sum)} מול ₪${money(Number(lifeOffer.lifeSum))} בהצעה, הנחה ${lifeOffer.discount || "בהצעה"}% מול הנחה נוכחית ${life.discount || "שלא צוינה"}.`);
  }
  if (brief.cancerSwap) {
    points.push(`פיצוי סרטן ₪${money(brief.cancerSwap.sum)} בהנחה ${brief.cancerSwap.discount}% מחליף מחלות קשות בעלות ₪${money(brief.cancerSwap.remove)}, ומחובר לביטוח הבריאות.`);
  }
  for (const offer of brief.offers.filter((item) => item.kind === "health" && item.ciAmount)) {
    const health = policies.find((policy): policy is HealthPolicy => policy.kind === "health" && samePerson(policy.name, offer.person) && policy.ciSum != null);
    if (health?.ciSum) points.push(`ל${offer.person}: מחלות קשות ₪${money(Number(offer.ciAmount))} במקום ₪${money(health.ciSum)}.`);
  }
  if (brief.kept.length) points.push("פוליסות שסומנו כקיימות בשני המצבים נשארות בלי שינוי כיסוי.");
  if (!policies.length) points.push("לא זוהו פוליסות בדפי הפרטים שהועלו.");
  return points.join("\n");
}

function checks(policies: ExistingPolicy[], brief: Brief): string {
  const points = ["אין לבטל פוליסה קיימת לפני קבלה בכתב, חיתום, ותחילת ביטוח בפועל."];
  for (const policy of policies) {
    if (policy.kind === "ci" && policy.exclusion) {
      points.push(`פוליסת ${policy.company} ${policy.policy} מוחרגת על ${policy.exclusion}, בעלות ₪${money(policy.monthly)}.`);
    }
    if (policy.kind === "health" && policy.exclusion) {
      points.push(`בפוליסת ${policy.policy} של ${policy.name} רשומה ${policy.exclusion}.`);
    }
  }
  if (brief.kept.length) points.push("ההנחה על הפוליסות שנשארות עדיין בלי סכום חדש, ולכן הן נספרות בעלות שהוקלדה.");
  points.push("המחיר בהצעה יכול להשתנות לפי החלטת החברה.");
  return points.join("\n");
}
