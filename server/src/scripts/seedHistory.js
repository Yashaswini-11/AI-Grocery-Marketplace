const mongoose = require('mongoose');
require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

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

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user with email ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const removed = await Order.deleteMany({
    user: user._id,
    idempotencyKey: { $regex: `^${KEY_PREFIX}` },
  });
  console.log(`Removed ${removed.deletedCount} existing demo order(s)`);

  if (!clearOnly) {
    let n = 0;
    for (const item of PLAN) {
      const product = await Product.findOne({ name: item.name });
      if (!product) {
        console.warn(`Skipping "${item.name}": not in catalog`);
        continue;
      }

      for (const daysAgo of item.daysAgo) {
        const date = new Date(Date.now() - daysAgo * DAY_MS);
        const lineTotal = round2(product.price * item.quantity);
        n += 1;

        const order = await Order.create({
          user: user._id,
          items: [
            {
              product: product._id,
              name: product.name,
              unit: product.unit,
              price: product.price,
              quantity: item.quantity,
              lineTotal,
            },
          ],
          totalAmount: lineTotal,
          delivery: {
            fullName: user.name,
            phone: '9876543210',
            line1: '12, MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          paymentMethod: 'COD',
          paymentStatus: 'Paid',
          status: 'Delivered',
          idempotencyKey: `${KEY_PREFIX}${n}`,
        });

        // Backdate (bypasses Mongoose timestamps)
        await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: date, updatedAt: date } });
      }
    }
    console.log(`Created ${n} demo order(s) for ${user.email}`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});