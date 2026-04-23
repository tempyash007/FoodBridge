const { Router } = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const createCacheMiddleware = require('../middleware/cache.middleware');
const {
  getOverview,
  getAnalytics,
  exportAnalytics,
  getVerifications,
  updateVerification,
  getModeration,
  updateModeration,
  getUsers,
  updateUser,
  getCategories,
  createCategory,
  updateCategory,
  sendBroadcast,
  getBroadcasts,
} = require('../controllers/admin.controller');

const router = Router();

// ---------------------------------------------------------------------------
// All routes require auth + ADMIN role
// ---------------------------------------------------------------------------
router.use(authenticateToken, requireRole('admin'));

// 1. System Overview
router.get('/overview', createCacheMiddleware(60), getOverview);

// 2. Platform Analytics
router.get('/analytics', createCacheMiddleware(300), getAnalytics);
router.get('/analytics/export', exportAnalytics);

// 3. User Verification
router.get('/verification', getVerifications);
router.patch('/verification/:org_id', updateVerification);

// 4. Content Moderation
router.get('/moderation', getModeration);
router.patch('/moderation/:listing_id', updateModeration);

// 5. User Management
router.get('/users', getUsers);
router.patch('/users/:user_id', updateUser);

// 6. Food Categories
router.get('/categories', createCacheMiddleware(600), getCategories);
router.post('/categories', createCategory);
router.patch('/categories/:category_id', updateCategory);

// 7. Emergency Broadcast
router.post('/broadcast', sendBroadcast);
router.get('/broadcast', getBroadcasts);

module.exports = router;
