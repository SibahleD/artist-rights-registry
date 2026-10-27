const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, logout, verifyEmail, resendVerification, forgotPassword, resetPassword } = require('../controllers/authController');
const { authToken } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
    standardHeaders: true,
    message: 'Too many requests, please try again later.',
})

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authToken, logout);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, authToken, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);


module.exports = router;