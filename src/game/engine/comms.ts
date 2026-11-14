import { C_KM_S } from '@/data/constants';

/**
 * Unit conventions used everywhere in the game:
 *   data rate ........ kilobits per second (kbps), 1 kbps = 1 000 bit/s
 *   data volume ...... megabits (Mb) = 1 000 000 bit, gigabits (Gb) = 1 000 Mb
 *   time ............. seconds for light time, hours for contact time, days for the mission
 * Bytes are never used, so there is no bit/byte conversion to get wrong.
 */

/** Downlink rate at a given Earth–Mars distance: received power falls with distance squared. */
export function downlinkRateKbps(rateAt1AuKbps: number, earthMarsAu: number): number {
  if (!(earthMarsAu > 0)) throw new Error('Earth–Mars distance must be positive.');
  return rateAt1AuKbps / earthMarsAu ** 2;
}

/** Megabits delivered in a contact: rate × time. kbps × s = kb; ÷ 1000 = Mb. */
export function downlinkVolumeMb(rateKbps: number, contactHours: number): number {
  return (rateKbps * contactHours * 3600) / 1000;
}

/** Light-travel time for a distance, s. Used only for cross-checks against the Horizons LT value. */
export function lightTimeFromRangeS(rangeKm: number): number {
  return rangeKm / C_KM_S;
}

export function roundTripS(oneWayS: number): number {
  return oneWayS * 2;
}

/** "11 min 01 s" */
export function formatLightTime(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

/** Formats megabits with a sensible unit. */
export function formatData(mb: number): string {
  if (Math.abs(mb) >= 1000) return `${(mb / 1000).toFixed(mb >= 100_000 ? 0 : 1)} Gb`;
  return `${Math.round(mb)} Mb`;
}

export function formatRate(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${kbps.toFixed(kbps < 10 ? 1 : 0)} kbps`;
}
