BEGIN;

CREATE TABLE care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('feeding', 'pumping')),
  subject_type text NOT NULL CHECK (subject_type IN ('child', 'mother')),
  child_id uuid,
  event_date date NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('exact', 'period', 'unknown')),
  event_time time,
  time_period text CHECK (
    time_period IS NULL
    OR time_period IN ('late_night', 'early_morning', 'morning', 'noon', 'evening', 'night')
  ),
  memo text NOT NULL DEFAULT '' CHECK (length(memo) <= 5000),
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
    (event_type = 'feeding' AND subject_type = 'child' AND child_id IS NOT NULL)
    OR
    (event_type = 'pumping' AND subject_type = 'mother' AND child_id IS NULL)
  ),
  CHECK (
    (time_type = 'exact' AND event_time IS NOT NULL AND time_period IS NULL)
    OR
    (time_type = 'period' AND event_time IS NULL AND time_period IS NOT NULL)
    OR
    (time_type = 'unknown' AND event_time IS NULL AND time_period IS NULL)
  )
);

CREATE TABLE milk_event_details (
  family_id uuid NOT NULL,
  event_id uuid PRIMARY KEY,
  amount_ml integer NOT NULL CHECK (amount_ml BETWEEN 1 AND 2000),
  FOREIGN KEY (family_id, event_id)
    REFERENCES care_events(family_id, id) ON DELETE CASCADE
);

CREATE INDEX care_events_family_date_idx
  ON care_events(family_id, event_date, event_time, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX care_events_child_date_idx
  ON care_events(child_id, event_date, event_time, created_at)
  WHERE deleted_at IS NULL AND child_id IS NOT NULL;

COMMIT;
