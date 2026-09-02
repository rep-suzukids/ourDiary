BEGIN;

CREATE TABLE temperature_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  measured_date date NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('exact', 'period', 'unknown')),
  measured_time time,
  time_period text CHECK (
    time_period IS NULL
    OR time_period IN ('late_night', 'early_morning', 'morning', 'noon', 'evening', 'night')
  ),
  temperature_c numeric(3, 1) NOT NULL CHECK (temperature_c BETWEEN 30.0 AND 45.0),
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
    (time_type = 'exact' AND measured_time IS NOT NULL AND time_period IS NULL)
    OR
    (time_type = 'period' AND measured_time IS NULL AND time_period IS NOT NULL)
    OR
    (time_type = 'unknown' AND measured_time IS NULL AND time_period IS NULL)
  )
);

CREATE INDEX temperature_readings_family_date_idx
  ON temperature_readings(family_id, measured_date, measured_time, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX temperature_readings_child_date_idx
  ON temperature_readings(child_id, measured_date, measured_time, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
