import { COMPONENT_BY_ID } from '@/data/components';
import { MARS_YEAR_DAYS } from '@/data/constants';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { ORBIT_BY_ID } from '@/data/orbits';
import type { MissionDesign } from '@/types';

export interface ScienceBreakdown {
  profiling: number;
  mapping: number;
  seasons: number;
  diurnal: number;
  /** Objective-weighted potential, 0–1. */
  potential: number;
  parts: { key: 'profiling' | 'mapping' | 'seasons' | 'diurnal'; label: string; quality: number; weight: number; contribution: number }[];
}

/**
 * Science potential of a design for its objective: how well instrument + orbit + duration can
 * answer the science question, before any data is lost. Illustrative model.
 */
export function sciencePotential(design: MissionDesign, effectiveScienceDays: number): ScienceBreakdown {
  const payload = COMPONENT_BY_ID[design.selections.payload];
  const orbit = ORBIT_BY_ID[design.orbit];
  const w = OBJECTIVE_BY_ID[design.objective].weights;
  const profiling = (payload.profiling ?? 0) * orbit.profilingFactor;
  const mapping = (payload.mapping ?? 0) * orbit.mappingFactor;
  const seasons = Math.max(0, Math.min(1, effectiveScienceDays / MARS_YEAR_DAYS));
  const diurnal = orbit.diurnalFactor;
  const parts: ScienceBreakdown['parts'] = [
    { key: 'profiling', label: 'Vertical profiles', quality: profiling, weight: w.profiling, contribution: profiling * w.profiling },
    { key: 'mapping', label: 'Global maps', quality: mapping, weight: w.mapping, contribution: mapping * w.mapping },
    { key: 'seasons', label: 'Seasons covered', quality: seasons, weight: w.seasons, contribution: seasons * w.seasons },
    { key: 'diurnal', label: 'Times of day', quality: diurnal, weight: w.diurnal, contribution: diurnal * w.diurnal },
  ];
  return { profiling, mapping, seasons, diurnal, potential: parts.reduce((s, p) => s + p.contribution, 0), parts };
}
