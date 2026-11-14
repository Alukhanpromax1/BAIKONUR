import type { DurationId, OrbitId, Provenance } from '@/types';

export interface OrbitOption {
  id: OrbitId;
  name: string;
  shape: string;
  /** Periapsis / apoapsis altitude above the surface, km (for display and the 3D ring). */
  periapsisKm: number;
  apoapsisKm: number;
  description: string;
  /** Velocity change needed to capture and reach the orbit, km/s. */
  deltaVKmS: number;
  /** Extra station-keeping velocity change for a full Mars year, km/s. */
  fullYearExtraDeltaVKmS: number;
  /** Days between arrival and the start of science. */
  commissioningDays: number;
  /** Fraction of each orbit spent in Mars' shadow. */
  eclipseFraction: number;
  /** Hours per day with a usable link to the ground stations. */
  contactHoursPerDay: number;
  /** How well the orbit suits each kind of observation (0–1). */
  profilingFactor: number;
  mappingFactor: number;
  diurnalFactor: number;
  effects: { coverage: string; science: string; comms: string; duration: string; constraints: string };
  provenance: Provenance;
}

/** Simplified educational orbits. All numbers are illustrative game values. */
export const ORBITS: OrbitOption[] = [
  {
    id: 'low-polar',
    name: 'Low polar mapping orbit',
    shape: 'Circular · about 300 km high · passes over both poles',
    periapsisKm: 300,
    apoapsisKm: 300,
    description:
      'Close to the planet and always crossing the equator at the same local time. Reached slowly by aerobraking — dipping into the upper atmosphere to shed speed.',
    deltaVKmS: 1.45,
    fullYearExtraDeltaVKmS: 0.12,
    commissioningDays: 150,
    eclipseFraction: 0.36,
    contactHoursPerDay: 5.5,
    profilingFactor: 1,
    mappingFactor: 1,
    diurnalFactor: 0.2,
    effects: {
      coverage: 'Sees every latitude each day in sharp, narrow strips that are stitched into global maps.',
      science: 'Sharpest view of the atmosphere’s layers. Always the same time of day, so day–night changes are missed.',
      comms: 'Mars blocks the view of Earth for part of every lap: about 5.5 contact hours per day.',
      duration: 'Aerobraking takes roughly five months before science can begin.',
      constraints: 'More than a third of each orbit is in shadow, so solar power is lowest here.',
    },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'mid-inclined',
    name: 'Mid-altitude inclined orbit',
    shape: 'Circular · about 4,000 km high · tilted 60°',
    periapsisKm: 4000,
    apoapsisKm: 4000,
    description: 'A higher circular orbit whose ground track slowly drifts through different times of day.',
    deltaVKmS: 1.75,
    fullYearExtraDeltaVKmS: 0.05,
    commissioningDays: 45,
    eclipseFraction: 0.2,
    contactHoursPerDay: 7,
    profilingFactor: 0.75,
    mappingFactor: 0.85,
    diurnalFactor: 0.7,
    effects: {
      coverage: 'Wide view of most of the planet; the poles are seen at a slant.',
      science: 'A good all-rounder: decent vertical detail and several times of day.',
      comms: 'Fewer blockages by Mars: about 7 contact hours per day.',
      duration: 'Ready for science in about six weeks.',
      constraints: 'Circularising this high with engines alone needs the most propellant.',
    },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'high-elliptical',
    name: 'High elliptical orbit',
    shape: 'Stretched ellipse · 500 km to 22,000 km',
    periapsisKm: 500,
    apoapsisKm: 22000,
    description: 'A long looping orbit that swings far from Mars, watching the whole disc for hours at a time.',
    deltaVKmS: 1.15,
    fullYearExtraDeltaVKmS: 0.05,
    commissioningDays: 20,
    eclipseFraction: 0.06,
    contactHoursPerDay: 9.5,
    profilingFactor: 0.45,
    mappingFactor: 0.7,
    diurnalFactor: 1,
    effects: {
      coverage: 'Full-disc views: an entire hemisphere in one picture, but with less fine detail.',
      science: 'Follows weather from dawn to dusk. Too distant for fine vertical detail.',
      comms: 'Almost always in view of Earth: about 9.5 contact hours per day.',
      duration: 'Science can begin within three weeks of arrival.',
      constraints: 'Cheapest to reach and rarely in shadow — the gentlest orbit for a small spacecraft.',
    },
    provenance: 'educational_game_assumption',
  },
];

export const ORBIT_BY_ID = Object.fromEntries(ORBITS.map((o) => [o.id, o])) as Record<OrbitId, OrbitOption>;

export interface DurationOption {
  id: DurationId;
  name: string;
  scienceDays: number;
  description: string;
}

export const DURATIONS: DurationOption[] = [
  {
    id: 'half-year',
    name: 'Half a Mars year',
    scienceDays: 343,
    description: 'About 11 Earth months of science. Cheaper to operate, but you only see half of the seasons.',
  },
  {
    id: 'full-year',
    name: 'One full Mars year',
    scienceDays: 687,
    description: 'All four Martian seasons. Costs more to operate and needs extra propellant to hold the orbit.',
  },
];

export const DURATION_BY_ID = Object.fromEntries(DURATIONS.map((d) => [d.id, d])) as Record<DurationId, DurationOption>;
