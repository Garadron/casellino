# Risultato del lavoro (v0.40.0, 24 novembre 2026)

Lavoro fatto in questa copia di prova di Casellino: solo commit locali, niente push, niente servizi online.

## Il numero finale della lettura delle foto

`OCR_NM=".../ocr/node_modules" node tools/misura_lettura_foto.js`

| Striscia di prova | Prima | Dopo |
|---|---|---|
| striscia del collega | 20/33 giusti, 7 sbagliati | 29/33, 4 sbagliati |
| a03_2 | 14/17, 2 | 14/17, 2 |
| a02_1 | 10/16, 4 | 15/16, 1 |
| a08_2 | 7/18, 6 | 14/18, 2 |
| a11_1 | 8/10, 1 | 9/10, 2 |
| fila intera 2A02 | 22/44, 17 | 34/44, 9 |
| **Totale** | **81/138 (59%), 37 sbagliati o inventati** | **115/138 (83%), 20 sbagliati o inventati** |

Nessuna striscia ha meno numeri giusti di prima. Una sola (a11_1) ha un numero sbagliato in più (2 invece di 1), ma
anche un giusto in più: le due caselle strappate con il «18» ora danno «1» e «3».

## Che cosa ho cambiato

1. **La lettura delle foto** (`app/src/foto.js`). Guardando le caselle una per una ho trovato le cause vere:
   - la parte alta dei numeri veniva tagliata: ora la casella si prende un po' più alta;
   - l'ombra del ripiano sopra faceva sparire metà dei numeri: ora la luce si rende uguale in tutta la casella;
   - restavano pezzi delle righe stampate e sporco, letti come «1» o «I»: ora si tengono solo i pezzi di scritto che
     non toccano il bordo; i tratti sottili spezzati (il piede di un «2») restano; una casella con solo sporco è vuota;
   - ogni casella si legge in due misure e in due modi, e vince la risposta più sicura (la seconda misura solo se la
     prima non è sicura: il 15% di letture in meno, con lo stesso risultato);
   - i due civici con la barra («8\10», «19\17») si leggono uno per uno, a sinistra e a destra della barra: il lettore
     spesso perdeva la barra e scriveva «810»;
   - nelle caselle larghe le lettere vicine restano insieme («35A» non diventa più «3» e «5»).
2. **Le ripetizioni**. Prima il programma toglieva già il pezzo in comune tra una foto e quella subito prima, ma solo
   guardando le ultime 40 caselle: chi rifotografava l'inizio di una fila da 91 caselle se lo trovava due volte. Ora una
   foto che ripete per intero una striscia già letta, anche molto indietro, non entra (servono almeno 3 numeri letti
   sicuri uguali, e quasi tutti quelli della foto: i numeri incerti da soli non tolgono mai una foto). La pagina scrive
   «questa striscia c'era già in una foto prima, non la riscrivo». **Prova automatica nuova** in
   `tests/test_core.js`: un giro intero (una fila di 64 caselle, una con due vie, una cascina) letto da tante foto che si
   sovrappongono, con una striscia rifotografata subito, l'inizio della fila rifotografato alla fine, la stessa foto due
   volte di fila e numeri letti un po' diversi: il giro che esce è uguale a quello vero, senza nessun civico doppio. Ho
   controllato che la prova cade se si toglie la parte nuova.
3. **Le foto salvate sul dispositivo** (`app/src/ui.js`): la memoria di ogni foto grande si libera subito (con tante
   foto il telefono poteva bloccarsi); una foto che il browser non sa aprire (HEIC di alcuni iPhone) si tiene così
   com'è invece di fermare il salvataggio di tutte le altre; il browser viene pregato di non cancellare le foto da solo
   quando il telefono ha poco spazio.
4. **Registro**: `CHANGELOG.md` (v0.40.0), `PROMEMORIA.md` (lettura all'83%), pagina rifatta (`Casellino.html`, `sito/`).

## Quali prove passano

Tutte, fatte girare davvero:

- `node tests/test_core.js`: 44 prove superate (43 di prima + quella nuova delle ripetizioni);
- `tests/test_pagina.js` e `tests/test_anteprima.js` (browser simulato): superate;
- `tests/prova_foto_edge.py` (foto salvate in Edge vero): superata;
- `tests/test_account_pagina.js` e `tests/test_server.js`, con il server acceso **solo sul PC** (`wrangler dev --local`,
  chiavi di prova in `server/.dev.vars`, che non va su GitHub): superate; tutta la prova del server dura meno di un
  secondo, quindi le risposte in locale sono rapide;
- misure del modello bianco: un Excel generato dall'esempio controllato con `tests/verifica_misure.py`: uguale al
  modello. Le misure non sono state toccate;
- `tools/controllo_privacy.py` prima di ogni commit: nessuna parola vietata.

## Velocità

- Lettura: per le 6 strisce di prova da 5,1 a 5,9 secondi sul PC (le letture per casella sono passate da 253 a 416 in
  tutto, perché ogni casella si legge in più modi). È il prezzo del salto dal 59% all'83%; ho già tolto le letture
  inutili quando la prima è sicura.
- Account: in locale ogni risposta è immediata; la velocità del server vero su Cloudflare non l'ho misurata perché non
  dovevo toccarlo.

## Che cosa non ho fatto e perché

- **Il server vero non è toccato** e non c'era niente da correggere: le regole degli account (password da 8, password
  più usate, codice per email da 30 minuti e 5 tentativi, 3 codici al giorno, blocchi dopo troppi tentativi) sono già
  come dicono le Regole Mondiali, e le prove passano.
- **Niente push, niente tag su GitHub, niente prova con data OpenTimestamps**: sono servizi online, vietati in questa
  copia di prova.
- **Le «C.NA» e il «18» strappato** di a11_1, il «60\56» letto «6015» e le caselle «56B»/«56C» della fila intera restano
  da migliorare: ho provato l'ingrandimento morbido e un taglio della casella fermato alla riga sopra, ma facevano
  peggiorare almeno una striscia e li ho tolti, come chiede la regola della misura.
- **La striscia trovata in una foto intera con tanto mobile intorno** non l'ho toccata: sulle strisce di prova non
  c'erano casi per misurarla.
- **Gli screenshot giorno e notte**: non servivano, è cambiata solo una frase nel testo della lettura.

## Prossimi passi consigliati, in ordine

1. Più strisce di prova con i numeri giusti in `dati/prova-lettura/` (soprattutto foto con ombre, caselle oblique e
   scritte a mano): sono il modo più sicuro di far crescere la lettura senza peggiorare niente.
2. Le scritte a mano e i numeri a 4 cifre con la barra persa («6015» che è 60\56): leggerli come due numeri quando la
   barra c'è nella foto ma il lettore non la vede.
3. Provare la lettura su un telefono vero e misurare quanto ci mette una foto: se è lenta, leggere la seconda misura
   solo per le caselle incerte già oggi è il primo passo, il secondo è un lettore su due «lavoratori» in parallelo.
