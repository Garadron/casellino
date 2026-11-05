"""Stops a commit when a public file contains a forbidden word (real streets, names, employer).

The list of words is private: dati/parole_vietate.txt (one per line, "*" = any ending, "#" = note).
Without the list the check only says so. Usage: python tools/controllo_privacy.py   (exit 1 = found)
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "dati" / "parole_vietate.txt"


def patterns():
    out = []
    for line in LIST.read_text(encoding="utf-8").splitlines():
        w = line.strip().lower()
        if not w or w.startswith("#"):
            continue
        body = re.escape(w.rstrip("*")).replace(r"\ ", r"\s+")
        out.append((w, re.compile(r"(?<![\w])" + body + (r"\w*" if w.endswith("*") else r"(?![\w])"), re.I)))
    return out


def main():
    if not LIST.exists():
        print("Elenco delle parole vietate non trovato (dati/parole_vietate.txt): controllo saltato.")
        return 0
    files = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT,
                           capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
    found = []
    pats = patterns()
    for f in files:
        if not f or f.startswith("dati/") or f.endswith((".png", ".ots", ".pyc")):
            continue
        try:
            text = (ROOT / f).read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for w, p in pats:
                if p.search(line):
                    found.append(f"{f}:{n}: «{w}»")
    if found:
        print("FERMO: parole vietate nei file pubblici:\n  " + "\n  ".join(found[:40]))
        return 1
    print(f"Controllo privacy: nessuna parola vietata ({len(pats)} parole, {len([f for f in files if f])} file).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
