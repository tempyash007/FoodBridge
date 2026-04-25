const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { generateTokens, generateAccessToken } = require('../utils/generateTokens');
const { sendPasswordResetEmail } = require('../services/email.service');

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

    // Auto-create role-specific profile
    if (dbRole === 'volunteer') {
        await pool.query(
            `INSERT INTO volunteer_profiles (user_id, vehicle_type, max_distance_km, is_available, total_deliveries, avg_rating)
             VALUES ($1, 'bicycle', 10, true, 0, 0)`,
            [user.user_id],
        );
    }

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

// ---------------------------------------------------------------------------
// Password Reset Endpoints
// ---------------------------------------------------------------------------

/**
 * Helper — generates a reset token, hashes it, stores it in DB, and sends the email.
 * Shared by forgotPassword and resendReset.
 *
 * @param {object} user — { user_id, email, first_name }
 * @returns {{ rawToken: string }}
 */
const _createAndSendResetToken = async (user) => {
    // Generate a cryptographically secure raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing (salt = 10)
    const tokenHash = await bcrypt.hash(rawToken, 10);

    // Store hashed token with 15-minute expiry
    await pool.query(
        `INSERT INTO password_reset_tokens (user_id, email, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
        [user.user_id, user.email, tokenHash]
    );

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    // Send email (throws on failure — caller handles it)
    await sendPasswordResetEmail(user.email, resetLink, user.first_name);

    return { rawToken };
};

/**
 * POST /api/auth/forgot-password
 * Public — sends a password-reset email if the user exists.
 * Never reveals whether the email is registered.
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Generic success message — returned regardless of email existence
    const genericMessage = 'If this email exists, a reset link has been sent';

    // Look up user
    const result = await pool.query(
        'SELECT user_id, email, first_name FROM users WHERE email = $1 AND is_active = true',
        [email]
    );

    if (result.rows.length === 0) {
        // Don't reveal that the email doesn't exist
        return res.status(200).json({
            success: true,
            data: {},
            message: genericMessage,
        });
    }

    const user = result.rows[0];

    try {
        await _createAndSendResetToken(user);
    } catch (err) {
        console.error('❌ forgotPassword email error:', err.message);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Failed to send reset email. Please try again later.',
        });
    }

    return res.status(200).json({
        success: true,
        data: {},
        message: genericMessage,
    });
});

/**
 * POST /api/auth/reset-password
 * Public — resets the user's password using a valid token.
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { email, token, new_password } = req.body;

    // Find a valid (unused, non-expired) token for this email
    const tokenResult = await pool.query(
        `SELECT token_id, token_hash
         FROM password_reset_tokens
         WHERE email = $1 AND expires_at > NOW() AND used = false
         ORDER BY created_at DESC`,
        [email]
    );

    if (tokenResult.rows.length === 0) {
        return res.status(400).json({
            success: false,
            data: {},
            message: 'Invalid or expired reset token',
        });
    }

    // Try matching the raw token against each stored hash (there may be multiple unused)
    let matchedTokenId = null;
    for (const row of tokenResult.rows) {
        const isMatch = await bcrypt.compare(token, row.token_hash);
        if (isMatch) {
            matchedTokenId = row.token_id;
            break;
        }
    }

    if (!matchedTokenId) {
        return res.status(400).json({
            success: false,
            data: {},
            message: 'Invalid or expired reset token',
        });
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update the user's password
    await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [newPasswordHash, email]
    );

    // Mark token as used
    await pool.query(
        'UPDATE password_reset_tokens SET used = true WHERE token_id = $1',
        [matchedTokenId]
    );

    return res.status(200).json({
        success: true,
        data: {},
        message: 'Password reset successfully',
    });
});

/**
 * POST /api/auth/resend-reset
 * Public — resends a password-reset email with a fresh token.
 * Rate-limited: rejects if last token was created < 60 seconds ago.
 */
const resendReset = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const genericMessage = 'If this email exists, a reset link has been sent';

    // Look up user
    const userResult = await pool.query(
        'SELECT user_id, email, first_name FROM users WHERE email = $1 AND is_active = true',
        [email]
    );

    if (userResult.rows.length === 0) {
        return res.status(200).json({
            success: true,
            data: {},
            message: genericMessage,
        });
    }

    const user = userResult.rows[0];

    // Rate limit — check if last token was sent less than 60 seconds ago
    const recentToken = await pool.query(
        `SELECT created_at FROM password_reset_tokens
         WHERE email = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
    );

    if (recentToken.rows.length > 0) {
        const lastCreated = new Date(recentToken.rows[0].created_at);
        const secondsSince = (Date.now() - lastCreated.getTime()) / 1000;

        if (secondsSince < 60) {
            return res.status(429).json({
                success: false,
                data: {},
                message: 'Please wait before requesting another reset',
            });
        }
    }

    // Delete existing unused tokens for this email
    await pool.query(
        'DELETE FROM password_reset_tokens WHERE email = $1 AND used = false',
        [email]
    );

    try {
        await _createAndSendResetToken(user);
    } catch (err) {
        console.error('❌ resendReset email error:', err.message);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Failed to send reset email. Please try again later.',
        });
    }

    return res.status(200).json({
        success: true,
        data: {},
        message: genericMessage,
    });
});

module.exports = { register, login, logout, refresh, me, forgotPassword, resetPassword, resendReset };
