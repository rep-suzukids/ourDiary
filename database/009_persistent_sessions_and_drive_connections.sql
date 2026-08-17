BEGIN;

CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_sessions_user_active_idx
  ON app_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX app_sessions_expiry_idx
  ON app_sessions(expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE google_drive_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_subject text NOT NULL,
  google_email citext NOT NULL,
  encrypted_refresh_token text NOT NULL,
  refresh_token_iv text NOT NULL,
  refresh_token_auth_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

CREATE TABLE google_drive_user_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  return_path text NOT NULL DEFAULT '/album',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX google_drive_user_oauth_states_expiry_idx
  ON google_drive_user_oauth_states(expires_at);

COMMIT;
