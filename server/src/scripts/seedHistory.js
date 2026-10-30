require('../config/env');
const { prisma, connectDB, disconnectDB } = require('../config/db');

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'demo-history-';
const round2 = (n) => Math.round(n * 100) / 100;

// daysAgo = when each purchase happened
const PLAN = [
  { name: 'Full Cream Milk', daysAgo: [27, 20, 13, 6], quantity: 2 }, // weekly, due soon
  { name: 'Eggs', daysAgo: [32, 22, 12, 2], quantity: 12 }, // every 10 days, coming up
  { name: 'Basmati Rice', daysAgo: [91, 61, 31], quantity: 1 }, // monthly, overdue
  { name: 'Banana', daysAgo: [20, 6], quantity: 1 }, // only 2 purchases: no prediction
  { name: 'Paneer', daysAgo: [200, 190, 180], quantity: 1 }, // stopped buying: lapsed
];

async function run() {
  const args = process.argv.slice(2);
  const clearOnly = args.includes('--clear');
  const email = args.find((a) => !a.startsWith('--'));

  if (!email) {
    console.error('Usage: npm run seed-history -- <user email> [--clear]');
    process.exit(1);
  }

  await connectDB();

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No user with email ${email}`);
    await disconnectDB();
    process.exit(1);
  }

  // order_items are removed with their orders (ON DELETE CASCADE)
  const removed = await prisma.order.deleteMany({
    where: { userId: user.id, idempotencyKey: { startsWith: KEY_PREFIX } },
  });
  console.log(`Removed ${removed.count} existing demo order(s)`);

  if (!clearOnly) {
    let n = 0;
    for (const item of PLAN) {
      const product = await prisma.product.findUnique({ where: { name: item.name } });
      if (!product) {
        console.warn(`Skipping "${item.name}": not in catalog`);
        continue;
      }

      const unitPrice = Number(product.price);

      for (const daysAgo of item.daysAgo) {
        const date = new Date(Date.now() - daysAgo * DAY_MS);
        const lineTotal = round2(unitPrice * item.quantity);
        n += 1;

        await prisma.order.create({
          data: {
            userId: user.id,
            totalAmount: lineTotal,
            deliveryFullName: user.name,
            deliveryPhone: '9876543210',
            deliveryLine1: '12, MG Road',
            deliveryCity: 'Bengaluru',
            deliveryState: 'Karnataka',
            deliveryPincode: '560001',
            paymentMethod: 'COD',
            paymentStatus: 'Paid',
            status: 'Delivered',
            idempotencyKey: `${KEY_PREFIX}${n}`,
            createdAt: date, // backdated so the reorder prediction has history
            updatedAt: date,
            items: {
              create: [
                {
                  productId: product.id,
                  name: product.name,
                  unit: product.unit,
                  unitPrice,
                  quantity: item.quantity,
                  lineTotal,
                },
              ],
            },
          },
        });
      }
    }
    console.log(`Created ${n} demo order(s) for ${user.email}`);
  }

  await disconnectDB();
}

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
