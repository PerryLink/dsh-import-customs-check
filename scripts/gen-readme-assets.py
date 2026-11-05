#!/usr/bin/env python3
"""Generate README image assets for dsh-import-customs-check (docs/assets/).

Outputs (idempotent overwrite):
  dsh-import-customs-check-flow-light.svg / dsh-import-customs-check-flow-dark.svg
      Hero pipeline diagram. Two hand-written SVG files (vector — never
      rasterized to webp). Text inside is command-surface tokens only
      (document keys, tool names, field/element counts, paths, risk levels),
      so all five README languages share the same pair. No CJK text is drawn,
      so this repo needs no Pillow rasterization and no CJK font probe.

Existing assets (docs/assets/quickstart.png, quickstart.log) are real
captured output and are kept untouched.

Run once:  python scripts/gen-readme-assets.py
Requires:  Python 3.10+ (standard library only)
"""
from __future__ import annotations

import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges labelColor family uses #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e"),
}


def box(x: int, y: int, w: int, h: int, label: str, sub: str,
        accent: str, s: dict) -> list[str]:
    return [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" '
        f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>',
        f'<text x="{x + w // 2}" y="{y + 38}" fill="{s["text"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="15" font-weight="700">{label}</text>',
        f'<text x="{x + w // 2}" y="{y + 66}" fill="{s["sub"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="11">{sub}</text>',
    ]


def arrow(x1: int, y1: int, x2: int, y2: int, s: dict) -> list[str]:
    angle = math.degrees(math.atan2(y2 - y1, x2 - x1)) if x2 != x1 else 0
    return [
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="{s["sub"]}" stroke-width="3"/>',
        f'<path d="M-8 -6 L8 0 L-8 6 Z" fill="{s["sub"]}" '
        f'transform="translate({x2} {y2}) rotate({angle:.1f})"/>',
    ]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 470
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" '
        f'aria-label="dsh-import-customs-check pipeline">',
        '<title>dsh-import-customs-check pipeline</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="60" y="62" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">'
        f'dsh-import-customs-check</text>',
        f'<text x="60" y="94" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">import-set.json → import.check · '
        f'import.elements → import.export · local JSON only</text>',
        f'<line x1="60" y1="116" x2="1140" y2="116" stroke="{s["border"]}"/>',
    ]

    # input -> (check, elements) -> export -> exports
    parts += box(50, 170, 210, 110, "import-set.json",
                 "4 documents · ≤5 MB", s["border"], s)
    parts += box(330, 92, 220, 100, "import.check",
                 "9 fields · strict · R0", FAMILY, s)
    parts += box(330, 258, 220, 100, "import.elements",
                 "12 elements · R0", FAMILY, s)
    parts += box(620, 170, 210, 110, "import.export",
                 "CSV · sha256 · R1", FAMILY, s)
    parts += box(890, 170, 260, 110, "exports/*.csv",
                 "$DSH_HOME/…/exports/", GREEN[skin], s)

    # split: input to both read-only tools
    parts += arrow(262, 208, 326, 150, s)
    parts += arrow(262, 242, 326, 300, s)
    # merge: both tools feed the exporter
    parts += arrow(552, 150, 616, 208, s)
    parts += arrow(552, 300, 616, 242, s)
    # write: exporter to the exports directory
    parts += arrow(832, 225, 886, 225, s)

    # bottom strip: risk + locality tokens
    parts.append(
        f'<rect x="60" y="382" width="1080" height="40" rx="12" '
        f'fill="{s["box"]}" stroke="{FAMILY}" stroke-width="2"/>')
    parts.append(
        f'<text x="600" y="407" fill="{s["text"]}" text-anchor="middle" '
        f'font-family="ui-monospace,monospace" font-size="13">'
        f'R0 read-only: import.check · import.elements ｜ R1 local write: '
        f'import.export ｜ network: none · model: none · source: read-only'
        f'</text>')
    parts.append(
        f'<text x="60" y="452" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="12">documents: 4 · header fields: 9 · '
        f'declaration elements: 12 · precision: 0.01 / 0.001 kg · '
        f'semantic mapping: none</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        name = f"dsh-import-customs-check-flow-{skin}.svg"
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(flow_svg(skin))
    print("wrote 2 SVG assets to docs/assets/")


if __name__ == "__main__":
    main()
