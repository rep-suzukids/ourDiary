BEGIN;

CREATE TABLE family_care_settings (
  family_id uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  milk_interval_hours integer NOT NULL CHECK (milk_interval_hours BETWEEN 1 AND 24),
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (family_id, updated_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

COMMIT;
