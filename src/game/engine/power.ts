import { COMPONENT_BY_ID } from '@/data/components';
import { t } from '@/i18n';
import { GAME, MARS_MEAN_SUN_DISTANCE_AU, SOLAR_IRRADIANCE_1AU_W_M2 } from '@/data/constants';
import { ORBIT_BY_ID } from '@/data/orbits';
import type { MissionDesign, SlotId } from '@/types';

/** Sunlight intensity at a distance from the Sun (inverse-square law), W/m². */
export function solarIrradianceWm2(distanceAu: number): number {
  if (!(distanceAu > 0)) throw new Error('Distance from the Sun must be positive.');
  return SOLAR_IRRADIANCE_1AU_W_M2 / distanceAu ** 2;
}

/** Electrical power produced by a sunlit array, W. */
export function arrayPowerW(areaM2: number, distanceAu: number): number {
  return solarIrradianceWm2(distanceAu) * areaM2 * GAME.cellEfficiency * GAME.arraySystemFactor;
}

/** Orbit-average power once the time spent in Mars' shadow is removed, W. */
export function orbitAveragePowerW(areaM2: number, distanceAu: number, eclipseFraction: number): number {
  return arrayPowerW(areaM2, distanceAu) * (1 - eclipseFraction);
}

export interface PowerLine {
  label: string;
  watts: number;
  slot?: SlotId;
}

export interface PowerSummary {
  distanceAu: number;
  irradianceWm2: number;
  /** Array output in full sunlight. */
  sunlitW: number;
  /** Orbit-average power available to the spacecraft. */
  availableW: number;
  instrumentW: number;
  busW: number;
  subsystemW: number;
  consumptionW: number;
  marginW: number;
  /** Margin as a fraction of consumption (0.1 = 10 % spare). */
  marginPct: number;
  lines: PowerLine[];
}

export function totalConsumptionW(design: MissionDesign): number {
  const s = design.selections;
  return (
    GAME.busPowerW +
    COMPONENT_BY_ID[s.payload].powerW +
    COMPONENT_BY_ID[s.comms].powerW +
    COMPONENT_BY_ID[s.storage].powerW +
    COMPONENT_BY_ID[s.propulsion].powerW
  );
}

export function computePower(design: MissionDesign, distanceAu: number = MARS_MEAN_SUN_DISTANCE_AU): PowerSummary {
  const s = design.selections;
  const array = COMPONENT_BY_ID[s.power];
  const orbit = ORBIT_BY_ID[design.orbit];
  const area = array.arrayAreaM2 ?? 0;
  const sunlitW = arrayPowerW(area, distanceAu);
  const availableW = sunlitW * (1 - orbit.eclipseFraction);
  const instrumentW = COMPONENT_BY_ID[s.payload].powerW;
  const lines: PowerLine[] = [
    { label: t('power.spacecraft_bus'), watts: GAME.busPowerW },
    { label: COMPONENT_BY_ID[s.payload].name, watts: instrumentW, slot: 'payload' },
    { label: COMPONENT_BY_ID[s.comms].name, watts: COMPONENT_BY_ID[s.comms].powerW, slot: 'comms' },
    { label: COMPONENT_BY_ID[s.storage].name, watts: COMPONENT_BY_ID[s.storage].powerW, slot: 'storage' },
    { label: COMPONENT_BY_ID[s.propulsion].name, watts: COMPONENT_BY_ID[s.propulsion].powerW, slot: 'propulsion' },
  ];
  const consumptionW = lines.reduce((sum, l) => sum + l.watts, 0);
  return {
    distanceAu,
    irradianceWm2: solarIrradianceWm2(distanceAu),
    sunlitW,
    availableW,
    instrumentW,
    busW: GAME.busPowerW,
    subsystemW: consumptionW - instrumentW - GAME.busPowerW,
    consumptionW,
    marginW: availableW - consumptionW,
    marginPct: (availableW - consumptionW) / consumptionW,
    lines,
  };
}
