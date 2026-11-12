# Nota di passaggio

Dove siamo arrivati, per ripartire da una sessione pulita. Si aggiorna a fine di ogni tappa.

## 12 novembre 2026 · Tappa 22 chiusa: uso più comodo (v0.33.0)

**Fatto.** Giro di schermate in Edge (telefono 390×844 e computer): menu `.menu-list` tenuti nello schermo
all'evento `toggle` (posizione `left` calcolata dal riquadro del menu); barra del telefono più stretta (sotto i 560 px:
`gap` e `padding` dei pulsanti); `input[type=password|email]` con lo stile degli altri campi; ogni `dialog` torna
in cima quando si apre (`MutationObserver` sull'attributo `open`: il browser scorreva fino al primo pulsante); Esc
chiude i menu, Ctrl+S clicca «Salva file».
**Verifiche.** `tests/test_pagina.js` (Esc, Ctrl+S), `tests/test_anteprima.js`, `tests/test_core.js` (42),
`tests/test_account_pagina.js` con il server sul PC, schermate prima e dopo.
**Da proporre.** Il «Centro di partenza» chiuso in una riga quando è vuoto; il nome della via sempre visibile nelle
strisce che scorrono di lato sul telefono; pulsanti un po' più alti sul telefono (44 punti).

## 12 novembre 2026 · v0.32.1: il nome ufficiale nell'anteprima

`termini.txt` accetta frasi (`come casellino = come il …`): in `previewWords()` gli spazi diventano `\s+`, e le
regole valgono nell'ordine del file (prima le frasi, poi la parola sola). Verificato: nessun «Casellino» resta in vista
nell'anteprima, il tutorial (pagina 9 compresa) e la barra sul telefono reggono il nome più lungo.

## 12 novembre 2026 · Tappa 21 chiusa: anteprima per l'azienda (v0.32.0)

**Fatto.** I colori della tavolozza `gialloblu` sono quelli del sito dell'azienda (presi dal suo foglio di stile:
`#eedc00`, `#0047bb`, `#00297a`, `#1a1c1e`, `#5d5e61`, `#c6c6c9`, `#f2f8ff`, `#ba1b1b`, `#006d36`, `#fff0e5`), più
Inter da Google Fonts solo nell'anteprima. `build.py --anteprima` mette in `window.CASELLINO_ANTEPRIMA` anche `logo`
(da `dati/anteprima/logo-azienda.svg`) e `termini` (da `dati/anteprima/termini.txt`); `wirePreview()` mette il logo
in testa a `.brand` e `previewWords()` cambia le parole nei nodi di testo e in `placeholder`/`title`/`aria-label`,
con un `MutationObserver` per quello che compare dopo; salta `textarea`, `script`, `style`.
**Verifiche.** `tests/test_anteprima.js` (nuovo), `tests/test_pagina.js`, `tests/test_core.js` (42), schermate in Edge
(computer chiaro e scuro, telefono, tutorial).
**Da decidere con Garadron.** Che cosa va nel programma pubblico: per ora né nome né logo dell'azienda.

## 11 novembre 2026 · Tappa 20 chiusa: anteprima giallo e blu (v0.31.0)

**Fatto.** Tavolozza `:root[data-palette="gialloblu"]` in `style.css` (chiaro, scuro col sistema, scuro forzato; in più
`--brand`, `--brand-ink`, `--brand-edge` per la barra). `build.py --anteprima` scrive un file solo in
`dati/anteprima/` con `data-palette`, `data-anteprima`, la nota (da `dati/anteprima/testo.txt`) e uno script in testa
che mette `data-theme="light"` sul computer (puntatore fine) se non c'è una scelta salvata (`casellino.tema`).
`wirePreview()` in `ui.js` fa l'interruttore ☀️/🌙 fisso e la nota; senza `window.CASELLINO_ANTEPRIMA` non fa niente.
**Verifiche.** pagina (il programma resta senza anteprima), schermate computer chiaro/scuro e telefono scuro/chiaro.
**Da decidere con Garadron.** Se e quando i colori giallo e blu passano al programma pubblico (allora: tavolozza su
`:root`, l'interruttore per tutti, senza la nota né il nome dell'azienda).

## 11 novembre 2026 · Tappa 19 chiusa: tutorial a fumetto, cartello, mai civici doppi (v0.30.0)

**Fatto.** Tutorial `#dlg-tutorial` (10 pagine, scritte da `tools/tutorial.py` tra i segni `tutorial:start/end` di
`app/index.src.html`: dopo una modifica `python tools/tutorial.py` e poi `build.py`); altezza fissa così «Continua» non
si sposta; si apre dopo l'iscrizione (alla chiusura della finestra dell'account), la prima volta delle foto
(`casellino.tutorial`) e da `#btn-tutorial`. Foto: `F.withoutOverlap` è un allineamento a punteggio (uguale nella
stessa via +3, quasi uguale +0,5/1,5, diverso -2, buco -1,5; vale con almeno 2 uguali e punteggio 4) più il taglio dei
civici già visti all'inizio della foto nuova; `F.repeatedItems` per la riga «# attenzione». Cartello: `F.signBoxes`
(lettere scure su fondo chiaro, 2-4 vicine), `F.signInk` (scuro o colorato = inchiostro), `F.signText` (8→B, 4→A,
0→D), letti a 140 e 80 punti con psm 11/7/8. Prima foto: caselle «tutto il mobile» e «itinerario a parte»
(`photo.kind`); un cartello in mezzo ferma la lettura (`askSign`), lo stesso cartello di nuovo no (`photo.zone`).
Vie: `F.sheetStreets` (dalle parole dell'itinerario) e `F.snapStreet` (al massimo un quarto delle lettere diverse,
nessun altro nome vicino). `streetPhrases`: una via ha una parola di 4 lettere o tipo e nome. Ordine di scatto con
un tasto (non da solo). Una sottozona nuova si crea solo con righe sue. PDF privato con le foto vere:
`dati/fai_guida_foto.py` → `dati/Guida foto - zona 2 (privata).pdf`.
**Verifiche.** core 42, pagina (tutorial, sottozona solo con righe), account (tutorial dopo l'iscrizione), server,
Edge vero (foto finte: cartello 2A/2B, itinerario a parte, sovrapposizione; 27 foto vere della zona 2), misura 59%.
**Limiti.** Le foto da lontano di una fila intera: lente (~90 s l'una) e poco leggibili.

## 11 novembre 2026 · Tappa 18 chiusa: password dimenticata per email (v0.29.0)

**Fatto.** Server: `/api/codice-email` (nome utente + email; confronta l'impronta `email:<email>`, codice di 6 cifre in
`codice_impronta` = HMAC di `codice:<id>:<cifre>`, `codice_scade` 30 minuti, `codice_errori` max 5; `email_inviate` per i
limiti: 3 per account, 10 per indirizzo internet, 90 in tutto nelle 24 ore). `/api/recupera` con `codice` invece di
`recupero`; a buon fine cancella il codice, fa uscire gli altri dispositivi e dà un codice di recupero nuovo. Errori con
`motivo` (`posta_spenta` 503, `posta_ferma` 502). Le email: `fetch` al programmino di Google (`POSTA_INDIRIZZO`,
`POSTA_SEGRETO`), come nel Ricettario. `MODO_PROVA=si` in `server/.dev.vars`: niente email, il codice nella risposta.
Pagina: «Password dimenticata» prima chiede nome ed email («Mandami il codice»), poi codice e password nuova; link
«Mandami un altro codice» e «Non ho più quell'email: uso il codice di recupero»; con le email spente (o un server
vecchio: 401/404) passa da sola al codice di recupero, il nome utente resta scritto.
**Verifiche.** core 41, pagina, account nella pagina (codice per email dal secondo dispositivo), server (email sbagliata,
codice sbagliato, codice con lo spazio, codice usato una volta sola, quarto codice del giorno fermato), schermate da
telefono con le email accese e spente, Edge vero con le foto.
**Da fare con Garadron.** Il Gmail nuovo, il programmino pubblicato, poi «sì, pubblica il server» (migrazione 0004,
`wrangler secret put POSTA_SEGRETO` da `dati/posta-segreto.txt` e `POSTA_INDIRIZZO` da `dati/posta-indirizzo.txt`,
deploy) e un'email vera di prova.

## 10 novembre 2026 · Tappa 17 chiusa: caselle trovate meglio (v0.28.0)

**Fatto.** In `segmentStrip` le righe trovate passano da un filtro: una riga più vicina di 0,8 caselle a quella prima
non è un bordo (stanghetta di «1» o «4», riga doppia); la larghezza di confronto è quella della casella prima se sta
fra 0,7 e 1,3 volte la solita (foto di sbieco), se no la solita (metà alta dei buchi). Righe «pallide» solo dentro i
buchi larghi più di 2,5 caselle. `readStrip`: se il riquadro è alto (larghezza/altezza < 7) `findStrip(photo, 0.3)` lo
stringe sulla striscia. `blackWhite` cancella le righe e colonne di inchiostro che attraversano tutta la casella.
**Misura.** 6 strisce di prova (una nuova: striscia intera fotografata dal telefono): 81/138 (59%), 37 sbagliati
(v0.27.0: 70/138, 51%, 32). Nessuna striscia peggiora; quella presa di sbieco da 0 a 7 su 18.
**Verifiche.** core 41, pagina, Edge vero con foto vere, controllo privacy.
**Limiti.** Numeri scritti a mano su strisce colorate quasi illeggibili; la striscia intera in una foto resta al 50%.

## 10 novembre 2026 · Tappa 16 chiusa: foto tutte insieme, cartello, segnalazioni (v0.27.0)

**Fatto.** `F.findStrip` (copia piccola 600 punti: righe di carta chiara con tanti tratti scuri sottili, pesate dalla
vicinanza a bordi orizzontali lunghi; banda al più 6% dell'altezza). Finestra: `photo.rects[i]` in parti 0..1 (trovati
da soli, maniglie per cambiarli), `readOne` (striscia, e se legge poco controlla se è un cartello con il nome grande),
`readAll` con «Ferma», `F.withoutOverlap` (fine della foto prima = inizio della nuova: almeno 2 caselle, da 4 una su
quattro può differire), `checkFirst`/`confirmFirst` (prima foto: nome dal cartello o scritto, conferma), righe
`# sottozona X` che smistano il testo in «Aggiungi al giro» (`subzoneNamed` crea la sottozona se manca).
`cellImage`: ingrandimento adattivo (riga del numero ~130 punti): ingrandire tutta la striscia peggiorava (8/44 contro
18/44). Segnalazioni: tabella `segnalazioni` (cancellate con l'account), `ADMIN` su Cloudflare e in
`dati/admin-segnalazioni.txt`, cartella in `dati/cartella-segnalazioni.txt` (la dice Archivista).
**Verifiche.** core 41, pagina, account (segnalazione inviata dalla pagina), server (segnalazione, chiave del PC,
cancellazione), scaricamento in una cartella con screenshot e scheda, Edge vero con 3-4 foto vere.
**Limiti.** Il «2A» grande con le lettere contornate non si legge: la persona lo scrive. Le foto di tutta la striscia
restano difficili (numeri di ~15 punti).

## 9 novembre 2026 · Tappa 15 chiusa: lettura delle foto (v0.26.0)

**Fatto.** Tutta la lettura in `F.readStrip(img, recognize, progress)` (la pagina passa solo Tesseract), così si misura in
Node. Passi: `straighten` (pendenza della riga numeri/vie in 12 fette, mediana, solo se le fette sono d'accordo),
`segmentStrip` (maschera di Bradley; bordo alto dalle righe verticali che salgono dalla riga sotto i numeri; righe nette
≥ 75% dell'altezza; nei buchi larghi più di 2,5 caselle anche righe tenui e righe «pallide» cercate sui bordi alto e
basso), poi casella per casella `cellImage` (grigio ×3) e `blackWhite` (Otsu nella casella, scritta chiara capovolta),
Tesseract psm 8 e, se incerto, psm 7. Pezzi larghi più caselle: i gruppi di inchiostro dentro. Meno di 4 caselle: il
vecchio metodo a gruppi di inchiostro.
**Misura.** `OCR_NM=… node tools/misura_lettura_foto.js`: 50/94 giusti (53%), 13 sbagliati (prima 22/94 e 35).
Strisce e numeri giusti in `dati/prova-lettura/` (privati). Tolti `numberWords` e `inkIn`, non più usati.
**Limiti.** a08_2 (rettangolo con tanto mobile sopra) resta a 0: la riga fra numeri e vie si cerca ancora al 58%
dell'altezza. Caselle doppie con numeri piccoli deboli. Senza rettangolo la foto intera non si legge.

## 9 novembre 2026 · Tappa 14 chiusa: due nomi in una casella (v0.25.0)

**Fatto.** «A / B» nel nome (riga da sola o prima dei due punti) → casella con `street`/`key` = A e `street2`/`key2` = B;
`streetRuns` unisce solo caselle con lo stesso `street2`. Colori: solo la chiave del primo nome (il secondo non entra in
`assignColors`). Elenco Vie: `key2` contato, voce «(con A)» se non ha caselle sue. `renameStreet` cambia uno dei due nomi.
Excel: due righe nella cella (`wrap`, grandezza dalla larghezza); `importa.js` rimette «A / B».
**Verifiche.** `tests/test_core.js` (41, anche andata e ritorno dall'Excel), `tests/test_pagina.js`, PDF ed Excel vero.

## 9 novembre 2026 · Tappa 13 chiusa: caselle doppie nel verso della via (v0.24.0)

**Fatto.** `Core.houseValue` (12B → 12,02), `Core.pairOrderFixes(text, town)`: per ogni casella «a/b» con numeri
diversi il verso viene dal valore della casella prima e di quella dopo sulla stessa riga (se mancano, dal confronto con la
casella stessa); se «a/b» va contro, la propone girata. `Core.fixPairOrder` riscrive solo quei pezzi (larghezza e «*»
restano). Usato in automatico dopo `F.routeLines` (lettura foto) e con un pulsante sotto il giro (non sui giri bloccati).
**Verifiche.** `tests/test_core.js` (40: via che scende, via che torna indietro, stesso numero con lettere, «(2)*»),
`tests/test_pagina.js` (avviso e pulsante), Edge in tempo reale.
**Rischio.** È un'ipotesi: dove una casella vera ha davvero i numeri al contrario, l'avviso resta e basta non premere.

## 9 novembre 2026 · Tappa 12 chiusa: le foto da guardare (v0.23.0)

**Fatto.** IndexedDB `casellino-foto`, archivio `foto` { id, sz, sign, name, blob, order, added }, indice `sz`; copie
JPEG 0,85 al massimo 2400 px (`smallCopy`), doppioni riconosciuti da nome+peso+data (`sign`). `dlg-photos` aperto con
`show()` (non modale) così si scrive il giro; sul telefono metà alta e `body.viewer-open` lascia spazio sopra. Uscita
dall'account con «togli il lavoro»: `forgetAllPhotos`.
**Verifiche.** `tests/prova_foto_edge.py` (Edge via DevTools, tempo reale: la modalità con il tempo accelerato non
aspetta IndexedDB e sembrava rotta), schermate su computer e telefono, serie completa.
**Limiti.** Le foto non passano da un dispositivo all'altro (l'account gratuito non ha spazio per le foto).

## 9 novembre 2026 · Tappa 11 chiusa: «Lo consegna un collega» (v0.22.0)

**Fatto.** `*` in fondo a un civico o a un nome da solo (prima o dopo «(2)») = `other: true` sulla casella
(`Core.otherLine`). Pagina: classe `other` (ombra interna in basso, colore `--ink`), pulsante sopra il giro
(`toggleOtherLine`, cursore o selezione) e nel riquadro della casella toccata (`toggleColleague`: una serie si scrive per
esteso). PDF: riga di 3 pt sotto il numero; Excel: bordo inferiore `thick` con il colore della scritta (`b.bc`).
**Verifiche.** `tests/test_core.js` (39), `tests/test_pagina.js` (cursore, selezione, tocco sulla casella), PDF e Excel vero
guardati. **Limite.** L'apertura di un Excel (`importa.js`) non legge ancora la riga spessa: il segno si rimette.

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