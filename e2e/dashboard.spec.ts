import { test, expect } from '@playwright/test';

/*
 * "/" used to call auth() and redirect a signed-in visitor to /pipelines. It now
 * renders the dashboard instead, so the root path serves two different pages
 * depending on the session — the login screen without one, an overview with one.
 * That branch is the whole feature, and it is only observable here: app/page.tsx is
 * an async server component, which Jest cannot render, and the anonymous half is
 * asserted in auth.spec.ts, which runs in the project that carries no storageState.
 *
 * The dashboard reads global state — every run, every pending approval, every
 * pipeline — rather than anything scoped to a fixture, and this tier deliberately
 * does not truncate between tests. So these assert the page's structure and the one
 * row a test can put at a known position: a pipeline created seconds ago is the most
 * recently updated one, and the panel is ordered by exactly that.
 */

const unique = (prefix: string) => `${prefix}-${Date.now()}`;

async function createPipeline(page: import('@playwright/test').Page, name: string) {
  await page.goto('/pipelines');
  await page.getByRole('button', { name: /new pipeline/i }).click();

  await expect(page).toHaveURL(/mode=create/);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Repo URL' }).fill('https://github.com/kylegutierrez51/deplo');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL('/pipelines');
}

const panel = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('region', { name });

/*
 * Scoped through the list rather than the panel: every panel header carries a "View
 * all" link of its own, which precedes the rows and would answer to .first().
 */
const firstRow = (page: import('@playwright/test').Page, name: string) =>
  panel(page, name).getByRole('listitem').first().getByRole('link');

test('the root path renders the dashboard rather than redirecting', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

// The session's name is only read for this, and only its first word is used.
test('greets the signed-in user by first name', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText("Here's what your pipelines are doing, E2E."))
    .toBeVisible();
});

test('shows a stat card for each thing worth acting on', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('[class*="cards-row"]');

  for (const label of ['RUNNING', 'QUEUED', 'NEEDS APPROVAL', 'FAILED']) {
    await expect(cards.getByText(label, { exact: true })).toBeVisible();
  }
});

test('shows every panel', async ({ page }) => {
  await page.goto('/');

  for (const name of ['Recent runs', 'Last 7 days', 'Needs approval', 'Pipelines']) {
    await expect(panel(page, name)).toBeVisible();
  }
});

/*
 * Each panel is a capped preview — 8 runs, 4 approvals, 5 pipelines — so the way out
 * to the full list is the thing that makes truncation acceptable rather than lossy.
 * "Last 7 days" has no link because it summarizes rather than lists.
 */
test('every list panel links to its full page', async ({ page }) => {
  await page.goto('/');

  const links: [string, string][] = [
    ['Recent runs', '/runs'],
    ['Needs approval', '/approvals'],
    ['Pipelines', '/pipelines'],
  ];

  for (const [name, href] of links) {
    await expect(panel(page, name).getByRole('link', { name: 'View all' }))
      .toHaveAttribute('href', href);
  }
});

/*
 * getDashboardData maps a pipeline with no runs to 'idle', which has no Prisma enum
 * counterpart — it is invented for exactly this state. The panel is ordered by
 * updatedAt descending, so a pipeline created a moment ago is reliably its first row
 * however much else is in the database.
 */
test('a newly created pipeline leads the pipelines panel, never run', async ({ page }) => {
  const name = unique('e2e-dashboard');

  await createPipeline(page, name);
  await page.goto('/');

  const row = firstRow(page, 'Pipelines');

  await expect(row).toContainText(name);
  await expect(row).toContainText('Idle');
  await expect(row.locator('[class*="dot-idle"]')).toBeVisible();
});

test('a pipeline row opens that pipeline', async ({ page }) => {
  const name = unique('e2e-dashboard-link');

  await createPipeline(page, name);
  await page.goto('/');

  await firstRow(page, 'Pipelines').click();

  await expect(page).toHaveURL(/\/pipelines\?id=/);
});

test.describe('the sidebar entry', () => {
  // A fresh load starts closed and the closed sidebar is translated off-screen.
  const openSidebar = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    return page.locator('aside:has(nav[aria-label="Main"])');
  };

  test('marks the dashboard as the active page', async ({ page }) => {
    await page.goto('/');
    const sidebar = await openSidebar(page);

    await expect(sidebar.locator('li[class*="nav-item-active"]'))
      .toContainText('Dashboard');
  });

  test('navigates back to the dashboard from another page', async ({ page }) => {
    await page.goto('/pipelines');
    const sidebar = await openSidebar(page);

    await sidebar.getByRole('link', { name: 'Dashboard' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
