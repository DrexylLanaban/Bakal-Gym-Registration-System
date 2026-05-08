const express = require('express');
const { pool } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate receipt number
function generateReceiptNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `RCP${timestamp}${random}`;
}

// Create payment
router.post('/payments/create', verifyToken, async (req, res) => {
    try {
        const { plan_name, amount } = req.body;
        const user_id = req.user.id;

        // Validate input
        if (!plan_name || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'plan_name and amount are required' 
            });
        }

        if (isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }

        let durationDays, endDateExpression;
        
        switch (plan_name) {
            case 'Trial':
                durationDays = 0; // 0 days for trial
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 DAY)`;
                break;
            case '1-Minute Trial':
                durationDays = 0; // 0 days for 1-minute trial
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 MINUTE)`;
                break;
            case 'Monthly':
                durationDays = 30;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 30 DAY)`;
                break;
            case 'Annual':
                durationDays = 365;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 365 DAY)`;
                break;
            default:
                durationDays = 0; // 0 days for 1-minute trial
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 MINUTE)`;
                plan_name = '1-Minute Trial';
        }

        const receipt_number = generateReceiptNumber();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Expire existing memberships
            await connection.query(
                `UPDATE memberships SET status = 'Expired' WHERE user_id = ? AND status != 'Expired'`,
                [user_id]
            );

            // Create payment record
            const [paymentResult] = await connection.query(
                `INSERT INTO payments (user_id, receipt_number, plan_name, amount) VALUES (?, ?, ?, ?)`,
                [user_id, receipt_number, plan_name, amount]
            );

            // Create membership record
            const [membershipResult] = await connection.query(
                `INSERT INTO memberships (user_id, plan_name, duration_days, start_date, end_date, status)
                 VALUES (?, ?, ?, NOW(), ${endDateExpression}, 'Active')`,
                plan_name === '1-Minute Trial' 
                    ? [user_id, plan_name, durationDays]
                    : [user_id, plan_name, durationDays, durationDays]
            );

            // Link payment to membership
            await connection.query(
                `UPDATE payments SET membership_id = ? WHERE id = ?`,
                [membershipResult.insertId, paymentResult.insertId]
            );

            await connection.commit();

            // Get receipt details
            const [receipt] = await pool.query(`
                SELECT p.*, m.plan_name, m.end_date, m.status as membership_status
                FROM payments p
                LEFT JOIN memberships m ON p.membership_id = m.id
                WHERE p.id = ?
            `, [paymentResult.insertId]);

            res.json({ 
                success: true, 
                message: 'Payment successful',
                receipt: receipt[0] 
            });
        } catch (err) {
            await connection.rollback();
            console.error('Payment creation error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Payment creation failed' 
            });
        } finally {
            connection.release();
        }
    }
});

// Get user payments
router.get('/payments', verifyToken, async (req, res) => {
    try {
        const user_id = req.user.id;
        
        const [payments] = await pool.query(`
            SELECT p.*, m.plan_name as membership_plan, m.end_date, m.status as membership_status
            FROM payments p
            LEFT JOIN memberships m ON p.membership_id = m.id
            WHERE p.user_id = ?
            ORDER BY p.payment_date DESC
        `, [user_id]);

        res.json({ 
            success: true, 
            payments: payments 
        });
    } catch (err) {
        console.error('Get payments error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get payments' 
        });
    }
});

// Get all payments (admin only)
router.get('/payments/admin', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [payments] = await pool.query(`
            SELECT p.*, u.full_name as user_name, m.plan_name as membership_plan, m.end_date
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN memberships m ON p.membership_id = m.id
            ORDER BY p.payment_date DESC
            LIMIT 100
        `);

        res.json({ 
            success: true, 
            payments: payments 
        });
    } catch (err) {
        console.error('Get admin payments error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get payments' 
        });
    }
});

// Get payment receipt
router.get('/payments/receipt/:id', verifyToken, async (req, res) => {
    try {
        const paymentId = req.params.id;
        const user_id = req.user.id;

        const [receipt] = await pool.query(`
            SELECT p.*, m.plan_name, m.end_date, m.status as membership_status
            FROM payments p
            LEFT JOIN memberships m ON p.membership_id = m.id
            WHERE p.id = ? AND p.user_id = ?
        `, [paymentId, user_id]);

        if (receipt.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Receipt not found' 
            });
        }

        res.json({ 
            success: true, 
            receipt: receipt[0] 
        });
    } catch (err) {
        console.error('Get receipt error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get receipt' 
        });
    }
});

module.exports = router;
