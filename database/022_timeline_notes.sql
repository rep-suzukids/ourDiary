BEGIN;

CREATE TABLE timeline_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  note_date date NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('exact', 'period', 'unknown')),
  note_time time,
  time_period text CHECK (
    time_period IS NULL
    OR time_period IN ('late_night', 'early_morning', 'morning', 'noon', 'evening', 'night')
  ),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, child_id)
    REFERENCES children(family_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (family_id, author_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT,
  CHECK (
    (time_type = 'exact' AND note_time IS NOT NULL AND time_period IS NULL)
    OR
    (time_type = 'period' AND note_time IS NULL AND time_period IS NOT NULL)
    OR
    (time_type = 'unknown' AND note_time IS NULL AND time_period IS NULL)
  )
);

CREATE INDEX timeline_notes_family_date_idx
  ON timeline_notes(family_id, note_date, note_time, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX timeline_notes_child_date_idx
  ON timeline_notes(child_id, note_date, note_time, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
