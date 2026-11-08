# Registro delle versioni

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
