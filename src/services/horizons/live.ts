import { AU_KM } from '@/data/constants';
import { buildHorizonsQuery, parseHorizonsVectors } from './parse';
import { covers, jdFromIso, sampleAt, SNAPSHOT_META } from './ephemeris';

export interface LightTimeReading {
  /** 'live' = fetched from the JPL Horizons API just now; 'cached' = from the dated snapshot. */
  status: 'live' | 'cached';
  /** Date the geometry refers to (UTC calendar day, 00:00 TDB). */
  epochIso: string;
  /** When the value was retrieved from JPL. */
  retrievedAt: string;
  oneWayLightTimeS: number;
  rangeKm: number;
  rangeAu: number;
  rangeRateKmS: number;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Tries to read today's Earth–Mars geometry live from JPL Horizons through the same-origin
 * proxy (/api/horizons). On any failure it falls back to the cached snapshot and says so:
 * the returned `status` is always shown to the player.
 */
export async function fetchCurrentLightTime(now: Date = new Date(), timeoutMs = 6000): Promise<LightTimeReading> {
  const start = isoDay(now);
  const stop = isoDay(new Date(now.getTime() + 86_400_000));
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`/api/horizons?${buildHorizonsQuery({ target: '499', center: '500@399', start, stop, step: '1d' })}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const row = parseHorizonsVectors(await res.text())[0];
    return {
      status: 'live',
      epochIso: start,
      retrievedAt: new Date().toISOString(),
      oneWayLightTimeS: row.lightTimeS,
      rangeKm: row.rangeKm,
      rangeAu: row.rangeKm / AU_KM,
      rangeRateKmS: row.rangeRateKmS,
    };
  } catch {
    return cachedLightTime(now);
  }
}

/** Reads the same quantity from the cached snapshot (clamped to the snapshot's date range). */
export function cachedLightTime(now: Date = new Date()): LightTimeReading {
  let iso = isoDay(now);
  if (!covers(jdFromIso(iso))) iso = jdFromIso(iso) < jdFromIso(SNAPSHOT_META.start) ? SNAPSHOT_META.start : SNAPSHOT_META.stop;
  const s = sampleAt(jdFromIso(iso));
  return {
    status: 'cached',
    epochIso: iso,
    retrievedAt: SNAPSHOT_META.retrievedAt,
    oneWayLightTimeS: s.lightTimeS,
    rangeKm: s.earthMarsKm,
    rangeAu: s.earthMarsAu,
    rangeRateKmS: s.earthMarsRangeRateKmS,
  };
}
