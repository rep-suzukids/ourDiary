BEGIN;

CREATE TABLE bowel_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  event_date date NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('exact', 'period', 'unknown')),
  event_time time,
  time_period text CHECK (
    time_period IS NULL
    OR time_period IN ('late_night', 'early_morning', 'morning', 'noon', 'evening', 'night')
  ),
  amount_code text NOT NULL CHECK (length(amount_code) BETWEEN 1 AND 40),
  consistency_code text NOT NULL CHECK (length(consistency_code) BETWEEN 1 AND 40),
  color_code text NOT NULL CHECK (length(color_code) BETWEEN 1 AND 40),
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
    (time_type = 'exact' AND event_time IS NOT NULL AND time_period IS NULL)
    OR
    (time_type = 'period' AND event_time IS NULL AND time_period IS NOT NULL)
    OR
    (time_type = 'unknown' AND event_time IS NULL AND time_period IS NULL)
  )
);

CREATE INDEX bowel_movements_family_date_idx
  ON bowel_movements(family_id, event_date, event_time, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX bowel_movements_child_date_idx
  ON bowel_movements(child_id, event_date, event_time, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
