# Punti aperti

Ogni punto resta qui finché Garadron non l'ha fatto o non ha risposto. I punti sulla sua zona sono in
`dati/PROMEMORIA-privato.md` (fuori da GitHub).

## Da fare

1. **Email per la password dimenticata** (v0.29.0, tutto pronto nel programma): Garadron crea il Gmail nuovo per
   Casellino, incolla `dati/posta-google.gs` in script.google.com, lo pubblica come «App web» e scrive l'indirizzo
   che riceve in `dati/posta-indirizzo.txt`. Poi dice «sì, pubblica il server»: si caricano la tabella nuova, la
   chiave e l'indirizzo su Cloudflare, e si prova con un'email vera.
2. **Prova di stampa** del PDF (A4 orizzontale, «dimensioni reali / 100%») appoggiata alle caselle del mobile vero:
   larghezza delle caselle, caselle oblique, colori scuri. Se non combacia, si aggiunge una regolazione della larghezza
   nel PDF (proposta, non fatta).
3. Completare le prove con data: ogni tanto `python tools/prova_con_data.py --aggiorna prove/impronte-v<versione>.txt`
   (la conferma arriva da sola, gratis) e salvare.

4. **Guida privata con le foto vere** pronta: `dati/Guida foto - zona 2 (privata).pdf`, da mandare ai colleghi (non
   pubblicarla: logo, indirizzo del centro, targa). Garadron dice se la guida pubblica resta con i disegni.

5. **Anteprima giallo e blu** pronta: `dati/anteprima/Casellino anteprima.html` (privata). Garadron la prova sul
   computer e sul telefono e decide se i colori passano al programma.

## Più avanti (solo cose gratuite)

1. Lettura delle foto (v0.28.0 al 59% sulle 6 strisce di prova): trovare la striscia anche senza rettangolo o con
   tanto mobile intorno, le caselle doppie con numeri piccoli, lo scritto a mano. Più strisce di prova con i numeri
   giusti (in `dati/prova-lettura/`) aiutano a misurare.
2. Note dal telefono: il bot non le mette nel repository pubblico (giusto); se servono note solo per Casellino, un
   repository privato apposta per le note.
