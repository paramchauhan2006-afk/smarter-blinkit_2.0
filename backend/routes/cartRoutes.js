const express = require('express');
const router = express.Router();
const { buildRecipeCart } = require('../controllers/cartController');

router.post('/recipe', buildRecipeCart);

module.exports = router;
