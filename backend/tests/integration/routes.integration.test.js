// ---------------------------------------------------------------------------
// Integration Tests — Routes + Middleware Chains
// ---------------------------------------------------------------------------
// These tests use Supertest to verify that the Express router wiring,
// validation middleware, and auth/role guards work end-to-end WITHOUT
// hitting a real database or external service.
// ---------------------------------------------------------------------------
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// ── Mock all heavy dependencies BEFORE requiring route files ─────────────
jest.mock('../../src/config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  }),
  on: jest.fn(),
}));

jest.mock('../../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  scan: jest.fn().mockResolvedValue(['0', []]),
  del: jest.fn().mockResolvedValue(0),
  on: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  })),
}));

jest.mock('axios');
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(false),
}));

// We need real jwt.sign for creating test tokens, but can mock verify
const realJwt = jest.requireActual('jsonwebtoken');

const request = require('supertest');

// ── Build a minimal Express app with all routes ─────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', require('../../src/routes/auth.routes'));
  app.use('/api/listings', require('../../src/routes/listing.routes'));
  app.use('/api/donor', require('../../src/routes/donor.routes'));
  app.use('/api/recipient', require('../../src/routes/recipient.routes'));
  app.use('/api/volunteer', require('../../src/routes/volunteer.routes'));
  app.use('/api/categories', require('../../src/routes/category.routes'));
  app.use('/api/admin', require('../../src/routes/admin.routes'));

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'FoodBridge API is running 🚀' });
  });

  // Global error handler (same as app.js)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      data: {},
      message: err.message || 'Internal server error',
    });
  });

  return app;
};

// Helper: create a signed access token cookie
const signToken = (payload) => {
  return realJwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
};

const donorToken = signToken({ userId: 'u-donor', email: 'd@b.com', role: 'donor' });
const recipientToken = signToken({ userId: 'u-recip', email: 'r@b.com', role: 'recipient' });
const volunteerToken = signToken({ userId: 'u-vol', email: 'v@b.com', role: 'volunteer' });
const adminToken = signToken({ userId: 'u-admin', email: 'a@b.com', role: 'admin' });

let app;

beforeAll(() => {
  app = buildApp();
});

// ═══════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════
describe('Health Check', () => {
  test('GET / returns success', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('FoodBridge');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Public Routes — No Auth Required
// ═══════════════════════════════════════════════════════════════════════════
describe('Public Routes', () => {
  test('GET /api/categories responds without auth', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/auth/forgot-password responds without auth (with valid email)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Auth Middleware — Blocks Unauthenticated Access
// ═══════════════════════════════════════════════════════════════════════════
describe('Auth Middleware', () => {
  test('blocks unauthenticated access to GET /api/listings', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access token is required');
  });

  test('blocks unauthenticated access to POST /api/auth/logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('blocks unauthenticated access to GET /api/donor/dashboard', async () => {
    const res = await request(app).get('/api/donor/dashboard');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Role Guards — Blocks Wrong Roles
// ═══════════════════════════════════════════════════════════════════════════
describe('Role Guards', () => {
  test('blocks non-donor from POST /api/listings', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Cookie', `accessToken=${recipientToken}`)
      .send({ title: 'Test' });
    expect(res.status).toBe(403);
  });

  test('blocks non-recipient from POST /api/recipient/claims', async () => {
    const res = await request(app)
      .post('/api/recipient/claims')
      .set('Cookie', `accessToken=${donorToken}`)
      .send({ listing_id: 'l1' });
    expect(res.status).toBe(403);
  });

  test('blocks non-volunteer from GET /api/volunteer/dashboard', async () => {
    const res = await request(app)
      .get('/api/volunteer/dashboard')
      .set('Cookie', `accessToken=${donorToken}`);
    expect(res.status).toBe(403);
  });

  test('blocks non-admin from GET /api/admin/overview', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Cookie', `accessToken=${donorToken}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Validation Middleware — Rejects Invalid Input
// ═══════════════════════════════════════════════════════════════════════════
describe('Validation Middleware', () => {
  test('rejects invalid email on /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: 'longpassword',
        first_name: 'A',
        last_name: 'B',
        role: 'donor',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('email');
  });

  test('rejects short password on /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'valid@email.com',
        password: 'short',
        first_name: 'A',
        last_name: 'B',
        role: 'donor',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Password');
  });

  test('rejects invalid role on /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'valid@email.com',
        password: 'longpassword',
        first_name: 'A',
        last_name: 'B',
        role: 'hacker',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Role');
  });

  test('rejects missing token on /api/auth/reset-password', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'valid@email.com',
        new_password: 'longpassword',
        // token is missing
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('token');
  });

  test('rejects missing fields on POST /api/listings (with auth)', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Cookie', `accessToken=${donorToken}`)
      .send({ title: 'Only title, missing rest' });
    expect(res.status).toBe(400);
  });
});
