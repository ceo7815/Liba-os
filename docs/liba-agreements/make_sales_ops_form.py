# -*- coding: utf-8 -*-
"""Liba sales-operations form — fillable PDF for SMS upload."""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from make_legal_pdfs import (  # noqa: E402
    A4H,
    ARCH,
    BOT,
    CSS,
    DOWNLOADS,
    FONT_R,
    FONTS,
    HAIR,
    INK,
    ML,
    MR,
    MUTED_HEX,
    RED,
    YELLOW,
    Deed,
    H,
    tw,
)

N_CARDS = 10
N_CHILDREN = 4
ROW_H = 160.0
HEAD_H = 16.0
LINE_H = 15.0

PRODUCT_CHOICES = [
    "בריאות",
    "מחלות קשות",
    "בריאות + מחלות קשות",
    "ריסק",
    "ריסק משועבד",
    "משכנתא",
    "סיעודי",
    "תאונות אישיות",
    "אחר",
]

REQUIRED_LINES = [
    ("insureds", "מבוטחים"),
    ("cost", "עלות"),
    ("covers", "כיסויים"),
]

COMPARE = [
    ("prem", "פרמיה", "נמוכה יותר", "ללא הבדל", "אחר"),
    ("scope", "כיסוי", "רחב יותר", "ללא הבדל", "אחר"),
    ("sums", "סכומים", "גבוהים יותר", "ללא הבדל", "אחר"),
    ("service", "שירות", "טובה יותר", "ללא הבדל", "אחר"),
]

# Chrome/PDFium paints form appearances LTR with no bidi. Rubik is Identity-H
# with CID = glyph id (ToUnicode maps GID → Unicode). Negate /W for those GIDs
# so the first logical letter sits on the right and the run advances left.
# Unicode codepoints above the glyph count are also negated for viewers that
# encode the show string as UTF-16 Identity-H.
_RTL_UNIS = set(range(0x0590, 0x05F5)) | {
    0x0020, 0x00A0, 0x0022, 0x0027, 0x002C, 0x002D, 0x002E, 0x003A, 0x003B,
    0x05F3, 0x05F4, 0x200E, 0x200F, 0x2013, 0x2014, 0x2018, 0x2019,
    0x201C, 0x201D,
} | set(range(0xFB1D, 0xFB50))


def _parse_cid_widths(raw: str) -> dict[int, int]:
    s = raw.strip()
    if s.startswith("["):
        s = s[1:-1]
    tokens: list[int | list[int]] = []
    i = 0
    while i < len(s):
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s):
            break
        if s[i] == "[":
            j = s.index("]", i)
            tokens.append([int(x) for x in s[i + 1 : j].split()])
            i = j + 1
            continue
        j = i
        if s[j] == "-":
            j += 1
        while j < len(s) and s[j].isdigit():
            j += 1
        tokens.append(int(s[i:j]))
        i = j
    widths: dict[int, int] = {}
    i = 0
    while i < len(tokens):
        cid = tokens[i]
        nxt = tokens[i + 1]
        if isinstance(nxt, list):
            assert isinstance(cid, int)
            for k, w in enumerate(nxt):
                widths[cid + k] = w
            i += 2
            continue
        cid2 = nxt
        w = tokens[i + 2]
        assert isinstance(cid, int) and isinstance(cid2, int) and isinstance(w, int)
        for c in range(cid, cid2 + 1):
            widths[c] = w
        i += 3
    return widths


def _hex_int(h: str) -> int:
    h = h.strip().strip("<>").replace(" ", "")
    if not h:
        return 0
    if len(h) <= 4:
        return int(h, 16)
    raw = bytes.fromhex(h)
    hi = int.from_bytes(raw[:2], "big")
    if 0xD800 <= hi <= 0xDBFF and len(raw) >= 4:
        lo = int.from_bytes(raw[2:4], "big")
        return 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00)
    return hi


def _tounicode_map(doc: pymupdf.Document, type0_xref: int) -> dict[int, int]:
    kind, tu = doc.xref_get_key(type0_xref, "ToUnicode")
    if kind != "xref":
        return {}
    data = doc.xref_stream(int(tu.split()[0]))
    text = data.decode("latin1", errors="replace") if isinstance(data, (bytes, bytearray)) else str(data)
    mapping: dict[int, int] = {}
    for block in re.finditer(r"beginbfchar(.*?)endbfchar", text, re.S):
        for m in re.finditer(r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>", block.group(1)):
            mapping[_hex_int(m.group(1))] = _hex_int(m.group(2))
    for block in re.finditer(r"beginbfrange(.*?)endbfrange", text, re.S):
        body = block.group(1)
        for m in re.finditer(
            r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[(.*?)\]",
            body,
            re.S,
        ):
            lo, hi = _hex_int(m.group(1)), _hex_int(m.group(2))
            dests = [_hex_int(x) for x in re.findall(r"<([0-9a-fA-F]+)>", m.group(3))]
            for i, cid in enumerate(range(lo, hi + 1)):
                if i < len(dests):
                    mapping[cid] = dests[i]
        stripped = re.sub(r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[(.*?)\]", "", body, flags=re.S)
        for m in re.finditer(
            r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>",
            stripped,
        ):
            lo, hi, dest = _hex_int(m.group(1)), _hex_int(m.group(2)), _hex_int(m.group(3))
            if hi < lo or hi - lo > 4096:
                continue
            for i, cid in enumerate(range(lo, hi + 1)):
                mapping[cid] = dest + i
    return mapping


def _emit_cid_widths(widths: dict[int, int]) -> str:
    if not widths:
        return "[]"
    cids = sorted(widths)
    parts: list[str] = ["["]
    i = 0
    while i < len(cids):
        start = cids[i]
        run = [widths[start]]
        j = i + 1
        while j < len(cids) and cids[j] == cids[j - 1] + 1:
            run.append(widths[cids[j]])
            j += 1
        if len(run) == 1:
            parts.append(f"{start}[{run[0]}]")
        elif len(set(run)) == 1:
            parts.append(f"{start} {cids[j - 1]} {run[0]}")
        else:
            parts.append(f"{start}[{' '.join(str(x) for x in run)}]")
        i = j
    parts.append("]")
    return " ".join(parts)


class OpsDeed(Deed):
    def field(self, rect: pymupdf.Rect, *, multi=False, name: str | None = None, size=9):
        try:
            self.page.insert_font(fontname="RubikR", fontfile=str(FONTS / "Rubik-Regular.ttf"))
        except Exception:
            pass
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
        w.field_name = name or self._fid()
        w.rect = rect
        w.text_fontsize = size
        w.text_color = INK
        w.text_font = "RubikR"
        w.fill_color = (1, 1, 1)
        w.border_color = (0.82, 0.82, 0.82)
        w.border_width = 0.4
        w.field_flags = (4096 if multi else 0) | 4194304  # multiline + do-not-spellcheck
        self.page.add_widget(w)

    def finish(self, path: Path) -> Path:
        self._install_hebrew_form_font()
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
        # Keep Hebrew outlines: otherwise save() subsets them out of the form font.
        self.doc[0].insert_text(
            pymupdf.Point(ML, 8),
            "אבגדהוזחטיכלמנסעפצקרשתךםןףץ ",
            fontname="RubikR",
            fontsize=0.01,
            render_mode=3,
        )
        self.doc.save(path, deflate=True, deflate_fonts=True, garbage=4, clean=False)
        self.doc.close()
        self._repatch_rtl_after_save(path)
        return path

    def _repatch_rtl_after_save(self, path: Path):
        doc = pymupdf.open(path)
        holder = type("_Doc", (), {"doc": doc})()
        for type0 in _all_rubikr_xrefs(doc):
            OpsDeed._negate_rtl_cid_widths(holder, type0)
        tmp = path.with_suffix(".rtl.pdf")
        doc.save(tmp, deflate=True, garbage=3, clean=False)
        doc.close()
        tmp.replace(path)

    def _install_hebrew_form_font(self):
        fontfile = str(FONTS / "Rubik-Regular.ttf")
        fxref = self.doc[0].insert_font(fontname="RubikR", fontfile=fontfile)
        self._negate_rtl_cid_widths(fxref)
        font_map = self.doc.get_new_xref()
        self.doc.update_object(font_map, f"<< /RubikR {fxref} 0 R >>")
        dr = self.doc.get_new_xref()
        self.doc.update_object(dr, f"<< /Font {font_map} 0 R >>")
        refs = []
        for page in self.doc:
            for w in page.widgets() or []:
                refs.append(f"{w.xref} 0 R")
        da = "/RubikR 9 Tf 0.067 0.067 0.067 rg"
        af = self.doc.get_new_xref()
        self.doc.update_object(
            af,
            f"<< /Fields [{' '.join(refs)}] /DR {dr} 0 R /DA ({da}) /NeedAppearances true /Q 1 >>",
        )
        self.doc.xref_set_key(self.doc.pdf_catalog(), "AcroForm", f"{af} 0 R")
        self.doc.xref_set_key(self.doc.pdf_catalog(), "Lang", "(he-IL)")
        vp = self.doc.get_new_xref()
        self.doc.update_object(vp, "<< /Direction /R2L /DisplayDocTitle true >>")
        self.doc.xref_set_key(self.doc.pdf_catalog(), "ViewerPreferences", f"{vp} 0 R")
        text_types = {pymupdf.PDF_WIDGET_TYPE_TEXT, pymupdf.PDF_WIDGET_TYPE_COMBOBOX}
        for page in self.doc:
            for w in page.widgets() or []:
                if w.field_type not in text_types:
                    continue
                size = w.text_fontsize or 9
                da_w = f"/RubikR {size} Tf 0.067 0.067 0.067 rg"
                self.doc.xref_set_key(w.xref, "DA", f"({da_w})")
                self.doc.xref_set_key(w.xref, "Lang", "(he-IL)")
                self.doc.xref_set_key(w.xref, "Q", "1")
        for type0 in _all_rubikr_xrefs(self.doc):
            self._negate_rtl_cid_widths(type0)

    def _negate_rtl_cid_widths(self, type0_xref: int):
        kind, desc = self.doc.xref_get_key(type0_xref, "DescendantFonts")
        if kind != "array":
            return
        m = re.search(r"(\d+)\s+0\s+R", desc)
        if not m:
            return
        cid_xref = int(m.group(1))
        kind, wval = self.doc.xref_get_key(cid_xref, "W")
        if kind == "xref":
            w_xref = int(wval.split()[0])
            raw = self.doc.xref_object(w_xref)
        elif kind == "array":
            w_xref = None
            raw = wval
        else:
            return
        widths = _parse_cid_widths(raw)
        cmap = _tounicode_map(self.doc, type0_xref)
        rtl_cids = {cid for cid, uni in cmap.items() if uni in _RTL_UNIS}
        max_gid = max((c for c in widths if c < 4000), default=0)
        rtl_cids |= {uni for uni in _RTL_UNIS if uni > max_gid}
        face = pymupdf.Font(fontfile=str(FONTS / "Rubik-Regular.ttf"))
        for cid, w in list(widths.items()):
            if cid not in rtl_cids and w < 0:
                widths[cid] = -w
        for cid in sorted(rtl_cids):
            current = widths.get(cid)
            if current is None:
                uni = cmap.get(cid, cid)
                adv = face.glyph_advance(uni)
                current = int(round(adv * 1000)) if adv else 0
            if current > 0:
                widths[cid] = -current
        emitted = _emit_cid_widths(widths)
        if w_xref is None:
            self.doc.xref_set_key(cid_xref, "W", emitted)
        else:
            self.doc.update_object(w_xref, emitted)

    def named_chk(self, x: float, y: float, name: str, size=9.0):
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
        w.field_name = name
        w.rect = pymupdf.Rect(x, y, x + size, y + size)
        w.border_color = INK
        w.border_width = 0.7
        w.fill_color = (1, 1, 1)
        self.page.add_widget(w)

    def combo(self, rect: pymupdf.Rect, name: str, choices: list[str], *, value: str = "סוג מוצר"):
        try:
            self.page.insert_font(fontname="RubikR", fontfile=str(FONTS / "Rubik-Regular.ttf"))
        except Exception:
            pass
        items = [value] + [c for c in choices if c != value]
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_COMBOBOX
        w.field_name = name
        w.rect = rect
        w.choice_values = [f"\u200f{c}" for c in items]
        w.field_value = f"\u200f{value}"
        w.text_fontsize = 9
        w.text_color = INK
        w.fill_color = (1, 1, 1)
        w.border_color = INK
        w.border_width = 0.7
        w.field_flags = 131072 | 4194304
        try:
            w.text_font = "RubikR"
        except Exception:
            pass
        self.page.add_widget(w)
        shown = f"\u200f{value}"
        uni = "<FEFF" + shown.encode("utf-16-be").hex().upper() + ">"
        for widget in self.page.widgets() or []:
            if widget.field_name == name:
                try:
                    self.doc.xref_set_key(widget.xref, "Q", "1")
                    self.doc.xref_set_key(widget.xref, "V", uni)
                    self.doc.xref_set_key(widget.xref, "DV", uni)
                    widget.field_value = shown
                    widget.update()
                except Exception:
                    pass
                break

    def named_memo(self, label: str, lines: int, name: str, *, size=9.0):
        if label:
            self.p(label.rstrip(":") + ":", size=9.0, face="M", gap=2)
        h = 14.0 * lines
        self.ensure(h + 4)
        r = pymupdf.Rect(ML, self.y, MR, self.y + h)
        for i in range(lines):
            yy = self.y + 12.2 + i * 14.0
            self.page.draw_line(pymupdf.Point(ML, yy), pymupdf.Point(MR, yy), color=HAIR, width=0.35)
        self.field(r, multi=True, name=name, size=size)
        self.y += h + 6

    def fill_page_memo(self, label: str, name: str, *, size=9.0):
        if label:
            self.p(label.rstrip(":") + ":", size=9.0, face="M", gap=3)
        h = BOT - self.y - 6
        if h < 90:
            self.new_page()
            if label:
                self.p(label.rstrip(":") + ":", size=9.0, face="M", gap=3)
            h = BOT - self.y - 6
        r = pymupdf.Rect(ML, self.y, MR, self.y + h)
        self.page.draw_rect(r, color=HAIR, width=0.45)
        self.field(r, multi=True, name=name, size=size)
        self.y = r.y1 + 4

    def flag(self, items: list[tuple[str, str]]):
        self.ensure(18)
        x = MR
        for label, name in items:
            lw = tw(label, 8.2) + 8
            self.named_chk(x - 11, self.y + 2, name)
            self.page.insert_htmlbox(
                pymupdf.Rect(x - 16 - lw, self.y, x - 14, self.y + 14),
                H(label, size=8.2, align="start", lh=1.15),
                css=CSS,
                archive=ARCH,
            )
            x = x - 16 - lw - 16
            if x < ML + 80:
                self.y += 16
                x = MR
                self.ensure(18)
        self.y += 16

    def sig_quad(self, items: list[tuple[str, str]]):
        self.center("ולראיה באו הצדדים על החתום:", size=10.4, face="M", gap=8)
        gap, h = 12.0, 88.0
        w = (self.iw - gap) / 2
        for i, (title, side) in enumerate(items):
            if i % 2 == 0:
                self.ensure(h + 10)
                row_y = self.y
            x1 = MR if i % 2 == 0 else ML + w
            x0 = x1 - w
            y = row_y
            box = pymupdf.Rect(x0, y, x1, y + h)
            self.page.draw_rect(box, color=INK, width=0.45)
            self.page.draw_rect(pymupdf.Rect(x0, y, x1, y + 3.0), color=YELLOW, fill=YELLOW, width=0)
            self.page.draw_rect(pymupdf.Rect(x1 - 22, y, x1, y + 3.0), color=RED, fill=RED, width=0)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0 + 5, y + 7, x1 - 5, y + 22),
                H(title, size=7.8, face="M", align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.page.draw_line(pymupdf.Point(x0 + 12, y + 48), pymupdf.Point(x1 - 12, y + 48), color=INK, width=0.5)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0, y + 50, x1, y + 61),
                H("חתימה", size=6.8, color=MUTED_HEX, align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.page.draw_line(pymupdf.Point(x0 + 12, y + 74), pymupdf.Point(x1 - 12, y + 74), color=INK, width=0.45)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0, y + 75, x1, y + 86),
                H("תאריך", size=6.8, color=MUTED_HEX, align="center"),
                css=CSS,
                archive=ARCH,
            )
            self.field(pymupdf.Rect(x0 + 12, y + 28, x1 - 12, y + 47), name=f"sig_{side}")
            self.field(pymupdf.Rect(x0 + 12, y + 62, x1 - 12, y + 73), name=f"sig_{side}_date")
            if i % 2 == 1:
                self.y = row_y + h + 10
        if len(items) % 2:
            self.y = row_y + h + 10

    def policy_cols(self) -> list[tuple[float, float]]:
        usable = self.iw
        # RTL from the right: product, existing, new, reasons, compare.
        # Product is only a combo — keep just enough width for the longest name.
        fracs = (0.18, 0.15, 0.15, 0.26, 0.26)
        xs = []
        x = MR
        for f in fracs:
            w = usable * f
            xs.append((x - w, x))
            x -= w
        return xs

    def policy_header(self):
        xs = self.policy_cols()
        labels = ["סוג מוצר", "מצב קיים", "מצב חדש", "נימוקים להחלטה", "השוואה"]
        y = self.y
        for (x0, x1), lab in zip(xs, labels):
            cell = pymupdf.Rect(x0, y, x1, y + HEAD_H)
            self.page.draw_rect(cell, color=INK, fill=INK, width=0)
            self.page.insert_htmlbox(
                pymupdf.Rect(x0 + 2, y + 1, x1 - 2, y + HEAD_H - 1),
                H(lab, size=7.4, face="M", color="#ffffff", align="center", lh=1.1),
                css=CSS,
                archive=ARCH,
            )
        self.y += HEAD_H

    def policy_row(self, n: int):
        if self.y + ROW_H > BOT:
            self.new_page()
            self.policy_header()
        pfx = f"p{n:02d}"
        xs = self.policy_cols()
        y0 = self.y
        y1 = y0 + ROW_H
        for i, (x0, x1) in enumerate(xs):
            cell = pymupdf.Rect(x0, y0, x1, y1)
            if n % 2 == 0:
                self.page.draw_rect(cell, color=(1, 1, 1), fill=(0.975, 0.975, 0.97), width=0)
            self.page.draw_rect(cell, color=HAIR, width=0.35)

        prod_x0, prod_x1 = xs[0]
        combo_h = 22.0
        self.combo(
            pymupdf.Rect(prod_x0 + 3, y0 + 6, prod_x1 - 3, y0 + 6 + combo_h),
            f"{pfx}_product",
            PRODUCT_CHOICES,
        )

        ex0, ex1 = xs[1]
        self._state_cell(ex0, ex1, y0, y1, f"{pfx}_existing")
        nw0, nw1 = xs[2]
        self._state_cell(nw0, nw1, y0, y1, f"{pfx}_new")

        rs0, rs1 = xs[3]
        self._reason_cell(rs0, rs1, y0, y1, f"{pfx}_reason")

        c0, c1 = xs[4]
        self._compare_cell(c0, c1, y0, y1, pfx)
        self.y = y1

    def _reason_cell(self, x0: float, x1: float, y0: float, y1: float, name: str):
        pad = 3.0
        self.field(
            pymupdf.Rect(x0 + pad, y0 + pad, x1 - pad, y1 - pad),
            multi=True,
            name=name,
            size=8,
        )

    def _state_cell(self, x0: float, x1: float, y0: float, y1: float, prefix: str):
        foot = LINE_H * len(REQUIRED_LINES) + 4
        self.field(pymupdf.Rect(x0 + 3, y0 + 3, x1 - 3, y1 - foot - 2), multi=True, name=prefix, size=8)
        y = y1 - foot
        self.page.draw_line(pymupdf.Point(x0 + 3, y), pymupdf.Point(x1 - 3, y), color=HAIR, width=0.3)
        for key, label in REQUIRED_LINES:
            self._fill_line(x0, x1, y, f"{label}:", f"{prefix}_{key}")
            y += LINE_H

    def _fill_line(self, x0: float, x1: float, y: float, label: str, name: str):
        lw = min(tw(label, 7.2) + 6, (x1 - x0) * 0.42)
        self.page.insert_htmlbox(
            pymupdf.Rect(x1 - lw, y + 1, x1 - 3, y + LINE_H - 1),
            H(label, size=7.2, face="M", align="start", lh=1.1),
            css=CSS,
            archive=ARCH,
        )
        yline = y + LINE_H - 3.5
        self.page.draw_line(pymupdf.Point(x0 + 4, yline), pymupdf.Point(x1 - lw - 3, yline), color=INK, width=0.45)
        self.field(pymupdf.Rect(x0 + 4, y + 2, x1 - lw - 3, yline - 0.3), name=name, size=8)

    def _compare_cell(self, x0: float, x1: float, y0: float, y1: float, pfx: str):
        pad = 3.0
        y = y0 + pad
        mode_h = 16.0
        self.page.draw_rect(pymupdf.Rect(x0 + pad, y, x1 - pad, y + mode_h), color=HAIR, width=0.4)
        self._rtl_checks(
            x1 - pad - 4,
            x0 + pad + 4,
            y + 2,
            [
                ("החלפה", f"{pfx}_is_replace"),
                ("צירוף חדש", f"{pfx}_is_new"),
            ],
            size=6.8,
        )
        y += mode_h + 3
        block_h = 28.0
        for key, topic, a, b, c in COMPARE:
            cell = pymupdf.Rect(x0 + pad, y, x1 - pad, y + block_h)
            self.page.draw_rect(cell, color=HAIR, width=0.4)
            topic_w = tw(topic, 7.2) + 8
            self.page.insert_htmlbox(
                pymupdf.Rect(x1 - pad - 4 - topic_w, y + 1, x1 - pad - 4, y + 12),
                H(topic, size=7.2, face="M", align="start", lh=1.05),
                css=CSS,
                archive=ARCH,
            )
            self._rtl_checks(
                x0 + pad + 4 + 36,
                x0 + pad + 4,
                y + 1,
                [(c, f"{pfx}_cmp_{key}_c")],
                size=6.6,
            )
            self._rtl_checks(
                x1 - pad - 5,
                x0 + pad + 4,
                y + 13,
                [
                    (a, f"{pfx}_cmp_{key}_a"),
                    (b, f"{pfx}_cmp_{key}_b"),
                ],
                size=6.6,
            )
            y += block_h + 2
        if y + 12 < y1 - 2:
            self.page.draw_line(
                pymupdf.Point(x0 + pad + 2, y + 11),
                pymupdf.Point(x1 - pad - 2, y + 11),
                color=INK,
                width=0.4,
            )
            self.field(pymupdf.Rect(x0 + pad + 2, y, x1 - pad - 2, y1 - 3), name=f"{pfx}_cmp_note", size=7.5)

    def _rtl_checks(self, x_right: float, x_left: float, y: float, items: list[tuple[str, str]], *, size=6.0):
        x = x_right
        chk = 8.0
        for lab, name in items:
            try:
                lw = float(FONT_R.text_length(lab, fontsize=size)) + 6
            except Exception:
                lw = tw(lab, size, medium=False) + 3
            need = chk + 2 + lw + 4
            if x - need < x_left - 0.5:
                break
            self.named_chk(x - chk, y + 1.5, name, size=chk)
            self.page.insert_htmlbox(
                pymupdf.Rect(x - chk - 2 - lw, y, x - chk - 2, y + 13),
                H(lab, size=size, align="start", lh=1.05),
                css=CSS,
                archive=ARCH,
            )
            x -= need


def _xref_from_pdf_ref(value: str) -> int | None:
    m = re.search(r"(\d+)\s+0\s+R", value or "")
    return int(m.group(1)) if m else None


def _font_map_rubik(doc: pymupdf.Document, font_map_xref: int) -> int | None:
    kind, rubik = doc.xref_get_key(font_map_xref, "RubikR")
    if kind == "xref":
        return _xref_from_pdf_ref(rubik)
    return None


def _all_rubikr_xrefs(doc: pymupdf.Document) -> set[int]:
    found: set[int] = set()

    def add_font_map(kind: str, val: str):
        if kind == "xref":
            type0 = _font_map_rubik(doc, int(val.split()[0]))
            if type0:
                found.add(type0)
        elif kind == "dict":
            m = re.search(r"/RubikR\s+(\d+)\s+0\s+R", val or "")
            if m:
                found.add(int(m.group(1)))

    def add_from_resources(kind: str, val: str):
        if kind == "xref":
            res_xref = int(val.split()[0])
            add_font_map(*doc.xref_get_key(res_xref, "Font"))
        elif kind == "dict":
            m = re.search(r"/Font\s+(\d+)\s+0\s+R", val or "")
            if m:
                add_font_map("xref", f"{m.group(1)} 0 R")
            else:
                add_font_map("dict", val)

    kind, af = doc.xref_get_key(doc.pdf_catalog(), "AcroForm")
    if kind == "xref":
        af_xref = int(af.split()[0])
        add_from_resources(*doc.xref_get_key(af_xref, "DR"))
    for page in doc:
        add_from_resources(*doc.xref_get_key(page.xref, "Resources"))
        for w in page.widgets() or []:
            add_from_resources(*doc.xref_get_key(w.xref, "DR"))
    return found


def person_block(d: OpsDeed, title: str, names: dict[str, str]):
    d.article(title)
    d.fields_row(["שם מלא", "ת.ז."], names=[names["name"], names["id"]])
    d.fields_row(
        ["תאריך לידה", "מין", "מצב משפחתי"],
        names=[names["dob"], names["gender"], names.get("family", d._fid())],
    )
    d.fields_row(["טלפון", "דוא״ל"], names=[names.get("phone", d._fid()), names.get("email", d._fid())])
    if "address" in names:
        d.line_field("כתובת", name=names["address"])
    d.fields_row(
        ["עיסוק", "קופ״ח", "שב״ן"],
        names=[names.get("job", d._fid()), names.get("hmo", d._fid()), names.get("shaban", d._fid())],
    )
    extras = []
    extra_names = []
    if "height" in names:
        extras.append("גובה")
        extra_names.append(names["height"])
    if "weight" in names:
        extras.append("משקל")
        extra_names.append(names["weight"])
    if "smoke" in names:
        extras.append("עישון")
        extra_names.append(names["smoke"])
    if "id_issue" in names:
        extras.append("תאריך הנפקת ת.ז.")
        extra_names.append(names["id_issue"])
    if extras:
        d.fields_row(extras, names=extra_names)


def build() -> Path:
    d = OpsDeed("טופס תפעול מכירה", "סגירת עסקה והצהרת סוכן לפי חוזר צירוף לביטוח")
    d.title_block()

    d.article("א. פרטי תיק ומנהל פנייה")
    d.fields_row(
        ["תאריך", "בעל רישיון יחיד"],
        names=["Date", "license_holder"],
    )
    d.fields_row(
        ["קוד הנחה", "הסכם הנחה", "תאריך תחילת ביטוח"],
        names=["DiscountCode", "DiscountAgreement", "InsuranceBegin"],
    )
    d.fields_row(
        ["מקור ליד", "שם מנהל הפנייה", "מספר סוכן כללי"],
        names=["LeadSource", "ReferralManager", "AgentNumber"],
    )
    d.flag([("ביטול תקופת הכשרה", "WaitingPeriodCancelYes"), ("ללא ביטול הכשרה", "WaitingPeriodCancelNo")])
    d.fields_row(
        ["הראל", "הפניקס", "מגדל"],
        names=["AgentNoHarel", "AgentNoPhoenix", "AgentNoMigdal"],
    )
    d.fields_row(
        ["כלל", "מנורה", "איילון"],
        names=["AgentNoClal", "AgentNoMenora", "AgentNoAyalon"],
    )
    d.fields_row(["חברה אחרת", "מספר סוכן אחר"], names=["AgentNoOtherCo", "AgentNoOther"])
    d.fields_row(["שם הסוכן", "שם הסוכנות"], names=["AgentName", "AgencyName"])

    person_block(
        d,
        "ב. מבוטח ראשי",
        {
            "name": "FullName",
            "id": "PID",
            "dob": "BithDate",
            "gender": "GenderText",
            "family": "FamilyStatusText",
            "phone": "CellPhoneNumber",
            "email": "EmailAddress",
            "address": "Address",
            "job": "OccupationCode",
            "hmo": "HMO",
            "shaban": "Shaban",
            "height": "Hight",
            "weight": "Weight",
            "smoke": "ClientSmokeNum",
            "id_issue": "PIDIssueDate",
        },
    )
    person_block(
        d,
        "ג. מבוטח משני",
        {
            "name": "FullNameSpouse",
            "id": "PIDSpouse",
            "dob": "BirthDateSpouse",
            "gender": "GenderTextSpouse",
            "family": "FamilyStatusSpouse",
            "phone": "PhoneSpouse",
            "email": "EmailSpouse",
            "address": "AddressSpouse",
            "job": "OccupationCodeSpouse",
            "hmo": "HMOSpouse",
            "shaban": "ShabanSpouse",
            "height": "HightSpouse",
            "weight": "WeightSpouse",
        },
    )

    d.article("ד. ילדים")
    for i in range(1, N_CHILDREN + 1):
        d.fields_row(
            ["שם", "ת.ז.", "תאריך לידה", "מין"],
            names=[f"FullNameChild{i}", f"PIDChild{i}", f"BirthDateChild{i}", f"GenderChildText{i}"],
        )
        d.fields_row(
            ["עיסוק", "משקל", "גובה", "שב״ן", "קופ״ח"],
            names=[
                f"OccupationChild{i}",
                f"WeightChild{i}",
                f"HightChild{i}",
                f"ShabanChild{i}",
                f"HMOChild{i}",
            ],
        )

    d.article("ה. תשלום")
    d.flag([("הוראת קבע", "PayStandingOrder"), ("כרטיס אשראי", "PayCreditCard")])
    d.fields_row(
        ["בנק", "סניף", "מספר חשבון"],
        names=["BankName", "BankBranchCode", "BankAccountNumber"],
    )
    d.fields_row(
        ["שם בעל הכרטיס / החשבון", "ת.ז. בעל הכרטיס"],
        names=["FullNameCreditCardHolder", "PIDCreditCardHolder"],
    )
    d.fields_row(
        ["תוקף חודש", "תוקף שנה", "4 ספרות אחרונות"],
        names=["MonthDigit", "YearDigit", "CardLast4"],
    )

    d.article("ו. שעבוד")
    d.flag([("יש שעבוד", "PledgeYes"), ("אין שעבוד", "PledgeNo")])
    d.fields_row(
        ["בנק", "סניף", "מספר הלוואה", "סכום משועבד ₪"],
        names=["PledgeBank", "PledgeBranch", "PledgeLoan", "PledgeAmount"],
    )
    d.fill_page_memo("מלל חופשי", "FreeText")

    d.new_page()
    d.article("ז. פוליסות")
    d.policy_header()
    for n in range(1, N_CARDS + 1):
        d.policy_row(n)

    d.fields_row(
        ["סה״כ קיים ₪", "סה״כ לפני הנחה ₪", "סה״כ אחרי הנחה ₪"],
        names=["TotalExisting", "TotalBefore", "TotalAfter"],
    )
    d.named_memo("הערות", 2, "OpenNotes")

    d.article("ח. הצהרת הסוכן")
    d.p(
        "אני מאשר כי במסגרת הליך המכירה למוצרים המפורטים בטופס זה, עמדתי בכל הוראות חוזרי המפקח על הביטוח "
        "לעניין צירוף לביטוח ועריכת תכנית לביטוח, ובפרט ביררתי את צורכי המועמד/ת, הצעתי ביטוח ו/או הוספת כיסוי, "
        "הרחבה או כתב שירות לפוליסת ביטוח קיימת התואם לצרכיו/ה, ומסרתי לו/ה את כל המידע המהותי הנדרש "
        "וכן קיבלתי הסכמתו לרכישת הפוליסה."
    )
    d.flag(
        [
            ("ממליץ לעבור", "RecReplace"),
            ("צירוף חדש", "RecNew"),
            ("להישאר בקיים", "RecStay"),
        ]
    )
    d.named_memo("נימוק", 2, "RecNote")

    d.article("ט. חתימות")
    d.sig_quad(
        [
            ("בעל רישיון / סוכן מטעם ליבה", "agent"),
            ("מבוטח ראשי", "client"),
            ("מבוטח משני", "spouse"),
            ("מעסיק", "employer"),
            ("ילד מעל גיל 18", "child18_1"),
            ("ילד מעל גיל 18", "child18_2"),
        ]
    )
    return d.finish(HERE / "4-טופס-תפעול-מכירה-ליבה.pdf")


def main():
    src = build()
    sms_dir = HERE / "SMS-העלאה"
    sms_dir.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    name = "טופס-תפעול-מכירה-מעודכן-2026-09-17.pdf"
    for dest_dir in (sms_dir, DOWNLOADS):
        dest = dest_dir / name
        shutil.copy2(src, dest)
        print(src.name, src.stat().st_size, "->", dest)


if __name__ == "__main__":
    main()
