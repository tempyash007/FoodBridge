const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { register, login, logout, refresh, me, forgotPassword, resetPassword, resendReset } = require('../controllers/auth.controller');
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

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('A valid email address is required'),
];

const resetPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('A valid email address is required'),
    body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
    body('new_password')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters'),
];

const resendResetValidation = [
    body('email')
        .isEmail()
        .withMessage('A valid email address is required'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refresh);
router.get('/me', authenticateToken, me);

// Password reset — public (no auth required)
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, resetPassword);
router.post('/resend-reset', resendResetValidation, validate, resendReset);

module.exports = router;
