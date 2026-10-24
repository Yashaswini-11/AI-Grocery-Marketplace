const mongoose = require('mongoose');
const Order = require('../models/Order');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { placeOrder } = require('../services/orderService');

const createOrder = asyncHandler(async (req, res) => {
  const { delivery, paymentMethod } = req.body || {};

  if (paymentMethod !== undefined && paymentMethod !== 'COD') {
    throw new HttpError(400, 'Only Cash on Delivery is supported right now');
  }

  const key = (req.get('Idempotency-Key') || '').trim();
  if (key.length > 100) throw new HttpError(400, 'Idempotency-Key is too long');

  const { order, created } = await placeOrder(req.user._id, delivery, key || null);

  res.status(created ? 201 : 200).json({ success: true, order, duplicate: !created });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, orders });
});

const getOrder = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid order id');

  // Filtering by user means other people's orders look like they don't exist
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new HttpError(404, 'Order not found');

  res.json({ success: true, order });
});

module.exports = { createOrder, listOrders, getOrder };