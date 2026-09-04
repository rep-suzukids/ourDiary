BEGIN;

ALTER TABLE bowel_movements
  ALTER COLUMN amount_code DROP NOT NULL,
  ALTER COLUMN consistency_code DROP NOT NULL,
  ALTER COLUMN color_code DROP NOT NULL,
  ADD COLUMN urine_amount_code text CHECK (
    urine_amount_code IS NULL
    OR urine_amount_code IN ('small', 'normal', 'large')
  ),
  ADD CONSTRAINT bowel_movements_diaper_contents_check CHECK (
    urine_amount_code IS NOT NULL
    OR amount_code IS NOT NULL
  ),
  ADD CONSTRAINT bowel_movements_bowel_details_check CHECK (
    (amount_code IS NULL AND consistency_code IS NULL AND color_code IS NULL)
    OR
    (amount_code IS NOT NULL AND consistency_code IS NOT NULL AND color_code IS NOT NULL)
  );

COMMIT;
