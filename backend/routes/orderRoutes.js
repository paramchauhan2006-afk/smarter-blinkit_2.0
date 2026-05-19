const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getMoneyMap } = require('../controllers/orderController');

router.post('/create', createOrder);
router.post('/verify', verifyPayment);
router.get('/analytics/money-map', getMoneyMap);

module.exports = router;
