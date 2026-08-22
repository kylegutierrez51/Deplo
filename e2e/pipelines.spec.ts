import { test, expect } from '@playwright/test';

/*
 * The full loop no unit test can reach: a server action writes, revalidatePath
 * invalidates, and the async server component re-renders with the new row.
 */

const unique = (prefix: string) => `${prefix}-${Date.now()}`;

async function createPipeline(page: import('@playwright/test').Page, name: string) {
  await page.goto('/pipelines');
  await page.getByRole('button', { name: /new pipeline/i }).click();

  await expect(page).toHaveURL(/mode=create/);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Repo URL' }).fill('https://github.com/kylegutierrez51/deplo');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
}

test('creates a pipeline and shows it in the table', async ({ page }) => {
  const name = unique('e2e-create');

  await createPipeline(page, name);

  // Closing after a create returns to the bare list route.
  await expect(page).toHaveURL('/pipelines');
  await expect(page.getByText(name)).toBeVisible();
});

test('a created pipeline survives a full reload', async ({ page }) => {
  const name = unique('e2e-persist');

  await createPipeline(page, name);
  // Wait for the post-create navigation to settle before reloading, otherwise
  // the reload can race the router.push back to the bare list route.
  await expect(page).toHaveURL('/pipelines');
  await expect(page.getByText(name)).toBeVisible();

  await page.reload();

  await expect(page.getByText(name)).toBeVisible();
});

test('edits a pipeline and the table reflects it without a manual refresh', async ({ page }) => {
  const name = unique('e2e-edit');
  const renamed = `${name}-renamed`;

  await createPipeline(page, name);

  await page.getByText(name).click();
  await expect(page).toHaveURL(/\?id=/);

  await page.getByRole('button', { name: 'Edit Details' }).click();
  await expect(page).toHaveURL(/mode=edit/);

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(renamed);
  await page.getByRole('button', { name: /save changes/i }).click();

  // onSave in edit mode pushes back to view mode and calls router.refresh(),
  // which is what makes the row behind the modal update.
  await expect(page).toHaveURL(/\?id=[^&]+$/);
  await expect(page.getByText(renamed).first()).toBeVisible();
});

test('deletes a pipeline after the confirmation arms', async ({ page }) => {
  const name = unique('e2e-delete');

  await createPipeline(page, name);
  await page.getByText(name).click();
  await expect(page).toHaveURL(/\?id=/);

  // The modal footer's Delete only opens the confirmation.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  // ConfirmationModal keeps its own Delete inert until it arms — 2s here, since
  // PipelineModal passes timeoutMs={2000} — so the confirmation has to be scoped
  // separately from the footer button, which carries the same name.
  const confirmation = page.locator('[class*="confirmation-container"]');
  await expect(confirmation).toBeVisible();

  // The unarmed button renders `disabled` rather than merely looking inert, so
  // wait for the state itself instead of sleeping past the delay.
  const confirm = confirmation.getByRole('button', { name: 'Delete', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL('/pipelines');
  await expect(page.getByText(name)).toHaveCount(0);
});

// getPipelines maps a pipeline with no runs to 'idle', which has no Prisma
// enum counterpart — it is a fallback, and this is where it surfaces.
test('the created pipeline starts idle, having never run', async ({ page }) => {
  const name = unique('e2e-idle');

  await createPipeline(page, name);

  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row.locator('.pill--idle')).toBeVisible();
});
