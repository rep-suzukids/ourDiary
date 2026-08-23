BEGIN;

ALTER TABLE drive_album_files
  ADD COLUMN captured_on date;

CREATE INDEX drive_album_files_family_captured_idx
  ON drive_album_files(family_id, captured_on DESC)
  WHERE captured_on IS NOT NULL;

COMMIT;
