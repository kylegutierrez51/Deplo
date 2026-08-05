import { defineConfig, devices } from '@playwright/test';

/*
 * E2E covers what Jest structurally cannot: every page in app/ is an async
 * server component, and Next's own testing guide states Jest does not support
 * those (node_modules/next/dist/docs/01-app/02-guides/testing/jest.md).
 *
 * So the searchParams/modal contract, proxy.ts's auth gate, and the full
 * server-action -> revalidatePath -> re-render loop are only observable here.
 */

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
