# Casellino

Progetto di Garadron (Emmanuel), nato il 4 novembre 2026. Si parla e si scrive in italiano, semplice e senza gergo; il
codice e i suoi commenti sono in inglese. Valgono le Regole Mondiali (le preferenze generali di Garadron).

## Che cosa serve

Garadron fa il postino. Ogni zona ha un mobile a caselle dove si smista la posta: il **casello** (il modulo grande, 91
caselle per fila) e l'**ala** o **aletta** (il modulo piccolo, 33 caselle per fila), ognuno con 4 file (ripiani). Sotto
ogni fila c'è una striscia di carta con i civici e le vie.

Casellino è il programma che aiuta a scrivere il giro e crea il **file Excel delle strisce da stampare**. Deve servire a
tutti i postini, non solo alla zona di Garadron.

## Le regole

- **Le parole**: nel repository non si nomina mai l'azienda per cui lavora Garadron, né la parola che si usa in
  azienda per il mobile. Si dice **casello**, **ala** o **aletta**, e il programma si chiama **Casellino** (v0.5.0).
- **Le vie, i civici e i nomi delle persone sono dati di lavoro.** Le foto, l'Excel di partenza e ogni nome vero stanno
  in `dati/`, che non va mai su GitHub. Nel codice, negli esempi, nei messaggi dei commit e nelle Release solo vie e
  civici inventati. Il repository è **pubblico**: prima di ogni commit si lancia `python tools/controllo_privacy.py`, che si ferma se trova una parola vietata (l'elenco è privato, in `dati/parole_vietate.txt`); il commit si fa solo se il controllo passa (`python tools/controllo_privacy.py && git commit ...`).
- I punti aperti del programma stanno in [PROMEMORIA.md](PROMEMORIA.md); quelli della zona di Garadron in
  `dati/PROMEMORIA-privato.md`. Si leggono tutti e due all'inizio di ogni sessione.
- Ogni versione va in [CHANGELOG.md](CHANGELOG.md). Licenza: PolyForm Noncommercial con un permesso in più per chi
  smista la posta ([LICENSE](LICENSE), [LICENZA.md](LICENZA.md)). Ogni versione ha la sua prova con data
  (OpenTimestamps) in `prove/`.

## Le decisioni di Garadron

- **Le misure del modello bianco non si toccano mai**: né larghezza né altezza delle caselle, né il foglio. Sono
  scritte in `app/src/xlsx.js` (GEOMETRY) e controllate da `tests/verifica_misure.py`. Ogni modifica all'Excel si prova
  anche con `tools/prova_in_excel.ps1`.
- **L'ordine di lettura, sempre**: il casello si segue da sinistra a destra e dall'alto in basso, come un libro. Il
  livello 1 è quello in alto, il 4 quello sulla scrivania. Fila 1 di ogni modulo da sinistra a destra (ala A, casello,
  ala B), poi fila 2, e così via. Dentro una casella prima il civico sopra e poi quello sotto, prima quello a sinistra
  e poi quello a destra. Per questo il giro di una sottozona si scrive in un testo solo, dall'inizio alla fine.
- Una zona di solito ha un casello e un'ala. Una zona grande può avere due sottozone (A e B) fatte a giorni alterni;
  la sottozona più grande può finire nel casello dell'altra, sull'ultima fila. Le caselle vuote nelle strisce di oggi
  sono volute; le caselle libere del modello si possono usare.
- Il programma è **una pagina che si apre nel browser** (`Casellino.html`, file unico) e funziona anche **sullo
  smartphone** (cartella `sito/`, online con GitHub Pages, installabile sulla schermata Home).
- **Niente a pagamento**: si cercano sempre alternative gratuite.
- **L'account** (v0.11.0, come nel Ricettario): server suo in `server/`, Cloudflare Worker `casellino` con database D1
  `casellino` (Europa), piano gratuito, separato dal Ricettario. La pagina resta su GitHub Pages e parla con il server
  con un gettone (`Authorization: Bearer`), senza cookie. La chiave `SEGRETO` sta solo su Cloudflare e, per non
  perderla, in `dati/segreto-server.txt`: se si perde, nessuno può più entrare con la sua password.
- La mappa per ora mostra un indirizzo alla volta su Google Maps; il percorso intero verrà dopo (gratis, OpenStreetMap).

## Come si lavora

1. Guardare le foto e capire com'è fatto il casello: quante caselle, in che ordine, come si dividono i civici (pari e
   dispari, intervalli, numeri con lettera o barra).
2. Proporre a Garadron, in poche righe, come funziona una novità, prima di scriverla.
3. Costruirla un pezzo alla volta, provando il file Excel stampato con lui.
