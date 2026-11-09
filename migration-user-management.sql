USE inmate_profile_db;

ALTER TABLE users
  ADD COLUMN full_name VARCHAR(150) NULL AFTER username,
  ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT FALSE AFTER role;

