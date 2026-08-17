BEGIN;

ALTER TABLE diary_entries
  ADD COLUMN subject_type text NOT NULL DEFAULT 'child'
    CHECK (subject_type IN ('child', 'father', 'mother'));

ALTER TABLE diary_entries
  ALTER COLUMN child_id DROP NOT NULL;

ALTER TABLE diary_entries
  ADD CONSTRAINT diary_entries_subject_reference_check CHECK (
    (subject_type = 'child' AND child_id IS NOT NULL)
    OR
    (subject_type IN ('father', 'mother') AND child_id IS NULL)
  );

COMMIT;
