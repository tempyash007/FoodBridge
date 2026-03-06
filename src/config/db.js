const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Auto-create refresh_tokens table if it doesn't exist
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};

initDB().catch((err) => {
  console.error('Failed to initialize refresh_tokens table:', err.message);
});

module.exports = pool;
