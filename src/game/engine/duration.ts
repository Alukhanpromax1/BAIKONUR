import { GAME, MARS_MEAN_SUN_DISTANCE_AU } from '@/data/constants';
import { DURATION_BY_ID, ORBIT_BY_ID } from '@/data/orbits';
import { jdFromIso } from '@/services/horizons/ephemeris';
import type { MissionDesign } from '@/types';

/**
 * Simplified transfer time: half the period of a Hohmann ellipse touching Earth's orbit (1 AU)
 * and Mars' mean orbit. Kepler's third law in years/AU: T = a^1.5. This is an educational
 * estimate — not a computed interplanetary trajectory.
 */
export function hohmannTransferDays(targetAu: number = MARS_MEAN_SUN_DISTANCE_AU): number {
  const a = (1 + targetAu) / 2;
  return Math.round(0.5 * a ** 1.5 * 365.25);
}

export interface TimelinePhase {
  id: 'preparation' | 'launch' | 'transit' | 'arrival' | 'commissioning' | 'science' | 'evaluation';
  label: string;
  startJd: number;
  days: number;
  note: string;
}

export interface MissionTimeline {
  launchJd: number;
  arrivalJd: number;
  scienceStartJd: number;
  scienceEndJd: number;
  transitDays: number;
  commissioningDays: number;
  scienceDays: number;
  /** Launch to end of science. */
  totalDays: number;
  phases: TimelinePhase[];
}

export function computeTimeline(design: MissionDesign, slipDays = 0): MissionTimeline {
  const orbit = ORBIT_BY_ID[design.orbit];
  const scienceDays = DURATION_BY_ID[design.duration].scienceDays;
  const launchJd = jdFromIso(GAME.launchDateIso) + slipDays;
  const transitDays = hohmannTransferDays();
  const arrivalJd = launchJd + transitDays;
  const scienceStartJd = arrivalJd + orbit.commissioningDays;
  const scienceEndJd = scienceStartJd + scienceDays;
  const phases: TimelinePhase[] = [
    { id: 'preparation', label: 'Mission preparation', startJd: launchJd, days: 0, note: 'Design, testing and launch readiness.' },
    { id: 'launch', label: 'Launch', startJd: launchJd, days: 0, note: 'Departure in the late-2026 Earth–Mars window.' },
    { id: 'transit', label: 'Transit', startJd: launchJd, days: transitDays, note: 'Cruise to Mars (simplified Hohmann estimate).' },
    { id: 'arrival', label: 'Mars arrival', startJd: arrivalJd, days: 0, note: 'Engine burn to be captured by Mars.' },
    {
      id: 'commissioning',
      label: 'Orbital operations',
      startJd: arrivalJd,
      days: orbit.commissioningDays,
      note: design.orbit === 'low-polar' ? 'Aerobraking down to the mapping orbit.' : 'Orbit trimming and instrument check-out.',
    },
    { id: 'science', label: 'Scientific observations', startJd: scienceStartJd, days: scienceDays, note: 'The primary science phase.' },
    { id: 'evaluation', label: 'Final evaluation', startJd: scienceEndJd, days: 0, note: 'Mission report and lessons learned.' },
  ];
  return {
    launchJd,
    arrivalJd,
    scienceStartJd,
    scienceEndJd,
    transitDays,
    commissioningDays: orbit.commissioningDays,
    scienceDays,
    totalDays: transitDays + orbit.commissioningDays + scienceDays,
    phases,
  };
}
