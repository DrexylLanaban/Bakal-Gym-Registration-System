-- Comprehensive Database Schema Reset
-- This script will fix all member_id to user_id issues

-- Disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Drop and recreate tables with correct schema
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS workout_schedules;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS trainers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create tables with correct schema (user_id throughout)
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    profile_photo MEDIUMTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    role ENUM('admin', 'staff', 'member') DEFAULT 'member',
    profile_photo MEDIUMTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    membership_status VARCHAR(50) DEFAULT 'inactive',
    current_plan VARCHAR(100),
    display_status VARCHAR(50) DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE memberships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name ENUM('Trial','1-Minute Trial','Monthly','Annual') DEFAULT 'Trial',
    duration_days INT NOT NULL DEFAULT 0,
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    status ENUM('Pending','Active','Expired') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Wallet',
    status ENUM('paid','pending','failed') DEFAULT 'paid',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    membership_id INT,
    receipt_number VARCHAR(100) UNIQUE,
    plan_name VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE trainers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(30),
    specialization VARCHAR(100),
    experience_years INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    checkin_date DATE NOT NULL,
    checkin_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE workout_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    trainer_id INT NOT NULL,
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    exercise_name VARCHAR(255) NOT NULL,
    sets INT DEFAULT 3,
    reps INT DEFAULT 10,
    weight VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);

-- Insert default admin accounts
INSERT INTO admins (username, password, full_name, email, profile_photo) VALUES
('admin', '$2b$10$JUU0SEbcTDL/daqVerSC/One1KMhKfNk4z6K9AUArsSiL3.m51SPm', 'System Administrator', 'admin@bakalgym.com', 'bakal_gym'),
('kent', '$2b$10$kMJkeFUyOBO0kHvXwG1FdwRvTujVGOOQFwjMGJhtEe', 'Kent Dominic Villafuerte', 'kent@bakalgym.com', 'kent_dominic_villafuerte'),
('ryque', '$2b$10$h7.cIHAjLk/kmjkeFUyOBO0kHvXwG1FdwRvTujVGOOQFwjMGJhtEe', 'Ryque Valen Doromal', 'ryque@bakalgym.com', 'ryque_valen_doromal');

-- Verify tables created correctly
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME IN ('memberships', 'payments', 'users', 'members')
    AND COLUMN_NAME IN ('user_id', 'member_id')
ORDER BY TABLE_NAME, COLUMN_NAME;
