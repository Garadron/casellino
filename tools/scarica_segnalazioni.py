# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Picks up the problems reported from Casellino (account -> "Segnala un problema") and puts each one in a folder
of its own on this PC: the screenshot, a sheet with what happened, the system and the phone, and the details the
page added by itself. Then it removes them from the server.

The key (ADMIN) is only on Cloudflare and in dati/admin-segnalazioni.txt (private, never on GitHub).
The folder: the first argument, or the path written in dati/cartella-segnalazioni.txt, or dati/segnalazioni/.

    python tools/scarica_segnalazioni.py [folder] [--server http://127.0.0.1:8799]
"""
import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT / 'dati'


def ask(server, key, method, path):
    req = urllib.request.Request(server + path, method=method, headers={'Authorization': 'Bearer ' + key, 'User-Agent': 'Casellino-segnalazioni'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def safe(text):
    return ''.join(c if c.isalnum() or c in ' ._-' else '_' for c in str(text)).strip()[:40] or 'senza-nome'


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    server = 'https://casellino.ricettaio-mannisi.workers.dev'
    if '--server' in sys.argv:
        server = sys.argv[sys.argv.index('--server') + 1]
        args = [a for a in args if a != server]
    key = os.environ.get('CASELLINO_ADMIN') or (PRIVATE / 'admin-segnalazioni.txt').read_text(encoding='utf-8').strip()
    chosen = PRIVATE / 'cartella-segnalazioni.txt'
    folder = Path(args[0]) if args else (Path(chosen.read_text(encoding='utf-8').strip()) if chosen.exists() else PRIVATE / 'segnalazioni')
    folder.mkdir(parents=True, exist_ok=True)
    got = 0
    while True:
        reports = ask(server, key, 'GET', '/api/segnalazioni').get('segnalazioni', [])
        if not reports:
            break
        for r in reports:
            when = time.strftime('%Y-%m-%d %H-%M', time.localtime(r['creata_il'] / 1000))
            out = folder / ('%s %s %s' % (when, safe(r['utente']), r['id']))
            out.mkdir(parents=True, exist_ok=True)
            image = r.get('immagine') or ''
            if image.startswith('data:image/'):
                kind = image[len('data:image/'):image.index(';')]
                (out / ('screenshot.' + ('jpg' if kind == 'jpeg' else kind))).write_bytes(base64.b64decode(image.split(',', 1)[1]))
            try:
                details = json.loads(r.get('dettagli') or '{}')
            except ValueError:
                details = {'testo': r.get('dettagli')}
            (out / 'dettagli.json').write_text(json.dumps(details, ensure_ascii=False, indent=2), encoding='utf-8')
            sheet = ['# Segnalazione da Casellino', '',
                     '- **Quando:** ' + time.strftime('%d/%m/%Y %H:%M', time.localtime(r['creata_il'] / 1000)),
                     '- **Utente:** ' + r['utente'],
                     '- **Sistema:** ' + (r.get('sistema') or 'non detto'),
                     '- **Telefono:** ' + (r.get('telefono') or 'non detto'),
                     '- **Versione di Casellino:** ' + str(details.get('versione', '?')),
                     '- **Screenshot:** ' + ('sì' if image else 'no'), '',
                     '## Che cosa è successo', '', (r.get('testo') or '(non scritto)'), '',
                     '## Ultimi errori del programma', '']
            sheet += ['- ' + e for e in details.get('errori', [])] or ['(nessuno)']
            (out / 'segnalazione.md').write_text('\n'.join(sheet) + '\n', encoding='utf-8')
            ask(server, key, 'DELETE', '/api/segnalazioni/' + r['id'])   # saved here: it goes from the server
            got += 1
            print('Salvata:', out)
    print('Segnalazioni nuove:', got, '· cartella:', folder)


if __name__ == '__main__':
    main()
