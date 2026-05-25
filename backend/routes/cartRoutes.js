const express = require('express');
const router = express.Router();
const { buildRecipeCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.post('/recipe', protect, buildRecipeCart);

module.exports = router;
