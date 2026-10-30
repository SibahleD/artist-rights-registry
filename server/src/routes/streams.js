const express = require('express');
const { authToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimits');
const { listProjections } = require('../controllers/audioFeatureController');
const { importStreams, getStreams, exportStreams, listImports, deleteImport } = require('../controllers/streamController');

const router = express.Router();
router.use(authToken);
router.use(apiLimiter());

router.get('/', getStreams);
router.get('/export', exportStreams);
router.get('/projections', listProjections);
router.get('/imports', listImports);
router.post('/imports', importStreams);
router.delete('/imports/:id', deleteImport);

module.exports = router;
