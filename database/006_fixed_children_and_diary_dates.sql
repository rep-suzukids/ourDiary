BEGIN;

ALTER TABLE diary_entries
  ADD COLUMN diary_date date;

UPDATE diary_entries
SET diary_date = (recorded_at AT TIME ZONE 'Asia/Tokyo')::date
WHERE diary_date IS NULL;

ALTER TABLE diary_entries
  ALTER COLUMN diary_date SET NOT NULL;

WITH family_admins AS (
  SELECT DISTINCT ON (family_id) family_id, user_id
  FROM family_memberships
  WHERE status = 'active' AND role = 'admin'
  ORDER BY family_id, created_at ASC
), fixed_children(display_name) AS (
  VALUES ('ともちゃん'), ('ゆうちゃん')
)
INSERT INTO children (family_id, display_name, created_by)
SELECT family_admins.family_id, fixed_children.display_name, family_admins.user_id
FROM family_admins
CROSS JOIN fixed_children
WHERE NOT EXISTS (
  SELECT 1
  FROM children
  WHERE children.family_id = family_admins.family_id
    AND children.display_name = fixed_children.display_name
    AND children.archived_at IS NULL
);

CREATE INDEX diary_entries_family_diary_date_idx
  ON diary_entries(family_id, diary_date, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
