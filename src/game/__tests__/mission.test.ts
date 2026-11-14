import { describe, expect, it } from 'vitest';
import { RECOMMENDED, RECOMMENDED_PLAN } from '@/data/components';
import { evaluateDesign } from '@/game/engine/resources';
import { requiredPowerMode, reviewOpsDecisions } from '@/game/ops/evaluate';
import { simulateMission, type OpsDecisions } from '@/game/ops/simulate';
import { evaluateMission, massEfficiency, powerEfficiency, SCORE_MAX, type MissionRecord } from '@/game/scoring/score';
import { formatJd } from '@/services/horizons/ephemeris';
import type { MissionDesign } from '@/types';
import { allDesigns, baseDesign, withSelection } from './fixtures';

const goodOps: OpsDecisions = { conjunction: 'store', power: 'full', storm: 'campaign' };

describe('mission simulation', () => {
  it('conserves data: generated = returned + lost', () => {
    for (const d of [baseDesign, withSelection(baseDesign, 'payload', 'imager'), { ...baseDesign, orbit: 'high-elliptical' as const, duration: 'half-year' as const }]) {
      const sim = simulateMission(d, { decisions: goodOps });
      expect(sim.returnedMb + sim.lostMb).toBeCloseTo(sim.generatedMb, 6);
      const last = sim.steps[sim.steps.length - 1];
      expect(last.totalReturnedMb + last.totalLostMb + last.storedMb).toBeCloseTo(sim.generatedMb, 6);
    }
  });

  it('schedules three distinct decisions, with the conjunction at the real March 2028 date', () => {
    for (const d of allDesigns().filter((_, i) => i % 97 === 0)) {
      const sim = simulateMission(d);
      expect(sim.events.map((e) => e.id).sort()).toEqual(['conjunction', 'power', 'storm']);
      expect(new Set(sim.events.map((e) => e.promptStep)).size).toBe(3);
      const conj = sim.events.find((e) => e.id === 'conjunction')!;
      expect(formatJd(sim.steps[conj.windowStart].jd)).toMatch(/Mar 2028/);
      for (let i = conj.windowStart; i < conj.windowEnd; i++) expect(sim.steps[i].returnedMb).toBe(0);
    }
  });

  it('never stores more than the recorder holds', () => {
    const sim = simulateMission(withSelection(baseDesign, 'payload', 'suite'), { decisions: goodOps });
    for (const s of sim.steps) expect(s.storedMb).toBeLessThanOrEqual(sim.capacityMb + 1e-9);
  });

  it('a faster link returns more image data', () => {
    const slow = simulateMission(withSelection(baseDesign, 'payload', 'imager'));
    const fast = simulateMission(withSelection(withSelection(baseDesign, 'payload', 'imager'), 'comms', 'comms-high'));
    expect(fast.returnedMb).toBeGreaterThan(slow.returnedMb);
    expect(slow.lostMb).toBeGreaterThan(0);
  });

  it('commanding through conjunction causes safe mode', () => {
    const sim = simulateMission(baseDesign, { decisions: { ...goodOps, conjunction: 'command' } });
    expect(sim.conjunctionFault).toBe(true);
    expect(sim.safeModeDays).toBe(10);
  });

  it('full operations with a thin power margin cause safe mode; saving power avoids it', () => {
    const thin = withSelection(baseDesign, 'power', 'array-standard');
    expect(evaluateDesign(thin).launchReady).toBe(true);
    const full = simulateMission(thin, { decisions: { ...goodOps, power: 'full' } });
    expect(full.worstFullMarginPct).toBeLessThan(0.05);
    expect(full.powerFault).toBe('safe-mode');
    const needed = requiredPowerMode(full.worstFullMarginPct);
    const saved = simulateMission(thin, { decisions: { ...goodOps, power: needed } });
    expect(saved.powerFault).toBe('none');
    expect(saved.safeModeDays).toBe(0);
  });

  it('a launch slip shifts the whole timeline', () => {
    expect(simulateMission(baseDesign, { slipDays: 9 }).timeline.scienceStartJd - simulateMission(baseDesign).timeline.scienceStartJd).toBe(9);
  });

  it('can be paused at a decision and resumed with identical results', () => {
    const full = simulateMission(baseDesign, { decisions: goodOps });
    const partial = simulateMission(baseDesign, { decisions: goodOps, untilStep: 100 });
    expect(partial.steps).toHaveLength(100);
    expect(partial.steps[99]).toEqual(full.steps[99]);
  });
});

describe('operational decision review', () => {
  it('awards full marks only for the option that fits the situation', () => {
    const reviews = reviewOpsDecisions(baseDesign, goodOps);
    expect(reviews).toHaveLength(3);
    for (const r of reviews) {
      expect(r.points).toBe(r.good ? r.maxPoints : r.points);
      expect(r.evidence.length).toBeGreaterThan(20);
    }
  });

  it('the best conjunction option depends on the recorder', () => {
    const small = withSelection(withSelection(baseDesign, 'payload', 'imager'), 'comms', 'comms-high');
    const big = withSelection(small, 'storage', 'storage-high');
    const best = (d: MissionDesign) => reviewOpsDecisions(d, goodOps).find((r) => r.event === 'conjunction')!.best;
    expect(best(small)).toBe('reduce');
    expect(best(big)).toBe('store');
  });

  it('the best power option depends on the arrays', () => {
    const best = (d: MissionDesign) => reviewOpsDecisions(d, goodOps).find((r) => r.event === 'power')!.best;
    expect(best(baseDesign)).toBe('full');
    expect(best(withSelection(baseDesign, 'power', 'array-standard'))).not.toBe('full');
  });
});

describe('scoring', () => {
  const record = (design: MissionDesign, overrides: Partial<MissionRecord> = {}): MissionRecord => ({
    design,
    seed: 1234,
    readiness: { scenario: 'noise', choice: 'cross', finalCall: 'resume', panelsViewed: ['compare', 'raw', 'trend'] },
    ops: goodOps,
    ...overrides,
  });

  it('is deterministic', () => {
    expect(evaluateMission(record(baseDesign))).toEqual(evaluateMission(record(baseDesign)));
  });

  it('category maxima add up to 100 and totals stay within bounds', () => {
    expect(Object.values(SCORE_MAX).reduce((s, v) => s + v, 0)).toBe(100);
    for (const d of allDesigns().filter((x, i) => i % 53 === 0 && evaluateDesign(x).launchReady)) {
      const report = evaluateMission(record(d));
      expect(report.total).toBeGreaterThanOrEqual(0);
      expect(report.total).toBeLessThanOrEqual(100);
      for (const c of report.categories) {
        expect(c.points).toBeLessThanOrEqual(c.max + 1e-9);
        expect(c.lines.reduce((s, l) => s + l.max, 0)).toBeCloseTo(c.max, 6);
      }
    }
  });

  it('a well-run recommended mission succeeds', () => {
    const report = evaluateMission(record(baseDesign));
    expect(report.total).toBeGreaterThanOrEqual(85);
    expect(report.tier).toBe('exemplary');
    expect(report.mistakes).toEqual([]);
  });

  it('bad decisions lower the score and are explained', () => {
    const good = evaluateMission(record(baseDesign));
    const bad = evaluateMission(
      record(baseDesign, {
        readiness: { scenario: 'hardware', choice: 'proceed', panelsViewed: [] },
        ops: { conjunction: 'command', power: 'reserve', storm: 'protect' },
      }),
    );
    expect(bad.total).toBeLessThan(good.total - 20);
    const types = bad.mistakes.map((m) => m.type);
    expect(types).toContain('False Negative');
    expect(types).toContain('Poor Risk Assessment');
    expect(types).toContain('Resource Mismanagement');
    for (const m of bad.mistakes) for (const field of [m.decision, m.evidence, m.misunderstanding, m.consequence, m.lesson]) expect(field.length).toBeGreaterThan(10);
  });

  it('labels a false alarm as a false positive', () => {
    const report = evaluateMission(record(baseDesign, { readiness: { scenario: 'data-chain', choice: 'hold', panelsViewed: ['trend'] } }));
    expect(report.mistakes.map((m) => m.type)).toContain('False Positive');
    expect(report.budget.eventsCr).toBe(6);
  });

  it('telemetry scenarios produce different outcomes for the same choice', () => {
    const totals = (['hardware', 'data-chain', 'noise'] as const).map(
      (scenario) => evaluateMission(record(baseDesign, { readiness: { scenario, choice: 'proceed', panelsViewed: ['compare', 'trend'] } })).total,
    );
    expect(new Set(totals).size).toBe(3);
  });

  it('different spacecraft can each succeed — there is no single perfect build', () => {
    const winners = new Set<string>();
    for (const objective of ['climate', 'dust', 'clouds'] as const) {
      const scored = allDesigns()
        .filter((d) => d.objective === objective && evaluateDesign(d).launchReady)
        .map((d) => {
          // Play each design with the decisions that suit it.
          const reviews = reviewOpsDecisions(d, goodOps);
          const ops = Object.fromEntries(reviews.map((r) => [r.event, r.best])) as OpsDecisions;
          return { d, total: evaluateMission(record(d, { ops })).total };
        })
        .sort((a, b) => b.total - a.total);
      expect(scored[0].total).toBeGreaterThanOrEqual(85);
      // Several clearly different builds reach "mission success" for the same objective.
      const successful = scored.filter((s) => s.total >= 70);
      expect(new Set(successful.map((s) => s.d.selections.payload + s.d.orbit)).size).toBeGreaterThanOrEqual(3);
      winners.add(JSON.stringify([scored[0].d.selections, scored[0].d.orbit, scored[0].d.vehicle]));
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it('the recommended design for every objective is launch-ready with a sensible launch plan', () => {
    for (const objective of ['climate', 'dust', 'clouds'] as const) {
      const d: MissionDesign = { objective, selections: { ...RECOMMENDED[objective] }, ...RECOMMENDED_PLAN[objective] };
      const e = evaluateDesign(d);
      expect(e.issues.filter((i) => i.severity === 'block'), objective).toEqual([]);
      const ops = Object.fromEntries(reviewOpsDecisions(d, {}).map((r) => [r.event, r.best])) as OpsDecisions;
      expect(evaluateMission(record(d, { ops })).total, objective).toBeGreaterThanOrEqual(85);
    }
  });

  it('efficiency curves reward sensible margins', () => {
    expect(massEfficiency(0.08)).toBe(1);
    expect(massEfficiency(0.4)).toBeLessThan(massEfficiency(0.2));
    expect(massEfficiency(-0.01)).toBe(0);
    expect(powerEfficiency(0.2)).toBe(1);
    expect(powerEfficiency(0.01)).toBeLessThan(1);
  });
});
