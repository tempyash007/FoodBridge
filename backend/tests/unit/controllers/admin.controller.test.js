// ---------------------------------------------------------------------------
// Unit Tests — admin.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');
const invalidateCache = require('src/utils/invalidateCache');

jest.mock('src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('src/utils/invalidateCache', () => jest.fn().mockResolvedValue(undefined));

const {
  getOverview, getAnalytics, exportAnalytics,
  getVerifications, updateVerification,
  getModeration, updateModeration,
  getUsers, updateUser,
  getCategories, createCategory, updateCategory,
  sendBroadcast, getBroadcasts,
} = require('src/controllers/admin.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

const adminUser = { userId: 'admin-1', role: 'admin' };

// ═══════════════════════════════════════════════════════════════════════════
// getOverview
// ═══════════════════════════════════════════════════════════════════════════
describe('getOverview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns system overview with all stat sections', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total_users: 100, users_this_week: 5, active_listings: 20, listings_today: 3, deliveries_today: 10, deliveries_yesterday: 8, meals_rescued: 500 }] })
      .mockResolvedValueOnce({ rows: [{ meals: 45 }] })
      .mockResolvedValueOnce({ rows: [{ day: 'Mon', donors: 2, recipients: 1, deliveries: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pending_verifications: 2, flagged_content: 1 }] });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getOverview, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          stats: expect.any(Object),
          weekly_activity: expect.any(Array),
          live_activity: expect.any(Array),
          quick_stats: expect.any(Object),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAnalytics
// ═══════════════════════════════════════════════════════════════════════════
describe('getAnalytics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns analytics with impact, performance, and heatmap', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ meals_rescued: 1000, co2_saved_kg: '500', waste_diverted_kg: '300', active_users: 50 }] })
      .mockResolvedValueOnce({ rows: [{ current_avg: '25', previous_avg: '30' }] })
      .mockResolvedValueOnce({ rows: [{ total: 100, delivered: 80 }] })
      .mockResolvedValueOnce({ rows: [{ active_now: 90, total_users: 100 }] })
      .mockResolvedValueOnce({ rows: [{ total_diverted: '300' }] })
      .mockResolvedValueOnce({ rows: [{ city: 'Mumbai', lat: '19.07', lng: '72.87', activity_count: 25 }] });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getAnalytics, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_impact: expect.any(Object),
          performance: expect.any(Object),
          heatmap: expect.any(Array),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// exportAnalytics
// ═══════════════════════════════════════════════════════════════════════════
describe('exportAnalytics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns CSV with correct headers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', name: 'John Doe', email: 'j@d.com', role: 'donor', meals_saved: 50, co2_prevented_kg: 20, waste_diverted_kg: 15, total_deliveries: 5 }],
    });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(exportAnalytics, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    const csv = res.send.mock.calls[0][0];
    expect(csv).toContain('User ID');
    expect(csv).toContain('John Doe');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getVerifications
// ═══════════════════════════════════════════════════════════════════════════
describe('getVerifications', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns pending verifications', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ org_id: 'o1', org_name: 'NGO', email: 'n@g.com' }],
    });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getVerifications, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pending_count: 1, verifications: expect.any(Array) }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateVerification
// ═══════════════════════════════════════════════════════════════════════════
describe('updateVerification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('approves organization successfully', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ org_id: 'o1', user_id: 'u1', verification_status: 'pending' }],
    });
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ params: { org_id: 'o1' }, body: { action: 'approve' }, user: adminUser });
    const res = mockRes();
    await callController(updateVerification, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verification_status: 'approved' }) }),
    );
  });

  test('rejects organization successfully', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ org_id: 'o1', user_id: 'u1', verification_status: 'pending' }],
    });
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ params: { org_id: 'o1' }, body: { action: 'reject' }, user: adminUser });
    const res = mockRes();
    await callController(updateVerification, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verification_status: 'rejected' }) }),
    );
  });

  test('returns 400 when action is invalid', async () => {
    const req = mockReq({ params: { org_id: 'o1' }, body: { action: 'destroy' }, user: adminUser });
    const res = mockRes();
    await callController(updateVerification, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when org not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { org_id: 'nope' }, body: { action: 'approve' }, user: adminUser });
    const res = mockRes();
    await callController(updateVerification, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getModeration
// ═══════════════════════════════════════════════════════════════════════════
describe('getModeration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns flagged listings', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ listing_id: 'l1', title: 'Bad', donor_name: 'John' }],
    });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getModeration, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ flagged_count: 1, flagged_listings: expect.any(Array) }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateModeration
// ═══════════════════════════════════════════════════════════════════════════
describe('updateModeration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('dismisses listing (unflag)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'cancelled' }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { listing_id: 'l1' }, body: { action: 'dismiss' }, user: adminUser });
    const res = mockRes();
    await callController(updateModeration, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('removes listing', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'available' }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { listing_id: 'l1' }, body: { action: 'remove' }, user: adminUser });
    const res = mockRes();
    await callController(updateModeration, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 400 when action is invalid', async () => {
    const req = mockReq({ params: { listing_id: 'l1' }, body: { action: 'nuke' }, user: adminUser });
    const res = mockRes();
    await callController(updateModeration, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when listing not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { listing_id: 'nope' }, body: { action: 'dismiss' }, user: adminUser });
    const res = mockRes();
    await callController(updateModeration, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getUsers
// ═══════════════════════════════════════════════════════════════════════════
describe('getUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns users with pagination', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ donors: 10, donors_verified: 5, recipients: 8, recipients_verified: 3, volunteers: 4, volunteers_verified: 2 }] })
      .mockResolvedValueOnce({ rows: [{ total: 22 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', name: 'John', email: 'j@d.com', role: 'donor' }] });

    const req = mockReq({ user: adminUser, query: { page: '1', limit: '10' } });
    const res = mockRes();
    await callController(getUsers, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.counts).toHaveProperty('donors', 10);
    expect(data.recent_users).toHaveLength(1);
    expect(data.pagination.total).toBe(22);
    expect(data.pagination.page).toBe(1);
  });

  test('applies search filter', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] });

    const req = mockReq({ user: adminUser, query: { search: 'john' } });
    const res = mockRes();
    await callController(getUsers, req, res);

    const countQuery = pool.query.mock.calls[1][0];
    expect(countQuery).toContain('ILIKE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateUser
// ═══════════════════════════════════════════════════════════════════════════
describe('updateUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('suspends user successfully', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', is_active: true }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { user_id: 'u1' }, body: { is_active: false }, user: adminUser });
    const res = mockRes();
    await callController(updateUser, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User suspended successfully' }),
    );
  });

  test('reactivates user successfully', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', is_active: false }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { user_id: 'u1' }, body: { is_active: true }, user: adminUser });
    const res = mockRes();
    await callController(updateUser, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User reactivated successfully' }),
    );
  });

  test('returns 400 when is_active is not boolean', async () => {
    const req = mockReq({ params: { user_id: 'u1' }, body: { is_active: 'yes' }, user: adminUser });
    const res = mockRes();
    await callController(updateUser, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when user not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { user_id: 'nope' }, body: { is_active: false }, user: adminUser });
    const res = mockRes();
    await callController(updateUser, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// admin categories
// ═══════════════════════════════════════════════════════════════════════════
describe('admin getCategories', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns categories with listing count', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_id: 'c1', name: 'Grains', listing_count: 5 }],
    });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getCategories, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates category and returns 201', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ category_id: 'c1', name: 'Dairy' }] });

    const req = mockReq({ body: { name: 'Dairy' }, user: adminUser });
    const res = mockRes();
    await callController(createCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(invalidateCache).toHaveBeenCalled();
  });

  test('returns 400 when name is empty', async () => {
    const req = mockReq({ body: { name: '' }, user: adminUser });
    const res = mockRes();
    await callController(createCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when duplicate name exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ category_id: 'existing' }] });

    const req = mockReq({ body: { name: 'Grains' }, user: adminUser });
    const res = mockRes();
    await callController(createCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates category and returns 200', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ category_id: 'c1' }] })
      .mockResolvedValueOnce({ rows: [{ category_id: 'c1', name: 'New' }] });

    const req = mockReq({ params: { category_id: 'c1' }, body: { name: 'New' }, user: adminUser });
    const res = mockRes();
    await callController(updateCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 404 when category not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { category_id: 'nope' }, body: { name: 'X' }, user: adminUser });
    const res = mockRes();
    await callController(updateCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when no fields to update', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ category_id: 'c1' }] });

    const req = mockReq({ params: { category_id: 'c1' }, body: {}, user: adminUser });
    const res = mockRes();
    await callController(updateCategory, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// broadcast
// ═══════════════════════════════════════════════════════════════════════════
describe('sendBroadcast', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends broadcast and returns 201', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ broadcast_id: 'b1', title: 'Alert', target_role: null, created_at: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }, { user_id: 'u2' }] })
        .mockResolvedValueOnce(undefined) // INSERT notifications
        .mockResolvedValueOnce(undefined) // audit log
        .mockResolvedValueOnce(undefined), // COMMIT
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ body: { title: 'Alert', message: 'Emergency!' }, user: adminUser });
    const res = mockRes();
    await callController(sendBroadcast, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          broadcast: expect.objectContaining({ recipients_count: 2 }),
        }),
      }),
    );
  });

  test('returns 400 when title or message is missing', async () => {
    const req = mockReq({ body: { title: '' }, user: adminUser });
    const res = mockRes();
    await callController(sendBroadcast, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when target_role is invalid', async () => {
    const req = mockReq({ body: { title: 'X', message: 'Y', target_role: 'hacker' }, user: adminUser });
    const res = mockRes();
    await callController(sendBroadcast, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getBroadcasts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns broadcast history', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ broadcast_id: 'b1', title: 'Alert', admin_name: 'Admin A' }],
    });

    const req = mockReq({ user: adminUser });
    const res = mockRes();
    await callController(getBroadcasts, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ broadcasts: expect.any(Array) }) }),
    );
  });
});
