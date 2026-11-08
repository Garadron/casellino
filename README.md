# Casellino

Casellino aiuta chi smista la posta a scrivere il giro della sua zona e crea il file Excel delle **strisce da stampare**
e incollare sotto le caselle: civici sopra, nome della via sotto, un colore per via. È gratuito, funziona su PC e
telefono, e i tuoi dati restano sul tuo dispositivo.

**Apri il programma:** <https://garadron.github.io/casellino/>

## Come si usa

1. **Sul telefono** apri il link qui sopra, poi su iPhone Condividi → «Aggiungi alla schermata Home», su Android ⋮ →
   «Installa app». Si apre come un'app, anche senza internet (la mappa no).
   **Sul PC** apri il link, oppure scarica `Casellino.html` e aprilo con un doppio clic.
2. Scrivi la zona, le sottozone (per esempio A e B), il comune e i moduli, da sinistra a destra: ala A, **casello**
   (91 caselle per fila), ala B (33 caselle per fila), ognuno su 4 file.
3. Scrivi **il giro** dall'inizio alla fine, una via per riga, per esempio `VIA DEI TIGLI: 1..15, 14..2`. Le caselle si
   leggono sempre come un libro, da sinistra a destra e dall'alto in basso: il programma riempie la fila 1 di ogni
   modulo, poi la fila 2, e così via. Sotto vedi «Sei qui» e tutte le strisce. Le regole sono in «Altro → Come si
   scrive».
   Se hai le foto delle strisce di oggi, **Leggi le strisce dalle foto** scrive una bozza del giro (gratis, dentro il
   dispositivo). Nel **disegno di tutto il mobile** metti i moduli nell'ordine giusto e, con la matita, segni dove una
   sottozona entra nell'altra. Un nome sbagliato si corregge dall'elenco **Vie** (tocchi il nome): cambia in tutto
   il giro e i civici restano. La **cartina del giro** mette le vie sulla mappa e calcola i chilometri, partendo e
   tornando al **centro di partenza** scritto in alto (nome e indirizzo; se l'indirizzo non si trova, il punto si
   sceglie sulla mappa o con la posizione del telefono).
4. **Stampa**: il **PDF** (consigliato) o l'**Excel** riempiono il foglio A4 orizzontale. **Per moduli** (la scelta
   normale) è come il modello: le 4 file di un modulo una sotto l'altra, con «1 Fila… 4 Fila» a sinistra, 2 blocchi da
   22 caselle per foglio. **Per piani** mette una fila per riga, 10 righe per foglio. Ogni pezzo ha scritto sopra dove
   va (per esempio «2A · Casello · caselle 1-22»). Le caselle hanno le misure del modello (1,2435 cm, righe di 1 cm e
   0,7 cm). Si stampa a dimensioni reali (100%). C'è anche l'«Excel come il modello», un modulo per foglio come prima.
5. **Con un account** (pulsante «Accedi» in alto, gratis: nome utente, email e password) i lavori si salvano da soli e
   li ritrovi da qualsiasi telefono o computer. Il nome utente si scrive con maiuscole o minuscole, è uguale, e si può
   cambiare una volta a settimana; l'email nel server resta nascosta. Alla registrazione ricevi un codice di recupero:
   scrivilo, serve se dimentichi la password. Sui computer non tuoi, quando esci, scegli di togliere il lavoro da lì.
6. Senza account il lavoro resta salvato nel browser di quel dispositivo. Per portarlo su un altro, e come copia sicura: **Salva
   file**, poi **Apri** dall'altro. Su iPhone Safari può cancellare i dati dei siti non usati da qualche settimana: con
   l'app sulla schermata Home e un «Salva file» ogni tanto non si perde niente.

La mappa (Google Maps) e l'elenco delle vie del comune (OpenStreetMap) funzionano solo con internet. Alla mappa vanno
solo via, civico e comune, mai i nomi delle persone.

## Licenza

© 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: chi smista la posta può usarlo gratis anche al lavoro;
per venderlo o farlo adottare da un'azienda serve il permesso scritto dell'autore. Vedi [LICENZA.md](LICENZA.md) e
[LICENSE](LICENSE). Le prove con data di ogni versione sono in [prove/](prove/).

## Per chi modifica il programma

- Il codice sta in `app/` (`index.src.html`, `src/`, `manifest.webmanifest`, `sw.js`, `icons/`). Dopo ogni modifica:
  `python tools/build.py`, che crea `Casellino.html` (file unico) e la cartella `sito/`, pubblicata da sola su GitHub
  Pages a ogni push. La versione mostrata nel programma è la prima di `CHANGELOG.md`.
- Prove:
  - `node tests/test_core.js`: lettura del giro, ordine delle strisce, colori, Excel;
  - `node tests/test_pagina.js`: la pagina in un browser simulato (serve jsdom: `npm install jsdom` in una cartella
    qualsiasi, poi `JSDOM_PATH=<cartella>/node_modules/jsdom`);
  - `python tests/verifica_misure.py <file.xlsx>`: misure uguali al modello (da `tests/misure_modello.json`);
  - `tools/prova_in_excel.ps1`: apre il file in Excel, confronta le misure con il modello e crea il PDF della stampa.
- Il server degli account sta in `server/` (Cloudflare Worker + D1, piano gratuito): `cd server && npm install`,
  prova in locale con `npx wrangler dev --local --port 8799`, pubblica con `npx wrangler deploy`. La chiave segreta
  `SEGRETO` è solo su Cloudflare (`npx wrangler secret put SEGRETO`), mai nel repository. Prove:
  `node tests/test_server.js` e `node tests/test_account_pagina.js` con il server acceso in locale (la prova del server
  finisce bloccando i tentativi per un quarto d'ora: falla per ultima).
- `tools/genera_excel.js` crea l'Excel da un giro scritto come testo; `tools/icone.py` disegna le icone.
