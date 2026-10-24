const express = require('express');
const auth = require('../middleware/auth');
const { getSuggestions } = require('../controllers/reorderController');

const router = express.Router();

router.use(auth);
router.get('/suggestions', getSuggestions);

module.exports = router;