/**
 * Call-control QA checklist — aligned to agency checklist document
 * ("צ'ק־ליסט סוכן AI לבקרת שיחות ביטוח").
 *
 * Hermes must return analyses in this shape via calls.save_analysis.
 * Official storage:
 * - overall_score  → total /100
 * - rubric_scores  → scoring breakdown (§24–25)
 * - findings       → identification + full checklist + gaps + criticals + manager summary
 * - recommendations → up to 5 improvement actions (§25.10)
 * - summary        → short manager summary text (§25.11)
 */

export const CHECKLIST_STATUSES = [
  "done", // בוצע
  "partial", // בוצע חלקית
  "not_done", // לא בוצע
  "not_relevant", // לא רלוונטי — לא במכנה הציון
  "unverifiable", // לא ניתן לאימות — מוצג, לא כשל אוטומטי
] as const;

export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  done: "בוצע",
  partial: "בוצע חלקית",
  not_done: "לא בוצע",
  not_relevant: "לא רלוונטי",
  unverifiable: "לא ניתן לאימות",
};

export const FINDING_SEVERITIES = [
  "critical", // קריטי
  "material", // מהותי
  "improvement", // לשיפור
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: "קריטי",
  material: "מהותי",
  improvement: "לשיפור",
};

/** §24 scoring weights */
export const SCORE_WEIGHTS = {
  total: 100,
  compliance: 60, // ציות לתהליך ולרגולציה
  professionalism: 25, // מקצועיות והתאמת צרכים
  service_quality: 15, // איכות שיחה, שירות ומכירה
} as const;

export type CallIdentification = {
  customer_name?: string | null;
  rep_name?: string | None;
  agency_name?: string | null;
  insurer?: string | null; // מגדל / הראל / איילון / הפניקס / אחרת / יותר מחברה / לא ניתן לזהות
  call_type?: string | null;
  products_discussed?: string[];
  products_offered?: string[];
  products_purchased?: string[];
  insured_count?: number | null;
  extra_adults?: boolean | null;
  children?: boolean | null;
  age_67_plus?: boolean | null;
  payer_differs_from_insured?: boolean | null;
  similar_policy_exists?: boolean | null;
  har_habituach_entered?: boolean | null;
  deal_completed?: boolean | null;
  deal_status?: string | null;
};

export type ChecklistItemResult = {
  item_id: string; // e.g. "4.1"
  title?: string;
  status: ChecklistStatus;
  /** מה קרה */
  what_happened?: string | null;
  /** ראיה מהשיחה */
  evidence?: string | null;
  /** זמן בהקלטה (שניות) כאשר ניתן */
  timestamp_sec?: number | null;
  severity?: FindingSeverity | null;
  /** מה היה צריך לעשות */
  should_have?: string | null;
};

export type ChecklistSectionResult = {
  section_id: string; // e.g. "4"
  section_title?: string;
  items: ChecklistItemResult[];
};

export type AnalysisGap = {
  what: string;
  why_important?: string | null;
  should_have?: string | null;
};

export type CriticalEvent = {
  title: string;
  detail?: string | null;
  evidence?: string | null;
  timestamp_sec?: number | null;
};

export type ManagerSummary = {
  call_level?: string | null;
  integrity?: string | null;
  main_risk?: string | null;
  training_topics?: string[];
};

export type CallQaRubricScores = {
  total?: number | null; // /100 — mirrors overall_score
  compliance?: number | null; // /60
  professionalism?: number | null; // /25
  service_quality?: number | null; // /15
  /** Hermes aliases */
  compliance_60?: number | null;
  professionalism_25?: number | null;
  quality_15?: number | null;
  quality?: number | null;
};

export type CallQaFindings = {
  schema_version: 1;
  identification?: CallIdentification | null;
  checklist?: ChecklistSectionResult[];
  /** §25.7 נקודות עובדתיות — מה בוצע נכון */
  done_well?: string[];
  /** §25.8 מה לא בוצע / חסר */
  gaps?: AnalysisGap[];
  /**
   * §25.9 אירועים קריטיים בנפרד.
   * אם אין — מערך ריק; ה-UI מציג "לא זוהו אירועים קריטיים".
   */
  critical_events?: CriticalEvent[];
  /** §25.11 סיכום מנהל מובנה */
  manager_summary?: ManagerSummary | null;
};

/** Catalog of checklist sections/items (§4–§22) — for UI + Hermes contract */
export type ChecklistCatalogItem = { id: string; title: string };
export type ChecklistCatalogSection = {
  id: string;
  title: string;
  items: ChecklistCatalogItem[];
};

export const CALL_QA_CHECKLIST_CATALOG: ChecklistCatalogSection[] = [
  {
    id: "4",
    title: "פתיחת השיחה והזדהות",
    items: [
      { id: "4.1", title: "הנציג הציג את שמו" },
      { id: "4.2", title: "הציג שם סוכנות ותפקיד כאשר נדרש" },
      { id: "4.3", title: "הסביר בצורה ברורה את מטרת השיחה" },
      { id: "4.4", title: "במכירה — הובהר שמטרת השיחה היא מכירה / הצעת ביטוח" },
      { id: "4.5", title: "התקבלה הסכמת הלקוח להמשך השיחה" },
      { id: "4.6", title: "גילוי על חברות הביטוח שעמן עובדת הסוכנות כאשר נדרש" },
      { id: "4.7", title: "סיבת ההמלצה על חברת הביטוח הוצגה באופן הוגן ולא מטעה" },
    ],
  },
  {
    id: "5",
    title: "הר הביטוח",
    items: [
      { id: "5.1", title: "הוסבר מהו אתר הר הביטוח ומה מטרת הבדיקה" },
      { id: "5.2", title: "התקבלה הסכמה מפורשת לפני הכניסה" },
      { id: "5.3", title: "נלקחו פרטי הזיהוי הנדרשים" },
      { id: "5.4", title: "הובהר ייעוד המידע ותקופת השימוש המותרת" },
      { id: "5.5", title: "הסכמה מכל בגיר בנפרד כאשר רלוונטי" },
      { id: "5.6", title: "הנציג עבר עם הלקוח על תוצאות הר הביטוח" },
      { id: "5.7", title: "בפוליסות פיצוי — צוינו סכומי הביטוח הקיימים" },
      { id: "5.8", title: "בפוליסות שיפוי — הוסברו הכיסויים הקיימים" },
      { id: "5.9", title: "זוהו והוסברו כפילויות; התוצאות שימשו לבירור צרכים" },
    ],
  },
  {
    id: "6",
    title: "בירור צרכים",
    items: [
      { id: "6.1", title: "בוצע בירור צרכים אמיתי (לא מעבר ישיר להצעה)" },
      { id: "6.2", title: "נבדקו מצב משפחתי, בני זוג וילדים כאשר רלוונטי" },
      { id: "6.3", title: "נבדקו ביטוחים וסכומים קיימים" },
      { id: "6.4", title: "הוגדרו מטרת הביטוח והצורך" },
      { id: "6.5", title: "הותאם סכום הביטוח לצורך" },
      { id: "6.6", title: "ההמלצה נובעת מהמידע שנאסף" },
      { id: "6.7", title: "בריאות — נבדקו קופ״ח ושב״ן" },
      { id: "6.8", title: "בניתוחים בישראל — נבדקו כיסויים בשב״ן ובקיימים" },
      { id: "6.9", title: "נמנעה הצעת כיסוי שאינו תואם את המידע" },
    ],
  },
  {
    id: "7",
    title: "פוליסה קיימת, החלפה וכפילות",
    items: [
      { id: "7.1", title: "זוהתה פוליסה דומה והוסבר מה קיים כיום" },
      { id: "7.2", title: "בוצעה השוואה בין הקיים לחדש" },
      { id: "7.3", title: "הוצגה סיבת מעבר; נשאל על ביטול הקיימת" },
      { id: "7.4", title: "בהשארת קיימת — הובהרו כפילות ופרמיה נוספת" },
      { id: "7.5", title: "הוסבר הבדל פיצוי/שיפוי כאשר רלוונטי" },
      { id: "7.6", title: "בכפל קולקטיב — אישור מפורש לכפל" },
      { id: "7.7", title: "לא הוצגה כפילות אוטומטית כיתרון" },
    ],
  },
  {
    id: "8",
    title: "הסבר המוצר שנמכר",
    items: [
      { id: "8.1", title: "לכל כיסוי — מהו הכיסוי ומה מקבלים במקרה ביטוח" },
      { id: "8.2", title: "סכום הביטוח / תקרת כיסוי" },
      { id: "8.3", title: "פיצוי או שיפוי" },
      { id: "8.4", title: "השתתפות עצמית, אכשרה והמתנה כאשר קיימות" },
      { id: "8.5", title: "גיל תום, חידוש והחרגות מהותיות" },
      { id: "8.6", title: "מצב רפואי קודם ותנאים למימוש כאשר רלוונטי" },
      { id: "8.7", title: "תלות בקופ״ח / שב״ן / רופא בהסדר" },
      { id: "8.8", title: "שינוי סכום/פרמיה לאורך השנים כאשר קיים" },
      { id: "8.9", title: "נספחים, הרחבות וכתבי שירות שנמכרו" },
      { id: "8.10", title: "לא הסתפקו באמירה כללית ללא הסבר ממשי" },
    ],
  },
  {
    id: "9",
    title: "ביטוח חיים / ריסק",
    items: [
      { id: "9.1", title: "סכום הביטוח והתאמתו לצורך" },
      { id: "9.2", title: "למי משולמים תגמולים; מוטבים כאשר נדרש" },
      { id: "9.3", title: "חריג התאבדות בשנה הראשונה כאשר חל" },
      { id: "9.4", title: "גיל תום הביטוח" },
      { id: "9.5", title: "מבנה פרמיה והצמדה כאשר רלוונטי" },
      { id: "9.6", title: "במשכנתא — קשר ליתרת ההלוואה" },
      { id: "9.7", title: "בסכום משתנה — מנגנון השינוי" },
      { id: "9.8", title: "בדיקה לפי תנאי המוצר/החברה שזוהו בלבד" },
    ],
  },
  {
    id: "10",
    title: "מחלות קשות",
    items: [
      { id: "10.1", title: "סכום הפיצוי" },
      { id: "10.2", title: "אכשרה, גיל תום וחידוש" },
      { id: "10.3", title: "שינוי סכום/פרמיה עם הגיל כאשר קיים" },
      { id: "10.4", title: "תנאים למקרה נוסף, מצב קודם ושרידות" },
      { id: "10.5", title: "פיצוי חלקי במקרים רלוונטיים" },
      { id: "10.6", title: "תנאי החברה שזוהתה בלבד — ללא ערבוב" },
    ],
  },
  {
    id: "11",
    title: "ביטוח בריאות",
    items: [
      { id: "11.1", title: "כיסוי שיפוי ומשמעותו" },
      { id: "11.2", title: "אכשרה ומבנה פרמיה" },
      { id: "11.3", title: "כיסויי בסיס והרחבות שנרכשו" },
      { id: "11.4", title: "קשר בסיס↔הרחבות וביטול כיסוי בסיס" },
      { id: "11.5", title: "מה ניתן לבטל בנפרד" },
      { id: "11.6", title: "השתלות, תרופות וניתוחים בחו״ל כאשר נמכרו" },
      { id: "11.7", title: "ניתוחים בישראל — מסלול שנבחר ומסלולים נוספים" },
      { id: "11.8", title: "פרמיה לכל מסלול כאשר רלוונטי" },
      { id: "11.9", title: "השתתפות עצמית, תלות בשב״ן/הסדר" },
      { id: "11.10", title: "אמבולטורי — עיקרי הכיסוי כאשר נמכר" },
      { id: "11.11", title: "התפתחות הילד — גיל תום וטיפולים קודמים" },
    ],
  },
  {
    id: "12",
    title: "גילוי נאות ומידע מהותי",
    items: [
      { id: "12.1", title: "הודיע ששולח גילוי נאות / מידע מהותי" },
      { id: "12.2", title: "הוסבר תוכן המסמך (כיסוי, פרמיות, החרגות)" },
      { id: "12.3", title: "הלקוח התבקש לעיין במסמך" },
      { id: "12.4", title: "נשאל במפורש אם המסמך התקבל" },
      { id: "12.5", title: "אישור ברור לקבלת המידע כאשר נדרש" },
      { id: "12.6", title: "הובהר שתנאי הפוליסה המלאים הם המחייבים" },
    ],
  },
  {
    id: "13",
    title: "הצהרת בריאות (סעיף קריטי)",
    items: [
      { id: "13.1", title: "לפני ההצהרה — חובה להשיב מלא וכנה והשפעה על תגמולים" },
      { id: "13.2", title: "כל שאלה הוקראה במלואה" },
      { id: "13.3", title: "כל שאלה בנפרד + תשובה ברורה" },
      { id: "13.4", title: "לא נשאלו מספר שאלות יחד עם תשובה כללית" },
      { id: "13.5", title: "הצהרה עם כל בגיר בנפרד" },
      { id: "13.6", title: "לא התקבלו תשובות בשם בגיר אחר" },
      { id: "13.7", title: "ילדים — מבוגר מוסמך עונה עבורם" },
      { id: "13.8", title: "במענה חיובי — הוסבר חיתום ואישור תנאים מיוחדים" },
    ],
  },
  {
    id: "14",
    title: "גובה, משקל ופרטי חיתום",
    items: [
      { id: "14.1", title: "נשאלו גובה ומשקל כאשר נדרש" },
      { id: "14.2", title: "נתונים מכל מועמד בגיר כנדרש" },
      { id: "14.3", title: "לא הונח שנתוני אחד חלים על בגיר אחר" },
    ],
  },
  {
    id: "15",
    title: "פרמיה והנחות",
    items: [
      { id: "15.1", title: "פרמיה לכל מוצר שנרכש" },
      { id: "15.2", title: "מחיר לכל כיסוי כאשר נדרש + עלות כוללת" },
      { id: "15.3", title: "פרמיה משתנה — נאמר והוסבר המנגנון" },
      { id: "15.4", title: "פרמיה מקסימלית כאשר נדרש" },
      { id: "15.5", title: "הנחה — שיעור, תקופה ומה אחריה" },
      { id: "15.6", title: "מחיר לפני הנחה כאשר נדרש" },
      { id: "15.7", title: "עלות לכל מבוטח בנפרד כאשר יש כמה" },
      { id: "15.8", title: "ילדים במחיר זהה — רק אם נאמר במפורש" },
    ],
  },
  {
    id: "16",
    title: "אמצעי תשלום",
    items: [
      { id: "16.1", title: "הוסברו אמצעי תשלום ונלקחו פרטים" },
      { id: "16.2", title: "אומתה זהות בעל אמצעי התשלום כאשר נדרש" },
      { id: "16.3", title: "בעל כרטיס ≠ מבוטח — הסכמה מוקלטת" },
      { id: "16.4", title: "משלם חריג — התהליך הנדרש" },
      { id: "16.5", title: "חזרה על סכום הגבייה ומועדים כאשר ידועים" },
    ],
  },
  {
    id: "17",
    title: "כל מבוטח בגיר בנפרד",
    items: [
      { id: "17.1", title: "בדיקות נפרדות לכל בגיר (הר/הצהרה/כיסויים/רכישה/חתימה)" },
      { id: "17.2", title: "לא אושר/נענה בשם בגיר אחר" },
    ],
  },
  {
    id: "18",
    title: "מועמד בן 67 ומעלה",
    items: [
      { id: "18.1", title: "בשיחה ראשונה — תמצית כתובה, התייעצות ותיאום המשך" },
      { id: "18.2", title: "בשיחת המשך — מכירה רק לאחר פרק הזמן הנדרש" },
      { id: "18.3", title: "שיחה ראשונה בלבד — אין הורדת ציון על עסקה שלא הושלמה" },
    ],
  },
  {
    id: "19",
    title: "אישור עסקה",
    items: [
      { id: "19.1", title: "שאלה מפורשת אם מאשר רכישת הפוליסה" },
      { id: "19.2", title: "התקבלה תשובה ברורה" },
      { id: "19.3", title: "כל בגיר אישר בנפרד" },
      { id: "19.4", title: "חתימה מרחוק כאשר נדרש" },
      { id: "19.5", title: "לא הוסק אישור רק ממסירת אמצעי תשלום" },
    ],
  },
  {
    id: "20",
    title: "מועד תחילת הביטוח ומשלוח מסמכים",
    items: [
      { id: "20.1", title: "הובהר שהכיסוי אינו בהכרח מיידי" },
      { id: "20.2", title: "כפוף לאישור החברה והפקת פוליסה" },
      { id: "20.3", title: "מועד תחילה מופיע במסמכי הפוליסה" },
      { id: "20.4", title: "אופן משלוח מסמכים ואימות פרטי קשר" },
      { id: "20.5", title: "הפניה לעיון בתנאים המלאים" },
    ],
  },
  {
    id: "21",
    title: "סיום השיחה",
    items: [
      { id: "21.1", title: "סיכום קצר וברור של מה שנרכש" },
      { id: "21.2", title: "חזרו על העלות הכוללת" },
      { id: "21.3", title: "אפשרות לשאול שאלות" },
      { id: "21.4", title: "נמסר טלפון / דרך חזרה לסוכנות" },
      { id: "21.5", title: "סיום ברור ומקצועי" },
    ],
  },
  {
    id: "22",
    title: "איכות השיחה",
    items: [
      { id: "22.1", title: "הקשבה, סבלנות ובהירות" },
      { id: "22.2", title: "סדר וניהול שיחה מקצועי" },
      { id: "22.3", title: "שליטה במוצר ותשובות ענייניות" },
      { id: "22.4", title: "מקום ללקוח לדבר ושאלות מתאימות" },
      { id: "22.5", title: "הימנעות מלחץ / הפחדה / מידע מטעה" },
      { id: "22.6", title: "וידוא הבנת הלקוח" },
      { id: "22.7", title: "המלצה מבוססת צרכים ולא רק סגירת מכירה" },
    ],
  },
];

export function getChecklistItemTitle(itemId: string): string | undefined {
  for (const section of CALL_QA_CHECKLIST_CATALOG) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return item.title;
  }
  return undefined;
}

export function getChecklistSectionTitle(sectionId: string): string | undefined {
  return CALL_QA_CHECKLIST_CATALOG.find((s) => s.id === sectionId)?.title;
}

export function isChecklistStatus(v: unknown): v is ChecklistStatus {
  return typeof v === "string" && (CHECKLIST_STATUSES as readonly string[]).includes(v);
}

export function parseCallQaFindings(raw: unknown): CallQaFindings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as CallQaFindings;
}

export function mergeCallIdentification(
  rubricScores: unknown,
  findings: CallQaFindings | null,
): CallIdentification {
  const scores =
    rubricScores && typeof rubricScores === "object" && !Array.isArray(rubricScores)
      ? (rubricScores as CallQaRubricScores & CallIdentification & { identification?: CallIdentification })
      : {};
  const fromScoresIdent = scores.identification ?? {};
  const fromFindings = findings?.identification ?? {};
  const customer =
    fromFindings.customer_name ||
    fromScoresIdent.customer_name ||
    (typeof (scores as { customer_name?: unknown }).customer_name === "string"
      ? (scores as { customer_name?: string }).customer_name
      : null);
  const agent =
    fromFindings.rep_name ||
    fromScoresIdent.rep_name ||
    (typeof (scores as { agent_name?: unknown }).agent_name === "string"
      ? (scores as { agent_name?: string }).agent_name
      : null);
  return {
    ...fromScoresIdent,
    ...fromFindings,
    customer_name: customer ?? null,
    rep_name: agent ?? null,
  };
}

export function parseCallQaRubric(raw: unknown): CallQaRubricScores | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as CallQaRubricScores;
}

/** Normalize Hermes aliases → canonical score fields */
export function resolveRubricScores(
  raw: unknown,
  overallScore?: number | string | null,
): {
  total: number | null;
  compliance: number | null;
  professionalism: number | null;
  service_quality: number | null;
} {
  const rubric = parseCallQaRubric(raw);
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    total:
      numOrNull(rubric?.total) ??
      numOrNull(overallScore),
    compliance:
      numOrNull(rubric?.compliance_60) ??
      numOrNull(rubric?.compliance),
    professionalism:
      numOrNull(rubric?.professionalism_25) ??
      numOrNull(rubric?.professionalism),
    service_quality:
      numOrNull(rubric?.quality_15) ??
      numOrNull(rubric?.quality) ??
      numOrNull(rubric?.service_quality),
  };
}
