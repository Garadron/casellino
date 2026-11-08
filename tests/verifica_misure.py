# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Checks that every sheet of a generated .xlsx has exactly the measurements of the template.

Usage: python tests/verifica_misure.py <generated.xlsx>
Exit code 0 = all equal, 1 = something differs (listed).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from estrai_misure import measure  # noqa: E402

import openpyxl  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def compare(expected, got, where):
    problems = []
    exp_cols = {int(k): v for k, v in expected["columns"].items()}
    got_cols = got["columns"]
    for c, w in exp_cols.items():
        if abs(got_cols.get(c, -1) - w) > 1e-6:
            problems.append(f"{where}: colonna {c} larga {got_cols.get(c)} invece di {w}")
    exp_rows = {int(k): v for k, v in expected["rows"].items()}
    for r, h in exp_rows.items():
        if abs(got["rows"].get(r, -1) - h) > 1e-6:
            problems.append(f"{where}: riga {r} alta {got['rows'].get(r)} invece di {h}")
    for key in ("default_col_width", "default_row_height", "margins", "paper", "orientation", "scale",
                "fit_to_page", "default_font"):
        if got[key] != expected[key]:
            problems.append(f"{where}: {key} = {got[key]} invece di {expected[key]}")
    return problems


def main():
    path = Path(sys.argv[1])
    expected = json.loads((ROOT / "tests" / "misure_modello.json").read_text(encoding="utf-8"))
    names = openpyxl.load_workbook(path).sheetnames
    problems = []
    for name in names:
        problems += compare(expected, measure(path, name), f"foglio {name}")
    if problems:
        print("\n".join(problems))
        print(f"DIVERSO dal modello: {len(problems)} differenze")
        return 1
    print(f"Uguale al modello: {len(names)} fogli, {len(expected['columns'])} colonne e "
          f"{len(expected['rows'])} righe controllate, margini, carta A4 orizzontale, carattere Arial 10")
    return 0


if __name__ == "__main__":
    sys.exit(main())
