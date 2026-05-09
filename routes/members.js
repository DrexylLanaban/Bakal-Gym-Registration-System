const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/members', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.status, u.created_at,
                   m.plan_name, m.status as membership_status, m.end_date
            FROM users u
            LEFT JOIN memberships m ON u.id = m.user_id AND m.status != 'expired'
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, members: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/members/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.role !== 'admin' && parseInt(userId) !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.address, u.status, u.created_at,
                   m.id as membership_id, m.plan_name, m.duration_days, m.start_date, m.end_date, m.status as membership_status
            FROM users u
            LEFT JOIN memberships m ON u.id = m.user_id AND m.status != 'expired'
            WHERE u.id = ?
        `, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, member: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/members/counts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [[total]] = await pool.query(`SELECT COUNT(*) as count FROM users`);
        const [[active]] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`);
        const [[inactive]] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE status = 'inactive'`);
        const [[membershipActive]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM memberships WHERE status = 'Active'`);
        const [[membershipExpired]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM memberships WHERE status = 'Expired'`);

        res.json({
            success: true,
            total_members: total.count,
            active_users: active.count,
            inactive_users: inactive.count,
            active_memberships: membershipActive.count,
            expired_memberships: membershipExpired.count
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/members/:id', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { full_name, email, phone, address } = req.body;
        const updates = [];
        const params = [];

        if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (address !== undefined) { updates.push('address = ?'); params.push(address); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/members/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
        }
        await pool.query(`UPDATE users SET status = ? WHERE id = ?`, [status, userId]);
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/members/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await pool.query(`DELETE FROM users WHERE id = ?`, [userId]);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
