ALTER TABLE question_stats
  DROP CONSTRAINT question_stats_person_id_year_month_key;

ALTER TABLE question_stats
  ADD CONSTRAINT question_stats_person_id_year_month_mandate_key
  UNIQUE (person_id, year, month, mandate);
