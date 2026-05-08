const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [[totalMembers]] = await pool.query(`SELECT COUNT(*) as count FROM users`);
        const [[activeUsers]] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`);
        const [[activeMemberships]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM memberships WHERE status = 'Active'`);
        const [[expiredMemberships]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM memberships WHERE status = 'Expired'`);
        const [[todayAttendance]] = await pool.query(`SELECT COUNT(*) as count FROM attendance WHERE checkin_date = CURDATE()`);
        const [[totalPayments]] = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'`);
        const [[recentUsers]] = await pool.query(`SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5`);

        res.json({
            success: true,
            dashboard: {
                total_members: totalMembers.count,
                active_users: activeUsers.count,
                active_memberships: activeMemberships.count,
                expired_memberships: expiredMemberships.count,
                attendance_today: todayAttendance.count,
                total_payments: totalPayments.total,
                recent_registrations: recentUsers
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/dashboard/recent-payments', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.receipt_number, p.plan_name, p.amount, p.payment_date, u.full_name as user_name
            FROM payments p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.payment_date DESC
            LIMIT 5
        `);
        res.json({ success: true, payments: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
