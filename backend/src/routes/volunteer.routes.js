const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const createCacheMiddleware = require('../middleware/cache.middleware');
const {
  getDashboard,
  getAvailableMissions,
  acceptMission,
  getActiveMissions,
  updateMissionStatus,
  getSchedule,
  updateSchedule,
  getLeaderboard,
  updateLocation,
} = require('../controllers/volunteer.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Role guard — VOLUNTEER only
// ---------------------------------------------------------------------------
const requireVolunteer = (req, res, next) => {
  if (req.user.role !== 'volunteer') {
    return res.status(403).json({
      success: false,
      data: {},
      message: 'Only volunteers can access this resource',
    });
  }
  next();
};

// All routes require auth + VOLUNTEER role
router.use(authenticateToken, requireVolunteer);

// A1  — Dashboard
router.get('/dashboard', getDashboard);

// A2  — Available missions
router.get('/missions/available', getAvailableMissions);

// A4  — Active (current) deliveries  (before :param routes)
router.get('/missions/active', getActiveMissions);

// A3  — Accept a mission
router.post('/missions/:claim_id/accept', acceptMission);

// A5  — Update mission status
router.patch('/missions/:mission_id/status', updateMissionStatus);

// A6  — Schedule
router.get('/schedule', getSchedule);
router.put('/schedule', updateSchedule);

// A7  — Leaderboard
router.get('/leaderboard', createCacheMiddleware(300), getLeaderboard);

// B2  — Update volunteer location
router.patch('/location', updateLocation);

module.exports = router;
