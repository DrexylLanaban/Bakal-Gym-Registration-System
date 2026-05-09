const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get user membership status
router.get('/membership/status/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Check if user is requesting their own status or is admin
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }

        const [rows] = await pool.query(`
            SELECT m.id, m.plan_name, m.duration_days, m.start_date, m.end_date, m.status,
                   TIMESTAMPDIFF(SECOND, NOW(), COALESCE(m.end_date, NOW())) as seconds_remaining
            FROM memberships m
            WHERE m.user_id = ? AND m.status != 'Expired'
            ORDER BY m.id DESC
            LIMIT 1
        `, [userId]);

        if (rows.length === 0) {
            return res.json({ 
                success: true, 
                membership: null 
            });
        }

        const membership = rows[0];
        
        // Auto-expire if time has run out
        if (membership.seconds_remaining <= 0) {
            console.log('Auto-expiring membership:', membership.id, 'Plan:', membership.plan_name);
            await pool.query(
                `UPDATE memberships SET status = 'Expired', end_date = NOW() WHERE id = ?`,
                [membership.id]
            );
            membership.status = 'Expired';
        }

        res.json({ 
            success: true, 
            membership: membership 
        });
    } catch (err) {
        console.error('Membership status error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get membership status' 
        });
    }
});

// Get all memberships (admin only)
router.get('/membership/admin', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT m.*, u.full_name as user_name, u.email as user_email
            FROM memberships m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
            LIMIT 100
        `);

        res.json({ 
            success: true, 
            memberships: rows 
        });
    } catch (err) {
        console.error('Get memberships error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get memberships' 
        });
    }
});

// Update membership status
router.put('/membership/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const membershipId = req.params.id;
        const { status } = req.body;

        if (!['Active', 'Expired', 'Pending'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        await pool.query(
            `UPDATE memberships SET status = ? WHERE id = ?`,
            [status, membershipId]
        );

        res.json({ 
            success: true, 
            message: 'Membership status updated' 
        });
    } catch (err) {
        console.error('Update membership error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update membership' 
        });
    }
});

// Get membership statistics
router.get('/membership/stats', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [[totalMembers]] = await pool.query('SELECT COUNT(*) as count FROM memberships');
        const [[activeMembers]] = await pool.query('SELECT COUNT(*) as count FROM memberships WHERE status = "Active"');
        const [[expiredMembers]] = await pool.query('SELECT COUNT(*) as count FROM memberships WHERE status = "Expired"');

        res.json({ 
            success: true, 
            stats: {
                total: totalMembers.count,
                active: activeMembers.count,
                expired: expiredMembers.count
            }
        });
    } catch (err) {
        console.error('Membership stats error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get membership stats' 
        });
    }
});

module.exports = router;
