import snapshot from '@/data/nasa/horizonsSnapshot.json';
import { AU_KM } from '@/data/constants';

/**
 * Access to the cached NASA/JPL Horizons snapshot (see scripts/fetch-horizons.mjs).
 * Columns: [jd_tdb, earth_mars_light_time_s, earth_mars_range_km, earth_mars_range_rate_km_s,
 *           sun_mars_range_km, earth_sun_range_km]
 */
export interface EphemerisSample {
  jd: number;
  /** Earth–Mars one-way light time, s (as reported by Horizons). */
  lightTimeS: number;
  earthMarsKm: number;
  earthMarsRangeRateKmS: number;
  sunMarsKm: number;
  earthSunKm: number;
  earthMarsAu: number;
  sunMarsAu: number;
  /** Sun–Earth–Mars angle, degrees — small values mean Mars is behind the Sun. */
  sepDeg: number;
}

const rows = snapshot.samples as number[][];

export const SNAPSHOT_META = {
  title: snapshot.title,
  organization: snapshot.organization,
  documentation: snapshot.documentation,
  retrievedAt: snapshot.retrievedAt,
  start: snapshot.start,
  stop: snapshot.stop,
  step: snapshot.step,
  note: snapshot.note,
  queries: snapshot.queries as Record<string, { description: string; url: string; apiVersion: string | null }>,
  sampleCount: rows.length,
};

export const EPHEMERIS_START_JD = rows[0][0];
export const EPHEMERIS_END_JD = rows[rows.length - 1][0];
export const EPHEMERIS_STEP_DAYS = rows[1][0] - rows[0][0];

const JD_UNIX_EPOCH = 2440587.5;

export function jdFromIso(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000 + JD_UNIX_EPOCH;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * 86_400_000);
}

export function isoFromJd(jd: number): string {
  return dateFromJd(jd).toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatJd(jd: number): string {
  const d = dateFromJd(jd);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Sun–Earth–Mars angle from the three side lengths of the Sun–Earth–Mars triangle. */
export function sepAngleDeg(earthSunKm: number, earthMarsKm: number, sunMarsKm: number): number {
  const cos = (earthSunKm ** 2 + earthMarsKm ** 2 - sunMarsKm ** 2) / (2 * earthSunKm * earthMarsKm);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function build(jd: number, lt: number, em: number, rr: number, sm: number, es: number): EphemerisSample {
  return {
    jd,
    lightTimeS: lt,
    earthMarsKm: em,
    earthMarsRangeRateKmS: rr,
    sunMarsKm: sm,
    earthSunKm: es,
    earthMarsAu: em / AU_KM,
    sunMarsAu: sm / AU_KM,
    sepDeg: sepAngleDeg(es, em, sm),
  };
}

/** True when the snapshot covers the requested date. */
export function covers(jd: number): boolean {
  return jd >= EPHEMERIS_START_JD && jd <= EPHEMERIS_END_JD;
}

/**
 * Linearly interpolated geometry at a Julian date. Throws outside the snapshot range —
 * the game never extrapolates or substitutes made-up geometry.
 */
export function sampleAt(jd: number): EphemerisSample {
  if (!covers(jd)) {
    throw new Error(`Date ${isoFromJd(jd)} is outside the cached Horizons snapshot (${snapshot.start} … ${snapshot.stop}).`);
  }
  const f = (jd - EPHEMERIS_START_JD) / EPHEMERIS_STEP_DAYS;
  const i = Math.min(rows.length - 2, Math.floor(f));
  const t = f - i;
  const a = rows[i];
  const b = rows[i + 1];
  const mix = (k: number) => a[k] + (b[k] - a[k]) * t;
  return build(jd, mix(1), mix(2), mix(3), mix(4), mix(5));
}

/** All raw snapshot samples between two dates (inclusive). */
export function samplesBetween(jdStart: number, jdEnd: number): EphemerisSample[] {
  const out: EphemerisSample[] = [];
  for (const r of rows) {
    if (r[0] >= jdStart && r[0] <= jdEnd) out.push(build(r[0], r[1], r[2], r[3], r[4], r[5]));
  }
  return out;
}

/** Perihelion, aphelion and mean distance of Mars derived from the snapshot itself. */
export function marsOrbitExtremesAu(): { perihelionAu: number; aphelionAu: number; meanAu: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    min = Math.min(min, r[4]);
    max = Math.max(max, r[4]);
  }
  return { perihelionAu: min / AU_KM, aphelionAu: max / AU_KM, meanAu: (min + max) / 2 / AU_KM };
}
