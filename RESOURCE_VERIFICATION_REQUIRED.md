# Resource verification required

**Status: Global Awards eligibility has NOT been verified. Please do not claim it yet.**

The NASA Space Apps GO Team has stated that, to be eligible for Global Awards, a project must use at
least one NASA data source that is included in the *Resources* of its challenge
(`nasa/spaceapps` discussion #1849). Two things could not be checked while the game was being built.

## 1 · The official Resources tab was not readable

**What was attempted (2026-11-14):**

| Address | Result |
| --- | --- |
| `https://www.spaceappschallenge.org/2026/` | Connection opened, but the site's TLS certificate chain could not be validated against the build machine's trust store. Certificate checking was not disabled. |
| Same address through a separate web-fetch tool | The host name did not resolve. |
| `NASA-SPACEAPP-2026/Space-Mission-Design-Game` → `documentation/challenge.md` | Read successfully, but it lists no datasets — it points to the Resources tab. |

**Consequence:** nobody has confirmed that the sources this game uses appear in the official list.
The game uses JPL Horizons and the NASA Mars Climate Sounder instrument page. Both are genuine NASA
sources, but that is not the same as being listed for this challenge.

**What the team needs to do:**

1. In a normal browser open the 2026 challenge page → **Space Mission Design Game** → **Details** → **Resources**.
2. Copy the exact title, provider and link of every NASA resource listed.
3. Compare with [SOURCES.md](SOURCES.md):
   - If JPL Horizons or the MRO/MCS material is listed, record the exact listed title in `SOURCES.md`
     and in `src/data/nasa/sources.ts`, update `CHALLENGE_REFERENCE.note`, and delete this file.
   - If neither is listed, pick at least one listed NASA source and make it part of how the game
     actually works (not only a citation), then document it the same way.

## 2 · No Mars Climate Sounder measurements are included

The plan was to show a real atmospheric profile (temperature and dust with height) from the
**MRO Mars Climate Sounder Derived Data Records** in the NASA Planetary Data System.

**What was attempted (2026-11-14):** `https://pds-atmospheres.nmsu.edu/…/Mars/Mars.html` and
`https://atmos.nmsu.edu/` — same certificate-validation failure; the web-fetch tool could not resolve
either host.

**Consequence:** no file was downloaded, no header was inspected, and the game contains no MCS data.
No values were invented. The Data sources panel shows this entry as **NOT INTEGRATED**. The version
number of the current DDR release (the brief mentions 6.2) has not been confirmed either.

**How to add it properly:**

1. Browse from the PDS Atmospheres page to one MCS DDR data file and its label.
2. Download both, unchanged:

   ```bash
   node scripts/fetch-mcs-sample.mjs <url-of-.LBL-file> <url-of-.TAB-file>
   ```

   The files and a `PROVENANCE.json` are saved in `data-raw/mcs/`. This helper has not been run
   successfully yet and makes no assumptions about the file format.
3. Read the label and format description for the column names, units and missing-data constants.
4. Extract a small subset (for example one profile: pressure or altitude, temperature, dust opacity),
   keeping the original units, and store it as JSON in `src/data/nasa/` together with the product
   identifier, file name, dataset version and retrieval date.
5. Add a chart to the briefing's "Instruments" lesson, tagged **NASA DATA**, with one sentence on what
   the measurement shows.
6. Change the `mcs-pds` entry in `src/data/nasa/sources.ts` from "NOT INTEGRATED" to the real details,
   and update `SOURCES.md` and the end-to-end test that currently expects "NOT INTEGRATED".

Never describe MCS data as launch or rocket telemetry: it is atmospheric science data. The countdown
telemetry in this game is synthetic and is labelled as such.
