// Turns database rows into the exact JSON shapes the frontend already expects.
// (Decimal prices become numbers, enum keys become labels, flat delivery columns become an object.)
const { ORDER_STATUS_LABELS } = require('./constants');

const num = (decimal) => Number(decimal);

function userDto(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

function productDto(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: num(p.price),
    imageUrl: p.imageUrl,
    stock: p.stock,
    unit: p.unit,
    aliases: p.aliases || [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Compact product shape used by the AI matcher and reorder suggestions
function productSummary(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: num(p.price),
    stock: p.stock,
    imageUrl: p.imageUrl,
  };
}

// `order` must be loaded with its items
function orderDto(o) {
  return {
    id: o.id,
    user: o.userId,
    items: (o.items || []).map((i) => ({
      product: i.productId,
      name: i.name,
      unit: i.unit,
      price: num(i.unitPrice),
      quantity: i.quantity,
      lineTotal: num(i.lineTotal),
    })),
    totalAmount: num(o.totalAmount),
    delivery: {
      fullName: o.deliveryFullName,
      phone: o.deliveryPhone,
      line1: o.deliveryLine1,
      line2: o.deliveryLine2,
      city: o.deliveryCity,
      state: o.deliveryState,
      pincode: o.deliveryPincode,
    },
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: ORDER_STATUS_LABELS[o.status] || o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Include this wherever an order is read, so orderDto always has its items
const ORDER_INCLUDE = { items: { orderBy: { name: 'asc' } } };

module.exports = { userDto, productDto, productSummary, orderDto, ORDER_INCLUDE };
