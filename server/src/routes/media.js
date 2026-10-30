const express = require('express');
const { authToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimits');
const { getMedia } = require('../controllers/imageController');
 
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const router = express.Router();

router.use(authToken);
router.use(apiLimiter());
router.get('/:id', (req, res, next) => (UUID_RE.test(req.params.id) ? next() : res.status(404).json({ error: 'Image not found.' })), getMedia);

module.exports = router;