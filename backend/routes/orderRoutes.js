const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/orderController');

router.post('/create', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;
