const express = require('express');
const { authToken } = require('../middleware/auth');
const {
    createRelease, listReleases, getRelease, updateRelease,
    markReady, revertToDraft, deleteRelease, getReadiness, exportRelease,
    markReleased, unmarkReleased,
} = require('../controllers/releaseController');
const { 
    sendNotices, listNotices, remindNotice, resolveNotice
} = require('../controllers/noticesController');
const { putArtwork, deleteArtwork } = require('../controllers/imageController')

const router = express.Router();
const trackRoutes = require('./tracks');

router.use(authToken);
router.use('/:releaseId/tracks', trackRoutes);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => {
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Release not found.' });
    next();
});
router.param('noticeId', (req, res, next, id) => {
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Notice not found.' });
    next();
});

router.post('/', createRelease);
router.get('/', listReleases);
router.get('/:id', getRelease);
router.patch('/:id', updateRelease);
router.delete('/:id', deleteRelease);
router.post('/:id/ready', markReady);
router.get('/:id/readiness', getReadiness);
router.get('/:id/export', exportRelease);
router.post('/:id/revert', revertToDraft);
router.put('/:id/released', markReleased);
router.delete('/:id/released', unmarkReleased);
router.post('/:id/notices/send', sendNotices);
router.get('/:id/notices', listNotices);
router.post('/:id/notices/:noticeId/remind', remindNotice);
router.post('/:id/notices/:noticeId/resolve', resolveNotice);
router.put('/:id/artwork', putArtwork)
router.delete('/:id/artwork', deleteArtwork)

module.exports = router;