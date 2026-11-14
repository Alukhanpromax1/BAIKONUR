import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png` });

/** Collects console errors so a test fails if the game logs any. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function playOperations(page: Page, choices: Record<string, string>) {
  await page.getByTestId('ops-begin').click();
  await page.getByTestId('ops-fast').click();
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    const which = await Promise.race([
      page.getByTestId('ops-complete').waitFor({ timeout: 120_000 }).then(() => 'complete'),
      page.locator('[data-testid^="ops-event-"]').waitFor({ timeout: 120_000 }).then(() => 'event'),
    ]);
    if (which === 'complete') break;
    const id = (await page.locator('[data-testid^="ops-event-"]').getAttribute('data-testid'))!.replace('ops-event-', '');
    seen.push(id);
    await shot(page, `06-ops-event-${id}`);
    await page.getByTestId(`ops-${choices[id]}`).click();
    await page.getByTestId('ops-confirm').click();
    await expect(page.getByTestId(`ops-event-${id}`)).toHaveCount(0);
  }
  await expect(page.getByTestId('ops-complete')).toBeVisible();
  return seen;
}

test('full mission: menu → briefing → design → resource check → readiness → evidence → decision → Mars operations → debrief → replay', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?seed=42&scenario=hardware&motion=reduced');

  // Main menu
  await expect(page.getByRole('heading', { name: /BAIKONUR:\s*MISSION CONTROL/i })).toBeVisible();
  await expect(page.getByText('EVERY DECISION HAS A CONSEQUENCE.')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('data-renderer', '3d');
  await shot(page, '01-intro');
  await page.getByTestId('start-mission').click();

  // Mission briefing + tutorial
  await expect(page.getByRole('heading', { name: 'Study the dust and climate of Mars.' })).toBeVisible();
  await expect(page.getByTestId('light-time')).toHaveText(/\d+ min \d\d s/);
  await shot(page, '02-briefing');
  await page.getByTestId('briefing-next').click();
  for (const topic of ['power', 'instruments', 'delay', 'launch']) {
    await page.getByTestId(`topic-${topic}`).click();
    if (topic === 'delay') {
      await page.getByTestId('send-command').click();
      await expect(page.getByText(/Round trip: \d+ min/)).toBeVisible();
      await shot(page, '02-briefing-tutorial');
    }
  }
  await page.getByTestId('tutorial-done').click();
  await page.getByTestId('objective-dust').click();
  await shot(page, '02-briefing-objective');
  await page.getByTestId('objective-confirm').click();

  // Spacecraft design: resources respond to choices
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  const mass = page.getByTestId('meter-mass');
  const power = page.getByTestId('meter-power');
  const massBefore = await mass.innerText();
  const powerBefore = await power.innerText();
  await page.getByTestId('slot-comms').click();
  await page.getByTestId('option-comms-standard').click();
  await expect(mass).not.toHaveText(massBefore);
  await expect(power).not.toHaveText(powerBefore);
  await page.getByTestId('slot-power').click();
  await page.getByTestId('option-array-standard').click();
  await page.getByTestId('meter-power').click();
  await expect(page.getByText('Remaining power margin')).toBeVisible();
  await shot(page, '03-designer');
  await page.getByTestId('meter-power').click();
  await page.getByTestId('use-recommended').click();
  await expect(page.getByTestId('science-potential')).toContainText('Dust storm watch');
  await page.getByTestId('to-launch').click();

  // Launch plan + resource check
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'launch');
  await page.getByTestId('vehicle-tulpar-l').click();
  await expect(page.getByTestId('issues')).toContainText('Too heavy for the launch vehicle');
  await expect(page.getByTestId('meter-mass')).toHaveAttribute('data-status', 'over');
  await expect(page.getByTestId('to-readiness')).toBeDisabled();
  await shot(page, '04-launch-blocked');
  await page.getByTestId('vehicle-tulpar-m').click();
  await expect(page.getByTestId('to-readiness')).toBeEnabled();
  await page.getByTestId('section-orbit').click();
  await page.getByTestId('orbit-low-polar').click();
  await shot(page, '04-launch-orbit');
  await page.getByTestId('to-readiness').click();

  // Launch readiness → anomaly
  await expect(page.getByTestId('sim-label')).toHaveText('SIMULATED TELEMETRY — EDUCATIONAL SCENARIO');
  await page.getByTestId('open-evidence').click({ timeout: 30_000 });
  await shot(page, '05-readiness-evidence-start');

  // Evidence investigation
  for (const panel of ['compare', 'raw', 'trend']) {
    await page.getByTestId(`evidence-${panel}`).click();
    await expect(page.getByTestId(`chart-${panel}`).locator('svg').first()).toBeVisible();
    await shot(page, `05-readiness-${panel}`);
  }
  await expect(page.getByTestId('packet-log')).toHaveCount(0);

  // Mission decision: cross-validate, then recommend a scrub (correct for a hardware fault)
  await page.getByTestId('readiness-cross').click();
  await page.getByTestId('readiness-confirm').click();
  await expect(page.getByTestId('evidence-summary')).toBeVisible();
  await page.getByTestId('final-scrub').click();
  await shot(page, '05-readiness-final');
  await page.getByTestId('final-confirm').click();
  const outcome = page.getByTestId('readiness-outcome');
  await expect(outcome).toContainText('Evidence-based hold');
  await expect(outcome).toContainText('Genuine hardware anomaly');
  await expect(outcome).toContainText('Decision quality 18/18');
  await shot(page, '05-readiness-outcome');
  await page.getByTestId('to-liftoff').click();
  await expect(page.getByTestId('liftoff')).toContainText('LIFTOFF');
  await shot(page, '05-liftoff');
  await page.getByTestId('to-operations').click();

  // Mars operations
  await expect(page.getByTestId('ops-start')).toBeVisible();
  await expect(page.getByTestId('ops-lighttime')).toHaveText(/\d+ min \d\d s/);
  const events = await playOperations(page, { conjunction: 'reduce', power: 'full', storm: 'nominal' });
  expect(events.sort()).toEqual(['conjunction', 'power', 'storm']);
  await shot(page, '06-ops-complete');
  await page.getByTestId('to-debrief').click();

  // Debrief
  await expect(page.getByTestId('outcome-tier')).toBeVisible();
  const score = Number(await page.getByTestId('score-total').getAttribute('data-score'));
  expect(score).toBeGreaterThanOrEqual(70);
  expect(score).toBeLessThanOrEqual(100);
  await expect(page.getByTestId('cat-decisions')).toContainText('Evidence-based hold');
  await expect(page.getByTestId('chart-mission').locator('svg').first()).toBeVisible();
  await expect(page.getByTestId('seed')).toHaveText('Scenario seed 42');
  await shot(page, '07-debrief');

  // NASA source information is reachable from the game
  await page.getByRole('button', { name: 'Data sources' }).click();
  await expect(page.getByTestId('source-horizons')).toContainText('JPL Horizons');
  await expect(page.getByTestId('source-mcs-reference')).toContainText('11 Watts');
  await expect(page.getByTestId('source-mcs-pds')).toContainText('NOT INTEGRATED');
  await expect(page.getByTestId('live-reading')).toContainText(/Live from JPL Horizons|Cached snapshot/);
  await shot(page, '08-sources');
  await page.getByRole('button', { name: 'Close' }).click();

  // Replay: back to the design bay with the same spacecraft and a new scenario
  await page.getByTestId('try-again').click();
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  await expect(page.getByTestId('resource-dashboard')).toBeVisible();

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the three hidden scenarios give different outcomes for the same choice', async ({ page }) => {
  const headlines: string[] = [];
  for (const scenario of ['hardware', 'data-chain', 'noise']) {
    await page.goto(`/?scene=readiness&seed=7&scenario=${scenario}&motion=reduced`);
    await page.getByTestId('open-evidence').click({ timeout: 30_000 });
    await page.getByTestId('readiness-proceed').click();
    await page.getByTestId('readiness-confirm').click();
    const outcome = page.getByTestId('readiness-outcome');
    await expect(outcome).toBeVisible();
    headlines.push(await outcome.getByRole('heading', { level: 1 }).innerText());
    if (scenario === 'data-chain') {
      await page.goto(`/?scene=readiness&seed=7&scenario=${scenario}&motion=reduced`);
      await page.getByTestId('open-evidence').click({ timeout: 30_000 });
      await page.getByTestId('evidence-raw').click();
      await expect(page.getByTestId('packet-log')).toContainText('raw ≠ console');
      await shot(page, '05-readiness-raw-datachain');
    }
  }
  expect(headlines[0]).toBe('Countdown stopped by the Flight Director');
  expect(new Set(headlines).size).toBeGreaterThanOrEqual(2);
});

test('team mode: each role proposes, the Director confirms', async ({ page }) => {
  await page.goto('/?scene=briefing&motion=reduced');
  await page.getByTestId('briefing-next').click();
  await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('players-3').click();
  const confirm = page.getByTestId('objective-confirm');
  await expect(confirm).toBeDisabled();
  await page.getByTestId('objective-climate').click();
  await page.getByTestId('objective-dust').click();
  await expect(confirm).toBeDisabled();
  await page.getByTestId('objective-climate').click();
  await expect(page.getByText('The team is split — Mission Director decides')).toBeVisible();
  await shot(page, '09-team-decision');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.locator('.app')).toHaveAttribute('data-scene', 'designer');
  await expect(page.getByText(/Lead: Player 2/)).toBeVisible();
});

test('2D fallback keeps the game playable without WebGL', async ({ page }) => {
  await page.goto('/?nowebgl=1&scene=designer&motion=reduced');
  await expect(page.locator('.app')).toHaveAttribute('data-renderer', '2d');
  await expect(page.getByTestId('fallback-2d')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Spacecraft schematic' })).toBeVisible();
  const mass = await page.getByTestId('meter-mass').innerText();
  await page.getByTestId('slot-power').click();
  await page.getByTestId('option-array-standard').click();
  await expect(page.getByTestId('meter-mass')).not.toHaveText(mass);
  await shot(page, '10-fallback-2d');
});

test('no horizontal overflow on a phone-sized screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  for (const scene of ['intro', 'briefing', 'designer', 'launch', 'readiness', 'operations', 'debrief']) {
    await page.goto(`/?scene=${scene}&motion=reduced&seed=42`);
    await page.waitForTimeout(scene === 'readiness' ? 3500 : 1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${scene} overflows horizontally`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/screens/mobile-${scene}.png` });
  }
  await context.close();
});
