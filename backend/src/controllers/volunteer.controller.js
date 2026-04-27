const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { getOptimizedRoute, getDistance } = require('../services/maps.service');
const { createNotification, sendNotificationEmail } = require('../services/notification.service');

// ---------------------------------------------------------------------------
// Helper — get the volunteer_id (PK in volunteer_profiles) for a user_id
// ---------------------------------------------------------------------------
const getVolunteerId = async (userId) => {
  const result = await pool.query(
    `SELECT volunteer_id FROM volunteer_profiles WHERE user_id = $1`,
    [userId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].volunteer_id;
};

// ---------------------------------------------------------------------------
// Helper — day-of-week number → short name
// ---------------------------------------------------------------------------
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// Helper — round to nearest 25
// ---------------------------------------------------------------------------
const roundToNearest25 = (n) => Math.round(n / 25) * 25;

// ============================================================================
// A1. GET /api/volunteer/dashboard
// ============================================================================
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  // --- Stats ---
  const statsResult = await pool.query(
    `SELECT
       vp.total_deliveries,
       vp.avg_rating,
       vp.current_latitude,
       vp.current_longitude,
       COALESCE(im.meals_saved, 0)   AS meals_saved,
       COALESCE(im.total_deliveries, 0) AS impact_deliveries
     FROM volunteer_profiles vp
     LEFT JOIN impact_metrics im ON im.user_id = $1
     WHERE vp.volunteer_id = $2`,
    [userId, volunteerId],
  );

  const stats = statsResult.rows[0] || {};
  const totalDeliveries = stats.total_deliveries || 0;

  // This-week deliveries
  const weekResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM delivery_missions
     WHERE volunteer_id = $1
       AND delivery_time >= DATE_TRUNC('week', NOW())`,
    [volunteerId],
  );
  const thisWeekDeliveries = weekResult.rows[0]?.count || 0;

  // --- Optimized route from active missions ---
  const activeMissionsResult = await pool.query(
    `SELECT
       dm.mission_id,
       dm.status,
       fl.title        AS listing_title,
       fl.expiry_time,
       fl.quantity,
       fl.quantity_unit,
       -- Pickup (donor)
       o_donor.org_name  AS donor_org,
       a_pickup.street_address AS pickup_address,
       a_pickup.latitude       AS pickup_lat,
       a_pickup.longitude      AS pickup_lng,
       -- Delivery (recipient)
       a_deliv.street_address AS delivery_address,
       a_deliv.latitude       AS delivery_lat,
       a_deliv.longitude      AS delivery_lng,
       dm.est_distance_km,
       dm.est_duration_min
     FROM delivery_missions dm
     JOIN claims c           ON dm.claim_id   = c.claim_id
     JOIN food_listings fl   ON c.listing_id  = fl.listing_id
     JOIN addresses a_pickup ON fl.address_id = a_pickup.address_id
     LEFT JOIN organizations o_donor ON fl.donor_id = o_donor.user_id
     LEFT JOIN addresses a_deliv     ON c.delivery_address_id = a_deliv.address_id
     WHERE dm.volunteer_id = $1
       AND dm.status IN ('assigned', 'in_transit', 'picked_up')
     ORDER BY dm.created_at ASC`,
    [volunteerId],
  );

  let optimizedRoute = { stops: [], total_km: 0, est_duration_min: 0, total_stops: 0, polyline: '' };

  if (activeMissionsResult.rows.length > 0) {
    // Build waypoints alternating PICKUP → DELIVER
    const waypoints = [];
    for (const m of activeMissionsResult.rows) {
      waypoints.push({
        lat: parseFloat(m.pickup_lat),
        lng: parseFloat(m.pickup_lng),
        name: m.donor_org || 'Pickup',
        type: 'PICKUP',
        address: m.pickup_address,
      });
      if (m.delivery_lat && m.delivery_lng) {
        waypoints.push({
          lat: parseFloat(m.delivery_lat),
          lng: parseFloat(m.delivery_lng),
          name: 'Delivery',
          type: 'DELIVER',
          address: m.delivery_address,
        });
      }
    }

    const origin = {
      lat: parseFloat(stats.current_latitude) || waypoints[0].lat,
      lng: parseFloat(stats.current_longitude) || waypoints[0].lng,
    };

    try {
      const routeData = await getOptimizedRoute(origin, waypoints);
      optimizedRoute = {
        stops: routeData.stops,
        total_km: routeData.total_km,
        est_duration_min: routeData.est_duration_min,
        total_stops: routeData.stops.length,
        polyline: routeData.polyline,
      };

      // Save route info back to each active mission
      for (const m of activeMissionsResult.rows) {
        await pool.query(
          `UPDATE delivery_missions
           SET route_polyline = $1, est_distance_km = $2, est_duration_min = $3, updated_at = NOW()
           WHERE mission_id = $4`,
          [routeData.polyline, routeData.total_km, routeData.est_duration_min, m.mission_id],
        );
      }
    } catch (err) {
      // If maps service is unavailable, return what we have without route
      console.error('Route optimization failed:', err.message);
    }
  }

  // --- Current deliveries (same shape as A4) ---
  const currentDeliveries = activeMissionsResult.rows.map((m) => ({
    mission_id: m.mission_id,
    status: m.status,
    is_urgent: m.expiry_time ? new Date(m.expiry_time) < new Date(Date.now() + 2 * 60 * 60 * 1000) : false,
    pickup: {
      org_name: m.donor_org,
      address: m.pickup_address,
      listing_title: m.listing_title,
      quantity: m.quantity ? Number(m.quantity) : null,
      quantity_unit: m.quantity_unit,
    },
    delivery: {
      org_name: null,
      address: m.delivery_address,
    },
    distance_km: m.est_distance_km ? parseFloat(m.est_distance_km) : null,
    est_duration_min: m.est_duration_min || null,
  }));

  // --- Achievements Computation ---
  const achievementsQuery = await pool.query(
    `SELECT
       COUNT(*) AS total_deliveries,
       COUNT(*) FILTER (WHERE actual_duration_min < 20) AS fast_deliveries,
       COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM delivery_time AT TIME ZONE 'UTC') < 9) AS early_deliveries,
       COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM delivery_time AT TIME ZONE 'UTC') >= 20) AS night_deliveries,
       COALESCE(SUM(est_distance_km), 0) AS total_distance
     FROM delivery_missions
     WHERE volunteer_id = $1 AND status = 'delivered'`,
    [volunteerId]
  );
  
  const achStats = achievementsQuery.rows[0] || {};
  const totDeliv = parseInt(achStats.total_deliveries) || 0;
  const fastDeliv = parseInt(achStats.fast_deliveries) || 0;
  const earlyDeliv = parseInt(achStats.early_deliveries) || 0;
  const nightDeliv = parseInt(achStats.night_deliveries) || 0;
  const totalDist = parseFloat(achStats.total_distance) || 0;

  const achievements = [
    { title: 'First Delivery', desc: 'Completed your first rescue', icon: '🚀', earned: totDeliv >= 1, progress: Math.min(100, totDeliv * 100) },
    { title: 'Speed Demon', desc: '10 deliveries under 20 min', icon: '⚡', earned: fastDeliv >= 10, progress: Math.min(100, (fastDeliv / 10) * 100) },
    { title: '100 Club', desc: 'Completed 100 deliveries', icon: '💯', earned: totDeliv >= 100, progress: Math.min(100, (totDeliv / 100) * 100) },
    { title: 'Early Bird', desc: '20 deliveries before 9 AM', icon: '🌅', earned: earlyDeliv >= 20, progress: Math.min(100, (earlyDeliv / 20) * 100) },
    { title: 'Marathon Runner', desc: '50 km total distance', icon: '🏃', earned: totalDist >= 50, progress: Math.min(100, (totalDist / 50) * 100) },
    { title: 'Night Owl', desc: '10 deliveries after 8 PM', icon: '🦉', earned: nightDeliv >= 10, progress: Math.min(100, (nightDeliv / 10) * 100) },
    { title: 'Legendary', desc: '500 deliveries milestone', icon: '🔥', earned: totDeliv >= 500, progress: Math.min(100, (totDeliv / 500) * 100) },
  ];

  return res.status(200).json({
    success: true,
    data: {
      stats: {
        total_deliveries: totalDeliveries,
        this_week_deliveries: thisWeekDeliveries,
        points_earned: totalDeliveries * 25,
        avg_rating: stats.avg_rating ? parseFloat(stats.avg_rating) : null,
      },
      achievements: achievements,
      optimized_route: optimizedRoute,
      current_deliveries: currentDeliveries,
    },
    message: 'Dashboard loaded successfully',
  });
});

// ============================================================================
// A2. GET /api/volunteer/missions/available
// ============================================================================
const getAvailableMissions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  // Get volunteer's current location
  const volResult = await pool.query(
    `SELECT current_latitude, current_longitude FROM volunteer_profiles WHERE volunteer_id = $1`,
    [volunteerId],
  );
  const volLat = parseFloat(volResult.rows[0]?.current_latitude);
  const volLng = parseFloat(volResult.rows[0]?.current_longitude);

  // Claims that are CONFIRMED and have no delivery_missions row yet
  const result = await pool.query(
    `SELECT
       c.claim_id,
       fl.title       AS listing_title,
       fl.quantity,
       fl.quantity_unit,
       fl.estimated_servings,
       fl.expiry_time,
       o_donor.org_name  AS donor_org,
       o_recip.org_name  AS recipient_org,
       a.latitude        AS pickup_lat,
       a.longitude       AS pickup_lng,
       a.street_address  AS pickup_address
     FROM claims c
     JOIN food_listings fl   ON c.listing_id  = fl.listing_id
     LEFT JOIN addresses a        ON fl.address_id = a.address_id
     LEFT JOIN organizations o_donor ON fl.donor_id     = o_donor.user_id
     LEFT JOIN organizations o_recip ON c.recipient_id  = o_recip.user_id
     WHERE c.status = 'approved'
     AND fl.status = 'reserved'
       AND fl.expiry_time > NOW()
       AND NOT EXISTS (
         SELECT 1 FROM delivery_missions dm WHERE dm.claim_id = c.claim_id
       )
     ORDER BY fl.expiry_time ASC`,
  );

  // Calculate distance for each mission using Google Maps
  const missions = [];
  for (const row of result.rows) {
    let distanceKm = null;

    if (volLat && volLng && row.pickup_lat && row.pickup_lng) {
      try {
        const dist = await getDistance(
          { lat: volLat, lng: volLng },
          { lat: parseFloat(row.pickup_lat), lng: parseFloat(row.pickup_lng) },
        );
        distanceKm = dist.distance_km;
      } catch (err) {
        // If maps fails, fall back to haversine approximation
        distanceKm = haversineDistance(
          volLat, volLng,
          parseFloat(row.pickup_lat), parseFloat(row.pickup_lng),
        );
      }
    }

    const minutesUntilExpiry = row.expiry_time
      ? Math.round((new Date(row.expiry_time) - Date.now()) / 60000)
      : null;

    const rawPoints = (row.estimated_servings || 0) * 2;

    missions.push({
      claim_id: row.claim_id,
      donor_org: row.donor_org,
      recipient_org: row.recipient_org,
      listing_title: row.listing_title,
      quantity: Number(row.quantity),
      quantity_unit: row.quantity_unit,
      distance_km: distanceKm,
      minutes_until_expiry: minutesUntilExpiry,
      points: roundToNearest25(rawPoints),
      is_urgent: minutesUntilExpiry !== null && minutesUntilExpiry < 120,
    });
  }

  // Sort by distance ascending (nulls last)
  missions.sort((a, b) => {
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  console.log('Available missions query returned:', result.rows.length, 'rows');
  console.log('Missions built:', missions.length);


  return res.status(200).json({
    success: true,
    data: { missions },
    message: 'Available missions fetched successfully',
  });
});

// ---------------------------------------------------------------------------
// Haversine fallback (km) — used when Google Maps API is unreachable
// ---------------------------------------------------------------------------
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// ============================================================================
// A3. POST /api/volunteer/missions/:claim_id/accept
// ============================================================================
const acceptMission = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { claim_id } = req.params;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  // Check claim exists and is CONFIRMED
  const claimResult = await pool.query(
    `SELECT c.claim_id, c.listing_id, c.recipient_id, c.status
     FROM claims c
     WHERE c.claim_id = $1`,
    [claim_id],
  );

  if (claimResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Claim not found',
    });
  }

  if (claimResult.rows[0].status !== 'approved') {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Claim is not available for delivery',
    });
  }

  // Check no existing delivery mission for this claim
  const existingMission = await pool.query(
    `SELECT mission_id FROM delivery_missions WHERE claim_id = $1`,
    [claim_id],
  );

  if (existingMission.rows.length > 0) {
    return res.status(409).json({
      success: false,
      data: {},
      message: 'This mission has already been taken by another volunteer',
    });
  }

  // Get pickup and delivery addresses for route calculation
  const claim = claimResult.rows[0];
  const addressResult = await pool.query(
    `SELECT
       a_pickup.latitude       AS pickup_lat,
       a_pickup.longitude      AS pickup_lng,
       a_pickup.street_address AS pickup_address,
       donor_org.org_name      AS donor_org,
       fl.title                AS listing_title,
       fl.quantity,
       fl.quantity_unit,
       recipient_org.org_name  AS recipient_org,
       a_deliv.street_address  AS delivery_address,
       a_deliv.latitude        AS delivery_lat,
       a_deliv.longitude       AS delivery_lng
     FROM food_listings fl
     JOIN addresses a_pickup          ON a_pickup.address_id     = fl.address_id
     LEFT JOIN organizations donor_org    ON donor_org.user_id   = fl.donor_id
     LEFT JOIN organizations recipient_org ON recipient_org.user_id = $2
     LEFT JOIN claims c2                   ON c2.claim_id = $3
     LEFT JOIN addresses a_deliv           ON a_deliv.address_id = c2.delivery_address_id
     WHERE fl.listing_id = $1`,
    [claim.listing_id, claim.recipient_id, claim_id],
  );

  const addr = addressResult.rows[0] || {};

  // Insert the mission
  const missionInsert = await pool.query(
    `INSERT INTO delivery_missions (claim_id, volunteer_id, status)
     VALUES ($1, $2, 'assigned')
     RETURNING *`,
    [claim_id, volunteerId],
  );

  const newMission = missionInsert.rows[0];

  // Get volunteer's current location for route optimization
  const volLocResult = await pool.query(
    `SELECT current_latitude, current_longitude FROM volunteer_profiles WHERE volunteer_id = $1`,
    [volunteerId],
  );
  const volLoc = volLocResult.rows[0];

  let routeInfo = { total_km: 0, est_duration_min: 0, polyline: null };

  // Determine origin: volunteer's current location, or fall back to pickup coords
  const volLat = volLoc?.current_latitude ? parseFloat(volLoc.current_latitude) : null;
  const volLng = volLoc?.current_longitude ? parseFloat(volLoc.current_longitude) : null;

  const pickupLat = addr.pickup_lat ? parseFloat(addr.pickup_lat) : null;
  const pickupLng = addr.pickup_lng ? parseFloat(addr.pickup_lng) : null;
  const deliveryLat = addr.delivery_lat ? parseFloat(addr.delivery_lat) : null;
  const deliveryLng = addr.delivery_lng ? parseFloat(addr.delivery_lng) : null;

  const originLat = volLat ?? pickupLat;
  const originLng = volLng ?? pickupLng;

  if (originLat && originLng && pickupLat && pickupLng) {
    const origin = { lat: originLat, lng: originLng };

    // Build waypoints from all active missions (volunteer has location set)
    // or a direct pickup → delivery pair (fallback)
    let waypoints = [];

    if (volLat && volLng) {
      // Full multi-mission route — query all active missions
      const allActiveMissions = await pool.query(
        `SELECT
           dm.mission_id,
           a_pickup.latitude  AS pickup_lat,
           a_pickup.longitude AS pickup_lng,
           a_pickup.street_address AS pickup_address,
           o_donor.org_name   AS donor_org,
           a_deliv.latitude   AS delivery_lat,
           a_deliv.longitude  AS delivery_lng,
           a_deliv.street_address AS delivery_address,
           o_recip.org_name   AS recipient_org
         FROM delivery_missions dm
         JOIN claims c           ON dm.claim_id   = c.claim_id
         JOIN food_listings fl   ON c.listing_id  = fl.listing_id
         JOIN addresses a_pickup ON fl.address_id = a_pickup.address_id
         LEFT JOIN organizations o_donor ON fl.donor_id    = o_donor.user_id
         LEFT JOIN addresses a_deliv     ON c.delivery_address_id = a_deliv.address_id
         WHERE dm.volunteer_id = $1
           AND dm.status IN ('assigned', 'in_transit')
         ORDER BY dm.created_at ASC`,
        [volunteerId],
      );

      for (const m of allActiveMissions.rows) {
        if (m.pickup_lat && m.pickup_lng) {
          waypoints.push({
            lat: parseFloat(m.pickup_lat),
            lng: parseFloat(m.pickup_lng),
            name: m.donor_org || 'Pickup',
            type: 'PICKUP',
            address: m.pickup_address,
          });
        }
        if (m.delivery_lat && m.delivery_lng) {
          waypoints.push({
            lat: parseFloat(m.delivery_lat),
            lng: parseFloat(m.delivery_lng),
            name: m.recipient_org || 'Delivery',
            type: 'DELIVER',
            address: m.delivery_address,
          });
        }
      }
    } else {
      // Fallback — no volunteer location; compute direct pickup → delivery only
      waypoints.push({
        lat: pickupLat,
        lng: pickupLng,
        name: addr.donor_org || 'Pickup',
        type: 'PICKUP',
        address: addr.pickup_address,
      });
      if (deliveryLat && deliveryLng) {
        waypoints.push({
          lat: deliveryLat,
          lng: deliveryLng,
          name: addr.recipient_org || 'Delivery',
          type: 'DELIVER',
          address: addr.delivery_address,
        });
      }
    }

    if (waypoints.length > 0) {
      try {
        routeInfo = await getOptimizedRoute(origin, waypoints);
      } catch (err) {
        console.error('Route optimization failed on accept:', err.message);
        routeInfo = { total_km: 0, est_duration_min: 0, polyline: null };
      }
    }

    // Persist route info to the new mission regardless of which path computed it
    await pool.query(
      `UPDATE delivery_missions
       SET route_polyline = $1, est_distance_km = $2, est_duration_min = $3, updated_at = NOW()
       WHERE mission_id = $4`,
      [routeInfo.polyline, routeInfo.total_km, routeInfo.est_duration_min, newMission.mission_id],
    );
  }

  // ── Fire-and-forget: notify RECIPIENT that a volunteer accepted ──
  (async () => {
    try {
      // Get volunteer first name
      const volUser = await pool.query(
        `SELECT first_name FROM users WHERE user_id = $1`,
        [userId],
      );
      const volunteerName = volUser.rows[0]?.first_name || 'A volunteer';

      createNotification({
        userId: claim.recipient_id,
        type: 'VOLUNTEER_ASSIGNED',
        title: 'A volunteer is on the way',
        message: `${volunteerName} has accepted your food rescue mission`,
      });
    } catch (err) {
      console.error('⚠️  Notification hook (acceptMission) failed:', err.message);
    }
  })();

  return res.status(201).json({
    success: true,
    data: {
      mission: {
        mission_id: newMission.mission_id,
        claim_id: newMission.claim_id,
        status: newMission.status,
        pickup: {
          org_name: addr.donor_org,
          address: addr.pickup_address,
          listing_title: addr.listing_title,
          quantity: addr.quantity ? Number(addr.quantity) : null,
          quantity_unit: addr.quantity_unit,
        },
        delivery: {
          org_name: addr.recipient_org,
          address: addr.delivery_address,
        },
        route: {
          total_km: routeInfo.total_km,
          est_duration_min: routeInfo.est_duration_min,
          polyline: routeInfo.polyline,
        },
      },
    },
    message: 'Mission accepted successfully',
  });
});

// ============================================================================
// A4. GET /api/volunteer/missions/active
// ============================================================================
const getActiveMissions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  const result = await pool.query(
    `SELECT
       dm.mission_id,
       dm.status,
       dm.est_distance_km,
       dm.est_duration_min,
       fl.title          AS listing_title,
       fl.quantity,
       fl.quantity_unit,
       fl.expiry_time,
       o_donor.org_name  AS donor_org,
       a_pickup.street_address AS pickup_address,
       a_deliv.street_address  AS delivery_address
     FROM delivery_missions dm
     JOIN claims c           ON dm.claim_id   = c.claim_id
     JOIN food_listings fl   ON c.listing_id  = fl.listing_id
     JOIN addresses a_pickup ON fl.address_id = a_pickup.address_id
     LEFT JOIN organizations o_donor ON fl.donor_id    = o_donor.user_id
     LEFT JOIN addresses a_deliv     ON c.delivery_address_id = a_deliv.address_id
     WHERE dm.volunteer_id = $1
       AND dm.status IN ('assigned', 'in_transit', 'picked_up')
     ORDER BY dm.created_at ASC`,
    [volunteerId],
  );

  const missions = result.rows.map((m) => ({
    mission_id: m.mission_id,
    status: m.status,
    is_urgent: m.expiry_time
      ? new Date(m.expiry_time) < new Date(Date.now() + 2 * 60 * 60 * 1000)
      : false,
    pickup: {
      org_name: m.donor_org,
      address: m.pickup_address,
      listing_title: m.listing_title,
      quantity: m.quantity ? Number(m.quantity) : null,
      quantity_unit: m.quantity_unit,
    },
    delivery: {
      org_name: null,
      address: m.delivery_address,
    },
    distance_km: m.est_distance_km ? parseFloat(m.est_distance_km) : null,
    est_duration_min: m.est_duration_min || null,
  }));

  return res.status(200).json({
    success: true,
    data: { missions },
    message: 'Active missions fetched successfully',
  });
});

// ============================================================================
// A5. PATCH /api/volunteer/missions/:mission_id/status
// ============================================================================
// Maps friendly client-facing names → DB enum values
const STATUS_ALIASES = {
  EN_ROUTE: 'in_transit',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  // lowercase passthrough
  in_transit: 'in_transit',
  picked_up: 'picked_up',
  delivered: 'delivered',
};

const VALID_TRANSITIONS = {
  assigned: 'in_transit',
  in_transit: 'picked_up',
  picked_up: 'delivered',
};

const updateMissionStatus = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { mission_id } = req.params;
  const { status: newStatus } = req.body;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  if (!newStatus) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'status is required',
    });
  }

  // Normalize: accept EN_ROUTE / PICKED_UP / DELIVERED or lowercase db values
  const normalizedStatus = STATUS_ALIASES[newStatus];
  if (!normalizedStatus) {
    return res.status(400).json({
      success: false,
      data: {},
      message: `Invalid status value "${newStatus}". Accepted: EN_ROUTE, PICKED_UP, DELIVERED`,
    });
  }

  // Fetch mission — must be owned by this volunteer
  const missionResult = await pool.query(
    `SELECT dm.mission_id, dm.status, dm.claim_id, dm.volunteer_id,
            c.listing_id, fl.donor_id
     FROM delivery_missions dm
     JOIN claims c         ON dm.claim_id  = c.claim_id
     JOIN food_listings fl ON c.listing_id = fl.listing_id
     WHERE dm.mission_id = $1`,
    [mission_id],
  );

  if (missionResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Mission not found',
    });
  }

  const mission = missionResult.rows[0];

  if (mission.volunteer_id !== volunteerId) {
    return res.status(403).json({
      success: false,
      data: {},
      message: 'You do not own this mission',
    });
  }

  // Validate transition
  const allowedNext = VALID_TRANSITIONS[mission.status];
  if (normalizedStatus !== allowedNext) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Invalid status transition',
    });
  }

  // --- Transaction for status update + side-effects ---
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (normalizedStatus === 'in_transit') {
      await client.query(
        `UPDATE delivery_missions SET status = 'in_transit', updated_at = NOW()
         WHERE mission_id = $1`,
        [mission_id],
      );
    }

    if (normalizedStatus === 'picked_up') {
      await client.query(
        `UPDATE delivery_missions
         SET status = 'picked_up', pickup_time = NOW(), updated_at = NOW()
         WHERE mission_id = $1`,
        [mission_id],
      );
      // claim_status_enum has no 'picked_up' — keep as 'approved'
      await client.query(
        `UPDATE food_listings SET status = 'in_transit', updated_at = NOW() WHERE listing_id = $1`,
        [mission.listing_id],
      );
    }

    if (normalizedStatus === 'delivered') {
      await client.query(
        `UPDATE delivery_missions
         SET status = 'delivered', delivery_time = NOW(),
             actual_duration_min = EXTRACT(EPOCH FROM (NOW() - pickup_time)) / 60,
             updated_at = NOW()
         WHERE mission_id = $1`,
        [mission_id],
      );
      await client.query(
        `UPDATE claims SET status = 'completed', updated_at = NOW() WHERE claim_id = $1`,
        [mission.claim_id],
      );
      await client.query(
        `UPDATE food_listings SET status = 'delivered', updated_at = NOW() WHERE listing_id = $1`,
        [mission.listing_id],
      );
      // Increment volunteer's total_deliveries
      await client.query(
        `UPDATE volunteer_profiles
         SET total_deliveries = total_deliveries + 1
         WHERE volunteer_id = $1`,
        [volunteerId],
      );
      // Fetch listing details for impact calculation
      const listingDetails = await client.query(
        `SELECT estimated_servings, quantity FROM food_listings WHERE listing_id = $1`,
        [mission.listing_id],
      );
      const servings = listingDetails.rows[0]?.estimated_servings || 0;
      const quantity = listingDetails.rows[0]?.quantity || 0;
      const co2Saved = parseFloat((quantity * 2.5).toFixed(2)); // ~2.5kg CO2 per kg food

      // Update impact_metrics for volunteer
      await client.query(
        `INSERT INTO impact_metrics (user_id, meals_saved, total_deliveries, co2_prevented_kg, waste_diverted_kg)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET total_deliveries = impact_metrics.total_deliveries + 1,
             meals_saved = impact_metrics.meals_saved + $2,
             co2_prevented_kg = impact_metrics.co2_prevented_kg + $3,
             waste_diverted_kg = impact_metrics.waste_diverted_kg + $4`,
        [userId, servings, co2Saved, quantity],
      );
      // Update impact_metrics for donor
      await client.query(
        `INSERT INTO impact_metrics (user_id, meals_saved, total_deliveries, co2_prevented_kg, waste_diverted_kg)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET total_deliveries = impact_metrics.total_deliveries + 1,
             meals_saved = impact_metrics.meals_saved + $2,
             co2_prevented_kg = impact_metrics.co2_prevented_kg + $3,
             waste_diverted_kg = impact_metrics.waste_diverted_kg + $4`,
        [mission.donor_id, servings, co2Saved, quantity],
      );
    }

    await client.query('COMMIT');

    // ── Fire-and-forget: notify donor + recipient on DELIVERED ──
    if (normalizedStatus === 'delivered') {
      (async () => {
        try {
          // Get listing + claim details for notification messages
          const detailsResult = await pool.query(
            `SELECT fl.title AS listing_title, fl.donor_id, c.recipient_id,
                    o_donor.org_name AS donor_org, o_recip.org_name AS recipient_org
             FROM delivery_missions dm
             JOIN claims c ON dm.claim_id = c.claim_id
             JOIN food_listings fl ON c.listing_id = fl.listing_id
             LEFT JOIN organizations o_donor ON fl.donor_id = o_donor.user_id
             LEFT JOIN organizations o_recip ON c.recipient_id = o_recip.user_id
             WHERE dm.mission_id = $1`,
            [mission_id],
          );
          const d = detailsResult.rows[0];
          if (!d) return;

          // Notify DONOR
          createNotification({
            userId: d.donor_id,
            type: 'FOOD_DELIVERED',
            title: 'Your food was delivered!',
            message: `${d.listing_title} was successfully delivered to ${d.recipient_org || 'the recipient'}`,
          });

          // Notify RECIPIENT
          createNotification({
            userId: d.recipient_id,
            type: 'FOOD_DELIVERED',
            title: 'Food delivery complete',
            message: `Your food from ${d.donor_org || 'the donor'} has arrived. Please confirm receipt.`,
          });

          // Email both — fire and forget
          sendNotificationEmail(d.donor_id, {
            subject: 'Your food was delivered!',
            title: 'Your food was delivered!',
            message: `${d.listing_title} was successfully delivered to ${d.recipient_org || 'the recipient'}. Thank you for your donation!`,
          });

          sendNotificationEmail(d.recipient_id, {
            subject: 'Food delivery complete',
            title: 'Food delivery complete',
            message: `Your food from ${d.donor_org || 'the donor'} has arrived. Please log in to confirm receipt and leave a review.`,
          });
        } catch (err) {
          console.error('⚠️  Notification hook (DELIVERED) failed:', err.message);
        }
      })();
    }

    return res.status(200).json({
      success: true,
      data: { mission_id, status: newStatus },
      message: `Mission status updated to ${newStatus}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// A6. GET /api/volunteer/schedule
// ============================================================================
const getSchedule = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  const result = await pool.query(
    `SELECT availability_id, day_of_week, start_time, end_time
     FROM volunteer_availability
     WHERE volunteer_id = $1
     ORDER BY day_of_week ASC, start_time ASC`,
    [volunteerId],
  );

  // Group by day_of_week
  const scheduleMap = {};
  for (let d = 0; d <= 6; d++) {
    scheduleMap[d] = { day_of_week: d, day_name: DAY_NAMES[d], slots: [] };
  }

  for (const row of result.rows) {
    const day = row.day_of_week;
    scheduleMap[day].slots.push({
      availability_id: row.availability_id,
      start_time: row.start_time?.slice(0, 5), // "HH:MM"
      end_time: row.end_time?.slice(0, 5),
    });
  }

  return res.status(200).json({
    success: true,
    data: { schedule: Object.values(scheduleMap) },
    message: 'Schedule fetched successfully',
  });
});

// ============================================================================
// A6. PUT /api/volunteer/schedule
// ============================================================================
const updateSchedule = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { day_of_week, slots } = req.body;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  if (day_of_week === undefined || day_of_week === null || day_of_week < 0 || day_of_week > 6) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'day_of_week is required and must be between 0 (Mon) and 6 (Sun)',
    });
  }

  if (!Array.isArray(slots)) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'slots must be an array',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing slots for this day
    await client.query(
      `DELETE FROM volunteer_availability
       WHERE volunteer_id = $1 AND day_of_week = $2`,
      [volunteerId, day_of_week],
    );

    // Insert new slots
    for (const slot of slots) {
      if (!slot.start_time || !slot.end_time) continue;
      await client.query(
        `INSERT INTO volunteer_availability (volunteer_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [volunteerId, day_of_week, slot.start_time, slot.end_time],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Return the full updated schedule (reuse getSchedule logic)
  const result = await pool.query(
    `SELECT availability_id, day_of_week, start_time, end_time
     FROM volunteer_availability
     WHERE volunteer_id = $1
     ORDER BY day_of_week ASC, start_time ASC`,
    [volunteerId],
  );

  const scheduleMap = {};
  for (let d = 0; d <= 6; d++) {
    scheduleMap[d] = { day_of_week: d, day_name: DAY_NAMES[d], slots: [] };
  }
  for (const row of result.rows) {
    scheduleMap[row.day_of_week].slots.push({
      availability_id: row.availability_id,
      start_time: row.start_time?.slice(0, 5),
      end_time: row.end_time?.slice(0, 5),
    });
  }

  return res.status(200).json({
    success: true,
    data: { schedule: Object.values(scheduleMap) },
    message: 'Schedule updated successfully',
  });
});

// ============================================================================
// A7. GET /api/volunteer/leaderboard
// ============================================================================
const getLeaderboard = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `SELECT
       vp.user_id,
       u.first_name || ' ' || LEFT(u.last_name, 1) || '.' AS name,
       vp.total_deliveries,
       (vp.total_deliveries * 25) AS points,
       ROW_NUMBER() OVER (ORDER BY vp.total_deliveries DESC) AS rank
     FROM volunteer_profiles vp
     JOIN users u ON vp.user_id = u.user_id
     ORDER BY points DESC`,
  );

  const allRankings = result.rows.map((r) => ({
    rank: parseInt(r.rank, 10),
    name: r.user_id === userId ? 'You' : r.name,
    points: parseInt(r.points, 10),
    total_deliveries: r.total_deliveries,
    is_current_user: r.user_id === userId,
  }));

  // Top 3 for podium
  const top3 = allRankings.slice(0, 3).map(({ is_current_user, ...rest }) => rest);

  // Top 10 for rankings
  const rankings = allRankings.slice(0, 10).map(({ is_current_user, ...rest }) => rest);

  // Current user's rank
  const myEntry = allRankings.find((r) => r.is_current_user);
  const myRank = myEntry ? myEntry.rank : null;

  return res.status(200).json({
    success: true,
    data: {
      top3,
      rankings,
      my_rank: myRank,
    },
    message: 'Leaderboard fetched successfully',
  });
});

// ============================================================================
// B2. PATCH /api/volunteer/location
// ============================================================================
const updateLocation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude } = req.body;
  const volunteerId = await getVolunteerId(userId);

  if (!volunteerId) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Volunteer profile not found',
    });
  }

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'latitude and longitude are required',
    });
  }

  // Update location in volunteer_profiles
  await pool.query(
    `UPDATE volunteer_profiles
     SET current_latitude = $1, current_longitude = $2
     WHERE volunteer_id = $3`,
    [latitude, longitude, volunteerId],
  );

  // Find next active mission's pickup address
  const nextMission = await pool.query(
    `SELECT
       o_donor.org_name AS next_stop_name,
       a.latitude  AS pickup_lat,
       a.longitude AS pickup_lng
     FROM delivery_missions dm
     JOIN claims c         ON dm.claim_id  = c.claim_id
     JOIN food_listings fl ON c.listing_id = fl.listing_id
     JOIN addresses a      ON fl.address_id = a.address_id
     LEFT JOIN organizations o_donor ON fl.donor_id = o_donor.user_id
     WHERE dm.volunteer_id = $1
       AND dm.status IN ('assigned', 'in_transit')
     ORDER BY dm.created_at ASC
     LIMIT 1`,
    [volunteerId],
  );

  let nextStop = null;
  let etaMin = null;

  if (nextMission.rows.length > 0) {
    const nm = nextMission.rows[0];
    nextStop = nm.next_stop_name || 'Next Pickup';

    if (nm.pickup_lat && nm.pickup_lng) {
      try {
        const dist = await getDistance(
          { lat: parseFloat(latitude), lng: parseFloat(longitude) },
          { lat: parseFloat(nm.pickup_lat), lng: parseFloat(nm.pickup_lng) },
        );
        etaMin = dist.duration_min;
      } catch (err) {
        console.error('Distance calc failed for location update:', err.message);
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      location_updated: true,
      next_stop: nextStop,
      eta_min: etaMin,
    },
    message: 'Location updated successfully',
  });
});

module.exports = {
  getDashboard,
  getAvailableMissions,
  acceptMission,
  getActiveMissions,
  updateMissionStatus,
  getSchedule,
  updateSchedule,
  getLeaderboard,
  updateLocation,
};
