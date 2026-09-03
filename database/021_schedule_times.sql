BEGIN;

ALTER TABLE family_schedules
  ADD COLUMN start_time time,
  ADD COLUMN end_time time;

COMMIT;
