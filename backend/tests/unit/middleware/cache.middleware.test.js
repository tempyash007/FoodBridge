// ---------------------------------------------------------------------------
// Unit Tests — cache.middleware.js
// ---------------------------------------------------------------------------
const redis = require('src/config/redis');

jest.mock('src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const createCacheMiddleware = require('src/middleware/cache.middleware');

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockReq = (overrides = {}) => ({
  method: 'GET',
  originalUrl: '/api/test',
  user: null,
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('createCacheMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns cached response on HIT with X-Cache: HIT header', async () => {
    const cachedData = { success: true, data: { foo: 'bar' }, message: 'ok' };
    redis.get.mockResolvedValue(JSON.stringify(cachedData));

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
    expect(res.json).toHaveBeenCalledWith(cachedData);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('calls next() on cache MISS', async () => {
    redis.get.mockResolvedValue(null);

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('stores response in Redis on MISS with correct TTL', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    // Simulate controller calling res.json()
    const responseBody = { success: true, data: { items: [] }, message: 'ok' };
    res.json(responseBody);

    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(responseBody),
      'EX',
      120,
    );
    expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
  });

  test('does not cache error responses (success: false)', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    const errorBody = { success: false, data: {}, message: 'error' };
    res.json(errorBody);

    expect(redis.set).not.toHaveBeenCalled();
  });

  test('gracefully handles Redis GET failure and calls next()', async () => {
    redis.get.mockRejectedValue(new Error('Redis connection lost'));

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    // Should not crash, should fall through to DB
    expect(mockNext).toHaveBeenCalled();
  });

  test('gracefully handles Redis SET failure', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockReturnValue(Promise.reject(new Error('Redis SET failed')));

    const middleware = createCacheMiddleware(120);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    const responseBody = { success: true, data: {}, message: 'ok' };
    // Should not throw
    expect(() => res.json(responseBody)).not.toThrow();
  });

  test('builds cache key that includes userId when authenticated', async () => {
    redis.get.mockResolvedValue(null);

    const middleware = createCacheMiddleware(120);
    const req = mockReq({ user: { userId: 'user-123' } });
    const res = mockRes();

    await middleware(req, res, mockNext);

    // Verify the cache key includes the userId
    expect(redis.get).toHaveBeenCalledWith('GET /api/test|user-123');
  });
});
