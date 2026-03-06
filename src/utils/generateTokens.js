const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Generate an access token (short-lived, 15 minutes).
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
};

/**
 * Generate a refresh token (long-lived, 7 days).
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

/**
 * Generate both tokens and persist the refresh token in the database.
 * @param {object} user - Must contain at least { user_id, email, role }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateTokens = async (user) => {
    const payload = { userId: user.user_id, email: user.email, role: user.role };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in DB (expires 7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.user_id, refreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
};

module.exports = { generateAccessToken, generateRefreshToken, generateTokens };
