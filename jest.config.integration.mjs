import nextJest from 'next/jest.js';

process.env.TZ = 'UTC';

/*
 * Forced, not defaulted. Jest sets NODE_ENV='test' only when nothing has set it
 * already, and next/jest picks which .env files to load from that value — 'test'
 * loads .env.test ahead of .env, anything else never looks at .env.test at all.
 *
 * So a caller that already has NODE_ENV set silently redirects this tier at the
 * database in .env. That is not hypothetical: the runner dotenv-loads .env (which
 * defines NODE_ENV) and hands a copy to every stage command, so `npm run
 * test:integration` as a pipeline stage resolves DATABASE_URL to the development
 * database and trips the guard in test/integration/setup.ts. Which .env file this
 * tier reads is not the caller's to decide.
 */
process.env.NODE_ENV = 'test';

const createJestConfig = nextJest({ dir: './' });

/*
 * The integration tier runs against a real Postgres. It is a separate config
 * rather than a project inside jest.config.mjs so that it can be run, skipped
 * and scheduled independently — and, more importantly, so there is no chance of
 * the unit tier's manual Prisma mock leaking in here and quietly turning every
 * assertion into a tautology.
 *
 * Requires DATABASE_URL to point at a throwaway database: the setup truncates
 * every table between tests.
 */

/** @type {import('jest').Config} */
const config = {
  // Real Prisma over a real socket — no DOM involved.
  testEnvironment: 'node',

  testMatch: ['**/*.integration.test.ts'],

  setupFiles: ['<rootDir>/test/setup-env.mjs'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // One shared database, so parallel workers would truncate each other's rows
  // mid-test.
  maxWorkers: 1,

  // Migrations on a cold database are slower than the 5s default.
  testTimeout: 30_000,
};

export default createJestConfig(config);
