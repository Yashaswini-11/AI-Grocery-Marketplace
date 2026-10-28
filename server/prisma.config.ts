import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Not needed for `prisma generate`, so Docker builds work without a database
    url: process.env.DATABASE_URL ?? '',
  },
});
