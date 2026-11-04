"""Free dated proof (OpenTimestamps) for a file: writes <file>.ots next to it.

The official "ots" command does not start on this Windows PC (it looks for an old OpenSSL
library), so this uses the same core library the command uses. Only the SHA-256 fingerprint
of the file is sent to the public calendars, never the file.

    python tools/prova_con_data.py prove/impronte-v0.5.0.txt          # stamp
    python tools/prova_con_data.py --aggiorna prove/impronte-v0.5.0.txt  # add the Bitcoin confirmation (hours later)
"""
import os
import sys

from opentimestamps.calendar import RemoteCalendar
from opentimestamps.core.notary import PendingAttestation
from opentimestamps.core.op import OpAppend, OpSHA256
from opentimestamps.core.serialize import StreamDeserializationContext, StreamSerializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile

CALENDARS = [
    "https://a.pool.opentimestamps.org",
    "https://b.pool.opentimestamps.org",
    "https://a.pool.eternitywall.com",
]


def stamp(path):
    with open(path, "rb") as f:
        dtf = DetachedTimestampFile.from_fd(OpSHA256(), f)
    nonce = os.urandom(16)  # hides the fingerprint from the calendars, like the official command
    commitment = dtf.timestamp.ops.add(OpAppend(nonce)).ops.add(OpSHA256())
    ok = 0
    for url in CALENDARS:
        try:
            commitment.merge(RemoteCalendar(url).submit(commitment.msg, timeout=15))
            ok += 1
            print("Registrato su", url)
        except Exception as e:  # one calendar is enough
            print("Non raggiungibile:", url, "-", e)
    if not ok:
        sys.exit("Nessun calendario raggiungibile: riprova più tardi.")
    with open(path + ".ots", "wb") as fd:
        dtf.serialize(StreamSerializationContext(fd))
    print("Prova con data salvata:", path + ".ots")


def upgrade(path):
    with open(path + ".ots", "rb") as fd:
        dtf = DetachedTimestampFile.deserialize(StreamDeserializationContext(fd))
    changed = False
    for msg, att in dtf.timestamp.all_attestations():
        if isinstance(att, PendingAttestation):
            try:
                upgraded = RemoteCalendar(att.uri).get_timestamp(msg, timeout=15)
            except Exception as e:
                print("Non ancora pronta su", att.uri, "-", e)
                continue
            node = _find(dtf.timestamp, msg)
            if node is not None:
                node.merge(upgraded)
                changed = True
                print("Conferma ricevuta da", att.uri)
    if changed:
        with open(path + ".ots", "wb") as fd:
            dtf.serialize(StreamSerializationContext(fd))
        print("Prova aggiornata.")
    else:
        print("Niente da aggiornare per ora.")


def _find(ts, msg):
    if ts.msg == msg:
        return ts
    for sub in ts.ops.values():
        found = _find(sub, msg)
        if found is not None:
            return found
    return None


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--aggiorna":
        upgrade(args[1])
    elif args:
        stamp(args[0])
    else:
        sys.exit(__doc__)
