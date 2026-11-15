import { GAME, MARS_MEAN_SUN_DISTANCE_AU } from '@/data/constants';
import { t } from '@/i18n';
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
    { id: 'preparation', label: t('timeline.mission_preparation'), startJd: launchJd, days: 0, note: t('timeline.design_testing_and_launch_readiness') },
    { id: 'launch', label: t('timeline.launch'), startJd: launchJd, days: 0, note: t('timeline.departure_in_the_late_2026_earth') },
    { id: 'transit', label: t('timeline.transit'), startJd: launchJd, days: transitDays, note: t('timeline.cruise_to_mars_simplified_hohmann_estimate') },
    { id: 'arrival', label: t('timeline.mars_arrival'), startJd: arrivalJd, days: 0, note: t('timeline.engine_burn_to_be_captured_by') },
    {
      id: 'commissioning',
      label: t('timeline.orbital_operations'),
      startJd: arrivalJd,
      days: orbit.commissioningDays,
      note: design.orbit === 'low-polar' ? t('timeline.aerobraking_down_to_the_mapping_orbit') : t('timeline.orbit_trimming_and_instrument_check_out'),
    },
    { id: 'science', label: t('timeline.scientific_observations'), startJd: scienceStartJd, days: scienceDays, note: t('timeline.the_primary_science_phase') },
    { id: 'evaluation', label: t('timeline.final_evaluation'), startJd: scienceEndJd, days: 0, note: t('timeline.mission_report_and_lessons_learned') },
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
