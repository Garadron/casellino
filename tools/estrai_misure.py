# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Reads the measurements of the blank template and saves them in tests/misure_modello.json.

Only numbers are saved (column widths, row heights, margins, paper), no streets or names,
so the file can go on GitHub. The template itself stays in dati/.

Usage: python tools/estrai_misure.py [dati/originali/<modello>.xlsm] [sheet name]
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent


def measure(path, sheet=None):
    wb = openpyxl.load_workbook(path)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    cols = {}
    for dim in ws.column_dimensions.values():
        if dim.min and dim.max and dim.width:
            for c in range(dim.min, min(dim.max, 199) + 1):
                cols[c] = round(dim.width, 6)
    rows = {r: round(d.height, 4) for r, d in ws.row_dimensions.items() if d.height}
    font0 = wb._fonts[0]
    m = ws.page_margins
    return {
        "columns": cols,
        "rows": rows,
        "default_col_width": ws.sheet_format.defaultColWidth,
        "default_row_height": ws.sheet_format.defaultRowHeight,
        "margins": [m.left, m.right, m.top, m.bottom, m.header, m.footer],
        "paper": int(ws.page_setup.paperSize),
        "orientation": ws.page_setup.orientation,
        "scale": ws.page_setup.scale,
        "fit_to_page": bool(ws.sheet_properties.pageSetUpPr and ws.sheet_properties.pageSetUpPr.fitToPage),
        "default_font": [font0.name, float(font0.sz)],
    }


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else next((ROOT / "dati" / "originali").glob("*.xls*"))
    sheet = sys.argv[2] if len(sys.argv) > 2 else None
    data = measure(src, sheet)
    out = ROOT / "tests" / "misure_modello.json"
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Misure salvate in {out}: {len(data['columns'])} colonne, {len(data['rows'])} righe")
