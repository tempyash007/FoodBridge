const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const createCacheMiddleware = require('../middleware/cache.middleware');
const {
  browseListings,
  createClaim,
  getMyClaims,
  cancelClaim,
  submitReview,
} = require('../controllers/recipient.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Role guard — RECIPIENT only
// ---------------------------------------------------------------------------
const requireRecipient = (req, res, next) => {
  if (req.user.role !== 'recipient') {
    return res.status(403).json({
      success: false,
      data: {},
      message: 'Only recipients can access this resource',
    });
  }
  next();
};

// All routes require auth + RECIPIENT role
router.use(authenticateToken, requireRecipient);

// Browse available listings
router.get('/browse', createCacheMiddleware(120), browseListings);

// Claims — create & list
router.post('/claims', createClaim);
router.get('/claims', getMyClaims);

// Cancel a claim
router.delete('/claims/:claim_id', cancelClaim);

// Reviews
router.post('/reviews', submitReview);

module.exports = router;
