-- © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
-- Casellino v0.51.0: the conditions accepted once; the version accepted and when are the proof.
ALTER TABLE account ADD COLUMN condizioni_versione TEXT NOT NULL DEFAULT '';  -- '' = not accepted yet
ALTER TABLE account ADD COLUMN condizioni_il INTEGER NOT NULL DEFAULT 0;      -- when they were accepted
