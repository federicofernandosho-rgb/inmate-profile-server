USE inmate_profile_db;

INSERT INTO users (username, password_hash, role)
VALUES (
  'admin',
  'c062dcf32fe16df56ae289b480706a8a:936a872dba5372fe520c444cd2109dfcf8c61221e0e483100b50716fe5295691',
  'admin'
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role);
