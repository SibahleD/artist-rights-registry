const express = require('express');
const { authToken } = require('../middleware/auth');
const { userApiLimiter } = require('../middleware/rateLimits');
const { listProgress, setProgress } = require('../controllers/glossaryController');

const router = express.Router();

router.use(authToken);
router.use(userApiLimiter());
router.get('/progress', listProgress);
router.put('/progress/:termId', setProgress);

module.exports = router;
