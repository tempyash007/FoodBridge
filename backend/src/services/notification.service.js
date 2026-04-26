const pool = require('../config/db');
const { sendNotificationEmail: sendEmail } = require('./email.service');

// ============================================================================
// createNotification — insert a single notification
// ============================================================================
const createNotification = async ({ userId, type, title, message }) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, type, title, message],
    );
    return result.rows[0];
  } catch (err) {
    console.error('⚠️  createNotification failed:', err.message);
    return null;
  }
};

// ============================================================================
// createBulkNotifications — insert many notifications in one query (unnest)
// ============================================================================
const createBulkNotifications = async (userIds, { type, title, message }) => {
  if (!userIds || userIds.length === 0) return 0;

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT uid, $2, $3, $4
       FROM unnest($1::uuid[]) AS uid
       RETURNING notification_id`,
      [userIds, type, title, message],
    );
    return result.rowCount;
  } catch (err) {
    console.error('⚠️  createBulkNotifications failed:', err.message);
    return 0;
  }
};

// ============================================================================
// sendNotificationEmail — fetch user info and fire off a branded email
// ============================================================================
const sendNotificationEmail = async (userId, { subject, title, message }) => {
  try {
    const userResult = await pool.query(
      `SELECT email, first_name FROM users WHERE user_id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      console.error('⚠️  sendNotificationEmail: user not found', userId);
      return;
    }

    const { email, first_name } = userResult.rows[0];
    await sendEmail(email, first_name, { subject, title, message });
  } catch (err) {
    console.error('⚠️  sendNotificationEmail failed (non-fatal):', err.message);
    // Never crash — swallow the error
  }
};

// ============================================================================
// notifyRole — notify all users with a specific role
// ============================================================================
const notifyRole = async (role, { type, title, message }, sendEmailFlag = false) => {
  try {
    const usersResult = await pool.query(
      `SELECT user_id FROM users WHERE role = $1 AND is_active = true`,
      [role],
    );

    const userIds = usersResult.rows.map((r) => r.user_id);
    if (userIds.length === 0) return 0;

    const count = await createBulkNotifications(userIds, { type, title, message });

    if (sendEmailFlag) {
      // Fire-and-forget emails — do NOT await each one sequentially
      for (const uid of userIds) {
        sendNotificationEmail(uid, {
          subject: title,
          title,
          message,
        }).catch(() => {}); // swallow
      }
    }

    return count;
  } catch (err) {
    console.error('⚠️  notifyRole failed:', err.message);
    return 0;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  sendNotificationEmail,
  notifyRole,
};
