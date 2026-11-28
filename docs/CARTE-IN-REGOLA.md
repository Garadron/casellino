# Le carte in regola di Casellino

Controllo del 28 novembre 2026, versione 0.51.0, fatto con l'elenco della skill `app-di-garadron` (Regola Mondiale
«Le carte in regola», Garadron, 28 novembre 2026). ✅ = a posto; ⏳ = manca qualcosa, scritto accanto.

| # | Che cosa | Stato |
|---|----------|-------|
| 1 | Informativa sulla privacy aggiornata, con i dati raccolti, i servizi usati e la data (`/privacy.html`) | ✅ aggiornata il 28 novembre 2026: età 18, condizioni accettate |
| 2 | Condizioni d'uso brevi (`/condizioni.html`) | ✅ nuove, versione del 28 novembre 2026 |
| 3 | Le condizioni si accettano una volta: spunta non già messa, al primo passo della registrazione e al primo accesso degli account già fatti | ✅ nella pagina. ⏳ Il server che salva versione e data è pronto, ma va pubblicato (serve il sì di Garadron): fino ad allora l'accettazione resta sul dispositivo e parte da sola dopo |
| 4 | Eliminare l'account dall'app, con i dati | ✅ Il tuo account → Elimina l'account (con la password) |
| 5 | Un modo scritto per chiedere la cancellazione dei dati | ✅ l'email del supporto, nell'informativa e nelle condizioni |
| 6 | Solo i dati che servono | ✅ nome utente, email (solo impronta e forma nascosta), lavori, condizioni accettate |
| 7 | L'elenco dei servizi esterni | ✅ nell'informativa: Cloudflare, Google (Gmail), GitHub, OpenStreetMap, Google Maps (solo se si tocca il collegamento), jsDelivr |
| 8 | Niente tracciamento, niente cookie oltre a quelli tecnici | ✅ nessun cookie, nessuna statistica: non serve il banner |
| 9 | Niente trucchi che spingono una scelta | ✅ «Non accetto: esco dall'account» è sempre visibile; «Esci» chiede, con la scelta consigliata spiegata |
| 10 | Niente costi nascosti, niente recensioni o promesse finte | ✅ tutto gratis, non è negli store |
| 11 | Accessibilità: testo alternativo alle immagini, contrasto di giorno e di notte, tasti raggiungibili con la tastiera | ✅ le icone hanno `aria-hidden`, i tasti hanno parole o `aria-label`; giorno e notte guardati negli screenshot |
| 12 | Licenze di caratteri, icone e immagini | ✅ caratteri del sistema (nessuno scaricato); icone Lucide, licenza ISC (gratis anche per questo uso, scritta in `app/src/icone.js`); disegni del tutorial fatti per Casellino |
| 13 | Le email che non sono dell'account hanno il link per disiscriversi | ✅ non ce ne sono: Casellino manda solo il codice della password e le risposte del supporto |
| 14 | L'età minima, scritta nel `CLAUDE.md` | ✅ 18 anni (app di lavoro) |
