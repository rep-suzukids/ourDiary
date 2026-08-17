BEGIN;

ALTER TABLE milk_event_details
  DROP CONSTRAINT milk_event_details_amount_ml_check;

ALTER TABLE milk_event_details
  ALTER COLUMN amount_ml TYPE numeric(7, 2)
  USING amount_ml::numeric;

ALTER TABLE milk_event_details
  ADD CONSTRAINT milk_event_details_amount_ml_check
  CHECK (amount_ml > 0 AND amount_ml <= 2000);

COMMIT;
