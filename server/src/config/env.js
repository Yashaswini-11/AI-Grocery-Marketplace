require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy server/.env.example to server/.env and fill in the values.'
  );
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  // Set DATABASE_SSL=true for managed Postgres such as AWS RDS
  databaseSsl: (process.env.DATABASE_SSL || '').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // AI is optional: the shop works without it
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash',

  // Restock reminder job (set REMINDER_JOB=off to disable)
  reminderJobEnabled: (process.env.REMINDER_JOB || 'on').toLowerCase() !== 'off',
  reminderCron: process.env.REMINDER_CRON || '0 9 * * *',
  reminderTimezone: process.env.REMINDER_TZ || 'Asia/Kolkata',
};