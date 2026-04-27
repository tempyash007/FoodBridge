const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getBroadcasts,
} = require('../controllers/notification.controller');

const router = Router();

// ---------------------------------------------------------------------------
// All routes require authentication (any logged-in user)
// ---------------------------------------------------------------------------
router.use(authenticateToken);

// GET /api/notifications/broadcasts — broadcasts for user's role
router.get('/broadcasts', getBroadcasts);

// GET /api/notifications/unread-count — navbar badge (must be before /:notification_id)
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/read-all — mark all as read (must be before /:notification_id)
router.patch('/read-all', markAllAsRead);

// GET /api/notifications — list my notifications
router.get('/', getNotifications);

// PATCH /api/notifications/:notification_id/read — mark single as read
router.patch('/:notification_id/read', markAsRead);

// DELETE /api/notifications/:notification_id — delete a notification
router.delete('/:notification_id', deleteNotification);

module.exports = router;
