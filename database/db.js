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

        // Check if tables need to be reset (member_id columns exist)
        const [membershipColumns] = await connection.query(
            "SHOW COLUMNS FROM memberships LIKE 'member_id'"
        );
        const [paymentColumns] = await connection.query(
            "SHOW COLUMNS FROM payments LIKE 'member_id'"
        );

        // If member_id columns exist, reset the database
        if (membershipColumns.length > 0 || paymentColumns.length > 0) {
            console.log('Detected old schema with member_id columns, resetting database...');
            
            // Disable foreign key checks
            await connection.query("SET FOREIGN_KEY_CHECKS = 0");
            
            // Drop all tables
            await connection.query("DROP TABLE IF EXISTS attendance");
            await connection.query("DROP TABLE IF EXISTS workout_schedules");
            await connection.query("DROP TABLE IF EXISTS payments");
            await connection.query("DROP TABLE IF EXISTS memberships");
            await connection.query("DROP TABLE IF EXISTS members");
            await connection.query("DROP TABLE IF EXISTS trainers");
            await connection.query("DROP TABLE IF EXISTS users");
            await connection.query("DROP TABLE IF EXISTS admins");
            
            // Re-enable foreign key checks
            await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        }

        // Create tables with correct schema (user_id throughout)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(150) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                membership_status VARCHAR(50) DEFAULT 'inactive',
                current_plan VARCHAR(100),
                display_status VARCHAR(50) DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS memberships (
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
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'Wallet',
                status ENUM('paid', 'pending', 'failed') DEFAULT 'paid',
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                membership_id INT,
                receipt_number VARCHAR(100) UNIQUE,
                plan_name VARCHAR(100),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                checkin_date DATE NOT NULL,
                checkin_time TIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Verify attendance table was created
        try {
            const [attendanceCheck] = await connection.query("SHOW TABLES LIKE 'attendance'");
            if (attendanceCheck.length > 0) {
                console.log('Attendance table verified');
            } else {
                console.log('Warning: Attendance table not found');
            }
        } catch (err) {
            console.log('Attendance table verification skipped:', err.message);
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS trainers (
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
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS workout_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                trainer_id INT NOT NULL,
                day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
                exercise_name VARCHAR(255) NOT NULL,
                sets INT DEFAULT 3,
                reps INT DEFAULT 10,
                weight VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
            )
        `);

        // Insert default admin accounts
        const bcrypt = require('bcryptjs');

        const hash = await bcrypt.hash('admin123', 10);

        await connection.query(`
            INSERT IGNORE INTO admins
            (username, password, full_name, email)
            VALUES (?, ?, ?, ?)
        `, [
            'admin',
            hash,
            'System Administrator',
            'admin@bakalgym.com'
        ]);

        const hash2 = await bcrypt.hash('kent123', 10);

        await connection.query(`
            INSERT IGNORE INTO admins
            (username, password, full_name, email)
            VALUES (?, ?, ?, ?)
        `, [
            'kent',
            hash2,
            'Kent Dominic Villafuerte',
            'kent@bakalgym.com'
        ]);

        const hash3 = await bcrypt.hash('ryque123', 10);

        await connection.query(`
            INSERT IGNORE INTO admins
            (username, password, full_name, email)
            VALUES (?, ?, ?, ?)
        `, [
            'ryque',
            hash3,
            'Ryque Valen Doromal',
            'ryque@bakalgym.com'
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

// Safe column addition helper
async function safeAddColumn(connection, tableName, columnName, columnDefinition) {
    try {
        const [rows] = await connection.query(
            `SHOW COLUMNS FROM ${tableName} LIKE ?`,
            [columnName]
        );
        
        if (rows.length === 0) {
            await connection.query(
                `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
            );
            console.log(`Added column ${columnName} to ${tableName}`);
        } else {
            console.log(`Column ${columnName} already exists in ${tableName}`);
        }
    } catch (err) {
        console.log(`Column ${columnName} update skipped:`, err.message);
    }
}

// Safe column modification helper
async function safeModifyColumn(connection, tableName, columnName, columnDefinition) {
    try {
        await connection.query(
            `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${columnDefinition}`
        );
        console.log(`Modified column ${columnName} in ${tableName}`);
    } catch (err) {
        console.log(`Column ${columnName} modification skipped:`, err.message);
    }
}

module.exports = {
    pool,
    initDatabase
};