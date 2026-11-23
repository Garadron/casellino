# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""A check of the page in a real browser (Edge, without a window), on a phone and on a computer, with the example:
errors of the program while it is used, things wider than the screen, buttons under 44 points on the phone, every
window, and screenshots to look at.

    python tools/controllo_pagina.py [folder for the screenshots]      (needs: pip install websocket-client)
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'Casellino.html').replace('\\', '/')
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='casellino-controllo-')
EDGE = next(p for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe') if os.path.exists(p))
errors = []

WIDE = """(function () {
  var out = [];
  document.querySelectorAll('body *').forEach(function (e) {
    if (e.closest('.strip-wrap, .overview-wrap, .leaflet-container, dialog:not([open]), [hidden], .tut-defs')) return;
    var r = e.getBoundingClientRect();
    if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return out.slice(0, 12);
})()"""
SMALL = """(function () {
  var out = {};
  document.querySelectorAll('button, summary, a.btn, label.btn').forEach(function (b) {
    if (b.closest('dialog:not([open]), [hidden], .strip-wrap, .leaflet-container')) return;
    var r = b.getBoundingClientRect();
    if (r.width && r.height && r.height < 44) { var k = b.className || b.tagName.toLowerCase(); out[k] = (out[k] || 0) + 1; }
  });
  return out;
})()"""


def run(port, width, height, mobile, steps):
    prof = os.path.join(OUT, 'profilo_%d' % port)
    proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--remote-debugging-port=%d' % port,
                             '--user-data-dir=' + prof, '--window-size=1280,900', 'about:blank'])
    try:
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % port)) if t['type'] == 'page')
                break
            except Exception:
                time.sleep(0.3)
        ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True)
        n = [0]

        def call(method, **params):
            n[0] += 1
            ws.send(json.dumps({'id': n[0], 'method': method, 'params': params}))
            while True:
                m = json.loads(ws.recv())
                if m.get('method') == 'Runtime.exceptionThrown':
                    d = m['params']['exceptionDetails']
                    errors.append('ECCEZIONE: ' + (d.get('exception', {}).get('description') or d.get('text', ''))[:300])
                elif m.get('method') == 'Runtime.consoleAPICalled' and m['params']['type'] == 'error':
                    errors.append('CONSOLE: ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in m['params']['args'])[:300])
                elif m.get('method') == 'Log.entryAdded' and m['params']['entry']['level'] == 'error':
                    errors.append('LOG: ' + m['params']['entry']['text'][:300])
                if m.get('id') == n[0]:
                    return m.get('result', {})

        def js(expr):
            r = call('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True)
            if 'exceptionDetails' in r:
                errors.append('NELLA PROVA: ' + expr[:80])
            return r.get('result', {}).get('value')

        def shot(name):
            time.sleep(0.6)
            open(os.path.join(OUT, name), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))

        call('Page.enable'); call('Runtime.enable'); call('Log.enable')
        call('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=mobile)
        if mobile:
            call('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
        call('Page.addScriptToEvaluateOnNewDocument',
             source="window.confirm = function () { return false; }; localStorage.setItem('casellino.tutorial', '1');")
        call('Page.navigate', url=URL + '#esempio')
        time.sleep(3)
        steps(js, shot)
    finally:
        proc.kill()


def phone(js, shot):
    print('telefono · fuori dallo schermo:', js(WIDE), '· pulsanti sotto 44 punti:', js(SMALL))
    shot('telefono_inizio.png')
    for bid in ('btn-help', 'btn-import', 'btn-support', 'btn-bug'):
        js("document.querySelector('.actions details:not(.print-menu) > summary').click(); document.getElementById('%s').click(); true" % bid)
        time.sleep(0.6)
        dlg = js("var d = document.querySelector('dialog[open]'); d ? d.id : ''")
        print('  %s -> finestra %s · fuori: %s · aperta in cima: %s' % (bid, dlg or '(nessuna)', js(WIDE),
              js("var d = document.querySelector('dialog[open]'); d ? d.scrollTop === 0 : '-'")))
        if dlg:
            shot('telefono_%s.png' % dlg)
        js("document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); }); true")
    js("document.getElementById('btn-tutorial').click(); true")
    for _ in range(12):
        js("document.getElementById('tut-next').click(); true")
    print('  tutorial percorso fino in fondo, chiuso:', js("!document.getElementById('dlg-tutorial').open"))
    js("[...document.querySelectorAll('#route button')].find(function (b) { return /Guarda le foto/.test(b.textContent); }).click(); true")
    time.sleep(0.6)
    print('  le foto -> finestra:', js("var d = document.querySelector('dialog[open]'); d ? d.id : ''"))
    js("document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); }); true")
    js("document.querySelectorAll('details.fold, #depot-fold').forEach(function (d) { d.open = true; }); true")
    time.sleep(1)
    print('  schede aperte · fuori dallo schermo:', js(WIDE), '· pulsanti sotto 44 punti:', js(SMALL))
    y = js("Math.round(document.querySelector('details.fold').getBoundingClientRect().top + scrollY - 10)")
    js('window.scrollTo(0, %d); true' % y)
    shot('telefono_schede.png')


def computer(js, shot):
    print('computer · fuori dallo schermo:', js(WIDE))
    shot('computer_inizio.png')
    js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })); true")
    print('  Ctrl+S dice:', js("(document.querySelector('.toast') || {}).textContent || '(niente)'"))


run(9450, 390, 844, True, phone)
run(9451, 1280, 860, False, computer)
print('ERRORI DEL PROGRAMMA:', len(errors))
for e in errors[:30]:
    print(' -', e)
print('Schermate in', OUT)
sys.exit(1 if errors else 0)
