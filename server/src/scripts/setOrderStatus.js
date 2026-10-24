const mongoose = require('mongoose');
require('../config/env');
const connectDB = require('../config/db');
const Order = require('../models/Order');

async function run() {
  const [id, status] = process.argv.slice(2);

  if (!id || !status || !Order.STATUSES.includes(status)) {
    console.error(`Usage: npm run order-status -- <orderId> "<status>"`);
    console.error(`Statuses: ${Order.STATUSES.join(', ')}`);
    process.exit(1);
  }

  await connectDB();
  const order = await Order.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
  console.log(order ? `Order ${id} is now "${order.status}"` : 'Order not found');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});