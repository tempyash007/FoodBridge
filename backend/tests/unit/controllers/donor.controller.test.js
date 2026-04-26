// ---------------------------------------------------------------------------
// Unit Tests — donor.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');

jest.mock('src/config/db', () => ({ query: jest.fn() }));

const { getDashboard, getHistory, exportHistory, getImpact } = require('src/controllers/donor.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

// ═══════════════════════════════════════════════════════════════════════════
// getDashboard
// ═══════════════════════════════════════════════════════════════════════════
describe('getDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stats, active listings, and pickup requests', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ meals_saved: 100, co2_prevented_kg: 50, waste_diverted_kg: 30 }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', title: 'V' }] })
      .mockResolvedValueOnce({ rows: [] })   // dietary tags for listing l1
      .mockResolvedValueOnce({ rows: [] });  // pickup requests

    const req = mockReq({ user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(getDashboard, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          stats: expect.any(Object),
          active_listings: expect.any(Array),
          pickup_requests: expect.any(Array),
        }),
      }),
    );
  });

  test('returns default zeros when no metrics exist', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })            // no metrics
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })             // no listings (empty → skip tags)
      .mockResolvedValueOnce({ rows: [] });            // pickup requests

    const req = mockReq({ user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(getDashboard, req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.stats.meals_saved).toBe(0);
    expect(data.stats.co2_prevented_kg).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getHistory
// ═══════════════════════════════════════════════════════════════════════════
describe('getHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns paginated donation history', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_title: 'Rice', date: '2024-01-01', quantity: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const req = mockReq({ user: { userId: 'donor-1' }, query: { page: '1', limit: '5' } });
    const res = mockRes();
    await callController(getHistory, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          history: expect.any(Array),
          pagination: expect.objectContaining({ page: 1, limit: 5 }),
        }),
      }),
    );
  });

  test('returns empty history array', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const req = mockReq({ user: { userId: 'donor-1' } });
    const res = mockRes();
    await callController(getHistory, req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.history).toEqual([]);
    expect(data.pagination.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// exportHistory
// ═══════════════════════════════════════════════════════════════════════════
describe('exportHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns CSV with correct Content-Type headers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ listing_title: 'Rice', date: '2024-01-01', quantity: 10, quantity_unit: 'kg', recipient_org: 'NGO', rating: 5 }],
    });

    const req = mockReq({ user: { userId: 'donor-1' } });
    const res = mockRes();
    await callController(exportHistory, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=donation_history.csv');
    expect(res.status).toHaveBeenCalledWith(200);
    const csvContent = res.send.mock.calls[0][0];
    expect(csvContent).toContain('Listing Title');
    expect(csvContent).toContain('Rice');
  });

  test('returns empty CSV with only header when no data', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'donor-1' } });
    const res = mockRes();
    await callController(exportHistory, req, res);

    const csvContent = res.send.mock.calls[0][0];
    expect(csvContent).toContain('Listing Title');
    expect(csvContent.split('\n').length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getImpact
// ═══════════════════════════════════════════════════════════════════════════
describe('getImpact', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns totals and weekly trend', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ meals_saved: 200, co2_prevented_kg: 80, waste_diverted_kg: 40 }] })
      .mockResolvedValueOnce({ rows: [{ day: 'Mon', meals_saved: '10', waste_diverted_kg: '5' }] });

    const req = mockReq({ user: { userId: 'donor-1' } });
    const res = mockRes();
    await callController(getImpact, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totals: expect.objectContaining({ meals_saved: 200 }),
          weekly_trend: expect.any(Array),
        }),
      }),
    );
  });

  test('returns zeros when no metrics exist', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'donor-1' } });
    const res = mockRes();
    await callController(getImpact, req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.totals.meals_saved).toBe(0);
    expect(data.weekly_trend).toEqual([]);
  });
});
