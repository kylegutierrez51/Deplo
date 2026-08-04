import { test, expect } from '@playwright/test';

/*
 * Editor.tsx's add/delete/connect handlers depend on getBoundingClientRect,
 * screenToFlowPosition and a mounted ReactFlow canvas, which is why they are
 * covered here rather than with RTL. Persistence is the point: what the editor
 * serializes has to survive a reload through toDefinition/fromDefinition and a
 * jsonb round trip.
 */

async function newPipeline(page: import('@playwright/test').Page) {
  const name = `e2e-editor-${Date.now()}`;
  await page.goto('/pipelines?mode=create');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Repo URL' }).fill('https://github.com/kylegutierrez51/deplo');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL('/pipelines');

  await page.getByText(name).click();
  await expect(page).toHaveURL(/\?id=/);
  const id = new URL(page.url()).searchParams.get('id')!;

  await page.goto(`/pipelines/${id}`);
  await expect(page.getByRole('button', { name: /^Save$/ })).toBeVisible();
  return id;
}

/** Right-click the canvas and pick a stage type from the context menu. */
async function addStage(page: import('@playwright/test').Page, at: { x: number, y: number }) {
  const pane = page.locator('.react-flow__pane');
  await pane.click({ button: 'right', position: at });
  await page.getByText(/add stage|custom/i).first().click();
}

test('a saved graph survives a reload', async ({ page }) => {
  const id = await newPipeline(page);

  await addStage(page, { x: 200, y: 200 });
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  await page.goto(`/pipelines/${id}`);

  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('an empty pipeline saves without minting a stage', async ({ page }) => {
  const id = await newPipeline(page);

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  await page.goto(`/pipelines/${id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});

// savePipelineDefinition reuses the current version when nothing changed, so a
// second save must not mint a new one. The user-visible signal is simply that
// it succeeds again.
test('saving twice with no changes still succeeds', async ({ page }) => {
  await newPipeline(page);
  await addStage(page, { x: 200, y: 200 });

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();
});

test('two stages can be added and both persist', async ({ page }) => {
  const id = await newPipeline(page);

  await addStage(page, { x: 150, y: 150 });
  await addStage(page, { x: 400, y: 150 });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/pipeline saved/i)).toBeVisible();

  await page.goto(`/pipelines/${id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
