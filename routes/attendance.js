const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/attendance/checkin', verifyToken, async (req, res) => {
    try {
        const user_id = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const [existing] = await pool.query(
            `SELECT id FROM attendance WHERE user_id = ? AND checkin_date = ?`,
            [user_id, today]
        );

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Already checked in today' });
        }

        const now = new Date();
        const time = now.toTimeString().split(' ')[0];

        const [result] = await pool.query(
            `INSERT INTO attendance (user_id, checkin_date, checkin_time) VALUES (?, ?, ?)`,
            [user_id, today, time]
        );

        res.json({
            success: true,
            message: 'Check-in successful',
            attendance: {
                id: result.insertId,
                checkin_date: today,
                checkin_time: time
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/attendance/user/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(
            `SELECT id, checkin_date, checkin_time, created_at FROM attendance WHERE user_id = ? ORDER BY checkin_date DESC`,
            [userId]
        );

        res.json({ success: true, attendance: rows });
    } catch (err) {
        console.error('User attendance query error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/attendance/all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT a.id, a.checkin_date, a.checkin_time, u.id as user_id, u.full_name as user_name
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.checkin_date DESC, a.checkin_time DESC
            LIMIT 100
        `);

        res.json({ success: true, attendance: rows });
    } catch (err) {
        console.error('Attendance all query error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/attendance/today', verifyToken, requireAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('Attendance today query for date:', today);
        
        // First check what dates exist in attendance table
        const [dates] = await pool.query(
            `SELECT DISTINCT checkin_date FROM attendance ORDER BY checkin_date DESC LIMIT 10`
        );
        console.log('Available dates in attendance:', dates);
        
        const [[count]] = await pool.query(
            `SELECT COUNT(*) as count FROM attendance WHERE DATE(checkin_date) = DATE(?)`,
            [today]
        );

        console.log('Attendance today count found:', count.count);
        
        // Also try without DATE() function
        const [[count2]] = await pool.query(
            `SELECT COUNT(*) as count FROM attendance WHERE checkin_date = ?`,
            [today]
        );
        console.log('Attendance today count (string match):', count2.count);
        
        res.json({ success: true, today_count: count.count });
    } catch (err) {
        console.error('Attendance today error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
