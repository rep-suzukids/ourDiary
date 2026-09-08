BEGIN;

CREATE TABLE medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, created_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE medication_targets (
  family_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  child_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (medication_id, child_id),
  FOREIGN KEY (family_id, medication_id)
    REFERENCES medications(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, child_id)
    REFERENCES children(family_id, id) ON DELETE RESTRICT
);

CREATE TABLE medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  schedule_type varchar(32) NOT NULL DEFAULT 'weekly',
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  timing_code varchar(32) NOT NULL DEFAULT 'anytime',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, schedule_type, weekday, timing_code),
  UNIQUE (family_id, medication_id, id),
  FOREIGN KEY (family_id, medication_id)
    REFERENCES medications(family_id, id) ON DELETE CASCADE
);

CREATE TABLE medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  child_id uuid NOT NULL,
  administered_date date NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('exact', 'period', 'unknown')),
  administered_time time,
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
  FOREIGN KEY (family_id, medication_id, schedule_id)
    REFERENCES medication_schedules(family_id, medication_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (family_id, child_id)
    REFERENCES children(family_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (family_id, author_id)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT,
  CHECK (
    (time_type = 'exact' AND administered_time IS NOT NULL AND time_period IS NULL)
    OR
    (time_type = 'period' AND administered_time IS NULL AND time_period IS NOT NULL)
    OR
    (time_type = 'unknown' AND administered_time IS NULL AND time_period IS NULL)
  )
);

CREATE UNIQUE INDEX medication_administrations_once_idx
  ON medication_administrations(schedule_id, child_id, administered_date)
  WHERE deleted_at IS NULL;

CREATE INDEX medication_administrations_family_date_idx
  ON medication_administrations(family_id, administered_date, administered_time, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX medication_schedules_due_idx
  ON medication_schedules(family_id, weekday, medication_id)
  WHERE is_active = true;

COMMIT;
