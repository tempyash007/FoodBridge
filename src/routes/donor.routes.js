const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  getDashboard,
  getHistory,
  exportHistory,
  getImpact,
} = require('../controllers/donor.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Role guard — DONOR only
// ---------------------------------------------------------------------------
const requireDonor = (req, res, next) => {
  if (req.user.role !== 'donor') {
    return res.status(403).json({
      success: false,
      data: {},
      message: 'Only donors can access this resource',
    });
  }
  next();
};

// All routes require auth + DONOR role
router.use(authenticateToken, requireDonor);

// Dashboard
router.get('/dashboard', getDashboard);

// Donation history
router.get('/history/export', exportHistory);   // must be before /history/:id patterns
router.get('/history', getHistory);

// Impact
router.get('/impact', getImpact);

module.exports = router;
