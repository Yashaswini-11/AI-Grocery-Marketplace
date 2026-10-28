require('../config/env');
const { prisma, connectDB, disconnectDB } = require('../config/db');
const { ORDER_STATUSES, statusKeyFromLabel } = require('../utils/constants');
const { isUuid } = require('../utils/ids');

async function run() {
  const [id, status] = process.argv.slice(2);

  if (!id || !status || !ORDER_STATUSES.includes(status) || !isUuid(id)) {
    console.error(`Usage: npm run order-status -- <orderId> "<status>"`);
    console.error(`Statuses: ${ORDER_STATUSES.join(', ')}`);
    process.exit(1);
  }

  await connectDB();
  const { count } = await prisma.order.updateMany({
    where: { id },
    data: { status: statusKeyFromLabel(status) },
  });
  console.log(count ? `Order ${id} is now "${status}"` : 'Order not found');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
