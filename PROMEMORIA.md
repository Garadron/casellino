# Punti aperti

Ogni punto resta qui finché Garadron non l'ha fatto o non ha risposto. I punti sulla sua zona sono in
`dati/PROMEMORIA-privato.md` (fuori da GitHub).

## Da fare

0. **Pubblicare il server degli account** (v0.17.0: email e cambio del nome utente): aspetta il «sì» di Garadron. Sono
   due comandi in `server/`: `npx wrangler d1 migrations apply casellino --remote` e `npx wrangler deploy`. Gli account
   e i lavori che ci sono restano.
1. **Prova di stampa** del PDF (A4 orizzontale, «dimensioni reali / 100%») appoggiata alle caselle del mobile vero:
   larghezza delle caselle, caselle oblique, colori scuri. Se non combacia, si aggiunge una regolazione della larghezza
   nel PDF (proposta, non fatta).
2. Completare le prove con data: ogni tanto `python tools/prova_con_data.py --aggiorna prove/impronte-v<versione>.txt`
   (la conferma arriva da sola, gratis) e salvare.

## Più avanti (solo cose gratuite)

1. Lettura delle foto: migliorarla per le strisce storte (raddrizzare da sola) e per lo scritto a mano.
2. Account: il recupero della password per email (l'email ora si salva, nascosta). Gratis come nel Ricettario: le
   email partono da un account Gmail con un piccolo programma di Google (100 al giorno). Serve la scelta di Garadron:
   da quale account Gmail partono (meglio uno nuovo solo per Casellino) e 5 minuti per incollare il programma.
3. Note dal telefono: il bot non le mette nel repository pubblico (giusto); se servono note solo per Casellino, un
   repository privato apposta per le note.
