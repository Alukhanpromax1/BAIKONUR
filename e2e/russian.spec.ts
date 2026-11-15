import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/ru-${name}.png` });

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test('switching to Russian keeps progress and the choice survives a reload', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?scene=designer&seed=42&motion=reduced');
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');

  // Make a design change in English first.
  await page.getByTestId('slot-comms').click();
  await page.getByTestId('option-comms-standard').click();

  // Switch language in the top bar: text changes, progress does not.
  await page.getByTestId('lang-ru').click();
  await expect(page.getByRole('heading', { name: 'Соберите KAZMARS-1' })).toBeVisible();
  await expect(page.getByTestId('option-comms-standard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('meter-power')).toContainText('Питание');
  await shot(page, 'designer');

  // Whole-page content is Russian, not a mix.
  await expect(page.getByRole('button', { name: 'Спланировать запуск' })).toBeVisible();

  // Saved choice survives a reload.
  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  await expect(page.getByRole('heading', { name: 'Соберите KAZMARS-1' })).toBeVisible();
  await page.getByTestId('lang-en').click();
  await expect(page.getByRole('heading', { name: 'Build KAZMARS-1' })).toBeVisible();

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the full mission can be played in Russian without English leaking into the flow', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?seed=42&scenario=hardware&motion=reduced&lang=ru');
  await expect(page.getByTestId('start-mission')).toContainText('Начать миссию');
  await shot(page, 'menu');
  await page.getByTestId('start-mission').click();
  await expect(page.getByRole('heading', { name: 'Изучить пыль и климат Марса.' })).toBeVisible();
  await page.getByTestId('briefing-next').click();
  for (const topic of ['power', 'instruments', 'delay', 'launch']) await page.getByTestId(`topic-${topic}`).click();
  await page.getByTestId('tutorial-done').click();
  await page.getByTestId('objective-dust').click();
  await page.getByTestId('objective-confirm').click();

  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  await page.getByTestId('to-launch').click();
  await page.getByTestId('vehicle-tulpar-l').click();
  await expect(page.getByTestId('issues')).toContainText('Слишком тяжело для ракеты-носителя');
  await page.getByTestId('vehicle-tulpar-m').click();
  await page.getByTestId('to-readiness').click();

  await page.getByTestId('open-evidence').click({ timeout: 30_000 });
  for (const panel of ['compare', 'raw', 'trend']) await page.getByTestId(`evidence-${panel}`).click();
  await page.getByTestId('readiness-cross').click();
  await page.getByTestId('readiness-confirm').click();
  await page.getByTestId('final-scrub').click();
  await page.getByTestId('final-confirm').click();
  await expect(page.getByTestId('readiness-outcome')).toContainText('Остановка на основе данных');
  await shot(page, 'readiness-outcome');
  await page.getByTestId('to-liftoff').click();
  await page.getByTestId('to-operations').click();

  await page.getByTestId('ops-begin').click();
  await page.getByTestId('ops-fast').click();
  for (let i = 0; i < 8; i++) {
    const done = await Promise.race([
      page.getByTestId('ops-complete').waitFor({ timeout: 120_000 }).then(() => true),
      page.locator('[data-testid^="ops-event-"]').waitFor({ timeout: 120_000 }).then(() => false),
    ]);
    if (done) break;
    const id = (await page.locator('[data-testid^="ops-event-"]').getAttribute('data-testid'))!.replace('ops-event-', '');
    await page.getByTestId(`ops-${id === 'conjunction' ? 'reduce' : id === 'power' ? 'full' : 'nominal'}`).click();
    await page.getByTestId('ops-confirm').click();
  }
  await expect(page.getByTestId('ops-complete')).toContainText('завершил миссию');
  await page.getByTestId('to-debrief').click();

  await expect(page.getByTestId('outcome-tier')).toBeVisible();
  await expect(page.getByTestId('cat-decisions')).toContainText('Решение о готовности к запуску');
  await shot(page, 'debrief');
  await page.getByTestId('try-again').click();
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  await expect(page.getByRole('heading', { name: 'Соберите KAZMARS-1' })).toBeVisible();

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
