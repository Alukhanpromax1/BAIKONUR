import { describe, expect, it } from 'vitest';
import { resolveReadiness, READINESS_MAX_POINTS, type FinalCall, type PrimaryChoice } from '@/game/scenarios/decision';
import { analyzeEvidence, classifyEvidence, movingAverage } from '@/game/scenarios/evidence';
import { createRng } from '@/game/scenarios/rng';
import { CHANNELS, generateTelemetry, scenarioFromSeed, SCENARIO_IDS, WINDOW_SECONDS, type ScenarioId } from '@/game/scenarios/telemetry';

describe('seeded randomness', () => {
  it('is reproducible', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(generateTelemetry(777)).toEqual(generateTelemetry(777));
  });

  it('different seeds produce different telemetry and all three scenarios occur', () => {
    expect(generateTelemetry(1).samples).not.toEqual(generateTelemetry(2).samples);
    const counts: Record<string, number> = {};
    for (let s = 0; s < 600; s++) counts[scenarioFromSeed(s)] = (counts[scenarioFromSeed(s)] ?? 0) + 1;
    for (const id of SCENARIO_IDS) expect(counts[id]).toBeGreaterThan(120);
  });
});

describe('telemetry scenarios', () => {
  it('always raises a pressure alarm, whatever the hidden cause', () => {
    for (const scenario of SCENARIO_IDS) {
      for (let seed = 1; seed <= 60; seed++) {
        const e = analyzeEvidence(generateTelemetry(seed, scenario));
        expect(e.outOfLimits.p1, `${scenario} seed ${seed}`).toBeGreaterThan(0);
      }
    }
  });

  it('hardware: independent sensors fall together with temperature, and packets are clean', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const e = analyzeEvidence(generateTelemetry(seed, 'hardware'));
      expect(e.p1.slopePerMin).toBeLessThan(-0.4);
      expect(e.p2.slopePerMin).toBeLessThan(-0.4);
      expect(e.t1.slopePerMin).toBeLessThan(-0.4);
      expect(e.correlationP1P2).toBeGreaterThan(0.9);
      expect(e.packets.rawMismatch + e.packets.duplicates + e.packets.missing + e.packets.outOfOrder).toBe(0);
    }
  });

  it('data chain: raw and processed values disagree and packets are damaged, while P2 stays in limits', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const tm = generateTelemetry(seed, 'data-chain');
      const e = analyzeEvidence(tm);
      expect(e.packets.rawMismatch).toBeGreaterThanOrEqual(3);
      expect(e.packets.duplicates + e.packets.missing + e.packets.outOfOrder).toBeGreaterThanOrEqual(4);
      expect(e.outOfLimits.p2).toBe(0);
      // Raw counts never left the limits: the abnormal values exist only after processing.
      for (const s of tm.samples) if (s.p1Raw !== null) expect(s.p1Raw).toBeGreaterThan(CHANNELS.pressure.low);
    }
  });

  it('noise: exactly one isolated abnormal sample and no trend', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const e = analyzeEvidence(generateTelemetry(seed, 'noise'));
      expect(e.outOfLimits.p1).toBe(1);
      expect(e.longestRunP1).toBe(1);
      expect(e.outOfLimits.p2).toBe(0);
      expect(Math.abs(e.p2.slopePerMin)).toBeLessThan(0.1);
      expect(e.packets.rawMismatch).toBe(0);
    }
  });

  it('abnormal readings are kept, never silently removed', () => {
    const tm = generateTelemetry(5, 'noise');
    const values = tm.samples.map((s) => s.p1 as number);
    expect(tm.samples).toHaveLength(WINDOW_SECONDS);
    expect(Math.max(...values.map((v) => Math.abs(v - CHANNELS.pressure.nominal)))).toBeGreaterThan(1);
  });

  it('each scenario can be identified from the evidence alone', () => {
    for (const scenario of SCENARIO_IDS) {
      for (let seed = 1; seed <= 300; seed++) {
        expect(classifyEvidence(analyzeEvidence(generateTelemetry(seed, scenario))), `${scenario} seed ${seed}`).toBe(scenario);
      }
    }
  });

  it('moving average smooths a single spike', () => {
    const avg = movingAverage([1, 1, 1, 1, 1, 1, 1, 1, 1, 11], 10);
    expect(avg[8]).toBeNull();
    expect(avg[9]).toBe(2);
  });
});

describe('launch-readiness outcomes', () => {
  const all = ['compare', 'raw', 'trend'] as const;
  const resolve = (scenario: ScenarioId, choice: PrimaryChoice, finalCall?: FinalCall, panels: readonly ('compare' | 'raw' | 'trend')[] = all) =>
    resolveReadiness({ scenario, choice, finalCall, panelsViewed: [...panels] });

  it('the three scenarios reward three different calls', () => {
    expect(resolve('hardware', 'cross', 'scrub').points).toBe(READINESS_MAX_POINTS);
    expect(resolve('data-chain', 'cross', 'resync').points).toBe(READINESS_MAX_POINTS);
    expect(resolve('noise', 'cross', 'resume').points).toBe(READINESS_MAX_POINTS);
  });

  it('neither engineer is automatically right', () => {
    // Arman's hold is the best call for a real leak …
    expect(resolve('hardware', 'hold').verdict).toBe('correct');
    // … and a false alarm for the other two.
    expect(resolve('data-chain', 'hold').verdict).toBe('false-positive');
    expect(resolve('noise', 'hold').verdict).toBe('false-positive');
    // Dana's cross-check only pays off when the conclusion is right.
    expect(resolve('hardware', 'cross', 'resume').verdict).toBe('false-negative');
    expect(resolve('data-chain', 'cross', 'scrub').verdict).toBe('false-positive');
  });

  it('proceeding with a real leak is caught by the Flight Director and is the worst outcome', () => {
    const o = resolve('hardware', 'proceed');
    expect(o.points).toBe(0);
    expect(o.verdict).toBe('false-negative');
    expect(o.slipDays).toBeGreaterThan(resolve('hardware', 'hold').slipDays);
    expect(o.narrative).toMatch(/Flight Director/);
  });

  it('the fastest decision is not always rewarded', () => {
    for (const scenario of SCENARIO_IDS) {
      const best = Math.max(resolve(scenario, 'cross', 'scrub').points, resolve(scenario, 'cross', 'resync').points, resolve(scenario, 'cross', 'resume').points);
      expect(resolve(scenario, 'proceed', undefined, []).points).toBeLessThan(best);
    }
  });

  it('evidence quality changes the result of the same choice', () => {
    expect(resolve('noise', 'proceed', undefined, all).points).toBeGreaterThan(resolve('noise', 'proceed', undefined, []).points);
    expect(resolve('hardware', 'hold', undefined, all).points).toBeGreaterThan(resolve('hardware', 'hold', undefined, []).points);
    expect(resolve('noise', 'proceed', undefined, []).verdict).toBe('lucky');
  });

  it('an unfixed data-chain fault degrades the early downlink', () => {
    expect(resolve('data-chain', 'proceed').degradedLinkDays).toBe(30);
    expect(resolve('data-chain', 'cross', 'resync').degradedLinkDays).toBe(0);
  });

  it('is deterministic', () => {
    expect(resolve('noise', 'cross', 'resync')).toEqual(resolve('noise', 'cross', 'resync'));
  });
});
