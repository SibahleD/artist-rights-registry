const express = require('express');
const { makeLimiter } = require('../middleware/rateLimits');
const { register, login, logout, verifyEmail, resendVerification, forgotPassword, resetPassword } = require('../controllers/authController');
const { authToken } = require('../middleware/auth');

const router = express.Router();

const authLimiter = makeLimiter('auth');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authToken, logout);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, authToken, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);


module.exports = router;