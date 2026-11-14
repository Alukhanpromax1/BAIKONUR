# Gameplay guide

## The goal

Send **KAZMARS-1** to Mars and return as much useful science as you can about Martian dust and
climate — without running out of mass, power, data capacity or budget, and without deciding on a
guess.

A first mission takes 10–15 minutes. You can start playing in under a minute: press **Start mission**,
then **Skip the briefing** if you have played before.

## The seven steps

1. **Opening.** Watch or skip. *Reduce motion* is at the bottom left.
2. **Briefing.** Meet Arman (17, systems engineering trainee) and Dana (16, telemetry and data
   trainee). Try the five short interactive ideas, then choose a science focus:
   - **Climate record** — vertical profiles and a full Mars year matter most.
   - **Dust storm watch** — sharp daily global maps matter most.
   - **Clouds & water cycle** — seeing many times of day matters most.
3. **Design bay.** Drag to rotate the spacecraft, scroll or pinch to zoom, click a part or a label to
   configure it. Each of the five subsystems has two or three options. The six meters at the bottom
   update instantly; click a meter for the full breakdown.
4. **Launch plan.** Pick a rocket, an orbit and the mission length. Red meters block the launch and
   the message above them says which number is over and how to fix it. Amber meters are warnings you
   will meet again at Mars.
5. **Launch readiness.** A tank alarm stops the count. Arman wants to hold; Dana wants to check the
   data. Open the three evidence tabs, then choose:
   - **Hold and investigate** — stop and inspect the hardware.
   - **Cross-validate the evidence** — compare everything, then recommend one of three actions.
   - **Proceed with the countdown** — resume without further checks.
6. **Mars operations.** Press *Begin operations*. Time runs fast. Three decisions arrive: the solar
   conjunction, the low-power season and a dust storm. The right answer depends on your spacecraft,
   so read the gauges.
7. **Debrief.** See your score, what each decision caused, and what to learn from each mistake.
   **Try again** keeps your spacecraft and draws a new countdown scenario; **New mission** starts over.

## The six resources

| Meter | Shows | Goes red when |
| --- | --- | --- |
| **Mass** | Fuelled spacecraft against the rocket's limit | Too heavy for the rocket, or the tanks are too small for the orbit |
| **Power** | Consumption against available solar power | The spacecraft uses more than the arrays deliver |
| **Budget** | Credits spent of 580 | Over budget |
| **Data** | Daily data against recorder size | *(amber)* the recorder cannot hold the conjunction blackout |
| **Comms** | Average daily downlink | *(amber)* the link carries less than the payload produces |
| **Duration** | Science days and total mission time | — |

## Guided and Advanced modes

- **Guided** (default): suggested options are marked, and Arman or Dana give a short hint at each step.
- **Advanced**: no suggestions; adds formulas, provenance notes, the full packet log and the science
  value model.

Switch in the briefing or under the gear icon. The gear also has the visual quality (High, Balanced,
Low) and motion settings.

## Playing as a team (1–4 players, one device)

Set the number of players and their names in the briefing or from the people icon. Roles:

| Role | Looks after |
| --- | --- |
| Mission Director | Confirms the team's final answer |
| Spacecraft Engineer | Mass, power, propulsion — leads the design bay |
| Science Lead | The science objective |
| Communications & Resources | Data, link, budget — leads the launch plan |

At each key decision the device is passed round: every role taps a proposal, then the Mission
Director confirms. If the team is split, the Director decides. The debrief reports how often
everyone was heard and how often the team agreed.

## How the score works

| Category | Points | Rewards |
| --- | --- | --- |
| Scientific value | 35 | How well instrument, orbit and duration fit the objective, and how much data came home |
| Resource efficiency | 20 | Science per credit, a well-matched rocket, a healthy power margin |
| Decision quality | 30 | The readiness call (18) and three operational decisions (4 each) |
| Mission performance | 15 | Data returned, link delivery, days not lost to safe mode |

85+ exemplary · 70+ success · 50+ partial success. There is no single best spacecraft: each objective
is won by a different design, and the right operational choices depend on what you built.

## Tips without spoilers

- An alarm tells you where to look, not what is true.
- One sensor can be wrong. Two independent sensors wrong in the same way is unlikely.
- Data only counts once it reaches Earth.
- A margin near zero is not a margin.
- Being careful is not the same as avoiding every risk.

## Controls and accessibility

Mouse or touch for everything; all controls are reachable by keyboard (Tab, Enter, Esc to close
panels and skip the intro). Sound is optional and never needed. Reduced motion removes camera flights
and animation. If 3D graphics are unavailable the game switches to a 2D mode automatically.

Testing aids (URL parameters): `?seed=42` fixes the scenario seed, `?scenario=hardware`,
`data-chain` or `noise` forces the hidden cause, `?scene=designer` opens a scene directly,
`?motion=reduced`, `?nowebgl=1`.
