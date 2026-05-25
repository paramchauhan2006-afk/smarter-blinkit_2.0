const express = require('express');
const router = express.Router();
const { searchProducts, getRecommendations, getLeaderboard, getPairingPrediction } = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', protect, searchProducts);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/:id/recommendations', protect, getRecommendations);
router.get('/:id/predict-pairing', protect, getPairingPrediction);

module.exports = router;
