// ---------------------------------------------------------------------------
// Unit Tests — auth.middleware.js
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

const { authenticateToken, requireRole } = require('src/middleware/auth.middleware');

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockReq = (overrides = {}) => ({
  cookies: {},
  headers: {},
  user: null,
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// ── authenticateToken ────────────────────────────────────────────────────────
describe('authenticateToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('extracts token from cookie and attaches decoded user', () => {
    const decoded = { userId: 'u1', email: 'a@b.com', role: 'donor' };
    jwt.verify.mockReturnValue(decoded);

    const req = mockReq({ cookies: { accessToken: 'valid-token' } });
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_ACCESS_SECRET);
    expect(req.user).toEqual(decoded);
    expect(mockNext).toHaveBeenCalled();
  });

  test('extracts token from Authorization header as fallback', () => {
    const decoded = { userId: 'u2', email: 'b@c.com', role: 'recipient' };
    jwt.verify.mockReturnValue(decoded);

    const req = mockReq({
      headers: { authorization: 'Bearer header-token' },
    });
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('header-token', process.env.JWT_ACCESS_SECRET);
    expect(req.user).toEqual(decoded);
    expect(mockNext).toHaveBeenCalled();
  });

  test('returns 401 when no token is present', () => {
    const req = mockReq();
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Access token is required' }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('returns 401 for expired/invalid token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = mockReq({ cookies: { accessToken: 'expired-token' } });
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Invalid or expired access token' }),
    );
  });

  test('returns 401 for malformed token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const req = mockReq({ cookies: { accessToken: 'malformed' } });
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test('prefers cookie over Authorization header', () => {
    const decoded = { userId: 'u3', email: 'c@d.com', role: 'admin' };
    jwt.verify.mockReturnValue(decoded);

    const req = mockReq({
      cookies: { accessToken: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    });
    const res = mockRes();

    authenticateToken(req, res, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('cookie-token', process.env.JWT_ACCESS_SECRET);
  });
});

// ── requireRole ──────────────────────────────────────────────────────────────
describe('requireRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows matching role and calls next()', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks non-matching role with 403', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: { role: 'donor' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Access denied — insufficient permissions' }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('supports multiple allowed roles', () => {
    const middleware = requireRole('admin', 'donor');
    const req = mockReq({ user: { role: 'donor' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
