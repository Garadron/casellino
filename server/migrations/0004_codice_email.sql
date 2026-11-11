-- © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
-- Casellino v0.29.0: a forgotten password is changed with a 6-digit code sent by e-mail.
ALTER TABLE account ADD COLUMN codice_impronta TEXT NOT NULL DEFAULT '';  -- HMAC fingerprint of the e-mailed code ('' = none)
ALTER TABLE account ADD COLUMN codice_scade INTEGER NOT NULL DEFAULT 0;   -- when the code stops working
ALTER TABLE account ADD COLUMN codice_errori INTEGER NOT NULL DEFAULT 0;  -- wrong tries of that code

-- The e-mails sent in the last two days, to stay under the 100 a day that Gmail allows.
CREATE TABLE email_inviate (
  account_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  quando INTEGER NOT NULL
);
CREATE INDEX email_inviate_quando ON email_inviate (quando);
