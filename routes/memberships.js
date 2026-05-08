const express = require('express');
const { pool } = require('../database/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/membership/status/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT m.id, m.plan_name, m.duration_months, m.start_date, m.end_date, m.status,
                   TIMESTAMPDIFF(SECOND, NOW(), m.end_date) as seconds_remaining
            FROM memberships m
            WHERE m.member_id = ? AND m.status != 'expired'
            ORDER BY m.id DESC
            LIMIT 1
        `, [userId]);

        if (rows.length === 0) {
            return res.json({ success: true, membership: null });
        }

        const membership = rows[0];
        if (membership.seconds_remaining <= 0) {
            await pool.query(`UPDATE memberships SET status = 'Expired' WHERE id = ?`, [membership.id]);
            membership.status = 'Expired';
            membership.seconds_remaining = 0;
        }

        res.json({ success: true, membership });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/membership/history/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT id, plan_name, duration_days, start_date, end_date, status, created_at
            FROM memberships
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        res.json({ success: true, memberships: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
