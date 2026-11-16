-- =================================================================
-- Nyeri IT Solutions - Complete Combined Schema & Seed Script
-- =================================================================

CREATE DATABASE IF NOT EXISTS nyeri_it;
USE nyeri_it;

-- Temporarily disable foreign key checks for clean dropping/truncating
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS license_assignments;
DROP TABLE IF EXISTS licenses;
DROP TABLE IF EXISTS software_products;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS clients;

SET FOREIGN_KEY_CHECKS = 1;

-- =================================================================
-- TABLE CREATION (Parent tables first, then child tables)
-- =================================================================

-- 1. Clients Table
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  address TEXT,
  industry VARCHAR(100) DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'client') NOT NULL,
  client_id INT DEFAULT NULL,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 3. Software Products Table
CREATE TABLE software_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  website VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Licenses Table
CREATE TABLE licenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  software_id INT NOT NULL,
  license_key VARCHAR(255),
  license_type ENUM('perpetual', 'subscription', 'per-seat', 'open-source') NOT NULL,
  total_seats INT DEFAULT 1,
  cost_per_year DECIMAL(10,2) DEFAULT 0,
  purchase_date DATE NOT NULL,
  renewal_date DATE,
  status ENUM('active', 'expiring_soon', 'urgent', 'expired', 'inactive') DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (software_id) REFERENCES software_products(id) ON DELETE CASCADE
);

-- 5. License Assignments Table
CREATE TABLE license_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_id INT NOT NULL,
  client_id INT NOT NULL,
  seats_allocated INT DEFAULT 1,
  assigned_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_license_client (license_id, client_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 6. Notifications Table
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('urgent', 'warning', 'expired', 'info', 'success') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_license_id INT DEFAULT NULL,
  target_role ENUM('admin', 'client', 'all') NOT NULL,
  target_client_id INT DEFAULT NULL,
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (target_client_id) REFERENCES clients(id) ON DELETE CASCADE
);


-- =================================================================
-- SAMPLE DATA INSERTS (At least 10 rows per table)
-- =================================================================

-- 1. CLIENTS
INSERT INTO clients (id, company_name, contact_name, email, phone, address, industry, created_at) VALUES
(1, 'Savanna Logistics Ltd', 'Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', '+254 711 234 567', 'Nairobi, Kenya', 'Logistics', '2025-01-15 08:30:00'),
(2, 'Kilimanjaro Fintech', 'Grace Odhiambo', 'grace@kilifintech.co.ke', '+254 722 345 678', 'Mombasa, Kenya', 'Finance', '2025-01-20 09:15:00'),
(3, 'Serengeti Media Group', 'Ali Hassan', 'ali.hassan@serengeti.co.ke', '+254 733 456 789', 'Kisumu, Kenya', 'Media', '2025-02-01 10:00:00'),
(4, 'Baobab Healthcare', 'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', '+254 744 567 890', 'Nakuru, Kenya', 'Healthcare', '2025-02-10 11:45:00'),
(5, 'Apex Innovations', 'Sarah Jenkins', 's.jenkins@apexinnovations.com', '+1-555-0101', '100 Tech Way, Silicon Valley, CA', 'Technology', '2025-02-18 14:20:00'),
(6, 'BlueSky Transport', 'Michael Chang', 'mchang@blueskytrans.io', '+1-555-0202', '450 Harbor Blvd, Seattle, WA', 'Logistics', '2025-03-01 08:00:00'),
(7, 'HealthFirst Medical', 'Dr. Emily Ross', 'eross@healthfirstmed.org', '+1-555-0303', '789 Wellness Ave, Boston, MA', 'Healthcare', '2025-03-05 13:10:00'),
(8, 'Vertex Financial', 'David Sterling', 'dsterling@vertexfin.com', '+1-555-0404', '200 Wall St, New York, NY', 'Finance', '2025-03-12 15:40:00'),
(9, 'GreenLeaf Retail', 'Amanda Green', 'amanda@greenleafretail.net', '+1-555-0505', '55 Market St, Chicago, IL', 'Retail', '2025-03-20 09:00:00'),
(10, 'OmniCorp Solutions', 'Victor Vance', 'vance@omnicorp.com', '+1-555-1010', '500 Future Blvd, Atlanta, GA', 'General', '2025-03-25 16:00:00');

-- 2. USERS
INSERT INTO users (id, username, email, password_hash, role, client_id, is_active, created_at) VALUES
(1, 'Super Admin', 'admin@nyeriit.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', NULL, 1, '2025-01-10 07:00:00'),
(2, 'Jane Kamau', 'jane.kamau@nyeriit.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', NULL, 1, '2025-01-10 07:15:00'),
(3, 'Peter Mwangi', 'peter.mwangi@savannalogistics.co.ke', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 1, 1, '2025-01-15 08:35:00'),
(4, 'Grace Odhiambo', 'grace@kilifintech.co.ke', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 2, 1, '2025-01-20 09:20:00'),
(5, 'Ali Hassan', 'ali.hassan@serengeti.co.ke', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 3, 1, '2025-02-01 10:05:00'),
(6, 'Fatuma Wanjiru', 'fatuma@baobabhealth.co.ke', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 4, 1, '2025-02-10 11:50:00'),
(7, 'Sarah Jenkins', 's.jenkins@apexinnovations.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 5, 1, '2025-02-18 14:25:00'),
(8, 'Michael Chang', 'mchang@blueskytrans.io', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 6, 1, '2025-03-01 08:05:00'),
(9, 'David Sterling', 'dsterling@vertexfin.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 8, 1, '2025-03-12 15:45:00'),
(10, 'Amanda Green', 'amanda@greenleafretail.net', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', 9, 0, '2025-03-20 09:30:00');

-- 3. SOFTWARE PRODUCTS
INSERT INTO software_products (id, name, vendor, category, description, website, created_at) VALUES
(1, 'Microsoft 365 Business', 'Microsoft', 'Productivity', 'Office suite with Teams, Word, Excel, and cloud storage', 'https://microsoft.com', '2025-01-01 10:00:00'),
(2, 'Adobe Creative Cloud', 'Adobe', 'Design', 'Complete creative suite including Photoshop, Illustrator, and Premiere', 'https://adobe.com', '2025-01-01 10:00:00'),
(3, 'Kaspersky Endpoint Security', 'Kaspersky', 'Security', 'Enterprise endpoint protection and threat management', 'https://kaspersky.com', '2025-01-01 10:00:00'),
(4, 'QuickBooks Enterprise', 'Intuit', 'Accounting', 'Full-featured accounting and payroll management', 'https://quickbooks.intuit.com', '2025-01-01 10:00:00'),
(5, 'Zoom Business Pro', 'Zoom', 'Communication', 'Video conferencing with advanced admin controls', 'https://zoom.us', '2025-01-01 10:00:00'),
(6, 'Slack Pro', 'Salesforce', 'Communication', 'Business messaging and collaboration platform', 'https://slack.com', '2025-01-01 10:00:00'),
(7, 'AutoCAD LT', 'Autodesk', 'Engineering', '2D drafting and documentation software', 'https://autodesk.com', '2025-01-01 10:00:00'),
(8, 'Bitdefender GravityZone', 'Bitdefender', 'Security', 'Cloud-based endpoint security management', 'https://bitdefender.com', '2025-01-01 10:00:00'),
(9, 'Tableau Creator', 'Salesforce', 'Data Analytics', 'Interactive data visualization software for business intelligence.', 'https://www.tableau.com', '2025-01-01 10:00:00'),
(10, 'Docker Business', 'Docker, Inc.', 'Development', 'Containerization platform to build, share, and run applications.', 'https://www.docker.com', '2025-01-01 10:00:00');

-- 4. LICENSES
INSERT INTO licenses (id, software_id, license_key, license_type, total_seats, cost_per_year, purchase_date, renewal_date, status, notes, created_at) VALUES
(1, 1, 'M365-SVNN-A1B2-C3D4', 'per-seat', 25, 7500.00, '2025-11-05', '2026-11-08', 'urgent', 'Savanna Logistics primary license', '2025-11-05 08:40:00'),
(2, 3, 'KES-KLF-X9Y8-Z7W6', 'per-seat', 15, 3200.00, '2025-11-20', '2026-11-20', 'urgent', 'Kilimanjaro endpoint security', '2025-11-20 09:25:00'),
(3, 2, 'ACC-SER-Q1W2-E3R4', 'subscription', 10, 6000.00, '2025-11-30', '2026-11-25', 'expiring_soon', 'Serengeti design team license', '2025-11-30 10:10:00'),
(4, 5, 'ZM-BAO-T5Y6-U7I8', 'subscription', 50, 1800.00, '2025-12-01', '2026-11-30', 'expiring_soon', 'Baobab company-wide Zoom', '2025-12-01 11:55:00'),
(5, 4, 'QB-KLF-O9P0-A1S2', 'perpetual', 5, 4500.00, '2024-01-15', '2027-01-15', 'active', 'Kilimanjaro accounting', '2024-01-15 14:30:00'),
(6, 6, 'SLK-SER-D3F4-G5H6', 'subscription', 30, 2400.00, '2025-05-01', '2027-05-01', 'active', 'Serengeti team Slack', '2025-05-01 08:10:00'),
(7, 7, 'ACD-BAO-J7K8-L9M0', 'per-seat', 8, 5200.00, '2024-06-15', '2027-06-15', 'active', 'Baobab engineering team', '2024-06-15 13:20:00'),
(8, 8, 'BDF-SVNN-N1O2-P3Q4', 'per-seat', 20, 2800.00, '2023-10-01', '2026-10-01', 'expired', 'Savanna security — renewal needed', '2023-10-01 15:50:00'),
(9, 9, 'TBL-7712-MNOP-6666', 'per-seat', 10, 7000.00, '2025-03-01', '2025-03-30', 'expired', 'Renewal pending payment confirmation', '2025-03-01 09:05:00'),
(10, 10, 'DCK-1198-UVWX-9999', 'subscription', 15, 3000.00, '2025-03-20', '2026-03-20', 'inactive', 'Temporarily suspended account tier', '2025-03-20 16:05:00');

-- 5. LICENSE ASSIGNMENTS
INSERT INTO license_assignments (id, license_id, client_id, seats_allocated, assigned_date, notes, created_at) VALUES
(1, 1, 1, 25, '2025-11-05', 'Full deployment for all Savanna staff', '2025-11-05 09:00:00'),
(2, 2, 2, 15, '2025-11-20', 'All Kilimanjaro devices covered', '2025-11-20 10:00:00'),
(3, 3, 3, 10, '2025-11-30', 'Creative team full license', '2025-11-30 11:00:00'),
(4, 4, 4, 50, '2025-12-01', 'Company-wide video conferencing', '2025-12-01 09:30:00'),
(5, 5, 2, 5, '2024-01-15', 'Finance department accounting', '2024-01-15 14:00:00'),
(6, 6, 3, 30, '2025-05-01', 'All Serengeti employees collaboration', '2025-05-01 10:15:00'),
(7, 7, 4, 8, '2024-06-15', 'Architecture & engineering department', '2024-06-15 15:00:00'),
(8, 8, 1, 20, '2023-10-01', 'Expired — needs renewal security pack', '2023-10-01 09:00:00'),
(9, 9, 8, 10, '2025-03-02', 'Vertex Financial analytics team', '2025-03-02 11:30:00'),
(10, 10, 6, 15, '2025-03-21', 'BlueSky DevOps container pipeline', '2025-03-21 10:45:00');

-- 6. NOTIFICATIONS
INSERT INTO notifications (id, type, title, message, related_license_id, target_role, target_client_id, is_read, created_at) VALUES
(1, 'urgent', 'License Expiring in 3 Days', 'Microsoft 365 Business (Savanna Logistics) renews on Nov 8, 2026. Immediate action required.', 1, 'admin', NULL, 0, '2026-11-05 08:00:00'),
(2, 'urgent', 'Kaspersky License Expiring Soon', 'Kaspersky Endpoint Security (Kilimanjaro) renews on Nov 20, 2026. Only 15 days remaining.', 2, 'admin', NULL, 0, '2026-11-05 08:00:00'),
(3, 'warning', 'Adobe Creative Cloud Renewal Due', 'Adobe Creative Cloud (Serengeti Media) renews Nov 25, 2026. 20 days remaining.', 3, 'admin', NULL, 0, '2026-11-05 08:00:00'),
(4, 'warning', 'Zoom Business Pro Renewal Approaching', 'Zoom Business Pro (Baobab Healthcare) renews Nov 30, 2026.', 4, 'admin', NULL, 1, '2026-11-05 08:00