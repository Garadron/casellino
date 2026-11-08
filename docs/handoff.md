# Nota di passaggio

Dove siamo arrivati, per ripartire da una sessione pulita. Si aggiorna a fine di ogni tappa.

## 8 novembre 2026 · Tappa 3 chiusa: bloccare il giro controllato (v0.14.0)

**Fatto.** `subzone.locked` = quando è stato bloccato (0 = no), salvato nel JSON e nell'account. Bloccato: testo del giro e
comune in sola lettura, niente pulsante delle foto (e l'aggiunta dalle foto rifiuta), riquadro con «Sblocca».
**Verifiche.** `tests/test_core.js` (34), `tests/test_pagina.js` (blocca e sblocca), guardato nel browser.
**Per la tappa 4.** L'ottimizzazione cambia l'ordine delle righe del giro: su un giro bloccato lo fa solo se Garadron
conferma.

## 8 novembre 2026 · Tappa 2 chiusa: aprire gli Excel già fatti (v0.13.0)

**Fatto.** `app/src/importa.js`: apre lo zip (DecompressionStream del browser, niente librerie), legge workbook, stringhe,
celle, celle unite e aree di stampa; ogni foglio con strisce diventa una sottozona; i moduli dalle aree di stampa (33 = ala,
91 = casello) o dai posti del modello; disposizione diversa da [ala A, casello, ala B] → mobile disegnato.
**Casi limite.** Cella unita sulle due righe (un nome senza via) → riga del giro senza due punti; testo con a capo
(le caselle oblique dell'Excel di Casellino) → «a/b»; virgole e due punti nei testi tolti; .xls vecchio → messaggio.
**Rischi.** Il comune non è nell'Excel: va scritto a mano. La continuazione di una sottozona nel mobile di un'altra
torna nel giro dell'altra (l'Excel non dice di chi è).
**Verifiche.** Andata e ritorno identica (normale e compresso) in `tests/test_core.js` (33), file vero del modello
nel browser vero (Edge), serie completa verde. Alleggerimento: tolte due funzioni esportate che nessuno usava.

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

**Prossime tappe** (note del telefono del 7 novembre, nel repository privato di Archivista, da cancellare a lavoro
fatto): 4. ufficio di partenza e «Ottimizzazione gita» (#2, #3); 5. correggere i
punti sulla cartina (#3).
