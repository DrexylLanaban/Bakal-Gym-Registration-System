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

const isRemote = dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1';

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    ...(isRemote ? {
        ssl: { rejectUnauthorized: false }
    } : {})
});

async function initDatabase() {
    const connection = await pool.getConnection();
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS bakal_gym`);
        await connection.query(`USE bakal_gym`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                profile_photo VARCHAR(100) DEFAULT 'bakal_gym',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                phone VARCHAR(20),
                address TEXT,
                status ENUM('active','inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS memberships (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                plan_name ENUM('Trial','Monthly','Annual') NOT NULL,
                duration_days INT NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL,
                status ENUM('Pending','Active','Expired') DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_end_date (end_date)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                membership_id INT,
                receipt_number VARCHAR(50) NOT NULL UNIQUE,
                plan_name VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('completed','pending','failed') DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_receipt (receipt_number)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                checkin_date DATE NOT NULL,
                checkin_time TIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_daily_checkin (user_id, checkin_date),
                INDEX idx_checkin_date (checkin_date)
            )
        `);

        const [adminRows] = await connection.query(`SELECT id FROM admins LIMIT 1`);
        if (adminRows.length === 0) {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('admin123', 10);
            await connection.query(`
                INSERT INTO admins (username, password, full_name, email, profile_photo)
                VALUES (?, ?, ?, ?, ?)
            `, ['admin', hash, 'System Administrator', 'admin@bakalgym.com', 'bakal_gym']);

            const hash2 = await bcrypt.hash('kent123', 10);
            await connection.query(`
                INSERT INTO admins (username, password, full_name, email, profile_photo)
                VALUES (?, ?, ?, ?, ?)
            `, ['kent', hash2, 'Kent Dominic Villafuerte', 'kent@bakalgym.com', 'kent_dominic_villafuerte']);

            const hash3 = await bcrypt.hash('ryque123', 10);
            await connection.query(`
                INSERT INTO admins (username, password, full_name, email, profile_photo)
                VALUES (?, ?, ?, ?, ?)
            `, ['ryque', hash3, 'Ryque Valen Doromal', 'ryque@bakalgym.com', 'ryque_valen_doromal']);
        }

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database init error:', err);
    } finally {
        connection.release();
    }
}

module.exports = { pool, initDatabase };
