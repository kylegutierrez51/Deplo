import { test, expect } from '@playwright/test';

const mainSidebar = (page: import('@playwright/test').Page) =>
  page.locator('aside:has(nav[aria-label="Main"])');

test('a fresh load starts closed', async ({ page }) => {
  await page.goto('/pipelines');

  await expect(mainSidebar(page)).toHaveClass(/sidebar-closed/);
});

test('the sidebar stays open across a client-side navigation', async ({ page }) => {
  await page.goto('/pipelines');

  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(mainSidebar(page)).toHaveClass(/sidebar-open/);


  // from run history modal
  await mainSidebar(page).getByRole('link', { name: 'Run History' }).click();
  await expect(page).toHaveURL('/runs');
  await expect(mainSidebar(page)).toHaveClass(/sidebar-open/);
});
