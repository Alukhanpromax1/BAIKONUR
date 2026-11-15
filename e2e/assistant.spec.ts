import { expect, test } from '@playwright/test';

test('MISSION AI explains the current stage and never makes a decision for the player', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=designer&seed=42&motion=reduced');
  await page.getByTestId('open-ai').click();
  const ai = page.getByTestId('mission-ai');
  await expect(ai).toBeVisible();
  await expect(ai).toContainText('Design bay');
  await expect(ai).toContainText('Next objective');
  await page.screenshot({ path: 'test-results/screens/mission-ai.png' });
  // The assistant has no decision buttons.
  await expect(ai.getByRole('button', { name: /Confirm|Send the plan|Hold/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(ai).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('info icons explain key metrics in plain language', async ({ page }) => {
  await page.goto('/?scene=designer&seed=42&motion=reduced');
  const tip = page.getByTestId('info-power_margin').first();
  await tip.hover();
  await expect(tip.locator('.infotip__pop')).toHaveText(/Shows how much additional electrical power/);
});

test('Beginner and Expert modes are labelled in plain words', async ({ page }) => {
  await page.goto('/?scene=briefing&motion=reduced');
  await page.getByTestId('briefing-next').click();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('mode-guided')).toHaveText('Beginner');
  await expect(page.getByTestId('mode-advanced')).toHaveText('Expert');
});
