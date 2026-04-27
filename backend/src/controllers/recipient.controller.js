const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification, sendNotificationEmail } = require('../services/notification.service');

// ============================================================================
// GET /api/recipient/browse
// Browse active food listings with location, filters, search & sorting
// ============================================================================
const browseListings = asyncHandler(async (req, res) => {
  const {
    lat,
    lng,
    radius_km = 5,
    category_id,
    dietary_tags,
    sort = 'expiring_soon',
    search,
    page = 1,
    limit = 10,
  } = req.query;

  // lat & lng are both optional — distance features are skipped when absent
  const hasLocation = lat != null && lng != null && lat !== '' && lng !== '';
  const latNum = hasLocation ? parseFloat(lat) : null;
  const lngNum = hasLocation ? parseFloat(lng) : null;
  const radiusNum = parseFloat(radius_km);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  // ---- Build dynamic WHERE conditions ----
  const params = hasLocation ? [latNum, lngNum] : [];
  const conditions = [
    `fl.status = 'available'`,
    `fl.expiry_time > NOW()`,
  ];

  // Haversine distance expression — only built when lat/lng are provided
  const haversine = hasLocation
    ? `(6371 * acos(
        LEAST(1.0, cos(radians($1)) * cos(radians(a.latitude)) *
        cos(radians(a.longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(a.latitude)))
      ))`
    : null;

  // Radius filter — only applied when location is present
  if (hasLocation) {
    conditions.push(`${haversine} <= $${params.push(radiusNum)}`);
  }

  // Category filter
  if (category_id) {
    conditions.push(`fl.category_id = $${params.push(category_id)}::uuid`);
  }

  // Search in title
  if (search) {
    conditions.push(`fl.title ILIKE $${params.push(`%${search}%`)}`);
  }

  // Dietary tags filter — listing must have ALL requested tags
  let dietaryTagNames = [];
  if (dietary_tags) {
    dietaryTagNames = dietary_tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (dietaryTagNames.length > 0) {
      const tagPlaceholders = dietaryTagNames
        .map((_, i) => `$${params.push(dietaryTagNames[i])}`)
        .join(', ');

      conditions.push(`(
        SELECT COUNT(DISTINCT dt.name)
        FROM listing_dietary_tags ldt
        JOIN dietary_tags dt ON ldt.tag_id = dt.tag_id
        WHERE ldt.listing_id = fl.listing_id
          AND dt.name IN (${tagPlaceholders})
      ) = ${dietaryTagNames.length}`);
    }
  }

  // ---- FIX 2: Exclude listings already claimed by this recipient ----
  conditions.push(
    `fl.listing_id NOT IN (
      SELECT listing_id FROM claims
      WHERE recipient_id = $${params.push(req.user.userId)}
      AND status != 'cancelled'
    )`
  );

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // ---- Sort mode ----
  const effectiveSort = (sort === 'nearest' && !hasLocation) ? 'expiring_soon' : sort;
  let orderClause;
  switch (effectiveSort) {
    case 'highest_rated':
      orderClause = `ORDER BY donor_avg_rating DESC NULLS LAST`;
      break;
    case 'nearest':
      orderClause = `ORDER BY distance_km ASC`;
      break;
    case 'expiring_soon':
    default:
      orderClause = `ORDER BY fl.expiry_time ASC`;
      break;
  }

  // ---- Main query ----
  const query = `
    SELECT
      fl.listing_id,
      fl.title,
      o.org_name AS donor_org,
      fl.quantity,
      fl.quantity_unit,
      fl.estimated_servings,
      fl.expiry_time,
      fl.pickup_start AS pickup_window_start,
      fl.pickup_end   AS pickup_window_end,
      EXTRACT(EPOCH FROM (fl.expiry_time - NOW())) / 60 AS minutes_until_expiry,
      ${hasLocation ? `${haversine} AS distance_km,` : `NULL AS distance_km,`}
      fc.name AS category,
      fl.status,
      (
        SELECT li.image_url
        FROM listing_images li
        WHERE li.listing_id = fl.listing_id
          AND li.is_primary = true
        LIMIT 1
      ) AS primary_image_url,
      (
        SELECT COALESCE(
          json_agg(dt.name ORDER BY dt.name),
          '[]'::json
        )
        FROM listing_dietary_tags ldt
        JOIN dietary_tags dt ON ldt.tag_id = dt.tag_id
        WHERE ldt.listing_id = fl.listing_id
      ) AS dietary_tags,
      (
        SELECT ROUND(AVG(r.rating), 2)
        FROM reviews r
        WHERE r.reviewee_id = fl.donor_id
      ) AS donor_avg_rating
    FROM food_listings fl
    JOIN addresses a ON fl.address_id = a.address_id
    LEFT JOIN organizations o ON fl.donor_id = o.user_id
    LEFT JOIN food_categories fc ON fl.category_id = fc.category_id
    ${whereClause}
    ${orderClause}
    LIMIT $${params.push(limitNum)} OFFSET $${params.push(offset)}
  `;

  const result = await pool.query(query, params);

  // ---- Count query (same filters, no LIMIT/OFFSET) ----
  const countParams = params.slice(0, params.length - 2);
  const countQuery = `
    SELECT COUNT(*) FROM food_listings fl
    JOIN addresses a ON fl.address_id = a.address_id
    LEFT JOIN organizations o ON fl.donor_id = o.user_id
    LEFT JOIN food_categories fc ON fl.category_id = fc.category_id
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);

  const listings = result.rows.map((row) => ({
    listing_id: row.listing_id,
    title: row.title,
    donor_org: row.donor_org,
    quantity: Number(row.quantity),
    quantity_unit: row.quantity_unit,
    estimated_servings: Number(row.estimated_servings),
    expiry_time: row.expiry_time,
    pickup_window_start: row.pickup_window_start || null,
    pickup_window_end: row.pickup_window_end || null,
    minutes_until_expiry: Math.round(Number(row.minutes_until_expiry)),
    distance_km: row.distance_km != null ? parseFloat(Number(row.distance_km).toFixed(1)) : null,
    category: row.category,
    dietary_tags: row.dietary_tags || [],
    status: row.status,
    primary_image_url: row.primary_image_url || null,
  }));

  return res.status(200).json({
    success: true,
    data: {
      total,
      ...(hasLocation && { radius_km: radiusNum }),
      listings,
    },
    message: 'Listings fetched successfully',
  });
});

// ============================================================================
// POST /api/recipient/claims
// Claim a food listing
// ============================================================================
const createClaim = asyncHandler(async (req, res) => {
  const recipientId = req.user.userId;
  const { listing_id, pickup_time, street_address, city, state, postal_code, country, latitude, longitude } = req.body;

  if (!listing_id || !pickup_time) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'listing_id and pickup_time are required',
    });
  }

  if (!street_address || !city || !state || !postal_code) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Delivery address fields are required: street_address, city, state, postal_code',
    });
  }

  // 1. Check listing exists and is available
  const listingResult = await pool.query(
    `SELECT listing_id, status FROM food_listings WHERE listing_id = $1`,
    [listing_id]
  );

  if (listingResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Listing not available',
    });
  }

  if (listingResult.rows[0].status !== 'available') {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Listing not available',
    });
  }

  // 2. Check for existing non-cancelled claim on this listing
  const existingClaim = await pool.query(
    `SELECT claim_id FROM claims
     WHERE listing_id = $1 AND status != 'cancelled'`,
    [listing_id]
  );

  if (existingClaim.rows.length > 0) {
    return res.status(409).json({
      success: false,
      data: {},
      message: 'Already claimed',
    });
  }

  // 3. Transaction: insert claim + update listing status
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert delivery address
    const addrResult = await client.query(
      `INSERT INTO addresses (street_address, city, state, postal_code, country, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING address_id`,
      [street_address, city, state, postal_code, country || 'India', latitude, longitude]
    );
    const deliveryAddressId = addrResult.rows[0].address_id;

    const claimResult = await client.query(
      `INSERT INTO claims (listing_id, recipient_id, pickup_time, status, delivery_address_id)
       VALUES ($1, $2, $3, 'approved', $4)
       RETURNING *`,
      [listing_id, recipientId, pickup_time, deliveryAddressId]
    );

    await client.query(
      `UPDATE food_listings SET status = 'reserved' WHERE listing_id = $1`,
      [listing_id]
    );

    await client.query('COMMIT');

    // ── Fire-and-forget: notify the DONOR about the claim ──
    (async () => {
      try {
        // Get donor_id and listing title
        const listingInfo = await pool.query(
          `SELECT fl.donor_id, fl.title AS listing_title
           FROM food_listings fl WHERE fl.listing_id = $1`,
          [listing_id],
        );
        const { donor_id, listing_title } = listingInfo.rows[0] || {};

        // Get recipient org name
        const orgResult = await pool.query(
          `SELECT org_name FROM organizations WHERE user_id = $1`,
          [recipientId],
        );
        const recipientOrg = orgResult.rows[0]?.org_name || 'A recipient';

        if (donor_id) {
          createNotification({
            userId: donor_id,
            type: 'CLAIM_RECEIVED',
            title: 'Someone claimed your listing',
            message: `${recipientOrg} claimed ${listing_title}`,
          });

          sendNotificationEmail(donor_id, {
            subject: 'Someone claimed your listing',
            title: 'Someone claimed your listing',
            message: `${recipientOrg} claimed your listing "${listing_title}". Log in to FoodBridge to see details.`,
          });
        }
      } catch (err) {
        console.error('⚠️  Notification hook (createClaim) failed:', err.message);
      }
    })();

    return res.status(201).json({
      success: true,
      data: { claim: claimResult.rows[0] },
      message: 'Listing claimed successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /api/recipient/claims
// Get all claims for the logged-in recipient (sidebar panel)
// ============================================================================
const getMyClaims = asyncHandler(async (req, res) => {
  const recipientId = req.user.userId;

  // AFTER
  const result = await pool.query(
    `SELECT
       c.claim_id,
       fl.listing_id,
       fl.title AS listing_title,
       o.org_name AS donor_org,
       fl.quantity,
       fl.quantity_unit,
       c.status AS claim_status,
       c.pickup_time,
       dm.mission_id,
       dm.status AS mission_status,
       EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.mission_id = dm.mission_id
            AND r.reviewer_id = c.recipient_id
      ) AS has_reviewed,
       dm.est_duration_min,
       li.image_url AS primary_image_url,
       u.first_name || ' ' || LEFT(u.last_name, 1) || '.' AS volunteer_name
     FROM claims c
     JOIN food_listings fl ON c.listing_id = fl.listing_id
     LEFT JOIN organizations o ON fl.donor_id = o.user_id
     LEFT JOIN listing_images li ON fl.listing_id = li.listing_id AND li.is_primary = true
     LEFT JOIN delivery_missions dm ON c.claim_id = dm.claim_id
     LEFT JOIN volunteer_profiles vp ON dm.volunteer_id = vp.volunteer_id
     LEFT JOIN users u ON vp.user_id = u.user_id
     WHERE c.recipient_id = $1
     ORDER BY c.created_at DESC`,
    [recipientId]
  );

  const claims = result.rows.map(row => ({
    ...row,
    has_reviewed: row.has_reviewed === true || row.has_reviewed === 't',
  }))

  return res.status(200).json({
    success: true,
    data: { claims },
    message: 'Claims fetched successfully',
  });
});

// ============================================================================
// DELETE /api/recipient/claims/:claim_id
// Cancel a pending claim — returns the listing to available
// ============================================================================
const cancelClaim = asyncHandler(async (req, res) => {
  const recipientId = req.user.userId;
  const { claim_id } = req.params;

  // 1. Verify claim exists and belongs to this recipient
  const claimResult = await pool.query(
    `SELECT claim_id, listing_id, status FROM claims
     WHERE claim_id = $1 AND recipient_id = $2`,
    [claim_id, recipientId]
  );

  if (claimResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Claim not found',
    });
  }

  const claim = claimResult.rows[0];

  // 2. Only allow cancellation of claims that haven't been picked up yet
  if (!['pending', 'approved'].includes(claim.status)) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Only pending or approved claims can be cancelled',
    });
  }

  // 3. Transaction: cancel claim + restore listing
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE claims SET status = 'cancelled', updated_at = NOW()
       WHERE claim_id = $1`,
      [claim_id]
    );

    await client.query(
      `UPDATE food_listings SET status = 'available'
       WHERE listing_id = $1`,
      [claim.listing_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      data: {},
      message: 'Claim cancelled successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// POST /api/recipient/reviews
// Submit a review for a volunteer after a delivery mission
// ============================================================================
const submitReview = asyncHandler(async (req, res) => {
  const reviewerId = req.user.userId;
  const { mission_id, rating, comment } = req.body;

  // --- Validation ---
  if (!mission_id) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'mission_id is required',
    });
  }

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Rating must be an integer between 1 and 5',
    });
  }

  // 1. Verify the mission exists and belongs to a claim owned by this recipient
  const missionResult = await pool.query(
    `SELECT dm.mission_id, dm.volunteer_id, vp.user_id AS volunteer_user_id
     FROM delivery_missions dm
     JOIN claims c ON dm.claim_id = c.claim_id
     JOIN volunteer_profiles vp ON dm.volunteer_id = vp.volunteer_id
     WHERE dm.mission_id = $1 AND c.recipient_id = $2`,
    [mission_id, reviewerId]
  );

  if (missionResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Mission not found or does not belong to your claims',
    });
  }

  const { volunteer_user_id } = missionResult.rows[0];

  // 2. Check for duplicate review
  const existingReview = await pool.query(
    `SELECT review_id FROM reviews
     WHERE mission_id = $1 AND reviewer_id = $2`,
    [mission_id, reviewerId]
  );

  if (existingReview.rows.length > 0) {
    return res.status(409).json({
      success: false,
      data: {},
      message: 'You have already reviewed this mission',
    });
  }

  // 3. Insert review
  const reviewResult = await pool.query(
    `INSERT INTO reviews (reviewer_id, reviewee_id, mission_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [reviewerId, volunteer_user_id, mission_id, rating, comment || null]
  );

  await pool.query(
    `UPDATE volunteer_profiles
     SET avg_rating = (
       SELECT ROUND(AVG(r.rating)::numeric, 2)
       FROM reviews r
       JOIN delivery_missions dm ON dm.mission_id = r.mission_id
       WHERE dm.volunteer_id = volunteer_profiles.volunteer_id
     )
     WHERE user_id = $1`,
    [volunteer_user_id]
  );

  // ── Fire-and-forget: notify the VOLUNTEER about the review ──
  (async () => {
    try {
      // Get reviewer org name
      const orgResult = await pool.query(
        `SELECT org_name FROM organizations WHERE user_id = $1`,
        [reviewerId],
      );
      const reviewerOrg = orgResult.rows[0]?.org_name || 'A user';

      createNotification({
        userId: volunteer_user_id,
        type: 'REVIEW_RECEIVED',
        title: 'You received a new review',
        message: `${reviewerOrg} gave you ${rating} stars`,
      });
    } catch (err) {
      console.error('⚠️  Notification hook (submitReview) failed:', err.message);
    }
  })();

  return res.status(201).json({
    success: true,
    data: { review: reviewResult.rows[0] },
    message: 'Review submitted successfully',
  });
});

module.exports = {
  browseListings,
  createClaim,
  getMyClaims,
  cancelClaim,
  submitReview,
};