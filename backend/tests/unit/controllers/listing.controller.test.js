// ---------------------------------------------------------------------------
// Unit Tests — listing.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');
const invalidateCache = require('src/utils/invalidateCache');

jest.mock('src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('src/utils/invalidateCache', () => jest.fn().mockResolvedValue(undefined));

const {
  createListing, getListings, getMyListings,
  getListingById, updateListing, deleteListing,
} = require('src/controllers/listing.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

const futureDate = new Date(Date.now() + 86400000).toISOString();
const pickupStart = new Date(Date.now() + 3600000).toISOString();
const pickupEnd = new Date(Date.now() + 7200000).toISOString();

const validListingBody = {
  title: 'Fresh Veggies', description: 'Mixed veg', quantity: 5,
  quantity_unit: 'kg', expiry_time: futureDate,
  pickup_start: pickupStart, pickup_end: pickupEnd,
  street_address: '123 St', city: 'Mumbai', state: 'MH',
  postal_code: '400001', country: 'India',
};

// ═══════════════════════════════════════════════════════════════════════════
// createListing
// ═══════════════════════════════════════════════════════════════════════════
describe('createListing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();  // clear unconsumed mockResolvedValueOnce queue
  });

  test('creates listing with transaction and returns 201', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                                          // BEGIN
        .mockResolvedValueOnce({ rows: [{ address_id: 'a1' }] })                 // INSERT address
        .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'available' }] }) // INSERT listing
        .mockResolvedValueOnce(undefined),                                        // COMMIT
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ body: validListingBody, user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Listing created successfully' }),
    );
    expect(mockClient.release).toHaveBeenCalled();
    expect(invalidateCache).toHaveBeenCalled();
  });

  test('returns 400 when title is missing', async () => {
    const req = mockReq({ body: { ...validListingBody, title: '' }, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when quantity is zero', async () => {
    const req = mockReq({ body: { ...validListingBody, quantity: 0 }, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when expiry_time is in the past', async () => {
    const req = mockReq({
      body: { ...validListingBody, expiry_time: '2020-01-01T00:00:00Z' },
      user: { userId: 'd1', role: 'donor' },
    });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when pickup_end before pickup_start', async () => {
    const req = mockReq({
      body: { ...validListingBody, pickup_start: pickupEnd, pickup_end: pickupStart },
      user: { userId: 'd1', role: 'donor' },
    });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('performs ROLLBACK on transaction error', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined), // ROLLBACK
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ body: validListingBody, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(createListing, req, res);

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getListings
// ═══════════════════════════════════════════════════════════════════════════
describe('getListings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns listings with default pagination', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })                     // autoExpire
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1' }] }) // listings
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });     // count

    const req = mockReq({ user: { userId: 'u1' }, query: {} });
    const res = mockRes();
    await callController(getListings, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          listings: expect.any(Array),
          pagination: expect.objectContaining({ page: 1, limit: 10 }),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getMyListings
// ═══════════════════════════════════════════════════════════════════════════
describe('getMyListings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
  });

  test('returns only donor\'s own listings', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1' }] })  // SELECT listings
      .mockResolvedValueOnce({ rows: [] });                       // autoExpire UPDATE

    const req = mockReq({ user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(getMyListings, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getListingById
// ═══════════════════════════════════════════════════════════════════════════
describe('getListingById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
  });

  test('returns listing with images on success', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', title: 'Test' }] })  // SELECT listing
      .mockResolvedValueOnce({ rows: [] })                                      // autoExpire UPDATE
      .mockResolvedValueOnce({ rows: [{ image_id: 'i1' }] });                  // SELECT images

    const req = mockReq({ params: { id: 'l1' }, user: { userId: 'u1' } });
    const res = mockRes();
    await callController(getListingById, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 404 when listing not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // listing not found => 404 before autoExpire

    const req = mockReq({ params: { id: 'nope' }, user: { userId: 'u1' } });
    const res = mockRes();
    await callController(getListingById, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateListing
// ═══════════════════════════════════════════════════════════════════════════
describe('updateListing', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates listing and returns 200', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', donor_id: 'donor-1' }] })
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', title: 'Updated' }] });

    const req = mockReq({ params: { id: 'l1' }, body: { title: 'Updated' }, user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(updateListing, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 404 when listing not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { id: 'nope' }, body: { title: 'X' }, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(updateListing, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when user is not the owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ listing_id: 'l1', donor_id: 'other-user' }] });

    const req = mockReq({ params: { id: 'l1' }, body: { title: 'H' }, user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(updateListing, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deleteListing
// ═══════════════════════════════════════════════════════════════════════════
describe('deleteListing', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft-deletes listing', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', donor_id: 'donor-1' }] })
      .mockResolvedValueOnce({ rows: [{ listing_id: 'l1', status: 'cancelled' }] });

    const req = mockReq({ params: { id: 'l1' }, user: { userId: 'donor-1', role: 'donor' } });
    const res = mockRes();
    await callController(deleteListing, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 404 when listing not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { id: 'nope' }, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(deleteListing, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when user is not the owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ listing_id: 'l1', donor_id: 'other' }] });

    const req = mockReq({ params: { id: 'l1' }, user: { userId: 'd1', role: 'donor' } });
    const res = mockRes();
    await callController(deleteListing, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
