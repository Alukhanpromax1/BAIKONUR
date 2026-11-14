import type { Provenance, VehicleId } from '@/types';

export interface LaunchVehicle {
  id: VehicleId;
  name: string;
  klass: string;
  /** Maximum spacecraft wet mass that can be sent toward Mars, kg. */
  capacityKg: number;
  costCr: number;
  heightM: number;
  description: string;
  provenance: Provenance;
}

/**
 * FICTIONAL educational launch vehicles. The "Tulpar" family does not exist; its numbers are
 * illustrative game values and do not describe any real rocket or any real Baikonur launcher.
 */
export const LAUNCH_VEHICLES: LaunchVehicle[] = [
  {
    id: 'tulpar-l',
    name: 'Tulpar-L',
    klass: 'Light class',
    capacityKg: 480,
    costCr: 105,
    heightM: 38,
    description: 'The most affordable ride. Only a light spacecraft bound for an easy orbit will fit.',
    provenance: 'educational_game_assumption',
  },
  {
    id: 'tulpar-m',
    name: 'Tulpar-M',
    klass: 'Medium class',
    capacityKg: 620,
    costCr: 150,
    heightM: 46,
    description: 'A balanced choice with room for a well-equipped orbiter.',
    provenance: 'educational_game_assumption',
  },
  {
    id: 'tulpar-h',
    name: 'Tulpar-H',
    klass: 'Heavy class',
    capacityKg: 900,
    costCr: 195,
    heightM: 55,
    description: 'Lifts almost anything you can design — and takes a large share of the budget.',
    provenance: 'educational_game_assumption',
  },
];

export const VEHICLE_BY_ID = Object.fromEntries(LAUNCH_VEHICLES.map((v) => [v.id, v])) as Record<VehicleId, LaunchVehicle>;
