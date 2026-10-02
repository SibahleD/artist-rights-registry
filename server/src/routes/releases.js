const express = require('express');
const { authToken } = require('../middleware/auth');
const {
    createRelease, listReleases, getRelease, updateRelease,
    markReady, revertToDraft, deleteRelease,
} = require('../controllers/releaseController');

const router = express.Router();

router.use(authToken);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => {
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Release not found.' });
    next();
});

router.post('/', createRelease);
router.get('/', listReleases);
router.get('/:id', getRelease);
router.patch('/:id', updateRelease);
router.delete('/:id', deleteRelease);
router.post('/:id/ready', markReady);
router.post('/:id/revert', revertToDraft);

module.exports = router;