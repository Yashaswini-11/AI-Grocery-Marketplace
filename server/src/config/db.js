const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('@prisma/client');
const { databaseUrl, databaseSsl } = require('./env');

// One shared client for the whole process (it manages its own connection pool).
const adapter = new PrismaPg({
  connectionString: databaseUrl,
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
