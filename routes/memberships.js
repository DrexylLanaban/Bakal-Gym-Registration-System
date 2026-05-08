const express = require('express');
const { verifyToken } = require('../middleware/auth');
const pool = require('../database/db').pool;

const router = express.Router();

// Get membership status for a user
router.get('/membership/status/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT m.id, m.plan_name, m.duration_days, m.start_date, m.end_date, m.status,
                   TIMESTAMPDIFF(SECOND, NOW(), m.end_date) as seconds_remaining
            FROM memberships m
            WHERE m.user_id = ? AND m.status != 'Expired'
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
        console.error('Membership status error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get membership history for a user
router.get('/membership/history/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT id, plan_name, duration_days, start_date, end_date, status, created_at, updated_at
            FROM memberships
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        res.json({ success: true, memberships: rows });
    } catch (err) {
        console.error('Membership history error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all memberships (admin only)
router.get('/memberships', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT m.*, u.username, u.full_name, u.email
            FROM memberships m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
        `);

        res.json({ success: true, memberships: rows });
    } catch (err) {
        console.error('Memberships list error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update membership status (admin only)
router.put('/memberships/:id/status', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const membershipId = parseInt(req.params.id);
        const { status } = req.body;

        if (!['Pending', 'Active', 'Expired'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const [result] = await pool.query(
            `UPDATE memberships SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, membershipId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Membership not found' });
        }

        res.json({ success: true, message: 'Membership status updated successfully' });
    } catch (err) {
        console.error('Membership status update error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete membership (admin only)
router.delete('/memberships/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const membershipId = parseInt(req.params.id);

        const [result] = await pool.query(`DELETE FROM memberships WHERE id = ?`, [membershipId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Membership not found' });
        }

        res.json({ success: true, message: 'Membership deleted successfully' });
    } catch (err) {
        console.error('Membership deletion error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
