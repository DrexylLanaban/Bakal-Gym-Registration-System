const express = require('express');
const { verifyToken } = require('../middleware/auth');
const pool = require('../database/db').pool;

const router = express.Router();

// Generate receipt number
function generateReceiptNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `RCP${timestamp}${random}`;
}

// Create payment and membership
router.post('/payments/create', verifyToken, async (req, res) => {
    try {
        let {
            plan_name = '1-Minute Trial',
            amount = 0
        } = req.body;

        const user_id = req.user.id;

        // convert amount safely
        amount = parseFloat(amount) || 0;

        let durationMinutes = null;
        let durationDays = null;
        let endDateExpression;
        
        switch (plan_name) {
            case 'Trial':
                durationDays = 1;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL ? DAY)`;
                break;

            case '1-Minute Trial':
                durationMinutes = 1;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 MINUTE)`;
                break;

            case 'Monthly':
                durationDays = 30;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL ? DAY)`;
                break;

            case 'Annual':
                durationDays = 365;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL ? DAY)`;
                break;

            default:
                durationMinutes = 1;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 MINUTE)`;
                plan_name = '1-Minute Trial';
        }

        const receipt_number = generateReceiptNumber();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Update existing memberships to Expired status
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
                    ? [user_id, plan_name, 0]  // 0 days for 1-minute trial
                    : [user_id, plan_name, durationDays]
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
                message: 'Payment and membership created successfully',
                payment: receipt[0]
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Payment creation error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during payment processing' 
        });
    }
});

// Get payment history for a user
router.get('/payments/user/:userId', verifyToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT p.*, m.plan_name, m.end_date, m.status as membership_status
            FROM payments p
            LEFT JOIN memberships m ON p.membership_id = m.id
            WHERE p.user_id = ?
            ORDER BY p.payment_date DESC
        `, [userId]);

        res.json({ success: true, payments: rows });
    } catch (err) {
        console.error('Payment history error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all payments (admin only)
router.get('/payments', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [rows] = await pool.query(`
            SELECT p.*, u.username, u.full_name, m.plan_name, m.end_date, m.status as membership_status
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN memberships m ON p.membership_id = m.id
            ORDER BY p.payment_date DESC
        `);

        res.json({ success: true, payments: rows });
    } catch (err) {
        console.error('Payments list error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
