const express = require('express');
const router = express.Router();
const { register, login, loginWithFace } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/login/face', loginWithFace);

module.exports = router;
