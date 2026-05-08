const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Ensure JWT_SECRET is always available
const JWT_SECRET = process.env.JWT_SECRET || 'bakal-gym-jwt-secret-2026';
console.log('JWT_SECRET initialized:', !!JWT_SECRET);

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt for username:', username);
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        let [rows] = await pool.query(`SELECT id, username, password, full_name, email, 'admin' as role FROM admins WHERE username = ?`, [username]);
        let user = rows[0];
        let role = 'admin';

        if (!user) {
            [rows] = await pool.query(`SELECT id, username, password, full_name, email, status, 'user' as role FROM users WHERE username = ?`, [username]);
            user = rows[0];
            role = 'user';
        }

        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('User found:', { id: user.id, role, username: user.username });

        if (role === 'user' && user.status === 'inactive') {
            return res.status(403).json({ success: false, message: 'Account is inactive' });
        }

        console.log('Comparing password with hash:', user.password.substring(0, 20) + '...');
        const valid = await bcrypt.compare(password, user.password);
        console.log('Password valid:', valid);
        
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        console.log('JWT token generated successfully');

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role,
                ...(role === 'admin' ? {} : {})
            }
        });
    } catch (err) {
        console.error('Login error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name
        });
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { username, password, full_name, email, phone, address } = req.body;
        if (!username || !password || !full_name || !email) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const [existing] = await pool.query(`SELECT id FROM users WHERE username = ? OR email = ?`, [username, email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Username or email already exists' });
        }

        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            `INSERT INTO users (username, password, full_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)`,
            [username, hash, full_name, email, phone || null, address || null]
        );

        const token = jwt.sign(
            { id: result.insertId, username, role: 'user', full_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: result.insertId,
                username,
                full_name,
                email,
                role: 'user'
            }
        });
    } catch (err) {
        console.error('Registration error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            body: req.body
        });
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'admin') {
            [rows] = await pool.query(`SELECT id, username, full_name, email FROM admins WHERE id = ?`, [req.user.id]);
        } else {
            [rows] = await pool.query(`SELECT id, username, full_name, email, phone, address, status FROM users WHERE id = ?`, [req.user.id]);
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: { ...rows[0], role: req.user.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
