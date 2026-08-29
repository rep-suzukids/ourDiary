BEGIN;

CREATE TABLE family_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  schedule_date date NOT NULL CHECK (
    schedule_date >= DATE '2026-01-01'
    AND schedule_date <= DATE '2050-12-31'
  ),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, author_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX family_schedules_family_date_idx
  ON family_schedules(family_id, schedule_date, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
