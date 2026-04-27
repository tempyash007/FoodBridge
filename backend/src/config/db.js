const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// CRITICAL: handle idle client errors — without this, a lost DB connection
// emits an unhandled 'error' event and immediately kills the Node process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Auto-create required tables if they don't exist
const initDB = async () => {
  // 1. refresh_tokens (auth sessions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. password_reset_tokens (forgot-password flow)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(user_id),
      email       VARCHAR NOT NULL,
      token_hash  VARCHAR NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_prt_email_unused
      ON password_reset_tokens (email)
      WHERE used = false;
  `);

  // 3. notifications (in-app notification system)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type            VARCHAR(50) NOT NULL DEFAULT 'BROADCAST',
      title           VARCHAR(255) NOT NULL,
      message         TEXT,
      is_read         BOOLEAN DEFAULT false,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notif_user_unread
      ON notifications (user_id)
      WHERE is_read = false;
  `);
};

initDB().catch((err) => {
  console.error('Failed to initialize database tables:', err.message);
});

module.exports = pool;

