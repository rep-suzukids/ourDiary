BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_subject text UNIQUE,
  email citext NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE family_memberships (
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'parent', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  birth_date date,
  created_by uuid NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, created_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  author_id uuid NOT NULL,
  entry_type text NOT NULL DEFAULT 'note' CHECK (entry_type IN ('note', 'photo', 'milestone')),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  audience text NOT NULL DEFAULT 'parents_only'
    CHECK (audience IN ('parents_only', 'family_members', 'selected_members')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, child_id)
    REFERENCES children(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, author_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE entry_viewers (
  family_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id),
  FOREIGN KEY (family_id, entry_id)
    REFERENCES diary_entries(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, user_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, granted_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE entry_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  blob_url text NOT NULL,
  blob_pathname text NOT NULL,
  content_type text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (family_id, entry_id)
    REFERENCES diary_entries(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, created_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX family_memberships_user_id_idx ON family_memberships(user_id);
CREATE INDEX children_family_id_idx ON children(family_id) WHERE archived_at IS NULL;
CREATE INDEX diary_entries_family_recorded_idx
  ON diary_entries(family_id, recorded_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX diary_entries_child_recorded_idx
  ON diary_entries(child_id, recorded_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX entry_viewers_user_id_idx ON entry_viewers(user_id);
CREATE INDEX audit_logs_family_created_idx ON audit_logs(family_id, created_at DESC);

COMMIT;
