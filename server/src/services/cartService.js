const { prisma } = require('../config/db');

const round2 = (n) => Math.round(n * 100) / 100;

// Loads the user's cart with live product data and builds the API view.
// Totals are always computed here from database prices.
async function getCartView(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!cart) return { items: [], itemCount: 0, total: 0 };

  let total = 0;
  let itemCount = 0;

  const items = cart.items.map((item) => {
    const p = item.product;
    const price = Number(p.price);
    const lineTotal = round2(price * item.quantity);
    total += lineTotal;
    itemCount += item.quantity;
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      unit: p.unit,
      unitPrice: price,
      quantity: item.quantity,
      lineTotal,
      stock: p.stock,
      inStock: p.stock >= item.quantity,
    };
  });

  return { items, itemCount, total: round2(total) };
}

// One cart per user (user_id is unique), created on first use
function getOrCreateCart(userId) {
  return prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
}

module.exports = { getCartView, getOrCreateCart };
