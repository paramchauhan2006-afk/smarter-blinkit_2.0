const express = require('express');
const router = express.Router();
const { searchProducts, getRecommendations, getLeaderboard, getPairingPrediction } = require('../controllers/productController');

router.get('/search', searchProducts);
router.get('/leaderboard', getLeaderboard);
router.get('/:id/recommendations', getRecommendations);
router.get('/:id/predict-pairing', getPairingPrediction);

module.exports = router;
