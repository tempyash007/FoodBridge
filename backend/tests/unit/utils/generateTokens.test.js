// ---------------------------------------------------------------------------
// Unit Tests — generateTokens.js
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const pool = require('src/config/db');

jest.mock('jsonwebtoken');
jest.mock('src/config/db', () => ({
  query: jest.fn(),
}));

const { generateAccessToken, generateRefreshToken, generateTokens } = require('src/utils/generateTokens');

describe('generateAccessToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a signed JWT string with correct secret and expiry', () => {
    jwt.sign.mockReturnValue('access-token-123');

    const payload = { userId: 'u1', email: 'a@b.com', role: 'donor' };
    const result = generateAccessToken(payload);

    expect(jwt.sign).toHaveBeenCalledWith(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    expect(result).toBe('access-token-123');
  });
});

describe('generateRefreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a signed JWT string with correct secret and expiry', () => {
    jwt.sign.mockReturnValue('refresh-token-456');

    const payload = { userId: 'u1', email: 'a@b.com', role: 'donor' };
    const result = generateRefreshToken(payload);

    expect(jwt.sign).toHaveBeenCalledWith(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    expect(result).toBe('refresh-token-456');
  });
});

describe('generateTokens', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns both access and refresh tokens', async () => {
    jwt.sign
      .mockReturnValueOnce('access-tok')
      .mockReturnValueOnce('refresh-tok');
    pool.query.mockResolvedValue({ rows: [] });

    const user = { user_id: 'u1', email: 'a@b.com', role: 'donor' };
    const result = await generateTokens(user);

    expect(result).toEqual({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });
  });

  test('inserts refresh token into database with expiry', async () => {
    jwt.sign
      .mockReturnValueOnce('access-tok')
      .mockReturnValueOnce('refresh-tok');
    pool.query.mockResolvedValue({ rows: [] });

    const user = { user_id: 'u1', email: 'a@b.com', role: 'donor' };
    await generateTokens(user);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO refresh_tokens'),
      expect.arrayContaining(['u1', 'refresh-tok']),
    );
  });

  test('builds payload from user object correctly', async () => {
    jwt.sign
      .mockReturnValueOnce('at')
      .mockReturnValueOnce('rt');
    pool.query.mockResolvedValue({ rows: [] });

    const user = { user_id: 'u99', email: 'z@w.com', role: 'admin' };
    await generateTokens(user);

    // First call is generateAccessToken
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'u99', email: 'z@w.com', role: 'admin' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );
  });

  test('propagates DB error when insert fails', async () => {
    jwt.sign
      .mockReturnValueOnce('at')
      .mockReturnValueOnce('rt');
    pool.query.mockRejectedValue(new Error('DB insert failed'));

    const user = { user_id: 'u1', email: 'a@b.com', role: 'donor' };

    await expect(generateTokens(user)).rejects.toThrow('DB insert failed');
  });
});
