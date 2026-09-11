import { test, expect } from '@playwright/test';

const mainSidebar = (page: import('@playwright/test').Page) =>
  page.locator('aside:has(nav[aria-label="Main"])');

test('the Webhooks page links to Webhook Events and back', async ({ page }) => {
  await page.goto('/webhooks');

  await page.getByRole('link', { name: 'View Events' }).click();
  await expect(page).toHaveURL('/webhooks/events');
  await expect(page.getByRole('heading', { name: 'Webhook Events' })).toBeVisible();

  // Events is a sub-page of Webhooks, so the sidebar keeps Webhooks highlighted
  const webhooksItem = mainSidebar(page).getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: 'Webhooks', exact: true }) });
  await expect(webhooksItem).toHaveClass(/nav-item-active/);

  // the Topbar back-link, not the sidebar item of the same name
  await page.getByRole('link', { name: 'Webhooks', exact: true })
    .filter({ has: page.locator('ion-icon[name="arrow-back-outline"]') })
    .click();
  await expect(page).toHaveURL('/webhooks');
});
