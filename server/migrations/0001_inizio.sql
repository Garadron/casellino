-- © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
-- Casellino: accounts, sessions, saved works, limits on attempts.
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  utente TEXT NOT NULL UNIQUE,            -- user name, lower case
  password_impronta TEXT NOT NULL,        -- HMAC fingerprint, never the password
  recupero_impronta TEXT NOT NULL,        -- HMAC fingerprint of the recovery code
  errori INTEGER NOT NULL DEFAULT 0,
  bloccato_fino INTEGER NOT NULL DEFAULT 0,
  creato_il INTEGER NOT NULL
);

CREATE TABLE sessioni (
  impronta TEXT PRIMARY KEY,              -- HMAC fingerprint of the device token
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  creata_il INTEGER NOT NULL,
  usata_il INTEGER NOT NULL
);
CREATE INDEX sessioni_account ON sessioni(account_id);

CREATE TABLE lavori (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dati TEXT NOT NULL,                     -- the whole work, as saved by "Salva file"
  versione INTEGER NOT NULL DEFAULT 1,
  aggiornato_il INTEGER NOT NULL
);
CREATE INDEX lavori_account ON lavori(account_id, aggiornato_il);

CREATE TABLE tentativi (
  chiave TEXT PRIMARY KEY,                -- "accesso:<ip>" or "registrazione:<ip>"
  errori INTEGER NOT NULL,
  dal INTEGER NOT NULL
);
