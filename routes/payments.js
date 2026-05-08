const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { pool } = require('../database/db');

const router = express.Router();

// Generate receipt number
function generateReceiptNumber() {
    return `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
*/
router.post('/payments/create', verifyToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { plan_name, amount } = req.body;
        const user_id = req.user.id;

        if (!plan_name) {
            return res.status(400).json({
                success: false,
                message: 'Plan name required'
            });
        }

        const paymentAmount = parseFloat(amount || 0);
        let duration_days = 0;
        let endDateQuery = '';

        switch ((plan_name || '').trim()) {

    case 'Trial':
        duration_days = 0;
        endDateQuery = 'DATE_ADD(NOW(), INTERVAL 1 DAY)';
        break;

    case '1-Minute Trial':
        duration_days = 0;
        endDateQuery = 'DATE_ADD(NOW(), INTERVAL 1 MINUTE)';
        break;

    case 'Monthly':
        duration_days = 30;
        endDateQuery = 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
        break;

    case 'Annual':
        duration_days = 365;
        endDateQuery = 'DATE_ADD(NOW(), INTERVAL 365 DAY)';
        break;

    default:
        return res.status(400).json({
            success: false,
            message: `Invalid plan: ${plan_name}`
        });
}
        const receipt_number = generateReceiptNumber();

        await connection.beginTransaction();

        // Expire old memberships
        await connection.query(
            `
            UPDATE memberships
            SET status = 'Expired'
            WHERE user_id = ?
            `,
            [user_id]
        );

        // Create payment
        const [paymentResult] = await connection.query(
            `
            INSERT INTO payments
            (user_id, receipt_number, plan_name, amount)
            VALUES (?, ?, ?, ?)
            `,
            [user_id, receipt_number, plan_name, paymentAmount]
        );

        // Create membership
        const [membershipResult] = await connection.query(
            `
            INSERT INTO memberships
            (user_id, plan_name, duration_days, start_date, end_date, status)
            VALUES
            (?, ?, ?, NOW(), ${endDateQuery}, 'Active')
            `,
            [user_id, plan_name, duration_days]
        );

        // Link membership to payment
        await connection.query(
            `
            UPDATE payments
            SET membership_id = ?
            WHERE id = ?
            `,
            [membershipResult.insertId, paymentResult.insertId]
        );

        await connection.commit();

        // Get receipt
        const [receipt] = await connection.query(
            `
            SELECT
                p.*,
                m.end_date,
                m.status AS membership_status
            FROM payments p
            LEFT JOIN memberships m
            ON p.membership_id = m.id
            WHERE p.id = ?
            `,
            [paymentResult.insertId]
        );

        res.json({
            success: true,
            receipt: receipt[0]
        });

    } catch (err) {
        await connection.rollback();
        console.error('Payment creation error:', err);
        res.status(500).json({
            success: false,
            message: 'Payment failed'
        });

    } finally {
        connection.release();
    }
});

/*
|--------------------------------------------------------------------------
| USER PAYMENTS
|--------------------------------------------------------------------------
*/
router.get('/payments', verifyToken, async (req, res) => {
    try {
        const [payments] = await pool.query(
            `
            SELECT *
            FROM payments
            WHERE user_id = ?
            ORDER BY payment_date DESC
            `,
            [req.user.id]
        );

        res.json({
            success: true,
            payments
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments'
        });
    }
});

/*
|--------------------------------------------------------------------------
| ADMIN PAYMENTS
|--------------------------------------------------------------------------
*/
router.get('/payments/admin', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [payments] = await pool.query(`
            SELECT
                p.*,
                u.full_name
            FROM payments p
            LEFT JOIN users u
            ON p.user_id = u.id
            ORDER BY p.payment_date DESC
        `);

        res.json({
            success: true,
            payments
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments'
        });
    }
});

module.exports = router;
