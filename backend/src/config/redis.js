const Redis = require('ioredis');

// ---------------------------------------------------------------------------
// Redis Client — graceful connection with fallback
// ---------------------------------------------------------------------------
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,        // fail fast so API doesn't hang
  retryStrategy(times) {
    if (times > 3) return null;   // stop reconnecting after 3 attempts
    return Math.min(times * 200, 2000);
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  // DO NOT crash — APIs will fall back to DB
});

module.exports = redis;
