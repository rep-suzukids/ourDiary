BEGIN;

CREATE TABLE drive_album_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES drive_albums(id) ON DELETE CASCADE,
  google_drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type LIKE 'image/%'),
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  drive_created_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, google_drive_file_id)
);

CREATE INDEX drive_album_files_family_created_idx
  ON drive_album_files(family_id, drive_created_at DESC, created_at DESC);

COMMIT;
