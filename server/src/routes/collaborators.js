const express = require('express');
const { listCollaborators, replaceCollaborators } = require('../controllers/collaboratorController');

const router = express.Router({ mergeParams: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use((req, res, next) => {
    if (!UUID_RE.test(req.params.trackId)) return res.status(404).json({ error: 'Track not found.' });
    next();
});

router.get('/', listCollaborators);
router.put('/', replaceCollaborators);

module.exports = router;
