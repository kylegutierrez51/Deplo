import nextJest from 'next/jest.js';

/*
 * Pinned here rather than in setupFiles because V8 caches the zone the first
 * time a Date is formatted, which happens before any setup file runs. This
 * module is evaluated in the main Jest process before the workers are forked,
 * so the workers inherit TZ=UTC from the start.
 *
 * lib/utils/date.ts formats via toLocaleString('en-US'); without this its tests
 * pass on a developer machine and fail on a UTC CI runner.
 */
process.env.TZ = 'UTC';

/*
 * Same reasoning as TZ: pinned so the tier cannot be steered by whatever launched
 * it. Jest sets NODE_ENV='test' only when it is not already set, and next/jest
 * chooses which .env files to load from it — a caller with NODE_ENV=development in
 * its own environment (the runner, which dotenv-loads .env and passes it to every
 * stage command) would have these tests read .env instead of .env.test.
 */
process.env.NODE_ENV = 'test';

// `dir` points next/jest at the app root so it can load next.config.ts (for the
// SWC transform flags, including reactCompiler) and the .env files.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',

  // One jsdom environment for everything. lib/ and runner/ are pure and run
  // fine under jsdom; splitting into projects would mean re-deriving the
  // next/jest transform per project for no gain. The integration tier that
  // genuinely needs `node` has its own config.
  testEnvironment: 'jsdom',

  // setupFiles runs BEFORE the module registry is set up, which is required:
  // lib/utils/crypto.ts reads ENCRYPTION_KEY at module scope and throws if it
  // is missing, so setting it in setupFilesAfterEnv would be too late.
  setupFiles: ['<rootDir>/test/setup-env.mjs'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '\\.integration\\.test\\.ts$',
  ],

  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    'runner/**/*.ts',
    '!**/*.d.ts',
    '!lib/prisma.ts',
    '!runner/connection.ts',
    '!runner/env.ts',
    // Wiring, not logic: these construct a Queue or a Worker at module scope, which
    // means importing them opens an ioredis connection. Same exclusion as lib/prisma.ts.
    '!lib/queue/runs.ts',
    '!runner/index.ts',
    '!runner/stageQueue.ts',
  ],
};

// Exported as a call so next/jest can await the async Next.js config load.
export default createJestConfig(config);
