# -*- coding: utf-8 -*-
"""Liba legal-contract PDFs — Rubik, letterhead, RTL, not a quotation form."""
from __future__ import annotations

import html as htmlmod
import shutil
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
LOGO = ROOT / "public" / "brand" / "liba-logo.png"
DOWNLOADS = Path(r"C:\Users\Beo-syestems\Downloads\ליבה-מסמכים-2026-09")

A4W, A4H = 595.28, 841.89
ML, MR = 58.0, 537.0
BOT = 792.0

INK = (0.067, 0.067, 0.067)
YELLOW = (1.0, 0.831, 0.0)
RED = (0.769, 0.118, 0.227)
HAIR = (0.62, 0.62, 0.62)
INK_HEX = "#111111"
MUTED_HEX = "#5A5A5A"
RED_HEX = "#C41E3A"

ARCH = pymupdf.Archive(str(FONTS))
FONT_M = pymupdf.Font(fontfile=str(FONTS / "Rubik-Medium.ttf"))
FONT_R = pymupdf.Font(fontfile=str(FONTS / "Rubik-Regular.ttf"))
CSS = """
@font-face {font-family: R; src: url("Rubik-Regular.ttf");}
@font-face {font-family: M; src: url("Rubik-Medium.ttf");}
@font-face {font-family: B; src: url("Rubik-Bold.ttf");}
html, body { font-family: R; direction: rtl; margin: 0; padding: 0; text-align: start; }
p { margin: 0; padding: 0; text-align: start; }
"""


def esc(t: str) -> str:
    return htmlmod.escape(t, quote=True)


def tw(text: str, size: float, *, medium=True) -> float:
    font = FONT_M if medium else FONT_R
    try:
        return float(font.text_length(text, fontsize=size))
    except Exception:
        return len(text) * size * 0.56


def H(text: str, *, size=10.4, face="R", color=INK_HEX, align="start", lh=1.48) -> str:
    return (
        f'<p style="font-family:{face};font-size:{size}pt;color:{color};margin:0;padding:0;'
        f'line-height:{lh};direction:rtl;text-align:{align};">{esc(text)}</p>'
    )


class Deed:
    def __init__(self, title: str, subtitle: str):
        self.title = title
        self.subtitle = subtitle
        self.doc = pymupdf.open()
        self.page = None
        self.y = 0.0
        self.n = 0
        self.first = True
        self.new_page()

    @property
    def iw(self) -> float:
        return MR - ML

    def new_page(self):
        self.page = self.doc.new_page(width=A4W, height=A4H)
        self._letterhead()
        self.y = 126.0 if self.first else 70.0
        self.first = False

    def ensure(self, h: float):
        if self.y + h > BOT:
            self.new_page()

    def _rules(self, y: float, *, thick=False):
        p = self.page
        p.draw_line(pymupdf.Point(ML, y), pymupdf.Point(MR, y), color=INK, width=0.7 if thick else 0.45)
        p.draw_line(pymupdf.Point(ML, y + 3.2), pymupdf.Point(MR, y + 3.2), color=YELLOW, width=2.2 if thick else 1.5)
        p.draw_line(pymupdf.Point(MR - 36, y + 3.2), pymupdf.Point(MR, y + 3.2), color=RED, width=2.2 if thick else 1.5)

    def _letterhead(self):
        p = self.page
        if self.first:
            lw, lh = 148.0, 64.0
            x0 = (A4W - lw) / 2
            p.insert_image(pymupdf.Rect(x0, 14, x0 + lw, 14 + lh), filename=str(LOGO), keep_proportion=True)
            p.insert_htmlbox(
                pymupdf.Rect(ML, 78, MR, 112),
                H("\u200fליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ", size=9.4, face="M", align="center", lh=1.2)
                + H("\u200fח.פ. 517024733  ·  רישיון תאגידי 51024733  ·  תחום פנסיוני  ·  בתוקף עד 31/12/2026", size=7.3, color=MUTED_HEX, align="center", lh=1.25)
                + H("\u200fחרושת 10, קריית ביאליק 2641417", size=7.3, color=MUTED_HEX, align="center", lh=1.2),
                css=CSS,
                archive=ARCH,
            )
            self._rules(114.0, thick=True)
        else:
            p.insert_htmlbox(
                pymupdf.Rect(ML, 26, MR, 46),
                H("\u200fליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ  ·  ח.פ. 517024733  ·  רישיון 51024733", size=7.6, face="M", align="center", lh=1.15),
                css=CSS,
                archive=ARCH,
            )
            self._rules(50.0, thick=False)
        p.draw_line(pymupdf.Point(ML, A4H - 36), pymupdf.Point(MR, A4H - 36), color=INK, width=0.4)

    def finish(self, path: Path) -> Path:
        n = self.doc.page_count
        for i, page in enumerate(self.doc, 1):
            page.insert_htmlbox(
                pymupdf.Rect(ML, A4H - 32, MR, A4H - 14),
                H(
                    f"{self.title}     ·     עמוד {i} מתוך {n}     ·     ליבה ג.א. סוכנות לביטוח פנסיוני",
                    size=7,
                    color=MUTED_HEX,
                    align="center",
                    lh=1.15,
                ),
                css=CSS,
                archive=ARCH,
            )
        self.doc.need_appearances = True
        self.doc.save(path, deflate=True, deflate_fonts=True, garbage=4, clean=True)
        self.doc.close()
        return path

    def _box(self, html: str, width: float | None = None) -> float:
        w = self.iw if width is None else width
        hi = 18.0
        more = 1
        while more and hi < 900:
            st = pymupdf.Story(html=html, user_css=CSS, archive=ARCH)
            more, _ = st.place(pymupdf.Rect(0, 0, w, hi))
            if more:
                hi *= 1.45
        lo = 8.0
        for _ in range(11):
            mid = (lo + hi) / 2
            st = pymupdf.Story(html=html, user_css=CSS, archive=ARCH)
            more, _ = st.place(pymupdf.Rect(0, 0, w, mid))
            if more:
                lo = mid
            else:
                hi = mid
        return max(11.0, hi + 0.6)

    def put(self, html: str, *, width: float | None = None, x0: float | None = None, gap=5.0) -> pymupdf.Rect:
        w = self.iw if width is None else width
        h = self._box(html, w)
        self.ensure(h + 2)
        x = ML if x0 is None else x0
        r = pymupdf.Rect(x, self.y, x + w, self.y + h)
        self.page.insert_htmlbox(r, html, css=CSS, archive=ARCH)
        self.y += h + gap
        return r

    def title_block(self):
        self.put(H(self.title, size=19, face="B", align="center", lh=1.15), gap=4)
        self.put(H(self.subtitle, size=9.3, face="M", color=MUTED_HEX, align="center", lh=1.3), gap=6)
        mid = (ML + MR) / 2
        self.page.draw_line(pymupdf.Point(mid - 46, self.y), pymupdf.Point(mid + 46, self.y), color=YELLOW, width=1.3)
        self.page.draw_line(pymupdf.Point(mid + 28, self.y), pymupdf.Point(mid + 46, self.y), color=RED, width=1.3)
        self.y += 14

    def article(self, text: str):
        self.ensure(96)
        self.y += 11
        h = 16.0
        self.page.draw_rect(
            pymupdf.Rect(MR - 2.4, self.y + 1, MR, self.y + h - 1),
            color=RED,
            fill=RED,
            width=0,
        )
        self.page.insert_htmlbox(
            pymupdf.Rect(ML, self.y, MR - 8, self.y + h),
            H(text, size=11.8, face="B", align="start", lh=1.15),
            css=CSS,
            archive=ARCH,
        )
        yline = self.y + h + 2
        self.page.draw_line(pymupdf.Point(ML, yline), pymupdf.Point(MR, yline), color=INK, width=0.4)
        self.page.draw_line(pymupdf.Point(MR - 70, yline), pymupdf.Point(MR, yline), color=YELLOW, width=1.35)
        self.y = yline + 8

    def p(self, text: str, *, size=10.25, face="R", gap=5.5, bold=False):
        self.put(H(text, size=size, face="B" if bold else face, align="justify", lh=1.52), gap=gap)

    def center(self, text: str, *, size=10.5, face="M", gap=8.0):
        self.put(H(text, size=size, face=face, align="center", lh=1.4), gap=gap)

    def _fid(self, prefix="f") -> str:
        self.n += 1
        return f"{prefix}{self.n:03d}"

    def field(self, rect: pymupdf.Rect, *, multi=False, name: str | None = None):
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
        w.field_name = name or self._fid()
        w.rect = rect
        w.text_fontsize = 10
        w.text_color = INK
        w.fill_color = None
        w.border_width = 0
        w.field_flags = 4096 if multi else 0
        self.page.add_widget(w)

    def chk(self, x: float, y: float, *, name: str | None = None):
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
        w.field_name = name or self._fid("c")
        w.rect = pymupdf.Rect(x, y, x + 10, y + 10)
        w.border_color = INK
        w.border_width = 0.75
        w.fill_color = (1, 1, 1)
        self.page.add_widget(w)

    def line_field(self, label: str, *, extra=False, name: str | None = None):
        lab = label.rstrip(":").strip() + ":"
        size = 9.4
        label_w = tw(lab, size) + 10
        if label_w + 90 > self.iw:
            self.ensure(34)
            self.page.insert_htmlbox(
                pymupdf.Rect(ML, self.y, MR, self.y + 13),
                H(lab, size=9.2, face="M", align="start", lh=1.15),
                css=CSS,
                archive=ARCH,
            )
            yline = self.y + 28
            self.page.draw_line(pymupdf.Point(ML, yline), pymupdf.Point(MR, yline), color=INK, width=0.5)
            self.field(pymupdf.Rect(ML, self.y + 14, MR, yline - 0.4), name=name)
            self.y = yline + 5
            return
        h = 18.0
        self.ensure(h)
        self.page.insert_htmlbox(
            pymupdf.Rect(MR - label_w, self.y, MR, self.y + h - 2),
            H(lab, size=size, face="M", align="start", lh=1.15),
            css=CSS,
            archive=ARCH,
        )
        x1 = MR - label_w - 5
        yline = self.y + h - 4.5
        self.page.draw_line(pymupdf.Point(ML, yline), pymupdf.Point(x1, yline), color=INK, width=0.5)
        self.field(pymupdf.Rect(ML, self.y + 2, x1, yline - 0.3), name=name)
        self.y += h

    def fields_row(self, labels: list[str], names: list[str] | None = None):
        n = len(labels)
        gap = 14.0
        col = (self.iw - gap * (n - 1)) / n
        h = 18.0
        self.ensure(h + 2)
        x = MR
        for i, lab in enumerate(labels):
            text = lab.rstrip(":").strip() + ":"
            lw = min(tw(text, 8.4) + 8, col * 0.58)
            x0 = x - col
            self.page.insert_htmlbox(
                pymupdf.Rect(x - lw, self.y, x, self.y + h - 2),
                H(text, size=8.4, face="M", align="start", lh=1.15),
                css=CSS,
                archive=ARCH,
            )
            yline = self.y + h - 4.5
            self.page.draw_line(pymupdf.Point(x0, yline), pymupdf.Point(x - lw - 4, yline), color=INK, width=0.5)
            fname = names[i] if names and i < len(names) else None
            self.field(pymupdf.Rect(x0, self.y + 2, x - lw - 4, yline - 0.3), name=fname)
            x = x0 - gap
        self.y += h + 6

    def memo(self, label: str, lines=3):
        if label:
            self.p(label.rstrip(":") + ":", size=9.3, face="M", gap=2)
        h = 15.0 * lines
        self.ensure(h + 4)
        r = pymupdf.Rect(ML, self.y, MR, self.y + h)
        for i in range(lines):
            yy = self.y + 13 + i * 15
            self.page.draw_line(pymupdf.Point(ML, yy), pymupdf.Point(MR, yy), color=HAIR, width=0.35)
        self.field(r, multi=True)
        self.y += h + 8

    def checks(self, items: list[str], *, extra=False):
        for it in items:
            html = H(it, size=9.8, align="start", lh=1.28)
            h = max(16.0, self._box(html, self.iw - (92 if extra else 22)))
            self.ensure(h + 2)
            self.chk(MR - 11, self.y + 2.5)
            self.page.insert_htmlbox(
                pymupdf.Rect(ML + (68 if extra else 0), self.y, MR - 16, self.y + h),
                html,
                css=CSS,
                archive=ARCH,
            )
            if extra:
                yline = self.y + 12
                self.page.draw_line(pymupdf.Point(ML, yline), pymupdf.Point(ML + 54, yline), color=INK, width=0.45)
                self.field(pymupdf.Rect(ML, self.y + 1, ML + 54, yline - 0.3))
            self.y += h + 2
        self.y += 5

    def nums(self, items: list[str]):
        for i, it in enumerate(items, 1):
            html = H(it, size=10.15, align="justify", lh=1.48)
            h = self._box(html, self.iw - 24)
            self.ensure(h + 3)
            self.page.insert_htmlbox(
                pymupdf.Rect(MR - 20, self.y, MR, self.y + 13),
                H(f"{i}.", size=10, face="B", align="start", lh=1.1),
                css=CSS,
                archive=ARCH,
            )
            self.page.insert_htmlbox(
                pymupdf.Rect(ML, self.y, MR - 22, self.y + h),
                html,
                css=CSS,
                archive=ARCH,
            )
            self.y += h + 6
        self.y += 3

    def table(self, headers: list[str], rows: list[list[str]], *, fill_cols: set[int] | None = None, check_col: int | None = None):
        fill_cols = fill_cols or set()
        n = len(headers)
        usable = self.iw
        if n == 2:
            widths = [usable * 0.86, usable * 0.14] if check_col == 1 else [usable * 0.40, usable * 0.60]
        elif n == 3:
            widths = (
                [usable * 0.28, usable * 0.58, usable * 0.14]
                if check_col == 2
                else [usable * 0.34, usable * 0.28, usable * 0.38]
            )
        elif n == 4:
            widths = (
                [usable * 0.09, usable * 0.34, usable * 0.22, usable * 0.35]
                if check_col == 0
                else [usable * 0.26, usable * 0.22, usable * 0.22, usable * 0.30]
            )
        else:
            widths = [usable / n] * n

        def rh(cells: list[str]) -> float:
            m = 16.0
            for ci, txt in enumerate(cells):
                if not txt:
                    continue
                hh = self._box(H(txt, size=8, align="start", lh=1.22), max(32, widths[ci] - 8))
                m = max(m, hh + 6)
            return min(m, 36)

        hh = 17.0
        body_hs = [rh(r) for r in rows]
        if self.y + hh + 22 > BOT:
            self.new_page()

        def draw(y, h, cells, header=False, ri=0):
            x = MR
            for ci, txt in enumerate(cells):
                w = widths[ci]
                x0 = x - w
                cell = pymupdf.Rect(x0, y, x, y + h)
                if header:
                    self.page.draw_rect(cell, color=INK, fill=INK, width=0)
                    self.page.insert_htmlbox(
                        pymupdf.Rect(x0 + 3, y + 2, x - 3, y + h - 1),
                        H(txt, size=7.6, face="M", color="#ffffff", align="start", lh=1.15),
                        css=CSS,
                        archive=ARCH,
                    )
                else:
                    if ri % 2:
                        self.page.draw_rect(cell, color=(1, 1, 1), fill=(0.975, 0.975, 0.97), width=0)
                    self.page.draw_rect(cell, color=HAIR, width=0.3)
                    inner = pymupdf.Rect(x0 + 3, y + 1.5, x - 3, y + h - 1.5)
                    if check_col is not None and ci == check_col:
                        self.chk(x0 + w / 2 - 5, y + h / 2 - 5)
                    elif ci in fill_cols and not txt:
                        self.page.draw_line(pymupdf.Point(x0 + 5, y + h - 4.5), pymupdf.Point(x - 5, y + h - 4.5), color=INK, width=0.35)
                        self.field(inner)
                    else:
                        self.page.insert_htmlbox(inner, H(txt, size=7.9, align="start", lh=1.2), css=CSS, archive=ARCH)
                x = x0
            return y + h

        y = draw(self.y, hh, headers, header=True)
        self.y = y
        for ri, row in enumerate(rows):
            h = body_hs[ri]
            if self.y + h > BOT:
                self.new_page()
                y = draw(self.y, hh, headers, header=True)
                self.y = y
            self.y = draw(self.y, h, row, header=False, ri=ri)
        self.y += 8

    def sig(self, right: str, left: str):
        self.center("ולראיה באו הצדדים על החתום:", size=10.6, face="M", gap=8)
        self.ensure(102)
        gap = 22
        w = (self.iw - gap) / 2
        pairs = [(MR - w, MR, right, "client"), (ML, ML + w, left, "liba")]
        h = 96
        for x0, x1, title, side in pairs:
            box = pymupdf.Rect(x0, self.y, x1, self.y + h)
            self.page.draw_rect(box, color=INK, width=0.45)
            self.page.draw_rect(pymupdf.Rect(x0, self.y, x1, self.y + 3.0), color=YELLOW, fill=YELLOW, width=0)
            self.page.draw_rect(pymupdf.Rect(x1 - 28, self.y, x1, self.y + 3.0), color=RED, fill=RED, width=0)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0 + 6, self.y + 8, x1 - 6, self.y + 24),
                H(title, size=8.4, face="M", align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.page.draw_line(pymupdf.Point(x0 + 14, self.y + 50), pymupdf.Point(x1 - 14, self.y + 50), color=INK, width=0.55)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0, self.y + 52, x1, self.y + 64),
                H("חתימה", size=7.1, color=MUTED_HEX, align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.page.draw_line(pymupdf.Point(x0 + 14, self.y + 80), pymupdf.Point(x1 - 14, self.y + 80), color=INK, width=0.45)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0, self.y + 82, x1, self.y + 93),
                H("תאריך", size=7.1, color=MUTED_HEX, align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.field(pymupdf.Rect(x0 + 16, self.y + 32, x1 - 16, self.y + 49), name=f"sig_{side}")
            self.field(pymupdf.Rect(x0 + 16, self.y + 66, x1 - 16, self.y + 79), name=f"sig_{side}_date")
        self.y += h + 8


def meta(d: Deed):
    d.fields_row(
        ["מספר תיק", "תאריך", "בעל רישיון יחיד"],
        names=["file_number", "header_date", "license_holder"],
    )


def build_hanmaka() -> Path:
    d = Deed("מסמך הנמקה", "שיווק פנסיוני ופעולה במוצר פנסיוני  ·  לפי סעיפים 12 עד 13 לחוק הייעוץ הפנסיוני")
    d.title_block()
    meta(d)
    d.p("מסמך זה הוא תנאי סף לכל פעולה במוצר פנסיוני, לרבות משיכה, פדיון, הלוואה, ניוד או איחוד קופות. מסמך הנמקה אינו מכשיר פעולה אסורה, אינו פותר ניגוד עניינים, ואינו מחליף רישום כגורם מטפל.")

    d.article("א. פרטי בעל הרישיון")
    d.p("שם התאגיד: ליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ", face="M")
    d.p("ח.פ. 517024733  ·  רישיון תאגידי 51024733  ·  תחום פנסיוני  ·  בתוקף עד 31/12/2026")
    d.p("כתובת: חרושת 10, קריית ביאליק 2641417")
    d.line_field("שם בעל הרישיון היחיד שביצע את הבירור")
    d.line_field("מספר רישיון יחיד")
    d.line_field("מקום / אמצעי (פרונטלי / זום / שיחה מוקלטת)")
    d.p("רק בעל רישיון יחיד חותם על ההמלצה. עובד תפעול או גורם B2B אינו ממלא המלצה ואינו מסביר ללקוח מה כדאי לעשות.", size=9.4, face="M")

    d.article("ב. פרטי הלקוח")
    for lab in [
        "שם מלא", "ת.ז.", "תאריך לידה / גיל", "מצב משפחתי / תלויים", "כתובת",
        "טלפון / דוא״ל", "מצב תעסוקתי", "מעסיק נוכחי / ותק", "הכנסה חודשית משוערת ברוטו",
        "אזרח ותיק (67+) / עולה חדש / אדם עם מוגבלות",
        "לקוח קיים בליבה בביטוח שאינו פנסיוני — פירוט",
        "האם ליבה רשומה כגורם מטפל במוצר הפנסיוני",
    ]:
        d.line_field(lab)
    d.p("לקוח ביטוח בריאות, ריסק או חיים של ליבה אינו הופך מכך ללקוח פנסיוני. נדרש הליך שיווק פנסיוני נפרד.", size=9.4)

    d.article("ג. סוג ההליך")
    d.checks(
        [
            "שיווק פנסיוני חד־פעמי",
            "שיווק פנסיוני מתמשך — תקופה בחודשים בשדה",
            "הלקוח פנה ביוזמתו ומבקש ביצוע טכני בלבד, כולל חובת בירור והנמקה לפי סעיף 13(א)",
            "ליבה מקבלת תגמול מגוף מוסדי בגין המוצר — פירוט בשדה",
        ],
        extra=True,
    )

    d.article("ד. מטרת הפנייה — בניסוח הלקוח")
    d.memo("הלקוח מתאר את מטרת הפנייה במילותיו:", 4)
    d.p("סיווג הפעולה המבוקשת", face="M", gap=4)
    d.checks(
        [
            "משיכת פיצויים",
            "משיכת תגמולים",
            "משיכה בגיל פרישה / קצבה",
            "משיכה מוקדמת / לפני גיל פרישה",
            "משיכה שלכאורה לפי סעיף 23 לחוק קופות גמל",
            "משיכה שלכאורה בניגוד לסעיף 23 (שלא כדין / מס מלא)",
            "הלוואה מגוף מוסדי כנגד צבירה",
            "ניוד / איחוד קופות",
            "הוצאת מידע / מסלקה בלבד (ללא המלצה)",
            "אחר",
        ]
    )

    d.article("ה. בירור צרכים — סעיף 12")
    d.p("חובה להתאים את השיווק לצרכי הלקוח לאחר בירור מטרות החיסכון, המצב הכספי, החיסכון הקיים ושאר הנסיבות. אם לא נמסר מידע — יירשם במפורש \"לא נמסר\".")
    for lab in [
        "מטרת החיסכון הפנסיוני", "אופק פרישה מתוכנן",
        "קצבה צפויה אחרת / ביטוח לאומי / פנסיה תקציבית",
        "חובות, הלוואות, עיקולים, מזונות", "קרן חירום / נזילות מחוץ לפנסיה",
        "מצב בריאותי רלוונטי לכיסוי נכות ושארים", "תלויים הזקוקים לכיסוי שארים",
        "צורך מיידי בכסף — סכום, מועד, סיבה",
        "חלופת מימון (הלוואה בנקאית, משפחה, מעסיק)",
        "העדפה: קצבה עתידית מול נזילות עכשיו",
        "ידע הלקוח לגבי מס במשיכה שלא כדין",
    ]:
        d.line_field(lab)

    d.article("ו. מצב פנסיוני קיים")
    d.table(
        ["גוף / מוצר", "סוג", "מספר חשבון", "יתרה ₪", "סוג כסף", "כיסוי", "גורם מטפל"],
        [[""] * 7 for _ in range(4)],
        fill_cols=set(range(7)),
    )
    d.line_field("מקור הנתונים (מסלקה ב-SMS / דוח גוף / לקוח)")
    d.line_field("תאריך הנתונים / מידע חסר")

    d.article("ז. בחינה לפי סעיף 23")
    d.checks(
        [
            "המשיכה מותרת לפי הדין — פירוט בשדה",
            "המשיכה אינה עומדת בתנאי סעיף 23 / עלולה להיות שלא כדין — פירוט בשדה",
            "לא ניתן לקבוע ללא נתונים נוספים — חסר בשדה",
        ],
        extra=True,
    )
    d.p("ליבה מיישמת כמדיניות מחייבת את עמדת רשות שוק ההון בחוזר גופים מוסדיים 2025-25 מיום 5.11.2025, סעיף 7ד המוצע.", size=9.5)
    d.nums(
        [
            "משיכה בניגוד לסעיף 23 לא תבוצע כשירות חד־פעמי.",
            "תבוצע רק אם ליבה רשומה בגוף המוסדי כמי שמטפלת במוצר עבור הלקוח.",
            "אם ליבה מקבלת תגמול מהגוף המוסדי — לא ייגבה שכר נוסף מהלקוח בגין פעולת המשיכה (סעיף 19א).",
            "אם ליבה אינה רשומה כגורם מטפל — אין לבצע את המשיכה באמצעות ליבה.",
        ]
    )

    d.article("ח. חלופות שנבחנו")
    d.table(
        ["חלופה", "הוסברה", "מתאימה", "נימוק"],
        [
            ["אי־משיכה / דחייה", "", "", ""],
            ["משיכה חלקית בלבד", "", "", ""],
            ["הלוואה כנגד הצבירה", "", "", ""],
            ["משיכה ממוצר או מסוג כסף אחר", "", "", ""],
            ["מימוש זכות אחרת", "", "", ""],
            ["הלקוח יפעל לבד מול הגוף או המסלקה", "", "", ""],
            ["אחר", "", "", ""],
        ],
        fill_cols={1, 2, 3},
    )

    d.article("ט. השלכות שהוסברו")
    d.table(
        ["נושא", "פירוט", "הלקוח הבין"],
        [
            ["מס תגמולים שלא כדין", "ייתכן 35% או שיעור אחר לפי דין", ""],
            ["מס פיצויים", "ייתכן עד 47% או תיאום מס", ""],
            ["קצבה עתידית", "הקטנה בלתי הפיכה של קצבת זקנה", ""],
            ["כיסוי נכות / שארים", "ייתכן ביטול או הקטנה בקרן פנסיה", ""],
            ["הטבות מס בפרישה", "פגיעה אפשרית בפטורים או בקיבוע זכויות", ""],
            ["עיקול / שעבוד / הלוואה", "עלול לעכב או למנוע משיכה", ""],
            ["ביצוע עצמי", "מסלקה או אתר הגוף המוסדי בחינם או בעלות נמוכה", ""],
        ],
        check_col=2,
    )
    for lab in ["אומדן סכום לפני מס", "אומדן מס", "אומדן נטו", "אומדן פגיעה בקצבה החודשית העתידית"]:
        d.line_field(lab)
    d.p("אומדנים אלה אינם ייעוץ מס ואינם התחייבות. הלקוח רשאי לפנות ליועץ מס או לרואה חשבון.", size=9.3)

    d.article("י. גילוי שכר וניגוד עניינים")
    d.table(
        ["רכיב", "סכום / שיעור", "מתי משולם"],
        [
            ["בירור צרכים ומסמך הנמקה", "", "גם אם ההמלצה היא לא למשוך"],
            ["ליווי ביצוע פעולה", "", "רק אחרי הנמקה ושערים"],
            ["מסלקה / הפקת מידע", "", "רק אם הלקוח בחר שלא לפעול בעצמו"],
            ["תגמול מגוף מוסדי", "", "גילוי מלא"],
        ],
        fill_cols={1},
    )
    d.p("ליבה היא סוכנות ביטוח פנסיוני. קיים ניגוד עניינים מובנה. שכר הבירור נפרד משכר הביצוע. אין שכר הצלחה כאחוז מהסכום שנמשך.")

    d.article("יא. ההמלצה המקצועית — בעל הרישיון בלבד")
    d.checks(
        [
            "איני ממליץ למשוך או לפדות — נימוק בשדה",
            "אני ממליץ לדחות את המשיכה ולבחון חלופה — פירוט בשדה",
            "אני ממליץ על הלוואה במקום משיכה — נימוק בשדה",
            "אני ממליץ על משיכה חלקית בלבד — פירוט בשדה",
            "אני ממליץ על משיכה מותרת לפי דין — נימוק בשדה",
            "איני יכול להמליץ על משיכה בניגוד לסעיף 23, כשירות חד־פעמי, או כשליבה אינה גורם מטפל. הפעולה לא תבוצע באמצעות ליבה.",
            "אחר — פירוט בשדה",
        ],
        extra=True,
    )
    d.memo("נימוק מלא (חובה):", 5)
    d.p("אם ההמלצה היא שלא למשוך והלקוח עומד על ביצוע — בעל הרישיון יחליט בכתב אם ליבה מסרבת, או מבצעת רק לאחר תיעוד שהלקוח פועל בניגוד להמלצה ורק אם הדין והשערים מאפשרים. סירוב לבצע הוא לגיטימי ומגן.", size=9.5)

    d.article("יב. תנאי סף לביצוע")
    d.table(
        ["תנאי", "כן"],
        [
            ["הסכם שיווק פנסיוני חתום, עם פירוט שכר מראש ובכתב", ""],
            ["בירור צרכים מלא", ""],
            ["מסמך הנמקה זה חתום על ידי בעל רישיון יחיד", ""],
            ["שיחה מוקלטת או תיעוד הניתן לאחזור", ""],
            ["ייפוי כוח לפי חוזר ייפוי כוח לבעל רישיון", ""],
            ["הלקוח קיבל העתק לפני הביצוע", ""],
            ["הוסבר שהלקוח יכול לפעול בעצמו", ""],
            ["נבדק רישום כגורם מטפל", ""],
            ["נבדק תגמול מוסדי מול שכר מהלקוח", ""],
            ["למשיכה לפי סעיף 23: אינו חד־פעמי, או שהפעולה נדחתה", ""],
            ["גורם תפעולי לא נתן המלצה ולא בחר מוצר", ""],
            ["המסמכים, ייפוי הכוח, המסלקה וההקלטה מתויקים בכרטיס הלקוח ב-SMS 2010", ""],
            ["מסמך הנמקה אוטומטי ב-SMS, אם הופק, צורף כעזר ואינו מחליף מסמך זה", ""],
        ],
        check_col=1,
    )
    d.p("אם אחד מהתנאים אינו מסומן — אין הגשה לגוף מוסדי.", face="B")

    d.article("יג. הצהרת הלקוח")
    d.nums(
        [
            "קיבלתי הסבר בעל פה ובכתב, והבנתי את ההשלכות על קצבה, כיסוי ביטוחי ומס.",
            "הוסברו לי חלופות, לרבות אפשרות לא למשוך ולבצע פעולות בעצמי בעלות נמוכה או בחינם.",
            "ידוע לי שליבה היא בעלת הרישיון, וכי גורם תפעולי אינו סוכן, אינו יועץ ואינו מחליט עבורי.",
            "ידוע לי שמסמך זה אינו ייעוץ מס ואינו התחייבות לתוצאה.",
            "ידוע לי שזכות הביטול לפי חוק הגנת הצרכן, אם חלה, אינה ניתנת להתנאה.",
        ]
    )
    d.checks(["אני מבקש לבצע את הפעולה בניגוד להמלצה", "איני מבקש לבצע בניגוד להמלצה"])
    d.memo("פירוט:", 2)
    d.article("יד. חתימות")
    d.sig("הלקוח — שם מלא ומספר זהות", "בעל רישיון יחיד מטעם ליבה")
    d.p("עותק יימסר ללקוח בסמוך לחתימה, לרבות בקיט דיגיטלי מ-SMS. המסמך יישמר בכרטיס הלקוח ב-SMS 2010 באופן ניתן לאחזור לפי הדין.", size=8.8)
    return d.finish(HERE / "1-מסמך-הנמקה-ליבה.pdf")


def build_withdrawal() -> Path:
    d = Deed(
        "הסכם שיווק פנסיוני",
        "טיפול בפעולה במוצר פנסיוני — משיכה, פדיון, הלוואה, ניוד ומסלקה  ·  הלקוח מתקשר עם ליבה בלבד",
    )
    d.title_block()
    meta(d)
    d.p("נערך ונחתם בין ליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ, ח.פ. 517024733, רישיון תאגידי 51024733, מרחוב חרושת 10 קריית ביאליק (להלן: \"ליבה\" או \"הסוכנות\"), לבין הלקוח שפרטיו נקובים להלן (להלן: \"הלקוח\").")
    d.line_field("יום, חודש ושנת חתימה", name="agreement_date")
    d.line_field("שם הלקוח", name="client_name")
    d.line_field("מספר זהות", name="client_id")
    d.line_field("כתובת", name="client_address")
    d.line_field("טלפון", name="client_phone")
    d.line_field("טלפון נוסף", name="client_phone2")
    d.line_field("דוא״ל", name="client_email")
    d.p("האמור בהסכם זה בלשון זכר הוא לנוחות בלבד ומתייחס גם לנקבה.", size=9.3)

    d.article("סעיף 1. מבוא ומעמד הצדדים")
    d.nums(
        [
            "ליבה היא סוכנות לביטוח פנסיוני בעלת רישיון. היא הצד היחיד המתקשר עם הלקוח לגבי השירות הפנסיוני נשוא הסכם זה.",
            "הלקוח אינו מתקשר עם גורם תפעולי, אינו מקבל שיווק פנסיוני מגורם שאינו בעל רישיון, ואינו לקוח פנסיוני של חברה שאינה ליבה.",
            "ליבה רשאית להסתייע בגורם תפעולי לפעולות אדמיניסטרטיביות בלבד (איסוף מסמכים, סריקה, הזנת נתונים ומעקב סטטוס), לפי הוראות ליבה. הגורם התפעולי אינו צד להסכם, אינו סוכן, אינו יועץ, אינו ממליץ, אינו בוחר מוצר ואינו מחליט אם למשוך.",
            "עצם היות הלקוח מבוטח בליבה בביטוח בריאות, ריסק או חיים אינה הופכת אותו ללקוח פנסיוני.",
            "חתימה במסרון או בדוא״ל, עם זיהוי החותם, חותמת זמן והעתק ללקוח, דינה כחתימה על הסכם זה. ההעתק שנשלח ללקוח אחרי החתימה הוא העתק כדין.",
            "המבוא מהווה חלק בלתי נפרד מההסכם.",
        ]
    )

    d.article("סעיף 2. מהות ההתקשרות")
    d.nums(
        [
            "ההתקשרות היא שיווק פנסיוני וטיפול בביצוע עסקה במוצר פנסיוני, כחלק מהשיווק ובהמשכו, לפי סעיפים 12 ו־13(א) לחוק הפיקוח על שירותים פיננסיים (ייעוץ, שיווק ומערכת סליקה פנסיוניים), התשס״ה־2005.",
            "ליבה אינה מוכרת \"כסף קל\", אינה משדלת למשיכה, ואינה מתחייבת שתוצאת ההליך תהיה משיכה. תוצאה לגיטימית היא המלצה שלא למשוך, או סירוב של ליבה לבצע.",
            "חוזר סוכנים ויועצים 2018-10-3, כפי שתוקן בחוזר 2022-10-10 סעיף 8ב, אוסר לפרסם שירות משיכת כספים או איתור כספים. הסכם זה אינו עוקף את האיסור.",
            "חלק מהפעולות, לרבות מסלקה, ניתן לבצע ישירות מול הגוף המוסדי או המסלקה ללא תשלום או בעלות נמוכה, והדבר מצוין לפי סעיף 8(ג) לחוזר.",
        ]
    )

    d.article("סעיף 3. השירותים — יסומנו רק מה שהוסכם")
    d.p("סימון אינו התחייבות לבצע משיכה.")
    d.table(
        ["סמן", "שירות", "שכר ₪ לפני מע״מ", "הערות"],
        [
            ["", "בירור צרכים ומסמך הנמקה", "", "חובה. משולם גם אם ההמלצה היא לא למשוך"],
            ["", "הוצאת מסלקה / מידע פנסיוני", "", "ללא המלצות. ניתן לבצע בעצמו"],
            ["", "ליווי הגשת משיכה מותרת לפי דין", "", "רק אחרי הנמקה ושערי סף"],
            ["", "בחינת משיכה מוקדמת / סעיף 23", "", "כפוף לסעיף 7. לא כשירות חד־פעמי אם בניגוד לסעיף 23"],
            ["", "סיוע בהלוואה מגוף מוסדי", "", "שכר הגשה קבוע; יתרה רק אם אושרה ושולמה"],
            ["", "ניוד / איחוד קופות", "", "עסקה במוצר פנסיוני. מחייבת הנמקה"],
            ["", "אחר (פירוט בכתב)", "", "לא ייעוץ משפטי או ייעוץ מס"],
        ],
        check_col=0,
        fill_cols={2},
    )
    d.line_field("אם סומן אחר — פירוט השירות", name="other_service")
    d.line_field("סך כולל של השירותים המסומנים, ₪ לפני מע״מ", name="total_fee")
    d.p("הסכומים שסומנו בסעיף זה יצטברו. מע״מ יתווסף כחוק. לא ייגבה שכר שלא פורט כאן מראש ובכתב.")

    d.article("סעיף 4. תנאים מתלים")
    d.p("ביצוע פעולה מול גוף מוסדי מותנה בכולם יחד:")
    d.nums(
        [
            "חתימת הלקוח על הסכם זה וקבלת העתק טרם מתן השירות (חוזר 2018-10-3 / 2022-10-10, סעיף 8).",
            "הסכמה מראש ובכתב לכל רכיב שכר.",
            "בירור צרכים לפי סעיף 12.",
            "מסמך הנמקה חתום בידי בעל רישיון יחיד מטעם ליבה.",
            "שיחה מוקלטת או תיעוד שיחה הניתן לאחזור, שבה הוסברו חלופות, מס, קצבה וכיסוי.",
            "ייפוי כוח לפי חוזר ייפוי כוח לבעל רישיון.",
            "בדיקת רישום ליבה כגורם מטפל, ותיעוד התוצאה.",
            "בדיקת קיום או היעדר תגמול מגוף מוסדי.",
        ]
    )
    d.line_field("תקופת ייפוי הכוח (חודשים)", name="poa_months")
    d.checks(["שיווק חד־פעמי", "שיווק מתמשך"])
    d.line_field("אם מתמשך — משך התקופה בחודשים", name="ongoing_months")

    d.article("סעיף 5. חלוקת תפקידים")
    d.table(
        ["פעולה", "ליבה / בעל רישיון", "גורם תפעולי", "הערות"],
        [
            ["איסוף, סריקה והזנה", "כן", "כן, לפי הוראה", "בלי פרשנות מקצועית"],
            ["הפקת טיוטת טפסים", "כן", "כן, טכני בלבד", "חתימה ואישור רק בליבה"],
            ["בירור צרכים", "חובה", "אסור", "סעיף 12"],
            ["הנמקה — תוכן והמלצה", "חובה", "אסור (הדפסה בלבד)", ""],
            ["המלצה למשוך או לא למשוך", "חובה אם ניתנת", "אסור", ""],
            ["בחירת מוצר, סוג כסף וסכום", "חובה", "אסור", ""],
            ["שיחה מקצועית עם הלקוח", "חובה", "אסור להסביר מה כדאי", "תיאום פגישה מותר"],
            ["הגשה לגוף מוסדי", "באחריות ליבה", "משלוח טכני לפי הוראה", "רק אחרי אישור בעל רישיון"],
            ["מעקב סטטוס", "כן", "כן", "בלי משא ומתן על תנאי המשיכה"],
            ["תיעוד בתיק הלקוח", "חובה לאשר תוכן מקצועי", "הזנה וסריקה", "המערכת אינה ממליצה"],
        ],
    )

    d.article("סעיף 6. חובות בעל הרישיון")
    d.nums(
        [
            "קדימות ענייני הלקוח, נאמנות, כנות, הגינות, שקיפות, מקצוענות, סודיות וחריצות.",
            "התאמת השיווק לצרכים לפי סעיף 12, גם אם הלקוח פנה ומבקש \"רק לבצע\".",
            "המלצה מקצועית עשויה להיות שלא לבצע משיכה. במקרה כזה ליבה רשאית לסרב להגיש בקשה.",
            "אין במסמך הנמקה כשלעצמו כדי להוכיח שהפעולה מתאימה או כדי לרפא ניגוד עניינים.",
        ]
    )

    d.article("סעיף 7. משיכה לפי סעיף 23 ומשיכה מוקדמת")
    d.p("סעיף זה חל כאשר המשיכה אינה משיכה מותרת רגילה, אלא משיכה מוקדמת, שלא כדין, או העלולה להיכנס להוראות סעיף 23 לחוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה־2005.")
    d.nums(
        [
            "ליבה מיישמת כמדיניות מחייבת את עמדת רשות שוק ההון בחוזר גופים מוסדיים 2025-25 מיום 5.11.2025 (סעיף 7ד המוצע).",
            "משיכה כאמור לא תבוצע כשיווק חד־פעמי.",
            "משיכה כאמור תבוצע רק אם ליבה רשומה בגוף המוסדי כמי שמטפלת במוצר עבור הלקוח.",
            "אם ליבה מקבלת תגמול מהגוף המוסדי — לא ייגבה שכר נוסף מהלקוח בגין פעולת המשיכה.",
            "אם ליבה אינה רשומה כגורם מטפל — לא תוגש בקשת משיכה באמצעות ליבה.",
            "אין שכר הצלחה, אין אחוז מהסכום שנמשך, ואין תמריץ כלכלי למשיכה.",
        ]
    )

    d.article("סעיף 8. התמורה")
    d.nums(
        [
            "סוכן ביטוח פנסיוני הגובה שכר מהלקוח לפי סעיף 19א(א)(1) יערוך הסכם בכתב ובו הסכומים, דרך החישוב ואופן הגבייה, חד־פעמי או מתמשך, וימסור העתק טרם השירות.",
            "שכר הבירור וההנמקה נפרד משכר הליווי לביצוע, ומשולם גם אם ההמלצה היא שלא למשוך.",
            "שכר הליווי לביצוע ישולם רק אם הלקוח ביקש במפורש לבצע אחרי ההנמקה, ואם תנאי הסף מולאו.",
            "אסור: שכר כשיעור מהסכום שנמשך; שכר הצלחה על משיכה; שכר סמוי; שכר כפול עם תגמול מוסדי בניגוד לסעיף 7.",
            "הלוואה: שכר פתיחת תיק ישולם בגין עבודה בפועל גם אם לא אושרה, אם סומן במפורש. יתרה — רק אם אושרה והכסף הועבר.",
            "ליבה אינה מקזזת שכר מחשבון הפנסיה ואין לה הרשאה למשוך כספים לכיסה.",
        ]
    )
    d.line_field("שכר פתיחת תיק הלוואה, ₪ בתוספת מע״מ", name="loan_open_fee")
    d.line_field("יתרת שכר הלוואה רק אם אושרה, ₪ בתוספת מע״מ", name="loan_balance_fee")

    d.article("סעיף 9. אזהרת משיכה")
    d.p(
        "ידוע ללקוח כי משיכת פיצויים או תגמולים לפני גיל פרישה עלולה להקטין את הקצבה באופן משמעותי ובלתי הפיך, ועלולה לפגוע בכיסוי הביטוחי. ייתכן מס בשיעור 35% על תגמולים שלא כדין, ומס עד 47% על פיצויים, או שיעורים אחרים לפי דין. משיכה מוקדמת עלולה לפגוע בהטבות מס בפרישה. האמור הוא אזהרה כללית ואינו ייעוץ מס.",
        face="M",
    )

    d.article("סעיף 10. התחייבויות הלקוח")
    d.nums(
        [
            "למסור מידע מלא ונכון, לחתום על ייפוי כוח ועל מסמכי הגוף המוסדי, ולהמציא את המסמכים שבסעיף 14.",
            "מענה לא מלא עלול לעכב את השירות. אין בכך כדי לחייב תשלום מלוא שכר הביצוע אם הביצוע נמנע בשל עיקול, שעבוד או מניעה משפטית שלא בזדון הלקוח — אז ישולם שכר הבירור ושכר העבודה שתועדה בלבד.",
            "הסכמה לפנייה באמצעי התקשורת שמסר לצורך השירות. ניתן לחזור מהסכמה לשיווק בדוא״ל.",
            "הנתונים יישמרו במאגר ליבה לפי דיני הגנת הפרטיות.",
        ]
    )
    d.line_field("דוא״ל לביטול הסכמת שיווק", name="marketing_optout_email")

    d.article("סעיף 11. ביטול לפי חוק הגנת הצרכן")
    d.nums(
        [
            "עסקה מרחוק או ברוכלות ניתנת לביטול לפי חוק הגנת הצרכן, התשמ״א־1981, לרבות סעיפים 14 ו־14ג והארכות לאזרח ותיק ולעולה חדש.",
            "ביטול בתוך תקופת הביטול החוקית, לפני הגשה לגוף מוסדי — יוחזר כל תשלום, בניכוי רק מה שמותר במפורש בחוק.",
            "לא ייקבעו דמי ביטול של 30% או 100% אוטומטיים, לא פיצוי מוסכם ללא הוכחת נזק, ולא תוגדר תחילת שירות כהעברת מסמכים בלבד.",
            "לאחר תום תקופת הביטול ולפני הגשה ניתן לגבות את שכר הבירור וההנמקה אם בוצעו.",
            "לאחר הגשה: אם הלקוח מבטל את ההרשאה והפעולה כבר הוגשה — ייגבה שכר הליווי שפורט, אלא אם הדין מחייב אחרת.",
            "כישלון בשל עיקול, שעבוד או סירוב הגוף המוסדי שלא בזדון הלקוח — לא ייגבה שכר ביצוע מלא אוטומטית.",
        ]
    )

    d.article("סעיף 12. פרטיות")
    d.nums(
        [
            "ליבה היא בעלת השליטה במידע האישי של הלקוח לעניין השירות הפנסיוני.",
            "המידע נשמר בתיק הלקוח אצל ליבה במערכת מאובטחת.",
            "העברה לגורם תפעולי, אם תהיה, רק לצורך תפעול, בהיקף המינימלי, לפי הסכם עיבוד מידע ותקנות אבטחת מידע.",
            "הקלטת שיחות בידיעת הלקוח, למטרת תיעוד ציות.",
            "עיון, תיקון ומחיקה לפי חוק הגנת הפרטיות, בכפוף לחובת שמירת תיעוד רגולטורי.",
        ]
    )

    d.article("סעיף 13. אחריות")
    d.nums(
        [
            "ליבה אינה מתחייבת שהגוף המוסדי יאשר משיכה, הלוואה או ניוד, ואינה מתחייבת לסכום נטו.",
            "ליבה אינה צד ליחסים בין הלקוח לגוף המוסדי.",
            "אין בהסכם ויתור על אחריות בשל זדון, רשלנות חמורה או הפרת חובת אמון.",
        ]
    )

    d.article("סעיף 14. מסמכים נדרשים")
    d.p("לצורך השירות הלקוח ימציא ויחתום, לפי העניין, על המסמכים שיסומנו. היעדר מסמך עלול לעכב ביצוע, ואינו מחייב שכר ביצוע מלא אם הביצוע נמנע שלא בזדון הלקוח.")
    d.checks(
        [
            "ייפוי כוח לפי חוזר ייפוי כוח לבעל רישיון, בצירוף צילום תעודת זהות",
            "מסמך הנמקה לפי חוזר מסמך הנמקה, או סיכום שיחה כשהדין מתיר",
            "שאלון הכרת הלקוח וצרכיו",
            "דוחות שנתיים / רבעוניים של המוצר",
            "תלושי שכר",
            "תעודות זהות של כל בגיר שבגינו נדרש השירות",
            "טפסי הגוף המוסדי לבקשת הפעולה",
        ]
    )

    d.article("סעיף 15. שונות")
    d.nums(
        [
            "הדין החל הוא דין מדינת ישראל. סמכות השיפוט: בתי המשפט המוסמכים במחוז חיפה. אין בוררות כפויה כלפי הלקוח.",
            "כל שינוי ייעשה בכתב וייחתם בידי שני הצדדים.",
            "הודעה בדוא״ל: יום עסקים אחד. דואר רשום: שלושה ימי עסקים.",
            "אם סעיף יימצא בלתי חוקי — יצומצם למינימום המותר.",
        ]
    )

    d.article("סעיף 16. הצהרת הלקוח")
    d.nums(
        [
            "קראתי את ההסכם בעברית, הבנתי אותו, וקיבלתי העתק לפני תחילת השירות.",
            "הוסבר לי שביכולתי לפעול לבד מול הגוף המוסדי והמסלקה.",
            "הוסבר לי שליבה עשויה להמליץ שלא למשוך, ושאחוז מהמשיכה אינו שכר מותר לפי הסכם זה.",
            "איני חותם תחת לחץ של \"כסף מהיר\".",
        ]
    )
    d.sig("הלקוח — שם מלא ומספר זהות", "ליבה — מורשה חתימה וחותמת")
    return d.finish(HERE / "2-הסכם-משיכת-כספים-ליבה.pdf")


def build_claims() -> Path:
    d = Deed(
        "הסכם מימוש זכויות",
        "טיפול בתביעות ביטוחיות  ·  הלקוח מתקשר עם ליבה  ·  זה אינו הסכם משיכת חיסכון פנסיוני",
    )
    d.title_block()
    meta(d)
    d.p("נערך ונחתם בין ליבה ג.א. סוכנות לביטוח פנסיוני (2024) בע״מ, ח.פ. 517024733, רישיון 51024733, מרחוב חרושת 10 קריית ביאליק (להלן: \"ליבה\" או \"החברה\"), לבין הלקוח שפרטיו נקובים להלן (להלן: \"הלקוח\").")
    d.line_field("יום, חודש ושנת חתימה", name="agreement_date")
    d.line_field("שם הלקוח", name="client_name")
    d.line_field("מספר זהות", name="client_id")
    d.line_field("כתובת", name="client_address")
    d.line_field("טלפון", name="client_phone")
    d.line_field("טלפון נוסף", name="client_phone2")
    d.line_field("דוא״ל", name="client_email")
    d.p("האמור בהסכם זה בלשון זכר הוא לנוחות בלבד ומתייחס גם לנקבה.", size=9.3)

    d.article("מבוא")
    d.p("והואיל והלקוח מבקש שירות מקצועי למיצוי ומימוש זכויות ביטוחיות, לרבות תאונות אישיות, סיעוד, נכות מתאונה, אובדן כושר עבודה, מחלה קשה, בריאות, וזכויות כלפי גופים מוסדיים, קופות וקרנות לפי תנאי פוליסה או תקנון;")
    d.p("והואיל וליבה מצהירה כי השירות הוא מימוש זכויות וטיפול בתביעה כהגדרתה בחוזר סוכנים ויועצים 2018-10-3, ואינו שיווק פנסיוני למשיכת חיסכון, אינו המלצה למשיכת תגמולים או פיצויים, ואינו תחליף להסכם השיווק הפנסיוני;")
    d.p("לפיכך הוסכם, הוצהר והותנה בין הצדדים כדלקמן:", face="M")

    d.article("סעיף 1. מהות השירותים")
    d.nums(
        [
            "ליבה תספק ייעוץ תביעתי־ביטוחי, ניתוח מצב, גיבוש אסטרטגיה להגשת תביעה, ליווי והגשת תביעות למיצוי זכויות לפי המקרה האישי.",
            "השירות אינו משפטי ואינו רפואי, אינו ייצוג בבית משפט, ואינו חוות דעת רפואית. ליבה אינה מתחייבת לתוצאה, ואינה צד ליחסים בין הלקוח לגוף המוסדי.",
            "אם יידרשו משיכה, פדיון, ניוד, איחוד קופות או הלוואה כנגד צבירה — הטיפול לפי הסכם זה ייעצר לעניין אותה פעולה. ייפתח הסכם שיווק פנסיוני ומסמך הנמקה, ורק בעל רישיון יחיד יחליט.",
            "גורם תפעולי, אם יועסק, יפעל רק באיסוף מסמכים, סריקה, הזנה ומעקב. לא ייעץ, לא יגבש אסטרטגיה מול הלקוח, ולא ימליץ מה לתבוע.",
            "אם השירות חורג מרישיון פנסיוני, לא ישולב באותה שיחה מכירת מוצר ביטוחי או פנסיוני, לפי סעיף 4(ו1) לחוזר 2018-10-3 / 2022-10-10.",
            "חתימה במסרון או בדוא״ל, עם זיהוי החותם, חותמת זמן והעתק ללקוח, דינה כחתימה על הסכם זה. אם מתברר שנדרשת משיכה, פדיון, ניוד או הלוואה כנגד צבירה — הסכם זה נעצר ועוברים להסכם השיווק הפנסיוני.",
        ]
    )

    d.article("סעיף 2. סוג התביעה")
    d.checks(
        [
            "סיעוד",
            "אובדן כושר עבודה",
            "נכות מתאונה",
            "תאונות אישיות",
            "מחלה קשה",
            "בריאות",
            "חיים / מוות — יורשים",
            "נכות או שארים בקרן פנסיה (תביעת כיסוי, לא משיכת חיסכון)",
            "אחר",
        ]
    )
    d.line_field("גוף מוסדי", name="insurer")
    d.line_field("מספר פוליסה / חשבון", name="policy_no")
    d.line_field("תאריך האירוע", name="event_date")

    d.article("סעיף 3. התחייבויות הלקוח")
    d.nums(
        [
            "למסור מידע ומסמכים מלאים ונכונים, ולחתום על ייפויי כוח ועל מסמכי הגוף המוסדי.",
            "חתימתו אינה מפרה דין או הסכם אחר, ואין מניעה משפטית להתקשר.",
            "ליבה אינה מספקת שירות משפטי או רפואי. העברת מידע רפואי לצד שלישי תיעשה רק לאחר הסכמה נפרדת ומפורשת לאותו גורם ולאותה מטרה.",
            "לשאת בעלות צד שלישי שאישר בכתב מראש.",
            "לא למסור מסמך מזויף או חלקי במכוון. שיפוי רק על נזק ישיר שנגרם מהצהרה כוזבת בזדון.",
            "להגיע לפגישות, לבדיקות רפואיות ולוועדות שנדרשות מצד הגוף המוסדי לצורך התביעה. ליווי משפטי לוועדה אינו כלול אלא בהסכם נפרד עם עורך דין.",
            "להודיע על כל תשלום שהתקבל בחשבונו או לידיו בקשר לתביעה תוך שלושה ימי עסקים, לרבות המחאה, העברה בנקאית או קצבה.",
            "ידוע לו שחלק מהפעולות ניתן לבצע בעצמו מול הגוף המוסדי, ובחר בכל זאת בשירות ליבה.",
            "היעדר שיתוף פעולה: הודעה בכתב, ארבעה עשר ימים לתיקון, השהיה אפשרית. אין חיוב אוטומטי בסכום קבוע ללא הוכחת עבודה.",
        ]
    )

    d.article("סעיף 4. התמורה")
    d.nums(
        [
            "שכר הטרחה הוא על בסיס הצלחה בלבד, אלא אם סומן שכר קבוע לחוות דעת ראשונית. אם לא מולא סכום — אין שכר קבוע.",
            "שיעור ההצלחה מתוך הסכום ששולם בפועל ללקוח בקשר לתביעה זו, לפני ניכוי מס במקור. לא מתוך משיכת חיסכון פנסיוני, ולא מתוך כספים שהיה מקבל גם בלי הטיפול.",
            "קצבה חודשית שאושרה עקב הטיפול: לפי השיעור והחודשים שלהלן, או סכום מהוון שיוסכם בכתב לפני הגבייה.",
            "אין כפל שכר על אותו סכום.",
            "מועד תשלום: שבעה ימי עסקים מקבלת הכספים, כנגד חשבונית.",
            "אין קיזוז מחשבון בנק בלי הרשאה נפרדת בכתב.",
            "אם נגבה מראש שכר בגין קצבאות עתידיות והקצבה הופסקה — החזר יחסי תוך שלושים ימים, בתשלום אחד, ליורשים כנגד צו ירושה או צו קיום צוואה.",
            "אי־הצלחה: אין שכר הצלחה. ניתן לגבות רק שכר קבוע שנקבע מראש לחוות דעת, אם סומן, וכן הוצאות צד שלישי שאושרו.",
            "ביטול אחרי הגשה ואז קבלת כסף — שכר ההצלחה חל. ביטול אחרי הגשה בלי כסף — שכר עבודה מתועד לפי השכר השעתי והתקרה, או עשרים אחוז משכר ההצלחה הצפוי שנרשם בכתב במועד ההגשה, לפי הנמוך.",
            "אם שולם ללקוח סכום חד־פעמי או רטרואקטיבי הנמוך משכר ההצלחה שחל — ישולם תחילה הסכום שהתקבל, תוך שבעה ימי עסקים כנגד חשבונית. יתרת השכר תשולם בפריסה חודשית שווה שתיקבע בכתב במועד קבלת הכספים, עד מספר התשלומים שלהלן. אין חובה להפקיד המחאות דחויות כתנאי לקבלת השירות.",
        ]
    )
    d.line_field("שכר קבוע לחוות דעת ראשונית, ₪ בתוספת מע״מ (ריק = אין)", name="fee_opinion")
    d.line_field("שיעור הצלחה באחוזים, בתוספת מע״מ", name="success_pct")
    d.line_field("שיעור מקצבה חודשית באחוזים", name="annuity_pct")
    d.line_field("מספר חודשי קצבה", name="annuity_months")
    d.line_field("שכר שעתי אם ביטול אחרי הגשה בלי הצלחה, ₪", name="hourly_rate")
    d.line_field("תקרת שכר שעתי, ₪", name="hourly_cap")
    d.line_field("מספר תשלומים מקסימלי לפריסת יתרה אם הסכום החד־פעמי נמוך מהשכר", name="installments_max")

    d.article("סעיף 5. הוצאות נלוות")
    d.nums(
        [
            "הלקוח יישא באגרות, חוות דעת רפואיות, בדיקות, ייעוץ מקצועי שאושר, תרגומים, משלוחים ונסיעות שנדרשו לצורך התביעה — רק לפי חשבונית ורק אם אישר בכתב מראש, למעט משלוח שגרתי עד חמישים שקלים.",
            "ליבה לא תתקשר עם מומחה על חשבון הלקוח בלי אישור מראש.",
        ]
    )

    d.article("סעיף 6. ביטול")
    d.nums(
        [
            "ביטול לפי חוק הגנת הצרכן בעסקה מרחוק או ברוכלות, במועדים הקבועים בדין, לרבות הארכות לאזרח ותיק ולעולה חדש. לא ניתן להתנות על כך.",
            "תחילת מתן השירות לעניין קיצור זכות הביטול, ככל שהדין מתיר, לא תהיה העברת מסמכים גרידא אלא הגשת התביעה בפועל לגוף המוסדי.",
            "אין פיצוי מוסכם של עשרת אלפים שקלים, ואין חיוב ללא הוכחת עבודה בשל היעדר מענה.",
            "היעדר מענה ארבעה עשר ימים: תזכורת בכתב, השהיה, סגירת תיק בהודעה. שכר רק לפי סעיף 4.",
            "קיבל הלקוח את הכספים — שכר ההצלחה נשאר חוב גמור גם אם ביקש לבטל לאחר מכן.",
        ]
    )

    d.article("סעיף 7. יורשים וזכויות נפטר")
    d.nums(
        [
            "טיפול עבור יורש מחייב צו ירושה או צו קיום צוואה, זיהוי, והסכמת כל מי שנדרש לפי דין.",
            "מותר: איתור טכני, איסוף צווים, מילוי טפסים, משלוח בקשות והסבר טכני על סטטוס.",
            "אסור לגורם תפעולי ואין להציג כהמלצה: מה לעשות עם הכספים, מאיזה מוצר למשוך, קצבה או סכום חד־פעמי. אלה שיווק פנסיוני — הסכם נפרד, הנמקה ובעל רישיון.",
        ]
    )

    d.article("סעיף 8. סודיות ומידע רפואי")
    d.nums(
        [
            "סודיות מלאה על מידע אישי, רפואי ופיננסי גם לאחר סיום, למעט גילוי לפי דין, רשות, או גורם שאושר במפורש.",
            "מידע רפואי הוא מידע רגיש. שימוש רק לצורך התביעה.",
            "הקלטת שיחות בידיעת הלקוח ולצורך תיעוד השירות.",
            "ליבה היא בעלת השליטה. עיבוד אצל גורם תפעולי — בהסכם עיבוד מידע. התיק נשמר אצל ליבה במערכת מאובטחת.",
        ]
    )

    d.article("סעיף 9. משך וסיום")
    d.nums(
        [
            "בתוקף עד סיום הטיפול, ביטול כדין, או הודעת ליבה על סיום בהודעה של שבעה ימים, או מיידית במקרה של הצהרה כוזבת בזדון.",
            "טיפול עשוי להימשך חודשים או שנים. אורך הטיפול אינו מבטל זכויות ביטול קוגנטיות ואינו מחייב שכר הצלחה בטרם הצלחה.",
        ]
    )

    d.article("סעיף 10. ריבית פיגורים")
    d.p("על שכר שחל לפי סעיף 4 ולא שולם במועדו יחולו הפרשי הצמדה וריבית לפי חוק פסיקת ריבית והצמדה, התשכ״א־1961, ולא ריבית חוזית של אחוז לחודש.")

    d.article("סעיף 11. סמכות שיפוט")
    d.nums(
        [
            "הדין החל הוא דין מדינת ישראל.",
            "סמכות השיפוט: בתי המשפט המוסמכים במחוז חיפה.",
            "אין חובת בוררות. ניתן להסכים בכתב על גישור או בוררות רק אחרי שעלה סכסוך.",
        ]
    )

    d.article("סעיף 12. מסמכים נדרשים")
    d.p("לצורך הטיפול הלקוח ימציא ויחתום, לפי העניין:")
    d.checks(
        [
            "ייפוי כוח / הרשאה לגוף המוסדי, בצירוף צילום תעודת זהות",
            "טפסי תביעה של הגוף המוסדי",
            "ויתור סודיות רפואית של הגוף המוסדי",
            "פוליסה / אישור כיסוי / דוח שנתי",
            "מסמכים רפואיים ומסמכי האירוע",
            "צו ירושה או צו קיום צוואה — אם הטיפול הוא ליורש",
        ]
    )

    d.article("סעיף 13. שונות")
    d.nums(
        [
            "הלקוח מצהיר שקרא והבין. השירות אינו כולל ליווי משפטי לוועדות מעבר להגשת מסמכים, אלא בהסכם נפרד עם עורך דין.",
            "שינוי ייעשה בכתב ובחתימת שני הצדדים.",
            "הודעה בדוא״ל: יום עסקים אחד. דואר רשום: שלושה ימי עסקים.",
            "אם סעיף בטל — יצומצם למותר. יתרת ההסכם תעמוד.",
        ]
    )

    d.article("סעיף 14. הצהרה לפני חתימה")
    d.nums(
        [
            "הבנתי שזה הסכם תביעות ומימוש זכויות, ולא הסכם למשיכת חיסכון פנסיוני.",
            "הבנתי ששכר ההצלחה חל רק אם התקבל כסף בפועל מהתביעה.",
            "הבנתי את זכות הביטול לפי חוק הגנת הצרכן.",
            "קיבלתי העתק לפני תחילת השירות.",
        ]
    )
    d.sig("הלקוח — שם מלא ומספר זהות", "ליבה — מורשה חתימה וחותמת")
    return d.finish(HERE / "3-הסכם-תביעות-ליבה.pdf")


def main():
    sms_dir = HERE / "SMS-העלאה"
    sms_dir.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    named = [
        (build_withdrawal(), "הסכם-1-שיווק-פנסיוני-משיכה-מעודכן-2026-09-17.pdf"),
        (build_claims(), "הסכם-2-מימוש-זכויות-תביעות-מעודכן-2026-09-17.pdf"),
    ]
    for src, name in named:
        for dest_dir in (sms_dir, DOWNLOADS):
            dest = dest_dir / name
            shutil.copy2(src, dest)
            print(src.name, src.stat().st_size, "->", dest)


if __name__ == "__main__":
    main()
