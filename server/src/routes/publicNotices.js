const express = require('express');
const { makeLimiter } = require('../rateLimits');
const { getNotice, respond } = require('../controllers/publicNoticeController');

const router = express.Router();
const limiter = makeLimiter('notice');

router.get('/:token', limiter, getNotice);
router.post('/:token/respond', limiter, respond);

module.exports = router;