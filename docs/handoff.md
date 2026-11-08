# Nota di passaggio

Dove siamo arrivati, per ripartire da una sessione pulita. Si aggiorna a fine di ogni tappa.

## 8 novembre 2026 · Tappa 1 chiusa: stampa compatta (v0.12.0)

**Fatto.** Menu «Stampa»: PDF (scritto dal programma, `app/src/pdf.js`), Excel compatto e Excel come il modello. PDF ed
Excel compatto usano la stessa disposizione: `Core.printPieces` taglia ogni fila di ogni modulo in pezzi da 22 caselle,
`Core.packPages` li mette su righe da 22 caselle (pezzi della stessa fila insieme, una casella vuota fra loro) e su
fogli da 10 righe. Sopra ogni pezzo una riga sottile con l'etichetta.

**Misure.** Casella 35,25 pt (1,2435 cm, colonna 6.7109375 con Arial 10), righe 28,35 e 19,9 pt: quelle del modello.
Excel compatto: margini laterali 0 (come il modello: con 0,2" la 22ª colonna andava su un'altra pagina), pagina
centrata, interruzioni ogni 30 righe. Verificato in Excel: 5 pagine per la zona 2, contenuto da x 12 a 830 pt.
Excel stampato con «Microsoft Print to PDF» fa le colonne del 2,5% più larghe e le righe più basse del nominale: il
PDF usa le misure nominali.

**Verifiche.** `node tests/test_core.js` (32), `tests/test_pagina.js`, `tests/test_account_pagina.js` e
`tests/test_server.js` con il server locale, `tests/verifica_misure.py` sull'Excel come il modello: tutto verde.
Passaggio ablativo: il disegno della striscia nell'Excel è uno solo (`drawPiece`) per i due Excel, uscite identiche
byte per byte a prima; tolta l'opzione «salta i pezzi vuoti», mai chiesta.

**Da decidere con Garadron.** Una prova di stampa vera sul mobile; se le caselle non combaciano, una regolazione della
larghezza nel PDF (proposta, non fatta).

**Prossime tappe** (note del telefono del 7 novembre, nel repository privato di Archivista #1-#4, da cancellare a
lavoro fatto): 2. importare gli Excel già fatti; 3. bloccare il giro controllato; 4. ufficio di partenza e
«Ottimizzazione gita»; 5. correggere i punti sulla cartina.
