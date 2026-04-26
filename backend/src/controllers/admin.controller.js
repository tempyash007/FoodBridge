const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const invalidateCache = require('../utils/invalidateCache');
const { createNotification, sendNotificationEmail, createBulkNotifications } = require('../services/notification.service');

// ============================================================================
// 1. GET /api/admin/overview — System Overview
// ============================================================================
const getOverview = asyncHandler(async (req, res) => {
  // --- Stats ---
  const statsQuery = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users)                                                    AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE created_at >= DATE_TRUNC('week', NOW()))      AS users_this_week,
      (SELECT COUNT(*)::int FROM food_listings WHERE status = 'available')                 AS active_listings,
      (SELECT COUNT(*)::int FROM food_listings WHERE created_at::date = CURRENT_DATE)      AS listings_today,
      (SELECT COUNT(*)::int FROM delivery_missions
         WHERE delivery_time::date = CURRENT_DATE AND status = 'delivered')                AS deliveries_today,
      (SELECT COUNT(*)::int FROM delivery_missions
         WHERE delivery_time::date = CURRENT_DATE - INTERVAL '1 day'
           AND status = 'delivered')                                                       AS deliveries_yesterday,
      (SELECT COALESCE(SUM(meals_saved), 0)::int FROM impact_metrics)                     AS meals_rescued,
      (SELECT COALESCE(SUM(im.meals_saved), 0)::int
         FROM impact_metrics im
         JOIN users u ON im.user_id = u.user_id
         WHERE u.created_at >= DATE_TRUNC('week', NOW()))                                  AS meals_this_week_approx
  `);

  const s = statsQuery.rows[0];
  const deliveriesToday = s.deliveries_today || 0;
  const deliveriesYesterday = s.deliveries_yesterday || 0;
  const deliveriesVsYesterdayPct = deliveriesYesterday === 0
    ? (deliveriesToday > 0 ? 100 : 0)
    : Math.round(((deliveriesToday - deliveriesYesterday) / deliveriesYesterday) * 100);

  // meals_this_week — count from missions delivered this week
  const mealsWeekResult = await pool.query(`
    SELECT COALESCE(SUM(fl.estimated_servings), 0)::int AS meals
    FROM delivery_missions dm
    JOIN claims c ON dm.claim_id = c.claim_id
    JOIN food_listings fl ON c.listing_id = fl.listing_id
    WHERE dm.status = 'delivered'
      AND dm.delivery_time >= DATE_TRUNC('week', NOW())
  `);
  const mealsThisWeek = mealsWeekResult.rows[0].meals;

  // --- Weekly Activity (last 7 days) ---
  const weeklyResult = await pool.query(`
    WITH days AS (
      SELECT generate_series(
        (CURRENT_DATE - INTERVAL '6 days')::date,
        CURRENT_DATE::date,
        '1 day'::interval
      )::date AS day
    )
    SELECT
      TO_CHAR(d.day, 'Dy')                                                 AS day,
      COALESCE((SELECT COUNT(*)::int FROM users
                WHERE role = 'donor' AND created_at::date = d.day), 0)     AS donors,
      COALESCE((SELECT COUNT(*)::int FROM users
                WHERE role = 'recipient' AND created_at::date = d.day), 0) AS recipients,
      COALESCE((SELECT COUNT(*)::int FROM delivery_missions
                WHERE status = 'delivered'
                  AND delivery_time::date = d.day), 0)                     AS deliveries
    FROM days d
    ORDER BY d.day ASC
  `);

  // --- Live Activity (last 10 audit_logs) ---
  const liveResult = await pool.query(`
    SELECT
      al.action   AS type,
      COALESCE(
        CASE
          WHEN al.entity_type = 'user'         THEN u.first_name || ' ' || u.last_name
          WHEN al.entity_type = 'organization' THEN o.org_name
          WHEN al.entity_type = 'listing'      THEN fl.title
          ELSE al.action
        END,
        al.action
      ) AS message,
      al.created_at
    FROM audit_logs al
    LEFT JOIN users u            ON al.entity_type = 'user'         AND al.entity_id::uuid = u.user_id
    LEFT JOIN organizations o    ON al.entity_type = 'organization' AND al.entity_id::uuid = o.org_id
    LEFT JOIN food_listings fl   ON al.entity_type = 'listing'      AND al.entity_id::uuid = fl.listing_id
    ORDER BY al.created_at DESC
    LIMIT 10
  `);

  // --- Quick Stats ---
  const quickResult = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM organizations WHERE verification_status = 'pending') AS pending_verifications,
      (SELECT COUNT(*)::int FROM food_listings WHERE status = 'cancelled')            AS flagged_content
  `);

  const q = quickResult.rows[0];

  return res.status(200).json({
    success: true,
    data: {
      stats: {
        total_users: s.total_users,
        users_this_week: s.users_this_week,
        active_listings: s.active_listings,
        listings_today: s.listings_today,
        deliveries_today: deliveriesToday,
        deliveries_vs_yesterday_pct: deliveriesVsYesterdayPct,
        meals_rescued: s.meals_rescued,
        meals_this_week: mealsThisWeek,
      },
      weekly_activity: weeklyResult.rows,
      live_activity: liveResult.rows,
      quick_stats: {
        pending_verifications: q.pending_verifications,
        flagged_content: q.flagged_content,
        system_health: '99.9%',
      },
    },
    message: 'System overview loaded successfully',
  });
});

// ============================================================================
// 2. GET /api/admin/analytics — Platform Analytics
// ============================================================================
const getAnalytics = asyncHandler(async (_req, res) => {
  // --- Total Impact ---
  const impactResult = await pool.query(`
    SELECT
      COALESCE(SUM(meals_saved), 0)::int         AS meals_rescued,
      COALESCE(SUM(co2_prevented_kg), 0)          AS co2_saved_kg,
      COALESCE(SUM(waste_diverted_kg), 0)         AS waste_diverted_kg,
      COUNT(DISTINCT user_id)::int                AS active_users
    FROM impact_metrics
  `);
  const impact = impactResult.rows[0];
  const TARGET_MEALS = 67000;
  const targetPct = Math.round((impact.meals_rescued / TARGET_MEALS) * 100);

  // --- Performance Metrics ---
  // avg delivery time (this period = last 30 days vs previous 30 days)
  const perfResult = await pool.query(`
    WITH current_period AS (
      SELECT AVG(actual_duration_min) AS avg_time
      FROM delivery_missions
      WHERE status = 'delivered' AND delivery_time >= NOW() - INTERVAL '30 days'
    ),
    previous_period AS (
      SELECT AVG(actual_duration_min) AS avg_time
      FROM delivery_missions
      WHERE status = 'delivered'
        AND delivery_time >= NOW() - INTERVAL '60 days'
        AND delivery_time <  NOW() - INTERVAL '30 days'
    )
    SELECT
      COALESCE(c.avg_time, 0)   AS current_avg,
      COALESCE(p.avg_time, 0)   AS previous_avg
    FROM current_period c, previous_period p
  `);

  const currentAvg = Math.round(perfResult.rows[0].current_avg);
  const previousAvg = Math.round(perfResult.rows[0].previous_avg);
  const deliveryTimeChange = currentAvg - previousAvg;

  // listing success rate
  const successResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered
    FROM food_listings
    WHERE status IN ('available', 'reserved', 'assigned', 'in_transit', 'delivered', 'completed', 'expired', 'cancelled')
  `);
  const sr = successResult.rows[0];
  const listingSuccessRate = sr.total > 0
    ? Math.round((sr.delivered / sr.total) * 100)
    : 0;

  // user retention (active users this month vs last month)
  const retentionResult = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE is_active = true)  AS active_now,
      (SELECT COUNT(*)::int FROM users)                         AS total_users
  `);
  const ret = retentionResult.rows[0];
  const retentionPct = ret.total_users > 0
    ? Math.round((ret.active_now / ret.total_users) * 100)
    : 0;

  // waste reduction
  const wasteResult = await pool.query(`
    SELECT COALESCE(SUM(waste_diverted_kg), 0) AS total_diverted FROM impact_metrics
  `);
  const wasteReductionPct = wasteResult.rows[0].total_diverted > 0
    ? Math.round(Number(wasteResult.rows[0].total_diverted) / 100)
    : 0;

  // --- Heatmap ---
  const heatmapResult = await pool.query(`
    SELECT
      a.city,
      AVG(a.latitude::numeric)   AS lat,
      AVG(a.longitude::numeric)  AS lng,
      COUNT(fl.listing_id)::int  AS activity_count
    FROM food_listings fl
    JOIN addresses a ON fl.address_id = a.address_id
    WHERE a.city IS NOT NULL
    GROUP BY a.city
    ORDER BY activity_count DESC
  `);

  const heatmap = heatmapResult.rows.map((row) => {
    let level = 'low';
    if (row.activity_count >= 100) level = 'very_high';
    else if (row.activity_count >= 50) level = 'high';
    else if (row.activity_count >= 10) level = 'medium';
    return {
      city: row.city,
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null,
      activity_count: row.activity_count,
      level,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      total_impact: {
        meals_rescued: impact.meals_rescued,
        co2_saved_tons: parseFloat((Number(impact.co2_saved_kg) / 1000).toFixed(1)),
        waste_diverted_tons: parseFloat((Number(impact.waste_diverted_kg) / 1000).toFixed(1)),
        active_users: impact.active_users,
        target_pct: targetPct,
      },
      performance: {
        avg_delivery_time_min: currentAvg,
        delivery_time_change_min: deliveryTimeChange,
        user_retention_pct: retentionPct,
        retention_change_pct: 0,       // requires historical snapshots
        listing_success_rate_pct: listingSuccessRate,
        success_rate_change_pct: 0,    // requires historical snapshots
        waste_reduction_pct: wasteReductionPct,
        waste_reduction_change_pct: 0, // requires historical snapshots
      },
      heatmap,
      export_url: '/api/admin/analytics/export',
    },
    message: 'Platform analytics loaded successfully',
  });
});

// ============================================================================
// 2b. GET /api/admin/analytics/export — CSV export of all impact metrics
// ============================================================================
const exportAnalytics = asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      u.user_id,
      u.first_name || ' ' || u.last_name AS name,
      u.email,
      u.role,
      COALESCE(im.meals_saved, 0)        AS meals_saved,
      COALESCE(im.co2_prevented_kg, 0)   AS co2_prevented_kg,
      COALESCE(im.waste_diverted_kg, 0)  AS waste_diverted_kg,
      COALESCE(im.total_deliveries, 0)   AS total_deliveries
    FROM impact_metrics im
    JOIN users u ON im.user_id = u.user_id
    ORDER BY im.meals_saved DESC
  `);

  const header = 'User ID,Name,Email,Role,Meals Saved,CO2 Prevented (kg),Waste Diverted (kg),Total Deliveries';
  const rows = result.rows.map((r) =>
    [
      r.user_id,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      r.email,
      r.role,
      r.meals_saved,
      r.co2_prevented_kg,
      r.waste_diverted_kg,
      r.total_deliveries,
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=impact_metrics_export.csv');
  return res.status(200).send(csv);
});

// ============================================================================
// 3. GET /api/admin/verification — Pending Verifications
// ============================================================================
const getVerifications = asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      o.org_id,
      o.org_name,
      u.email,
      u.role,
      o.created_at AS submitted_at,
      o.verification_status
    FROM organizations o
    JOIN users u ON o.user_id = u.user_id
    WHERE o.verification_status = 'pending'
    ORDER BY o.created_at ASC
  `);

  return res.status(200).json({
    success: true,
    data: {
      pending_count: result.rows.length,
      verifications: result.rows,
    },
    message: 'Pending verifications fetched successfully',
  });
});

// ============================================================================
// 3b. PATCH /api/admin/verification/:org_id — Approve or Reject
// ============================================================================
const updateVerification = asyncHandler(async (req, res) => {
  const { org_id } = req.params;
  const { action } = req.body;
  const adminId = req.user.userId;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'action must be "approve" or "reject"',
    });
  }

  // Fetch org
  const orgResult = await pool.query(
    `SELECT org_id, user_id, verification_status FROM organizations WHERE org_id = $1`,
    [org_id],
  );

  if (orgResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Organization not found',
    });
  }

  const org = orgResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (action === 'approve') {
      await client.query(
        `UPDATE organizations SET verification_status = 'approved' WHERE org_id = $1`,
        [org_id],
      );
      await client.query(
        `UPDATE users SET is_verified = true WHERE user_id = $1`,
        [org.user_id],
      );
    } else {
      await client.query(
        `UPDATE organizations SET verification_status = 'rejected' WHERE org_id = $1`,
        [org_id],
      );
    }

    // Audit log
    const auditAction = action === 'approve' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED';
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'organization', $3, $4)`,
      [adminId, auditAction, org_id, JSON.stringify({ previous_status: org.verification_status })],
    );

    await client.query('COMMIT');

    // ── Fire-and-forget: notify the org owner ──
    (async () => {
      try {
        createNotification({
          userId: org.user_id,
          type: 'VERIFICATION',
          title: action === 'approve'
            ? 'Your organization is verified!'
            : 'Verification rejected',
          message: action === 'approve'
            ? 'You can now create listings on FoodBridge'
            : 'Your verification was rejected. Please contact support.',
        });

        sendNotificationEmail(org.user_id, {
          subject: action === 'approve'
            ? 'Your organization is verified!'
            : 'Verification rejected',
          title: action === 'approve'
            ? 'Your organization is verified!'
            : 'Verification rejected',
          message: action === 'approve'
            ? 'Congratulations! Your organization has been verified on FoodBridge. You can now create food listings and start making a difference.'
            : 'Unfortunately, your organization verification was rejected. Please contact support for more details.',
        });
      } catch (err) {
        console.error('⚠️  Notification hook (verification) failed:', err.message);
      }
    })();

    return res.status(200).json({
      success: true,
      data: { org_id, verification_status: action === 'approve' ? 'approved' : 'rejected' },
      message: `Organization ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// 4. GET /api/admin/moderation — Flagged Content
// ============================================================================
const getModeration = asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      fl.listing_id,
      fl.title,
      u.first_name || ' ' || u.last_name AS donor_name,
      fl.updated_at AS flagged_at
    FROM food_listings fl
    JOIN users u ON fl.donor_id = u.user_id
    WHERE fl.status = 'cancelled'
    ORDER BY fl.updated_at DESC
  `);

  const listings = result.rows.map((row) => ({
    listing_id: row.listing_id,
    title: row.title,
    donor_name: row.donor_name,
    reason: 'Cancelled / flagged by system',
    report_count: 0,
    flagged_at: row.flagged_at,
  }));

  return res.status(200).json({
    success: true,
    data: {
      flagged_count: listings.length,
      flagged_listings: listings,
    },
    message: 'Flagged content fetched successfully',
  });
});

// ============================================================================
// 4b. PATCH /api/admin/moderation/:listing_id — Dismiss or Remove
// ============================================================================
const updateModeration = asyncHandler(async (req, res) => {
  const { listing_id } = req.params;
  const { action } = req.body;
  const adminId = req.user.userId;

  if (!action || !['dismiss', 'remove'].includes(action)) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'action must be "dismiss" or "remove"',
    });
  }

  // Check listing exists
  const listingResult = await pool.query(
    `SELECT listing_id, status FROM food_listings WHERE listing_id = $1`,
    [listing_id],
  );

  if (listingResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Listing not found',
    });
  }

  const newStatus = action === 'dismiss' ? 'available' : 'cancelled';

  await pool.query(
    `UPDATE food_listings SET status = $1, updated_at = NOW() WHERE listing_id = $2`,
    [newStatus, listing_id],
  );

  // Audit log
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'listing', $3, $4)`,
    [
      adminId,
      action === 'dismiss' ? 'CONTENT_DISMISSED' : 'CONTENT_REMOVED',
      listing_id,
      JSON.stringify({ previous_status: listingResult.rows[0].status, new_status: newStatus }),
    ],
  );

  return res.status(200).json({
    success: true,
    data: { listing_id, status: newStatus },
    message: `Listing ${action === 'dismiss' ? 'dismissed (unflagged)' : 'removed'} successfully`,
  });
});

// ============================================================================
// 5. GET /api/admin/users — User Management
// ============================================================================
const getUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  // --- Role counts ---
  const countsResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE role = 'donor')::int                                AS donors,
      COUNT(*) FILTER (WHERE role = 'donor' AND is_verified = true)::int         AS donors_verified,
      COUNT(*) FILTER (WHERE role = 'recipient')::int                            AS recipients,
      COUNT(*) FILTER (WHERE role = 'recipient' AND is_verified = true)::int     AS recipients_verified,
      COUNT(*) FILTER (WHERE role = 'volunteer')::int                            AS volunteers,
      COUNT(*) FILTER (WHERE role = 'volunteer' AND is_verified = true)::int     AS volunteers_verified
    FROM users
  `);

  // --- Build dynamic WHERE ---
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(
      u.first_name ILIKE $${paramIdx}
      OR u.last_name ILIKE $${paramIdx}
      OR u.email ILIKE $${paramIdx}
    )`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (role) {
    conditions.push(`u.role = $${paramIdx}`);
    params.push(role);
    paramIdx++;
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  // Total count for pagination
  const countQuery = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users u ${whereClause}`,
    params,
  );
  const total = countQuery.rows[0].total;

  // Recent users
  const usersResult = await pool.query(
    `SELECT
       u.user_id,
       u.first_name || ' ' || u.last_name AS name,
       u.email,
       u.role,
       u.is_verified,
       u.is_active,
       u.created_at AS joined
     FROM users u
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limitNum, offset],
  );

  return res.status(200).json({
    success: true,
    data: {
      counts: countsResult.rows[0],
      recent_users: usersResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    message: 'Users fetched successfully',
  });
});

// ============================================================================
// 5b. PATCH /api/admin/users/:user_id — Suspend / Reactivate
// ============================================================================
const updateUser = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { is_active } = req.body;
  const adminId = req.user.userId;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'is_active (boolean) is required',
    });
  }

  // Check user exists
  const userResult = await pool.query(
    `SELECT user_id, is_active FROM users WHERE user_id = $1`,
    [user_id],
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'User not found',
    });
  }

  await pool.query(
    `UPDATE users SET is_active = $1 WHERE user_id = $2`,
    [is_active, user_id],
  );

  // Audit log
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'user', $3, $4)`,
    [
      adminId,
      is_active ? 'USER_REACTIVATED' : 'USER_SUSPENDED',
      user_id,
      JSON.stringify({ previous_is_active: userResult.rows[0].is_active }),
    ],
  );

  return res.status(200).json({
    success: true,
    data: { user_id, is_active },
    message: `User ${is_active ? 'reactivated' : 'suspended'} successfully`,
  });
});

// ============================================================================
// 6. GET /api/admin/categories — Food Categories
// ============================================================================
const getCategories = asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      fc.category_id,
      fc.name,
      fc.description,
      fc.icon_url,
      fc.is_active,
      COALESCE(COUNT(fl.listing_id), 0)::int AS listing_count
    FROM food_categories fc
    LEFT JOIN food_listings fl ON fc.category_id = fl.category_id
    GROUP BY fc.category_id
    ORDER BY fc.name ASC
  `);

  return res.status(200).json({
    success: true,
    data: { categories: result.rows },
    message: 'Categories fetched successfully',
  });
});

// ============================================================================
// 6b. POST /api/admin/categories — Add Category
// ============================================================================
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon_url } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'Category name is required',
    });
  }

  // Check duplicate name
  const existing = await pool.query(
    `SELECT category_id FROM food_categories WHERE LOWER(name) = LOWER($1)`,
    [name.trim()],
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'A category with this name already exists',
    });
  }

  const result = await pool.query(
    `INSERT INTO food_categories (name, description, icon_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name.trim(), description || null, icon_url || null],
  );

  // Invalidate categories cache
  await invalidateCache('GET /api/admin/categories*');

  return res.status(201).json({
    success: true,
    data: { category: result.rows[0] },
    message: 'Category created successfully',
  });
});

// ============================================================================
// 6c. PATCH /api/admin/categories/:category_id — Edit Category
// ============================================================================
const updateCategory = asyncHandler(async (req, res) => {
  const { category_id } = req.params;
  const { name, description, icon_url, is_active } = req.body;

  // Check category exists
  const catResult = await pool.query(
    `SELECT * FROM food_categories WHERE category_id = $1`,
    [category_id],
  );

  if (catResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      data: {},
      message: 'Category not found',
    });
  }

  // Build dynamic SET
  const updates = [];
  const params = [];
  let idx = 1;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    params.push(description);
  }
  if (icon_url !== undefined) {
    updates.push(`icon_url = $${idx++}`);
    params.push(icon_url);
  }
  if (typeof is_active === 'boolean') {
    updates.push(`is_active = $${idx++}`);
    params.push(is_active);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'No fields to update',
    });
  }

  params.push(category_id);
  const result = await pool.query(
    `UPDATE food_categories SET ${updates.join(', ')} WHERE category_id = $${idx} RETURNING *`,
    params,
  );

  // Invalidate categories cache
  await invalidateCache('GET /api/admin/categories*');

  return res.status(200).json({
    success: true,
    data: { category: result.rows[0] },
    message: 'Category updated successfully',
  });
});

// ============================================================================
// 7. POST /api/admin/broadcast — Emergency Broadcast
// ============================================================================
const sendBroadcast = asyncHandler(async (req, res) => {
  const { title, message, target_role, priority } = req.body;
  const adminId = req.user.userId;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      data: {},
      message: 'title and message are required',
    });
  }

  const validRoles = ['donor', 'recipient', 'volunteer', 'admin'];
  if (target_role && !validRoles.includes(target_role)) {
    return res.status(400).json({
      success: false,
      data: {},
      message: `target_role must be one of: ${validRoles.join(', ')} (or null for all users)`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert broadcast
    const broadcastResult = await client.query(
      `INSERT INTO broadcast_notifications (admin_id, title, message, target_role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [adminId, title, message, target_role || null],
    );
    const broadcast = broadcastResult.rows[0];

    // Get target users
    let usersQuery = `SELECT user_id FROM users WHERE is_active = true`;
    const usersParams = [];
    if (target_role) {
      usersQuery += ` AND role = $1`;
      usersParams.push(target_role);
    }
    const targetUsers = await client.query(usersQuery, usersParams);

    // Insert individual notifications for each target user
    if (targetUsers.rows.length > 0) {
      const valuesSql = targetUsers.rows
        .map((_, i) => `($${i * 4 + 1}, 'push', $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
        .join(', ');
      const valuesParams = targetUsers.rows.flatMap((u) => [
        u.user_id,
        title,
        message,
        JSON.stringify({ broadcast_id: broadcast.broadcast_id, priority: priority || 'normal' }),
      ]);

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data_json)
         VALUES ${valuesSql}`,
        valuesParams,
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'BROADCAST_SENT', 'broadcast', $2, $3)`,
      [
        adminId,
        broadcast.broadcast_id,
        JSON.stringify({
          target_role: target_role || 'all',
          recipients_count: targetUsers.rows.length,
        }),
      ],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        broadcast: {
          broadcast_id: broadcast.broadcast_id,
          title: broadcast.title,
          target_role: broadcast.target_role || 'all',
          recipients_count: targetUsers.rows.length,
          created_at: broadcast.created_at,
        },
      },
      message: 'Broadcast sent successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// 7b. GET /api/admin/broadcast — Past Broadcasts
// ============================================================================
const getBroadcasts = asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      bn.broadcast_id,
      bn.title,
      bn.message,
      bn.target_role,
      bn.created_at,
      u.first_name || ' ' || u.last_name AS admin_name
    FROM broadcast_notifications bn
    JOIN users u ON bn.admin_id = u.user_id
    ORDER BY bn.created_at DESC
  `);

  return res.status(200).json({
    success: true,
    data: { broadcasts: result.rows },
    message: 'Broadcast history fetched successfully',
  });
});

// ============================================================================
// Exports
// ============================================================================
module.exports = {
  getOverview,
  getAnalytics,
  exportAnalytics,
  getVerifications,
  updateVerification,
  getModeration,
  updateModeration,
  getUsers,
  updateUser,
  getCategories,
  createCategory,
  updateCategory,
  sendBroadcast,
  getBroadcasts,
};
