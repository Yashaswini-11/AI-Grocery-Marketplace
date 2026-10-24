const cron = require('node-cron');
const Order = require('../models/Order');
const { getReorderSuggestions } = require('../services/reorderService');
const { reminderJobEnabled, reminderCron, reminderTimezone } = require('../config/env');

let running = false;

// Placeholder delivery: logs only. Replace with email/SMS/push when a provider is connected.
function deliverReminder(userId, items) {
  const list = items.map((i) => `${i.product.name} (${i.status})`).join(', ');
  console.log(`[reminders] user ${userId}: time to restock -> ${list}`);
}

async function runReminderJob(now = new Date()) {
  if (running) {
    console.log('[reminders] previous run still in progress, skipping');
    return { checked: 0, notified: 0 };
  }
  running = true;

  try {
    const userIds = await Order.distinct('user');
    let notified = 0;

    for (const userId of userIds) {
      try {
        const { restock } = await getReorderSuggestions(userId, now);
        if (restock.length === 0) continue;
        deliverReminder(userId.toString(), restock);
        notified += 1;
      } catch (err) {
        console.error(`[reminders] failed for user ${userId}:`, err.message);
      }
    }

    console.log(`[reminders] checked ${userIds.length} user(s), ${notified} with items due`);
    return { checked: userIds.length, notified };
  } finally {
    running = false;
  }
}

function startReminderJob() {
  if (!reminderJobEnabled) {
    console.log('[reminders] job disabled (REMINDER_JOB=off)');
    return null;
  }
  if (!cron.validate(reminderCron)) {
    console.error(`[reminders] invalid REMINDER_CRON "${reminderCron}", job not started`);
    return null;
  }

  const task = cron.schedule(
    reminderCron,
    () => {
      runReminderJob().catch((err) => console.error('[reminders] job failed:', err.message));
    },
    { timezone: reminderTimezone }
  );

  console.log(`[reminders] scheduled "${reminderCron}" (${reminderTimezone})`);
  return task;
}

module.exports = { startReminderJob, runReminderJob };