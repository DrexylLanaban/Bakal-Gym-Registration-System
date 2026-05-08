router.post('/payments/create', verifyToken, async (req, res) => {
    let connection;

    try {
        const { plan_name, amount } = req.body;
        const user_id = req.user.id;

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

        let durationDays;
        let endDateExpression;

        switch (plan_name) {
            case 'Trial':
                durationDays = 1;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 DAY)`;
                break;

            case '1-Minute Trial':
                durationDays = 0;
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
                durationDays = 0;
                endDateExpression = `DATE_ADD(NOW(), INTERVAL 1 MINUTE)`;
        }

        const receipt_number = generateReceiptNumber();
        connection = await pool.getConnection();

        await connection.beginTransaction();

        await connection.query(
            `UPDATE memberships SET status = 'Expired' WHERE user_id = ? AND status != 'Expired'`,
            [user_id]
        );

        const [paymentResult] = await connection.query(
            `INSERT INTO payments (user_id, receipt_number, plan_name, amount)
             VALUES (?, ?, ?, ?)`,
            [user_id, receipt_number, plan_name, amount]
        );

        const [membershipResult] = await connection.query(
            `INSERT INTO memberships (user_id, plan_name, duration_days, start_date, end_date, status)
             VALUES (?, ?, ?, NOW(), ${endDateExpression}, 'Active')`,
            [user_id, plan_name, durationDays]
        );

        await connection.query(
            `UPDATE payments SET membership_id = ? WHERE id = ?`,
            [membershipResult.insertId, paymentResult.insertId]
        );

        await connection.commit();

        const [receipt] = await pool.query(
            `SELECT p.*, m.plan_name, m.end_date, m.status as membership_status
             FROM payments p
             LEFT JOIN memberships m ON p.membership_id = m.id
             WHERE p.id = ?`,
            [paymentResult.insertId]
        );

        res.json({
            success: true,
            message: 'Payment successful',
            receipt: receipt[0]
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Payment creation error:', err);
        res.status(500).json({
            success: false,
            message: 'Payment creation failed'
        });

    } finally {
        if (connection) connection.release();
    }
});