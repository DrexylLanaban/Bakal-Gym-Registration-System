const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Check if tables exist
        const [tables] = await connection.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        // Create tables if they don't exist
        if (!tableNames.includes('admins')) {
            await connection.query(`
                CREATE TABLE admins (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
        }
        
        if (!tableNames.includes('users')) {
            await connection.query(`
                CREATE TABLE users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    phone VARCHAR(20),
                    address TEXT,
                    membership_status ENUM('Active', 'Expired', 'Pending') DEFAULT 'Pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
        }
        
        if (!tableNames.includes('memberships')) {
            await connection.query(`
                CREATE TABLE memberships (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    plan_name VARCHAR(50) NOT NULL,
                    duration_days INT NOT NULL,
                    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_date TIMESTAMP NOT NULL,
                    status ENUM('Active', 'Expired', 'Pending') DEFAULT 'Active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        }
        
        if (!tableNames.includes('payments')) {
            await connection.query(`
                CREATE TABLE payments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    membership_id INT,
                    receipt_number VARCHAR(50) UNIQUE NOT NULL,
                    plan_name VARCHAR(50) NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL
                )
            `);
        }
        
        if (!tableNames.includes('attendance')) {
            await connection.query(`
                CREATE TABLE attendance (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    checkin_date DATE NOT NULL,
                    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        }
        
        // Insert default admin if not exists
        const [adminCheck] = await connection.query(
            "SELECT COUNT(*) as count FROM admins WHERE username = 'admin'"
        );
        
        if (adminCheck[0].count === 0) {
            await connection.query(`
                INSERT INTO admins (username, password, full_name, email)
                VALUES ('admin', '$2b$10$rQZ8ZqGZqZqZqZqZqZqZqO', 'System Administrator', 'admin@bakalgym.com')
            `);
        }
        
        connection.release();
        console.log('Database initialized successfully');
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

module.exports = { pool, initDatabase };
