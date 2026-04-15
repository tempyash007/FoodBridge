const jwt = require('jsonwebtoken');

/**
 * Middleware that verifies the access token from cookies (or Authorization header as fallback)
 * and attaches the decoded payload to req.user.
 */
const authenticateToken = (req, res, next) => {
    // Try cookie first, then Authorization header
    const token = req.cookies?.accessToken
        || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (!token) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'Access token is required',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = decoded; // { userId, email, role, iat, exp }
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            data: {},
            message: 'Invalid or expired access token',
        });
    }
};

/**
 * Role-guard middleware factory.
 * Usage: requireRole('admin')  or  requireRole('admin', 'donor')
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            data: {},
            message: 'Access denied — insufficient permissions',
        });
    }
    next();
};

module.exports = { authenticateToken, requireRole };
