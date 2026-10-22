const express = require('express');
const { authToken } = require('../middleware/auth');
const { listProgress, setProgress } = require('../controllers/glossaryController');

const router = express.Router();

router.use(authToken);
router.get('/progress', listProgress);
router.put('/progress/:termId', setProgress);

module.exports = router;
