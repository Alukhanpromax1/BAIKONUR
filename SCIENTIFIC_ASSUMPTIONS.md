# Scientific assumptions

BAIKONUR: MISSION CONTROL teaches how mission trade-offs work. It is not a design tool. This file
states what is real, what is simplified, and what is invented. Numbers marked **game value** are
illustrative; they are not specifications of real hardware.

## Summary

| Model | Status |
| --- | --- |
| Earth–Mars distance, light time, range-rate | **Real** — JPL Horizons |
| Sun–Mars distance | **Real** — JPL Horizons |
| Date of the solar conjunction | **Real geometry**, game threshold (2°) |
| Inverse-square law for sunlight | **Real physics**, simplified array model |
| Inverse-square law for data rate | **Real physics**, simplified link model |
| Rocket equation for propellant | **Real physics**, game values for Δv and Isp |
| Sounder mass and power | **Real** — NASA Mars Climate Sounder |
| Transfer time | **Simplified** — Hohmann estimate |
| Orbits, shadow, contact time | **Game values** |
| Costs, budget, science score | **Game values** |
| Launch vehicles | **Fictional** |
| Countdown telemetry | **Synthetic** |

## Mission timeline

- Launch: 20 November 2026 (fictional), inside the real late-2026 Earth–Mars launch period.
- Transit: half the period of a Hohmann ellipse between 1 AU and Mars' mean distance, from Kepler's
  third law, T = ½ · a^1.5 years with a = (1 + 1.5236) / 2 → **259 days**. This is an estimate of
  duration only. The game does not compute a trajectory and does not check that Mars is at the
  arrival point.
- After arrival the spacecraft needs 20, 45 or 150 days to reach its science orbit (game values; the
  150 days stand for aerobraking).
- Science lasts 343 or 687 days (half or one Mars year).

## Mass

- Dry mass = fixed bus (190 kg, game value) + the five selected components.
- Propellant from the Tsiolkovsky rocket equation, m_prop = m_dry · (e^(Δv / (Isp · g₀)) − 1), plus a
  3 % reserve. Δv per orbit (1.15–1.75 km/s, plus up to 0.12 km/s for a full Mars year) and Isp
  (318 s or 326 s) are game values.
- Launch check: dry mass + propellant ≤ the vehicle's capacity toward Mars. Tank check: propellant ≤
  tank capacity.
- Not modelled: staging, gravity losses, launch-vehicle adapters, propellant for attitude control.

## Power

- Sunlight: 1361 W/m² ÷ (distance in AU)². At Mars' mean distance this gives about 586 W/m².
- Array output = irradiance × area × 0.29 (cell efficiency) × 0.72 (pointing, wiring, ageing).
- Orbit-average power = array output × (1 − shadow fraction); the shadow fraction is a fixed game
  value per orbit (0.36, 0.20 or 0.06).
- During operations the Sun–Mars distance comes from Horizons, so available power changes through
  the mission as it really would.
- Flight rule used by the game: keep at least 5 % margin. Breaking it triggers safe mode.
- Not modelled: batteries, eclipse seasons, panel temperature, dust on arrays (not relevant in orbit).

## Data and communications

- Units: kilobits per second for rates, megabits and gigabits for volumes (1 Gb = 1000 Mb). Bytes
  are never used.
- Downlink rate = rate at 1 AU ÷ (Earth–Mars distance in AU)². The rate at 1 AU (110 or 420 kbps)
  is a game value. Real link budgets also depend on frequency, antenna gain, ground-station size and
  coding.
- Daily volume = rate × contact hours × 3600 s. Contact hours per orbit are game values.
- The recorder is a simple buffer: data in, data out, anything above capacity is lost.
- Solar conjunction: the link is suspended while the Sun–Earth–Mars angle is below 2°. The angle is
  real; the threshold is a game value inspired by the practice of pausing commanding near conjunction.
- Light time is shown as the one-way value reported by Horizons and as twice that for a round trip.
  Gameplay time is accelerated (one second ≈ 18 days); the player never waits out a real delay, and
  the game says so.

## Science value

Science potential is a weighted sum of four qualities, each 0–1:

| Quality | Depends on |
| --- | --- |
| Vertical profiles | Instrument × orbit |
| Global maps | Instrument × orbit |
| Seasons covered | Science days ÷ 687 |
| Times of day | Orbit |

The weights depend on the chosen objective, which is why different objectives favour different
spacecraft. Achieved science = potential × fraction of planned data returned × a small bonus for a
successful dust-storm campaign. All weights and factors are game values.

## Orbits

Three illustrative orbits: low polar (≈300 km), mid-altitude inclined (≈4000 km) and high elliptical
(500 × 22 000 km). In the 3D view they are drawn on a logarithmic altitude scale and the spacecraft
is drawn far larger than life. Motion along the ellipse follows Kepler's second law qualitatively;
orbits are not propagated.

## Countdown telemetry

Synthetic readings from a fictional propellant tank: two pressure sensors and one temperature sensor
over 120 seconds, generated from the scenario seed. Three hidden causes exist — a real leak, a
ground data-chain fault, or a single noisy sample — and each leaves a different, physically sensible
signature. Unit tests confirm that each cause can be identified from the evidence shown to the player
for 300 seeds per scenario. Abnormal readings are never removed from the charts.

Safety framing: every countdown is a training simulation. An adult Flight Director keeps authority
over launch safety; proceeding with a real fault leads to a safe automatic hold, never a disaster.

## Scoring

The score is deterministic: the same design, seed and decisions always give the same report.
100 points = science 35 + resource efficiency 20 + decision quality 30 + mission performance 15.
Operational decisions are reviewed by re-running the simulation with the alternatives.
