const express = require('express');
const { authToken } = require('../middleware/auth');
const { userApiLimiter } = require('../middleware/rateLimits');
const { importAudience, getAudience, clearAudience } = require('../controllers/spotifyAudienceController');

const router = express.Router();
router.use(authToken);
router.use(userApiLimiter());

router.get('/', getAudience);
router.post('/', importAudience);
router.delete('/', clearAudience);

module.exports = router;
