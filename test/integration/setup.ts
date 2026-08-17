import { execSync } from 'node:child_process';
import prisma from '@/lib/prisma';

/*
 * Runs once per integration suite. Applies migrations, then truncates every
 * table before each test so cases cannot see one another's rows.
 *
 * TRUNCATE ... RESTART IDENTITY CASCADE is used rather than the seed's
 * reverse-order deleteMany chain: it is a single statement, it does not need to
 * know the dependency order, and it cannot be defeated by a new relation being
 * added to the schema without the list being updated.
 */

// Every table the app owns. Quoted because Prisma maps models to snake_case
// table names via @@map and Postgres folds unquoted identifiers.
const TABLES = [
  'audit_logs',
  'webhook_events',
  'webhooks',
  'secrets',
  'environments',
  'stage_results',
  'pipeline_runs',
  'pipeline_definitions',
  'pipelines',
  'sessions',
  'accounts',
  'verification_tokens',
  'users',
];

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must point at a throwaway database for integration tests.');
  }

  // Guard against someone running this against the database they develop in.
  if (/\bdeplo\b(?!.*test)/.test(process.env.DATABASE_URL) && !process.env.ALLOW_UNSAFE_TEST_DB) {
    throw new Error(
      `Refusing to truncate DATABASE_URL: it does not look like a test database. ` +
      'Point DATABASE_URL at one, or set ALLOW_UNSAFE_TEST_DB=1 if you are sure.',
    );
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
