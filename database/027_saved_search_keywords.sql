BEGIN;

CREATE TABLE saved_search_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (char_length(trim(keyword)) BETWEEN 1 AND 100),
  display_order integer NOT NULL CHECK (display_order >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id),
  FOREIGN KEY (family_id, created_by)
    REFERENCES family_memberships(family_id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX saved_search_keywords_family_keyword_idx
  ON saved_search_keywords(family_id, lower(keyword));

CREATE INDEX saved_search_keywords_family_order_idx
  ON saved_search_keywords(family_id, display_order, created_at, id);

COMMIT;
