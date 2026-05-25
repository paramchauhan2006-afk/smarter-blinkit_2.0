const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getMoneyMap } = require('../controllers/orderController');
const { protect, verifyBuyer, verifySeller } = require('../middleware/authMiddleware');

router.post('/create', protect, verifyBuyer, createOrder);
router.post('/verify', protect, verifyBuyer, verifyPayment);
router.get('/analytics/money-map', protect, verifySeller, getMoneyMap);

module.exports = router;
