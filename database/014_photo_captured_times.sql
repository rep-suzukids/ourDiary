BEGIN;

ALTER TABLE drive_album_files
  ADD COLUMN captured_at timestamp without time zone;

COMMIT;
