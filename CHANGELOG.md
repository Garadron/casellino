# Registro delle versioni

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
