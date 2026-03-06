const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { generateTokens, generateAccessToken } = require('../utils/generateTokens');

// Cookie options
const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: false,         // set to true in production (HTTPS)
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
};

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Helper — sets accessToken & refreshToken as HTTP-only cookies.
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
};

/**
 * POST /api/auth/register
 * Create a new user, hash password, set token cookies.
 */
const register = asyncHandler(async (req, res) => {
    const { email, password, first_name, last_name, role, phone } = req.body;

    // Check if email already exists
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        return res.status(409).json({
            success: false,
            data: {},
            message: 'A user with this email already exists',
        });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user (role stored lowercase in DB enum)
    const dbRole = role.toLowerCase();
    const result = await pool.query(
        `INSERT INTO users (email, phone, password_hash, first_name, last_name, role, is_verified, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, false, true)
     RETURNING user_id, email, phone, first_name, last_name, role, avatar_url, is_verified, is_active, created_at, updated_at`,
        [email, phone || null, password_hash, first_name, last_name, dbRole]
    );

    const user = result.rows[0];

    // Generate tokens & set cookies
    const { accessToken, refreshToken } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshToken);

    return res.status(201).json({
        success: true,
        data: {
            user,
            accessToken,
            refreshToken,
        },
        message: 'User registered successfully',
    });
});

/**
 * POST /api/auth/login
 * Verify email + password, set token cookies.
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'Invalid email or password',
        });
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'Invalid email or password',
        });
    }

    // Update last_login_at
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

    // Generate tokens & set cookies
    const { accessToken, refreshToken } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshToken);

    // Remove password_hash from response
    const { password_hash: _, ...safeUser } = user;

    return res.status(200).json({
        success: true,
        data: {
            user: safeUser,
            accessToken,
            refreshToken,
        },
        message: 'Login successful',
    });
});

/**
 * POST /api/auth/logout
 * Protected — deletes the user's refresh token from the database & clears cookies.
 */
const logout = asyncHandler(async (req, res) => {
    const { userId } = req.user;

    // Find and delete refresh token for this user
    const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING id',
        [userId]
    );

    if (result.rowCount === 0) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'No active session found',
        });
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({
        success: true,
        data: {},
        message: 'Logged out successfully',
    });
});

/**
 * POST /api/auth/refresh
 * Protected — looks up the user's refresh token from DB, issues a new access token & sets cookie.
 */
const refresh = asyncHandler(async (req, res) => {
    const { userId } = req.user;

    // Look up refresh token from DB by user_id
    const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [userId]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'No active refresh token found. Please login again.',
        });
    }

    const storedToken = result.rows[0].token;

    // Verify the stored refresh token JWT is still valid
    let decoded;
    try {
        decoded = jwt.verify(storedToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
        // Token expired or invalid — clean it up
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
        return res.status(401).json({
            success: false,
            data: {},
            message: 'Refresh token expired. Please login again.',
        });
    }

    // Issue a new access token & set cookie
    const accessToken = generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
    });
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);

    return res.status(200).json({
        success: true,
        data: { accessToken },
        message: 'Access token refreshed successfully',
    });
});

/**
 * GET /api/auth/me
 * Return the current authenticated user (password_hash excluded).
 */
const me = asyncHandler(async (req, res) => {
    const { userId } = req.user;

    const result = await pool.query(
        `SELECT user_id, email, phone, first_name, last_name, role, avatar_url,
            is_verified, is_active, last_login_at, created_at, updated_at
     FROM users WHERE user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'User not found',
        });
    }

    return res.status(200).json({
        success: true,
        data: { user: result.rows[0] },
        message: 'User retrieved successfully',
    });
});

module.exports = { register, login, logout, refresh, me };
