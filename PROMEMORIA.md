# Punti aperti

Ogni punto resta qui finché Garadron non l'ha fatto o non ha risposto. I punti sulla sua zona sono in
`dati/PROMEMORIA-privato.md` (fuori da GitHub).

## Da fare

0. **Pubblicare il server** (v0.36.0 e v0.37.0: email obbligatoria, si entra anche con l'email, niente codice di
   recupero, password più usate, Supporto): serve il «sì, pubblica il server» di Garadron; non c'è niente da cambiare
   nel database. Poi Garadron aggiorna il programmino di Google, perché le risposte del Supporto tornino a chi ha
   scritto: su script.google.com (con il Gmail di Casellino, in una finestra privata) incolla di nuovo
   `dati/posta-google.gs`, salva, «Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione →
   Esegui il deployment». L'indirizzo resta lo stesso.
1. **Prova di stampa** del PDF (A4 orizzontale, «dimensioni reali / 100%») appoggiata alle caselle del mobile vero:
   larghezza delle caselle, caselle oblique, colori scuri. Se non combacia, si aggiunge una regolazione della larghezza
   nel PDF (proposta, non fatta).
2. Completare le prove con data: ogni tanto `python tools/prova_con_data.py --aggiorna prove/impronte-v<versione>.txt`
   (la conferma arriva da sola, gratis) e salvare.
3. **Guida privata con le foto vere** pronta: `dati/Guida foto - zona 2 (privata).pdf`, da mandare ai colleghi (non
   pubblicarla: logo, indirizzo del centro, targa). Garadron dice se la guida pubblica resta con i disegni.
4. **Anteprima per l'azienda** pronta (v0.32.0, 12 novembre 2026): `dati/anteprima/Casellino anteprima.html`, con i
   colori esatti, il logo e le parole ufficiali; in `dati/anteprima/` anche le parole e le sigle trovate. Garadron la
   prova e decide come presentarla, e che cosa del nome dell'azienda va nel programma pubblico.

## Più avanti (solo cose gratuite)

1. Lettura delle foto (v0.28.0 al 59% sulle 6 strisce di prova): trovare la striscia anche senza rettangolo o con
   tanto mobile intorno, le caselle doppie con numeri piccoli, lo scritto a mano. Più strisce di prova con i numeri
   giusti (in `dati/prova-lettura/`) aiutano a misurare.
2. Note dal telefono: il bot non le mette nel repository pubblico (giusto); se servono note solo per Casellino, un
   repository privato apposta per le note.
