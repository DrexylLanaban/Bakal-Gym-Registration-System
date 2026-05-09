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
        console.log('Attendance today request received');
        
        // Use CURDATE() to get current server date
        const [[count]] = await pool.query(
            `SELECT COUNT(*) as today_attendance FROM attendance WHERE DATE(checkin_date) = CURDATE()`
        );
        
        console.log('Today attendance count:', count[0].today_attendance);
        
        res.json({ success: true, today_attendance: count[0].today_attendance });
    } catch (err) {
        console.error('Attendance today error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
