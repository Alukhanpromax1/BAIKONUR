# BAIKONUR: MISSION CONTROL

**The Space Mission Decision Simulator — _Every Decision Has a Consequence._**

An educational 3D browser game for the **2026 NASA Space Apps Challenge · Space Mission Design Game**.

You are the Mission Director of **KAZMARS-1**, a fictional student-designed Mars orbiter. You define the
science objective, design the spacecraft in an interactive 3D design bay, choose a rocket and an orbit,
investigate a pre-launch telemetry anomaly, make an evidence-based Go/No-Go call, fly the science
mission in accelerated time, and then read a report that explains exactly what your decisions caused.

> KAZMARS-1 is fictional. It is not a NASA mission and not a mission of any government.
> This is an educational simulator, not spacecraft design software.

## Play

```bash
npm install
```

```bash
npm run dev
```

Open the address Vite prints (normally http://localhost:5173). Node 20.19+ or 22.12+ is required.

One mission takes about 10–15 minutes. It works with 1–4 players on one device.

## What is in the game

| Scene | What the player does |
| --- | --- |
| 1 · Cinematic opening | A short camera flight from Earth toward Mars. Skippable, with a reduced-motion option. |
| 2 · Mission briefing | Meets Arman and Dana, tries five one-minute interactive ideas (mass, power, instruments, signal delay, launch capacity), picks the science focus, sets up the team. |
| 3 · Design bay | Rotates, zooms and inspects a modular 3D orbiter; swaps payload, solar arrays, antenna, recorder and propulsion; watches six resource meters respond. |
| 4 · Launch plan | Chooses a (fictional) launch vehicle, an orbit and the mission length. A resource check blocks launch until every red limit is fixed, and says why. |
| 5 · Launch readiness | Countdown, a simulated pressure/temperature alarm, two trainees who disagree, three evidence panels, and a Go/No-Go recommendation. |
| 6 · Mars operations | The science phase in accelerated time, driven by real Earth–Mars–Sun geometry, with three decisions. |
| 7 · Debrief | A deterministic score, the consequences of every decision, a five-step analysis of each mistake, and replay. |

Other features: Guided and Advanced modes, pass-and-play team roles, three visual quality levels,
a 2D fallback when WebGL is unavailable, synthesised sound with a mute control, and a Data Sources
panel (database icon in the top bar) that shows where every number comes from.

## NASA data — what is real and what is not

| Label in the game | Meaning | Example |
| --- | --- | --- |
| **NASA DATA** | Retrieved from a NASA data service | Earth–Mars light time, ranges and range-rate from JPL Horizons |
| **NASA REFERENCE** | A published fact about a real NASA instrument | Mars Climate Sounder: ≈9 kg, 11 W |
| **CONSTANT** | Defined physical constants | Astronomical unit, speed of light |
| **GAME VALUE** | Illustrative teaching numbers | Component costs, the fictional Tulpar rockets |
| **SIMULATED** | Generated from a random seed | The countdown telemetry |

Details are in [SOURCES.md](SOURCES.md) and [SCIENTIFIC_ASSUMPTIONS.md](SCIENTIFIC_ASSUMPTIONS.md).

**Important — Global Awards eligibility is not yet verified.** The official challenge *Resources* tab
could not be opened from the environment where this game was built, and the NASA PDS Mars Climate
Sounder archive could not be reached either. No resource listing and no MCS data were invented.
See [RESOURCE_VERIFICATION_REQUIRED.md](RESOURCE_VERIFICATION_REQUIRED.md) for the two checks the team
must complete.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with the JPL Horizons proxy |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Unit tests (Vitest) |
| `npm run e2e` | End-to-end browser tests (Playwright) |
| `npm run check` | Type-check, unit tests and build |
| `npm run data:horizons` | Refresh the cached JPL Horizons snapshot |

## Project structure

```
api/horizons.js          Serverless proxy for the public JPL Horizons API (production)
data-raw/horizons/       Unmodified Horizons API responses behind the cached snapshot
e2e/                     Playwright journey tests
scripts/                 Data retrieval scripts
src/
  app/                   App shell and scene navigation
  audio/                 Synthesised sound (Web Audio)
  components/            Shared interface: top bar, dashboard, decisions, panels
  data/                  Game values, and nasa/ for sources and the Horizons snapshot
  game/engine/           Mass, power, budget, communications, duration, science calculators
  game/ops/              Mission simulation and review of operational decisions
  game/scenarios/        Seeded telemetry, evidence analysis, readiness outcomes
  game/scoring/          Deterministic score and mistake analysis
  game/state/            Zustand store
  scenes/                The seven scenes
  services/horizons/     Horizons parser, cached ephemeris, live reader
  three/                 Procedural planets, starfield, spacecraft, cameras
```

Game mechanics are separate from rendering: everything under `src/game` and `src/services` is plain
TypeScript with no React or three.js, and is covered by unit tests.

## More documentation

- [GAMEPLAY_GUIDE.md](GAMEPLAY_GUIDE.md) — how to play, modes, team play, scoring
- [SOURCES.md](SOURCES.md) — every data source, with queries and retrieval dates
- [SCIENTIFIC_ASSUMPTIONS.md](SCIENTIFIC_ASSUMPTIONS.md) — the models and their limits
- [TESTING.md](TESTING.md) — what is tested and how to run it
- [DEPLOYMENT.md](DEPLOYMENT.md) — publishing the game
- [AI_USAGE.md](AI_USAGE.md) — where and how AI was used
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — libraries and font licences

## Known limitations

- No real Mars Climate Sounder measurements are included yet (see above).
- Orbits, propellant and transfer time use simplified educational models; nothing here is a flight trajectory.
- Team play is pass-and-play on one device; there is no online multiplayer.
- The live light-time reading needs the `/api/horizons` proxy. On hosts without it the game uses the
  bundled snapshot and labels it **CACHED**.
