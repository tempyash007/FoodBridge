// ---------------------------------------------------------------------------
// Unit Tests — recipient.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');

jest.mock('src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const {
  browseListings, createClaim, getMyClaims, cancelClaim, submitReview,
} = require('src/controllers/recipient.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

// ═══════════════════════════════════════════════════════════════════════════
// browseListings
// ═══════════════════════════════════════════════════════════════════════════
describe('browseListings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns listings with default pagination (no location)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          listing_id: 'l1', title: 'Rice', quantity: 10, quantity_unit: 'kg',
          estimated_servings: 20, expiry_time: new Date(Date.now() + 3600000),
          status: 'available', distance_km: null, category: 'Grains',
          dietary_tags: [], primary_image_url: null, donor_org: 'NGO',
          pickup_window_start: null, pickup_window_end: null,
          minutes_until_expiry: 60, donor_avg_rating: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const req = mockReq({ user: { userId: 'recip-1', role: 'recipient' }, query: {} });
    const res = mockRes();
    await callController(browseListings, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ total: 1, listings: expect.any(Array) }),
      }),
    );
  });

  test('applies category filter when category_id is provided', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, query: { category_id: 'cat-1' } });
    const res = mockRes();
    await callController(browseListings, req, res);

    const queryStr = pool.query.mock.calls[0][0];
    expect(queryStr).toContain('fl.category_id');
  });

  test('applies search filter', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, query: { search: 'bread' } });
    const res = mockRes();
    await callController(browseListings, req, res);

    const queryStr = pool.query.mock.calls[0][0];
    expect(queryStr).toContain('ILIKE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createClaim
// ═══════════════════════════════════════════════════════════════════════════
describe('createClaim', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates claim with transaction and returns 201', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'available' }] })
      .mockResolvedValueOnce({ rows: [] }); // no existing claim

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                                     // BEGIN
        .mockResolvedValueOnce({ rows: [{ address_id: 'a1' }] })            // INSERT address
        .mockResolvedValueOnce({ rows: [{ claim_id: 'c1', status: 'approved' }] }) // INSERT claim
        .mockResolvedValueOnce(undefined)                                     // UPDATE listing
        .mockResolvedValueOnce(undefined),                                    // COMMIT
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({
      user: { userId: 'recip-1', role: 'recipient' },
      body: {
        listing_id: 'l1', pickup_time: '2024-01-01T12:00:00Z',
        street_address: '123 St', city: 'Mumbai', state: 'MH', postal_code: '400001',
      },
    });
    const res = mockRes();
    await callController(createClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('returns 400 when listing_id is missing', async () => {
    const req = mockReq({
      user: { userId: 'r1', role: 'recipient' },
      body: { pickup_time: '2024-01-01T12:00:00Z', street_address: 's', city: 'c', state: 's', postal_code: 'p' },
    });
    const res = mockRes();
    await callController(createClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when listing is not available', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'reserved' }] });

    const req = mockReq({
      user: { userId: 'r1', role: 'recipient' },
      body: { listing_id: 'l1', pickup_time: 't', street_address: 's', city: 'c', state: 's', postal_code: 'p' },
    });
    const res = mockRes();
    await callController(createClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 when listing is already claimed', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'available' }] })
      .mockResolvedValueOnce({ rows: [{ claim_id: 'existing-claim' }] });

    const req = mockReq({
      user: { userId: 'r1', role: 'recipient' },
      body: { listing_id: 'l1', pickup_time: 't', street_address: 's', city: 'c', state: 's', postal_code: 'p' },
    });
    const res = mockRes();
    await callController(createClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getMyClaims
// ═══════════════════════════════════════════════════════════════════════════
describe('getMyClaims', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns claims for the authenticated recipient', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ claim_id: 'c1', listing_title: 'Rice', claim_status: 'approved' }],
    });

    const req = mockReq({ user: { userId: 'recip-1', role: 'recipient' } });
    const res = mockRes();
    await callController(getMyClaims, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ claims: expect.any(Array) }) }),
    );
  });

  test('returns empty claims array', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' } });
    const res = mockRes();
    await callController(getMyClaims, req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.claims).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// cancelClaim
// ═══════════════════════════════════════════════════════════════════════════
describe('cancelClaim', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cancels claim and restores listing to available', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ claim_id: 'c1', listing_id: 'l1', status: 'approved' }],
    });

    const mockClient = {
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ params: { claim_id: 'c1' }, user: { userId: 'r1', role: 'recipient' } });
    const res = mockRes();
    await callController(cancelClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 404 when claim not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { claim_id: 'nope' }, user: { userId: 'r1', role: 'recipient' } });
    const res = mockRes();
    await callController(cancelClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when claim is not in cancellable status', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ claim_id: 'c1', listing_id: 'l1', status: 'completed' }],
    });

    const req = mockReq({ params: { claim_id: 'c1' }, user: { userId: 'r1', role: 'recipient' } });
    const res = mockRes();
    await callController(cancelClaim, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// submitReview
// ═══════════════════════════════════════════════════════════════════════════
describe('submitReview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates review and returns 201', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ mission_id: 'm1', volunteer_id: 'v1', volunteer_user_id: 'vu1' }] })
      .mockResolvedValueOnce({ rows: [] })                                     // dup check
      .mockResolvedValueOnce({ rows: [{ review_id: 'r1', rating: 5 }] })     // INSERT review
      .mockResolvedValueOnce({ rows: [] });                                    // UPDATE avg_rating

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, body: { mission_id: 'm1', rating: 5, comment: 'Great!' } });
    const res = mockRes();
    await callController(submitReview, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 400 when mission_id is missing', async () => {
    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, body: { rating: 5 } });
    const res = mockRes();
    await callController(submitReview, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when rating is out of range', async () => {
    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, body: { mission_id: 'm1', rating: 6 } });
    const res = mockRes();
    await callController(submitReview, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when mission not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, body: { mission_id: 'nope', rating: 4 } });
    const res = mockRes();
    await callController(submitReview, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 when duplicate review exists', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ mission_id: 'm1', volunteer_user_id: 'vu1' }] })
      .mockResolvedValueOnce({ rows: [{ review_id: 'existing' }] });

    const req = mockReq({ user: { userId: 'r1', role: 'recipient' }, body: { mission_id: 'm1', rating: 4 } });
    const res = mockRes();
    await callController(submitReview, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
