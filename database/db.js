const mysql = require('mysql2/promise');
require('dotenv').config();

function parseDbUrl(url) {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 3306,
            user: parsed.username,
            password: decodeURIComponent(parsed.password),
            database: parsed.pathname.replace(/^\//, '')
        };
    } catch (e) {
        return null;
    }
}

let dbConfig;

if (process.env.DATABASE_URL) {
    dbConfig = parseDbUrl(process.env.DATABASE_URL);
} else {
    dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bakal_gym'
    };
}

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

async function initDatabase() {
    let connection;

    try {
        connection = await pool.getConnection();
        console.log('Database connected successfully');

        // ADMINS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(150) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                profile_photo MEDIUMTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // USERS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
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
            )
        `);

        // MEMBERS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS members (
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
            )
        `);

        // MEMBERSHIPS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS memberships (
                id INT AUTO_INCREMENT PRIMARY KEY,
                member_id INT NOT NULL,
                plan_name VARCHAR(100) NULL,
                duration_months INT NOT NULL,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                status ENUM('active', 'expired', 'pending') DEFAULT 'active',
                price DECIMAL(10,2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
            )
        `);

        // PAYMENTS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payments (
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
            )
        `);

        // ATTENDANCE TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                checkin_date DATE NOT NULL,
                checkin_time TIME NOT NULL,
                checkout TIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_daily_checkin (user_id, checkin_date),
                INDEX idx_checkin_date (checkin_date)
            )
        `);

        // TRAINERS TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS trainers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(150) NOT NULL,
                phone VARCHAR(30),
                email VARCHAR(150) NOT NULL UNIQUE,
                specialization VARCHAR(150),
                profile_photo MEDIUMTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('active', 'inactive') DEFAULT 'active'
            )
        `);

        // WORKOUT SCHEDULES TABLE
        await connection.query(`
            CREATE TABLE IF NOT EXISTS workout_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                member_id INT NOT NULL,
                trainer_id INT NOT NULL,
                day_of_week ENUM(
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday'
                ) NOT NULL,
                exercise_name VARCHAR(255) NOT NULL,
                sets INT DEFAULT 3,
                reps INT DEFAULT 10,
                weight VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
            )
        `);

        // FIX EXISTING MEMBERSHIPS TABLE
        await connection.query(`
            ALTER TABLE memberships
            MODIFY plan_name VARCHAR(100) NULL,
            MODIFY price DECIMAL(10,2) NULL
        `);

        // DEFAULT ADMINS
        const bcrypt = require('bcryptjs');

        const hash = await bcrypt.hash('admin123', 10);

        await connection.query(`
            INSERT IGNORE INTO admins
            (username, password, full_name, email, profile_photo)
            VALUES (?, ?, ?, ?, ?)
        `, [
            'admin',
            hash,
            'System Administrator',
            'admin@bakalgym.com',
            'bakal_gym'
        ]);

        const hash2 = await bcrypt.hash('kent123', 10);

        await connection.query(`
            REPLACE INTO admins
            (username, password, full_name, email, profile_photo)
            VALUES (?, ?, ?, ?, ?)
        `, [
            'kent',
            hash2,
            'Kent Dominic Villafuerte',
            'kent@bakalgym.com',
            'kent_dominic_villafuerte'
        ]);

        const hash3 = await bcrypt.hash('ryque123', 10);

        await connection.query(`
            REPLACE INTO admins
            (username, password, full_name, email, profile_photo)
            VALUES (?, ?, ?, ?, ?)
        `, [
            'ryque',
            hash3,
            'Ryque Valen Doromal',
            'ryque@bakalgym.com',
            'ryque_valen_doromal'
        ]);

        console.log('Database initialized successfully');

    } catch (err) {
        console.error('Database init error:', err);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    pool,
    initDatabase
};