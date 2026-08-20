BEGIN;

ALTER TABLE drive_album_files
  ADD CONSTRAINT drive_album_files_family_id_id_key UNIQUE (family_id, id);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 30),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, created_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE drive_album_file_tags (
  family_id uuid NOT NULL,
  album_file_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_file_id, tag_id),
  FOREIGN KEY (family_id, album_file_id)
    REFERENCES drive_album_files(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, tag_id)
    REFERENCES tags(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, assigned_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX tags_family_created_idx ON tags(family_id, created_at, id);
CREATE INDEX drive_album_file_tags_family_tag_idx ON drive_album_file_tags(family_id, tag_id);

COMMIT;
