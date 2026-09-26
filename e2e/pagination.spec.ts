import { test, expect, type Page } from '@playwright/test';

/*
 * The ?page= loop, which lives in async server components Jest cannot render: a page link
 * rewrites the query string, the page re-runs with the new searchParams, and the reader
 * fetches that window. Run on /environments because a spec can make its own rows there
 * through the create modal; eleven of them guarantee a second page at ten rows a page,
 * whatever else earlier specs left behind.
 */

const ROWS_NEEDED = 11;

const pager = (page: Page) => page.getByRole('navigation', { name: 'Pagination' });
const current = (page: Page) => pager(page).locator('[aria-current="page"]');
const modal = (page: Page) => page.locator('.modal-overlay');

async function choose(page: Page, id: string, label: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  const page = await context.newPage();
  const stamp = Date.now();

  for (let i = 0; i < ROWS_NEEDED; i++) {
    await page.goto('/environments?mode=create');
    await page.getByRole('textbox', { name: /name/i }).first().fill(`e2e-page-${stamp}-${i}`);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page).toHaveURL('/environments');
  }

  await context.close();
});

test('a page link moves the window and keeps the reader on it', async ({ page }) => {
  await page.goto('/environments');
  await expect(current(page)).toHaveText('1');
  await expect(page.getByText(/^Showing 1-10 of \d+$/)).toBeVisible();

  await pager(page).getByRole('link', { name: 'Page 2' }).click();

  await expect(page).toHaveURL('/environments?page=2');
  await expect(current(page)).toHaveText('2');
  await expect(page.getByText(/^Showing 11-\d+ of \d+$/)).toBeVisible();
});

test('Prev back to the first page leaves no page param behind', async ({ page }) => {
  await page.goto('/environments?page=2');

  await pager(page).getByRole('link', { name: /Prev/ }).click();

  await expect(page).toHaveURL('/environments');
  await expect(current(page)).toHaveText('1');
});

test('a page past the end serves the last page rather than an empty table', async ({ page }) => {
  const response = await page.goto('/environments?page=999');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  // The last page is the one with no Next link.
  await expect(pager(page).getByRole('link', { name: /Next/ })).toHaveCount(0);
});

test('an unreadable page falls back to the first', async ({ page }) => {
  await page.goto('/environments?page=abc');

  await expect(current(page)).toHaveText('1');
});

test('choosing a filter starts the new result set from its first page', async ({ page }) => {
  await page.goto('/environments?page=2');

  await choose(page, 'environment', 'Production');

  await expect(page).toHaveURL('/environments?environment=production');
});

test('opening and closing a record keeps the page', async ({ page }) => {
  await page.goto('/environments?page=2');

  await page.getByRole('row').nth(1).click();
  await expect(page).toHaveURL(/\/environments\?page=2&id=/);
  await expect(modal(page)).toBeVisible();

  await modal(page).locator('button:has(ion-icon[name="close-outline"])').click();

  await expect(page).toHaveURL('/environments?page=2');
  await expect(current(page)).toHaveText('2');
});
