const express = require('express');
const router = express.Router();
const { updateInventoryByBarcode, getSellerStore } = require('../controllers/inventoryController');
const { protect, verifySeller } = require('../middleware/authMiddleware');

router.get('/store', protect, verifySeller, getSellerStore);
router.post('/barcode', protect, verifySeller, updateInventoryByBarcode);

module.exports = router;
