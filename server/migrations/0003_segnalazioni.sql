-- © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
-- Casellino v0.27.0: problems reported from the page (a few words, a screenshot), picked up by the PC and then removed.
CREATE TABLE segnalazioni (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  utente TEXT NOT NULL,
  testo TEXT NOT NULL DEFAULT '',       -- what happened, in the person's words (may be empty)
  sistema TEXT NOT NULL DEFAULT '',     -- operating system
  telefono TEXT NOT NULL DEFAULT '',    -- phone model, if the person remembers it
  dettagli TEXT NOT NULL DEFAULT '',    -- version of Casellino, browser, screen, last errors (JSON)
  immagine TEXT NOT NULL DEFAULT '',    -- the screenshot, a JPEG as a data: address (small)
  creata_il INTEGER NOT NULL
);
CREATE INDEX segnalazioni_account ON segnalazioni(account_id, creata_il);
