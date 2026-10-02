const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, logout } = require('../controllers/authController');
const { authToken } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,
    standardHeaders: true,
    message: 'Too many requests, please try again later.',
})

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authToken, logout);


module.exports = router;