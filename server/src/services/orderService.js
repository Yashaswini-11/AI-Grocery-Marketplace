const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const HttpError = require('../utils/HttpError');

const round2 = (n) => Math.round(n * 100) / 100;

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function validateDelivery(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};

  const fullName = cleanText(d.fullName);
  const line1 = cleanText(d.line1);
  const line2 = cleanText(d.line2);
  const city = cleanText(d.city);
  const state = cleanText(d.state);
  const pincode = cleanText(d.pincode);
  const phone = cleanText(d.phone).replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');

  if (fullName.length < 2 || fullName.length > 80) {
    throw new HttpError(400, 'Full name must be 2 to 80 characters');
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new HttpError(400, 'Enter a valid 10-digit Indian mobile number');
  }
  if (line1.length < 5 || line1.length > 200) {
    throw new HttpError(400, 'Address line 1 must be 5 to 200 characters');
  }
  if (line2.length > 200) throw new HttpError(400, 'Address line 2 is too long');
  if (city.length < 2 || city.length > 80) throw new HttpError(400, 'Enter a valid city');
  if (state.length < 2 || state.length > 80) throw new HttpError(400, 'Enter a valid state');
  if (!/^[1-9]\d{5}$/.test(pincode)) throw new HttpError(400, 'Enter a valid 6-digit pincode');

  return { fullName, phone, line1, line2, city, state, pincode };
}

// Creates an order from the user's cart. Everything happens in one transaction:
// stock is decremented, the order is saved and the cart is cleared, or none of it happens.
async function placeOrder(userId, rawDelivery, idempotencyKey) {
  const delivery = validateDelivery(rawDelivery);

  if (idempotencyKey) {
    const existing = await Order.findOne({ user: userId, idempotencyKey });
    if (existing) return { order: existing, created: false };
  }

  const session = await mongoose.startSession();
  let order;

  try {
    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart || cart.items.length === 0) throw new HttpError(400, 'Your cart is empty');

      const items = [];

      for (const line of cart.items) {
        // Atomic: only decrements when enough stock exists
        const product = await Product.findOneAndUpdate(
          { _id: line.product, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity } },
          { returnDocument: 'after', session }
        );

        if (!product) {
          const current = await Product.findById(line.product).session(session);
          if (!current) {
            throw new HttpError(
              409,
              'An item in your cart is no longer available. Please review your cart.'
            );
          }
          throw new HttpError(
            409,
            current.stock === 0
              ? `${current.name} is out of stock`
              : `Only ${current.stock} ${current.unit} of ${current.name} available`
          );
        }

        items.push({
          product: product._id,
          name: product.name,
          unit: product.unit,
          price: product.price,
          quantity: line.quantity,
          lineTotal: round2(product.price * line.quantity),
        });
      }

      const totalAmount = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));

      const [created] = await Order.create(
        [
          {
            user: userId,
            items,
            totalAmount,
            delivery,
            paymentMethod: 'COD',
            paymentStatus: 'Pending',
            status: 'Placed',
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session }
      );

      await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });
      order = created;
    });
  } catch (err) {
    // Same key submitted twice at the same moment: return the winner, stock was rolled back
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ user: userId, idempotencyKey });
      if (existing) return { order: existing, created: false };
    }
    throw err;
  } finally {
    await session.endSession();
  }

  return { order, created: true };
}

module.exports = { placeOrder };