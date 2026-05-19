const express = require('express');
const router = express.Router();
const { updateInventoryByBarcode } = require('../controllers/inventoryController');

router.post('/barcode', updateInventoryByBarcode);

module.exports = router;
