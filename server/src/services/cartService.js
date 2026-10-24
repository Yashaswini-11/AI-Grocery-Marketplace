const Cart = require('../models/Cart');

const round2 = (n) => Math.round(n * 100) / 100;

// Loads the user's cart with live product data and builds the API view.
// Totals are always computed here from database prices.
async function getCartView(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) return { items: [], itemCount: 0, total: 0 };

  // Drop items whose product no longer exists
  const valid = cart.items.filter((item) => item.product);
  if (valid.length !== cart.items.length) {
    cart.items = valid;
    await cart.save();
  }

  let total = 0;
  let itemCount = 0;

  const items = cart.items.map((item) => {
    const p = item.product;
    const lineTotal = round2(p.price * item.quantity);
    total += lineTotal;
    itemCount += item.quantity;
    return {
      productId: p._id.toString(),
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      unit: p.unit,
      unitPrice: p.price,
      quantity: item.quantity,
      lineTotal,
      stock: p.stock,
      inStock: p.stock >= item.quantity,
    };
  });

  return { items, itemCount, total: round2(total) };
}

async function getOrCreateCart(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, returnDocument: 'after' }
  );
}

module.exports = { getCartView, getOrCreateCart };