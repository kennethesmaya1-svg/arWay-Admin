-- Campus AR Navigation - Admin Panel
-- Database schema
-- Import this file in phpMyAdmin / MySQL CLI before using the app.

CREATE DATABASE IF NOT EXISTS campus_ar_admin
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE campus_ar_admin;

-- Admin accounts that can log in to the dashboard
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buildings shown in the AR navigation app
CREATE TABLE IF NOT EXISTS buildings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image VARCHAR(255),
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  elevation DECIMAL(8, 2) NULL COMMENT 'meters',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Master list of facility names (re-used across buildings, e.g. "Wi-Fi", "Elevator")
CREATE TABLE IF NOT EXISTS facilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- Many-to-many link: a building can have many facilities, a facility can belong to many buildings
CREATE TABLE IF NOT EXISTS building_facilities (
  building_id INT NOT NULL,
  facility_id INT NOT NULL,
  PRIMARY KEY (building_id, facility_id),
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- After importing this file, run php/seed_admin.php once in your browser
-- to create the first admin login (default: admin / admin123), then delete that file.

-- If you already have a campus_ar_admin database from before coordinates/elevation
-- were added, run this once instead of re-importing everything above:
-- ALTER TABLE buildings
--   ADD COLUMN latitude DECIMAL(10, 7) NULL,
--   ADD COLUMN longitude DECIMAL(10, 7) NULL,
--   ADD COLUMN elevation DECIMAL(8, 2) NULL COMMENT 'meters';
