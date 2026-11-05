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
   sottozona entra nell'altra. La **cartina del giro** mette le vie sulla mappa e calcola i chilometri.
4. **Crea Excel**: esce il file da stampare (1,244 cm per casella), su A4 orizzontale, al 100%. Ogni foglio contiene 22
   caselle.
5. **Con un account** (pulsante «Accedi» in alto, gratis, basta nome utente e password) i lavori si salvano da soli e
   li ritrovi da qualsiasi telefono o computer. Alla registrazione ricevi un codice di recupero: scrivilo, serve se
   dimentichi la password. Sui computer non tuoi, quando esci, scegli di togliere il lavoro da lì.
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
