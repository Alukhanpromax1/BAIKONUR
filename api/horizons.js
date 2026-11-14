/**
 * Serverless proxy for the public NASA/JPL Horizons API (Vercel function).
 *
 * Why it exists: the Horizons endpoint does not send CORS headers, so a browser cannot
 * read it directly. This function forwards a strictly limited query (vector ephemeris,
 * VEC_TABLE 6) and returns the unmodified text response. No API key is involved.
 */
const UPSTREAM = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const ALLOWED = new Set([
  'format', 'COMMAND', 'OBJ_DATA', 'MAKE_EPHEM', 'EPHEM_TYPE', 'CENTER',
  'START_TIME', 'STOP_TIME', 'STEP_SIZE', 'VEC_TABLE',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (ALLOWED.has(key) && typeof value === 'string' && value.length < 64) params.set(key, value);
  }
  if (params.get('EPHEM_TYPE') !== "'VECTORS'") {
    res.status(400).send('Only vector ephemeris queries are proxied.');
    return;
  }
  try {
    const upstream = await fetch(`${UPSTREAM}?${params.toString()}`);
    const text = await upstream.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(upstream.status).send(text);
  } catch (error) {
    res.status(502).send('Horizons upstream request failed.');
  }
}
