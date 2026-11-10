ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS tabled_by_role text,
  ADD COLUMN IF NOT EXISTS motion_category text;
