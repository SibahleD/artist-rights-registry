const express = require('express');
const { getOutbox } = require('../services/mailer');
 
const router = express.Router();
 
router.get('/outbox', (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to.trim().toLowerCase() : null;
    res.json({ emails: getOutbox().filter((e) => !to || e.to.toLowerCase() === to) });
});
 
module.exports = router;
 