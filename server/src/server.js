const { port } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');
const { startReminderJob } = require('./jobs/reorderReminders');

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
  const reminderTask = startReminderJob();

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);

    if (reminderTask) reminderTask.stop();
    server.close(async () => {
      try {
        await disconnectDB();
      } finally {
        process.exit(0);
      }
    });
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
}

start();