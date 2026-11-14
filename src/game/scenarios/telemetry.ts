import { createRng } from './rng';

/**
 * SIMULATED TELEMETRY — EDUCATIONAL SCENARIO.
 * Everything in this file is synthetic. It imitates readings from the fictional KAZMARS-1
 * propellant tank during a training countdown. It is not data from any real vehicle.
 */
export type ScenarioId = 'hardware' | 'data-chain' | 'noise';

export const SCENARIO_IDS: ScenarioId[] = ['hardware', 'data-chain', 'noise'];

export const CHANNELS = {
  pressure: { nominal: 17.5, low: 16.8, high: 18.2, unit: 'bar', countsToBar: 0.005 },
  temperature: { nominal: 19.5, low: 14, high: 25, unit: '°C' },
} as const;

export const WINDOW_SECONDS = 120;

/** One telemetry packet as it arrived at the ground station. */
export interface Packet {
  /** Order of arrival. */
  arrival: number;
  /** Sequence counter written by the spacecraft. */
  seq: number;
  /** Timestamp written by the spacecraft, seconds into the recording. */
  time: number;
  /** Raw analogue-to-digital counts from pressure sensor P1. */
  p1Counts: number;
  /** Values shown on the console after ground processing. */
  p1: number;
  p2: number;
  t1: number;
  flags: { duplicate: boolean; outOfOrder: boolean; gapBefore: number };
}

/** One point per second for charts. `null` = no packet for that second. */
export interface Sample {
  time: number;
  p1: number | null;
  p2: number | null;
  t1: number | null;
  /** P1 converted directly from raw counts, bypassing ground processing. */
  p1Raw: number | null;
}

export interface Telemetry {
  seed: number;
  scenario: ScenarioId;
  packets: Packet[];
  samples: Sample[];
}

/** The scenario is chosen by the seed, so a mission can be replayed exactly. */
export function scenarioFromSeed(seed: number): ScenarioId {
  return SCENARIO_IDS[Math.floor(createRng(seed ^ 0x9e3779b9).next() * 3)];
}

const round = (x: number, d: number) => Number(x.toFixed(d));

export function generateTelemetry(seed: number, forced?: ScenarioId): Telemetry {
  const scenario = forced ?? scenarioFromSeed(seed);
  const rng = createRng(seed);
  const P = CHANNELS.pressure;
  const T = CHANNELS.temperature;
  const n = WINDOW_SECONDS;

  const sigmaP = 0.03;
  const sigmaT = 0.06;
  const p2Offset = rng.range(-0.05, 0.05);
  const p1True: number[] = [];
  const p2True: number[] = [];
  const tTrue: number[] = [];

  // Scenario parameters (all drawn up-front so the sequence is stable).
  const onset = scenario === 'hardware' ? rng.int(36, 50) : scenario === 'data-chain' ? rng.int(40, 58) : rng.int(45, 80);
  const leakSlope = -rng.range(0.0115, 0.016); // bar per second
  const coolSlope = -rng.range(0.012, 0.02); // °C per second
  const spike = (rng.next() < 0.65 ? -1 : 1) * rng.range(1.05, 1.45);
  const warmSlope = rng.range(0.004, 0.008);

  for (let i = 0; i < n; i++) {
    let p = P.nominal;
    let t = T.nominal;
    if (scenario === 'hardware' && i > onset) {
      p += leakSlope * (i - onset);
      t += coolSlope * (i - onset);
    }
    if (scenario === 'noise') t += warmSlope * i - warmSlope * 40;
    p1True.push(p + rng.normal() * sigmaP);
    p2True.push(p + p2Offset + rng.normal() * sigmaP);
    tTrue.push(t + rng.normal() * sigmaT);
  }
  if (scenario === 'noise') p1True[onset] += spike;

  // Ground-processing faults for the data-chain scenario.
  const badCal = new Set<number>();
  const duplicated = new Set<number>();
  const missing = new Set<number>();
  const swapped = new Set<number>();
  const calOffset = -rng.range(1.0, 1.4);
  const tempGlitch = rng.range(6, 8.5);
  if (scenario === 'data-chain') {
    const bursts = rng.int(2, 3);
    let cursor = onset;
    for (let b = 0; b < bursts; b++) {
      const len = rng.int(4, 7);
      for (let k = 0; k < len && cursor + k < n - 2; k++) badCal.add(cursor + k);
      cursor += len + rng.int(8, 16);
    }
    const gapStart = onset + rng.int(7, 12);
    const gapLen = rng.int(3, 5);
    for (let k = 0; k < gapLen; k++) if (!badCal.has(gapStart + k)) missing.add(gapStart + k);
    for (let k = 0; k < rng.int(3, 5); k++) {
      const s = rng.int(onset, n - 3);
      if (!missing.has(s)) duplicated.add(s);
    }
    for (let k = 0; k < rng.int(2, 3); k++) {
      const s = rng.int(onset + 2, n - 4);
      if (!missing.has(s) && !missing.has(s + 1) && !duplicated.has(s) && !duplicated.has(s + 1)) swapped.add(s);
    }
  }

  const make = (i: number): Omit<Packet, 'arrival' | 'flags'> => {
    const counts = Math.round(p1True[i] / P.countsToBar);
    const rawBar = counts * P.countsToBar;
    return {
      seq: 1000 + i,
      time: i,
      p1Counts: counts,
      p1: round(badCal.has(i) ? rawBar + calOffset : rawBar, 3),
      p2: round(p2True[i], 3),
      t1: round(badCal.has(i) ? tTrue[i] + tempGlitch : tTrue[i], 2),
    };
  };

  // Build the arrival stream.
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    if (missing.has(i)) continue;
    order.push(i);
    if (duplicated.has(i)) order.push(i);
  }
  for (const s of swapped) {
    const a = order.indexOf(s);
    const b = order.indexOf(s + 1);
    if (a >= 0 && b === a + 1) {
      order[a] = s + 1;
      order[b] = s;
    }
  }
  const packets: Packet[] = [];
  const seen = new Set<number>();
  let lastSeq = 999;
  let maxSeq = 999;
  order.forEach((i, arrival) => {
    const base = make(i);
    const duplicate = seen.has(base.seq);
    const outOfOrder = !duplicate && base.seq < maxSeq;
    const gapBefore = !duplicate && !outOfOrder && base.seq > maxSeq + 1 ? base.seq - maxSeq - 1 : 0;
    packets.push({ ...base, arrival, flags: { duplicate, outOfOrder, gapBefore } });
    seen.add(base.seq);
    lastSeq = base.seq;
    maxSeq = Math.max(maxSeq, base.seq);
  });
  void lastSeq;

  const samples: Sample[] = [];
  for (let i = 0; i < n; i++) {
    if (missing.has(i)) {
      samples.push({ time: i, p1: null, p2: null, t1: null, p1Raw: null });
      continue;
    }
    const p = make(i);
    samples.push({ time: i, p1: p.p1, p2: p.p2, t1: p.t1, p1Raw: round(p.p1Counts * P.countsToBar, 3) });
  }
  return { seed, scenario, packets, samples };
}
