const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('@prisma/client');
const { databaseUrl, databaseSsl } = require('./env');

// Prisma's migration tool accepts "?sslmode=require" in DATABASE_URL, but the node-postgres driver
// would then insist on verifying the server certificate. SSL for the app is controlled by
// DATABASE_SSL instead, so the sslmode parameter is removed before connecting.
function withoutSslMode(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return url;
  }
}

// One shared client for the whole process (it manages its own connection pool).
//
// Pool settings suit serverless databases such as Neon, which suspend after a few idle minutes:
// idle connections are closed early (before the database sleeps), and the first request after a
// sleep gets up to 20 seconds to wake the database instead of failing straight away.
const adapter = new PrismaPg({
  connectionString: withoutSslMode(databaseUrl),
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 20000,
  ...(databaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
const prisma = new PrismaClient({ adapter });

async function connectDB() {
  await prisma.$queryRaw`SELECT 1`;
  const [{ current_database: name }] = await prisma.$queryRaw`SELECT current_database()`;
  console.log(`PostgreSQL connected (database: ${name})`);
}

async function disconnectDB() {
  await prisma.$disconnect();
}

module.exports = { prisma, Prisma, connectDB, disconnectDB };
