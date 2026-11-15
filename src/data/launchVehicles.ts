import type { Provenance, VehicleId } from '@/types';
import { t } from '@/i18n';

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
    get name() { return t('vehicle.launch_vehicles.tulpar-l.name'); },
    get klass() { return t('vehicle.launch_vehicles.tulpar-l.klass'); },
    capacityKg: 480,
    costCr: 105,
    heightM: 38,
    get description() { return t('vehicle.launch_vehicles.tulpar-l.description'); },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'tulpar-m',
    get name() { return t('vehicle.launch_vehicles.tulpar-m.name'); },
    get klass() { return t('vehicle.launch_vehicles.tulpar-m.klass'); },
    capacityKg: 620,
    costCr: 150,
    heightM: 46,
    get description() { return t('vehicle.launch_vehicles.tulpar-m.description'); },
    provenance: 'educational_game_assumption',
  },
  {
    id: 'tulpar-h',
    get name() { return t('vehicle.launch_vehicles.tulpar-h.name'); },
    get klass() { return t('vehicle.launch_vehicles.tulpar-h.klass'); },
    capacityKg: 900,
    costCr: 195,
    heightM: 55,
    get description() { return t('vehicle.launch_vehicles.tulpar-h.description'); },
    provenance: 'educational_game_assumption',
  },
];

export const VEHICLE_BY_ID = Object.fromEntries(LAUNCH_VEHICLES.map((v) => [v.id, v])) as Record<VehicleId, LaunchVehicle>;
