BEGIN;

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  diary_entry_id uuid,
  album_file_id uuid,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (diary_entry_id IS NOT NULL AND album_file_id IS NULL)
    OR (diary_entry_id IS NULL AND album_file_id IS NOT NULL)
  ),
  FOREIGN KEY (family_id, diary_entry_id)
    REFERENCES diary_entries(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, album_file_id)
    REFERENCES drive_album_files(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, author_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX comments_diary_entry_idx
  ON comments(family_id, diary_entry_id, created_at)
  WHERE diary_entry_id IS NOT NULL;

CREATE INDEX comments_album_file_idx
  ON comments(family_id, album_file_id, created_at)
  WHERE album_file_id IS NOT NULL;

COMMIT;
