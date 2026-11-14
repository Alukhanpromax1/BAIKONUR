# AI usage disclosure

The NASA Space Apps Challenge permits AI tools and requires teams to state clearly where and how they
were used. This file is that statement for **BAIKONUR: MISSION CONTROL**.

## Where AI was used

| Area | AI involvement |
| --- | --- |
| **Source code** | The application code in this repository — TypeScript, React components, three.js scenes and GLSL shaders, CSS, tests and build configuration — was generated with **Claude Code** (Anthropic) working from the team's written specification. |
| **Game text** | Interface text, dialogue for Arman, Dana and the Flight Director, tutorial explanations and the mistake analysis were drafted by the same tool. |
| **Game values** | The illustrative component masses, costs, orbit parameters and scoring weights were proposed by the tool and tuned with a script that scored every possible design. They are labelled **GAME VALUE** in the game. |
| **Documentation** | These Markdown files were drafted by the tool. |
| **Images and video** | **None.** The game contains no AI-generated images or video. Planets, stars and the spacecraft are procedural 3D graphics computed in the browser; character portraits and diagrams are vector drawings written as code. |
| **Audio** | **No recordings.** All sound is synthesised live by code using the Web Audio API. The synthesis code was AI-generated; there are no audio files. |

## The team's role

The team defined the concept, the educational goals, the characters, the scientific constraints and
the acceptance criteria, and directs, reviews, tests and modifies the implementation.

**Review still to do.** The code was produced in an automated session and checked there by automated
tests (see [TESTING.md](TESTING.md)). The team should play the game through on its own devices, read
the game text for accuracy and tone, and complete the checks in
[RESOURCE_VERIFICATION_REQUIRED.md](RESOURCE_VERIFICATION_REQUIRED.md) before submission.

## Data

- **NASA data is not AI-generated.** Light time, ranges and range-rate were retrieved from the
  NASA/JPL Horizons API by `scripts/fetch-horizons.mjs`; the unmodified responses are in
  `data-raw/horizons/`. The Mars Climate Sounder mass and power were read from NASA's instrument page.
  Both remain attributed to NASA — see [SOURCES.md](SOURCES.md).
- **Transformed data.** The Horizons values were rounded for storage and are linearly interpolated
  between 2-day samples. The Sun–Earth–Mars angle is computed from three Horizons ranges.
- **Generated data.** The countdown telemetry is synthetic, produced by a seeded random generator, and
  labelled on screen as *SIMULATED TELEMETRY — EDUCATIONAL SCENARIO*.
- **No fabricated sources.** Where a source could not be reached (the official Resources tab and the
  PDS Mars Climate Sounder archive), nothing was invented in its place.

## Branding

The game does not use or modify NASA logos, insignia, flags or mission identifiers. "KAZMARS-1",
"Tulpar" and the planet-and-orbit mark are original to this project.
