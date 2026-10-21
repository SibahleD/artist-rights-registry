const express = require('express');
const rateLimit = require('express-rate-limit');
const { authToken } = require('../middleware/auth');
const { getMe, updateMe, getUsage, listLinks, createLink, updateLink, deleteLink } = require('../controllers/userController');
const {
    changePassword, requestEmailChange, cancelEmailChange, updatePreferences, exportMyData, deleteAccount,
} = require('../controllers/accountController');
const { putAvatar, deleteAvatar } = require('../controllers/imageController')

const router = express.Router();

router.use(authToken);

// Password checks are the target here, so these routes get their own, tighter limit.
const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
    standardHeaders: true,
    message: { error: 'Too many attempts, please try again later.' },
});

router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/me/links', listLinks);
router.post('/me/links', createLink);
router.patch('/me/links/:id', updateLink);
router.delete('/me/links/:id', deleteLink);
router.get('/me/usage', getUsage);

router.patch('/me/password', sensitiveLimiter, changePassword);
router.post('/me/email', sensitiveLimiter, requestEmailChange);
router.delete('/me/email', cancelEmailChange);
router.patch('/me/preferences', updatePreferences);
router.get('/me/export', sensitiveLimiter, exportMyData);
router.post('/me/delete', sensitiveLimiter, deleteAccount);
router.put('/me/avatar', putAvatar)
router.delete('/me/avatar', deleteAvatar)

module.exports = router;
