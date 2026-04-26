// ---------------------------------------------------------------------------
// Unit Tests — invalidateCache.js
// ---------------------------------------------------------------------------
const redis = require('src/config/redis');

jest.mock('src/config/redis', () => ({
  scan: jest.fn(),
  del: jest.fn(),
}));

const invalidateCache = require('src/utils/invalidateCache');

describe('invalidateCache', () => {
  beforeEach(() => jest.clearAllMocks());

  test('scans and deletes matching keys', async () => {
    redis.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
    redis.del.mockResolvedValue(3);

    await invalidateCache('GET /api/listings*');

    expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'GET /api/listings*', 'COUNT', 100);
    expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
  });

  test('does nothing when no keys match the pattern', async () => {
    redis.scan.mockResolvedValue(['0', []]);

    await invalidateCache('GET /api/nonexistent*');

    expect(redis.del).not.toHaveBeenCalled();
  });

  test('handles Redis SCAN failure gracefully (no throw)', async () => {
    redis.scan.mockRejectedValue(new Error('Redis SCAN failed'));

    // Should not throw
    await expect(invalidateCache('GET /api/*')).resolves.not.toThrow();
  });

  test('handles Redis DEL failure gracefully (no throw)', async () => {
    redis.scan.mockResolvedValue(['0', ['key1']]);
    redis.del.mockRejectedValue(new Error('Redis DEL failed'));

    await expect(invalidateCache('GET /api/*')).resolves.not.toThrow();
  });

  test('continues scanning through multiple cursors until cursor is 0', async () => {
    // First scan returns cursor 42 (not done yet)
    redis.scan.mockResolvedValueOnce(['42', ['key1', 'key2']]);
    // Second scan returns cursor 0 (done)
    redis.scan.mockResolvedValueOnce(['0', ['key3']]);
    redis.del.mockResolvedValue(3);

    await invalidateCache('GET /api/listings*');

    expect(redis.scan).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
  });
});
