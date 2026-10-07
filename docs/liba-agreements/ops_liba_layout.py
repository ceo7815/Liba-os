# -*- coding: utf-8 -*-
"""Layout for טופס תפעול ליבה — Asaf's comparison form, Liba branding."""
from __future__ import annotations

import pymupdf

from make_legal_pdfs import (
    ARCH,
    BOT,
    CSS,
    HAIR,
    H,
    INK,
    ML,
    MR,
    MUTED_HEX,
    RED,
    YELLOW,
)

NAVY = (0.10, 0.12, 0.18)
PALE = (0.95, 0.95, 0.96)
BAND = (0.90, 0.91, 0.93)
RH = 11.0


def _html(page, rect, text, *, size=6.2, face="R", color="#111111", align="center"):
    page.insert_htmlbox(
        rect,
        H(text, size=size, face=face, color=color, align=align, lh=1.02),
        css=CSS,
        archive=ARCH,
    )


def _bar(d, text: str):
    h = 13.0
    d.ensure(h + 2)
    y = d.y
    d.page.draw_rect(pymupdf.Rect(ML, y, MR, y + h), color=NAVY, fill=NAVY, width=0)
    _html(
        d.page,
        pymupdf.Rect(ML + 6, y + 1, MR - 6, y + h - 1),
        text,
        size=7.6,
        face="M",
        color="#ffffff",
        align="start",
    )
    d.y = y + h


def _rtl_cols(widths: list[float]) -> list[tuple[float, float]]:
    xs = []
    x = MR
    for w in widths:
        xs.append((x - w, x))
        x -= w
    return xs


def _cell(page, x0, y0, x1, y1, *, fill=None):
    page.draw_rect(
        pymupdf.Rect(x0, y0, x1, y1),
        color=HAIR,
        fill=fill,
        width=0.3,
    )


def _head_row(d, xs, labels, y, h=15.0):
    for (x0, x1), lab in zip(xs, labels):
        _cell(d.page, x0, y, x1, y + h, fill=PALE)
        _html(d.page, pymupdf.Rect(x0 + 1, y + 0.4, x1 - 1, y + h - 0.4), lab, size=5.5, face="M")
    return y + h


def _chk(d, x, y, name, size=6.2):
    d.named_chk(x, y, name, size=size)


def _pair(d, x0, x1, y, prefix):
    """כן on the right, לא on the left. The word sits to the right of its box."""
    gap = 2.0
    half = (x1 - x0 - gap) / 2
    box = 6.2
    right0 = x1 - half
    _html(
        d.page,
        pymupdf.Rect(right0 + box + 1, y + 1.2, x1 - 1, y + RH - 1),
        "כן",
        size=6.4,
        face="M",
        align="right",
    )
    _chk(d, right0 + 0.4, y + 2.2, f"{prefix}_yes", box)
    left1 = x0 + half
    _html(
        d.page,
        pymupdf.Rect(x0 + box + 1, y + 1.2, left1 - 1, y + RH - 1),
        "לא",
        size=6.4,
        face="M",
        align="right",
    )
    _chk(d, x0 + 0.4, y + 2.2, f"{prefix}_no", box)


def candidate_table(d):
    _bar(d, "א. פרטי המועמדים לביטוח")
    # right → left
    widths = [52, 68, 68, 58, 56, 28, 62, 87]
    labels = ["מועמד", "שם משפחה", "שם פרטי", "מספר זהות", "תאריך לידה", "גיל", "מין", "מצב משפחתי"]
    xs = _rtl_cols(widths)
    y = _head_row(d, xs, labels, d.y)
    rows = [
        ("main", "הראשי"),
        ("spouse", "בן/בת זוג"),
        ("c1", "ילד 1"),
        ("c2", "ילד 2"),
        ("c3", "ילד 3"),
        ("c4", "ילד 4"),
    ]
    family = [("ר", "single"), ("נ", "married"), ("ג", "divorced"), ("א", "widowed")]
    for key, who in rows:
        for x0, x1 in xs:
            _cell(d.page, x0, y, x1, y + RH)
        _html(d.page, pymupdf.Rect(xs[0][0], y + 1, xs[0][1] - 1, y + RH - 1), who, size=6.0, face="M")
        d.field(pymupdf.Rect(xs[1][0] + 1, y + 1.2, xs[1][1] - 1, y + RH - 1.2), name=f"cand_{key}_last", size=6.5)
        d.field(pymupdf.Rect(xs[2][0] + 1, y + 1.2, xs[2][1] - 1, y + RH - 1.2), name=f"cand_{key}_first", size=6.5)
        d.field(pymupdf.Rect(xs[3][0] + 1, y + 1.2, xs[3][1] - 1, y + RH - 1.2), name=f"cand_{key}_id", size=6.5)
        d.field(pymupdf.Rect(xs[4][0] + 1, y + 1.2, xs[4][1] - 1, y + RH - 1.2), name=f"cand_{key}_dob", size=6.5)
        d.field(pymupdf.Rect(xs[5][0] + 1, y + 1.2, xs[5][1] - 1, y + RH - 1.2), name=f"cand_{key}_age", size=6.5)
        gx1 = xs[6][1] - 2
        _html(d.page, pymupdf.Rect(gx1 - 14, y + 2, gx1, y + RH - 1), "ז", size=5.2)
        _chk(d, gx1 - 22, y + 2.6, f"cand_{key}_m", 6.0)
        _html(d.page, pymupdf.Rect(gx1 - 38, y + 2, gx1 - 24, y + RH - 1), "נ", size=5.2)
        _chk(d, gx1 - 46, y + 2.6, f"cand_{key}_f", 6.0)
        fx1 = xs[7][1] - 2
        for i, (letter, code) in enumerate(family):
            cx = fx1 - 14 - i * 18
            _html(d.page, pymupdf.Rect(cx + 7, y + 2, cx + 16, y + RH - 1), letter, size=5.2, face="M")
            _chk(d, cx, y + 2.6, f"cand_{key}_{code}", 6.0)
        y += RH
    d.y = y + 4


def extra_details(d):
    _bar(d, "פרטים נוספים")
    widths = [52, 64, 68, 64, 100, 64, 67]
    labels = ["מועמד", "עיסוק", "תחביבים מסוכנים", "מעשן", "קופת חולים", "שב״ן", "ביטוח משלים"]
    xs = _rtl_cols(widths)
    y = _head_row(d, xs, labels, d.y, 14)
    for key, who in (("main", "הראשי"), ("spouse", "בן/בת זוג"), ("kids", "ילדים")):
        for x0, x1 in xs:
            _cell(d.page, x0, y, x1, y + RH)
        _html(d.page, pymupdf.Rect(xs[0][0], y + 1, xs[0][1] - 1, y + RH - 1), who, size=6.0, face="M")
        d.field(pymupdf.Rect(xs[1][0] + 1, y + 1.2, xs[1][1] - 1, y + RH - 1.2), name=f"x_{key}_job", size=6.5)
        d.field(pymupdf.Rect(xs[2][0] + 1, y + 1.2, xs[2][1] - 1, y + RH - 1.2), name=f"x_{key}_hobby", size=6.5)
        _pair(d, xs[3][0] + 1, xs[3][1] - 1, y, f"x_{key}_smoke")
        d.field(pymupdf.Rect(xs[4][0] + 1, y + 1.2, xs[4][1] - 1, y + RH - 1.2), name=f"x_{key}_hmo", size=6.5)
        _pair(d, xs[5][0] + 1, xs[5][1] - 1, y, f"x_{key}_shaban")
        d.field(pymupdf.Rect(xs[6][0] + 1, y + 1.2, xs[6][1] - 1, y + RH - 1.2), name=f"x_{key}_supp", size=6.5)
        y += RH
    h = 14.0
    lab_w = 92.0
    _cell(d.page, MR - lab_w, y, MR, y + h, fill=PALE)
    _html(d.page, pymupdf.Rect(MR - lab_w + 2, y + 1, MR - 2, y + h - 1), "ילדים בגירים", size=6.2, face="M")
    slots = [
        ("שם", "AdultChild1Name"),
        ("ת.ז.", "AdultChild1Id"),
        ("שם", "AdultChild2Name"),
        ("ת.ז.", "AdultChild2Id"),
    ]
    span = (MR - lab_w - ML) / len(slots)
    x1 = MR - lab_w
    for lab, name in slots:
        x0 = x1 - span
        _cell(d.page, x0, y, x1, y + h)
        lw = 22.0 if lab == "שם" else 24.0
        _html(d.page, pymupdf.Rect(x1 - lw, y + 1, x1 - 2, y + h - 1), lab, size=6.0, face="M", align="right")
        d.field(pymupdf.Rect(x0 + 1.2, y + 1.4, x1 - lw - 1, y + h - 1.4), name=name, size=6.5)
        x1 = x0
    d.y = y + h + 4


def _matrix(d, title, groups, prefix, *, after: bool):
    _bar(d, title)
    if after:
        widths = [150, 28, 36, 28, 52, 58, 64, 63]
        labels = ["שם הכיסוי", "ראשי", "בן/בת זוג", "ילדים", "סכום ביטוח", "חברה", "הנחה", "פרמיה"]
    else:
        widths = [132, 26, 32, 26, 44, 54, 46, 40, 79]
        labels = ["שם הכיסוי", "ראשי", "בן/בת זוג", "ילדים", "סכום", "חברה / החרגות", "פוליסה", "פרמיה", "מבטל"]
    xs = _rtl_cols(widths)
    need = 15 + sum(13 + RH * len(rows) for _, rows in groups) + RH
    if d.y + min(need, 180) > BOT:
        d.new_page()
        _bar(d, title)
    y = _head_row(d, xs, labels, d.y, 14)

    def row(key, label, yn):
        nonlocal y
        if y + RH > BOT - 4:
            d.y = y
            d.new_page()
            y = _head_row(d, xs, labels, d.y, 14)
        for x0, x1 in xs:
            _cell(d.page, x0, y, x1, y + RH)
        lab_r = xs[0][1] - 2
        if yn:
            _pair(d, lab_r - 64, lab_r, y, f"{prefix}_{key}")
            _html(
                d.page,
                pymupdf.Rect(xs[0][0] + 1, y + 1, lab_r - 66, y + RH - 1),
                label,
                size=5.5,
                face="M",
                align="start",
            )
        else:
            _html(
                d.page,
                pymupdf.Rect(xs[0][0] + 2, y + 1, lab_r, y + RH - 1),
                label,
                size=5.6,
                face="M",
                align="start",
            )
        for i, who in enumerate(("main", "spouse", "child")):
            x0, x1 = xs[1 + i]
            _chk(d, (x0 + x1) / 2 - 3.1, y + 2.8, f"{prefix}_{key}_{who}", 6.2)
        base = 4
        d.field(pymupdf.Rect(xs[base][0] + 1, y + 1.3, xs[base][1] - 1, y + RH - 1.3), name=f"{prefix}_{key}_sum", size=6)
        d.field(pymupdf.Rect(xs[base + 1][0] + 1, y + 1.3, xs[base + 1][1] - 1, y + RH - 1.3), name=f"{prefix}_{key}_co", size=6)
        d.field(pymupdf.Rect(xs[base + 2][0] + 1, y + 1.3, xs[base + 2][1] - 1, y + RH - 1.3), name=f"{prefix}_{key}_extra", size=6)
        d.field(pymupdf.Rect(xs[base + 3][0] + 1, y + 1.3, xs[base + 3][1] - 1, y + RH - 1.3), name=f"{prefix}_{key}_prem", size=6)
        if not after:
            _pair(d, xs[8][0] + 1, xs[8][1] - 1, y, f"{prefix}_{key}_cancel")
        y += RH

    for group, rows in groups:
        if y + 12 > BOT - 8:
            d.y = y
            d.new_page()
            y = _head_row(d, xs, labels, d.y, 14)
        _cell(d.page, ML, y, MR, y + 11, fill=BAND)
        _html(d.page, pymupdf.Rect(ML + 4, y + 0.5, MR - 4, y + 10.5), group, size=6.2, face="M", align="start")
        y += 11
        for item in rows:
            row(*item)
    for x0, x1 in xs:
        _cell(d.page, x0, y, x1, y + RH, fill=PALE)
    _html(d.page, pymupdf.Rect(xs[0][0], y + 1, xs[0][1] - 2, y + RH - 1), "סה״כ", size=6.2, face="M")
    prem = xs[7]
    d.field(
        pymupdf.Rect(prem[0] + 1, y + 1.3, prem[1] - 1, y + RH - 1.3),
        name=f"{prefix}_total",
        size=6.5,
    )
    d.y = y + RH + 5


BEFORE = [
    (
        "בריאות",
        [
            ("surg_il", "ניתוחים ומחליפי ניתוח בישראל", False),
            ("surg_shaban", "ניתוחים ומחליפי ניתוח משלים שב״ן", False),
            ("surg_abr", "ניתוחים ומחליפי ניתוח בחו״ל", False),
            ("transplant", "השתלות וטיפולים מיוחדים בחו״ל", False),
            ("drugs", "תרופות שלא בסל", False),
            ("drugs_ext", "הרחבה לתרופות", False),
            ("amb", "אמבולטורי", False),
            ("child", "התפתחות הילד", False),
            ("fast", "אבחון מהיר", False),
            ("comp", "רפואה משלימה", False),
            ("other_h", "אחר", False),
        ],
    ),
    (
        "כיסויים נוספים",
        [
            ("pa", "תאונות אישיות", True),
            ("ltc", "סיעוד", True),
            ("ci", "מחלות קשות", True),
            ("cancer", "סרטן", True),
            ("life", "חיים", True),
            ("mort", "משכנתא", True),
            ("dis", "נכות מתאונה", True),
            ("o1", "אחר", True),
            ("o2", "אחר", True),
            ("o3", "אחר", True),
        ],
    ),
]

AFTER = [
    (
        "בריאות — הוצאות רפואיות",
        [
            ("surg_il", "ניתוחים ומחליפי ניתוח בישראל", False),
            ("surg_shaban", "ניתוחים ומחליפי ניתוח משלים שב״ן", False),
            ("surg_abr", "ניתוחים ומחליפי ניתוח בחו״ל", False),
            ("transplant", "השתלות וטיפולים מיוחדים בחו״ל", False),
            ("drugs", "תרופות שלא בסל", False),
            ("drugs_ext", "הרחבה לתרופות", False),
            ("amb", "אמבולטורי", False),
            ("child", "התפתחות הילד", False),
            ("fast", "אבחון מהיר", False),
            ("comp", "רפואה משלימה", False),
            ("svc", "כתבי שירות נוספים", False),
            ("other_h", "אחר", False),
            ("med", "הוצאות רפואיות", False),
        ],
    ),
    (
        "מחלות",
        [
            ("ci_pay", "פיצוי מחלות קשות", False),
            ("can_pay", "פיצוי בגין מחלת הסרטן", False),
        ],
    ),
    (
        "ריסק",
        [
            ("death", "ריסק למקרה מוות — משועבד", True),
            ("mort", "ריסק למשכנתא", False),
        ],
    ),
    (
        "אחר",
        [
            ("dis", "נכות מתאונה", False),
            ("other", "אחר", False),
        ],
    ),
]


def coverages(d):
    _matrix(d, "השוואת תיק הביטוח — כיסויים קיימים לפני התאמת צרכים", BEFORE, "before", after=False)
    _matrix(d, "כיסויים קיימים לאחר התאמת צרכים", AFTER, "after", after=True)


def _note(d, text, *, size=6.6):
    d.ensure(28)
    box = pymupdf.Rect(ML, d.y, MR, d.y + 1)
    d.page.insert_htmlbox(
        pymupdf.Rect(ML, d.y, MR, BOT - 8),
        H(text, size=size, align="start", lh=1.28),
        css=CSS,
        archive=ARCH,
    )
    # measure by a second pass is hard; use a fixed estimate from length
    lines = max(2, int(len(text) / 78) + 1)
    h = lines * size * 1.35 + 4
    d.page.draw_rect(pymupdf.Rect(ML, d.y, MR, d.y + h), color=HAIR, width=0.35)
    d.y += h + 4
    return box


def _sig_row(d, items, *, intro: str):
    d.center(intro, size=9.2, face="M", gap=4)
    h = 58.0
    gap = 6.0
    d.ensure(h + 6)
    y = d.y
    w = (d.iw - gap * (len(items) - 1)) / len(items)
    x1 = MR
    for title, side in items:
        x0 = x1 - w
        d.page.draw_rect(pymupdf.Rect(x0, y, x1, y + h), color=INK, width=0.45)
        d.page.draw_rect(pymupdf.Rect(x0, y, x1, y + 2.4), color=YELLOW, fill=YELLOW, width=0)
        d.page.draw_rect(pymupdf.Rect(x1 - 14, y, x1, y + 2.4), color=RED, fill=RED, width=0)
        _html(d.page, pymupdf.Rect(x0 + 2, y + 5, x1 - 2, y + 16), title, size=5.8, face="M")
        d.page.draw_line(pymupdf.Point(x0 + 6, y + 32), pymupdf.Point(x1 - 6, y + 32), color=INK, width=0.45)
        _html(d.page, pymupdf.Rect(x0, y + 33, x1, y + 42), "חתימה", size=5.6, color=MUTED_HEX)
        d.page.draw_line(pymupdf.Point(x0 + 6, y + 50), pymupdf.Point(x1 - 6, y + 50), color=INK, width=0.4)
        _html(d.page, pymupdf.Rect(x0, y + 50, x1, y + 58), "תאריך", size=5.6, color=MUTED_HEX)
        d.field(pymupdf.Rect(x0 + 4, y + 18, x1 - 4, y + 31), name=f"sig_{side}")
        d.field(pymupdf.Rect(x0 + 4, y + 40, x1 - 4, y + 49), name=f"sig_{side}_date")
        x1 = x0 - gap
    d.y = y + h + 6


def meeting(d):
    if d.y > 640:
        d.new_page()
    _bar(d, "סיכום פגישה והמלצות")
    d.y += 3
    d.flag(
        [
            ("מינוי סוכן על פוליסות קיימות", "MeetAppoint"),
            ("המשך הפוליסות הקיימות ללא שינוי", "MeetKeep"),
            ("החלפת הכיסוי הקיים בכיסוי חדש", "MeetReplace"),
            ("הקמת פוליסה חדשה / הוספת כיסוי או כתב שירות", "MeetNew"),
        ]
    )
    d.line_field("שיקולים עיקריים להמלצות", name="MeetReasons")
    d.fields_row(["תחילת הביטוח", "תום ביטוח"], names=["MeetStart", "MeetEnd"])
    d.line_field("הערות", name="MeetNotes")

    _bar(d, "אופן קבלת מידע על ביטוחים קיימים")
    d.y += 2
    d.p("במסגרת בירור הצרכים נבחנו הביטוחים הקיימים שברשות המועמד/ים לביטוח. יש לסמן X אם רלוונטי.", size=7.2, gap=3)
    widths = [269, 70, 70, 70]
    xs = _rtl_cols(widths)
    y = _head_row(d, xs, ["אופן קבלת המידע", "ראשי", "בן/בת זוג", "ילדים"], d.y, 13)
    sources = [
        ("har", "הר הביטוח"),
        ("pol", "פוליסה מהלקוח"),
        ("web", "אתר האינטרנט של חברת הביטוח"),
        ("other", "אחר — פירוט"),
    ]
    for key, lab in sources:
        for x0, x1 in xs:
            _cell(d.page, x0, y, x1, y + RH)
        _html(d.page, pymupdf.Rect(xs[0][0] + 3, y + 1, xs[0][1] - 2, y + RH - 1), lab, size=6.2, face="M", align="start")
        for i, who in enumerate(("main", "spouse", "child")):
            x0, x1 = xs[1 + i]
            _chk(d, (x0 + x1) / 2 - 3, y + 2.8, f"src_{key}_{who}", 6.2)
        y += RH
    d.y = y + 3
    d.flag(
        [
            ("מהבדיקה בהר הביטוח אין ללקוח כיסויים קיימים", "HarNone"),
            ("מהבדיקה בהר הביטוח יש ללקוח כיסויים קיימים", "HarSome"),
            ("בוצע שיווק יזום — כן", "ActiveYes"),
            ("בוצע שיווק יזום — לא", "ActiveNo"),
        ]
    )
    d.p(
        "אם הפוליסה המוצעת תיכנס לתוקף לפני שהפוליסה הקיימת תבוטל, או לפני שהכיסוי הקיים יוחלף, "
        "עלול להיווצר כפל ביטוח. יש לוודא שהביטול או ההחלפה יושלמו, ושהלקוח אינו משלם לחברה הקודמת. "
        "חובת המעקב היא על הסוכן ועל הלקוח מול חברת הביטוח הקודמת.",
        size=7.0,
        gap=4,
    )

    _bar(d, "החלטות ונימוקים לביצוע החלפה")
    d.y += 2
    d.flag(
        [
            ("לבטל", "DecCancel"),
            ("להחליף", "DecReplace"),
            ("להקטין", "DecReduce"),
            ("ללא ביטול", "DecKeep"),
        ]
    )
    d.line_field("השינויים המבוקשים בפוליסה", name="DecChanges")
    d.p("כיצד יש לבצע את הביטול?", size=8.0, face="M", gap=2)
    d.flag(
        [
            ("על ידי חברת הביטוח החדשה", "CancelByNew"),
            ("על ידי הסוכן", "CancelByAgent"),
            ("על ידי הלקוח", "CancelByClient"),
        ]
    )
    d.p(
        "במידה והביטול מתבצע באמצעות חברת הביטוח או הסוכן, דע לך כי חברת הביטוח או הסוכן ישלחו את מסמך הביטול "
        "מיד לאחר כריתת החוזה החדש אל חברת הביטוח הקודמת. עליך לעקוב מול חברת הביטוח הקודמת כי אכן בוצע ביטול "
        "של הפוליסה, ואינך משלם לחברה הקודמת.",
        size=7.0,
        gap=4,
    )

    _bar(d, "המלצות לביצוע החלפה בפוליסות הקיימות")
    widths = [109, 70, 70, 70, 70, 90]
    xs = _rtl_cols(widths)
    y = _head_row(
        d,
        xs,
        ["סוג הפוליסה", "חברת ביטוח", "סכום פיצוי", "פרמיה קיימת", "פרמיה מוצעת", "הערות / תוספות / החרגות"],
        d.y,
        14,
    )
    for i in range(1, 5):
        for x0, x1 in xs:
            _cell(d.page, x0, y, x1, y + RH)
            d.field(pymupdf.Rect(x0 + 1, y + 1.2, x1 - 1, y + RH - 1.2), name=f"swap_{i}_{int(x0)}", size=6)
        y += RH
    d.y = y + 3
    d.named_memo("יתרונות הפוליסה המוצעת מול הפוליסה הקיימת", 1, "SwapPros", size=8)
    d.named_memo("חסרונות הפוליסה המוצעת מול הפוליסה הקיימת", 1, "SwapCons", size=8)
    d.p(
        "מרכז פעילות הסוכנות בתחום ביטוח הפרט הינו עם חברות הביטוח המפורטות בטופס זה. "
        "בענף ביטוח החיים קיימות 9 חברות המשווקות ביטוח חיים, בענף ביטוח הבריאות קיימות 10 חברות, "
        "ובענף תאונות אישיות קיימות 3 חברות. הוסבר ללקוח כי קיימות חברות נוספות בשוק.",
        size=7.0,
        gap=4,
    )
    d.line_field("חברות שמהן עיקר הפעילות", name="CoreInsurers")
    _sig_row(
        d,
        [
            ("חתימת מועמד ראשי", "client"),
            ("חתימת בן/בת הזוג", "spouse"),
            ("חתימת ילד מגיל 18", "child18_1"),
            ("חתימת ילד מגיל 18", "child18_2"),
            ("חתימת הסוכן", "agent"),
        ],
        intro="חתימות על סיכום הפגישה",
    )


def authorizations(d):
    if d.y > 430:
        d.new_page()
    _bar(d, "נספח ה׳ — הרשאת שימוש פרטנית לשימוש באתר הר הביטוח")
    d.y += 3
    d.p("א.ג.נ.", size=8, face="M", gap=2)
    d.p("1. אנו המועמדים לביטוח מייפים את כוח הסוכנות לבצע חיפוש על שמנו ועל שם ילדינו הקטינים באתר הר הביטוח.", size=7.4, gap=2)
    d.fields_row(["שם המועמד", "ת.ז.", "שם בן/בת הזוג", "ת.ז."], names=["AuthName1", "AuthId1", "AuthName2", "AuthId2"])
    d.line_field("מיופה הכוח", name="AuthAgent")
    d.p("2. טופס הרשאה זה יעמוד בתוקף לחמישה ימי עבודה.", size=7.4, gap=3)
    d.fields_row(["תאריך", "חתימת המבוטח"], names=["AuthDate1", "AuthSign1"])
    d.fields_row(["תאריך", "חתימת בן/בת הזוג"], names=["AuthDate2", "AuthSign2"])
    d.fields_row(["תאריך", "חתימת ילד בגיר"], names=["AuthDateChild", "AuthSignChild"])
    d.p("אני מתחייב: לעשות שימוש בנתונים שנמסרו לי בהתאם להרשאה זו בלבד, ולא להחזיק בהם ולא לעשות בהם שימוש לאחר שיפוג תוקפה.", size=7.4, gap=3)
    d.fields_row(["שם בעל הרישיון", "מספר רישיון / ח.פ."], names=["AuthLicName", "AuthLicNo"])
    d.fields_row(["תאריך", "חתימת הגורם המשווק"], names=["AuthLicDate", "AuthLicSign"])

    _bar(d, "אישור קבלת גילוי נאות")
    d.y += 3
    d.line_field("עבור", name="DiscFor")
    d.p("הנדון: אישור קבלה וקריאה. אני מאשר כי קיבלתי וקראתי את המסמכים המצורפים למסמך הזה.", size=7.4, gap=3)
    d.fields_row(["שם", "ת.ז.", "חתימה"], names=["DiscName1", "DiscId1", "DiscSign1"])
    d.fields_row(["שם", "ת.ז.", "חתימה"], names=["DiscName2", "DiscId2", "DiscSign2"])

    _bar(d, "הצהרות המועמד לביטוח")
    d.y += 2
    d.p(
        "1. הצהרה בדבר קיומה של פוליסת פיצוי אשר מבטחת מקרה ביטוח דומה. ידוע לי כי במועד החתימה עשויה להיות קיימת עבורי "
        "פוליסה אחרת המעניקה פיצוי למקרה דומה, ואני מאשר שהצירוף הוא לפוליסה נוספת, או שבכוונתי לבטל את הקיימת.",
        size=7.2,
        gap=3,
    )
    d.flag([("פוליסה נוספת למקרה דומה", "DupKeep"), ("בכוונתי לבטל פוליסה קיימת", "DupCancel")])
    d.p(
        "2. אני מאשר כי בוצעה התאמה למפורט בטופס זה, ונמסר לי עותק של טופס זה ושל עיקרי הכיסוי בכיסויים שהוצעו לי.",
        size=7.2,
        gap=3,
    )


def declarations(d):
    if d.y > 560:
        d.new_page()
    _bar(d, "ח. הצהרת המבוטח")
    d.y += 2
    paragraphs = [
        "1. במסגרת תהליך המכירה נעשה בירור צרכים והוצע ביטוח התואם את הצרכים. נמסר מידע מהותי, לרבות עיקרי הכיסוי, הפרמיה ותקופת הביטוח, סכומי ביטוח וגבולות אחריות, אמצעי תשלום, תנאי התשלום ומועדי הגבייה. המידע נמסר בדוא״ל, בקישור או במסרון.",
        "2. המבטח לא יהיה אחראי לתביעה בגין מקרה שאירע לפני תחילת הביטוח או במהלך תקופת אכשרה. אישור ההצעה או דחייתה נתון לשיקול דעת המבטח, בכפוף לדין.",
        "3. ככל שהפוליסה כוללת תקופת אכשרה, המתנה, החרגות, מצב רפואי קודם או השתתפות עצמית — נמסר על כך מידע. אני מתחייב לדווח על כל שינוי במצב הרפואי מיום הצהרת הבריאות ועד לאישור הקבלה לביטוח. התשובות מלאות, נכונות וכנות, ולא הוסתר דבר העלול להשפיע על קבלת ההצעה.",
        "4. תאריך תחילת הביטוח הוא המועד בדף פרטי הביטוח. ניתן לבטל כל תכנית בכל עת בהודעה בכתב. ביטול תכנית יסודית אחת עשוי לבטל הנחה שניתנה בתכנית אחרת.",
        "5. המידע שמסרתי הכרחי לצירוף לפוליסה וישמש את חברת הביטוח ומי מטעמה למטרות לגיטימיות הקשורות בפוליסה. התנאים המלאים הם המחייבים, ועליי לעיין בפוליסה.",
        "6. המידע נמסר מרצוני ובהסכמתי, יישמר במאגרי חברות הביטוח וסוכנות הביטוח, וישמש למתן שירות ולקיום חובות על פי דין. אני מאשר פנייה להצעת מוצרים ושירותים, לרבות בדוא״ל או במסרון.",
        "7. אם קיימים ילדים קטינים בפוליסה, הסכמתי והצהרתי, כולל הצהרת הבריאות, חלות גם עליהם.",
        "8. בחתימתי אני מאשר שאינני מעוניין שהנתונים על מוצרי הביטוח שלי יועברו לרשות שוק ההון. ידוע לי שאי־העברה תמנע ממני לראותם באתר הר הביטוח.",
        "9. נמסרו לי כל הפרטים על ידי סוכנות הביטוח, ובחתימתי אני מאשר את רכישת הפוליסה.",
    ]
    for text in paragraphs:
        d.p(text, size=6.6, gap=1.6)

    _bar(d, "הצהרת הסוכן")
    d.y += 2
    d.p("1. יידעתי את המועמד על חברות הביטוח שמהן עיקר העמלות שלי, ועל מספר החברות המשווקות את המוצר, לפי חוזר צירוף לביטוח.", size=7.2, gap=2)
    d.p("2. הליך הצירוף, לרבות התאמת הצרכים, אינו מותנה בכך שאמשיך להיות הסוכן למשך תקופה קצובה או שאינה קצובה.", size=7.2, gap=2)
    d.p("3. בוצעה התאמה: נבחנו הכיסויים הקיימים, נערכו סקירה והשוואה לכיסויים המוצעים, לפי מאפייני המועמד, גילו ושפתו.", size=7.2, gap=2)
    d.p("4. הוצגו בפני המועמד תהליך התאמת הצרכים וההבדלים בין הפוליסות שהוצעו.", size=7.2, gap=3)
    d.fields_row(
        ["שם הסוכן", "מספר סוכן", "חתימה", "מספר רישיון"],
        names=["AgentDeclName", "AgentNumber", "AgentDeclSign", "AgentDeclLic"],
    )


def customer_sheet(d):
    if d.y > 620:
        d.new_page()
    _bar(d, "תשלום ושעבוד")
    d.y += 3
    d.fields_row(
        ["תאריך מכירה", "תאריך הפקה", "מנהל תיק לקוח", "מספר סוכן"],
        names=["CustSaleDate", "CustProdDate", "CustManager", "SaleAgentNumber"],
    )
    d.p("אמצעי תשלום", size=8.2, face="M", gap=2)
    d.flag([("כרטיס אשראי", "PayCreditCard"), ("הוראת קבע", "PayStandingOrder")])
    d.flag([("נפתחה הרשאה — כן", "AuthOpenYes"), ("נפתחה הרשאה — לא", "AuthOpenNo")])
    d.credit_card_box()
    d.p("שעבוד", size=8.2, face="M", gap=2)
    d.flag([("יש שעבוד", "PledgeYes"), ("אין שעבוד", "PledgeNo")])
    d.fields_row(
        ["בנק", "סניף", "מספר הלוואה", "סכום משועבד"],
        names=["PledgeBank", "PledgeBranch", "PledgeLoan", "PledgeAmount"],
    )
    d.fields_row(["לכמה שנים משועבד"], names=["PledgeYears"])


def compose(d):
    candidate_table(d)
    extra_details(d)
    coverages(d)
    meeting(d)
    authorizations(d)
    declarations(d)
    customer_sheet(d)
    d.discount_rubrics()
