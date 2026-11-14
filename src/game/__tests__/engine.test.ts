import { describe, expect, it } from 'vitest';
import { COMPONENT_BY_ID } from '@/data/components';
import { AU_KM, C_KM_S, GAME, MARS_MEAN_SUN_DISTANCE_AU } from '@/data/constants';
import { computeBudget } from '@/game/engine/budget';
import { downlinkRateKbps, downlinkVolumeMb, formatLightTime, lightTimeFromRangeS, roundTripS } from '@/game/engine/comms';
import { computeTimeline, hohmannTransferDays } from '@/game/engine/duration';
import { computeMass, propellantForDeltaV } from '@/game/engine/mass';
import { arrayPowerW, computePower, solarIrradianceWm2 } from '@/game/engine/power';
import { evaluateDesign } from '@/game/engine/resources';
import { sciencePotential } from '@/game/engine/science';
import { marsOrbitExtremesAu, sampleAt, samplesBetween, jdFromIso, SNAPSHOT_META } from '@/services/horizons/ephemeris';
import { parseHorizonsVectors } from '@/services/horizons/parse';
import type { MissionDesign } from '@/types';
import { allDesigns, baseDesign, withSelection } from './fixtures';

describe('mass', () => {
  it('sums the bus and every selected component', () => {
    const m = computeMass(baseDesign);
    const expected = GAME.busMassKg + Object.values(baseDesign.selections).reduce((s, id) => s + COMPONENT_BY_ID[id].massKg, 0);
    expect(m.dryKg).toBe(expected);
    expect(m.lines.reduce((s, l) => s + l.kg, 0)).toBe(expected);
  });

  it('solves the rocket equation', () => {
    // Δv = Isp·g0·ln(2) doubles the mass, so propellant equals dry mass.
    const dv = (300 * 9.80665 * Math.log(2)) / 1000;
    expect(propellantForDeltaV(400, dv, 300)).toBeCloseTo(400, 6);
    expect(propellantForDeltaV(400, 0, 300)).toBe(0);
  });

  it('a heavier spacecraft needs more propellant and more launch capacity', () => {
    const light = computeMass(baseDesign);
    const heavy = computeMass(withSelection(baseDesign, 'comms', 'comms-high'));
    expect(heavy.dryKg - light.dryKg).toBe(17);
    expect(heavy.propellantKg).toBeGreaterThan(light.propellantKg);
    expect(heavy.wetKg - light.wetKg).toBeGreaterThan(17);
  });

  it('wet mass = dry mass + propellant and margin = capacity − wet mass', () => {
    const m = computeMass(baseDesign);
    expect(m.wetKg).toBeCloseTo(m.dryKg + m.propellantKg, 9);
    expect(m.marginKg).toBeCloseTo(m.capacityKg - m.wetKg, 9);
    expect(m.launchOk).toBe(m.marginKg >= 0);
  });
});

describe('power', () => {
  it('follows the inverse-square law', () => {
    expect(solarIrradianceWm2(1)).toBe(1361);
    expect(solarIrradianceWm2(2)).toBeCloseTo(1361 / 4, 9);
    // Mars at its mean distance receives ~43 % of the sunlight Earth does.
    expect(solarIrradianceWm2(MARS_MEAN_SUN_DISTANCE_AU)).toBeCloseTo(586.3, 0);
  });

  it('array output scales with area', () => {
    expect(arrayPowerW(11, 1.5) / arrayPowerW(7, 1.5)).toBeCloseTo(11 / 7, 9);
  });

  it('separates instrument, bus and subsystem consumption', () => {
    const p = computePower(baseDesign);
    expect(p.instrumentW).toBe(11);
    expect(p.busW).toBe(GAME.busPowerW);
    expect(p.instrumentW + p.busW + p.subsystemW).toBe(p.consumptionW);
    expect(p.marginW).toBeCloseTo(p.availableW - p.consumptionW, 9);
    expect(Object.values(GAME.busPowerSplit).reduce((s, v) => s + v, 0)).toBe(GAME.busPowerW);
  });

  it('gives less power in an orbit with more shadow and farther from the Sun', () => {
    const low = computePower(baseDesign);
    const high = computePower({ ...baseDesign, orbit: 'high-elliptical' });
    expect(high.availableW).toBeGreaterThan(low.availableW);
    expect(computePower(baseDesign, 1.666).availableW).toBeLessThan(low.availableW);
  });
});

describe('budget', () => {
  it('adds spacecraft, launch, operations and event costs', () => {
    const b = computeBudget(baseDesign, 8);
    expect(b.totalCr).toBe(b.spacecraftCr + b.launchCr + b.operationsCr + 8);
    expect(b.lines.reduce((s, l) => s + l.cr, 0)).toBe(b.totalCr);
    expect(b.remainingCr).toBe(GAME.budgetCapCr - b.totalCr);
  });

  it('a longer mission costs more to operate', () => {
    expect(computeBudget(baseDesign).operationsCr).toBeGreaterThan(computeBudget({ ...baseDesign, duration: 'half-year' }).operationsCr);
  });
});

describe('communications', () => {
  it('keeps units consistent: kbps × hours → megabits', () => {
    // 100 kbps for 1 hour = 100 000 bit/s × 3600 s = 360 000 000 bit = 360 Mb
    expect(downlinkVolumeMb(100, 1)).toBe(360);
  });

  it('data rate falls with distance squared', () => {
    expect(downlinkRateKbps(420, 1)).toBe(420);
    expect(downlinkRateKbps(420, 2)).toBe(105);
  });

  it('round-trip delay is twice the one-way delay', () => {
    expect(roundTripS(661)).toBe(1322);
    expect(formatLightTime(660.9)).toBe('11 min 01 s');
  });
});

describe('JPL Horizons snapshot', () => {
  it('is a dated, attributed cache', () => {
    expect(SNAPSHOT_META.organization).toMatch(/Jet Propulsion Laboratory/);
    expect(SNAPSHOT_META.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(SNAPSHOT_META.queries.earth_to_mars.url).toContain("VEC_TABLE='6'");
  });

  it('light time reported by Horizons agrees with range ÷ c', () => {
    for (const s of samplesBetween(jdFromIso('2027-01-01'), jdFromIso('2029-12-01'))) {
      expect(Math.abs(s.lightTimeS - lightTimeFromRangeS(s.earthMarsKm))).toBeLessThan(0.01);
    }
    expect(C_KM_S).toBe(299792.458);
  });

  it('matches the value retrieved live on 2026-11-14 (LT = 660.900 s)', () => {
    const s = sampleAt(jdFromIso('2026-11-14'));
    expect(s.lightTimeS).toBeCloseTo(660.9, 0);
    expect(s.earthMarsKm / AU_KM).toBeCloseTo(1.3244, 3);
  });

  it('contains the March 2028 solar conjunction', () => {
    const s = sampleAt(jdFromIso('2028-03-21'));
    expect(s.sepDeg).toBeLessThan(1);
    expect(s.earthMarsAu).toBeGreaterThan(2.3);
  });

  it('gives Mars a mean solar distance of about 1.524 AU', () => {
    const o = marsOrbitExtremesAu();
    expect(o.perihelionAu).toBeCloseTo(1.381, 2);
    expect(o.aphelionAu).toBeCloseTo(1.666, 2);
    expect(o.meanAu).toBeCloseTo(MARS_MEAN_SUN_DISTANCE_AU, 3);
  });

  it('refuses to extrapolate outside the cached range', () => {
    expect(() => sampleAt(jdFromIso('2035-01-01'))).toThrow(/outside the cached Horizons snapshot/);
  });

  it('parses the documented VEC_TABLE 6 text format', () => {
    const text = `$$SOE\n2461358.500000000 = A.D. 2026-Nov-14 00:00:00.0000 TDB \n LT= 6.609002008856986E+02 RG= 1.981328957162174E+08 RR=-1.471230887194740E+01\n$$EOE`;
    const [row] = parseHorizonsVectors(text);
    expect(row.jd).toBe(2461358.5);
    expect(row.lightTimeS).toBeCloseTo(660.9002, 4);
    expect(row.rangeKm).toBeCloseTo(198132895.716, 2);
    expect(row.rangeRateKmS).toBeCloseTo(-14.7123, 4);
    expect(() => parseHorizonsVectors('no data')).toThrow();
  });
});

describe('mission duration', () => {
  it('estimates a Hohmann transfer of about 259 days', () => {
    expect(hohmannTransferDays()).toBe(259);
  });

  it('builds the seven-phase timeline in order', () => {
    const t = computeTimeline(baseDesign);
    expect(t.phases.map((p) => p.id)).toEqual(['preparation', 'launch', 'transit', 'arrival', 'commissioning', 'science', 'evaluation']);
    expect(t.scienceEndJd - t.launchJd).toBe(t.totalDays);
    expect(computeTimeline(baseDesign, 3).launchJd - t.launchJd).toBe(3);
  });
});

describe('mission compatibility', () => {
  it('accepts the recommended design', () => {
    const e = evaluateDesign(baseDesign);
    expect(e.launchReady).toBe(true);
    expect(e.issues.filter((i) => i.severity === 'block')).toEqual([]);
  });

  it('blocks a spacecraft that is too heavy for its launch vehicle and explains why', () => {
    const e = evaluateDesign({ ...baseDesign, vehicle: 'tulpar-l' });
    expect(e.launchReady).toBe(false);
    const issue = e.issues.find((i) => i.title === 'Too heavy for the launch vehicle');
    expect(issue?.explain).toMatch(/Tulpar-L can send only 480 kg/);
    expect(e.status.mass).toBe('over');
  });

  it('blocks a design whose power demand exceeds supply', () => {
    let d = withSelection(baseDesign, 'power', 'array-standard');
    d = withSelection(withSelection(withSelection(d, 'comms', 'comms-high'), 'payload', 'suite'), 'storage', 'storage-high');
    d = withSelection(d, 'propulsion', 'prop-high');
    const e = evaluateDesign(d);
    expect(e.issues.find((i) => i.resource === 'power')?.explain).toMatch(/needs 550 W, but the arrays deliver only 548 W/);
    expect(e.power.marginW).toBeLessThan(0);
    expect(e.issues.some((i) => i.resource === 'power' && i.severity === 'block')).toBe(true);
  });

  it('blocks a design whose tanks are too small for the orbit', () => {
    const e = evaluateDesign({ ...baseDesign, orbit: 'mid-inclined' });
    expect(e.mass.tankOk).toBe(false);
    expect(e.issues.some((i) => i.title === 'Not enough propellant capacity')).toBe(true);
  });

  it('blocks a design that is over budget', () => {
    let d: MissionDesign = { ...baseDesign, vehicle: 'tulpar-h' };
    for (const [slot, id] of [['payload', 'suite'], ['comms', 'comms-high'], ['storage', 'storage-high'], ['propulsion', 'prop-high']] as const) d = withSelection(d, slot, id);
    const e = evaluateDesign(d);
    expect(e.budget.ok).toBe(false);
    expect(e.status.budget).toBe('over');
  });

  it('warns when the downlink cannot keep up with an imaging payload', () => {
    const d = withSelection(withSelection(baseDesign, 'payload', 'imager'), 'comms', 'comms-standard');
    const e = evaluateDesign(d);
    expect(e.issues.some((i) => i.resource === 'comms')).toBe(true);
  });

  it('every objective has at least one launch-ready design, and no design suits all objectives best', () => {
    const designs = allDesigns().filter((d) => evaluateDesign(d).launchReady);
    const best: Record<string, string> = {};
    for (const objective of ['climate', 'dust', 'clouds'] as const) {
      const ready = designs.filter((d) => d.objective === objective);
      expect(ready.length).toBeGreaterThan(20);
      const top = ready
        .map((d) => ({ d, s: sciencePotential(d, computeTimeline(d).scienceDays).potential * evaluateDesign(d).comms.predictedReturn }))
        .sort((a, b) => b.s - a.s)[0];
      best[objective] = `${top.d.selections.payload}/${top.d.orbit}`;
    }
    expect(new Set(Object.values(best)).size).toBeGreaterThan(1);
  });
});
