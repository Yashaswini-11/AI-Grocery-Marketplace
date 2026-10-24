const express = require('express');
const auth = require('../middleware/auth');
const { getCart, addItem, updateItem, removeItem } = require('../controllers/cartController');

const router = express.Router();

router.use(auth); // every cart route requires login

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:productId', updateItem);
router.delete('/items/:productId', removeItem);

module.exports = router;