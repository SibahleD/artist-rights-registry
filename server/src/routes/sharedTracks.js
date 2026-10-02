const express = require('express');
const { authToken } = require('../middleware/auth');
const { listSharedTracks, getSharedTrack } = require('../controllers/collaboratorController');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(authToken);
router.param('trackId', (req, res, next, id) => {
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Track not found.' });
    next();
});

router.get('/', listSharedTracks);
router.get('/:trackId', getSharedTrack);

module.exports = router;
