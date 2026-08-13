-- 初回のみ実行します。メールアドレスと家族名を実際の値へ変更してください。
BEGIN;

WITH new_family AS (
  INSERT INTO families (name)
  VALUES ('わが家')
  RETURNING id
),
new_admin AS (
  INSERT INTO users (email, display_name)
  VALUES ('admin@example.com', '管理者')
  ON CONFLICT (email) DO UPDATE SET updated_at = now()
  RETURNING id
)
INSERT INTO family_memberships (family_id, user_id, role, status)
SELECT new_family.id, new_admin.id, 'admin', 'active'
FROM new_family, new_admin;

COMMIT;
