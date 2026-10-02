const express = require('express');
const {
    createTrack, listTracks, getTrack, updateTrack, deleteTrack, reorderTracks,
    upsertAudio, deleteAudio,
} = require('../controllers/trackController');

const collaboratorRoutes = require('./collaborators');

const router = express.Router({ mergeParams: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use((req, res, next) => {
    if (!UUID_RE.test(req.params.releaseId)) return res.status(404).json({ error: 'Release not found.' });
    next();
});
router.param('trackId', (req, res, next, id) => {
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Track not found.' });
    next();
});

router.use('/:trackId/collaborators', collaboratorRoutes);

router.post('/', createTrack);
router.get('/', listTracks);
router.put('/order', reorderTracks);
router.get('/:trackId', getTrack);
router.patch('/:trackId', updateTrack);
router.delete('/:trackId', deleteTrack);
router.put('/:trackId/audio', upsertAudio);
router.delete('/:trackId/audio', deleteAudio);

module.exports = router;