# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""The segnacasella in real Edge, on a computer and on a phone, with the example: a change on a line moves it there; it
shows in the text and in the strips; it stays after a reload; its button brings back there. Screenshots in a folder.

    python tools/prova_segnacasella.py [folder]      (needs: pip install websocket-client)
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
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='casellino-segnacasella-')
EDGE = next(p for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe') if os.path.exists(p))
ok = True


def run(port, width, height, mobile, tag):
    global ok
    proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--remote-debugging-port=%d' % port,
                             '--user-data-dir=' + tempfile.mkdtemp(prefix='profilo_', dir=OUT), '--window-size=1280,900', 'about:blank'])
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
                if m.get('id') == n[0]:
                    return m.get('result', {})

        def js(expr):
            return call('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True).get('result', {}).get('value')

        def shot(name):
            time.sleep(0.6)
            open(os.path.join(OUT, name), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))

        def check(label, value):
            global ok
            print(('  ok  ' if value else '  NO  ') + label)
            ok = ok and bool(value)

        call('Page.enable'); call('Runtime.enable')
        call('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=mobile)
        call('Page.addScriptToEvaluateOnNewDocument', source="localStorage.setItem('casellino.tutorial', '1');")
        call('Page.navigate', url=URL + '#esempio')
        time.sleep(3)
        print(tag)
        # a change on line 9 (index 8): the cursor at its end, one more character, as when typing
        js("""(function () { var ta = document.querySelector('textarea.route-text'); var L = ta.value.split('\\n');
          var at = L.slice(0, 9).join('\\n').length; ta.focus(); ta.setSelectionRange(at, at);
          ta.setRangeText(' ', at, at, 'end'); ta.dispatchEvent(new Event('input')); return true; })()""")
        time.sleep(1)
        check('il tasto dice la riga 9', js("/riga 9/.test(document.querySelector('.mark-btn').textContent)"))
        js("document.querySelector('.mark-btn').click(); true")   # the line in view in the text box
        time.sleep(1)
        check('la fascia si vede nel testo', js("var b = document.querySelector('.mark-band'); !b.hidden && b.style.visibility !== 'hidden' && b.offsetHeight > 10"))
        check('le caselle della riga nelle strisce', js("document.querySelectorAll('#strips .cell.marked').length > 0"))
        y = js("Math.round(document.querySelector('.mark-btn').getBoundingClientRect().top + scrollY - 20)")
        js('window.scrollTo(0, %d); true' % y)
        shot(tag + '_testo.png')
        y = js("Math.round(document.querySelector('#strips .cell.marked').getBoundingClientRect().top + scrollY - 120)")
        js('window.scrollTo(0, %d); true' % y)
        shot(tag + '_strisce.png')
        # after a reload it is still there; the button brings back to the line
        call('Page.navigate', url=URL)   # without #esempio: the work saved on the device
        time.sleep(3)
        check('resta dopo il ricaricamento', js("/riga 9/.test(document.querySelector('.mark-btn').textContent)"))
        js("document.querySelector('textarea.route-text').setSelectionRange(0, 0); document.querySelector('.mark-btn').click(); true")
        time.sleep(1)
        check('il tasto porta il cursore sulla riga 9', js("var ta = document.querySelector('textarea.route-text'); ta.value.slice(0, ta.selectionStart).split('\\n').length === 9"))
    finally:
        proc.kill()


run(9460, 1280, 860, False, 'computer')
run(9461, 390, 844, True, 'telefono')
print('Schermate in', OUT)
sys.exit(0 if ok else 1)
