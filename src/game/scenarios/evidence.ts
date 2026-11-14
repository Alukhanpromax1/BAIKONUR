import { CHANNELS, type ScenarioId, type Telemetry } from './telemetry';

export interface Trend {
  /** Change per minute (least-squares fit over the analysed window). */
  slopePerMin: number;
  /** One-standard-error uncertainty of the slope, per minute. */
  uncertaintyPerMin: number;
  /** True when the slope is clearly larger than its uncertainty. */
  significant: boolean;
}

export interface EvidenceSummary {
  p1: Trend;
  p2: Trend;
  t1: Trend;
  /** Samples of each channel outside its limits. */
  outOfLimits: { p1: number; p2: number; t1: number };
  /** Longest run of consecutive out-of-limit P1 samples. */
  longestRunP1: number;
  /** Pearson correlation of P1 and P2 over the window. */
  correlationP1P2: number;
  /** Mean |P1 − P2| in the final 30 s, bar. */
  lateDisagreementBar: number;
  packets: { total: number; duplicates: number; missing: number; outOfOrder: number; rawMismatch: number };
  /** 10-sample moving average of processed P1 (null until the window fills). */
  movingAverageP1: (number | null)[];
}

const TREND_WINDOW = 60;
export const MOVING_AVERAGE_WINDOW = 10;

function linearTrend(points: { x: number; y: number }[]): Trend {
  const n = points.length;
  if (n < 3) return { slopePerMin: 0, uncertaintyPerMin: Infinity, significant: false };
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const slope = sxy / sxx;
  let sse = 0;
  for (const p of points) sse += (p.y - (my + slope * (p.x - mx))) ** 2;
  const se = Math.sqrt(sse / (n - 2) / sxx);
  return { slopePerMin: slope * 60, uncertaintyPerMin: se * 60, significant: Math.abs(slope) > 4 * se };
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 3) return 0;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let i = 0; i < n; i++) {
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
    sab += (a[i] - ma) * (b[i] - mb);
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

export function movingAverage(values: (number | null)[], window = MOVING_AVERAGE_WINDOW): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1).filter((v): v is number => v !== null);
    return slice.length >= window / 2 ? slice.reduce((s, v) => s + v, 0) / slice.length : null;
  });
}

/** Numbers a careful engineer would read off the three evidence panels. Pure and deterministic. */
export function analyzeEvidence(tm: Telemetry): EvidenceSummary {
  const P = CHANNELS.pressure;
  const T = CHANNELS.temperature;
  const late = tm.samples.slice(-TREND_WINDOW);
  const pts = (key: 'p1' | 'p2' | 't1') =>
    late.filter((s) => s[key] !== null).map((s) => ({ x: s.time, y: s[key] as number }));

  const out = { p1: 0, p2: 0, t1: 0 };
  let run = 0;
  let longest = 0;
  for (const s of tm.samples) {
    const bad = s.p1 !== null && (s.p1 < P.low || s.p1 > P.high);
    if (bad) out.p1++;
    if (s.p2 !== null && (s.p2 < P.low || s.p2 > P.high)) out.p2++;
    if (s.t1 !== null && (s.t1 < T.low || s.t1 > T.high)) out.t1++;
    run = bad ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const both = tm.samples.filter((s) => s.p1 !== null && s.p2 !== null);
  const last30 = both.slice(-30);
  const packets = tm.packets;
  const firstSeq = Math.min(...packets.map((p) => p.seq));
  const lastSeq = Math.max(...packets.map((p) => p.seq));
  const unique = new Set(packets.map((p) => p.seq)).size;

  return {
    p1: linearTrend(pts('p1')),
    p2: linearTrend(pts('p2')),
    t1: linearTrend(pts('t1')),
    outOfLimits: out,
    longestRunP1: longest,
    correlationP1P2: pearson(
      both.map((s) => s.p1 as number),
      both.map((s) => s.p2 as number),
    ),
    lateDisagreementBar: last30.reduce((s, v) => s + Math.abs((v.p1 as number) - (v.p2 as number)), 0) / Math.max(1, last30.length),
    packets: {
      total: packets.length,
      duplicates: packets.filter((p) => p.flags.duplicate).length,
      missing: lastSeq - firstSeq + 1 - unique,
      outOfOrder: packets.filter((p) => p.flags.outOfOrder).length,
      rawMismatch: packets.filter((p) => !p.flags.duplicate && Math.abs(p.p1Counts * P.countsToBar - p.p1) > 0.02).length,
    },
    movingAverageP1: movingAverage(tm.samples.map((s) => s.p1)),
  };
}

/**
 * What the evidence supports, using only what the player can see. Used by tests to prove that
 * each scenario is identifiable from its evidence, and by the debrief to explain the clues.
 */
export function classifyEvidence(e: EvidenceSummary): ScenarioId {
  const chainFaults = e.packets.duplicates + e.packets.missing + e.packets.outOfOrder;
  if (e.packets.rawMismatch >= 3 || chainFaults >= 4) return 'data-chain';
  const bothFalling = e.p1.significant && e.p2.significant && e.p1.slopePerMin < -0.3 && e.p2.slopePerMin < -0.3;
  if (bothFalling && e.longestRunP1 >= 5) return 'hardware';
  return 'noise';
}
