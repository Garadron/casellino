# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Writes the tutorial (a comic: how to make the casello from photos) inside app/index.src.html,
between <!-- tutorial:start --> and <!-- tutorial:end -->. The drawings are made here, from a few
pieces (a casello, a sign, a strip), so they stay the same from page to page.
Only made-up zones (9A, 9B), streets and numbers: never the real ones.

Run it after changing a drawing or a text:   python tools/tutorial.py   then   python tools/build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "app" / "index.src.html"

INK = "#2b1d12"
PANEL = "#fdf6e3"
RED, BLUE, GREEN = "#e0442f", "#2f7de0", "#2e9d4a"
COMIC = "font-family=\"'Comic Sans MS','Chalkboard SE','Comic Neue','Segoe Print',sans-serif\""


def defs():
    """The pieces used by every drawing: the postman who explains, the dividers, the colours of a strip."""
    return f"""<svg class="tut-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <symbol id="tut-postino" viewBox="0 0 100 130">
    <path d="M30 128 L32 92 Q50 80 68 92 L70 128 Z" fill="#8ec5ff" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M34 88 L72 122" stroke="#7a4a1f" stroke-width="5" stroke-linecap="round"/>
    <rect x="58" y="104" width="30" height="22" rx="5" fill="#c98b4a" stroke="{INK}" stroke-width="3"/>
    <path d="M58 110 Q73 118 88 110" fill="none" stroke="{INK}" stroke-width="2.5"/>
    <path d="M70 94 Q86 84 90 66" fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 94 Q86 84 90 66" fill="none" stroke="#8ec5ff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="91" cy="60" r="8" fill="#ffd9b0" stroke="{INK}" stroke-width="3"/>
    <circle cx="50" cy="56" r="27" fill="#ffd9b0" stroke="{INK}" stroke-width="3"/>
    <path d="M22 50 Q24 18 50 16 Q76 18 78 50 Q50 40 22 50 Z" fill="#2c6db3" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M58 46 Q80 42 92 50 Q76 56 60 52 Z" fill="#23558c" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="31" r="7" fill="#ffd23f" stroke="{INK}" stroke-width="2"/>
    <text x="50" y="35" font-size="10" font-weight="700" text-anchor="middle" fill="{INK}" {COMIC}>C</text>
    <ellipse cx="41" cy="58" rx="4" ry="5.5" fill="{INK}"/><ellipse cx="60" cy="58" rx="4" ry="5.5" fill="{INK}"/>
    <circle cx="42.5" cy="56" r="1.6" fill="#fff"/><circle cx="61.5" cy="56" r="1.6" fill="#fff"/>
    <circle cx="33" cy="67" r="4.5" fill="#ff9e9e" opacity=".7"/><circle cx="68" cy="67" r="4.5" fill="#ff9e9e" opacity=".7"/>
    <path d="M41 68 Q50 79 60 68 Z" fill="#a33b2a" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>
  </symbol>
  <pattern id="tut-fins" width="24" height="22" patternUnits="userSpaceOnUse">
    <path d="M1 22 V8 a3 3 0 0 1 6 0 V22 Z M9 22 V8 a3 3 0 0 1 6 0 V22 Z" fill="#cfd3d6" stroke="#5c6368" stroke-width=".9"/>
    <path d="M17 22 V8 a3 3 0 0 1 6 0 V22 Z" fill="#f7c948" stroke="#5c6368" stroke-width=".9"/>
  </pattern>
  <pattern id="tut-strip" width="44" height="8" patternUnits="userSpaceOnUse">
    <rect width="11" height="8" fill="#8fd3ff"/><rect x="11" width="11" height="8" fill="#a6e28a"/>
    <rect x="22" width="11" height="8" fill="#ffe37a"/><rect x="33" width="11" height="8" fill="#ffb3b3"/>
    <path d="M11 0V8M22 0V8M33 0V8M44 0V8" stroke="{INK}" stroke-width=".6"/>
  </pattern>
</defs></svg>"""


def module(x, y, w, rows=4, rowh=34):
    """A casello or an ala: a frame with 4 rows of dividers, each with its strip in front."""
    h = rows * rowh + 6
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="#dfe3e6" stroke="{INK}" stroke-width="3"/>']
    for r in range(rows):
        ry = y + 3 + r * rowh
        out.append(f'<rect x="{x + 4}" y="{ry}" width="{w - 8}" height="{rowh - 9}" fill="#4b5560"/>')
        out.append(f'<rect x="{x + 4}" y="{ry + 4}" width="{w - 8}" height="{rowh - 13}" fill="url(#tut-fins)"/>')
        out.append(f'<rect x="{x + 3}" y="{ry + rowh - 10}" width="{w - 6}" height="8" fill="url(#tut-strip)" stroke="{INK}" stroke-width="1.6"/>')
        out.append(f'<rect x="{x + 1}" y="{ry + rowh - 12}" width="6" height="11" rx="2" fill="#3d7be0" stroke="{INK}" stroke-width="1.2"/>')
        out.append(f'<rect x="{x + w - 7}" y="{ry + rowh - 12}" width="6" height="11" rx="2" fill="#3d7be0" stroke="{INK}" stroke-width="1.2"/>')
    return "\n".join(out)


def board(x, y, w, h, name):
    """The sign of a sub-zone: a white board with a yellow border and the name written big."""
    fs = round(h * 0.5)
    return f"""<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="#fffdf2" stroke="{INK}" stroke-width="3"/>
<rect x="{x + 4}" y="{y + 4}" width="{w - 8}" height="{h - 8}" rx="2" fill="none" stroke="#f2c230" stroke-width="3"/>
<path d="M{x + 9} {y + h * 0.3:.0f}h{w * 0.3:.0f}M{x + 9} {y + h * 0.45:.0f}h{w * 0.25:.0f}M{x + 9} {y + h * 0.6:.0f}h{w * 0.3:.0f}" stroke="#9a8f80" stroke-width="2" stroke-linecap="round"/>
<text x="{x + w * 0.7:.0f}" y="{y + h * 0.66:.0f}" font-size="{fs}" font-weight="900" text-anchor="middle" fill="#f7c948" stroke="{INK}" stroke-width="{max(1, fs / 18):.1f}" paint-order="stroke" {COMIC}>{name}</text>"""


def sheet(x, y, w, h, name, streets=()):
    """The itinerary: a sheet with the name of the sub-zone on top and the list of the streets."""
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="#fff" stroke="{INK}" stroke-width="2.5"/>',
           f'<rect x="{x + 2}" y="{y + 2}" width="{w - 4}" height="{h * 0.16:.0f}" fill="#ffe37a"/>',
           f'<text x="{x + w / 2:.0f}" y="{y + h * 0.13:.0f}" font-size="{min(h * 0.1, (w - 6) / (len(name) * 0.6)):.1f}" font-weight="700" text-anchor="middle" fill="{INK}" {COMIC}>{name}</text>']
    top = y + h * 0.26
    step = (h * 0.7) / max(6, len(streets) or 6)
    if streets:
        size = min(step * 0.62, (w - 8) / (max(len(s) for s in streets) * 0.6))
        for k, s in enumerate(streets):
            out.append(f'<text x="{x + 4}" y="{top + k * step + step * 0.6:.0f}" font-size="{size:.1f}" fill="{INK}" {COMIC}>{s}</text>')
    else:
        for k in range(6):
            out.append(f'<path d="M{x + 4} {top + k * step:.0f}h{w * (0.7 if k % 2 else 0.85):.0f}" stroke="#9a8f80" stroke-width="1.6" stroke-linecap="round"/>')
    return "\n".join(out)


def frame(x, y, w, h, color, number, dim=False):
    """The photo: a dashed frame with its number in a circle."""
    op = ' opacity=".35"' if dim else ''
    return f"""<g{op}><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="none" stroke="{color}" stroke-width="4" stroke-dasharray="10 6"/>
<circle cx="{x + 12}" cy="{y + 12}" r="11" fill="{color}" stroke="{INK}" stroke-width="2"/>
<text x="{x + 12}" y="{y + 16.5}" font-size="13" font-weight="900" text-anchor="middle" fill="#fff" {COMIC}>{number}</text></g>"""


def label(x, y, text, size=12, color=INK, anchor="middle", weight=700):
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{color}" {COMIC}>{text}</text>'


def svg(height, body, alt):
    return f'<svg class="tut-pic" viewBox="0 0 360 {height}" role="img" aria-label="{alt}">\n<rect width="360" height="{height}" fill="{PANEL}"/>\n{body}\n</svg>'


# ---------------------------------------------------------------- the strip of the example
CELL, LEFT = 25, 5
CELLS = [("VIA DEI TIGLI", n) for n in (1, 3, 5, 7, 9, 11, 13, 15)] + [("VIA DELLE ROSE", n) for n in (2, 4, 6, 8, 10, 12)]
COLOURS = {"VIA DEI TIGLI": "#bfe6ff", "VIA DELLE ROSE": "#c9f0b4"}


def strip_page(shot):
    """The same row close up, with the photos taken so far: shot 1, 2 or 3."""
    spans = [(0, 5, RED), (4, 9, BLUE), (8, 13, GREEN)]
    out = ['<rect x="0" y="0" width="360" height="70" fill="#4b5560"/>',
           '<rect x="0" y="6" width="360" height="62" fill="url(#tut-fins)" transform="scale(1 1)"/>',
           f'<rect x="{LEFT}" y="70" width="{CELL * len(CELLS)}" height="62" fill="#fffdf2" stroke="{INK}" stroke-width="3"/>']
    a, b, _ = spans[shot - 1]
    for k, (street, n) in enumerate(CELLS):
        x = LEFT + k * CELL
        common = shot > 1 and a <= k < a + 2   # the pigeonholes this photo has in common with the one before
        out.append(f'<rect x="{x}" y="71.5" width="{CELL}" height="59" fill="{"#ffe066" if common else COLOURS[street]}"/>')
        out.append(label(x + CELL / 2, 94, str(n), 13, weight=900))
    out.append(f'<path d="M{LEFT} 101H{LEFT + CELL * len(CELLS)}" stroke="{INK}" stroke-width="2"/>')
    for k in range(1, len(CELLS)):
        bottom = 132 if k == 8 else 101   # under the numbers one name runs on: a line only where the street changes
        out.append(f'<path d="M{LEFT + k * CELL} 70V{bottom}" stroke="{INK}" stroke-width="1.6"/>')
    out.append(label(LEFT + 4 * CELL, 121, "VIA DEI TIGLI", 12))
    out.append(label(LEFT + 11 * CELL, 121, "VIA DELLE ROSE", 12))
    if shot > 1:
        out.append(f'<rect x="{LEFT + a * CELL}" y="70" width="{2 * CELL}" height="62" fill="none" stroke="{INK}" stroke-width="1.5" stroke-dasharray="3 3"/>')
        out.append(label(LEFT + (a + 1) * CELL, 146, "in tutte e due", 11, "#9a5200"))
    for k in range(shot):
        s, e, color = spans[k]
        out.append(frame(LEFT + s * CELL - 3, 3 + k * 2, (e - s + 1) * CELL + 6, 132 - k * 4, color, k + 1, dim=k < shot - 1))
    # where to go on
    x0, x1 = LEFT + a * CELL + 10, LEFT + (b + 1) * CELL - 10
    out.append(f'<path d="M{x0} 158H{x1}" stroke="{spans[shot - 1][2]}" stroke-width="4" stroke-linecap="round"/>')
    out.append(f'<path d="M{x1 - 8} 152L{x1} 158L{x1 - 8} 164" fill="none" stroke="{spans[shot - 1][2]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
    return svg(172, "\n".join(out), "La striscia con la foto %d" % shot)


def whole_mobile():
    out = ['<rect x="0" y="50" width="360" height="16" fill="#b5d99c"/>',
           board(30, 6, 64, 46, "9A"), sheet(100, 8, 30, 42, "9A"),
           sheet(222, 8, 30, 42, "9B"), board(258, 6, 64, 46, "9B"),
           module(12, 72, 120), module(136, 72, 42), module(186, 72, 120), module(310, 72, 42),
           label(72, 232, "casello 9A", 11), label(157, 232, "ala", 11), label(246, 232, "casello 9B", 11), label(331, 232, "ala", 11),
           frame(4, 2, 352, 218, RED, 1)]
    return svg(238, "\n".join(out), "Tutto il mobile: due caselli e due ali, con i cartelli sopra")


def signs():
    streets = ("VIA DEI TIGLI", "VIA DELLE ROSE", "PIAZZA GRANDE", "CASCINA ALTA", "VICOLO STRETTO", "VIA NUOVA")
    out = [f'<rect x="4" y="4" width="172" height="150" rx="8" fill="#fbf0d2" stroke="{INK}" stroke-width="2"/>',
           f'<rect x="184" y="4" width="172" height="150" rx="8" fill="#fbf0d2" stroke="{INK}" stroke-width="2"/>',
           board(14, 40, 90, 66, "9A"), sheet(110, 28, 58, 90, "Itinerario 9A", streets),
           frame(9, 18, 163, 108, RED, 2),
           board(194, 40, 90, 66, "9A"), sheet(290, 28, 58, 90, "Itinerario 9A", streets),
           frame(189, 26, 100, 86, RED, 2), frame(286, 12, 66, 112, BLUE, 3),
           label(90, 145, "in una foto", 13), label(270, 145, "in due foto: meglio!", 13, GREEN)]
    return svg(160, "\n".join(out), "Il cartello e l'itinerario: in una foto, o meglio in due")


def readable():
    blur = ''.join(label(x, 80, n, 15, weight=900) for x, n in ((180, "15"), (204, "17")))
    out = [f'<rect x="22" y="6" width="124" height="178" rx="18" fill="{INK}"/>',
           '<rect x="31" y="22" width="106" height="146" rx="6" fill="#fffdf2"/>',
           '<rect x="31" y="40" width="53" height="70" fill="#bfe6ff"/><rect x="84" y="40" width="53" height="70" fill="#bfe6ff"/>',
           f'<path d="M84 40V84M31 84H137" stroke="{INK}" stroke-width="2.5"/>',
           label(57, 76, "17", 30, weight=900), label(110, 76, "19", 30, weight=900),
           label(84, 102, "VIA DEI TIGLI", 11),
           f'<path d="M62 142 L44 124 M44 124 v9 M44 124 h9 M106 142 L124 124 M124 124 v9 M124 124 h-9" stroke="{GREEN}" stroke-width="4" stroke-linecap="round" fill="none"/>',
           label(84, 162, "allarga con due dita", 10.5, GREEN),
           # three photos: shaken, crooked, sharp
           f'<g opacity=".55" transform="translate(-2 0)">{blur}</g><g opacity=".55" transform="translate(3 2)">{blur}</g>',
           f'<rect x="166" y="54" width="56" height="40" rx="4" fill="none" stroke="{INK}" stroke-width="2"/>',
           f'<g transform="rotate(-14 270 74)"><rect x="244" y="62" width="52" height="24" fill="#bfe6ff" stroke="{INK}" stroke-width="2"/>{label(258, 79, "15", 13, weight=900)}{label(282, 79, "17", 13, weight=900)}</g>',
           f'<rect x="240" y="54" width="56" height="40" rx="4" fill="none" stroke="{INK}" stroke-width="2"/>',
           f'<rect x="314" y="62" width="40" height="24" fill="#bfe6ff" stroke="{INK}" stroke-width="2"/>',
           label(324, 79, "15", 13, weight=900), label(344, 79, "17", 13, weight=900),
           f'<rect x="306" y="54" width="52" height="40" rx="4" fill="none" stroke="{INK}" stroke-width="2"/>',
           f'<circle cx="194" cy="120" r="14" fill="{RED}" stroke="{INK}" stroke-width="2"/><path d="M188 114l12 12M200 114l-12 12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
           f'<circle cx="268" cy="120" r="14" fill="{RED}" stroke="{INK}" stroke-width="2"/><path d="M262 114l12 12M274 114l-12 12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
           f'<circle cx="332" cy="120" r="14" fill="{GREEN}" stroke="{INK}" stroke-width="2"/><path d="M325 120l5 5 9-10" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
           label(194, 152, "mossa", 13), label(268, 152, "storta", 13), label(332, 152, "chiara", 13, GREEN)]
    return svg(190, "\n".join(out), "Allarga la foto: deve leggersi bene, non mossa né storta")


def order():
    out = [module(14, 14, 236, rows=4, rowh=42), module(256, 14, 90, rows=4, rowh=42)]
    for r in range(4):
        y = 14 + 3 + r * 42 + 42 - 6
        op = "1" if r < 2 else ".35"
        out.append(f'<g opacity="{op}"><path d="M22 {y}H332" stroke="{GREEN}" stroke-width="5" stroke-linecap="round"/>'
                   f'<path d="M322 {y - 8}L334 {y}L322 {y + 8}" fill="none" stroke="{GREEN}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
                   f'<circle cx="8" cy="{y}" r="8" fill="{GREEN}" stroke="{INK}" stroke-width="2"/>{label(8, y + 4.5, str(r + 1), 11, "#fff")}</g>')
        if r < 3:
            out.append(f'<path d="M334 {y + 6}C320 {y + 30} 40 {y + 14} 22 {y + 36}" fill="none" stroke="{GREEN}" stroke-width="2.5" stroke-dasharray="5 5" opacity="{op}"/>')
    out.append(label(132, 200, "casello", 12))
    out.append(label(301, 200, "ala", 12))
    return svg(208, "\n".join(out), "Fila 1 da sinistra a destra, casello e ala, poi la fila 2")


def other_zone():
    out = ['<rect x="0" y="50" width="360" height="16" fill="#b5d99c"/>',
           '<g opacity=".45">', board(30, 6, 64, 46, "9A"), sheet(100, 8, 30, 42, "9A"), module(12, 72, 120), module(136, 72, 42), '</g>',
           f'<g transform="rotate(-12 95 140)"><rect x="40" y="118" width="110" height="40" rx="8" fill="#fff" stroke="{GREEN}" stroke-width="4"/>{label(95, 145, "FATTO ✓", 20, GREEN, weight=900)}</g>',
           sheet(222, 8, 30, 42, "9B"), board(258, 6, 64, 46, "9B"), module(186, 72, 120), module(310, 72, 42),
           frame(254, 2, 72, 54, RED, 1), frame(218, 4, 38, 50, BLUE, 2), frame(182, 66, 174, 152, GREEN, 3),
           label(250, 232, "cartello, itinerario, strisce", 12)]
    return svg(238, "\n".join(out), "Finita la 9A, la stessa cosa per la 9B")


def phone(x, w, inner):
    return f"""<rect x="{x}" y="6" width="{w}" height="214" rx="18" fill="{INK}"/>
<rect x="{x + 8}" y="20" width="{w - 16}" height="186" rx="6" fill="#fffdf2"/>
<rect x="{x + 8}" y="20" width="{w - 16}" height="20" rx="6" fill="#2c6db3"/>
{label(x + w / 2, 34, "Casellino", 11, "#fff")}
{inner}"""


def in_the_app():
    thumbs = []
    for k in range(6):
        tx, ty = 26 + (k % 3) * 44, 92 + (k // 3) * 44
        thumbs.append(f'<rect x="{tx}" y="{ty}" width="38" height="34" rx="3" fill="#dfe3e6" stroke="{INK}" stroke-width="1.5"/>')
        if k == 0:
            thumbs.append(f'<rect x="{tx + 4}" y="{ty + 8}" width="30" height="20" fill="#4b5560"/><rect x="{tx + 4}" y="{ty + 13}" width="30" height="3" fill="url(#tut-strip)"/><rect x="{tx + 4}" y="{ty + 22}" width="30" height="3" fill="url(#tut-strip)"/>')
        elif k == 1:
            thumbs.append(f'<rect x="{tx + 5}" y="{ty + 6}" width="28" height="22" fill="#fffdf2" stroke="#f2c230" stroke-width="2"/>{label(tx + 19, ty + 23, "9A", 11, "#c99a10", weight=900)}')
        elif k == 2:
            thumbs.append(f'<rect x="{tx + 10}" y="{ty + 3}" width="18" height="28" fill="#fff" stroke="{INK}" stroke-width="1"/><path d="M{tx + 13} {ty + 12}h12M{tx + 13} {ty + 17}h10M{tx + 13} {ty + 22}h12" stroke="#9a8f80" stroke-width="1.5"/>')
        else:
            thumbs.append(f'<rect x="{tx + 3}" y="{ty + 12}" width="32" height="12" fill="#bfe6ff" stroke="{INK}" stroke-width="1"/>')
        thumbs.append(f'<circle cx="{tx + 36}" cy="{ty + 2}" r="7" fill="{RED}" stroke="{INK}" stroke-width="1.5"/>{label(tx + 36, ty + 5.5, str(k + 1), 9, "#fff")}')
    left = phone(14, 156, f"""<rect x="28" y="50" width="128" height="30" rx="8" fill="#2c6db3" stroke="{INK}" stroke-width="1.5"/>
{label(92, 69, "Carica e leggi le foto", 10.5, "#fff")}
{''.join(thumbs)}
{label(92, 196, "in ordine di scatto", 10.5, RED)}""")
    right = phone(190, 156, f"""<rect x="202" y="48" width="132" height="58" rx="6" fill="#e6eef8" stroke="#2c6db3" stroke-width="2"/>
{label(268, 64, "Il cartello: 9A", 11)}
<rect x="236" y="74" width="64" height="24" rx="12" fill="{GREEN}" stroke="{INK}" stroke-width="1.5"/>{label(268, 90, "Va bene", 11, "#fff")}
{label(206, 126, "VIA DEI TIGLI:", 10.5, anchor="start")}
<rect x="236" y="132" width="20" height="16" rx="3" fill="#ffe066"/>
{label(206, 144, "1, 3,", 10.5, anchor="start", weight=400)}{label(246, 144, "5?", 10.5)}{label(258, 144, ", 7, 9", 10.5, anchor="start", weight=400)}
<rect x="204" y="164" width="128" height="30" rx="15" fill="{GREEN}" stroke="{INK}" stroke-width="1.5"/>{label(268, 184, "Aggiungi al giro", 11, "#fff")}""")
    return svg(226, left + "\n" + right, "In Casellino: scegli le foto, conferma il cartello, controlla e aggiungi al giro")


def the_end():
    out = [f'<use href="#tut-postino" x="26" y="14" width="120" height="156"/>',
           f'<rect x="170" y="26" width="164" height="128" rx="6" fill="#fffef6" stroke="{INK}" stroke-width="3" transform="rotate(4 252 90)"/>',
           f'<g transform="rotate(4 252 90)">{label(182, 54, "VIA DEI TIGLI: 1..15", 12, anchor="start")}'
           f'{label(182, 78, "VIA DELLE ROSE: 2..12", 12, anchor="start")}{label(182, 102, "CASCINA ALTA", 12, anchor="start")}'
           f'<path d="M180 116h120M180 136h90" stroke="#c9b27e" stroke-width="2"/></g>',
           f'<path d="M300 150 L340 108 L350 118 L310 160 L296 164 Z" fill="#ffd23f" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>',
           '<circle cx="160" cy="20" r="4" fill="#ff8a8a"/><circle cx="20" cy="40" r="5" fill="#8fd3ff"/><circle cx="150" cy="160" r="4" fill="#a6e28a"/><circle cx="345" cy="30" r="5" fill="#ffe37a"/>']
    return svg(176, "\n".join(out), "Il postino saluta: senza foto si scrive a mano, con «Come si scrive»")


# ---------------------------------------------------------------- the pages: drawing + what the postman says
PAGES = [
    (whole_mobile(), "1 · Tutto il mobile",
     "Ciao! Ti faccio vedere come Casellino scrive il casello dalle tue foto. <b>Prima foto: tutto il mobile</b>, da un po' "
     "lontano: i caselli e le ali di tutte e due le sottozone. Non dimenticarla!"),
    (signs(), "2 · Il cartello e l'itinerario",
     "Poi <b>una sottozona alla volta</b>. Per primi il <b>cartello</b> con il nome (qui la 9A) e l'<b>itinerario</b>, il "
     "foglio con l'elenco delle vie. Meglio in due foto: prima il cartello, poi l'itinerario."),
    (readable(), "3 · Si legge bene?",
     "Allarga la foto con due dita: scritte e numeri devono restare <b>chiari</b>. Mossa, storta o con un riflesso? Rifalla subito."),
    (strip_page(1), "4 · Le strisce: la prima foto",
     "Ora le strisce, <b>da vicino</b> (15-20 caselle per foto). La prima foto della fila <b>comincia dalla prima casella</b> a sinistra."),
    (strip_page(2), "5 · La seconda foto",
     "La seconda <b>riparte un po' prima</b> di dove è finita la prima: 2 o 3 caselle già fotografate. Così non si perde niente."),
    (strip_page(3), "6 · La terza foto",
     "E così via: la via <b>continua</b> da una foto all'altra, poi ne comincia un'altra. Le caselle che si vedono in due foto "
     "Casellino le scrive <b>una volta sola</b>."),
    (order(), "7 · Fila dopo fila",
     "Dall'inizio alla fine del casello: la <b>fila 1 da sinistra a destra</b>, casello e ala, poi la fila 2, e così via fino "
     "all'ultima."),
    (other_zone(), "8 · L'altra sottozona",
     "Finita la 9A? <b>La stessa cosa per la 9B</b>: il suo cartello, il suo itinerario, poi le sue strisce in ordine."),
    (in_the_app(), "9 · In Casellino",
     "Tocca <b>«📷 Carica e leggi le foto delle strisce»</b> e scegli le foto <b>nell'ordine in cui le hai scattate</b>. "
     "Conferma il cartello (spunta «tutto il mobile» e l'itinerario), poi <b>«📚 Leggi tutte le foto»</b>. Controlla i «?» "
     "e premi <b>«Aggiungi al giro»</b>."),
    (the_end(), "10 · Fatto!",
     "Ora hai il giro: controllalo e stampa le strisce. <b>Parti da zero, senza foto?</b> In «Altro» c'è <b>«Come si scrive»</b>: "
     "ti spiega come scrivere il giro a mano."),
]


def dialog():
    pages = []
    for k, (pic, title, say) in enumerate(PAGES):
        extra = ('\n      <p class="tut-more"><button type="button" id="tut-help">📝 Come si scrive</button></p>'
                 if k == len(PAGES) - 1 else '')
        pages.append(f"""    <section class="tut-page"{' hidden' if k else ''}>
      {pic}
      <div class="tut-say"><svg viewBox="0 0 100 130" aria-hidden="true"><use href="#tut-postino"/></svg>
        <p class="tut-bubble"><b class="tut-title">{title}</b>{say}</p></div>{extra}
    </section>""")
    return f"""<!-- tutorial:start (written by tools/tutorial.py: change it there) -->
<dialog id="dlg-tutorial" class="tutorial" aria-label="Tutorial: il casello dalle foto">
  <div class="tut">
    {defs()}
    <p class="tut-head"><span>Casellino · il casello dalle foto</span><span class="small" id="tut-count"></span></p>
    <div class="tut-pages" id="tut-pages">
{chr(10).join(pages)}
    </div>
    <div class="tut-foot">
      <button type="button" class="tut-skip" id="tut-skip">Salta</button>
      <button type="button" class="tut-back" id="tut-back" aria-label="Pagina prima">◀</button>
      <span class="tut-gap"></span>
      <button type="button" class="tut-next" id="tut-next">Continua ▶</button>
    </div>
  </div>
</dialog>
<!-- tutorial:end -->"""


def main():
    html = PAGE.read_text(encoding="utf-8")
    new = dialog()
    if "<!-- tutorial:start" in html:
        html = re.sub(r"<!-- tutorial:start.*?<!-- tutorial:end -->", lambda m: new, html, flags=re.S)
    else:
        html = re.sub(r'<dialog id="dlg-guida-foto".*?</dialog>', lambda m: new, html, flags=re.S)
    PAGE.write_text(html, encoding="utf-8")
    print("Tutorial scritto in app/index.src.html (%d pagine)" % len(PAGES))


if __name__ == "__main__":
    main()
