require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const listingRoutes = require('./routes/listing.routes');
const donorRoutes = require('./routes/donor.routes');
const recipientRoutes = require('./routes/recipient.routes');
const volunteerRoutes = require('./routes/volunteer.routes');
const categoryRoutes = require('./routes/category.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/recipient', recipientRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'FoodBridge API is running 🚀' });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'FoodBridge API is running 🚀' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    data: {},
    message: err.message || 'Internal server error',
  });
});

// ---------------------------------------------------------------------------
// Export for Vercel (serverless)
// ---------------------------------------------------------------------------
module.exports = app;

// ---------------------------------------------------------------------------
// Start server only when running locally (not on Vercel)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ FoodBridge server listening on http://localhost:${PORT}`);
  });
}

// ---------------------------------------------------------------------------
// Global safety net
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message, err.stack);
});