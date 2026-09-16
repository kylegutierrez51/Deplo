import { test, expect } from '@playwright/test';

/*
 * Runs in the "anonymous" project, which carries no storageState — proxy.ts's
 * gate is only observable without a session, and nothing else in the suite can
 * see it. app/page.tsx's inverse branch is checked with a session below.
 */

/*
 * These carried test.fail() while the auth gate did not work in a production
 * build: an unauthenticated GET /secrets returned 200 under
 * `next build && next start` while correctly returning 307 under `next dev`,
 * and an anonymous GET "/" redirected to /pipelines as though auth() had found
 * a session. Deployed as-is, every route was publicly readable.
 *
 * The cause was not proxy.ts, which was where the original note looked. It was
 * trustHost: @auth/core defaults it to `NODE_ENV !== "production"` unless one
 * of AUTH_URL / AUTH_TRUST_HOST / VERCEL / CF_PAGES is set, so under a
 * production build every auth() call through auth.config.ts threw UntrustedHost
 * and proxy.ts could not gate anything. Setting trustHost on the shared config
 * can fix both symptoms at once, but Deplo uses it in the .env and cy.yml env section.
 *
 * Kept as ordinary assertions now. They are the regression test for that fix:
 * the gate is only observable from a project with no storageState, and only
 * under a production build, so nothing else in the suite would catch it coming
 * back.
 */
test.describe('unauthenticated access', () => {
  // proxy.ts matches everything except api/auth, _next and the favicon, and
  // should bounce any pathname other than "/" back to the login page.
  for (const path of ['/pipelines', '/runs', '/secrets', '/environments', '/webhooks', '/audits', '/approvals']) {
    test(`${path} redirects to the login page`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL('/');
    });
  }

  test('a deep link with query params is still gated', async ({ page }) => {
    await page.goto('/secrets?id=whatever&mode=edit');

    await expect(page).toHaveURL('/');
  });

  // The inverse of the authenticated case below: app/page.tsx calls auth() and
  // only renders the dashboard when it finds a session, so an anonymous visitor
  // has to stay on "/" and be offered the sign-in.
  test('the login page renders the sign-in affordance', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  /*
   * "/" is the one pathname proxy.ts does not gate, and it now serves real data
   * rather than a redirect — so the page's own `if (!session)` branch is the
   * only thing standing between an anonymous visitor and a readout of every
   * pipeline, run and pending approval. Nothing upstream would catch losing it.
   */
  test('the dashboard is not rendered without a session', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Recent runs' })).toHaveCount(0);
  });
});

test.describe('authenticated access', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  /*
   * app/page.tsx serves the dashboard to a signed-in visitor, so the sign-in is
   * never shown to someone who already has a session. It used to redirect to
   * /pipelines here instead; the dashboard's own behaviour is in dashboard.spec.ts,
   * and this is only the half that pairs with the anonymous case above.
   */
  test('the login page gives way to the dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Login' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('a gated route is reachable', async ({ page }) => {
    await page.goto('/pipelines');

    await expect(page).toHaveURL('/pipelines');
    await expect(page.getByRole('heading', { name: 'Pipelines' })).toBeVisible();
  });
});
