ALTER TABLE bill_stages
  ADD COLUMN IF NOT EXISTS hansard_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS hansard_report_complete boolean,
  ADD COLUMN IF NOT EXISTS hansard_debated boolean,
  ADD COLUMN IF NOT EXISTS hansard_outcome text,
  ADD COLUMN IF NOT EXISTS hansard_petition_date date;
