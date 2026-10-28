const { prisma } = require('../config/db');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { isUuid } = require('../utils/ids');
const { getCartView, getOrCreateCart } = require('../services/cartService');

const MAX_QTY = 99;

function parseQuantity(value, fallback) {
  const raw = value === undefined ? fallback : value;
  const qty = Number(raw);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    throw new HttpError(400, `Quantity must be a whole number between 1 and ${MAX_QTY}`);
  }
  return qty;
}

function assertValidId(id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid product id');
}

function assertStock(product, qty) {
  if (qty > product.stock) {
    throw new HttpError(
      409,
      product.stock === 0
        ? `${product.name} is out of stock`
        : `Only ${product.stock} ${product.unit} of ${product.name} available`
    );
  }
}

const getCart = asyncHandler(async (req, res) => {
  const cart = await getCartView(req.user.id);
  res.json({ success: true, cart });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body || {};
  assertValidId(productId);
  const qty = parseQuantity(quantity, 1);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, 'Product not found');

  const cart = await getOrCreateCart(req.user.id);
  const key = { cartId_productId: { cartId: cart.id, productId } };
  const existing = await prisma.cartItem.findUnique({ where: key });
  const newQty = (existing ? existing.quantity : 0) + qty;

  if (newQty > MAX_QTY) {
    throw new HttpError(400, `You can add at most ${MAX_QTY} of one item`);
  }
  assertStock(product, newQty);

  await prisma.cartItem.upsert({
    where: key,
    update: { quantity: newQty },
    create: { cartId: cart.id, productId, quantity: qty },
  });

  res.status(200).json({ success: true, cart: await getCartView(req.user.id) });
});

const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  assertValidId(productId);
  if (req.body?.quantity === undefined) throw new HttpError(400, 'Quantity is required');
  const qty = parseQuantity(req.body.quantity);

  const cart = await getOrCreateCart(req.user.id);
  const key = { cartId_productId: { cartId: cart.id, productId } };
  const existing = await prisma.cartItem.findUnique({ where: key });
  if (!existing) throw new HttpError(404, 'Item is not in your cart');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, 'Product not found');
  assertStock(product, qty);

  await prisma.cartItem.update({ where: key, data: { quantity: qty } });

  res.json({ success: true, cart: await getCartView(req.user.id) });
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  assertValidId(productId);

  const cart = await getOrCreateCart(req.user.id);
  const { count } = await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  if (count === 0) throw new HttpError(404, 'Item is not in your cart');

  res.json({ success: true, cart: await getCartView(req.user.id) });
});

module.exports = { getCart, addItem, updateItem, removeItem };
