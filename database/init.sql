-- =============================================================
-- Nyeri IT Solutions — MySQL Schema + Seed Data
-- Import this file via phpMyAdmin (or mysql CLI) once.
-- =============================================================

CREATE DATABASE IF NOT EXISTS `nyeri_it`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nyeri_it`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS license_assignments;
DROP TABLE IF EXISTS licenses;
DROP TABLE IF EXISTS software_products;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS clients;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE clients (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL DEFAULT '',
  email        VARCHAR(255) NOT NULL UNIQUE,
  phone        VARCHAR(50),
  address      TEXT,
  industry     VARCHAR(100) DEFAULT 'General',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','client') NOT NULL,
  client_id     INT DEFAULT NULL,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE software_products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  vendor      VARCHAR(255) NOT NULL,
  category    VARCHAR(100) NOT NULL,
  description TEXT,
  website     VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE licenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  software_id   INT NOT NULL,
  license_key   VARCHAR(255),
  license_type  ENUM('perpetual','subscription','per-seat','open-source') NOT NULL,
  total_seats   INT DEFAULT 1,
  cost_per_year DECIMAL(10,2) DEFAULT 0,
  purchase_date DATE NOT NULL,
  renewal_date  DATE,
  status        ENUM('active','expiring_soon','urgent','expired','inactive') DEFAULT 'active',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (software_id) REFERENCES software_products(id) ON DELETE CASCADE
);

CREATE TABLE license_assignments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  license_id      INT NOT NULL,
  client_id       INT NOT NULL,
  seats_allocated INT DEFAULT 1,
  assigned_date   DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_license_client (license_id, client_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE CASCADE
);

CREATE TABLE notifications (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  type               ENUM('urgent','warning','expired','info','success') NOT NULL,
  title              VARCHAR(255) NOT NULL,
  message            TEXT NOT NULL,
  related_license_id INT DEFAULT NULL,
  target_role        ENUM('admin','client','all') NOT NULL,
  target_client_id   INT DEFAULT NULL,
  is_read            TINYINT(1) DEFAULT 0,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (target_client_id)   REFERENCES clients(id)  ON DELETE CASCADE
);

-- ── Seed Data ───────────────────────────────────────────────────
-- Passwords are bcrypt hashes:
--   Admins  → Admin@2026!  /  Nyeri@Admin99
--   Clients → Client@2026

INSERT INTO clients (id, company_name, contact_name, email, phone, address, industry) VALUES
(1, 'Savanna Logistics Ltd',  'Peter Mwangi',   'peter.mwangi@savannalogistics.co.ke', '+254 711 234 567', 'Nairobi, Kenya',  'Logistics'),
(2, 'Kilimanjaro Fintech',    'Grace Odhiambo', 'grace@kilifintech.co.ke',              '+254 722 345 678', 'Mombasa, Kenya',  'Finance'),
(3, 'Serengeti Media Group',  'Ali Hassan',     'ali.hassan@serengeti.co.ke',           '+254 733 456 789', 'Kisumu, Kenya',   'Media'),
(4, 'Baobab Healthcare',      'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke',            '+254 744 567 890', 'Nakuru, Kenya',   'Healthcare');

INSERT INTO users (id, username, email, password_hash, role, client_id) VALUES
(1, 'Super Admin',    'admin@nyeriit.com',                      '$2a$10$YourHashHereForAdmin1Replace',  'admin',  NULL),
(2, 'Jane Kamau',     'jane.kamau@nyeriit.com',                 '$2a$10$YourHashHereForAdmin2Replace',  'admin',  NULL),
(3, 'Peter Mwangi',   'peter.mwangi@savannalogistics.co.ke',   '$2a$10$YourHashHereForClientReplace',  'client', 1),
(4, 'Grace Odhiambo', 'grace@kilifintech.co.ke',               '$2a$10$YourHashHereForClientReplace',  'client', 2),
(5, 'Ali Hassan',     'ali.hassan@serengeti.co.ke',            '$2a$10$YourHashHereForClientReplace',  'client', 3),
(6, 'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke',             '$2a$10$YourHashHereForClientReplace',  'client', 4);

-- NOTE: The placeholder hashes above will be replaced automatically
-- when you run `node database/seed.js` after importing this schema.
-- Or just import init.sql and then run `npm run seed`.

INSERT INTO software_products (id, name, vendor, category, description, website) VALUES
(1, 'Microsoft 365 Business',    'Microsoft',  'Productivity',  'Office suite with Teams, Word, Excel, and cloud storage',                 'https://microsoft.com'),
(2, 'Adobe Creative Cloud',      'Adobe',      'Design',        'Complete creative suite including Photoshop, Illustrator, and Premiere',  'https://adobe.com'),
(3, 'Kaspersky Endpoint Security','Kaspersky', 'Security',      'Enterprise endpoint protection and threat management',                    'https://kaspersky.com'),
(4, 'QuickBooks Enterprise',     'Intuit',     'Accounting',    'Full-featured accounting and payroll management',                         'https://quickbooks.intuit.com'),
(5, 'Zoom Business Pro',         'Zoom',       'Communication', 'Video conferencing with advanced admin controls',                         'https://zoom.us'),
(6, 'Slack Pro',                 'Salesforce', 'Communication', 'Business messaging and collaboration platform',                           'https://slack.com'),
(7, 'AutoCAD LT',                'Autodesk',   'Engineering',   '2D drafting and documentation software',                                  'https://autodesk.com'),
(8, 'Bitdefender GravityZone',   'Bitdefender','Security',      'Cloud-based endpoint security management',                                'https://bitdefender.com');

INSERT INTO licenses (id, software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes) VALUES
(1,  1, 'M365-SVNN-A1B2-C3D4', 'per-seat',    25, 7500.00, '2025-11-05', '2026-11-08', 'urgent',        'Savanna Logistics primary license'),
(2,  3, 'KES-KLF-X9Y8-Z7W6',  'per-seat',    15, 3200.00, '2025-11-20', '2026-11-20', 'urgent',        'Kilimanjaro endpoint security'),
(3,  2, 'ACC-SER-Q1W2-E3R4',  'subscription',10, 6000.00, '2025-11-30', '2026-11-25', 'expiring_soon', 'Serengeti design team license'),
(4,  5, 'ZM-BAO-T5Y6-U7I8',   'subscription',50, 1800.00, '2025-12-01', '2026-11-30', 'expiring_soon', 'Baobab company-wide Zoom'),
(5,  4, 'QB-KLF-O9P0-A1S2',   'perpetual',   5,  4500.00, '2024-01-15', '2027-01-15', 'active',        'Kilimanjaro accounting'),
(6,  6, 'SLK-SER-D3F4-G5H6',  'subscription',30, 2400.00, '2025-05-01', '2027-05-01', 'active',        'Serengeti team Slack'),
(7,  7, 'ACD-BAO-J7K8-L9M0',  'per-seat',    8,  5200.00, '2024-06-15', '2027-06-15', 'active',        'Baobab engineering team'),
(8,  8, 'BDF-SVNN-N1O2-P3Q4', 'per-seat',    20, 2800.00, '2023-10-01', '2026-10-01', 'expired',       'Savanna security — renewal needed'),
(9,  1, 'M365-KLF-R5S6-T7U8', 'per-seat',    20, 6000.00, '2025-11-05', '2027-11-05', 'active',        'Kilimanjaro M365 suite'),
(10, 3, 'KES-BAO-V9W0-X1Y2',  'per-seat',    30, 4800.00, '2025-11-05', '2027-04-01', 'active',        'Baobab endpoint security');

INSERT INTO license_assignments (license_id, client_id, seats_allocated, assigned_date, notes) VALUES
(1,  1, 25, '2025-11-05', 'Full deployment for all Savanna staff'),
(2,  2, 15, '2025-11-20', 'All Kilimanjaro devices covered'),
(3,  3, 10, '2025-11-30', 'Creative team full license'),
(4,  4, 50, '2025-12-01', 'Company-wide video conferencing'),
(5,  2, 5,  '2024-01-15', 'Finance department'),
(6,  3, 30, '2025-05-01', 'All Serengeti employees'),
(7,  4, 8,  '2024-06-15', 'Architecture & engineering department'),
(8,  1, 20, '2023-10-01', 'Expired — needs renewal'),
(9,  2, 20, '2025-11-05', 'Full M365 for Kilimanjaro'),
(10, 4, 30, '2025-11-05', 'Full endpoint protection');

INSERT INTO notifications (type, title, message, related_license_id, target_role, target_client_id) VALUES
('urgent',  'License Expiring in 3 Days',          'Microsoft 365 Business (Savanna Logistics) renews on Nov 8, 2026. Immediate action required.',          1,  'admin',  NULL),
('urgent',  'Kaspersky License Expiring Soon',      'Kaspersky Endpoint Security (Kilimanjaro) renews on Nov 20, 2026. Only 15 days remaining.',             2,  'admin',  NULL),
('warning', 'Adobe Creative Cloud Renewal Due',     'Adobe Creative Cloud (Serengeti Media) renews Nov 25, 2026. 20 days remaining.',                        3,  'admin',  NULL),
('warning', 'Zoom Business Pro Renewal Approaching','Zoom Business Pro (Baobab Healthcare) renews Nov 30, 2026.',                                            4,  'admin',  NULL),
('expired', 'License Expired: Bitdefender',         'Bitdefender GravityZone for Savanna Logistics expired on Oct 1, 2026. Please renew immediately.',       8,  'admin',  NULL),
('urgent',  'Your Microsoft 365 License Is Expiring','Your Microsoft 365 Business license expires in 3 days (Nov 8, 2026). Contact Nyeri IT Solutions.',    1,  'client', 1),
('urgent',  'Kaspersky Security License Expiring',  'Your Kaspersky Endpoint Security license expires Nov 20, 2026. Please contact your IT provider.',       2,  'client', 2),
('warning', 'Adobe Creative Cloud Renewal',         'Your Adobe Creative Cloud subscription renews Nov 25, 2026. Ensure payment is arranged.',               3,  'client', 3),
('warning', 'Zoom License Renewal Reminder',        'Your Zoom Business Pro license renews Nov 30, 2026.',                                                   4,  'client', 4),
('expired', 'Bitdefender License Has Expired',      'Your Bitdefender GravityZone has expired. Your devices may be unprotected. Contact Nyeri IT.',          8,  'client', 1);
