/** One row of a JPL Horizons vector table in VEC_TABLE=6 format. */
export interface HorizonsRow {
  /** Julian Day Number, Barycentric Dynamical Time. */
  jd: number;
  /** One-way down-leg Newtonian light-time, seconds. */
  lightTimeS: number;
  /** Range (distance from the coordinate centre), km. */
  rangeKm: number;
  /** Range-rate (radial velocity), km/s. */
  rangeRateKmS: number;
}

/**
 * Parses the text returned by the Horizons API for EPHEM_TYPE='VECTORS', VEC_TABLE='6'.
 * Throws when the response contains no ephemeris block, so callers never use invented values.
 */
export function parseHorizonsVectors(text: string): HorizonsRow[] {
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0 || eoe < soe) {
    throw new Error('Horizons response does not contain an ephemeris block ($$SOE … $$EOE).');
  }
  const lines = text
    .slice(soe + 5, eoe)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: HorizonsRow[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const jd = Number(lines[i].split(/\s+/)[0]);
    const m = lines[i + 1].match(/LT=\s*([-+0-9.Ee]+)\s+RG=\s*([-+0-9.Ee]+)\s+RR=\s*([-+0-9.Ee]+)/);
    if (!m || !Number.isFinite(jd)) throw new Error(`Unparseable Horizons rows near: ${lines[i]}`);
    rows.push({ jd, lightTimeS: Number(m[1]), rangeKm: Number(m[2]), rangeRateKmS: Number(m[3]) });
  }
  if (rows.length === 0) throw new Error('Horizons response contained an empty ephemeris block.');
  return rows;
}

/** Builds the query string for a VEC_TABLE 6 request. */
export function buildHorizonsQuery(opts: { target: string; center: string; start: string; stop: string; step: string }): string {
  const p: Record<string, string> = {
    format: 'text',
    COMMAND: `'${opts.target}'`,
    OBJ_DATA: `'NO'`,
    MAKE_EPHEM: `'YES'`,
    EPHEM_TYPE: `'VECTORS'`,
    CENTER: `'${opts.center}'`,
    START_TIME: `'${opts.start}'`,
    STOP_TIME: `'${opts.stop}'`,
    STEP_SIZE: `'${opts.step}'`,
    VEC_TABLE: `'6'`,
  };
  return Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}
