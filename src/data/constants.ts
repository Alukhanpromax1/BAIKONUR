import type { Provenance } from '@/types';

/**
 * Physical reference values and the game's global assumptions.
 * Anything tagged `educational_game_assumption` is an illustrative game value,
 * NOT a specification of any real spacecraft.
 */
export interface Tagged<T> {
  value: T;
  unit: string;
  provenance: Provenance;
  note: string;
}

/** Astronomical unit in km — exact by IAU 2012 Resolution B2. */
export const AU_KM = 149_597_870.7;
/** Speed of light in km/s — exact by SI definition. */
export const C_KM_S = 299_792.458;
/** Standard gravity, m/s² — exact by definition. */
export const G0 = 9.80665;

/** Nominal total solar irradiance at 1 AU (IAU 2015 Resolution B3 nominal value). */
export const SOLAR_IRRADIANCE_1AU_W_M2 = 1361;

/**
 * Mars' mean distance from the Sun (semi-major axis), AU.
 * Derived in-repo from the cached JPL Horizons snapshot as (perihelion + aphelion) / 2
 * = (1.3812 + 1.6661) / 2. See src/services/horizons/ephemeris.ts for the live computation.
 */
export const MARS_MEAN_SUN_DISTANCE_AU = 1.5236;

/** Length of one Mars year in Earth days (sidereal orbital period). */
export const MARS_YEAR_DAYS = 687;

export const GAME = {
  /** Total simulated budget in game credits. */
  budgetCapCr: 580,
  /** Fixed spacecraft bus (structure, avionics, attitude control, thermal, harness). */
  busMassKg: 190,
  busPowerW: 330,
  busCostCr: 95,
  /** Bus power split shown in the advanced breakdown. Sums to busPowerW. */
  busPowerSplit: { 'Flight computer & avionics': 110, 'Attitude control': 70, 'Thermal control (heaters)': 110, 'Harness & other': 40 },
  /** Solar-cell efficiency × system losses (pointing, wiring, ageing). */
  cellEfficiency: 0.29,
  arraySystemFactor: 0.72,
  /** Propellant reserve added on top of the rocket-equation result. */
  propellantReserveFactor: 1.03,
  /** Daily operations cost while the spacecraft is commissioning or doing science. */
  opsCostCrPerDay: 0.11,
  /** Fictional launch date at the start of the real late-2026 Earth→Mars window. */
  launchDateIso: '2026-11-20',
  /** Sun–Earth–Mars angle below which the game suspends communications. */
  conjunctionSepDeg: 2,
  /** Step of the mission simulation — equals the Horizons snapshot step. */
  simStepDays: 2,
} as const;

export const ASSUMPTION_NOTE =
  'Illustrative game value chosen for teaching trade-offs. It is not a specification of any real spacecraft, launch vehicle or mission.';
