const { Router } = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth.middleware');
const createCacheMiddleware = require('../middleware/cache.middleware');
const {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
} = require('../controllers/listing.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Validation helper
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
// Role guard — DONOR only
// ---------------------------------------------------------------------------
const requireDonor = (req, res, next) => {
  if (req.user.role !== 'donor') {
    return res.status(403).json({
      success: false,
      data: {},
      message: 'Only donors can perform this action',
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// Validation chains
// ---------------------------------------------------------------------------
const createValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number'),
  body('quantity_unit').notEmpty().withMessage('quantity_unit is required'),
  body('expiry_time')
    .isISO8601()
    .withMessage('expiry_time must be a valid date'),
  body('pickup_start')
    .isISO8601()
    .withMessage('pickup_start must be a valid date'),
  body('pickup_end')
    .isISO8601()
    .withMessage('pickup_end must be a valid date'),
  body('street_address').notEmpty().withMessage('street_address is required'),
  body('city').notEmpty().withMessage('city is required'),
  body('state').notEmpty().withMessage('state is required'),
  body('postal_code').notEmpty().withMessage('postal_code is required'),
  body('country').notEmpty().withMessage('country is required'),
];

// ---------------------------------------------------------------------------
// IMPORTANT: /my must be registered before /:id so it isn't swallowed
// ---------------------------------------------------------------------------

// GET /api/listings/my  — DONOR only
router.get('/my', authenticateToken, requireDonor, getMyListings);

// GET /api/listings  — any logged-in
router.get('/', authenticateToken, createCacheMiddleware(120), getListings);

// GET /api/listings/:id  — any logged-in
router.get('/:id', authenticateToken, getListingById);

// POST /api/listings  — DONOR only
router.post('/', authenticateToken, requireDonor, createValidation, validate, createListing);

// PUT /api/listings/:id  — DONOR (owner only)
router.put('/:id', authenticateToken, requireDonor, updateListing);

// DELETE /api/listings/:id  — DONOR (owner only)
router.delete('/:id', authenticateToken, requireDonor, deleteListing);

module.exports = router;
