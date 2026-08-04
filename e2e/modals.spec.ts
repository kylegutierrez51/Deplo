import { test, expect } from '@playwright/test';

/*
 * The ?id=&mode= contract, which is duplicated verbatim across seven pages:
 *
 *   mode === "create"            -> create
 *   record && mode === "edit"    -> edit
 *   record                       -> view
 *   otherwise                    -> no modal
 *
 * The fall-through cases are the interesting ones, and they live in async
 * server components that Jest cannot render.
 */

const modal = (page: import('@playwright/test').Page) => page.locator('.modal-overlay');

test.describe('the query-param contract', () => {
  test('no params shows no modal', async ({ page }) => {
    await page.goto('/environments');

    await expect(modal(page)).toHaveCount(0);
  });

  test('mode=create opens a modal with no record', async ({ page }) => {
    await page.goto('/environments?mode=create');

    await expect(modal(page)).toBeVisible();
  });

  // mode=edit needs a record to resolve against, so it falls all the way
  // through to null rather than opening an empty editor.
  test('mode=edit with no id opens nothing', async ({ page }) => {
    await page.goto('/environments?mode=edit');

    await expect(modal(page)).toHaveCount(0);
  });

  // A stale bookmark to a deleted record is a 200 with no modal, not a 404 —
  // the id simply resolves to undefined.
  test('an id that does not exist opens nothing and does not 404', async ({ page }) => {
    const response = await page.goto('/environments?id=does-not-exist');

    expect(response?.status()).toBe(200);
    await expect(modal(page)).toHaveCount(0);
  });

  test('an unrecognised mode with a valid id falls through to view', async ({ page }) => {
    await page.goto('/environments?mode=create');
    await page.getByRole('textbox', { name: /name/i }).first().fill(`e2e-modal-${Date.now()}`);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page).toHaveURL('/environments');

    // Open the record to capture its id, then re-enter with a nonsense mode.
    await page.getByRole('row').nth(1).click();
    await expect(page).toHaveURL(/\?id=/);
    const id = new URL(page.url()).searchParams.get('id');

    await page.goto(`/environments?mode=garbage&id=${id}`);

    // View mode, so the edit affordance is present and the save one is not.
    await expect(modal(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Edit$/ })).toBeVisible();
  });
});

test.describe('the contract holds on every page that uses it', () => {
  for (const path of ['/pipelines', '/runs', '/audits', '/environments', '/secrets', '/webhooks', '/webhooks/events']) {
    test(`${path} opens nothing for a bad id`, async ({ page }) => {
      const response = await page.goto(`${path}?id=nope`);

      expect(response?.status()).toBe(200);
      await expect(modal(page)).toHaveCount(0);
    });
  }
});
