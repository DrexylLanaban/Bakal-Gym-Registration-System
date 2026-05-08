const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./database/db');
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const paymentRoutes = require('./routes/payments');
const membershipRoutes = require('./routes/memberships');
const attendanceRoutes = require('./routes/attendance');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', memberRoutes);
app.use('/api', paymentRoutes);
app.use('/api', membershipRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', dashboardRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Bakal Gym API Server',
        status: 'running',
        version: '1.0.0'
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`Bakal Gym server running on port ${PORT}`);
    });
}

startServer();
