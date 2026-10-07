# -*- coding: utf-8 -*-
"""Liba withdrawal-justification form — מסמך הנמקה למשיכת כספים."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import pymupdf  # noqa: E402

from make_legal_pdfs import ARCH, CSS, DOWNLOADS, H, INK, ML, MR, tw  # noqa: E402
from make_sales_ops_form import OpsDeed  # noqa: E402

N_SOURCES = 4
N_FUNDS = 4
N_EMPLOYERS = 6
ROW_H = 15.0

AGENT_NAME = "אסף בר און"
AGENT_PHONE = "077-2376103"

PRODUCT_TYPES = (
    ("קרן פנסיה", "Pension"),
    ("קופת גמל", "Gemel"),
    ("פוליסה", "Policy"),
    ("קרן השתלמות", "Hishtalmut"),
    ("חיסכון לילד", "ChildSave"),
)

CLIENT_DECL = (
    "ידוע לי שבעת משיכת כספים מהמוצר הפנסיוני, כספי פיצויים ו/או כספי תגמולים, "
    "לפני גיל הפרישה, עלולה המשיכה להקטין את הקצבה שאקבל באופן משמעותי ו/או לפגוע "
    "בכיסוי הביטוחי הקיים לי במוצר. כן קיים מס בשיעור 35% על כספי התגמולים בעת המשיכה, "
    "ויכול להיות מס של עד 47% בעת המשיכה על כספי הפיצויים. כמו כן ידוע לי שמשיכת כספים "
    "מהמוצר הפנסיוני לפני גיל הפרישה תפגע בהטבות המס בגיל הפרישה."
)

SELF_SERVICE = (
    "ידוע לי כי פעולת משיכת הכספים ניתנת לביצוע באופן עצמאי מול חברות הביטוח "
    "והגופים המוסדיים, לרבות באמצעות אתר הגוף המוסדי או המסלקה הפנסיונית, "
    "בחינם או בעלות נמוכה, וללא תיווך ליבה."
)

WARNING = (
    "אזהרה: משיכת פיצויים ו/או משיכת כספי התגמולים לפני גיל הפרישה עלולה להקטין "
    "את הקצבה באופן משמעותי, או לביטולה, ולגרום להפסד של הטבות מס רבות. "
    "מומלץ לשקול חלופות אחרות לפני משיכת כספים אלה. "
    "מידע בנוגע לשינויים בבסיס הקצבה ניתן למצוא באתר משרד האוצר: www.mof.gov.il"
)


def _slot(d: OpsDeed, x0: float, x1: float, y: float, label: str, name: str):
    size = 7.1
    lw = min(tw(label, size) + 4, (x1 - x0) * 0.46)
    d.page.insert_htmlbox(
        pymupdf.Rect(x1 - lw, y, x1, y + ROW_H - 1),
        H(label, size=size, face="M", align="start", lh=1.05),
        css=CSS,
        archive=ARCH,
    )
    yline = y + ROW_H - 2.2
    d.page.draw_line(pymupdf.Point(x0, yline), pymupdf.Point(x1 - lw - 2, yline), color=INK, width=0.4)
    d.field(pymupdf.Rect(x0, y + 0.6, x1 - lw - 2, yline - 0.2), name=name, size=8)


def _pair_row(d: OpsDeed, pairs: list[tuple[str, str]]):
    d.ensure(ROW_H + 1)
    y = d.y
    gap = 8.0
    n = len(pairs)
    col = (d.iw - gap * (n - 1)) / n
    x1 = MR
    for label, name in pairs:
        x0 = x1 - col
        _slot(d, x0, x1, y, label, name)
        x1 = x0 - gap
    d.y += ROW_H


def _employer_line(d: OpsDeed, i: int, emp: int):
    d.ensure(ROW_H + 1)
    y = d.y
    checks = (
        ("מלוא הסכום", f"EmpFull{i}_{emp}"),
        ("מס מלא", f"EmpTaxFull{i}_{emp}"),
        ("פטור מס", f"EmpTaxFree{i}_{emp}"),
    )
    x = ML
    for label, name in checks:
        lw = tw(label, 7.0) + 2
        d.named_chk(x, y + 2.2, name, size=8)
        d.page.insert_htmlbox(
            pymupdf.Rect(x + 10, y, x + 10 + lw, y + ROW_H - 1),
            H(label, size=7.0, align="start", lh=1.05),
            css=CSS,
            archive=ARCH,
        )
        x += 12 + lw
    _slot(d, x + 6, x + 78, y, "על סך", f"EmpAmt{i}_{emp}")
    _slot(d, x + 84, MR, y, f"מעסיק {emp}", f"EmpName{i}_{emp}")
    d.y += ROW_H


def action_block(d: OpsDeed, i: int):
    d.p(f"חברה {i}", size=9.2, face="B", gap=1)
    _pair_row(d, [("חברת ביטוח", f"SrcCo{i}")])
    d.flag([(label, f"Src{key}{i}") for label, key in PRODUCT_TYPES])
    _pair_row(
        d,
        [
            ("1. מספר קופה", f"SrcFund{i}_1"),
            ("וותק", f"SrcSenior{i}_1"),
            ("2. מספר קופה", f"SrcFund{i}_2"),
            ("וותק", f"SrcSenior{i}_2"),
        ],
    )
    _pair_row(
        d,
        [
            ("3. מספר קופה", f"SrcFund{i}_3"),
            ("וותק", f"SrcSenior{i}_3"),
            ("4. מספר קופה", f"SrcFund{i}_4"),
            ("וותק", f"SrcSenior{i}_4"),
        ],
    )
    d.flag(
        [
            ("תגמולים", f"SrcBen{i}"),
            ("פיצויים", f"SrcSev{i}"),
            ("מס מלא", f"SrcTaxFull{i}"),
            ("מס חלקי", f"SrcTaxPart{i}"),
            ("פטור ממס", f"SrcTaxFree{i}"),
        ]
    )
    d.p("מעסיקים", size=8.2, face="M", gap=1)
    for emp in range(1, N_EMPLOYERS + 1):
        _employer_line(d, i, emp)
    _pair_row(d, [("הערות", f"SrcNote{i}")])


def build() -> Path:
    d = OpsDeed(
        "מסמך הנמקה — משיכת כספים",
        "נספח להסכם שיווק פנסיוני  ·  הסבר להמלצות ולפעולת המשיכה",
        show_valid_until=False,
    )

    def article(text: str):
        OpsDeed.article(d, text, reserve=34, before=4, after=3)

    def p(text: str, **kwargs):
        kwargs.setdefault("gap", 3)
        kwargs.setdefault("lh", 1.32)
        kwargs.setdefault("size", 9.2)
        OpsDeed.p(d, text, **kwargs)

    d.article = article  # type: ignore[method-assign]
    d.p = p  # type: ignore[method-assign]
    d.title_block()
    d.fields_row(["תאריך"], names=["Date"])

    d.p(
        "מסמך זה הוא סיכום תהליך בחינת החיסכון הפנסיוני ופעולת המשיכה. "
        "כאן מרוכז המידע שמסרת לסוכן הביטוח הפנסיוני, ומפורטים הנימוקים להמלצה. "
        "חשוב שתקרא את המסמך ותבין את מערך השיקולים. רק לאחר שקראת — והבנת — תחתום. "
        "מומלץ לשמור מסמך זה ולבדוק אחת לכמה שנים, ובעת שינויים אישיים, "
        "האם החיסכון והכיסויים עדיין מתאימים לצרכים שלך."
    )
    d.p(WARNING, size=9.2, face="M")

    d.article("א. פרטי הלקוח")
    d.fields_row(["שם מלא", "ת.ז."], names=["FullName", "PID"])
    d.fields_row(
        ["תאריך לידה / גיל", "מצב משפחתי", "מצב תעסוקתי"],
        names=["BirthAge", "FamilyStatus", "EmploymentStatus"],
    )
    d.fields_row(
        ["טלפון", "טלפון נייד", "דוא״ל"],
        names=["Phone", "Mobile", "Email"],
    )
    d.line_field("כתובת", name="Address")

    d.article("ב. חברות ביטוח ומספרי קופה — מקורות המשיכה")
    d.p(
        "לכל חברת ביטוח: סוג מוצר, עד ארבעה מספרי קופה וותק, סוג הכספים והמס, ושישה מעסיקים.",
        size=9.3,
    )
    for i in range(1, N_SOURCES + 1):
        action_block(d, i)

    d.article("ג. הלוואה וקיזוז הלוואה")
    d.flag(
        [
            ("קיימת הלוואה במוצר", "LoanYes"),
            ("אין הלוואה", "LoanNo"),
            ("מתבצע קיזוז הלוואה", "LoanOffsetYes"),
            ("לא מתבצע קיזוז", "LoanOffsetNo"),
        ]
    )
    d.fields_row(
        ["גוף המלווה", "יתרת הלוואה ₪", "סכום קיזוז ₪", "יתרה לאחר קיזוז ₪"],
        names=["LoanBody", "LoanBalance", "LoanOffset", "LoanAfter"],
    )
    d.named_memo("פירוט הלוואה / קיזוז", 2, "LoanNote")

    d.article("ד. איזה כספים נמשכים")
    d.flag(
        [
            ("פיצויים", "MoneySeverance"),
            ("תגמולים", "MoneyBenefits"),
            ("אחר", "MoneyOther"),
        ]
    )
    d.fields_row(
        ["סכום פיצויים ₪", "סכום תגמולים ₪", "סכום אחר ₪", "סה״כ ברוטו ₪"],
        names=["AmtSeverance", "AmtBenefits", "AmtOther", "AmtGross"],
    )
    d.line_field("פירוט כספים אחרים", name="MoneyOtherNote")

    d.article("ה. המס שיורד — פיצויים ותגמולים")
    d.p(
        "אומדן בלבד. אינו ייעוץ מס ואינו התחייבות. הלקוח רשאי לפנות ליועץ מס או לרואה חשבון.",
        size=9.2,
    )
    d.fields_row(
        ["מס תגמולים %", "סכום מס תגמולים ₪", "מס פיצויים %", "סכום מס פיצויים ₪"],
        names=["TaxBenPct", "TaxBenAmt", "TaxSevPct", "TaxSevAmt"],
    )
    d.fields_row(
        ["סה״כ מס ₪", "נטו משוער ₪", "תיאום מס / אישור"],
        names=["TaxTotal", "TaxNet", "TaxCert"],
    )
    d.named_memo("הסבר מס שהוסבר ללקוח", 2, "TaxNote")

    d.article("ו. למה הלקוח מבצע את המשיכה")
    d.named_memo("סיבת המשיכה בניסוח הלקוח", 2, "ClientReason")
    d.flag(
        [
            ("לפני גיל פרישה", "BeforeRetire"),
            ("בגיל פרישה / קצבה", "AtRetire"),
            ("משיכה מותרת לפי דין", "LegalOk"),
            ("משיכה שעלולה להיות שלא כדין", "LegalRisk"),
        ]
    )

    d.article("ז. המלצת הסוכן למשיכת הכספים")
    d.flag(
        [
            ("ממליץ למשוך", "RecWithdraw"),
            ("ממליץ שלא למשוך", "RecNo"),
            ("ממליץ לדחות / חלופה", "RecDelay"),
            ("ממליץ משיכה חלקית", "RecPartial"),
            ("הלקוח עומד על ביצוע בניגוד להמלצה", "RecAgainst"),
        ]
    )
    d.named_memo("נימוק מלא להמלצה — חובה", 2, "RecNote")
    d.sig_quad([("הלקוח", "rec_client")], intro=None, box_h=62)

    d.article("ט. מאפייני הלקוח שלפיהם נקבעו ההמלצות")
    d.p(
        "התחשבות במאפיינים האישיים נדרשת לשם המלצה מתאימה. "
        "אם לא נמסר מידע — יירשם במפורש \"לא נמסר\". שמירת סודיות חלה על הפרטים.",
        size=9.3,
    )
    d.fields_row(["גיל", "מצב משפחתי", "מצב תעסוקתי"], names=["CharAge", "CharFamily", "CharWork"])
    d.line_field("הכנסה קבועה אחרת לאחר פרישה (שכ״ד, קצבת זקנה וכדומה)", name="CharOtherInc")
    d.named_memo("הערות למאפיינים", 2, "CharNotes")
    d.p(
        "אם לא נמסר מידע מלא, ההמלצה עלולה שלא להתאים לצרכים האישיים. "
        "יש לעדכן את סוכן הביטוח הפנסיוני במידת הצורך ולעדכן את ההמלצה.",
        size=9.2,
    )

    d.article("י. הכר את סוכן הביטוח הפנסיוני")
    d.p("שם התאגיד: ליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ", face="M")
    d.p("ח.פ. 517024733  ·  רישיון תאגידי 517024733  ·  תחום פנסיוני")
    d.p("כתובת: חרושת 10, קריית ביאליק 2641417")
    d.line_field("שם בעל הרישיון", name="AgentName", value=AGENT_NAME, readonly=True)
    d.line_field("מספר רישיון יחיד", name="AgentLicense")
    d.line_field("טלפון", name="AgentContact", value=AGENT_PHONE, readonly=True)
    d.flag(
        [("פועל במסגרת החברה", "AgentForCoYes")],
        on={"AgentForCoYes"},
        lock={"AgentForCoYes"},
    )

    d.article("יג. מידע לתיעוד בידי הלקוח והסוכן")
    d.fields_row(["רחוב", "מס׳ בית", "ישוב"], names=["DocStreet", "DocHouse", "DocCity"])
    d.fields_row(["מיקוד", "טלפון", "טלפון נייד", "דוא״ל"], names=["DocZip", "DocPhone", "DocMobile", "DocEmail"])
    d.fields_row(
        ["מקצוע", "שכר", "מקורות הכנסה נוספים", "התחייבויות", "תלויים כספיים"],
        names=["DocJob", "DocWage", "DocExtraInc", "DocDebts", "DocDepend"],
    )
    d.flag(
        [
            ("פדיון", "GoalPidyon"),
            ("להבין זכויות", "GoalRights"),
            ("דוח פנסיוני", "GoalReport"),
            ("התאמת רמת סיכון", "GoalRisk"),
            ("מקסום תשואה", "GoalYield"),
            ("בדיקה מול האוצר", "GoalMof"),
            ("התאמת חיסכון", "GoalSave"),
            ("ליווי מתמשך", "GoalOngoing"),
        ]
    )
    d.fields_row(
        ["מטרות החיסכון", "מטרות הביטוח", "מצב כספי כללי", "חיסכון קיים"],
        names=["DocSaveGoal", "DocInsGoal", "DocMoney", "DocExistingSave"],
    )
    d.flag(
        [
            ("ניצול הטבות מס", "GoalTax"),
            ("הבחירה נעשתה בהתאם לדרישת הלקוח", "GoalClientChoice"),
        ]
    )

    d.article("יד. גילוי נאות")
    d.p(SELF_SERVICE, face="M")
    d.p("התחייבות והצהרות הלקוח", face="B", gap=4)
    d.p(CLIENT_DECL, face="M")
    d.p(WARNING, size=9.2)

    d.article("טו. הצהרות וחתימות")
    d.p(
        "הצהרת בעל הרישיון: המידע שנמסר לי על ידי הלקוח יישמר בסודיות, ויעבור רק לגורמים לעניין הייעוץ/השיווק הפנסיוני.",
        size=9.3,
    )
    d.p(
        "הצהרת הלקוח: לא מסרתי מידע, או שמסרתי מידע חלקי או לא מדויק, ולכן ההמלצה על המוצרים הפנסיוניים המתאימים לי עלולה שלא להתאים.",
        size=9.3,
    )
    d.p(
        "הצהרת בעל הרישיון על אי־מסירת מידע: בעל הרישיון לא מסר מידע, או שמסר מידע חלקי, ולכן המלצה על ייעוץ או שיווק פנסיוני ללקוח, כפי שהלקוח ביקש, עלולה שלא להתאים.",
        size=9.3,
    )
    d.p(
        "הצהרת הלקוח: אני, החתום מטה, מצהיר כי מסמך ההנמקה נמסר לי על ידי הסוכן הפנסיוני, התחמתי מטה, וקראתי את האמור בו.",
        size=9.3,
        face="M",
    )
    d.flag(
        [
            ("הלקוח קיבל והבין את המסמך", "DeclGot"),
            ("הוסברה האפשרות לפעול מול הגופים", "DeclSelf"),
            ("הוסברו מס, קצבה וכיסוי ביטוחי", "DeclTax"),
        ],
        on={"DeclGot", "DeclSelf", "DeclTax"},
        lock={"DeclGot", "DeclSelf", "DeclTax"},
    )
    d.sig_quad(
        [
            ("הלקוח", "client"),
            ("בעל רישיון יחיד מטעם ליבה", "agent"),
        ],
        box_h=62,
    )

    d.article("טז. בירור צרכים — מידע נוסף")
    d.p("לאחר בירור צרכים של הלקוח הקשור במשיכה:", size=9.3)
    d.named_memo("פירוט נוסף", 2, "NeedsExtra")
    return d.finish(HERE / "5-טופס-הנמקה-משיכה-ליבה.pdf")


def main():
    src = build()
    sms_dir = HERE / "SMS-העלאה"
    sms_dir.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    name = "טופס-הנמקה-משיכה-מעודכן-לבדיקה.pdf"
    for dest_dir in (sms_dir, DOWNLOADS):
        shutil.copy2(src, dest_dir / name)
        print(src.name, src.stat().st_size, "->", dest_dir / name)
    root = Path(r"C:\Users\Beo-syestems\Downloads")
    shutil.copy2(src, root / name)
    print(src.name, src.stat().st_size, "->", root / name)


if __name__ == "__main__":
    main()
