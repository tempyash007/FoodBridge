const redis = require('../config/redis');

// ---------------------------------------------------------------------------
// createCacheMiddleware(ttlSeconds)
// ---------------------------------------------------------------------------
// - Cache key = "METHOD originalUrl [userId]" (userId only when req.user exists)
// - HIT  → return cached JSON immediately, set X-Cache: HIT
// - MISS → intercept res.json(), store in Redis with TTL, set X-Cache: MISS
// - On ANY Redis error → skip cache silently, continue to DB
// ---------------------------------------------------------------------------
const createCacheMiddleware = (ttlSeconds) => {
  return async (req, res, next) => {
    // Build a unique cache key
    const userId = req.user?.userId || '';
    const cacheKey = `${req.method} ${req.originalUrl}|${userId}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        // Cache HIT — return immediately
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      // Redis is down — skip cache, continue to DB
      console.error('Redis GET error (skipping cache):', err.message);
    }

    // Cache MISS — intercept res.json() to store the response
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only cache successful responses
      if (body && body.success !== false) {
        try {
          redis.set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds).catch((err) => {
            console.error('Redis SET error (skipping cache):', err.message);
          });
        } catch (err) {
          console.error('Redis SET error (skipping cache):', err.message);
        }
      }

      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

module.exports = createCacheMiddleware;
