const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function generateReceiptNumber() {
    return 'RCP-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

router.get('/payments', verifyToken, async (req, res) => {
    try {
        let query = `
            SELECT p.id, p.receipt_number, p.plan_name, p.amount, p.payment_date, p.status,
                   u.id as user_id, u.full_name as user_name
            FROM payments p
            JOIN users u ON p.user_id = u.id
        `;
        const params = [];

        if (req.user.role !== 'admin') {
            query += ` WHERE p.user_id = ?`;
            params.push(req.user.id);
        }

        query += ` ORDER BY p.payment_date DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, payments: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/payments/total', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [[total]] = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'`);
        const [[today]] = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND DATE(payment_date) = CURDATE()`);
        res.json({ success: true, total_revenue: total.total, today_revenue: today.total });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/payments/create', verifyToken, async (req, res) => {
    try {
        const { plan_name, amount } = req.body;
        const user_id = req.user.id;

        if (!plan_name || !amount) {
            return res.status(400).json({ success: false, message: 'Plan name and amount required' });
        }

        let durationDays;
        switch (plan_name) {
            case 'Trial': durationDays = 1; break;
            case 'Monthly': durationDays = 30; break;
            case 'Annual': durationDays = 365; break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid plan name' });
        }

        const receipt_number = generateReceiptNumber();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(
                `UPDATE memberships SET status = 'Expired' WHERE user_id = ? AND status != 'Expired'`,
                [user_id]
            );

            const [paymentResult] = await connection.query(
                `INSERT INTO payments (user_id, receipt_number, plan_name, amount) VALUES (?, ?, ?, ?)`,
                [user_id, receipt_number, plan_name, amount]
            );

            const [membershipResult] = await connection.query(
                `INSERT INTO memberships (user_id, plan_name, duration_days, end_date, status)
                 VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), 'Active')`,
                [user_id, plan_name, durationDays, durationDays]
            );

            await connection.query(
                `UPDATE payments SET membership_id = ? WHERE id = ?`,
                [membershipResult.insertId, paymentResult.insertId]
            );

            await connection.commit();

            const [receipt] = await pool.query(`
                SELECT p.receipt_number, p.plan_name, p.amount, p.payment_date,
                       m.end_date, u.full_name as user_name
                FROM payments p
                JOIN users u ON p.user_id = u.id
                JOIN memberships m ON m.id = ?
                WHERE p.id = ?
            `, [membershipResult.insertId, paymentResult.insertId]);

            res.status(201).json({
                success: true,
                message: 'Payment completed',
                receipt: receipt[0]
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
