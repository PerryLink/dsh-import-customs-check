#!/usr/bin/env python3
"""Generate the README visuals for dsh-import-customs-check.

Everything drawn here is derived from this repository, not from a template:

  hero 1440x576  (Pillow; zh/en x light/dark = four .webp files)
      Left column: kicker, plugin name, two value lines, two explanation
      lines, one metadata line and the family footer. Right side: the
      document set this package actually reads -- invoice 9/9 fields,
      packing list 5/9, bill of lading 5/9, customs declaration 9/9 --
      feeding the nine-field comparison where the declaration's gross
      weight reads 2450.50 against 2450.00 three times; underneath, the
      declaration's twelve element slots with the eleventh (port of
      loading) hollow, and the CSV export line.

  flow 1100x660  (hand-written SVG; light/dark = two files)
      One tall document set on the left feeds two independent channels:
      A, the nine-field consistency scoreboard (three states per field,
      normalisation band above it, summary / pass / strict gate at the
      right), and B, the twelve-slot declaration element strip. Only
      channel A reaches import_export; channel B never writes CSV and a
      missing element never flips `pass`.

Concrete values come from samples/quickstart:
  input/import-set.json   invoice 2450.00, declaration 2450.50; HS
                          8471.30.00 vs 84713000; no port_of_loading
  expected/result.json    summary 8 consistent / 1 mismatch, pass=false;
                          elements 11/12, missing port_of_loading;
                          export sha256 ca764bab6159..., 9 rows.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow and the Windows fonts msyh.ttc / msyhbd.ttc /
           consola.ttf / consolab.ttf (no network, no other dependency).
"""
from __future__ import annotations

import math
import os
from html import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
if not os.path.exists(FONT_MONO_BOLD):
    # The three fonts named in the task always suffice; consolab is optional.
    FONT_MONO_BOLD = FONT_MONO
for _p in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO):
    if not os.path.exists(_p):
        raise SystemExit(f"FATAL: font missing: {_p}")

RADIUS = 22
SHADOW = 26

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        card="#ffffff", card_edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", accent2="#16a34a",
        pill="#ece7f9", band="#f5f2fb", grid="#e7e4f0",
        mark="#b45309", mark_bg="#fdf3e9", mark_edge="#e7c9a8",
        shadow=(32, 26, 64), glow="#7a68c9",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        card="#1b2231", card_edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", accent2="#3fb950",
        pill="#242d42", band="#202839", grid="#2b3448",
        mark="#d9a441", mark_bg="#2a2216", mark_edge="#5b4a28",
        shadow=(0, 0, 0), glow="#8496f5",
    ),
}

FONT_FILES = {
    "cjk": FONT_CJK,
    "cjk_bold": FONT_CJK_BOLD,
    "mono": FONT_MONO,
    "mono_bold": FONT_MONO_BOLD,
}


def font(size: int, kind: str = "cjk_bold") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_FILES[kind], int(round(size)))


def hx(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


_SCRATCH = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def measure(text: str, size: float, kind: str) -> float:
    return _SCRATCH.textlength(text, font=font(size, kind))


def require_w(text: str, size: float, kind: str, max_w: float, what: str) -> None:
    """Fail loudly instead of shipping a clipped label."""
    width = measure(text, size, kind)
    if width > max_w + 0.4:
        raise SystemExit(
            f"FATAL: {what} overflows: {text!r} needs {width:.1f}px > {max_w}px"
        )


def fit(text: str, kind: str, max_w: float, start: int, minimum: int) -> int:
    size = start
    while size > minimum:
        if measure(text, size, kind) <= max_w:
            return size
        size -= 1
    if measure(text, minimum, kind) > max_w + 0.4:
        raise SystemExit(
            f"FATAL: text does not fit {max_w}px at >= {minimum}px: {text!r}"
        )
    return minimum


def fit_lines(lines, kind: str, max_w: float, start: int, minimum: int) -> int:
    return min(fit(line, kind, max_w, start, minimum) for line in lines)


def gradient(w: int, h: int, c1: str, c2: str) -> Image.Image:
    base = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(base)
    a, b = hx(c1), hx(c2)
    for y in range(h):
        t = 0.10 * (y / h) + 0.90 * (y / h) ** 1.4
        draw.line(
            [(0, y), (w, y)],
            fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)),
        )
    return base


def glow(img: Image.Image, cx: int, cy: int, r: int, color: str,
         alpha: int = 30) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for i in range(10, 0, -1):
        rr = r * i / 10
        draw.ellipse(
            [cx - rr, cy - rr, cx + rr, cy + rr],
            fill=hx(color) + (int(alpha * (1 - i / 12)),),
        )
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img: Image.Image, box, s: dict, radius: int = RADIUS,
         shadow: int = SHADOW, fill: str | None = None,
         edge: str | None = None) -> Image.Image:
    """A soft-shadowed rounded card on the gradient background."""
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle(
            [x0 - i // 6, y0 + i // 2, x1 + i // 6, y1 + i],
            radius=radius + i // 5,
            fill=s["shadow"] + (int(8 * (1 - i / shadow)),),
        )
    base = Image.alpha_composite(
        img.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(10))
    )
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(
        box, radius=radius, fill=hx(fill or s["card"]),
        outline=hx(edge or s["card_edge"]), width=2,
    )
    return base.convert("RGB")


def chip(img: Image.Image, xy: tuple[int, int], text: str, s: dict,
         size: float = 11, fg: str | None = None, bg: str | None = None,
         kind: str = "cjk_bold", padx: int = 9,
         height: int | None = None) -> int:
    draw = ImageDraw.Draw(img)
    f = font(size, kind)
    width = draw.textlength(text, font=f)
    x, y = xy
    h = height or int(size + 12)
    draw.rounded_rectangle(
        [x, y, x + width + padx * 2, y + h], radius=h // 2,
        fill=hx(bg or s["pill"]),
    )
    draw.text((x + padx, y + h / 2), text, font=f,
              fill=hx(fg or s["accent"]), anchor="lm")
    return int(width + padx * 2)


def dash_rect(d: ImageDraw.ImageDraw, box, color: str, width: int = 2,
              dash: int = 7, gap: int = 5) -> None:
    x0, y0, x1, y1 = box
    for a, b in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)),
                 ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        if dist == 0:
            continue
        n = int(dist // (dash + gap)) + 1
        for i in range(n):
            t0 = i * (dash + gap) / dist
            t1 = min((i * (dash + gap) + dash) / dist, 1.0)
            if t0 >= 1:
                break
            d.line(
                [(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                 (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)],
                fill=hx(color), width=width,
            )


# --------------------------------------------------------------------------- hero
# Values below are excerpts of samples/quickstart/input/import-set.json and
# expected/result.json; the counts are the ones the shipped fixture produces.
HERO = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · 进口单证核对器",
        value=["四份单证，逐字段对照", "一处不一致点名到字段"],
        sub=["先按固定口径规范化：格式差异不算不一致；",
             "报关单 12 项要素单独点名缺哪一项。"],
        meta="9 字段 × 4 单证 · 12 项要素 · CSV · 全程本地",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        shipment="SHP-2026-0618 · 一票货 · 四份单证",
        docs=["发票", "装箱单", "提单", "报关单"],
        counts=["9/9", "5/9", "5/9", "9/9"],
        gross=["毛重 2450.00", "毛重 2450.00", "毛重 2450.00", "毛重 2450.50"],
        read_chip="四单证 · 只读",
        cmp_label="毛重 · gross_weight_kg",
        cmp_tag="mismatch",
        cmp_values=["2450.00", "2450.00", "2450.00", "2450.50"],
        cmp_summary="8 一致 · 1 不一致 · 单一来源 0 · 未提供 0",
        passline="pass = false",
        elems_label="报关单 12 项要素",
        elems_result="11/12 · 缺 装货港",
        complete="complete = false",
        missing="missing[0] = port_of_loading",
        csv="import_export → CSV · 9 行 · sha256",
        path="exports/import-check-ca764bab6159.csv",
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · import-document checker",
        value=["Four documents, nine fields", "one mismatch called by name"],
        sub=["Normalised first: formatting is not a mismatch;",
             "declaration elements are listed on their own."],
        meta="9 fields × 4 documents · 12 elements · CSV · local only",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        shipment="SHP-2026-0618 · one shipment · four documents",
        docs=["INVOICE", "PACKING", "B/L", "CUSTOMS"],
        counts=["9/9", "5/9", "5/9", "9/9"],
        gross=["gross 2450.00", "gross 2450.00", "gross 2450.00", "gross 2450.50"],
        read_chip="4 documents · read-only",
        cmp_label="gross_weight_kg",
        cmp_tag="mismatch",
        cmp_values=["2450.00", "2450.00", "2450.00", "2450.50"],
        cmp_summary="8 consistent · 1 mismatch · 0 single · 0 missing",
        passline="pass = false",
        elems_label="12 declaration elements",
        elems_result="11/12 · missing port_of_loading",
        complete="complete = false",
        missing="missing[0] = port_of_loading",
        csv="import_export → CSV · 9 rows · sha256",
        path="exports/import-check-ca764bab6159.csv",
    ),
}


def hero(lang: str, skin: str) -> None:
    h = HERO[lang]
    s = SKIN[skin]
    W, H = 1440, 576
    img = gradient(W, H, s["bg_from"], s["bg_to"])
    if skin == "light":
        img = glow(img, 1130, 210, 330, s["glow"], 26)
        img = glow(img, 180, 470, 300, "#ffffff", 70)
    else:
        img = glow(img, 1130, 200, 360, s["glow"], 20)
        img = glow(img, 200, 500, 280, "#1b2a4a", 45)
    d = ImageDraw.Draw(img)

    # ---- left column: kicker / title / value / sub / meta / footer ----------
    m = 60
    chip(img, (m, 54), h["kicker"], s, size=17, padx=17)

    title = "dsh-import-customs-check"
    col_w = 660
    title_size = fit(title, "mono_bold", col_w, 52, 48)
    d.text((m - 2, 116), title, font=font(title_size, "mono_bold"),
           fill=hx(s["text"]))

    value_size = fit_lines(h["value"], "cjk_bold", col_w, 38, 34)
    for i, line in enumerate(h["value"]):
        require_w(line, value_size, "cjk_bold", col_w, "hero value")
        d.text((m, 206 + i * 54), line, font=font(value_size, "cjk_bold"),
               fill=hx(s["text"]))

    for i, line in enumerate(h["sub"]):
        require_w(line, 24, "cjk", col_w, "hero sub")
        d.text((m + 1, 330 + i * 36), line, font=font(24, "cjk"),
               fill=hx(s["sub"]))

    d.rounded_rectangle([m + 2, 414, m + 62, 418], radius=2,
                        fill=hx(s["accent"]))
    require_w(h["meta"], 20, "cjk", col_w, "hero meta")
    d.text((m + 1, 430), h["meta"], font=font(20, "cjk"), fill=hx(s["faint"]))
    require_w(h["foot"], 17, "cjk", col_w, "hero footer")
    d.text((m + 1, 496), h["foot"], font=font(17, "cjk"), fill=hx(s["faint"]))

    # ---- right card: the document set, the comparison, the 12 slots ---------
    cx0, cy0, cx1, cy1 = 736, 48, 1380, 524
    img = card(img, (cx0, cy0, cx1, cy1), s, radius=22)
    d = ImageDraw.Draw(img)

    d.text((cx0 + 22, cy0 + 18), "import-set.json",
           font=font(18, "mono_bold"), fill=hx(s["text"]))
    d.text((cx0 + 22, cy0 + 46), h["shipment"],
           font=font(11.5, "cjk"), fill=hx(s["sub"]))
    chip_w = measure(h["read_chip"], 10.5, "cjk_bold") + 20
    chip(img, (int(cx1 - 22 - chip_w), cy0 + 18), h["read_chip"], s,
         size=10.5, padx=10)
    d = ImageDraw.Draw(img)
    d.line([(cx0 + 22, cy0 + 74), (cx1 - 22, cy0 + 74)],
           fill=hx(s["card_edge"]), width=1)

    # four document tiles, each with its real field coverage
    tx = cx0 + 22
    ty = cy0 + 88
    tw, th, tg = 143, 96, 10
    for i in range(4):
        x = tx + i * (tw + tg)
        accent = s["accent"] if i < 3 else s["mark"]
        d.rounded_rectangle([x, ty, x + tw, ty + th], radius=13,
                            fill=hx(s["band"]), outline=hx(s["card_edge"]),
                            width=1)
        d.ellipse([x + 14, ty + 13, x + 21, ty + 20], fill=hx(accent))
        d.text((x + 27, ty + 8), h["docs"][i],
               font=font(13 if lang == "zh" else 11.2, "cjk_bold"),
               fill=hx(s["text"]))
        d.text((x + tw - 11, ty + 11), h["counts"][i],
               font=font(9.5, "mono"), fill=hx(s["faint"]), anchor="ra")
        gross_color = s["mark"] if i == 3 else s["sub"]
        d.text((x + 12, ty + 36), h["gross"][i],
               font=font(10.5, "mono"), fill=hx(gross_color))
        # nine coverage cells: filled = that document provides the field
        filled = [9, 5, 5, 9][i]
        for c in range(9):
            bx = x + 12 + c * 12.4
            if c < filled:
                d.rounded_rectangle([bx, ty + 62, bx + 9, ty + 68], radius=2,
                                    fill=hx(accent))
            else:
                d.rounded_rectangle([bx, ty + 62, bx + 9, ty + 68], radius=2,
                                    fill=hx(s["grid"]))


    # collector: four documents -> one nine-field comparison
    line_y = ty + th + 18
    d.line([(tx + tw // 2, ty + th), (tx + tw // 2, line_y)],
           fill=hx(s["card_edge"]), width=2)
    d.line([(tx + 3 * (tw + tg) + tw // 2, ty + th),
            (tx + 3 * (tw + tg) + tw // 2, line_y)],
           fill=hx(s["card_edge"]), width=2)
    d.line([(tx + tw // 2, line_y),
            (tx + 3 * (tw + tg) + tw // 2, line_y)],
           fill=hx(s["card_edge"]), width=2)
    mid_x = tx + (3 * (tw + tg) + tw) // 2
    d.line([(mid_x, line_y), (mid_x, line_y + 14)],
           fill=hx(s["card_edge"]), width=2)
    d.polygon([(mid_x - 5, line_y + 13), (mid_x + 5, line_y + 13),
               (mid_x, line_y + 21)], fill=hx(s["card_edge"]))
    d.text((tx, line_y + 17), "四单证 → 9 个字段" if lang == "zh"
           else "4 documents → 9 fields", font=font(9.5, "cjk"),
           fill=hx(s["faint"]))

    # comparison panel: one row, four values, one mismatch
    py0 = line_y + 28
    py1 = py0 + 120
    d.rounded_rectangle([tx, py0, cx1 - 22, py1], radius=14,
                        fill=hx(s["mark_bg"] if skin == "light" else s["band"]),
                        outline=hx(s["mark_edge"]), width=1)
    d.text((tx + 14, py0 + 11), h["cmp_label"],
           font=font(11.5, "cjk_bold"), fill=hx(s["text"]))
    starts = [tx + 14, tx + 156, tx + 298, tx + 440]
    tag_w = measure(h["cmp_tag"], 9.5, "cjk_bold") + 18
    d.rounded_rectangle([starts[3], py0 + 10, starts[3] + tag_w, py0 + 30],
                        radius=10, fill=hx(s["mark_bg"]))
    d.text((starts[3] + 9, py0 + 14), h["cmp_tag"],
           font=font(9.5, "cjk_bold"), fill=hx(s["mark"]))
    for i, value in enumerate(h["cmp_values"]):
        d.text((starts[i], py0 + 38), value,
               font=font(17, "mono_bold"),
               fill=hx(s["mark"] if i == 3 else s["text"]))
        d.text((starts[i], py0 + 62), h["docs"][i],
               font=font(9, "cjk"), fill=hx(s["faint"]))
    d.text((tx + 14, py1 - 26), h["cmp_summary"],
           font=font(9.5, "cjk"), fill=hx(s["sub"]))
    pw = measure(h["passline"], 10, "mono_bold")
    d.text((cx1 - 22 - 14 - pw, py1 - 27), h["passline"],
           font=font(10, "mono_bold"), fill=hx(s["mark"]))

    # twelve declaration element slots, the eleventh hollow
    ey = py1 + 22
    d.text((tx, ey), h["elems_label"], font=font(11.5, "cjk_bold"),
           fill=hx(s["text"]))
    ew = measure(h["elems_result"], 10, "cjk_bold")
    d.text((cx1 - 22 - 14 - ew, ey + 1), h["elems_result"],
           font=font(10, "cjk_bold"), fill=hx(s["mark"]))
    sy = ey + 18
    for i in range(12):
        x = tx + i * 32
        missing = i == 10
        if missing:
            dash_rect(d, (x, sy, x + 26, sy + 26), s["mark"], 2, 4, 3)
            d.text((x + 13, sy + 7), "!", font=font(11, "mono_bold"),
                   fill=hx(s["mark"]), anchor="ma")
        else:
            d.rounded_rectangle([x, sy, x + 26, sy + 26], radius=7,
                                fill=hx(s["pill"]))
            d.text((x + 13, sy + 8), str(i + 1), font=font(9, "mono"),
                   fill=hx(s["accent"]), anchor="ma")
    d.text((tx + 402, sy + 3), h["complete"], font=font(9, "mono"),
           fill=hx(s["mark"]))
    d.text((tx + 402, sy + 16), h["missing"], font=font(8.5, "mono"),
           fill=hx(s["faint"]))

    # export strip: only the consistency table leaves as CSV
    by0 = sy + 36
    d.rounded_rectangle([tx, by0, cx1 - 22, by0 + 28], radius=14,
                        fill=hx(s["band"]), outline=hx(s["card_edge"]), width=1)
    d.text((tx + 14, by0 + 8), h["csv"], font=font(10, "mono"),
           fill=hx(s["text"]))
    pw = measure(h["path"], 8.5, "mono")
    d.text((cx1 - 22 - 14 - pw, by0 + 9), h["path"], font=font(8.5, "mono"),
           fill=hx(s["faint"]))

    name = f"dsh-import-customs-check-hero-{lang}-{skin}.webp"
    img.save(os.path.join(OUT, name), "WEBP", quality=93, method=6)


# --------------------------------------------------------------------------- flow
SVG_SKIN = {
    "light": dict(
        bg1="#f9f6fd", bg2="#e4eaf8", card="#ffffff", edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", green="#16a34a", mark="#b45309",
        pill="#ece7f9", band="#f5f2fb", grid="#e7e4f0",
        soft="#16122c", glow="#7a68c9", shadow_opacity="0.10",
    ),
    "dark": dict(
        bg1="#131a2a", bg2="#0c1016", card="#1b2231", edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", green="#3fb950", mark="#d9a441",
        pill="#242d42", band="#202839", grid="#2b3448",
        soft="#000000", glow="#8496f5", shadow_opacity="0.22",
    ),
}

CJK = "'Microsoft YaHei','PingFang SC','Noto Sans CJK SC','Source Han Sans SC',sans-serif"
MONO = "'Consolas','SFMono-Regular','Menlo',ui-monospace,monospace"


def tw(text: str, size: float, mono: bool = False) -> float:
    """Conservative width estimate for SVG layout (Chrome renders close)."""
    total = 0.0
    for ch in text:
        if ord(ch) > 0x2E80:
            total += size * (1.0 if not mono else 1.0)
        elif ch in " .,:;!'|iIl":
            total += size * (0.30 if not mono else 0.60)
        elif ch.isupper():
            total += size * (0.64 if not mono else 0.60)
        elif ch.isdigit():
            total += size * (0.60 if not mono else 0.60)
        else:
            total += size * (0.55 if not mono else 0.60)
    return total


class V:
    def __init__(self, skin: str):
        self.s = SVG_SKIN[skin]
        self.body: list[str] = []
        s = self.s
        self.head = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="660" '
            'viewBox="0 0 1100 660" role="img" aria-labelledby="title desc">',
            '<title id="title">dsh-import-customs-check structure: one document '
            'set, two independent channels, nine fields and twelve elements</title>',
            '<desc id="desc">A tall import-set.json card lists the four documents '
            'with their real field coverage: invoice 9/9, packing list 5/9, bill '
            'of lading 5/9, customs declaration 9/9, read-only and up to 5 MB. It feeds '
            'two channels that never mix. Channel A is the nine-field consistency '
            'scoreboard: normalise first (uppercase, collapse spaces, strip dots '
            'and hyphens from the HS code, 0.001 kg and 0.01 half-up), then each '
            'field lands in exactly one of four states; the fixture gives 8 '
            'consistent and 1 mismatch (gross weight 2450.50 on the declaration '
            'against 2450.00 three times), so pass=false and strict=true would '
            'raise E_IMPORT_FIELD_MISMATCH. Channel B is the declaration twelve-'
            'slot element strip: 11 present, port_of_loading missing, '
            'complete=false, and this never changes pass. Only channel A reaches '
            'import_export, which writes 9 CSV rows with a sha256 under '
            '$DSH_HOME/dsh-import-customs-check/exports/.</desc>',
            '<defs>',
            f'<linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">'
            f'<stop offset="0" stop-color="{s["bg1"]}"/>'
            f'<stop offset="1" stop-color="{s["bg2"]}"/></linearGradient>',
            f'<radialGradient id="glow" cx="0.82" cy="0.12" r="0.7">'
            f'<stop offset="0" stop-color="{s["glow"]}" stop-opacity="0.16"/>'
            f'<stop offset="1" stop-color="{s["glow"]}" stop-opacity="0"/>'
            f'</radialGradient>',
            f'<filter id="soft" x="-25%" y="-25%" width="150%" height="170%">'
            f'<feDropShadow dx="0" dy="7" stdDeviation="9" '
            f'flood-color="{s["soft"]}" flood-opacity="{s["shadow_opacity"]}"/>'
            f'</filter>',
            f'<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" '
            f'markerWidth="6.6" markerHeight="6.6" orient="auto-start-reverse">'
            f'<path d="M0 0 L10 5 L0 10 z" fill="{s["accent"]}"/></marker>',
            '</defs>',
            f'<rect width="1100" height="660" fill="url(#bg)"/>',
            '<rect width="1100" height="660" fill="url(#glow)"/>',
        ]

    def add(self, *parts: str) -> None:
        self.body.extend(parts)

    def text(self, x: float, y: float, text: str, size: float = 13,
             fill: str | None = None, weight: int = 400,
             anchor: str = "start", mono: bool = False,
             max_w: float | None = None, opacity: float = 1.0) -> None:
        s = self.s
        if max_w is not None and tw(text, size, mono) > max_w + 0.5:
            raise SystemExit(
                f"FATAL: svg text overflows {max_w}px: {text!r} "
                f"({tw(text, size, mono):.1f}px)"
            )
        family = MONO if mono else CJK
        extra = f' opacity="{opacity}"' if opacity != 1 else ""
        self.body.append(
            f'<text x="{x:.1f}" y="{y:.1f}" fill="{fill or s["text"]}" '
            f'font-family="{family}" font-size="{size:g}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{extra}>'
            f'{escape(text)}</text>'
        )

    def rect(self, x: float, y: float, w: float, h: float, r: float = 12,
             fill: str | None = None, stroke: str | None = None,
             sw: float = 1.5, dash: str | None = None,
             shadow: bool = False, opacity: float = 1.0) -> None:
        s = self.s
        attrs = [
            f'x="{x:.1f}"', f'y="{y:.1f}"', f'width="{w:.1f}"',
            f'height="{h:.1f}"', f'rx="{r:.1f}"',
            f'fill="{fill or s["card"]}"',
        ]
        if stroke:
            attrs.append(f'stroke="{stroke}" stroke-width="{sw}"')
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if shadow:
            attrs.append('filter="url(#soft)"')
        if opacity != 1:
            attrs.append(f'opacity="{opacity}"')
        self.body.append(f'<rect {" ".join(attrs)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float,
             stroke: str | None = None, sw: float = 1.6,
             dash: str | None = None, marker: bool = False) -> None:
        s = self.s
        attrs = [
            f'x1="{x1:.1f}"', f'y1="{y1:.1f}"',
            f'x2="{x2:.1f}"', f'y2="{y2:.1f}"',
            f'stroke="{stroke or s["edge"]}"', f'stroke-width="{sw}"',
        ]
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append('marker-end="url(#arr)"')
        self.body.append(f'<line {" ".join(attrs)}/>')

    def circle(self, cx: float, cy: float, r: float, fill: str,
               stroke: str | None = None, sw: float = 1.5) -> None:
        extra = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        self.body.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
            f'fill="{fill}"{extra}/>'
        )

    def chip_l(self, x: float, y: float, text: str, size: float,
               fg: str | None = None, bg: str | None = None,
               pad: float = 8, h: float | None = None,
               weight: int = 700, mono: bool = False) -> float:
        s = self.s
        height = h or size + 11
        width = tw(text, size, mono) + pad * 2
        self.rect(x, y, width, height, r=height / 2,
                  fill=bg or s["pill"], stroke=None)
        self.text(x + pad, y + height / 2 + size * 0.35, text, size,
                  fill=fg or s["accent"], weight=weight, mono=mono)
        return width

    def chip_r(self, x_right: float, y: float, text: str, size: float,
               fg: str | None = None, bg: str | None = None,
               pad: float = 8, h: float | None = None,
               weight: int = 700, mono: bool = False) -> float:
        height = h or size + 11
        width = tw(text, size, mono) + pad * 2
        self.chip_l(x_right - width, y, text, size, fg=fg, bg=bg,
                    pad=pad, h=height, weight=weight, mono=mono)
        return width

    def svg(self) -> str:
        return "\n".join(self.head + self.body + ["</svg>"]) + "\n"


def flow(skin: str) -> str:
    s = SVG_SKIN[skin]
    v = V(skin)
    acc = s["accent"]
    mark = s["mark"]
    green = s["green"]
    text = s["text"]
    sub = s["sub"]
    faint = s["faint"]
    edge = s["edge"]
    band = s["band"]
    pill = s["pill"]

    # ---- header -------------------------------------------------------------
    v.text(34, 50, "dsh-import-customs-check", 28, fill=text,
           weight=700, mono=True)
    v.text(34, 78, "一份单证集，两条独立通道：A 判 9 个字段是否一致，B 点报关单 12 项要素缺哪项；只有对照表能导出 CSV。",
           14.2, fill=sub, max_w=930)
    v.chip_r(1066, 34, "4 单证 · 9 字段 · 12 要素", 11, fg=acc, bg=pill)

    # ---- input binder -------------------------------------------------------
    ix, iy, iw, ih = 34, 106, 214, 492
    v.rect(ix, iy, iw, ih, r=20, fill=s["card"], stroke=edge, shadow=True)
    v.text(ix + 18, iy + 28, "import-set.json", 15, fill=text,
           weight=700, mono=True)
    v.chip_r(ix + iw - 14, iy + 14, "只读", 9.5, fg=acc, bg=pill)
    v.text(ix + 18, iy + 48, "SHP-2026-0618 · 单票", 11, fill=faint,
           mono=True)
    v.line(ix + 18, iy + 58, ix + iw - 18, iy + 58, stroke=edge, sw=1)
    v.text(ix + 18, iy + 80, "四份单证 · 字段覆盖", 11, fill=faint)

    docs = [
        ("商业发票", "9/9", 9),
        ("装箱单", "5/9", 5),
        ("提单", "5/9", 5),
        ("报关单", "9/9", 9),
    ]
    for i, (name, count, filled) in enumerate(docs):
        ry = iy + 92 + i * 62
        v.circle(ix + 22, ry + 12, 3.5, acc if i < 3 else mark)
        v.text(ix + 32, ry + 17, name, 13, fill=text, weight=700)
        v.text(ix + iw - 18, ry + 17, count, 11, fill=faint,
               mono=True, anchor="end")
        for c in range(9):
            bx = ix + 20 + c * 18.2
            if c < filled:
                v.rect(bx, ry + 28, 15, 7, r=2,
                       fill=acc if i < 3 else mark, stroke=None)
            else:
                v.rect(bx, ry + 28, 15, 7, r=2, fill=s["grid"], stroke=None)

    v.line(ix + 18, iy + 346, ix + iw - 18, iy + 346, stroke=edge, sw=1)
    v.text(ix + 18, iy + 368, "输入边界", 11, fill=faint)
    v.text(ix + 18, iy + 390, "只读原文件 · ≤ 5 MB", 11, fill=sub)
    v.text(ix + 18, iy + 410, "别名归一 · 四份缺一不可", 11, fill=sub)
    v.text(ix + 18, iy + 430, "不联网 · 不调用模型", 11, fill=sub)
    v.text(ix + 18, iy + 466, "9 字段 × 4 单证", 11, fill=acc, weight=700)
    v.text(ix + 18, iy + 484, "12 项要素 · 源 JSON 不变", 10.5, fill=faint)

    # ---- bus: one source, two branches -------------------------------------
    bus_x = 266
    v.line(ix + iw, 220, bus_x, 220, stroke=edge, sw=2)
    v.line(bus_x, 220, bus_x, 528, stroke=edge, sw=2)
    v.line(bus_x, 220, 282, 220, stroke=acc, sw=2, marker=True)
    v.line(bus_x, 528, 282, 528, stroke=acc, sw=2, marker=True)
    v.circle(bus_x, 220, 3, acc, stroke=None)
    v.circle(bus_x, 528, 3, acc, stroke=None)

    # ---- channel A: nine-field scoreboard ----------------------------------
    ax, ay, aw, ah = 286, 106, 506, 334
    v.rect(ax, ay, aw, ah, r=20, fill=s["card"], stroke=edge, shadow=True)
    v.text(ax + 20, ay + 28, "A · 一致性对照", 15.5, fill=text, weight=700)
    v.text(ax + 140, ay + 28, "import_check", 12.5, fill=acc,
           weight=700, mono=True)
    v.chip_r(ax + aw - 16, ay + 14, "R0 只读", 10.2, fg=acc, bg=pill)
    v.text(ax + 20, ay + 50, "9 个表头字段 × 4 份单证 · 规范化后逐字段判定",
           11, fill=sub)

    # normalisation band (the rule lives in src/core/check.ts)
    v.rect(ax + 20, ay + 62, aw - 40, 28, r=9, fill=band, stroke=edge, sw=1)
    v.text(ax + 30, ay + 80,
           "规范化：转大写 · 合并/去空格 · 去逗号 · HS 去点/连字符 · 0.001 kg / 0.01 half-up",
           10.8, fill=sub,
           max_w=aw - 60)

    fields = [
        ("发票号", "INV-2026-0618", "一致", False),
        ("合同号", "CT-2026-0042", "一致", False),
        ("件数", "120", "一致", False),
        ("毛重", "2450.50 ≠ 2450.00", "不一致", True),
        ("净重", "2280.000", "一致", False),
        ("金额", "184500.00", "一致", False),
        ("币种", "USD", "一致", False),
        ("HS 编码", "8471.30.00 ≡ 84713000", "一致", False),
        ("原产国", "CN", "一致", False),
    ]
    cw, ch, gx, gy = 150, 58, 6, 8
    for i, (label, value, state, bad) in enumerate(fields):
        col, row = i % 3, i // 3
        x = ax + 20 + col * (cw + gx)
        y = ay + 100 + row * (ch + gy)
        v.rect(x, y, cw, ch, r=11,
               fill=s["mark"] + "12" if bad and skin == "light" else
               ("#2a2216" if bad else band),
               stroke=mark if bad else edge,
               sw=1.6 if bad else 1)
        v.text(x + 10, y + 17, label, 13, fill=text, weight=700)
        v.chip_r(x + cw - 8, y + 7, state, 10.2,
                 fg=mark if bad else green,
                 bg=("#f7e3cc" if skin == "light" else "#3a2c18") if bad
                 else ("#eaf7ee" if skin == "light" else "#15291c"))
        v.text(x + 10, y + 39, value, 10.2 if bad or label == "HS 编码" else 10.6,
               fill=mark if bad else sub, mono=True, max_w=cw - 20)

    v.text(ax + 20, ay + 315,
           "四态：一致 8 · 不一致 1 · 单一来源 0 · 未提供 0",
           10.2, fill=faint, max_w=320)
    v.text(ax + aw - 20, ay + 315, "pass = mismatch === 0", 10.2,
           fill=faint, mono=True, anchor="end")

    # ---- summary card -------------------------------------------------------
    sx, sy, sw_, sh_ = 812, 106, 254, 194
    v.rect(sx, sy, sw_, sh_, r=18, fill=s["card"], stroke=edge, shadow=True)
    v.rect(sx, sy + 14, 4, sh_ - 28, r=2, fill=mark, stroke=None)
    v.text(sx + 18, sy + 26, "import_check · summary", 11, fill=faint,
           mono=True)
    v.text(sx + 18, sy + 58, "pass = false", 21, fill=mark,
           weight=700, mono=True)
    for i in range(9):
        v.rect(sx + 18 + i * 24.5, sy + 72, 20, 7, r=2,
               fill=mark if i == 3 else acc, stroke=None)
    rows = [
        ("一致", "8", acc),
        ("不一致", "1", mark),
        ("单一来源", "0", faint),
        ("未提供", "0", faint),
    ]
    for i, (label, count, color) in enumerate(rows):
        ry = sy + 100 + i * 18
        v.text(sx + 18, ry, label, 10.8, fill=sub)
        v.text(sx + sw_ - 18, ry, count, 11, fill=color,
               mono=True, anchor="end")
    v.line(sx + 18, sy + 172, sx + sw_ - 18, sy + 172, stroke=edge, sw=1)
    v.text(sx + 18, sy + 188, "strict → E_IMPORT_FIELD_MISMATCH",
           10.2, fill=faint, mono=True, max_w=sw_ - 36)

    # ---- export card (fed by A only) ---------------------------------------
    ex, ey, ew, eh = 812, 318, 254, 122
    v.rect(ex, ey, ew, eh, r=18, fill=s["card"], stroke=edge, shadow=True)
    v.text(ex + 18, ey + 26, "import_export", 13.5, fill=text,
           weight=700, mono=True)
    v.chip_r(ex + ew - 14, ey + 13, "R1 本地写", 10, fg=green, bg=pill)
    v.text(ex + 18, ey + 48, "CSV · 9 行 · sha256", 11, fill=sub, mono=True)
    v.text(ex + 18, ey + 68, "$DSH_HOME/dsh-import-customs-check/",
           9.4, fill=faint, mono=True, max_w=ew - 36)
    v.text(ex + 18, ey + 82, "exports/import-check-ca764bab6159.csv",
           9.4, fill=faint, mono=True, max_w=ew - 36)
    v.text(ex + 18, ey + 104, "只从对照表导出；要素表不进 CSV", 10.4,
           fill=sub, max_w=ew - 36)
    v.line(ax + aw, 220, ex - 2, 220, stroke=acc, sw=2, marker=True)
    v.line(ax + aw, 380, ex - 2, 380, stroke=acc, sw=2, marker=True)

    # ---- channel B: twelve declaration slots -------------------------------
    bx, by, bw, bh = 286, 450, 506, 156
    v.rect(bx, by, bw, bh, r=20, fill=s["card"], stroke=edge, shadow=True)
    v.text(bx + 20, by + 28, "B · 要素完整性", 15.5, fill=text, weight=700)
    v.text(bx + 134, by + 28, "import_elements", 12.5, fill=acc,
           weight=700, mono=True)
    v.chip_r(bx + bw - 16, by + 14, "R0 只读", 10.2, fg=acc, bg=pill)

    elements = [
        "报关单号", "申报日期", "境内收发货人", "境外收发货人",
        "运输方式", "运输工具名称", "提运单号", "监管方式",
        "征免性质", "原产国（地区）", "装货港", "境内目的地",
    ]
    cellw, cellh, cgap = 113.5, 26, 4
    for i, label in enumerate(elements):
        col, row = i % 4, i // 4
        x = bx + 20 + col * (cellw + cgap)
        y = by + 46 + row * (cellh + cgap)
        missing = i == 10
        if missing:
            v.rect(x, y, cellw, cellh, r=8, fill="#fdf3e9" if skin == "light" else "#2a2216",
                   stroke=mark, sw=1.4, dash="4 3")
            v.text(x + 20, y + 17, label, 13, fill=mark, weight=700)
            v.text(x + cellw - 9, y + 17, "缺", 9.2, fill=mark,
                   anchor="end", weight=700)
        else:
            v.rect(x, y, cellw, cellh, r=8, fill=band, stroke=edge, sw=1)
            v.circle(x + 11, y + 13, 4.5, "#eaf7ee" if skin == "light"
                     else "#15291c", stroke=None)
            v.text(x + 11, y + 15.2, "✓", 6.8, fill=green, anchor="middle")
            v.text(x + 20, y + 17, label, 13, fill=text)

    v.text(bx + 20, by + 148, "11/12 · 缺 装货港",
           10.6, fill=mark, weight=700, max_w=170)
    v.text(bx + bw - 16, by + 148,
           "complete=false · 不写 CSV",
           10.4, fill=faint, anchor="end", max_w=230)

    # ---- footer -------------------------------------------------------------
    v.text(34, 626, "两条通道互不混用：缺要素不会让 pass 变 false", 11,
           fill=sub, max_w=470)
    v.text(1066, 626, "只读输入 · 不联网 · 不调用模型 · 无 Config 键", 11,
           fill=faint, anchor="end", max_w=520)

    return v.svg()


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for lang in ("zh", "en"):
        for skin in ("light", "dark"):
            hero(lang, skin)
    for skin in ("light", "dark"):
        name = f"dsh-import-customs-check-flow-v5-{skin}.svg"
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(flow(skin))
    print("wrote 4 hero webp + 2 flow-v5 svg to docs/assets/")


if __name__ == "__main__":
    main()
