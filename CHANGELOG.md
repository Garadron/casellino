# Registro delle versioni

## v0.24.0 · 2026-11-09 · Le caselle con due numeri nel verso della via

- **Lettura delle foto**: una casella con due numeri si scrive nel verso della via, capito dai numeri vicini
  («1, 3, 2A, 4, 7/5, 6» diventa «… 4, 5/7, 6»). Va bene anche per le vie che scendono e per quelle che tornano indietro
  sull'altro lato (pari che salgono, dispari che scendono).
- **Per quello già scritto**: sotto il giro un avviso dice quali caselle sembrano al contrario (si toccano per andare
  alla riga) e **«↕ Mettile in ordine»** le sistema tutte insieme. Con lo stesso numero e lettere diverse (9C/9B) non
  tocca niente: lì i numeri vicini non bastano a capire l'ordine.
- **«9C\*/9B\*»**, con l'asterisco su tutti e due i numeri, vale come una casella sola che consegna un collega.
- File: `app/src/core.js` (`houseValue`, `pairOrderFixes`, `fixPairOrder`, «*» ovunque nel civico), `app/src/ui.js`,
  `app/index.src.html`, `tests/test_core.js`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `docs/handoff.md`,
  `CHANGELOG.md`, `prove/`.

## v0.23.1 · 2026-11-09 · L'elenco delle vie della sottozona aperta

- L'elenco **Vie** a destra mostra solo le vie della sottozona aperta («Vie della 2A»), comprese le caselle che finisce
  nel mobile di un'altra sottozona; cambiando sottozona cambia anche l'elenco. Prima c'erano le vie di tutte, mescolate.
- Correggendo un nome dall'elenco, il messaggio dice se è cambiato anche nel giro di un'altra sottozona.
- **Sistemato**: nella finestra delle foto, senza foto compariva l'icona di un'immagine rotta.
- File: `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_pagina.js`, `Casellino.html`, `sito/`,
  `CHANGELOG.md`, `prove/`.

## v0.23.0 · 2026-11-09 · Le foto delle strisce, da guardare mentre scrivi

- **«🖼 Guarda le foto»** sopra il giro (anche quando è bloccato): una finestra che **resta aperta mentre scrivi**, sul
  telefono nella metà in alto. Foto dopo foto (◀ ▶), più grande o più piccola (＋ －, doppio clic), «＋ Aggiungi foto»
  anche senza farle leggere, «🗑 Togli questa foto» con conferma.
- Le foto scelte per la lettura si tengono da sole, una volta sola anche se le scegli di nuovo, per sottozona.
- **Restano solo su questo dispositivo** (una copia più leggera, al massimo 2400 punti di lato): non vanno
  nell'account né su internet, perché mostrano le strisce vere. Uscendo dall'account e togliendo il lavoro dal
  dispositivo, spariscono anche le foto.
- Prova nuova nel browser vero: `python tests/prova_foto_edge.py` (Edge, in tempo reale: il browser simulato delle
  altre prove non tiene le foto).
- File: `app/src/ui.js` (finestra delle foto, `keepPhotos`, `photosOf`), `app/src/style.css`, `app/index.src.html`,
  `tests/prova_foto_edge.py`, `README.md`, `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.22.0 · 2026-11-09 · «Lo consegna un collega»: i civici di un'altra linea, sottolineati

- Alcune caselle della zona tengono posta che consegna un collega di un'altra linea. Ora si segnano:
  - **dal telefono**: tocca la casella nella striscia e premi **«👥 Lo consegna un collega»** (di nuovo per togliere);
  - **dal computer**: cursore sul civico, o selezionane tanti, e lo stesso pulsante sopra il giro;
  - **scrivendo**: `17*`. Una serie come `7..15` si scrive per esteso solo quando se ne segna una casella.
- Nelle strisce, nel PDF e nell'Excel il numero di quelle caselle è **sottolineato da una riga spessa** nel colore della
  scritta (si vede anche sui colori scuri). Provato in Excel vero.
- La parola sul pulsante è «collega» e non la sigla del lavoro, che per la regola del progetto non va nel codice pubblico.
- File: `app/src/core.js` (`otherLine`, `other` nelle caselle), `app/src/pdf.js`, `app/src/xlsx.js`, `app/src/ui.js`
  (`toggleOtherLine`, `toggleColleague`), `app/src/style.css`, `app/index.src.html`, `tests/test_core.js`,
  `tests/test_pagina.js`, `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.21.0 · 2026-11-08 · Provincia, coordinate da Google Maps, elenco vie più sicuro

- **Provincia** (es. CR) accanto al comune: si scrive in maiuscolo da sola, entra nell'indirizzo («…, Borgo (CR)») e
  serve a cercare il comune giusto quando ce ne sono due con lo stesso nome. Le 107 sigle con il nome della provincia.
- **Quando l'indirizzo non c'è sulla mappa gratuita**: l'avviso dice chiaro che va messo una volta sola, «Scegli sulla
  mappa» si accende, e c'è una strada in più: «cercalo su Google Maps», clic destro (o dito premuto) sul punto, copia i
  due numeri e incollali nella casella. Va bene anche il link di Google Maps intero.
- **Elenco delle vie**: il server gratuito principale spesso è pieno e restava su «carico…». Ora si provano tre
  server, uno dopo l'altro, con un tempo massimo; se nessuno risponde lo dice. L'elenco trovato resta sul dispositivo:
  la volta dopo si apre subito. Il comune si trova anche scritto in minuscolo.
- File: `app/src/core.js` (`PROVINCES`, `provinceName`, `parseCoordinates`, provincia in `splitAddress` e
  `addressText`), `app/src/ui.js` (`overpass`, `osmStreetNames`), `app/src/style.css`, `app/index.src.html`,
  `tests/test_core.js`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.20.1 · 2026-11-08 · Il nome dell'autore in ogni file

- Decisione di Garadron sul copyright: nei progetti pubblici solo nome, cognome, «Garadron» e licenza; i dati personali
  e i documenti restano in un fascicolo privato, fuori da GitHub (lo prepara Archivista).
- La riga «© 2026 Emmanuel Surace (Garadron)» ora c'è anche nei 17 file che non l'avevano (prove, strumenti, stile,
  server). Il manifest dell'app è un file di dati senza commenti: il nome sta nella licenza.
- File: `app/src/style.css`, `app/sw.js`, `server/`, `tests/`, `tools/`, `Casellino.html`, `sito/`, `CHANGELOG.md`,
  `prove/`.

## v0.20.0 · 2026-11-08 · Indirizzo del centro in tre caselle, salvataggio quando si esce

- **Indirizzo del centro come nei siti della fibra**: Comune, Via, N. La via si sceglie dall'elenco delle vie di quel
  comune sulla mappa gratuita (OpenStreetMap), che si carica scrivendo il comune. Se la via scritta non c'è, il
  programma lo dice subito e spiega cosa fare: «Scegli sulla mappa» (ora si apre già sul comune) o «Usa la mia
  posizione», una volta sola. Il centro di una prova vera non si trovava proprio per questo: la sua via non è ancora
  sulla mappa gratuita.
- Gli indirizzi scritti prima in una riga si dividono da soli nelle tre caselle, in qualsiasi ordine
  («Borgo, Via dei Tigli, 15» o «Via dei Tigli 15 - 00000 Borgo (Frazione)»).
- **Salvataggio quando si esce**: chiudendo l'app o passando a un'altra, il lavoro si salva subito sul dispositivo e
  nell'account, senza aspettare i 2-3 secondi di prima.
- **Server degli account pubblicato** (v0.17.0): email nascosta e cambio del nome utente ora funzionano.
- File: `app/src/core.js` (`splitAddress`, `addressText`, `depotAddr`), `app/src/ui.js`, `app/src/style.css`,
  `app/index.src.html`, `tests/test_core.js`, `tests/test_pagina.js`, `tests/test_account_pagina.js`, `README.md`,
  `PROMEMORIA.md`, `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.19.0 · 2026-11-08 · Correggere i nomi delle vie dall'elenco

- Nell'elenco **Vie** si tocca un nome (o la matita ✏️) e si scrive quello giusto: cambia in **tutte le righe del giro**,
  in ogni sottozona dello stesso comune, anche dove era scritto in un altro modo («C.NA ALTA» e «CASCINA ALTA»). I
  civici restano, la via tiene il suo colore. Vale per vie, cascine, vicoli, nomi.
- Se il nome nuovo c'è già, chiede se unirle in una via sola; se il giro è bloccato (controllato), chiede conferma.
- Con l'elenco ufficiale delle vie del comune, mentre scrivi propone i nomi giusti.
- Anche «Torna al giro di prima» dell'ottimizzazione tiene il nome corretto.
- File: `app/src/core.js` (`renameStreet`), `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`,
  `tests/test_core.js`, `tests/test_pagina.js`, `README.md`, `Casellino.html`, `sito/`, `docs/handoff.md`,
  `CHANGELOG.md`, `prove/`.

## v0.18.0 · 2026-11-08 · Il centro di partenza: nome, indirizzo e punto sulla mappa

- **Nome del centro** e **indirizzo del centro**, in alto, al posto della sola casella «Ufficio di partenza». Il nome
  compare sulla cartina e nel totale del giro («partendo e tornando a …»).
- Scritto l'indirizzo, il programma lo **cerca da solo** sulla mappa e dice com'è andata: «📍 Sulla mappa: trovato»,
  «messo a mano», «dalla tua posizione», oppure «non trovato». Gli indirizzi scritti con il trattino e la frazione fra
  parentesi («Via Esempio 1 - 00000 Borgo (Frazione)») si cercano anche senza.
- **🗺 Scegli sulla mappa**: apre la cartina e il centro va dove tocchi. **📡 Usa la mia posizione**: se sei al centro,
  il punto lo dà il telefono (se il dispositivo lo permette). Se l'indirizzo è vuoto, si scrive da solo dal punto
  (OpenStreetMap, gratis); se c'è, resta com'è. **🔎 Cerca dall'indirizzo** torna a cercarlo dall'indirizzo.
- Il punto messo a mano o con la posizione resta nel lavoro (`depotPoint`) e vale per il giro e l'ottimizzazione.
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_core.js`,
  `tests/test_pagina.js`, `README.md`, `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.17.0 · 2026-11-08 · Email nell'account, nome utente da cambiare

- **L'email nella registrazione**: si chiede insieme a nome utente e password. Nel server resta nascosta: c'è solo la
  sua impronta (come per le password) e la forma «m***@esempio.it» per mostrarla al titolare. Chi ha già l'account la
  aggiunge da «Accedi» → «Nome utente ed email» → «Aggiungi».
- **Cambiare il nome utente**, una volta a settimana: fra un cambio e il successivo devono passare 7 giorni (il primo si
  può fare subito). Chiede la password; il dispositivo resta dentro e i lavori restano.
- **Il consiglio sotto il nome utente**: «Usa pure il tuo stesso nome utente che usi nel palmare se ti viene più facile
  da ricordare. Ma non la stessa password!»
- **Maiuscole e minuscole**: il nome utente vale come si vuole scritto («Mario» = «mario»), già da prima; ora c'è anche
  la prova e la pagina lo dice.
- **Sistemato**: la password sbagliata in «Elimina l'account» faceva uscire dall'account; ora dice solo «Password
  sbagliata». Le password sbagliate in queste richieste contano come gli accessi sbagliati.
- Server: `server/migrations/0002_email_e_nome.sql` (tre colonne nuove), `/api/io` dice email e prossimo cambio,
  `/api/cambia-nome`, `/api/cambia-email`.
- File: `server/src/worker.js`, `server/migrations/0002_email_e_nome.sql`, `app/src/ui.js`, `app/src/style.css`,
  `tests/test_server.js`, `tests/test_account_pagina.js`, `README.md`, `PROMEMORIA.md`, `Casellino.html`, `sito/`,
  `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.16.0 · 2026-11-08 · Stampa «per moduli», come il modello

- **Stampa per moduli** (ora è quella normale): come nel modello, ogni blocco ha le 4 file del modulo una sotto l'altra,
  con «1 Fila… 4 Fila» (o «1 Ala…») in grigio a sinistra; i blocchi da 22 caselle si mettono uno sotto l'altro sul
  foglio A4 orizzontale, 2 per foglio. Un pezzo corto (per esempio le ultime 3 caselle del casello) divide la riga con
  il pezzo corto dell'ala. Zona di prova 2A e 2B: 6 fogli.
- **Per piani** resta come seconda scelta: una fila per riga, 10 righe per foglio (5 fogli).
- La scelta sta in cima al menu «Stampa» e vale per il PDF e per l'Excel; il dispositivo se la ricorda.
- Le misure delle caselle sono quelle del modello. Provato in Excel vero: 6 pagine, le 22 caselle e la colonna delle
  file stanno nella larghezza del foglio.
- File: `app/src/core.js`, `app/src/pdf.js`, `app/src/xlsx.js`, `app/src/ui.js`, `app/src/style.css`,
  `app/index.src.html`, `tests/test_core.js`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `docs/handoff.md`,
  `CHANGELOG.md`, `prove/`.

## v0.15.0 · 2026-11-08 · Ufficio di partenza, cartina da correggere e «Ottimizzazione gita»

- **Ufficio di partenza** (centro di distribuzione): ora sta in alto, con Zona e Titolare; vale per tutto il lavoro. Il
  giro sulla cartina parte e torna lì.
- **Correggere la cartina**: ogni tappa (e l'ufficio) si trascina nel punto giusto; quelle non trovate, in rosso, si
  mettono con «📍 mettila sulla mappa» e un tocco sulla mappa. I punti corretti a mano restano salvati e valgono per il
  giro e per l'ottimizzazione.
- **⚡ Ottimizzazione gita**: con le distanze su strada fra tutte le tappe (gratis, OSRM; in linea d'aria se non
  risponde) cerca l'ordine delle vie con meno chilometri, dall'ufficio e ritorno, anche con i sensi unici. Mostra i km
  di adesso e quelli ottimizzati e il percorso nuovo in verde; il giro cambia solo con «Applica il nuovo ordine».
  «↩ Torna al giro di prima» lo rimette. Le righe delle caselle vuote (FINE STRISCIA, vuote…) dopo il riordino si
  tolgono, e il programma lo dice. Su un giro bloccato chiede conferma: cambia l'ordine, non i civici.
- Provato nel browser vero su un giro di prova di 6 vie: da 24,8 a 13,4 km, poi applicato e rimesso com'era.
- Note del telefono #2 e #3.
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_core.js`,
  `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.14.0 · 2026-11-08 · Bloccare il giro controllato

- **«🔒 Blocca il giro controllato»**: quando vie, cascine e civici di una sottozona sono controllati, il giro si blocca.
  Il testo del giro e il comune diventano di sola lettura, la lettura delle foto non aggiunge niente, e in cima al giro
  c'è scritto quando è stato bloccato. «Sblocca» lo riapre, chiedendo conferma. Il blocco resta nel file e nell'account.
- Nota del telefono #2 (prima parte).
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/style.css`, `tests/test_core.js`, `tests/test_pagina.js`,
  `Casellino.html`, `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.13.0 · 2026-11-08 · Aprire gli Excel già fatti

- **«Apri»** (e «Altro → Apri un Excel già fatto») legge anche gli Excel delle strisce, fatti con il modello (anche
  quelli vecchi, .xlsx o .xlsm) o da Casellino come il modello. Ogni foglio scritto diventa una sottozona; i fogli vuoti
  si saltano. I moduli si trovano dalle aree di stampa (33 caselle = ala, 91 = casello), o dai posti del modello.
- Su ogni striscia: le caselle dalla riga dei civici (una cella unita = casella larga), le vie dalla riga sotto; le
  caselle con due numeri tornano «2/4», i pezzi vuoti «vuota», «vuote N», «FINE STRISCIA», «STRISCIA VUOTA». Dopo si
  scrive il comune di ogni sottozona, si corregge e si ristampa con le regole nuove.
- Provato: un lavoro esportato e riaperto ha tutte le caselle al loro posto (anche con il file compresso come lo
  scrive Excel); il file del modello originale si legge nel browser vero.
- Gratis e dentro il dispositivo: lo zip dell'Excel lo apre il browser stesso.
- Nota del telefono #4.
- File: `app/src/importa.js` (nuovo), `app/src/ui.js`, `app/index.src.html`, `tests/test_core.js`, `Casellino.html`,
  `sito/`, `docs/handoff.md`, `CHANGELOG.md`, `prove/`.

## v0.12.0 · 2026-11-08 · Stampa in PDF ed Excel che riempiono il foglio A4

- **Stampa** (al posto di «Crea Excel»): PDF da stampare (consigliato), Excel, oppure Excel come il modello.
- PDF ed Excel **riempiono il foglio A4 orizzontale**: 10 righe di strisce per foglio, larghe 22 caselle. Ogni fila
  di ogni modulo si taglia in pezzi da 22 caselle, come prima; i pezzi corti della stessa fila (la fine del casello e la
  fine dell'ala) stanno sulla stessa riga, con una casella vuota in mezzo per tagliare. Sopra ogni pezzo c'è scritto
  dove va: «2A · Fila 1 · Casello · caselle 1-22». Per la zona 2: 5 fogli invece di 14.
- Le misure delle caselle restano quelle del modello: 1,2435 cm di larghezza, 1 cm per i civici, 0,7 cm per le vie.
  L'Excel lascia i margini laterali a zero come il modello (con i margini la 22ª casella non ci stava più) e centra la
  pagina; provato nell'Excel del PC: 5 pagine, nessuna colonna sul foglio dopo.
- Il PDF lo scrive il programma stesso, senza librerie esterne, anche senza internet; carattere standard dei PDF con le
  stesse larghezze di Arial grassetto. In fondo a ogni foglio: «foglio 1 di 5, stampa a dimensioni reali (100%)».
- Nota del telefono #1 (urgente).
- File: `app/src/pdf.js` (nuovo), `app/src/xlsx.js`, `app/src/core.js`, `app/src/ui.js`, `app/src/style.css`,
  `app/index.src.html`, `tests/test_core.js`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `README.md`,
  `docs/handoff.md` (nuovo), `CHANGELOG.md`, `prove/`.

## v0.11.0 · 2026-11-06 · L'account: i lavori salvati e ritrovati da ogni dispositivo

- **Accedi / Registrati** (in alto): con un nome utente e una password i lavori si salvano da soli nell'account mentre
  si scrive (circa 2 secondi dopo l'ultima modifica) e si ritrovano da qualsiasi telefono o computer. Senza account
  tutto funziona come prima, sul dispositivo.
- **I tuoi lavori**: l'elenco dei lavori salvati, con «Apri», «Elimina» e «+ Lavoro nuovo».
- **Password dimenticata**: niente email; alla registrazione si riceve un codice di recupero da scrivere da qualche
  parte. Con il codice si sceglie una password nuova, gli altri dispositivi escono e arriva un codice nuovo.
- **Due dispositivi**: se lo stesso lavoro è stato cambiato altrove, il programma chiede quale tenere.
- **Esci**: chiede se togliere il lavoro dal dispositivo (consigliato sui computer non propri, come in ufficio).
  **Elimina l'account** cancella anche tutti i lavori salvati.
- Senza internet il lavoro resta sul dispositivo e si salva nell'account appena torna la rete.
- Il server è gratuito (Cloudflare Workers con database D1, in Europa) e separato da ogni altro progetto. Password,
  codici di recupero e accessi sono salvati solo come impronte firmate con una chiave segreta; troppi tentativi
  sbagliati bloccano per un quarto d'ora.
- File: `server/` (nuovo: `src/worker.js`, `migrations/0001_inizio.sql`, `wrangler.toml`, `package.json`),
  `app/src/ui.js`, `app/src/core.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_server.js` (nuovo),
  `tests/test_account_pagina.js` (nuovo), `Casellino.html`, `sito/`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `prove/`.

## v0.10.0 · 2026-11-06 · Icona nuova e pulsante delle foto ben visibile

- **Icona nuova**: un casello visto di fronte, con le caselle, i divisori e sotto le strisce colorate delle vie. Si vede
  sulla schermata Home del telefono, nella scheda del browser e anche nel file unico per il PC (dentro il file).
  C'è anche la versione per Windows (`casellino.ico`).
- **Leggere le foto**: ora è un pulsante grande in cima al giro («📷 Carica e leggi le foto delle strisce») e una voce
  del menu «Altro». Dal telefono si possono scegliere dalla galleria o scattare subito.
- File: `tools/icone.py`, `app/icons/`, `app/manifest.webmanifest`, `app/sw.js`, `app/index.src.html`, `app/src/ui.js`,
  `app/src/style.css`, `tools/build.py`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `CHANGELOG.md`, `prove/`.

## v0.9.0 · 2026-11-05 · Leggere le strisce dalle foto

- **Leggi le strisce dalle foto** (nel riquadro del giro): si scelgono le foto in ordine, una striscia alla volta; per
  ognuna si raddrizza se serve, si trascina un rettangolo intorno alla striscia e si legge. Vie e civici letti vanno in
  fondo al giro come bozza, con un «?» dove la lettura è incerta.
- Gratis e privato: legge Tesseract, dentro il telefono o il PC; le foto non vanno da nessuna parte. La prima volta
  scarica il lettore (qualche MB).
- Come legge: la foto diventa bianca e nera, le righe stampate (bordi e righe fra le caselle) vengono tolte, ogni
  civico è letto da solo tagliando dove c'erano le righe fra le caselle, i nomi delle vie sono letti nella riga sotto.
  Provato su una striscia vera stampata: 20 civici su 22 letti giusti. Lo scritto a mano si legge poco.
- File: `app/src/foto.js` (nuovo), `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_core.js`,
  `Casellino.html`, `sito/`, `README.md`, `CHANGELOG.md`, `PROMEMORIA.md`, `prove/`.

## v0.8.0 · 2026-11-05 · Il mobile disegnato: moduli in qualsiasi ordine e la matita per i confini

- **Com'è fatto il mobile**: nel disegno si mettono i moduli da sinistra a destra, casello (91) o ala (33), e si
  sceglie di quale sottozona è ognuno, in qualsiasi ordine (ala-casello-ala-casello, ala-ala-casello-casello, una
  sottozona con due ali e un casello e l'altra con il solo casello…). Si spostano con le frecce, si aggiungono e si tolgono.
- **La matita**: una per sottozona, del suo colore. Si tocca nel disegno la casella da cui comincia una sottozona e da
  lì verso destra quella fila è sua (la A che finisce nel casello della B, la B che prende metà dell'ultima fila della
  A…). La gomma toglie il segno. Ogni giro riempie solo le sue caselle, sempre come un libro: fila 1 da sinistra a destra
  su tutto il mobile, poi fila 2.
- Il primo cambiamento nel disegno parte dal mobile di adesso, con il confine dove sta ora: nessuna casella si sposta
  (provato sulla zona 2: Excel identico). «Torna automatico» rimette il modo di prima.
- **Excel**: ogni sottozona ha il suo foglio con i suoi moduli al loro posto del modello (Ala A, Casello, Ala B); se ne
  ha di più, va su un altro foglio.
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/xlsx.js`, `app/src/style.css`, `app/index.src.html`,
  `tests/test_core.js`, `tests/test_pagina.js`, `Casellino.html`, `sito/`, `CHANGELOG.md`, `prove/`.

## v0.7.1 · 2026-11-05 · Tolte due parole che non dovevano esserci

- Nella spiegazione della cartina c'era la parola usata in azienda per il mobile, e in un commento del codice il nome di
  una via vera: tolti. Ora c'è un controllo (`tools/controllo_privacy.py`) che ferma il salvataggio se trova una parola
  vietata; l'elenco delle parole resta privato, sul PC.
- File: `app/index.src.html`, `app/src/core.js`, `tools/controllo_privacy.py`, `Casellino.html`, `sito/`, `CLAUDE.md`,
  `CHANGELOG.md`.

## v0.7.0 · 2026-11-05 · Il disegno di tutto il mobile, la cartina del giro, un colore per via

- **Disegno di tutto il mobile**: le sottozone una accanto all'altra, come il mobile vero (fila 1 in alto, fila 4
  sulla scrivania), con una riga colorata sotto ogni casella che dice di quale sottozona è e una riga rossa dove il
  confine passa dentro una fila. Si ingrandisce, si scarica come immagine, e toccando una casella si va alla sua riga.
- **Cartina del giro**: le vie della sottozona nell'ordine del casello sulla mappa (OpenStreetMap), con il percorso
  su strada e i chilometri (calcolo gratuito OSRM), facoltativamente partendo e tornando all'ufficio. Le vie trovate
  restano salvate nel lavoro e la volta dopo sono subito pronte; quelle non trovate sono segnate in rosso. Alla mappa
  vanno solo via, civico e comune.
- **Un colore per via in ogni sottozona**: 71 colori, i più diversi per primi, tutti con la scritta a contrasto forte
  (almeno 7:1). Nella stessa sottozona nessun colore si ripete (anche le vie che continuano nel mobile della sottozona
  dopo); due vie vicine non hanno mai colori simili, nemmeno due tonalità dello stesso colore. Nella scelta a mano i
  colori già usati e quelli simili alle vie accanto sono bloccati.
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/style.css`, `app/index.src.html`, `tests/test_core.js`,
  `Casellino.html`, `sito/`, `CHANGELOG.md`, `PROMEMORIA.md`, `prove/`.

## v0.6.0 · 2026-11-05 · Riga obliqua giusta, colori forti, la sottozona che continua nell'altra

- **Riga obliqua al verso giusto**: `2/4` divide la casella con una riga da in basso a sinistra a in alto a destra; i
  numeri stanno negli angoli liberi e la riga non li tocca mai (la grandezza si calcola per ogni casella), sia nel
  programma sia nell'Excel.
- **Niente scritte tagliate**: nel programma ogni scritta si rimpicciolisce quanto serve per stare tutta nella sua casella.
- **Colori nuovi, forti**: 13 colori con la scritta in contrasto (bianca o giallo chiarissimo sui colori scuri, nera sui
  chiari; contrasto da 6,9 a 18,9). Due vie vicine non hanno mai colori simili (stessa famiglia, o coppie come giallo e
  arancione, blu e viola); i colori nuovi alternano chiaro e scuro. Nell'elenco delle vie i colori troppo simili alle
  vie accanto sono bloccati. Anche la riga obliqua prende il colore della scritta.
- **Una via, un colore**: «C.NA ALTA» e «CASCINA ALTA», «V. ROMA» e «VIA ROMA», o con un «?», sono la stessa via: una
  riga sola nell'elenco e lo stesso colore su tutti i suoi pezzi.
- **Una sottozona più lunga continua nella sottozona dopo**, nell'ultima fila, come nel mobile vero: si scrive tutto nel
  giro della prima; la seconda comincia quella fila dopo le sue caselle. Nel programma si vede in fondo al giro della
  prima e all'inizio della fila della seconda (toccando una di quelle caselle si apre il giro giusto); nell'Excel si
  stampa sul foglio della seconda.
- File: `app/src/core.js`, `app/src/ui.js`, `app/src/xlsx.js`, `app/src/style.css`, `app/index.src.html`,
  `tests/test_core.js`, `Casellino.html`, `sito/`, `CHANGELOG.md`, `prove/`.

## v0.5.0 · 2026-11-04 · Si chiama Casellino: pubblico, firmato, online per il telefono

- **Nome nuovo**: il programma si chiama **Casellino**, il modulo grande **casello**, quello piccolo **ala** o
  **aletta**. Nessun riferimento ad aziende. I testi delle versioni qui sotto usano già le parole nuove.
- **Due numeri in una casella si dividono in obliquo**: `2/4` mette il 2 in alto a sinistra e il 4 in basso a destra,
  con una riga obliqua, tutto nella casella di sopra. La riga sotto tiene solo il nome della via, steso su tutto il suo
  pezzo (è la regola delle strisce).
- Guida «Come si scrive» con le regole delle strisce: civici sopra e via sotto, dispari e pari nelle vie, numeri in
  fila nelle piazze, aziende e cascine su 2 o 3 caselle, una casella di un'altra via in mezzo a una via.
- **Pubblico e firmato**: © 2026 Emmanuel Surace (Garadron). Licenza PolyForm Noncommercial 1.0.0 con un permesso in
  più: chi smista la posta lo usa gratis anche al lavoro; per vendere o farlo adottare da un'azienda serve il permesso
  dell'autore (`LICENSE`, `LICENZA.md`). Prova con data gratuita (OpenTimestamps) in `prove/`.
- **Telefono**: il programma è online con GitHub Pages e si installa sulla schermata Home.
- I file salvati con le versioni di prima si aprono ancora.
- File: tutto `app/`, `Casellino.html` (prima con un altro nome), `sito/`, `tests/`, `tools/`, `docs/COME-E-FATTO-IL-CASELLO.md`,
  `README.md`, `CLAUDE.md`, `PROMEMORIA.md`, `LICENSE`, `LICENZA.md`, `prove/`, `.github/workflows/pagine.yml`.

## v0.4.0 · 2026-11-04 · Il giro si scrive come si legge il casello, e c'è la versione per il telefono

- **Un solo giro per sottozona**, dall'inizio alla fine: il programma riempie le caselle come le righe di un libro, da
  sinistra a destra e dall'alto in basso (fila 1 di ogni modulo, poi fila 2…). Per riordinare basta spostare le righe.
- Nuove parole nel giro: `FINE STRISCIA`, `FINE FILA`, `STRISCIA VUOTA`. Una casella larga che non entra alla fine
  di una striscia passa intera alla striscia dopo.
- «Sei qui»: sotto il testo si vede la striscia dove si sta scrivendo, con la casella segnata. Tutte le strisce sono
  in ordine, fila per fila. Gli avvisi portano alla riga del giro.
- I file del formato vecchio (un testo per striscia) si aprono e diventano un giro: ogni casella resta al suo posto
  (provato su una zona vera: Excel identico, 1771 celle su 1771).
- **Telefono**: la cartella `sito/` è il programma pronto da mettere online, installabile sulla schermata Home, anche
  senza internet (la mappa no). Icona nuova. Il numero della versione si vede nel menu «Altro».

## v0.3.0 · 2026-11-04 · Prima versione del programma

- Un file unico che si apre nel browser, anche senza internet.
- Sottozone (per esempio A e B), ognuna con il suo comune e i suoi moduli: Ala A, Casello (91), Ala B (33), 4 file.
- Scrittura veloce: `VIA DEI TIGLI: 1..15, 14..2`, `35A (2)` (casella larga due), `20G..20M` (lettere senza J e K),
  `vuota`, cascine senza civico, `COMUNE:`, `CONFINE:`, `?` per le cose da controllare.
- La striscia colorata come quella vera, con il conto delle caselle e il punto dove finisce ogni foglio.
- Ogni via ha il suo colore, diverso dalle vie vicine; si può cambiare.
- Mappa: tocchi una casella o scrivi una via e la vedi su Google Maps (solo via, civico e comune).
- Elenco delle vie del comune: si incolla o si scarica da OpenStreetMap; suggerisce i nomi mentre scrivi e segnala quelli
  che non ci sono. Segnala anche i civici scritti due volte.
- **Crea Excel** con le misure del modello, controllate una per una anche aprendo il file in Excel: colonne, righe,
  margini, A4 orizzontale, carattere Arial 10. Un foglio per sottozona, un'area di stampa per modulo.
- Interruzione di pagina ogni 22 caselle (in Excel un A4 ne tiene 22) e nome della via ripetuto su ogni pezzo di
  striscia.
- Salvataggio automatico nel browser, «Salva file» e «Apri» per portarlo su un altro dispositivo, importa ed esporta
  come testo, esempio con vie inventate.

## v0.2.0 · 2026-11-04 · Studiati le foto e il modello Excel

- Guardate le foto di un casello vero e il modello Excel bianco: com'è fatto il casello, le misure delle strisce
  (1,244 cm per casella, 0,98 cm + 0,69 cm di altezza), i colori per via, come si stampa.
- Le foto e il modello restano sul PC, in `dati/`, fuori da GitHub.

## v0.1.0 · 2026-11-04 · Nasce il progetto

- La cartella del progetto, con le regole di base: che cosa serve, come si lavora, quali dati restano privati.
