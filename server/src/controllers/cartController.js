const mongoose = require('mongoose');
const Product = require('../models/Product');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
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
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid product id');
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
  const cart = await getCartView(req.user._id);
  res.json({ success: true, cart });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body || {};
  assertValidId(productId);
  const qty = parseQuantity(quantity, 1);

  const product = await Product.findById(productId);
  if (!product) throw new HttpError(404, 'Product not found');

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => i.product.equals(product._id));
  const newQty = (existing ? existing.quantity : 0) + qty;

  if (newQty > MAX_QTY) {
    throw new HttpError(400, `You can add at most ${MAX_QTY} of one item`);
  }
  assertStock(product, newQty);

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: product._id, quantity: qty });
  await cart.save();

  res.status(200).json({ success: true, cart: await getCartView(req.user._id) });
});

const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  assertValidId(productId);
  if (req.body?.quantity === undefined) throw new HttpError(400, 'Quantity is required');
  const qty = parseQuantity(req.body.quantity);

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => i.product.equals(productId));
  if (!existing) throw new HttpError(404, 'Item is not in your cart');

  const product = await Product.findById(productId);
  if (!product) throw new HttpError(404, 'Product not found');
  assertStock(product, qty);

  existing.quantity = qty;
  await cart.save();

  res.json({ success: true, cart: await getCartView(req.user._id) });
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  assertValidId(productId);

  const cart = await getOrCreateCart(req.user._id);
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => !i.product.equals(productId));
  if (cart.items.length === before) throw new HttpError(404, 'Item is not in your cart');
  await cart.save();

  res.json({ success: true, cart: await getCartView(req.user._id) });
});

module.exports = { getCart, addItem, updateItem, removeItem };