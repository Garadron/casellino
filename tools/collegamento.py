# © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
"""Makes Casellino.lnk with Casellino's own icon: in the project folder, in the Start menu and on the Desktop
(Regola Mondiale of 13-14 November 2026). It opens the online program as an app: an Edge window without the
browser bars, which shows the page's own icon.

    python -I tools\\collegamento.py
"""
import ctypes
import ctypes.wintypes as wt
import os

import pythoncom
from win32com.shell import shell

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://garadron.github.io/casellino/'
ICON = os.path.join(ROOT, 'app', 'icons', 'casellino.ico')
EDGE = [r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe']


def places():
    buf = ctypes.create_unicode_buffer(wt.MAX_PATH)
    ctypes.windll.shell32.SHGetFolderPathW(None, 0x0010, None, 0, buf)   # the Desktop (also when it is on OneDrive)
    start = os.path.join(os.environ['APPDATA'], 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    return [os.path.join(ROOT, 'Casellino.lnk'), os.path.join(start, 'Casellino.lnk'), os.path.join(buf.value, 'Casellino.lnk')]


def main():
    edge = next(p for p in EDGE if os.path.exists(p))
    for lnk in places():
        link = pythoncom.CoCreateInstance(shell.CLSID_ShellLink, None, pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink)
        link.SetPath(edge)
        link.SetArguments('--app=' + URL)
        link.SetWorkingDirectory(ROOT)
        link.SetIconLocation(ICON, 0)
        link.SetDescription('Casellino: il giro e le strisce da stampare')
        link.QueryInterface(pythoncom.IID_IPersistFile).Save(lnk, 0)
        print(lnk)


if __name__ == '__main__':
    main()
