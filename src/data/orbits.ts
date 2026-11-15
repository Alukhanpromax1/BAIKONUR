import type { DurationId, OrbitId, Provenance } from '@/types';
import { t } from '@/i18n';

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
    get name() { return t('orbit.orbits.low-polar.name'); },
    get shape() { return t('orbit.orbits.low-polar.shape'); },
    periapsisKm: 300,
    apoapsisKm: 300,
    get description() { return t('orbit.orbits.low-polar.description'); },
    deltaVKmS: 1.45,
    fullYearExtraDeltaVKmS: 0.12,
    commissioningDays: 150,
    eclipseFraction: 0.36,
    contactHoursPerDay: 5.5,
    profilingFactor: 1,
    mappingFactor: 1,
    diurnalFactor: 0.2,
    effects: {
      get coverage() { return t('orbit.orbits.low-polar.effects.coverage'); },
      get science() { return t('orbit.orbits.low-polar.effects.science'); },
      get comms() { return t('orbit.orbits.low-polar.effects.comms'); },
      get duration() { return t('orbit.orbits.low-polar.effects.duration'); },
      get constraints() { return t('orbit.orbits.low-polar.effects.constraints'); },
    },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'mid-inclined',
    get name() { return t('orbit.orbits.mid-inclined.name'); },
    get shape() { return t('orbit.orbits.mid-inclined.shape'); },
    periapsisKm: 4000,
    apoapsisKm: 4000,
    get description() { return t('orbit.orbits.mid-inclined.description'); },
    deltaVKmS: 1.75,
    fullYearExtraDeltaVKmS: 0.05,
    commissioningDays: 45,
    eclipseFraction: 0.2,
    contactHoursPerDay: 7,
    profilingFactor: 0.75,
    mappingFactor: 0.85,
    diurnalFactor: 0.7,
    effects: {
      get coverage() { return t('orbit.orbits.mid-inclined.effects.coverage'); },
      get science() { return t('orbit.orbits.mid-inclined.effects.science'); },
      get comms() { return t('orbit.orbits.mid-inclined.effects.comms'); },
      get duration() { return t('orbit.orbits.mid-inclined.effects.duration'); },
      get constraints() { return t('orbit.orbits.mid-inclined.effects.constraints'); },
    },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'high-elliptical',
    get name() { return t('orbit.orbits.high-elliptical.name'); },
    get shape() { return t('orbit.orbits.high-elliptical.shape'); },
    periapsisKm: 500,
    apoapsisKm: 22000,
    get description() { return t('orbit.orbits.high-elliptical.description'); },
    deltaVKmS: 1.15,
    fullYearExtraDeltaVKmS: 0.05,
    commissioningDays: 20,
    eclipseFraction: 0.06,
    contactHoursPerDay: 9.5,
    profilingFactor: 0.45,
    mappingFactor: 0.7,
    diurnalFactor: 1,
    effects: {
      get coverage() { return t('orbit.orbits.high-elliptical.effects.coverage'); },
      get science() { return t('orbit.orbits.high-elliptical.effects.science'); },
      get comms() { return t('orbit.orbits.high-elliptical.effects.comms'); },
      get duration() { return t('orbit.orbits.high-elliptical.effects.duration'); },
      get constraints() { return t('orbit.orbits.high-elliptical.effects.constraints'); },
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
    get name() { return t('orbit.durations.half-year.name'); },
    scienceDays: 343,
    get description() { return t('orbit.durations.half-year.description'); },
  },
  {
    id: 'full-year',
    get name() { return t('orbit.durations.full-year.name'); },
    scienceDays: 687,
    get description() { return t('orbit.durations.full-year.description'); },
  },
];

export const DURATION_BY_ID = Object.fromEntries(DURATIONS.map((d) => [d.id, d])) as Record<DurationId, DurationOption>;
