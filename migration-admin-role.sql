USE inmate_profile_db;

ALTER TABLE users
  MODIFY role ENUM('admin', 'entry', 'readonly') NOT NULL DEFAULT 'readonly';

-- Promote one existing user to Super Admin.
-- Change 'intel' to the username you want as your super admin.
UPDATE users
SET role = 'admin'
WHERE username = 'intel';
