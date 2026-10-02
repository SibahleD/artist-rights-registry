const express = require('express');
const { authToken } = require('../middleware/auth');
const { getMe, updateMe, listLinks, upsertLink, deleteLink } = require('../controllers/userController');

const router = express.Router();

router.use(authToken);

router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/me/links', listLinks);
router.put('/me/links/:platform', upsertLink);
router.delete('/me/links/:platform', deleteLink);

module.exports = router;
