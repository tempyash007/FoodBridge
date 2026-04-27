// src/middleware/cache.middleware.js
const redis = require('../config/redis');

const createCacheMiddleware = (ttlSeconds) => {
  return async (req, res, next) => {
    // ✅ If Redis is not available → skip everything
    if (!redis) return next();

    const userId = req.user?.userId || '';
    const cacheKey = `${req.method} ${req.originalUrl}|${userId}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      // Don’t crash your API because of Redis
      console.error('Redis GET error (skipping cache):', err.message);
    }

    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (body && body.success !== false) {
        redis
          .set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds)
          .catch((err) => {
            console.error('Redis SET error (skipping cache):', err.message);
          });
      }

      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

module.exports = createCacheMiddleware;