# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Draws the app icons: a small casello seen from the front (rows of pigeonholes with their
dividers) with the coloured strips under each row.

Usage: python tools/icone.py   ->  app/icons/icon-192.png, icon-512.png, apple-touch-icon.png,
                                    favicon-64.png, casellino.ico
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "icons"

BACKGROUND = (31, 78, 158)          # blue
FRAME = (236, 240, 245)             # the light metal of the frame
DIVIDER = (150, 160, 172)           # grey plastic dividers
DIVIDER_Y = (255, 205, 40)          # a few yellow dividers, as in a real frame
INK = (25, 25, 25)
STRIPS = [  # colours of the street strips, left to right, one list per row
    [(255, 225, 53), (139, 26, 26), (108, 207, 246)],
    [(142, 209, 107), (91, 42, 148), (255, 154, 46)],
]


def draw(size, safe=0.0):
    s = 4  # draw big, then shrink: smoother edges
    big = size * s
    im = Image.new("RGB", (big, big), BACKGROUND)
    d = ImageDraw.Draw(im)
    pad = int(big * (0.12 + safe))
    left, right = pad, big - pad
    top, bottom = int(big * (0.16 + safe)), big - int(big * (0.16 + safe))
    line = max(2, int(big * 0.012))
    # the frame
    d.rounded_rectangle([left, top, right, bottom], radius=int(big * 0.04), fill=FRAME, outline=INK, width=line)
    rows = len(STRIPS)
    inner_top, inner_bottom = top + int(big * 0.04), bottom - int(big * 0.03)
    row_h = (inner_bottom - inner_top) / rows
    width = right - left - 2 * int(big * 0.04)
    x0 = left + int(big * 0.04)
    for r, colours in enumerate(STRIPS):
        y_top = inner_top + r * row_h
        shelf = y_top + row_h * 0.68           # where the strip starts
        # dividers: rounded tabs standing on the shelf
        n = 9
        step = width / n
        for k in range(n):
            cx = x0 + step * (k + 0.5)
            w = step * 0.42
            colour = DIVIDER_Y if k in (2, 6) else DIVIDER
            d.rounded_rectangle([cx - w / 2, y_top + row_h * 0.12, cx + w / 2, shelf], radius=int(w / 2), fill=colour,
                                outline=INK, width=max(1, line // 2))
        # the strip: three streets, each with its colour; a line between numbers and street name
        seg = width / len(colours)
        for k, colour in enumerate(colours):
            d.rectangle([x0 + seg * k, shelf, x0 + seg * (k + 1), y_top + row_h * 0.98], fill=colour)
        d.rectangle([x0, shelf, x0 + width, y_top + row_h * 0.98], outline=INK, width=line)
        mid = shelf + (y_top + row_h * 0.98 - shelf) * 0.55
        d.line([x0, mid, x0 + width, mid], fill=INK, width=max(1, line // 2))
        for k in range(1, n):
            x = x0 + step * k
            d.line([x, shelf, x, mid], fill=INK, width=max(1, line // 2))
    return im.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, safe in (("icon-192.png", 192, 0.0), ("icon-512.png", 512, 0.0), ("apple-touch-icon.png", 180, 0.0),
                             ("favicon-64.png", 64, 0.0), ("icon-maskable-512.png", 512, 0.06)):
        draw(size, safe).save(OUT / name, optimize=True)
        print("Creata", OUT / name)
    draw(256).save(OUT / "casellino.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Creata", OUT / "casellino.ico")
