# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Builds the program from app/:

- Casellino.html: one single file with the page, the style and the scripts inside. It works
  offline, opened with a double click, sent by e-mail or copied on a USB stick.
- sito/: the same page as index.html plus the files a phone needs to install it as an app
  (manifest, icons, offline support). This folder is what goes online.

The version shown in the program comes from the first "## v..." line of CHANGELOG.md.
Run it after every change in app/:   python tools/build.py
The yellow-and-blue preview (private, in dati/anteprima/):   python tools/build.py --anteprima
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SITE = ROOT / "sito"


def read(rel):
    return (APP / rel).read_text(encoding="utf-8")


def version():
    m = re.search(r"^## v(\d+\.\d+\.\d+)", (ROOT / "CHANGELOG.md").read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else "0.0.0"


def page(ver):
    html = read("index.src.html")

    def inline_css(m):
        return "<style>\n" + read(m.group(1)) + "</style>"

    def inline_js(m):
        code = read(m.group(1))
        if "</script" in code.lower():
            sys.exit(f"{m.group(1)} contiene '</script': non si può mettere dentro la pagina")
        return "<script>\n" + code + "</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
    if 'src="src/' in html or 'href="src/' in html:
        sys.exit("È rimasto un file non incluso nella pagina")
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", html):
        sys.exit("Nella pagina c'è un carattere di controllo (forse una barra rovesciata persa)")
    return html.replace("__VERSIONE__", ver)


def inline_icons(html):
    """The single file has no icon files next to it: the icons go inside it."""
    import base64

    def data(name):
        return "data:image/png;base64," + base64.b64encode((APP / "icons" / name).read_bytes()).decode()

    html = html.replace('href="favicon-64.png"', 'href="' + data("favicon-64.png") + '"')
    return html.replace('href="apple-touch-icon.png"', 'href="' + data("apple-touch-icon.png") + '"')


def build():
    ver = version()
    html = page(ver)
    single = ROOT / "Casellino.html"
    single.write_text(inline_icons(html), encoding="utf-8", newline="\n")
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    (SITE / "index.html").write_text(html, encoding="utf-8", newline="\n")
    (SITE / "manifest.webmanifest").write_text(read("manifest.webmanifest"), encoding="utf-8", newline="\n")
    (SITE / "sw.js").write_text(read("sw.js").replace("__VERSIONE__", ver), encoding="utf-8", newline="\n")
    for icon in list((APP / "icons").glob("*.png")) + list((APP / "icons").glob("*.ico")):
        shutil.copy(icon, SITE / icon.name)
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Versione {ver}: creati {single.name} ({single.stat().st_size // 1024} KB) e la cartella sito/ "
          f"({len(list(SITE.iterdir()))} file)")


def preview():
    """A preview of the yellow-and-blue colours, in one file in dati/anteprima/ (private: it may carry the
    name of the company it is shown to, written in dati/anteprima/testo.txt). The program does not change."""
    import json
    out_dir = ROOT / "dati" / "anteprima"
    out_dir.mkdir(parents=True, exist_ok=True)
    note = out_dir / "testo.txt"
    text = note.read_text(encoding="utf-8").strip() if note.exists() else "Anteprima: Casellino in giallo e blu."
    head = ("<head>\n<script>window.CASELLINO_ANTEPRIMA = { testo: " + json.dumps(text, ensure_ascii=False).replace("</", "<\\/") + " };\n"
            "(function () { var t = ''; try { t = localStorage.getItem('casellino.tema') || ''; } catch (e) {}\n"
            "  if (t !== 'light' && t !== 'dark') t = window.matchMedia && matchMedia('(pointer: coarse)').matches ? '' : 'light';\n"
            "  if (t) document.documentElement.setAttribute('data-theme', t); })();</script>")
    html = inline_icons(page(version()))
    html = html.replace('<html lang="it">', '<html lang="it" data-palette="gialloblu" data-anteprima>', 1)
    html = html.replace("<head>", head, 1)
    html = re.sub(r'<meta name="theme-color" content="[^"]*">',
                  '<meta name="theme-color" content="#ffcc00" media="(prefers-color-scheme: light)">\n'
                  '<meta name="theme-color" content="#081d45" media="(prefers-color-scheme: dark)">', html, count=1)
    target = out_dir / "Casellino anteprima.html"
    target.write_text(html, encoding="utf-8", newline="\n")
    print(f"Anteprima giallo e blu: {target} ({target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if "--anteprima" in sys.argv:
        preview()
    else:
        build()
