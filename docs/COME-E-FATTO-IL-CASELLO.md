# Come è fatto il casello, e come è fatto l'Excel delle strisce

Quello che abbiamo capito il 4 novembre 2026 guardando le foto di un casello vero e il modello Excel bianco con cui si
stampano le strisce. Le foto e il modello restano sul PC, in `dati/`. Qui sotto le vie e i civici sono inventati.

## Il casello, nelle foto

- Una zona ha di solito un **casello** (il modulo grande) e un'**ala** o **aletta** (il modulo piccolo), affiancati.
  Ogni modulo ha **4 file** (i ripiani): la 1 in alto, la 4 sulla scrivania. Ogni fila ha tante **caselle**, una
  accanto all'altra.
- Sul bordo di ogni fila è incollata una **striscia di carta**: sopra ogni casella c'è il civico, sotto il nome della
  via, e ogni via ha un **colore** diverso dalla vicina (verde, giallo, azzurro, rosso…).
- Il giro si legge **come un libro**: fila 1 da sinistra a destra (casello, poi ala), poi fila 2, e così via.
- Una zona grande può essere divisa in **due sottozone** (A e B), fatte a giorni alterni. La sottozona più grande può
  finire nel casello dell'altra, sull'ultima fila.

## Il modello Excel

Il modello ha i moduli uno accanto all'altro: Ala A (33 caselle) · Fila del casello (91 caselle) · Ala B (33 caselle),
ognuno con 4 file. Le misure sono quelle vere, così la striscia stampata combacia con le caselle:

- **una colonna = una casella**, larga **1,244 cm**;
- **ogni fila occupa due righe**: sopra, alta **0,98 cm**, il civico (o i civici) della casella; sotto, alta
  **0,69 cm**, il nome della via, steso su tutte le caselle di quella via;
- ai lati di ogni modulo una cella stretta, scritta in verticale, dice «1 Fila», «2 Ala»…; sopra le caselle c'è il
  loro numero (1, 2, 3…), che non si stampa;
- carattere Arial in grassetto, che si rimpicciolisce da solo se il testo è lungo;
- ogni via ha il suo colore di sfondo, sia sul civico sia sul nome della via;
- si stampa su **A4 orizzontale, senza margini ai lati, al 100%**: ogni modulo è un'area di stampa a parte. In Excel
  un foglio tiene **22 caselle**, poi si taglia e si incolla.

Che cosa può stare in una casella:

- un civico solo: `12`, `5B`, `168A`;
- due civici: `67-69`, `49/51` (uno sopra e uno sotto), `61\59` (uno accanto all'altro);
- un civico con il nome di una ditta o di una persona, spesso su **2 caselle unite**;
- una parola sola: un ufficio, una cascina, una ditta senza civico.

La stessa via può comparire in più punti del casello.
