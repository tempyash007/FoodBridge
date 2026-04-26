// ---------------------------------------------------------------------------
// Unit Tests — notification.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');

jest.mock('src/config/db', () => ({ query: jest.fn() }));

const {
  getNotifications, markAsRead, markAllAsRead,
  deleteNotification, getUnreadCount,
} = require('src/controllers/notification.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

// ═══════════════════════════════════════════════════════════════════════════
// getNotifications
// ═══════════════════════════════════════════════════════════════════════════
describe('getNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns notifications with unread count and pagination', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ unread_count: 3 }] })   // unread count
      .mockResolvedValueOnce({ rows: [{ total: 5 }] })          // total count
      .mockResolvedValueOnce({                                    // notifications
        rows: [
          { notification_id: 'n1', type: 'NEW_LISTING', title: 'New food', message: 'Check it', is_read: false, created_at: '2026-04-26' },
        ],
      });

    const req = mockReq({ user: { userId: 'u1' }, query: {} });
    const res = mockRes();
    await callController(getNotifications, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.unread_count).toBe(3);
    expect(data.notifications).toHaveLength(1);
    expect(data.pagination).toEqual(
      expect.objectContaining({ total: 5, page: 1, limit: 20 }),
    );
  });

  test('applies is_read=false filter', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ unread_count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'u1' }, query: { is_read: 'false' } });
    const res = mockRes();
    await callController(getNotifications, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Verify the count query includes the is_read filter
    const countQuery = pool.query.mock.calls[1][0];
    expect(countQuery).toContain('is_read');
  });

  test('applies pagination params', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ unread_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ total: 50 }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'u1' }, query: { page: '3', limit: '5' } });
    const res = mockRes();
    await callController(getNotifications, req, res);

    const pagination = res.json.mock.calls[0][0].data.pagination;
    expect(pagination.page).toBe(3);
    expect(pagination.limit).toBe(5);
    expect(pagination.totalPages).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markAsRead
// ═══════════════════════════════════════════════════════════════════════════
describe('markAsRead', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks notification as read and returns updated notification', async () => {
    const mockNotif = { notification_id: 'n1', is_read: true, type: 'NEW_LISTING' };
    pool.query.mockResolvedValueOnce({ rows: [mockNotif] });

    const req = mockReq({
      user: { userId: 'u1' },
      params: { notification_id: 'n1' },
    });
    const res = mockRes();
    await callController(markAsRead, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.notification).toEqual(mockNotif);
  });

  test('returns 404 when notification not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      user: { userId: 'u1' },
      params: { notification_id: 'bad-id' },
    });
    const res = mockRes();
    await callController(markAsRead, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markAllAsRead
// ═══════════════════════════════════════════════════════════════════════════
describe('markAllAsRead', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks all unread notifications as read and returns count', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 7 });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(markAllAsRead, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.marked_count).toBe(7);
  });

  test('returns marked_count 0 when all are already read', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(markAllAsRead, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.marked_count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deleteNotification
// ═══════════════════════════════════════════════════════════════════════════
describe('deleteNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes notification and returns 200', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ notification_id: 'n1' }] });

    const req = mockReq({
      user: { userId: 'u1' },
      params: { notification_id: 'n1' },
    });
    const res = mockRes();
    await callController(deleteNotification, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].message).toBe('Notification deleted successfully');
  });

  test('returns 404 when notification not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      user: { userId: 'u1' },
      params: { notification_id: 'bad-id' },
    });
    const res = mockRes();
    await callController(deleteNotification, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getUnreadCount
// ═══════════════════════════════════════════════════════════════════════════
describe('getUnreadCount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns unread count for the user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ unread_count: 12 }] });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(getUnreadCount, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.unread_count).toBe(12);
  });

  test('returns 0 when no unread notifications', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ unread_count: 0 }] });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(getUnreadCount, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.unread_count).toBe(0);
  });
});
