import { test, expect, type Page } from '@playwright/test';

/*
 * The URL-driven filter loop, which lives in async server components that Jest cannot
 * render: choosing an option rewrites the query string, the page re-runs with the new
 * searchParams, and the data reader narrows the query. Run on /environments because a spec
 * can make its own row there through the create modal, and a new environment defaults to
 * the Production type.
 */

const listbox = (page: Page, id: string) => page.locator(`#${id}`);
const modal = (page: Page) => page.locator('.modal-overlay');

async function choose(page: Page, id: string, label: string) {
  await listbox(page, id).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function createEnvironment(page: Page) {
  const name = `e2e-filter-${Date.now()}`;
  await page.goto('/environments?mode=create');
  await page.getByRole('textbox', { name: /name/i }).first().fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL('/environments');
  return name;
}

test('a filter in the URL narrows the rows the server returns', async ({ page }) => {
  const name = await createEnvironment(page);

  await page.goto('/environments?environment=staging');
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
  await expect(listbox(page, 'environment')).toContainText('Staging');

  await page.goto('/environments?environment=production');
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
});

test('choosing an option rewrites the URL and re-renders the list', async ({ page }) => {
  const name = await createEnvironment(page);

  await choose(page, 'environment', 'Staging');
  await expect(page).toHaveURL('/environments?environment=staging');
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);

  await choose(page, 'environment', 'Production');
  await expect(page).toHaveURL('/environments?environment=production');
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

  // The default option is written as no param at all.
  await choose(page, 'environment', 'All environment types');
  await expect(page).toHaveURL('/environments');
});

test('opening and closing a record keeps the filter', async ({ page }) => {
  const name = await createEnvironment(page);
  await page.goto('/environments?environment=production');

  await page.getByRole('row', { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/environments\?environment=production&id=/);
  await expect(modal(page)).toBeVisible();

  await modal(page).locator('button:has(ion-icon[name="close-outline"])').click();

  await expect(page).toHaveURL('/environments?environment=production');
  await expect(listbox(page, 'environment')).toContainText('Production');
});

test('back navigation moves the listbox with the URL', async ({ page }) => {
  await page.goto('/environments?environment=development');
  await expect(listbox(page, 'environment')).toContainText('Development');

  // A client-side navigation to the unfiltered page, then back: the same mounted listbox
  // has to follow the URL rather than keep the value it last showed.
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Environments' }).click();
  await expect(page).toHaveURL('/environments');
  await expect(listbox(page, 'environment')).toContainText('All environment types');

  await page.goBack();
  await expect(page).toHaveURL('/environments?environment=development');
  await expect(listbox(page, 'environment')).toContainText('Development');
});

test('an unrecognised value falls back to the default', async ({ page }) => {
  const response = await page.goto('/environments?environment=nope&updated=forever');

  expect(response?.status()).toBe(200);
  await expect(listbox(page, 'environment')).toContainText('All environment types');
  await expect(listbox(page, 'updated')).toContainText('Updated any time');
});
