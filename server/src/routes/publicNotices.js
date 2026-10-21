const express = require('express');
const rateLimit = require('express-rate-limit');
const { getNotice, respond } = require('../controllers/publicNoticeController');

const router = express.Router();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: Number(process.env.NOTICE_RATE_LIMIT) || 30,
    standardHeaders: true,
    message: { error: 'Too many requests, please try again later.' },
});

router.get('/:token', limiter, getNotice);
router.post('/:token/respond', limiter, respond);

module.exports = router;