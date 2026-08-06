import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

/*
 * E2E covers what Jest structurally cannot: every page in app/ is an async
 * server component, and Next's own testing guide states Jest does not support
 * those (node_modules/next/dist/docs/01-app/02-guides/testing/jest.md).
 *
 * So the searchParams/modal contract, proxy.ts's auth gate, and the full
 * server-action -> revalidatePath -> re-render loop are only observable here.
 */

/*
 * Unlike the two Jest tiers, nothing loads a .env for this one: next/jest calls
 * loadEnvConfig for them, but Playwright has no equivalent and does not set
 * NODE_ENV. Without this, global-setup.ts throws on a missing AUTH_SECRET, and
 * would go on to fail connecting with DATABASE_URL undefined.
 *
 * Uses .env.test on its own, deliberately: it carries every variable the run needs
 * (DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY) rather than overriding a base
 * .env. That keeps the tier hermetic — it runs on the same throwaway values CI
 * does instead of inheriting whatever a given developer keeps in .env, so a
 * local failure reproduces what CI sees. Adding a second loadEnv for .env 
 * would put that coupling back.
 *
 * dotenv rather than @next/env, also deliberately: @next/env selects the test
 * environment off `process.env.NODE_ENV === 'test'` alone — its `dev` argument
 * is only consulted otherwise — so steering it here would mean setting NODE_ENV
 * globally, and that leaks into the webServer child below, which has to run a
 * genuine production build.
 *
 * The webServer child inherits all of this through process.env, and Next will
 * not override an inherited variable with a .env file, so the app under test
 * comes up on the same database global-setup.ts prepared.
 */
loadEnv({ path: '.env.test', quiet: true });

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,       // one shared database
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',

  // Mints the session cookie and seeds the user it belongs to.
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // auth.spec.ts belongs to the anonymous project below. Without this it
      // would also run here, where storageState supplies a session, so its
      // "unauthenticated access" block could never hold — it went unnoticed
      // only because those cases were annotated test.fail() at the time.
      testIgnore: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
    {
      // proxy.ts's redirect can only be observed without a session, so the auth
      // spec runs in its own project with no storageState.
      name: 'anonymous',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // A production build, because proxy.ts and server components behave
    // differently under `next dev`.
    command: 'npm run build && npm run start -- --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
