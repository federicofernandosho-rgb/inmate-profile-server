USE inmate_profile_db;

ALTER TABLE inmates
  ADD COLUMN admission_date DATE NULL,
  ADD COLUMN discharge_date DATE NULL,
  ADD COLUMN status_history TEXT NULL;
