BEGIN;

ALTER TABLE comments
  ADD CONSTRAINT comments_family_id_id_unique UNIQUE (family_id, id);

CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  reaction_key text NOT NULL CHECK (reaction_key ~ '^reaction-(0[1-9]|1[0-9]|20)$'),
  user_id uuid NOT NULL,
  diary_entry_id uuid,
  album_file_id uuid,
  comment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(diary_entry_id, album_file_id, comment_id) = 1),
  FOREIGN KEY (family_id, user_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, diary_entry_id)
    REFERENCES diary_entries(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, album_file_id)
    REFERENCES drive_album_files(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, comment_id)
    REFERENCES comments(family_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX reactions_diary_user_key_idx
  ON reactions(family_id, diary_entry_id, user_id, reaction_key)
  WHERE diary_entry_id IS NOT NULL;

CREATE UNIQUE INDEX reactions_photo_user_key_idx
  ON reactions(family_id, album_file_id, user_id, reaction_key)
  WHERE album_file_id IS NOT NULL;

CREATE UNIQUE INDEX reactions_comment_user_key_idx
  ON reactions(family_id, comment_id, user_id, reaction_key)
  WHERE comment_id IS NOT NULL;

CREATE INDEX reactions_diary_entry_idx
  ON reactions(family_id, diary_entry_id, reaction_key, created_at)
  WHERE diary_entry_id IS NOT NULL;

CREATE INDEX reactions_album_file_idx
  ON reactions(family_id, album_file_id, reaction_key, created_at)
  WHERE album_file_id IS NOT NULL;

CREATE INDEX reactions_comment_idx
  ON reactions(family_id, comment_id, reaction_key, created_at)
  WHERE comment_id IS NOT NULL;

CREATE TABLE reaction_usage_history (
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction_key text NOT NULL CHECK (reaction_key ~ '^reaction-(0[1-9]|1[0-9]|20)$'),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  use_count integer NOT NULL DEFAULT 1 CHECK (use_count > 0),
  PRIMARY KEY (family_id, user_id, reaction_key),
  FOREIGN KEY (family_id, user_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE CASCADE
);

CREATE INDEX reaction_usage_history_recent_idx
  ON reaction_usage_history(family_id, user_id, last_used_at DESC);

COMMIT;
