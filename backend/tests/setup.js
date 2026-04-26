// ---------------------------------------------------------------------------
// Global test setup — runs before every test file
// ---------------------------------------------------------------------------

// Mock environment variables so modules that read process.env at import time
// get deterministic values without a real .env file.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'testpass';
process.env.EMAIL_FROM = 'noreply@foodbridge.test';
process.env.RAPIDAPI_KEY = 'test-rapidapi-key';
process.env.PORT = '3000';

// Silence console output during tests to keep output clean
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
