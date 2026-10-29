// Runs before every test file. Sets the environment BEFORE the app loads its config.
// dotenv never overrides variables that are already set, so these values win over server/.env.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/grocery_test';
process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL || 'false';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.REMINDER_JOB = 'off';
process.env.NODE_ENV = 'test';

// Safety net: the tests empty every table, so refuse to run against anything but a test database.
const dbName = new URL(process.env.DATABASE_URL).pathname.replace('/', '');
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run tests on database "${dbName}". The database name must contain "test".`
  );
}
