// ---------------------------------------------------------------------------
// Unit Tests — notification.service.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');

jest.mock('src/config/db', () => ({ query: jest.fn() }));

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const {
  createNotification,
  createBulkNotifications,
  sendNotificationEmail,
  notifyRole,
} = require('src/services/notification.service');

// ═══════════════════════════════════════════════════════════════════════════
// createNotification
// ═══════════════════════════════════════════════════════════════════════════
describe('createNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts notification and returns created row', async () => {
    const mockNotif = {
      notification_id: 'n1', user_id: 'u1', type: 'CLAIM_RECEIVED',
      title: 'Test', message: 'Hello', is_read: false,
    };
    pool.query.mockResolvedValueOnce({ rows: [mockNotif] });

    const result = await createNotification({
      userId: 'u1', type: 'CLAIM_RECEIVED', title: 'Test', message: 'Hello',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual(['u1', 'CLAIM_RECEIVED', 'Test', 'Hello']);
    expect(result).toEqual(mockNotif);
  });

  test('returns null and does not crash on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB down'));

    const result = await createNotification({
      userId: 'u1', type: 'X', title: 'T', message: 'M',
    });

    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createBulkNotifications
// ═══════════════════════════════════════════════════════════════════════════
describe('createBulkNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts multiple notifications via unnest and returns count', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 3, rows: [{}, {}, {}] });

    const count = await createBulkNotifications(
      ['u1', 'u2', 'u3'],
      { type: 'NEW_LISTING', title: 'New food', message: 'Check it out' },
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    const queryStr = pool.query.mock.calls[0][0];
    expect(queryStr).toContain('unnest');
    expect(count).toBe(3);
  });

  test('returns 0 for empty userIds array', async () => {
    const count = await createBulkNotifications([], { type: 'X', title: 'T', message: 'M' });

    expect(count).toBe(0);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('returns 0 and does not crash on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const count = await createBulkNotifications(
      ['u1'], { type: 'X', title: 'T', message: 'M' },
    );

    expect(count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sendNotificationEmail
// ═══════════════════════════════════════════════════════════════════════════
describe('sendNotificationEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetches user and sends email', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ email: 'user@test.com', first_name: 'John' }],
    });
    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-1' });

    await sendNotificationEmail('u1', {
      subject: 'Test Subject', title: 'Test Title', message: 'Test body',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.to).toBe('user@test.com');
    expect(mailOpts.subject).toBe('Test Subject');
  });

  test('does not crash when user not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      sendNotificationEmail('bad-id', { subject: 'S', title: 'T', message: 'M' }),
    ).resolves.not.toThrow();

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('does not crash when email sending fails', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ email: 'user@test.com', first_name: 'John' }],
    });
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    await expect(
      sendNotificationEmail('u1', { subject: 'S', title: 'T', message: 'M' }),
    ).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// notifyRole
// ═══════════════════════════════════════════════════════════════════════════
describe('notifyRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetches users by role and creates bulk notifications', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }, { user_id: 'u2' }] }) // fetch users
      .mockResolvedValueOnce({ rowCount: 2, rows: [{}, {}] });                   // bulk insert

    const count = await notifyRole('recipient', {
      type: 'NEW_LISTING', title: 'New listing', message: 'Check it out',
    });

    expect(count).toBe(2);
    expect(pool.query).toHaveBeenCalledTimes(2);
    // Verify role filter query
    expect(pool.query.mock.calls[0][1]).toEqual(['recipient']);
  });

  test('returns 0 when no users have the role', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const count = await notifyRole('admin', {
      type: 'BROADCAST', title: 'T', message: 'M',
    });

    expect(count).toBe(0);
  });

  test('sends emails when sendEmail flag is true', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] })   // fetch users
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })      // bulk insert
      .mockResolvedValueOnce({ rows: [{ email: 'a@b.com', first_name: 'A' }] }); // email lookup
    mockSendMail.mockResolvedValueOnce({});

    const count = await notifyRole('donor', {
      type: 'BROADCAST', title: 'Alert', message: 'Important',
    }, true);

    expect(count).toBe(1);
    // Give the fire-and-forget email a tick to resolve
    await new Promise((r) => setTimeout(r, 50));
  });

  test('does not crash on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const count = await notifyRole('donor', { type: 'X', title: 'T', message: 'M' });

    expect(count).toBe(0);
  });
});
