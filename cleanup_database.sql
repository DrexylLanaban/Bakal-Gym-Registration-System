-- ========================================
-- Bakal Gym Database Cleanup Script
-- ========================================
-- This script will clean and reinitialize the Railway database

-- Drop all existing tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS workout_schedules;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS trainers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- ========================================
-- Create fresh tables with correct schema
-- ========================================

-- Admins table
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

-- Users table (gym members)
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
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Members table (additional member info)
CREATE TABLE members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(150) NOT NULL UNIQUE,
    current_status VARCHAR(50) DEFAULT 'active',
    profile_image MEDIUMTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    balance DECIMAL(10,2) DEFAULT 0.00,
    expiration_date DATETIME,
    start_date DATETIME,
    current_plan VARCHAR(100),
    display_status VARCHAR(50) DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Memberships table
CREATE TABLE memberships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    duration_months INT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status ENUM('active', 'expired', 'pending') DEFAULT 'active',
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Wallet',
    status ENUM('paid', 'pending', 'failed') DEFAULT 'paid',
    description VARCHAR(255),
    payment_date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plan_id INT,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES memberships(id) ON DELETE SET NULL
);

-- Attendance table
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    check_in_time TIME NOT NULL,
    check_out TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_daily_checkin (user_id, check_in_date)
);

-- Trainers table
CREATE TABLE trainers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(150) NOT NULL UNIQUE,
    specialization VARCHAR(150),
    profile_photo MEDIUMTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active'
);

-- Workout schedules table
CREATE TABLE workout_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    trainer_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    exercise_name VARCHAR(255) NOT NULL,
    sets INT DEFAULT 3,
    reps INT DEFAULT 10,
    weight VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);

-- ========================================
-- Insert default admin accounts
-- ========================================
INSERT INTO admins (username, password, full_name, email, profile_photo) VALUES
('admin', '$2b$10$tmNXgxZ69V/2I...', 'System Administrator', 'admin@bakalgym.com', 'bakal_gym'),
('kent', '$2b$10$tmNXgxZ69V/2I...', 'Kent Dominic Villafuerte', 'kent@bakalgym.com', 'kent_dominic_villafuerte'),
('ryque', '$2b$10$tmNXgxZ69V/2I...', 'Ryque Valen Doromal', 'ryque@bakalgym.com', 'ryque_valen_doromal');

-- ========================================
-- Success message
-- ========================================
SELECT 'Database cleaned and reinitialized successfully!' as message;
