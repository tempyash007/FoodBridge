const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// GET /api/categories  (public — no auth required)
// ---------------------------------------------------------------------------
const getCategories = asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT category_id, name, icon_url
     FROM food_categories
     ORDER BY name ASC`
  );

  return res.status(200).json({
    success: true,
    data: { categories: result.rows },
    message: 'Categories fetched successfully',
  });
});

module.exports = { getCategories };
