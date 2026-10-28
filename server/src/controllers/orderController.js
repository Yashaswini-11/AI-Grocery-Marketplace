const { prisma } = require('../config/db');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { isUuid } = require('../utils/ids');
const { orderDto, ORDER_INCLUDE } = require('../utils/serializers');
const { placeOrder } = require('../services/orderService');

const createOrder = asyncHandler(async (req, res) => {
  const { delivery, paymentMethod } = req.body || {};

  if (paymentMethod !== undefined && paymentMethod !== 'COD') {
    throw new HttpError(400, 'Only Cash on Delivery is supported right now');
  }

  const key = (req.get('Idempotency-Key') || '').trim();
  if (key.length > 100) throw new HttpError(400, 'Idempotency-Key is too long');

  const { order, created } = await placeOrder(req.user.id, delivery, key || null);

  res.status(created ? 201 : 200).json({ success: true, order, duplicate: !created });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, orders: orders.map(orderDto) });
});

const getOrder = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(400, 'Invalid order id');

  // Filtering by user means other people's orders look like they don't exist
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new HttpError(404, 'Order not found');

  res.json({ success: true, order: orderDto(order) });
});

module.exports = { createOrder, listOrders, getOrder };
