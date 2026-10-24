const mongoose = require('mongoose');
require('../config/env');
const connectDB = require('../config/db');
const { runReminderJob } = require('../jobs/reorderReminders');

async function run() {
  await connectDB();
  await runReminderJob();
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Reminder run failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});