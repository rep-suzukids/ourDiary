BEGIN;

ALTER TABLE bowel_movements
  ADD COLUMN exclude_from_reminder boolean NOT NULL DEFAULT false;

COMMIT;
