#!/usr/bin/env node
/**
 * Fetches Earth–Mars / Sun–Mars / Earth–Sun geometry from the NASA/JPL Horizons API
 * (vector ephemeris, VEC_TABLE=6 → one-way light time LT, range RG, range-rate RR)
 * and writes a dated snapshot used by the game when the live API is not reachable.
 *
 * Usage:  npm run data:horizons
 * Behind an HTTPS proxy run with NODE_USE_ENV_PROXY=1.
 * No API key is required for the public JPL endpoint.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const START = '2026-11-01';
const STOP = '2030-03-01';
const STEP = '2d';

const QUERIES = [
  { id: 'earth_to_mars', target: '499', center: '500@399', label: 'Mars (499) as seen from Earth geocenter (500@399)' },
  { id: 'sun_to_mars', target: '499', center: '500@10', label: 'Mars (499) as seen from the Sun (500@10)' },
  { id: 'earth_to_sun', target: '10', center: '500@399', label: 'Sun (10) as seen from Earth geocenter (500@399)' },
];

function buildUrl(q) {
  const p = {
    format: 'text',
    COMMAND: `'${q.target}'`,
    OBJ_DATA: `'NO'`,
    MAKE_EPHEM: `'YES'`,
    EPHEM_TYPE: `'VECTORS'`,
    CENTER: `'${q.center}'`,
    START_TIME: `'${START}'`,
    STOP_TIME: `'${STOP}'`,
    STEP_SIZE: `'${STEP}'`,
    VEC_TABLE: `'6'`,
  };
  return `${API}?${Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

function parse(text) {
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) throw new Error('Horizons response has no $$SOE/$$EOE block:\n' + text.slice(0, 600));
  const lines = text.slice(soe + 5, eoe).trim().split('\n');
  const rows = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const jd = Number(lines[i].trim().split(/\s+/)[0]);
    const m = lines[i + 1].match(/LT=\s*([-+0-9.E]+)\s+RG=\s*([-+0-9.E]+)\s+RR=\s*([-+0-9.E]+)/);
    if (!m || !Number.isFinite(jd)) throw new Error('Unparseable Horizons rows: ' + lines[i] + ' / ' + lines[i + 1]);
    rows.push({ jd, lt: Number(m[1]), rg: Number(m[2]), rr: Number(m[3]) });
  }
  const header = (re) => (text.match(re) || [])[1]?.trim() ?? null;
  return {
    rows,
    apiVersion: header(/API VERSION:\s*(.+)/),
    apiSource: header(/API SOURCE:\s*(.+)/),
    targetBody: header(/Target body name:\s*(.+?)\s{2,}/),
    centerBody: header(/Center body name:\s*(.+?)\s{2,}/),
    outputUnits: header(/Output units\s*:\s*(.+)/),
    referenceFrame: header(/Reference frame\s*:\s*(.+)/),
    outputType: header(/Output type\s*:\s*(.+)/),
  };
}

const retrievedAt = new Date().toISOString();
const out = { queries: {}, };
const series = {};
for (const q of QUERIES) {
  const url = buildUrl(q);
  process.stdout.write(`Fetching ${q.id} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${q.id}: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = parse(text);
  console.log(`${parsed.rows.length} samples`);
  await mkdir(resolve(root, 'data-raw/horizons'), { recursive: true });
  await writeFile(resolve(root, `data-raw/horizons/${q.id}.txt`), text);
  const { rows, ...meta } = parsed;
  out.queries[q.id] = { description: q.label, url, ...meta };
  series[q.id] = rows;
}

const n = series.earth_to_mars.length;
for (const k of Object.keys(series)) {
  if (series[k].length !== n) throw new Error('Sample count mismatch between Horizons queries');
}
const round = (x, d) => Number(x.toFixed(d));
const samples = [];
for (let i = 0; i < n; i++) {
  const em = series.earth_to_mars[i];
  if (series.sun_to_mars[i].jd !== em.jd || series.earth_to_sun[i].jd !== em.jd) throw new Error('Epoch mismatch');
  samples.push([
    em.jd,                               // JD (TDB)
    round(em.lt, 3),                     // Earth–Mars one-way light time, s
    round(em.rg, 0),                     // Earth–Mars range, km
    round(em.rr, 4),                     // Earth–Mars range rate, km/s
    round(series.sun_to_mars[i].rg, 0),  // Sun–Mars range, km
    round(series.earth_to_sun[i].rg, 0), // Earth–Sun range, km
  ]);
}

const snapshot = {
  provenance: 'verified_nasa_data',
  title: 'JPL Horizons vector ephemeris (VEC_TABLE 6): Earth–Mars, Sun–Mars, Earth–Sun',
  organization: 'NASA / Jet Propulsion Laboratory — Solar System Dynamics Group',
  documentation: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
  status: 'cached_snapshot',
  retrievedAt,
  timeScale: 'TDB',
  start: START,
  stop: STOP,
  step: STEP,
  note: 'Geometric states, no aberration corrections. LT is the one-way Newtonian light time reported by Horizons. Values rounded for storage: LT to 0.001 s, ranges to 1 km, range-rate to 0.0001 km/s. Raw API responses are kept in data-raw/horizons/.',
  columns: ['jd_tdb', 'earth_mars_light_time_s', 'earth_mars_range_km', 'earth_mars_range_rate_km_s', 'sun_mars_range_km', 'earth_sun_range_km'],
  queries: out.queries,
  samples,
};
await writeFile(resolve(root, 'src/data/nasa/horizonsSnapshot.json'), JSON.stringify(snapshot));
console.log(`Wrote src/data/nasa/horizonsSnapshot.json (${samples.length} samples, retrieved ${retrievedAt})`);
