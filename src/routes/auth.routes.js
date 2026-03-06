const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { register, login, logout, refresh, me } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = Router();

// ---------------------------------------------------------------------------
// Validation middleware — returns 400 with first error if validation fails
// ---------------------------------------------------------------------------
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            data: {},
            message: errors.array()[0].msg,
        });
    }
    next();
};

// ---------------------------------------------------------------------------
// Validation chains
// ---------------------------------------------------------------------------
const registerValidation = [
    body('email')
        .isEmail()
        .withMessage('A valid email address is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    body('first_name')
        .notEmpty()
        .withMessage('First name is required'),
    body('last_name')
        .notEmpty()
        .withMessage('Last name is required'),
    body('role')
        .customSanitizer((value) => value?.toUpperCase())
        .isIn(['DONOR', 'RECIPIENT', 'VOLUNTEER', 'ADMIN'])
        .withMessage('Role must be one of: DONOR, RECIPIENT, VOLUNTEER, ADMIN'),
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('A valid email address is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refresh);
router.get('/me', authenticateToken, me);

module.exports = router;
