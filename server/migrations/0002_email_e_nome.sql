-- © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
-- Casellino v0.17.0: the e-mail of the account and changing the user name once a week.
ALTER TABLE account ADD COLUMN email_impronta TEXT NOT NULL DEFAULT '';  -- HMAC fingerprint of the e-mail, never the e-mail
ALTER TABLE account ADD COLUMN email_vista TEXT NOT NULL DEFAULT '';     -- the e-mail hidden, as shown to the owner: m***@esempio.it
ALTER TABLE account ADD COLUMN nome_cambiato_il INTEGER NOT NULL DEFAULT 0; -- last change of the user name (0 = never)
