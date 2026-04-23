const redis = require('../config/redis');

// ---------------------------------------------------------------------------
// invalidateCache(pattern)
// ---------------------------------------------------------------------------
// Scans Redis for keys matching the given pattern and deletes them.
// Uses SCAN (non-blocking) instead of KEYS to avoid locking Redis.
//
// Example: invalidateCache('GET /api/listings*')
// ---------------------------------------------------------------------------
const invalidateCache = async (pattern) => {
  try {
    let cursor = '0';
    const keysToDelete = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`🗑️  Cache invalidated: ${keysToDelete.length} key(s) matching "${pattern}"`);
    }
  } catch (err) {
    // Redis is down — nothing to invalidate, skip silently
    console.error('Redis invalidation error (skipping):', err.message);
  }
};

module.exports = invalidateCache;
