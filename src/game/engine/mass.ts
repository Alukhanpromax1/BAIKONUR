import { COMPONENT_BY_ID } from '@/data/components';
import { G0, GAME } from '@/data/constants';
import { VEHICLE_BY_ID } from '@/data/launchVehicles';
import { ORBIT_BY_ID } from '@/data/orbits';
import type { MissionDesign, SlotId } from '@/types';

/**
 * Tsiolkovsky rocket equation solved for propellant:
 *   m_prop = m_dry · (e^(Δv / (Isp·g0)) − 1)
 * Δv in km/s, Isp in seconds. Returns kg.
 */
export function propellantForDeltaV(dryMassKg: number, deltaVKmS: number, ispS: number): number {
  if (dryMassKg < 0 || deltaVKmS < 0 || ispS <= 0) throw new Error('Invalid rocket-equation input.');
  return dryMassKg * (Math.exp((deltaVKmS * 1000) / (ispS * G0)) - 1);
}

export interface MassLine {
  label: string;
  kg: number;
  slot?: SlotId;
}

export interface MassSummary {
  lines: MassLine[];
  dryKg: number;
  deltaVKmS: number;
  propellantKg: number;
  tankCapacityKg: number;
  tankOk: boolean;
  /** Dry mass + propellant: what the launch vehicle must lift. */
  wetKg: number;
  capacityKg: number;
  /** Remaining launch capacity (negative = too heavy). */
  marginKg: number;
  marginPct: number;
  launchOk: boolean;
}

export function totalDeltaVKmS(design: MissionDesign): number {
  const orbit = ORBIT_BY_ID[design.orbit];
  return orbit.deltaVKmS + (design.duration === 'full-year' ? orbit.fullYearExtraDeltaVKmS : 0);
}

export function computeMass(design: MissionDesign): MassSummary {
  const s = design.selections;
  const slots: SlotId[] = ['payload', 'power', 'comms', 'storage', 'propulsion'];
  const lines: MassLine[] = [
    { label: 'Spacecraft bus', kg: GAME.busMassKg },
    ...slots.map((slot) => ({ label: COMPONENT_BY_ID[s[slot]].name, kg: COMPONENT_BY_ID[s[slot]].massKg, slot })),
  ];
  const dryKg = lines.reduce((sum, l) => sum + l.kg, 0);
  const prop = COMPONENT_BY_ID[s.propulsion];
  const deltaVKmS = totalDeltaVKmS(design);
  const propellantKg = propellantForDeltaV(dryKg, deltaVKmS, prop.ispS ?? 300) * GAME.propellantReserveFactor;
  const tankCapacityKg = prop.tankCapacityKg ?? 0;
  const wetKg = dryKg + propellantKg;
  const capacityKg = VEHICLE_BY_ID[design.vehicle].capacityKg;
  return {
    lines,
    dryKg,
    deltaVKmS,
    propellantKg,
    tankCapacityKg,
    tankOk: propellantKg <= tankCapacityKg,
    wetKg,
    capacityKg,
    marginKg: capacityKg - wetKg,
    marginPct: (capacityKg - wetKg) / capacityKg,
    launchOk: wetKg <= capacityKg,
  };
}
