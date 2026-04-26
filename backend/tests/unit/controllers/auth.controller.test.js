// ---------------------------------------------------------------------------
// Unit Tests — auth.controller.js
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('src/config/db');
const { generateTokens, generateAccessToken } = require('src/utils/generateTokens');
const { sendPasswordResetEmail } = require('src/services/email.service');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('src/utils/generateTokens', () => ({
  generateTokens: jest.fn(),
  generateAccessToken: jest.fn(),
}));
jest.mock('src/services/email.service', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const { register, login, logout, refresh, me, forgotPassword, resetPassword, resendReset } = require('src/controllers/auth.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════
describe('register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates user and returns 201 on success', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // email check
    bcrypt.hash.mockResolvedValue('hashed-pw');
    pool.query.mockResolvedValueOnce({
      rows: [{
        user_id: 'u1', email: 'a@b.com', phone: null,
        first_name: 'John', last_name: 'Doe', role: 'donor',
        avatar_url: null, is_verified: false, is_active: true,
        created_at: '2024-01-01', updated_at: '2024-01-01',
      }],
    });
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const req = mockReq({
      body: { email: 'a@b.com', password: 'longpassword', first_name: 'John', last_name: 'Doe', role: 'donor' },
    });
    const res = mockRes();
    await callController(register, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'User registered successfully' }),
    );
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  test('returns 409 if email already exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 'existing' }] });

    const req = mockReq({
      body: { email: 'dup@test.com', password: 'pw', first_name: 'X', last_name: 'Y', role: 'donor' },
    });
    const res = mockRes();
    await callController(register, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'A user with this email already exists' }),
    );
  });

  test('auto-creates volunteer profile when role is volunteer', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'v1', email: 'v@b.com', role: 'volunteer', first_name: 'V', last_name: 'V' }] })
      .mockResolvedValueOnce({ rows: [] }); // INSERT volunteer_profiles
    bcrypt.hash.mockResolvedValue('h');
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const req = mockReq({
      body: { email: 'v@b.com', password: 'longpass1', first_name: 'V', last_name: 'V', role: 'volunteer' },
    });
    const res = mockRes();
    await callController(register, req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO volunteer_profiles'),
      expect.arrayContaining(['v1']),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════
describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 200 with tokens on successful login', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'u1', email: 'a@b.com', password_hash: '$hash',
          first_name: 'John', last_name: 'Doe', role: 'donor',
          is_active: true, is_verified: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE last_login_at
    bcrypt.compare.mockResolvedValue(true);
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const req = mockReq({ body: { email: 'a@b.com', password: 'correct' } });
    const res = mockRes();
    await callController(login, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Login successful' }),
    );
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  test('returns 401 when email not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { email: 'no@user.com', password: 'pw' } });
    const res = mockRes();
    await callController(login, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid email or password' }),
    );
  });

  test('returns 401 when password is wrong', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: '$hash', is_active: true }],
    });
    bcrypt.compare.mockResolvedValue(false);

    const req = mockReq({ body: { email: 'a@b.com', password: 'wrong' } });
    const res = mockRes();
    await callController(login, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid email or password' }),
    );
  });

  test('excludes password_hash from response body', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'SECRET', role: 'donor', is_active: true }],
      })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.compare.mockResolvedValue(true);
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const req = mockReq({ body: { email: 'a@b.com', password: 'correct' } });
    const res = mockRes();
    await callController(login, req, res);

    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.data.user).not.toHaveProperty('password_hash');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════
describe('logout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes refresh token and clears cookies on success', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'tok1' }] });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(logout, req, res);

    expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 401 when no active session found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(logout, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No active session found' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH
// ═══════════════════════════════════════════════════════════════════════════
describe('refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  test('issues new access token on success', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ token: 'stored-rt', expires_at: new Date(Date.now() + 86400000) }],
    });
    jwt.verify.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'donor' });
    generateAccessToken.mockReturnValue('new-at');

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(refresh, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessToken: 'new-at' } }),
    );
  });

  test('returns 401 when no active refresh token found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(refresh, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No active refresh token found. Please login again.' }),
    );
  });

  test('returns 401 and cleans up when refresh token JWT is expired', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ token: 'expired-rt' }] })
      .mockResolvedValueOnce({ rows: [] });
    jwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(refresh, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM refresh_tokens'), ['u1'],
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ME
// ═══════════════════════════════════════════════════════════════════════════
describe('me', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns user data on success', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', email: 'a@b.com', role: 'donor' }],
    });

    const req = mockReq({ user: { userId: 'u1' } });
    const res = mockRes();
    await callController(me, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { user: expect.objectContaining({ email: 'a@b.com' }) } }),
    );
  });

  test('returns 401 when user not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ user: { userId: 'gone' } });
    const res = mockRes();
    await callController(me, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User not found' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
describe('forgotPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns generic 200 when email exists and email sent', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'John' }] })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.hash.mockResolvedValue('hashed-token');
    sendPasswordResetEmail.mockResolvedValue(undefined);

    const req = mockReq({ body: { email: 'a@b.com' } });
    const res = mockRes();
    await callController(forgotPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'If this email exists, a reset link has been sent' }),
    );
  });

  test('returns same generic 200 when email does NOT exist (no leaking)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { email: 'no@user.com' } });
    const res = mockRes();
    await callController(forgotPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('returns 500 when email sending fails', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'John' }] })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.hash.mockResolvedValue('hashed');
    sendPasswordResetEmail.mockRejectedValue(new Error('SMTP failed'));

    const req = mockReq({ body: { email: 'a@b.com' } });
    const res = mockRes();
    await callController(forgotPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to send reset email. Please try again later.' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
describe('resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('resets password on valid token', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ token_id: 't1', token_hash: '$hash1' }] })
      .mockResolvedValueOnce({ rows: [] })  // UPDATE users
      .mockResolvedValueOnce({ rows: [] }); // Mark token used
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('new-pw-hash');

    const req = mockReq({ body: { email: 'a@b.com', token: 'raw-token', new_password: 'newpass123' } });
    const res = mockRes();
    await callController(resetPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Password reset successfully' }),
    );
  });

  test('returns 400 when no valid tokens found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { email: 'a@b.com', token: 'bad', new_password: 'pw' } });
    const res = mockRes();
    await callController(resetPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired reset token' }),
    );
  });

  test('returns 400 when token does not match any hash', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ token_id: 't1', token_hash: '$hash1' }] });
    bcrypt.compare.mockResolvedValue(false);

    const req = mockReq({ body: { email: 'a@b.com', token: 'wrong', new_password: 'pw' } });
    const res = mockRes();
    await callController(resetPassword, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired reset token' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESEND RESET
// ═══════════════════════════════════════════════════════════════════════════
describe('resendReset', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends fresh token and returns 200', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'A' }] })
      .mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 120000) }] })
      .mockResolvedValueOnce({ rows: [] })  // DELETE old tokens
      .mockResolvedValueOnce({ rows: [] }); // INSERT new token
    bcrypt.hash.mockResolvedValue('hashed');
    sendPasswordResetEmail.mockResolvedValue(undefined);

    const req = mockReq({ body: { email: 'a@b.com' } });
    const res = mockRes();
    await callController(resendReset, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  test('returns 429 when rate-limited', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'A' }] })
      .mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 10000) }] });

    const req = mockReq({ body: { email: 'a@b.com' } });
    const res = mockRes();
    await callController(resendReset, req, res);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('returns generic 200 when email does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { email: 'nope@test.com' } });
    const res = mockRes();
    await callController(resendReset, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
