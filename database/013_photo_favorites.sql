BEGIN;

CREATE TABLE photo_favorites (
  family_id uuid NOT NULL,
  album_file_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_file_id, user_id),
  FOREIGN KEY (family_id, album_file_id)
    REFERENCES drive_album_files(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, user_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE CASCADE
);

CREATE INDEX photo_favorites_family_user_idx
  ON photo_favorites(family_id, user_id, created_at DESC);

COMMIT;
