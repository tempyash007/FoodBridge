const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ============================================================================
// GET /api/donor/dashboard
// ============================================================================
// ============================================================================
// GET /api/donor/dashboard
// ============================================================================
const getDashboard = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;

  // Auto-expire listings for this donor before fetching stats
  await pool.query(
    `UPDATE food_listings
     SET status = 'expired', updated_at = NOW()
     WHERE donor_id = $1
       AND status = 'available'
       AND expiry_time < NOW()`,
    [donorId]
  );

  // 1. Stats — computed live from actual deliveries (source of truth)
  const statsResult = await pool.query(
    `SELECT
     COALESCE(SUM(COALESCE(fl.estimated_servings, ROUND(fl.quantity * 2)::int)), 0) AS meals_saved,
     COALESCE(SUM(fl.quantity * 2.5), 0) AS co2_prevented_kg,
     COALESCE(SUM(fl.quantity), 0)       AS waste_diverted_kg
   FROM food_listings fl
   JOIN claims c ON fl.listing_id = c.listing_id
   JOIN delivery_missions dm ON c.claim_id = dm.claim_id
   WHERE fl.donor_id = $1
     AND dm.status = 'delivered'`,
    [donorId]
  );
  const metrics = statsResult.rows[0] || {
    meals_saved: 0, co2_prevented_kg: 0, waste_diverted_kg: 0,
  };

  // Count active (available) listings
  const activeCountResult = await pool.query(
    `SELECT COUNT(*) FROM food_listings
     WHERE donor_id = $1 AND status = 'available'`,
    [donorId]
  );

  const stats = {
    meals_saved: Number(metrics.meals_saved),
    co2_prevented_kg: Number(metrics.co2_prevented_kg),
    active_listings: parseInt(activeCountResult.rows[0].count, 10),
    waste_diverted_kg: Number(metrics.waste_diverted_kg),
  };

  // 2. Active listings with dietary tags
  const listingsResult = await pool.query(
    `SELECT
     fl.listing_id,
     fl.title,
     fl.estimated_servings,
     fl.quantity,
     fl.quantity_unit,
     fl.expiry_time,
     fl.status,
     li.image_url AS primary_image_url
   FROM food_listings fl
   LEFT JOIN listing_images li
     ON fl.listing_id = li.listing_id
     AND li.is_primary = true
   WHERE fl.donor_id = $1 AND fl.status = 'available'
   ORDER BY fl.created_at DESC`,
    [donorId]
  );

  // Fetch dietary tags for all active listings
  const listingIds = listingsResult.rows.map((l) => l.listing_id);
  let tagsMap = {};
  if (listingIds.length > 0) {
    const tagsResult = await pool.query(
      `SELECT ldt.listing_id, dt.name
       FROM listing_dietary_tags ldt
       JOIN dietary_tags dt ON ldt.tag_id = dt.tag_id
       WHERE ldt.listing_id = ANY($1::uuid[])`,
      [listingIds]
    );
    tagsResult.rows.forEach((row) => {
      if (!tagsMap[row.listing_id]) tagsMap[row.listing_id] = [];
      tagsMap[row.listing_id].push(row.name);
    });
  }

  const active_listings = listingsResult.rows.map((l) => ({
    ...l,
    dietary_tags: tagsMap[l.listing_id] || [],
  }));

  // 3. Pickup requests — missions that are active for this donor's listings
  const pickupResult = await pool.query(
    `SELECT
     u.first_name || ' ' || LEFT(u.last_name, 1) || '.' AS volunteer_name,
     fl.title AS listing_title,
     dm.est_duration_min,
     dm.status AS mission_status
   FROM food_listings fl
   JOIN claims c ON fl.listing_id = c.listing_id
   JOIN delivery_missions dm ON c.claim_id = dm.claim_id
   JOIN volunteer_profiles vp ON dm.volunteer_id = vp.volunteer_id
   JOIN users u ON vp.user_id = u.user_id
   WHERE fl.donor_id = $1
     AND dm.status IN ('assigned', 'in_transit', 'picked_up')
   ORDER BY dm.pickup_time ASC`,
    [donorId]
  );

  return res.status(200).json({
    success: true,
    data: {
      stats,
      active_listings,
      pickup_requests: pickupResult.rows,
    },
    message: 'Dashboard loaded successfully',
  });
});

// ============================================================================
// GET /api/donor/history
// ============================================================================
const getHistory = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT
   fl.title AS listing_title,
   fl.created_at::date AS date,
   fl.quantity,
   fl.quantity_unit,
   o.org_name AS recipient_org,
   u.first_name || ' ' || LEFT(u.last_name,1) || '.' AS volunteer_name
FROM food_listings fl
LEFT JOIN claims c ON fl.listing_id = c.listing_id
LEFT JOIN organizations o ON c.recipient_id = o.user_id
LEFT JOIN delivery_missions dm ON c.claim_id = dm.claim_id
LEFT JOIN volunteer_profiles vp ON dm.volunteer_id = vp.volunteer_id
LEFT JOIN users u ON vp.user_id = u.user_id
WHERE fl.donor_id = $1 AND fl.status = 'delivered'
ORDER BY fl.created_at DESC
LIMIT $2 OFFSET $3`,
    [donorId, Number(limit), offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM food_listings
     WHERE donor_id = $1 AND status = 'delivered'`,
    [donorId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  return res.status(200).json({
    success: true,
    data: {
      history: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
    message: 'Donation history fetched successfully',
  });
});

// ============================================================================
// GET /api/donor/history/export  (CSV)
// ============================================================================
const exportHistory = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;

  const result = await pool.query(
    `SELECT
       fl.title AS listing_title,
       fl.created_at::date AS date,
       fl.quantity,
       fl.quantity_unit,
       o.org_name AS recipient_org,
       r.rating
     FROM food_listings fl
     LEFT JOIN claims c ON fl.listing_id = c.listing_id
     LEFT JOIN organizations o ON c.recipient_id = o.user_id
     LEFT JOIN delivery_missions dm ON c.claim_id = dm.claim_id
     LEFT JOIN reviews r ON dm.mission_id = r.mission_id AND r.reviewer_id = $1
     WHERE fl.donor_id = $1 AND fl.status = 'delivered'
     ORDER BY fl.created_at DESC`,
    [donorId]
  );

  // Build CSV
  const header = 'Listing Title,Date,Quantity,Unit,Recipient Org,Rating';
  const rows = result.rows.map((r) =>
    [
      `"${(r.listing_title || '').replace(/"/g, '""')}"`,
      r.date || '',
      r.quantity || '',
      r.quantity_unit || '',
      `"${(r.recipient_org || '').replace(/"/g, '""')}"`,
      r.rating ?? '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=donation_history.csv');
  return res.status(200).send(csv);
});

// ============================================================================
// GET /api/donor/impact
// ============================================================================
const getImpact = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;

  // 1. Totals — computed live from actual delivered missions
  // 1. Totals — computed live from actual delivered missions
  const totalsResult = await pool.query(
    `SELECT
     COALESCE(SUM(COALESCE(fl.estimated_servings, ROUND(fl.quantity * 2)::int)), 0) AS meals_saved,
     COALESCE(SUM(fl.quantity * 2.5), 0) AS co2_prevented_kg,
     COALESCE(SUM(fl.quantity), 0)        AS waste_diverted_kg
   FROM food_listings fl
   JOIN claims c ON fl.listing_id = c.listing_id
   JOIN delivery_missions dm ON c.claim_id = dm.claim_id
   WHERE fl.donor_id = $1
     AND dm.status = 'delivered'`,
    [donorId]
  );
  const totals = totalsResult.rows[0] || {
    meals_saved: 0, co2_prevented_kg: 0, waste_diverted_kg: 0,
  };

  // 2. Weekly trend — last 7 days, group by day
  const trendResult = await pool.query(
    `WITH days AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS date
    )
    SELECT
      TO_CHAR(days.date, 'Dy') AS day,
      days.date,
      COALESCE(SUM(COALESCE(fl.estimated_servings, ROUND(fl.quantity * 2)::int)), 0) AS meals_saved,
      COALESCE(SUM(fl.quantity), 0) AS waste_diverted_kg
    FROM days
    LEFT JOIN delivery_missions dm
      ON dm.delivery_time::date = days.date
      AND dm.status = 'delivered'
    LEFT JOIN claims c ON dm.claim_id = c.claim_id
    LEFT JOIN food_listings fl
      ON c.listing_id = fl.listing_id
      AND fl.donor_id = $1
    GROUP BY days.date
    ORDER BY days.date ASC`,
    [donorId]
  );

  return res.status(200).json({
    success: true,
    data: {
      totals: {
        meals_saved: Number(totals.meals_saved),
        co2_prevented_kg: Number(totals.co2_prevented_kg),
        waste_diverted_kg: Number(totals.waste_diverted_kg),
      },
      weekly_trend: trendResult.rows.map((r) => ({
        day: r.day,
        meals_saved: Number(r.meals_saved),
        waste_diverted_kg: Number(r.waste_diverted_kg),
      })),
    },
    message: 'Impact data loaded successfully',
  });
});

module.exports = { getDashboard, getHistory, exportHistory, getImpact };
