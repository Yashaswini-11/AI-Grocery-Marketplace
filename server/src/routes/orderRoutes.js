const express = require('express');
const auth = require('../middleware/auth');
const { createOrder, listOrders, getOrder } = require('../controllers/orderController');

const router = express.Router();

router.use(auth);

router.post('/', createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);

module.exports = router;