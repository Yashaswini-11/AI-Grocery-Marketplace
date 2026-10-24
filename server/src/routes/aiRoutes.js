const express = require('express');
const auth = require('../middleware/auth');
const aiRateLimit = require('../middleware/aiRateLimit');
const { status, parseList, matchItemsHandler } = require('../controllers/aiController');

const router = express.Router();

router.get('/status', status); // public: lets the UI know whether AI is available

router.use(auth);
router.post('/parse-list', aiRateLimit, parseList);
router.post('/match-items', matchItemsHandler);

module.exports = router;