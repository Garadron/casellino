# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""The photos of the strips in a real browser (Edge, headless, in real time): the viewer opens, a photo is
kept on the device (IndexedDB) and counted. The simulated browser of the other tests has no IndexedDB.

Needs Microsoft Edge and `pip install websocket-client`.  Run:  python tests/prova_foto_edge.py
"""
import functools
import http.server
import json
import pathlib
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

import websocket

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

TEST = """<script>
function esito(t) { document.body.setAttribute('data-esito', (document.body.getAttribute('data-esito') || '') + '|' + t); }
setTimeout(async function () { try {
  document.querySelector('.photos-view-btn').click();
  await new Promise(function (r) { setTimeout(r, 800); });
  esito('aperta=' + document.getElementById('dlg-photos').open);
  var c = document.createElement('canvas'); c.width = 1200; c.height = 400;
  var g = c.getContext('2d'); g.fillStyle = '#ffe135'; g.fillRect(0, 0, 1200, 400);
  g.fillStyle = '#111'; g.font = 'bold 120px Arial'; g.fillText('1  3  5', 40, 170);
  var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.9); });
  var dt = new DataTransfer(); dt.items.add(new File([blob], 'prova.jpg', { type: 'image/jpeg', lastModified: 1 }));
  var inp = document.getElementById('pv-add'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  await new Promise(function (r) { setTimeout(r, 3000); });
  esito('conteggio=' + document.getElementById('pv-count').textContent);
  esito('tasto=' + document.querySelector('.photos-view-btn').textContent);
  document.getElementById('pv-close').click();
  esito('chiusa=' + !document.getElementById('dlg-photos').open);
} catch (e) { esito('errore=' + e.message); } }, 800);
</script></body>"""


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    work = pathlib.Path(tempfile.mkdtemp(prefix='casellino-foto-'))
    html = (ROOT / 'Casellino.html').read_text(encoding='utf-8')
    (work / 'prova.html').write_text(html.replace('</body>', TEST), encoding='utf-8')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = functools.partial(Quiet, directory=str(work))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', free_port()), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = free_port()
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--remote-debugging-port=%d' % port,
                             '--user-data-dir=%s' % (work / 'profilo'), '--window-size=1200,800', 'about:blank'])
    try:
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % port)) if t['type'] == 'page')
                break
            except Exception:
                time.sleep(0.3)
        ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True)
        ask = {'n': 0}

        def call(method, **params):
            ask['n'] += 1
            ws.send(json.dumps({'id': ask['n'], 'method': method, 'params': params}))
            while True:
                m = json.loads(ws.recv())
                if m.get('id') == ask['n']:
                    return m.get('result', {})

        call('Page.navigate', url='http://127.0.0.1:%d/prova.html#esempio' % server.server_address[1])
        result = ''
        for _ in range(40):
            time.sleep(0.5)
            result = call('Runtime.evaluate', expression="document.body.getAttribute('data-esito') || ''", returnByValue=True)['result'].get('value', '')
            if 'chiusa=' in result or 'errore=' in result:
                break
        expected = ['aperta=true', 'conteggio=1 di 1', 'tasto=🖼 Guarda le foto (1)', 'chiusa=true']
        missing = [e for e in expected if e not in result]
        if missing:
            print('FAIL foto nel browser vero: ' + result + ' (manca ' + ', '.join(missing) + ')')
            return 1
        print('Foto nel browser vero: tutte le prove superate')
        return 0
    finally:
        edge.kill()
        server.shutdown()


if __name__ == '__main__':
    sys.exit(main())
