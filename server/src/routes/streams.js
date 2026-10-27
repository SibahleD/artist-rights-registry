const express = require('express');
const { authToken } = require('../middleware/auth');
const { importStreams, getStreams, listImports, deleteImport } = require('../controllers/streamController');

const router = express.Router();
router.use(authToken);

router.get('/', getStreams);
router.get('/imports', listImports);
router.post('/imports', importStreams);
router.delete('/imports/:id', deleteImport);

module.exports = router;
