# Testing

## Run everything

```bash
npm run check
```

```bash
npm run e2e
```

`check` runs the type-check, the unit tests and the production build. `e2e` builds the game, serves
it with `vite preview` and drives it in headless Chromium (WebGL is rendered in software, so no GPU
is needed). If Chromium is not installed yet, run `npx playwright install chromium` once.

## Results at the time of writing (2026-11-14)

| Suite | Result |
| --- | --- |
| Type-check (`tsc -b`) | Pass |
| Unit tests (Vitest) | **65 of 65 pass** |
| End-to-end tests (Playwright, Chromium) | **5 of 5 pass** |
| Production build (`vite build`) | Pass |

## Unit tests — `src/game/__tests__/`

**`engine.test.ts`**

| Area | What is checked |
| --- | --- |
| Mass | Sum of bus and components; rocket equation against a known case; heavier spacecraft need more propellant; wet mass and margin arithmetic |
| Power | Inverse-square law (1361 W/m² at 1 AU, ≈586 at Mars); output scales with area; instrument, bus and subsystem split; less power in more shadow and farther from the Sun |
| Budget | Spacecraft + launch + operations + events; longer missions cost more |
| Communications | Unit consistency (100 kbps × 1 h = 360 Mb); rate ÷ distance²; round trip = 2 × one-way |
| JPL Horizons | Snapshot is dated and attributed; LT = RG ÷ c for every sample; matches the live value of 2026-11-14; contains the March 2028 conjunction; Mars' orbit extremes; refuses to extrapolate; parser handles the VEC_TABLE 6 format and rejects bad input |
| Duration | Hohmann estimate of 259 days; seven-phase timeline |
| Compatibility | Recommended design passes; too heavy, too little power, tanks too small and over budget are each blocked with an explanation; a slow link is flagged; every objective has valid designs and they do not share one best design |

**`scenarios.test.ts`**

| Area | What is checked |
| --- | --- |
| Seeded randomness | Same seed, same telemetry; all three scenarios occur |
| Scenario signatures | Each cause leaves its own evidence (100 seeds each); abnormal readings are never removed |
| Identifiability | The hidden cause can be recovered from the visible evidence for 300 seeds per scenario |
| Outcomes | Each scenario rewards a different call; neither engineer is always right; proceeding with a real leak is caught by the Flight Director and scores worst; the fastest choice is never the best; evidence quality changes the result; determinism |

**`mission.test.ts`**

| Area | What is checked |
| --- | --- |
| Simulation | Data conservation; three distinct decisions with the conjunction at the real date; recorder never exceeds capacity; faster link returns more data; commanding through conjunction and thin power margins cause safe mode; launch slips shift the timeline; pause and resume |
| Decision review | Best conjunction and power options depend on the design |
| Scoring | Determinism; categories sum to 100 and stay in range; a well-run recommended mission is exemplary; bad decisions lower the score and are explained; false positive labelled; scenarios give different totals; several different designs succeed per objective; efficiency curves |

## End-to-end tests — `e2e/journey.spec.ts`

1. **Full mission.** Main menu → briefing and tutorial → objective → design (meters change when
   components change) → launch plan (an undersized rocket blocks launch with an explanation) →
   countdown and alarm → three evidence panels → cross-validation and recommendation → liftoff → Mars
   operations with all three decisions → debrief → data sources panel → **Try again** returns to the
   design bay. The test fails on any browser console error.
2. **Scenarios differ.** The same choice gives different outcomes for the three hidden causes; the
   data-chain scenario shows flagged packets.
3. **Team mode.** Three players propose; a split vote is reported; the Director confirms.
4. **2D fallback.** With WebGL disabled the schematic view appears and the game still responds.
5. **Phone layout.** No horizontal overflow at 390 × 844 on any of the seven scenes.

Screenshots from the run are written to `test-results/screens/`.

## What is not covered by automated tests

- Visual quality and frame rate on real graphics hardware — tests use software rendering. Play it on
  the laptop you will demonstrate with.
- Sound — headless browsers do not play audio.
- Safari and Firefox — only Chromium is tested.
- The production serverless proxy (`api/horizons.js`) — locally the same route is served by the Vite
  proxy, which is what the tests exercise.
- Touch gestures for rotating the spacecraft on a real phone.
