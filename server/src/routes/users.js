const express = require('express');
const { authToken } = require('../middleware/auth');
const { getMe, updateMe, getUsage, listLinks, upsertLink, deleteLink } = require('../controllers/userController');
const { putAvatar, deleteAvatar } = require('../controllers/imageController')

const router = express.Router();

router.use(authToken);

router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/me/links', listLinks);
router.put('/me/links/:platform', upsertLink);
router.delete('/me/links/:platform', deleteLink);
router.get('/me/usage', getUsage);
router.put('/me/avatar', putAvatar)
router.delete('/me/avatar', deleteAvatar)

module.exports = router;
