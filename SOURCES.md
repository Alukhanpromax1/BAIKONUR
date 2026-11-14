# Sources

Every data-driven display in the game is tagged with one of five provenance labels. This file lists
each source, the exact values taken from it, and where those values change what happens in the game.
The same information is available in-game from the **Data sources** button (database icon).

Source metadata lives in `src/data/nasa/sources.ts`; it is kept apart from game values in `src/data/`.

---

## 1 · JPL Horizons System — vector ephemeris

| | |
| --- | --- |
| **Provenance** | `verified_nasa_data` |
| **Official title** | Horizons System (Horizons API, vector tables) |
| **Provider** | NASA / Jet Propulsion Laboratory — Solar System Dynamics Group |
| **Documentation** | https://ssd-api.jpl.nasa.gov/doc/horizons.html |
| **Endpoint** | `https://ssd.jpl.nasa.gov/api/horizons.api` (public, no API key) |
| **Retrieved** | 2026-11-14T11:13:29Z (cached snapshot) · today's value is read live when the proxy is reachable |
| **Units** | LT in seconds · RG in km · RR in km/s · time scale TDB · output units KM-S |
| **Settings** | `EPHEM_TYPE='VECTORS'`, `VEC_TABLE='6'`, geometric states, ecliptic of J2000.0, no aberration corrections |

### Queries in the cached snapshot

Period 2026-11-01 to 2030-03-01, step 2 days, 609 samples each.

| Snapshot series | `COMMAND` (target) | `CENTER` | Fields kept |
| --- | --- | --- | --- |
| `earth_to_mars` | `499` (Mars) | `500@399` (Earth centre) | LT, RG, RR |
| `sun_to_mars` | `499` (Mars) | `500@10` (Sun centre) | RG |
| `earth_to_sun` | `10` (Sun) | `500@399` (Earth centre) | RG |

The full request URLs are stored inside `src/data/nasa/horizonsSnapshot.json` (`queries.*.url`).
The unmodified API responses are in `data-raw/horizons/`. Values in the JSON are rounded for storage:
LT to 0.001 s, ranges to 1 km, range-rate to 0.0001 km/s. Regenerate with `npm run data:horizons`.

### Fields used and their effect on gameplay

| Horizons field | Where it appears | What it changes |
| --- | --- | --- |
| **LT** — one-way light time, Earth–Mars | Top bar, briefing ("Signal delay"), operations HUD, every operations decision, debrief | Shown as one-way and round-trip delay. Explains why the spacecraft must hold a safe plan before a blackout. |
| **RG** — Earth–Mars range | Communications meter, operations HUD | Downlink rate = rate at 1 AU ÷ distance². Decides whether data piles up on the recorder. |
| **RG** — Sun–Mars range | Power meter ("farthest point" row), operations HUD | Solar power = 1361 W/m² ÷ distance². Sets the timing and severity of the low-power decision. |
| **RG** — all three ranges | Solar-conjunction event | The Sun–Earth–Mars angle is computed from the three side lengths. The communications blackout runs while it is below 2°, which puts it in March 2028. |
| **RR** — Earth–Mars range-rate | Data sources panel | Displayed only. |

### Live versus cached

- **Live:** on load the game requests today's Earth→Mars vector from Horizons through `/api/horizons`
  (the Vite dev/preview proxy locally, `api/horizons.js` in production). The public endpoint does not
  send CORS headers, so a browser cannot call it directly. When this succeeds the value is tagged **LIVE**.
- **Cached:** if the request fails, the game reads the same quantity from the bundled snapshot and tags
  it **CACHED** with the retrieval date. A value is never silently replaced.
- The mission timeline (2026–2029) always uses the cached snapshot and is labelled as cached.
- Dates outside the snapshot throw an error rather than being extrapolated.

Verified during development on 2026-11-14: Horizons returned `LT = 660.9002 s`,
`RG = 1.981328957 × 10⁸ km`, `RR = −14.7123 km/s` for 2026-11-14 00:00 TDB. A unit test checks the
snapshot against this value, and another checks that LT equals RG ÷ c to within 0.01 s for every sample.

---

## 2 · Mars Climate Sounder reference

| | |
| --- | --- |
| **Provenance** | `verified_mission_reference` |
| **Official title** | Mars Reconnaissance Orbiter — Science Instruments (section "Mars Climate Sounder") |
| **Provider** | NASA Science |
| **URL** | https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/ |
| **Retrieved** | 2026-11-14 |
| **Units** | Mass in kg · power in W |

Values taken from the page, as published: mass "~19.8 pounds (9 kilograms)"; power "11 Watts";
measures temperature, pressure, water vapour and dust; views the horizon to observe the atmosphere in
vertical slices at about 5 km intervals; profiles are combined into daily global weather maps.

| Value | Effect on gameplay |
| --- | --- |
| Mass ≈ 9 kg | Mass of the game's ATMOS-S limb sounder — feeds the mass meter, propellant and launch check |
| Power 11 W | Power draw of the ATMOS-S limb sounder — feeds the power meter |
| What it measures and how | The science objective and the "Instruments" tutorial |

Only mass and power come from NASA. The sounder's cost, data volume and science ratings are game values.

---

## 3 · MRO Mars Climate Sounder Derived Data Records — **not integrated**

| | |
| --- | --- |
| **Provider** | NASA Planetary Data System — Atmospheres Node (New Mexico State University) |
| **URL** | https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Mars/Mars.html |
| **Status** | **Not integrated. No values from this archive are in the game.** |

The archive could not be reached from the build environment, so no file was inspected and no chart of
atmospheric measurements was built. Nothing was substituted. The steps to add a verified sample are in
[RESOURCE_VERIFICATION_REQUIRED.md](RESOURCE_VERIFICATION_REQUIRED.md).

---

## 4 · Physical constants

| | |
| --- | --- |
| **Provenance** | `physical_constant` |
| **Provider** | International Astronomical Union · International System of Units |

| Constant | Value | Used for |
| --- | --- | --- |
| Astronomical unit | 149 597 870.7 km (IAU 2012, exact) | Converting Horizons ranges to AU |
| Speed of light | 299 792.458 km/s (SI, exact) | Cross-checking Horizons light time in tests |
| Nominal solar irradiance at 1 AU | 1361 W/m² (IAU 2015 nominal value) | Inverse-square solar power |
| Standard gravity | 9.80665 m/s² (exact) | Rocket equation |

Mars' mean solar distance (1.5236 AU) is derived from the Horizons snapshot as
(perihelion + aphelion) ÷ 2 = (1.3812 + 1.6661) ÷ 2, and checked by a unit test.

---

## 5 · Game values

| | |
| --- | --- |
| **Provenance** | `educational_game_assumption` |
| **Provider** | The BAIKONUR: MISSION CONTROL team |

Illustrative numbers chosen to teach trade-offs. They are not specifications of any real hardware and
not real costs: all component masses, power draws, costs and data rates (except the sounder's mass and
power); the fictional "Tulpar" launch vehicles; orbit velocity-change, shadow fraction, contact hours
and science factors; the 580-credit budget; science weights and scoring. Files: `src/data/*.ts`.

## 6 · Countdown telemetry

| | |
| --- | --- |
| **Provenance** | `synthetic_simulated_data` |
| **Provider** | Generated by the game from the scenario seed (`src/game/scenarios/telemetry.ts`) |
| **Units** | bar · °C · seconds · ADC counts |

Labelled on screen as **SIMULATED TELEMETRY — EDUCATIONAL SCENARIO**. It describes no real vehicle.
The game does not use the NASA TDRS-L incident or any other historical launch event.

---

## Challenge documents consulted

| Document | Result |
| --- | --- |
| Challenge reference copy — `NASA-SPACEAPP-2026/Space-Mission-Design-Game`, `documentation/challenge.md` | Read. Its Resources section only says to "refer to the Resources tab on the hackathon page". It lists no datasets. |
| GO Team answer — `nasa/spaceapps` discussion #1849 ("About Resources") | Read. States that Global Awards eligibility requires at least one NASA data source included in the challenge's Resources, and that AI use must be clearly indicated. |
| Official Resources tab — https://www.spaceappschallenge.org/2026/ | **Not accessible** from the build environment. |
