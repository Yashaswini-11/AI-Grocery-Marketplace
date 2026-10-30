require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { runReminderJob } = require('../jobs/reorderReminders');

async function run() {
  await connectDB();
  await runReminderJob();
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('Reminder run failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
