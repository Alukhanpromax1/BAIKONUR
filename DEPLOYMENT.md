# Deployment

**The game has not been deployed.** No hosting credentials were available in the environment where it
was built, so there is no public URL yet. The repository is ready to deploy; the steps are below.

The game is a static site plus one small serverless function. It needs no database, no login and no
API keys or other secrets.

## Vercel (recommended — live NASA data works)

1. Push the branch to GitHub (already done: `claude/keen-pasteur-9sydhg`) and merge it to your main branch.
2. On https://vercel.com choose **Add New → Project** and import `Alukhanpromax1/BAIKONUR`.
3. Keep the detected settings — they are fixed in `vercel.json`:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. Press **Deploy**. No environment variables are required.

Or from a terminal:

```bash
npx vercel
```

```bash
npx vercel --prod
```

`api/horizons.js` becomes a serverless function at `/api/horizons`. It forwards a restricted
vector-ephemeris query to the public JPL Horizons API and returns the text unchanged, because the
JPL endpoint does not send CORS headers. It accepts only GET, only whitelisted parameters and only
`EPHEM_TYPE='VECTORS'`, and caches responses for an hour.

### After deploying, check

- The top bar shows the Earth → Mars delay with a **LIVE** tag. If it says **CACHED**, open
  `/api/horizons?format=text&COMMAND='499'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@399'&START_TIME='2026-11-14'&STOP_TIME='2026-11-15'&STEP_SIZE='1d'&VEC_TABLE='6'`
  on your site — it should return text containing `$$SOE`.
- Play one mission from start to debrief.

## Any static host (GitHub Pages, Netlify, Cloudflare Pages…)

```bash
npm run build
```

Upload the `dist/` folder. The game is fully playable. Without the `/api/horizons` function the live
reading is unavailable, so the game uses the bundled Horizons snapshot and labels it **CACHED** with
its retrieval date — all mission geometry comes from that snapshot anyway.

If the site is served from a sub-path (for example `https://user.github.io/BAIKONUR/`), set `base` in
`vite.config.ts` to that path before building.

To get the live reading on Netlify or Cloudflare, port `api/horizons.js` to that platform's function
format; it is about thirty lines.

## Local production preview

```bash
npm run build
```

```bash
npm run preview
```

The preview server includes the Horizons proxy.

## Keeping the cached data fresh

```bash
npm run data:horizons
```

This re-queries JPL Horizons and rewrites `src/data/nasa/horizonsSnapshot.json` and the raw responses
in `data-raw/horizons/` with a new retrieval date. Commit the result. Behind an HTTPS proxy, run it as
`NODE_USE_ENV_PROXY=1 npm run data:horizons`.
