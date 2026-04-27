const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ============================================================================
// GET /api/notifications — Get My Notifications
// ============================================================================
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { is_read, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // 1. Unread count (always returned regardless of filters)
  const unreadResult = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  const unread_count = unreadResult.rows[0].unread_count;

  // 2. Build filtered query
  const conditions = [`user_id = $1`];
  const params = [userId];

  if (is_read !== undefined) {
    const readVal = is_read === 'true' || is_read === true;
    conditions.push(`is_read = $${params.push(readVal)}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // 3. Total count (for pagination)
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notifications ${whereClause}`,
    params,
  );
  const total = countResult.rows[0].total;

  // 4. Fetch paginated notifications
  const notifResult = await pool.query(
    `SELECT notification_id, type, title, message, is_read, created_at
     FROM notifications
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.push(limitNum)} OFFSET $${params.push(offset)}`,
    params,
  );

  return res.status(200).json({
    success: true,
    data: {
      unread_count,
      notifications: notifResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    message: 'Notifications fetched successfully',
  });
});

// ============================================================================
// GET /api/notifications/broadcasts — Get Broadcasts for user's role
// ============================================================================
const getBroadcasts = asyncHandler(async (req, res) => {
  const role = req.user.role;

  const result = await pool.query(
    `SELECT
       bn.broadcast_id,
       bn.title,
       bn.message,
       bn.target_role,
       bn.created_at,
       u.first_name || ' ' || u.last_name AS admin_name
     FROM broadcast_notifications bn
     JOIN users u ON bn.admin_id = u.user_id
     WHERE bn.target_role IS NULL OR bn.target_role = $1
     ORDER BY bn.created_at DESC`,
    [role],
  );

  return res.status(200).json({
    success: true,
    data: { broadcasts: result.rows },
    message: 'Broadcasts fetched successfully',
  });
});

// ============================================================================
// PATCH /api/notifications/:notification_id/read — Mark Single as Read
// ============================================================================
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { notification_id } = req.params;

  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true
     WHERE notification_id = $1 AND user_id = $2
     RETURNING *`,
    [notification_id, userId],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Notification not found',
    });
  }

  return res.status(200).json({
    success: true,
    data: { notification: result.rows[0] },
    message: 'Notification marked as read',
  });
});

// ============================================================================
// PATCH /api/notifications/read-all — Mark All as Read
// ============================================================================
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId],
  );

  return res.status(200).json({
    success: true,
    data: { marked_count: result.rowCount },
    message: 'All notifications marked as read',
  });
});

// ============================================================================
// DELETE /api/notifications/:notification_id — Delete a Notification
// ============================================================================
const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { notification_id } = req.params;

  const result = await pool.query(
    `DELETE FROM notifications
     WHERE notification_id = $1 AND user_id = $2
     RETURNING notification_id`,
    [notification_id, userId],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Notification not found',
    });
  }

  return res.status(200).json({
    success: true,
    data: {},
    message: 'Notification deleted successfully',
  });
});

// ============================================================================
// GET /api/notifications/unread-count — Navbar Badge Endpoint
// ============================================================================
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId],
  );

  return res.status(200).json({
    success: true,
    data: { unread_count: result.rows[0].unread_count },
    message: 'Unread count fetched successfully',
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getBroadcasts,
};
