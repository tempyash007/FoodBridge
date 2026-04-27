// src/config/redis.js

// ✅ Disable Redis completely if URL is not provided
if (!process.env.REDIS_URL) {
  console.log('⚠️ Redis disabled (no REDIS_URL)');
  module.exports = null;
  return;
}

const Redis = require('ioredis');

// ✅ Keep your original robust config
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  // Don't crash — fallback handled in middleware
});

module.exports = redis;