const express = require('express');
const router = express.Router();
const { getCategories } = require('../controllers/category.controller');

// GET /api/categories — public, no auth needed
router.get('/', getCategories);

module.exports = router;
