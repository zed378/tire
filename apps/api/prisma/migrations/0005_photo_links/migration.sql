-- ============================================================================
-- 0005_photo_links
--
-- Short, permanent URLs for stored photographs.
--
-- WHY: the signed download token is ~300 characters and an Excel cell stops at
-- 32,767. A six-axle truck has 22 tire positions at up to ten photographs each,
-- so an export listing every photo link by signed URL does not fit in the cell
-- it belongs in. `/api/uploads/s/<code>` is roughly 60 characters instead.
--
-- The code replaces the signature, so it does the signature's job: 16 characters
-- of base58 from a CSPRNG, about 93 bits. Guessing one is not a thing a network
-- will sustain.
--
-- `storage_key` is unique so re-exporting the same inspection reuses the codes
-- it already has, rather than growing a table of aliases to the same file.
-- ============================================================================

CREATE TABLE photo_links (
  code        text PRIMARY KEY,
  storage_key text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- The whole point of the code is that it cannot be guessed. A short one would
  -- make the table a directory of everybody's photographs.
  CONSTRAINT ck_photo_links_code_length CHECK (char_length(code) >= 16)
);

CREATE UNIQUE INDEX uq_photo_links_storage_key ON photo_links (storage_key);
