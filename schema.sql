CREATE DATABASE IF NOT EXISTS inmate_profile_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inmate_profile_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'entry', 'readonly') NOT NULL DEFAULT 'readonly',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inmates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inmate_id VARCHAR(7) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  alias VARCHAR(150),
  dob DATE,
  age INT,
  address VARCHAR(255),
  comment TEXT,
  affiliation VARCHAR(255),
  gang_affiliation VARCHAR(150),
  person_name VARCHAR(255),
  in_prison BOOLEAN NOT NULL DEFAULT TRUE,
  admission_date DATE NULL,
  discharge_date DATE NULL,
  status_history TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inmate_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inmate_id INT NOT NULL,
  photo_type ENUM('front_face', 'left_face', 'right_face') NOT NULL,
  image_data LONGTEXT NOT NULL,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inmate_photos_inmate
    FOREIGN KEY (inmate_id)
    REFERENCES inmates(id)
    ON DELETE CASCADE,
  UNIQUE KEY unique_photo_type_per_inmate (inmate_id, photo_type)
);

CREATE TABLE IF NOT EXISTS inmate_tattoos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inmate_id INT NOT NULL,
  image_data LONGTEXT NOT NULL,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inmate_tattoos_inmate
    FOREIGN KEY (inmate_id)
    REFERENCES inmates(id)
    ON DELETE CASCADE
);
