const { prisma } = require('../config/db');
const HttpError = require('../utils/HttpError');
const { orderDto, ORDER_INCLUDE } = require('../utils/serializers');

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

// Creates an order from the user's cart. Everything happens in one database transaction:
// stock is decremented, the order and its items are saved and the cart is emptied, or none of it happens.
async function placeOrder(userId, rawDelivery, idempotencyKey) {
  const delivery = validateDelivery(rawDelivery);

  const findExisting = () =>
    prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: ORDER_INCLUDE,
    });

  if (idempotencyKey) {
    const existing = await findExisting();
    if (existing) return { order: orderDto(existing), created: false };
  }

  try {
    const order = await prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({ where: { userId } });
        const lines = cart ? await tx.cartItem.findMany({ where: { cartId: cart.id } }) : [];
        if (lines.length === 0) throw new HttpError(400, 'Your cart is empty');

        // Always lock products in the same order, so two checkouts that share items
        // cannot wait on each other forever (deadlock).
        lines.sort((a, b) => (a.productId < b.productId ? -1 : 1));

        const items = [];

        for (const line of lines) {
          // Atomic: the row is only changed when enough stock exists. Postgres locks the row
          // for the rest of the transaction, so a concurrent buyer waits and then re-checks.
          const { count } = await tx.product.updateMany({
            where: { id: line.productId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });

          if (count === 0) {
            const current = await tx.product.findUnique({ where: { id: line.productId } });
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

          const product = await tx.product.findUnique({ where: { id: line.productId } });
          const unitPrice = Number(product.price);
          items.push({
            productId: product.id,
            name: product.name,
            unit: product.unit,
            unitPrice,
            quantity: line.quantity,
            lineTotal: round2(unitPrice * line.quantity),
          });
        }

        const totalAmount = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));

        const created = await tx.order.create({
          data: {
            userId,
            totalAmount,
            paymentMethod: 'COD',
            paymentStatus: 'Pending',
            status: 'Placed',
            idempotencyKey: idempotencyKey || null,
            deliveryFullName: delivery.fullName,
            deliveryPhone: delivery.phone,
            deliveryLine1: delivery.line1,
            deliveryLine2: delivery.line2,
            deliveryCity: delivery.city,
            deliveryState: delivery.state,
            deliveryPincode: delivery.pincode,
            items: { create: items },
          },
          include: ORDER_INCLUDE,
        });

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return created;
      },
      { maxWait: 5000, timeout: 15000 }
    );

    return { order: orderDto(order), created: true };
  } catch (err) {
    // Same key submitted twice at the same moment: return the winner, this attempt was rolled back
    if (err.code === 'P2002' && idempotencyKey) {
      const existing = await findExisting();
      if (existing) return { order: orderDto(existing), created: false };
    }
    throw err;
  }
}

module.exports = { placeOrder };
