const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { requireAuth } = require('./middleware/auth');

const inventoryRoutes = require('./routes/inventoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const purchaseBillRoutes = require('./routes/purchaseBillRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const plannerRoutes = require('./routes/plannerRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'crystal-agro-local-session-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/vendors', requireAuth, vendorRoutes);
app.use('/api/purchase-bills', requireAuth, purchaseBillRoutes);
app.use('/api/planner', requireAuth, plannerRoutes);

// Fallback route for SPA dashboard
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
