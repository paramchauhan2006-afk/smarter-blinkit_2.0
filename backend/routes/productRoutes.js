const express = require('express');
const router = express.Router();
const { searchProducts, getRecommendations } = require('../controllers/productController');

router.get('/search', searchProducts);
router.get('/:id/recommendations', getRecommendations);

module.exports = router;
