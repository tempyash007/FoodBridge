/**
 * notification.service.js — API calls for the FoodBridge notification system.
 *
 * Endpoints consumed:
 *   GET    /api/notifications              — list notifications (supports ?is_read=&page=&limit=)
 *   GET    /api/notifications/unread-count  — unread badge count
 *   PATCH  /api/notifications/read-all      — mark every notification as read
 *   PATCH  /api/notifications/:id/read      — mark a single notification as read
 *   DELETE /api/notifications/:id           — delete a single notification
 */

import { fetchWithAuth } from './api';

/**
 * Fetch paginated list of notifications for the logged-in user.
 *
 * @param {Object}  opts
 * @param {boolean} [opts.is_read]  - Filter by read status (true / false / omit for all)
 * @param {number}  [opts.page=1]
 * @param {number}  [opts.limit=20]
 * @returns {Promise<{unread_count: number, notifications: Array, pagination: Object}>}
 */
export async function getNotifications({ is_read, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (is_read !== undefined) params.set('is_read', is_read);
    params.set('page', page);
    params.set('limit', limit);

    const res = await fetchWithAuth(`/notifications?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch notifications');
    return data.data;
}

/**
 * Fetch the unread notification count (for the Navbar badge).
 *
 * @returns {Promise<number>}
 */
export async function getUnreadCount() {
    const res = await fetchWithAuth('/notifications/unread-count');
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch unread count');
    return data.data.unread_count;
}

/**
 * Mark a single notification as read.
 *
 * @param {string} notificationId  - UUID of the notification
 * @returns {Promise<Object>}      - The updated notification
 */
export async function markAsRead(notificationId) {
    const res = await fetchWithAuth(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to mark notification as read');
    return data.data;
}

/**
 * Mark all notifications as read.
 *
 * @returns {Promise<{marked_count: number}>}
 */
export async function markAllAsRead() {
    const res = await fetchWithAuth('/notifications/read-all', {
        method: 'PATCH',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to mark all as read');
    return data.data;
}

/**
 * Delete a single notification.
 *
 * @param {string} notificationId  - UUID of the notification
 * @returns {Promise<void>}
 */
export async function deleteNotification(notificationId) {
    const res = await fetchWithAuth(`/notifications/${notificationId}`, {
        method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete notification');
    return data.data;
}
