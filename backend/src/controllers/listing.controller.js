const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const invalidateCache = require('../utils/invalidateCache');
const { createBulkNotifications } = require('../services/notification.service');

// ---------------------------------------------------------------------------
// Helper — auto-expire ACTIVE listings whose expiry_time has passed
// ---------------------------------------------------------------------------
const autoExpire = async (listingIds) => {
  if (!listingIds || listingIds.length === 0) return;
  await pool.query(
    `UPDATE food_listings
     SET status = 'expired', updated_at = NOW()
     WHERE listing_id = ANY($1::uuid[])
       AND status = 'available'
       AND expiry_time < NOW()`,
    [listingIds]
  );
};

// ---------------------------------------------------------------------------
// POST /api/listings  (DONOR only)
// ---------------------------------------------------------------------------
const createListing = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;

  const {
    title, description, quantity, quantity_unit,
    estimated_servings, expiry_time, pickup_start, pickup_end,
    category_id, image_urls,
    // address fields
    street_address, city, state, postal_code, country,
    latitude, longitude,
  } = req.body;

  // --- Validation ---
  if (!title || title.trim() === '') {
    return res.status(400).json({ success: false, data: {}, message: 'Title is required' });
  }
  if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
    return res.status(400).json({ success: false, data: {}, message: 'Quantity must be a positive number' });
  }
  if (!expiry_time || new Date(expiry_time) <= new Date()) {
    return res.status(400).json({ success: false, data: {}, message: 'expiry_time must be in the future' });
  }
  if (!pickup_start || !pickup_end) {
    return res.status(400).json({ success: false, data: {}, message: 'pickup_start and pickup_end are required' });
  }
  if (new Date(pickup_end) <= new Date(pickup_start)) {
    return res.status(400).json({ success: false, data: {}, message: 'pickup_end must be after pickup_start' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert address
    const addrResult = await client.query(
      `INSERT INTO addresses (street_address, city, state, postal_code, country, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [street_address, city, state, postal_code, country, latitude || null, longitude || null]
    );
    const address = addrResult.rows[0];

    // 2. Insert listing
    const listingResult = await client.query(
      `INSERT INTO food_listings
         (donor_id, category_id, address_id, title, description, quantity, quantity_unit,
          estimated_servings, expiry_time, pickup_start, pickup_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available')
       RETURNING *`,
      [
        donorId, category_id || null, address.address_id,
        title, description || null, quantity, quantity_unit,
        estimated_servings || null, expiry_time, pickup_start, pickup_end,
      ]
    );
    const listing = listingResult.rows[0];

    // 3. Insert images
    const images = [];
    if (Array.isArray(image_urls) && image_urls.length > 0) {
      for (let i = 0; i < image_urls.length; i++) {
        const imgResult = await client.query(
          `INSERT INTO listing_images (listing_id, image_url, is_primary, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [listing.listing_id, image_urls[i], i === 0, i]
        );
        images.push(imgResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    // Invalidate listing caches
    await invalidateCache('GET /api/listings*');
    await invalidateCache('GET /api/recipient/browse*');

    // ── Fire-and-forget: notify all recipients about the new listing ──
    (async () => {
      try {
        // Get donor org_name
        const orgResult = await pool.query(
          `SELECT org_name FROM organizations WHERE user_id = $1`,
          [donorId],
        );
        const orgName = orgResult.rows[0]?.org_name || 'A donor';

        // Get all active recipients
        const recipientsResult = await pool.query(
          `SELECT user_id FROM users WHERE role = 'recipient' AND is_active = true`,
        );
        const recipientIds = recipientsResult.rows.map((r) => r.user_id);

        if (recipientIds.length > 0) {
          createBulkNotifications(recipientIds, {
            type: 'NEW_LISTING',
            title: 'New food listing near you',
            message: `${orgName} just listed ${title} (${quantity} ${quantity_unit})`,
          });
        }
      } catch (err) {
        console.error('⚠️  Notification hook (createListing) failed:', err.message);
      }
    })();

    return res.status(201).json({
      success: true,
      data: { listing, address, images },
      message: 'Listing created successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/listings  (any logged-in)
// ---------------------------------------------------------------------------
const getListings = asyncHandler(async (req, res) => {
  const { city, category_id, status = 'available', page = 1, limit = 10 } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  const conditions = [];

  // Build dynamic WHERE
  conditions.push(`fl.status = $${params.push(status.toLowerCase())}`);

  if (city) {
    conditions.push(`LOWER(a.city) = LOWER($${params.push(city)})`);
  }
  if (category_id) {
    conditions.push(`fl.category_id = $${params.push(category_id)}::uuid`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Fetch listings with address + primary image + category name
  const listingsResult = await pool.query(
    `SELECT
       fl.*,
       a.street_address, a.city, a.state, a.postal_code, a.country, a.latitude, a.longitude,
       fc.name AS category_name,
       li.image_url AS primary_image_url
     FROM food_listings fl
     JOIN addresses a ON fl.address_id = a.address_id
     LEFT JOIN food_categories fc ON fl.category_id = fc.category_id
     LEFT JOIN listing_images li ON fl.listing_id = li.listing_id AND li.is_primary = true
     ${whereClause}
     ORDER BY fl.created_at DESC
     LIMIT $${params.push(Number(limit))} OFFSET $${params.push(offset)}`,
    params
  );

  // Auto-expire any listings that should have expired
  const ids = listingsResult.rows.map((r) => r.listing_id);
  await autoExpire(ids);

  // Patch the in-memory array so the response reflects the updated status
  listingsResult.rows.forEach((r) => {
    if (r.status === 'available' && new Date(r.expiry_time) < new Date()) {
      r.status = 'expired';
    }
  });

  // Count total for pagination
  const countParams = params.slice(0, params.length - 2); // strip LIMIT/OFFSET
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM food_listings fl
     JOIN addresses a ON fl.address_id = a.address_id
     ${whereClause}`,
    countParams
  );
  const total = parseInt(countResult.rows[0].count, 10);

  return res.status(200).json({
    success: true,
    data: {
      listings: listingsResult.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
    message: 'Listings fetched successfully',
  });
});

// ---------------------------------------------------------------------------
// GET /api/listings/my  (DONOR only)
// ---------------------------------------------------------------------------
const getMyListings = asyncHandler(async (req, res) => {
  const donorId = req.user.userId;

  const result = await pool.query(
    `SELECT
       fl.*,
       a.street_address, a.city, a.state, a.postal_code, a.country, a.latitude, a.longitude,
       fc.name AS category_name,
       li.image_url AS primary_image_url
     FROM food_listings fl
     JOIN addresses a ON fl.address_id = a.address_id
     LEFT JOIN food_categories fc ON fl.category_id = fc.category_id
     LEFT JOIN listing_images li ON fl.listing_id = li.listing_id AND li.is_primary = true
     WHERE fl.donor_id = $1
     ORDER BY fl.created_at DESC`,
    [donorId]
  );

  // Auto-expire
  const ids = result.rows.map((r) => r.listing_id);
  await autoExpire(ids);

  // Patch the in-memory array so the response reflects the updated status
  result.rows.forEach((r) => {
    if (r.status === 'available' && new Date(r.expiry_time) < new Date()) {
      r.status = 'expired';
    }
  });

  return res.status(200).json({
    success: true,
    data: { listings: result.rows },
    message: 'Your listings fetched successfully',
  });
});

// ---------------------------------------------------------------------------
// GET /api/listings/:id  (any logged-in)
// ---------------------------------------------------------------------------
const getListingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT
       fl.*,
       a.street_address, a.city, a.state, a.postal_code, a.country, a.latitude, a.longitude,
       fc.name AS category_name, fc.icon_url AS category_icon
     FROM food_listings fl
     JOIN addresses a ON fl.address_id = a.address_id
     LEFT JOIN food_categories fc ON fl.category_id = fc.category_id
     WHERE fl.listing_id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, data: {}, message: 'Listing not found' });
  }

  const listing = result.rows[0];

  // Auto-expire
  await autoExpire([listing.listing_id]);

  if (listing.status === 'available' && new Date(listing.expiry_time) < new Date()) {
    listing.status = 'expired';
  }

  // Fetch all images
  const imagesResult = await pool.query(
    `SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY sort_order ASC`,
    [id]
  );

  return res.status(200).json({
    success: true,
    data: { listing, images: imagesResult.rows },
    message: 'Listing fetched successfully',
  });
});

// ---------------------------------------------------------------------------
// PUT /api/listings/:id  (DONOR, owner only)
// ---------------------------------------------------------------------------
const updateListing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const donorId = req.user.userId;

  // Ownership check
  const existing = await pool.query(
    'SELECT * FROM food_listings WHERE listing_id = $1',
    [id]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ success: false, data: {}, message: 'Listing not found' });
  }
  if (existing.rows[0].donor_id !== donorId) {
    return res.status(403).json({ success: false, data: {}, message: 'You are not the owner of this listing' });
  }

  const {
    title, description, quantity, quantity_unit,
    estimated_servings, expiry_time, pickup_start, pickup_end,
    category_id, status,
  } = req.body;

  // Validate only the fields provided
  if (quantity !== undefined && (isNaN(quantity) || Number(quantity) <= 0)) {
    return res.status(400).json({ success: false, data: {}, message: 'Quantity must be a positive number' });
  }
  if (expiry_time !== undefined && new Date(expiry_time) <= new Date()) {
    return res.status(400).json({ success: false, data: {}, message: 'expiry_time must be in the future' });
  }
  if (pickup_start && pickup_end && new Date(pickup_end) <= new Date(pickup_start)) {
    return res.status(400).json({ success: false, data: {}, message: 'pickup_end must be after pickup_start' });
  }

  const result = await pool.query(
    `UPDATE food_listings SET
       title              = COALESCE($1, title),
       description        = COALESCE($2, description),
       quantity           = COALESCE($3, quantity),
       quantity_unit      = COALESCE($4, quantity_unit),
       estimated_servings = COALESCE($5, estimated_servings),
       expiry_time        = COALESCE($6, expiry_time),
       pickup_start       = COALESCE($7, pickup_start),
       pickup_end         = COALESCE($8, pickup_end),
       category_id        = COALESCE($9, category_id),
       status             = COALESCE($10, status),
       updated_at         = NOW()
     WHERE listing_id = $11
     RETURNING *`,
    [
      title || null, description || null,
      quantity !== undefined ? Number(quantity) : null,
      quantity_unit || null,
      estimated_servings !== undefined ? Number(estimated_servings) : null,
      expiry_time || null, pickup_start || null, pickup_end || null,
      category_id || null, status || null,
      id,
    ]
  );

  // Invalidate listing caches
  await invalidateCache('GET /api/listings*');
  await invalidateCache('GET /api/recipient/browse*');

  return res.status(200).json({
    success: true,
    data: { listing: result.rows[0] },
    message: 'Listing updated successfully',
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/listings/:id  (DONOR, owner only) — soft delete → CANCELLED
// ---------------------------------------------------------------------------
const deleteListing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const donorId = req.user.userId;

  // Ownership check
  const existing = await pool.query(
    'SELECT * FROM food_listings WHERE listing_id = $1',
    [id]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ success: false, data: {}, message: 'Listing not found' });
  }
  if (existing.rows[0].donor_id !== donorId) {
    return res.status(403).json({ success: false, data: {}, message: 'You are not the owner of this listing' });
  }

  const result = await pool.query(
    `UPDATE food_listings
     SET status = 'cancelled', updated_at = NOW()
     WHERE listing_id = $1
     RETURNING *`,
    [id]
  );

  // Invalidate listing caches
  await invalidateCache('GET /api/listings*');
  await invalidateCache('GET /api/recipient/browse*');

  return res.status(200).json({
    success: true,
    data: { listing: result.rows[0] },
    message: 'Listing cancelled successfully',
  });
});

module.exports = {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
};