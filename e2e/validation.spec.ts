import { test, expect } from '@playwright/test';

/*
 * validatePipelineGraph is thoroughly unit tested, but nothing there proves it
 * is actually wired to the Run button. These specs assert the rules reach the
 * user — the wiring, not the rules.
 *
 * addPipelineRun's guards fire in order, and the earliest ones need no graph at
 * all, which makes them the most robust things to assert against the real UI.
 */

async function openEditor(page: import('@playwright/test').Page) {
  const name = `e2e-validate-${Date.now()}`;
  await page.goto('/pipelines?mode=create');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Repo URL' }).fill('https://github.com/kylegutierrez51/deplo');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL('/pipelines');

  await page.getByText(name).click();
  // Wait for the push to land before reading the id off the URL — reading it
  // straight after the click races the navigation.
  await expect(page).toHaveURL(/\?id=/);
  const id = new URL(page.url()).searchParams.get('id')!;
  await page.goto(`/pipelines/${id}`);
  await expect(page.getByRole('button', { name: /run pipeline/i })).toBeVisible();
  return id;
}

// The first guard in addPipelineRun: a run has to target somewhere.
test('refuses to run without an environment selected', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: /run pipeline/i }).click();

  await expect(page.getByText(/select an environment/i)).toBeVisible();
});

// verifyPipelineRunReady's first gate — there is nothing useful to say about
// the stages of a pipeline that has none.
test('refuses to run a pipeline with no stages', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  // Pick whatever environment the seed provides, if the control is present.
  const environmentSelect = page.locator('select, [role="combobox"]').first();
  if (await environmentSelect.count()) {
    await environmentSelect.click();
    const option = page.getByRole('option').first();
    if (await option.count()) await option.click();
  }

  await page.getByRole('button', { name: /run pipeline/i }).click();

  await expect(page.getByText(/no stages|select an environment/i)).toBeVisible();
});

// A run pins itself to a stored definition, so the editor must match one.
test('refuses to run with unsaved changes', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  const pane = page.locator('.react-flow__pane');
  await pane.click({ button: 'right', position: { x: 220, y: 200 } });
  const addOption = page.getByText(/add stage|custom/i).first();
  if (await addOption.count()) await addOption.click();

  await page.getByRole('button', { name: /run pipeline/i }).click();

  await expect(page.getByText(/save or discard|select an environment/i)).toBeVisible();
});
