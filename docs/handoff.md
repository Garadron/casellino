# Nota di passaggio

Dove siamo arrivati, per ripartire da una sessione pulita. Si aggiorna a fine di ogni tappa.

## 8 novembre 2026 · Tappa 10 chiusa: provincia e coordinate (v0.21.0)

**Fatto.** `depotAddr.provincia` (due lettere; `Core.PROVINCES`, 107 sigle); le ricerche usano il nome della provincia
(«Via X 15, Comune, Cremona»). `overpass(query)`: overpass-api.de, maps.mail.ru, overpass.kumi.systems, 25 s ciascuno
(provato l'8/11: il primo pieno, il secondo risponde in 20-45 s). `osmStreetNames(town, province)`: nome del comune con
regex senza maiuscole; con la provincia cerca il comune dentro l'area con `ref`. Elenco salvato in `localStorage`
(`casellino.vie.<COMUNE>|<PROV>`). `Core.parseCoordinates`: «lat, lon», virgola decimale, link Google Maps (`!3d…!4d`
prima di `@`).
**Verifiche.** `tests/test_core.js` (38), `tests/test_pagina.js` (coordinate incollate, provincia), Edge vero.

## 8 novembre 2026 · Tappa 9 chiusa: indirizzo in tre caselle, salvataggio uscendo (v0.20.0)

**Fatto.** `project.depotAddr` { comune, via, civico }; `project.depot` resta la stessa cosa in una riga
(`Core.addressText`), per le ricerche. `Core.splitAddress` divide le righe vecchie (sanitize, in qualsiasi ordine).
Pagina: `osmStreetNames(town)` (Overpass, la stessa ricerca di «Elenco vie»), `loadDepotStreets` riempie il `datalist`
quando si scrive il comune o si entra nella via, `depotStreetMissing` avvisa se la via non c'è; «Scegli sulla mappa»
centra sul comune. `debounce(...).now()` e `saveBeforeLeaving` (visibilitychange hidden, pagehide): salvataggio locale e
nell'account subito, con `keepalive` se il lavoro è sotto i 60 KB.
**Server.** Migrazione 0002 e deploy fatti l'8/11 con il sì di Garadron; controllato che risponda.
**Verifiche.** `tests/test_core.js` (38), `tests/test_pagina.js`, `tests/test_account_pagina.js` (salvato nell'account
entro 1,8 s uscendo), `tests/test_server.js`, Edge vero: via esistente trovata, via inventata segnalata.
**Scoperta.** La via del centro vero di Garadron non è su OpenStreetMap: si può aggiungere lì (gratis), e dopo qualche
giorno la ricerca la trova anche per gli altri.

## 8 novembre 2026 · Tappa 8 chiusa: correggere i nomi dall'elenco (v0.19.0)

**Fatto.** `Core.renameStreet(project, key, newName)`: rilegge ogni giro come `parseRoute` (COMUNE, righe di servizio,
nome da solo con «(2)») e cambia solo il nome nelle righe con quella chiave; anche `routeBefore`; il colore passa alla
chiave nuova (se la chiave nuova ha già un colore, resta quello). Pagina: nome e ✏️ nell'elenco Vie → `editStreetName`
(conferme per unione e giro bloccato, `datalist` con l'elenco ufficiale).
**Verifiche.** `tests/test_core.js` (38: altro comune intatto, C.NA = CASCINA, «(2)» resta), `tests/test_pagina.js`
(il giro cambia, i civici restano, niente «null» nell'elenco), guardato in Edge.
**Limite.** I punti sulla cartina sono salvati con il nome vecchio: la via si cerca di nuovo con il nome giusto.

## 8 novembre 2026 · Tappa 7 chiusa: il centro di partenza (v0.18.0)

**Fatto.** `project.depotName` e `project.depotPoint` ({ lat, lon, found: 'mano' | 'gps' }). In `ui.js`: `depotQueries()`
(l'indirizzo e la sua forma senza parentesi e trattini), `depotPoint()` (prima il punto a mano, poi `geo` dell'indirizzo:
così valgono anche le correzioni vecchie salvate in `geo`), `findDepot`, `setDepotPoint` (con `addressOf`, la ricerca
al contrario di Nominatim, solo se l'indirizzo è vuoto), `pickDepotOnMap` (`round.placing = 'depot'`), `useMyPosition`.
Una sola coda per Nominatim (`nominatim()`), una richiesta al secondo.
**Verifiche.** `tests/test_core.js` (37), `tests/test_pagina.js` (posizione finta, l'indirizzo scritto resta), in Edge
vero: indirizzo con trattino e parentesi trovato da solo; tocco sulla mappa → «messo a mano» e indirizzo scritto.
**Rischi.** La ricerca al contrario a volte dà civici strani: si scrive il numero solo se sembra un civico.

## 8 novembre 2026 · Tappa 6 chiusa: email e nome utente (v0.17.0)

**Fatto.** Account: `email_impronta` (HMAC di `email:<email minuscola>`, non legata all'id, così un domani si cerca
l'account dall'email) e `email_vista` («m***@dominio»); `nome_cambiato_il` e `LIMITS.renameDays` (7). `checkMine`
ricontrolla la password per cambio nome, cambio email ed eliminazione, risponde 403 (non 401: la pagina con 401 butta
il gettone) e conta come un accesso sbagliato. Pagina: email e consiglio nella registrazione, riquadro «Nome utente ed
email» con «Cambia».
**Verifiche.** `tests/test_server.js` e `tests/test_account_pagina.js` con il server locale (migrazione 0002 applicata
in locale), finestre guardate in Edge.
**Da decidere con Garadron.** Il recupero della password per email: gratis come nel Ricettario (Apps Script su un
Gmail, `Ricettaio Mannisi/strumenti/posta-google.gs`), ma serve un account Gmail scelto da lui.

## 8 novembre 2026 · Tappa 5 chiusa: stampa per moduli (v0.16.0)

**Fatto.** `Core.printBlocks`: per ogni modulo e ogni tratto di 22 caselle un blocco con le 4 file. `Core.packPages`
mette sulla stessa riga solo pezzi dello stesso `group` (foglio per i blocchi, foglio + fila per i piani). PDF
(`buildPdf(project, title, layout)`) ed Excel compatto (`buildCompactFiles(project, layout)`): `'moduli'` (normale, 2
blocchi per foglio, colonna A larga 23 px con «n Fila» ruotato) o `'piani'`. Il secondo blocco su una riga ha l'etichetta
delle file nella casella libera prima di lui. La scelta nel menu Stampa, ricordata in `localStorage` (`casellino.stampa`).
**Verifiche.** `tests/test_core.js` (37), `tests/test_pagina.js` (PDF per piani diverso, scelta ricordata), Excel vero:
6 pagine, nessuna interruzione verticale. Alleggerimento: tolti `buildCompactXlsx` (non usato), i campi `sheet` e `m`
dei pezzi, un parametro di `drawBlock`.

## 8 novembre 2026 · Tappa 4 chiusa: ufficio, cartina da correggere, ottimizzazione gita (v0.15.0)

**Fatto.** `Core.optimizeOrder(dist)`: vicino più vicino, poi inversioni di tratti e spostamenti di 1-3 tappe finché il
giro si accorcia (matrice non simmetrica, sensi unici). `Core.reorderRoute(sz, stops, order)`: ogni tappa porta la sua
riga, le note sopra e le righe senza posto sulla mappa sotto; toglie le righe delle caselle vuote e rimette «COMUNE:»
dove cambia. Pagina: ufficio in alto (`project.depot`); tappe e ufficio trascinabili, tappe rosse da mettere con un
tocco; punti a mano in `project.geo` con `found: 'mano'`; `sz.routeBefore` per tornare indietro.
**Casi limite.** Tappe non trovate: l'ottimizzazione chiede di metterle prima; più di 100 punti o OSRM fermo: distanze in
linea d'aria x 1,3; giro bloccato: conferma.
**Rischi.** L'euristica è buona ma non garantisce il minimo; la tabella OSRM gratuita accetta al massimo 100 punti
(la 2A ne ha 68). Dove OpenStreetMap non ha il civico il punto cade a metà via: per questo si trascina.
**Verifiche.** `tests/test_core.js` (36: giro migliore su punti in fila e sensi unici, riordino del testo senza perdere
caselle, punti a mano che restano), serie completa verde, prova nel browser vero (Edge) con distanze OSRM vere.

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

**Prossime tappe.** Le 4 note del 7 novembre sono fatte. Da Garadron: la prova di stampa sul mobile vero.