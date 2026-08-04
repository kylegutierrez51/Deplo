import nextJest from 'next/jest.js';

process.env.TZ = 'UTC';

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
