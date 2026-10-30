const express = require('express');
const { makeLimiter } = require('../middleware/rateLimits');
const { authToken } = require('../middleware/auth');
const { getMe, updateMe, getUsage, listLinks, createLink, updateLink, deleteLink } = require('../controllers/userController');
const {
    changePassword, requestEmailChange, cancelEmailChange, updatePreferences, exportMyData, deleteAccount,
} = require('../controllers/accountController');
const { listSocieties, createSociety, updateSociety, deleteSociety } = require('../controllers/societyController');
const { putAvatar, deleteAvatar } = require('../controllers/imageController')

const router = express.Router();

router.use(authToken);

// Password checks are the target here, so these routes get their own, tighter limit.
const sensitiveLimiter = makeLimiter('account');

router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/me/links', listLinks);
router.post('/me/links', createLink);
router.patch('/me/links/:id', updateLink);
router.delete('/me/links/:id', deleteLink);
router.get('/me/societies', listSocieties);
router.post('/me/societies', createSociety);
router.patch('/me/societies/:id', updateSociety);
router.delete('/me/societies/:id', deleteSociety);
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
