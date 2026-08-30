BEGIN;

ALTER TABLE drive_album_files
  ADD COLUMN is_published boolean NOT NULL DEFAULT false;

CREATE INDEX drive_album_files_family_published_idx
  ON drive_album_files(family_id, is_published, drive_created_at DESC, created_at DESC);

COMMIT;
