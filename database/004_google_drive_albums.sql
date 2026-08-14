BEGIN;

-- 003を未適用の新規環境でも、Drive版だけでセットアップできるようにします。
CREATE TABLE IF NOT EXISTS album_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_email citext NOT NULL,
  album_title text NOT NULL CHECK (length(trim(album_title)) BETWEEN 1 AND 500),
  token_hash text NOT NULL UNIQUE,
  oauth_state_hash text UNIQUE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE google_drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  owner_google_subject text NOT NULL,
  owner_email citext NOT NULL,
  encrypted_refresh_token text NOT NULL,
  refresh_token_iv text NOT NULL,
  refresh_token_auth_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drive_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL UNIQUE REFERENCES google_drive_connections(id) ON DELETE CASCADE,
  google_drive_folder_id text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS album_owner_invitations_family_created_idx
  ON album_owner_invitations(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS album_owner_invitations_expiry_idx
  ON album_owner_invitations(expires_at)
  WHERE accepted_at IS NULL;

COMMIT;
