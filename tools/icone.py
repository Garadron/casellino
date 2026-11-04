"""Draws the app icons (a small coloured strip, like the ones under the pigeonholes).

Usage: python tools/icone.py   ->  app/icons/icon-192.png, icon-512.png, apple-touch-icon.png
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "icons"

BACKGROUND = (44, 109, 179)
CELLS = [(157, 195, 230), (169, 208, 142), (255, 230, 153), (244, 182, 194), (248, 203, 173)]


def draw(size):
    s = 4  # draw big, then shrink: smoother edges
    big = size * s
    im = Image.new("RGB", (big, big), BACKGROUND)
    d = ImageDraw.Draw(im)
    # the strip stays inside the central 70% so it survives round "maskable" crops
    left, right = int(big * 0.16), int(big * 0.84)
    top, mid, bottom = int(big * 0.30), int(big * 0.56), int(big * 0.70)
    d.rounded_rectangle([left, top, right, bottom], radius=int(big * 0.03), fill=(255, 255, 255))
    width = (right - left) / len(CELLS)
    line = max(2, int(big * 0.012))
    for k, color in enumerate(CELLS):
        x0 = int(left + k * width)
        x1 = int(left + (k + 1) * width)
        d.rectangle([x0, top, x1, mid], fill=color)
        d.rectangle([x0, mid, x1, bottom], fill=color if k < 2 else (255, 255, 255))
        if k:
            d.rectangle([x0 - line // 2, top, x0 + line // 2, mid], fill=(40, 40, 40))
    d.rectangle([left, mid - line // 2, right, mid + line // 2], fill=(40, 40, 40))
    d.rounded_rectangle([left, top, right, bottom], radius=int(big * 0.03), outline=(40, 40, 40), width=line)
    return im.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        draw(size).save(OUT / name, optimize=True)
        print("Creata", OUT / name)
