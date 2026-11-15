import type { ObjectiveId } from '@/types';
import { t } from '@/i18n';

export interface Objective {
  id: ObjectiveId;
  name: string;
  question: string;
  description: string;
  needs: string;
  /** Weights of the four observation qualities. They sum to 1. */
  weights: { profiling: number; mapping: number; seasons: number; diurnal: number };
  stormBonus: number;
}

/**
 * Three ways to study "Martian atmospheric dust and climate variability".
 * The weights are illustrative game values that make different designs succeed.
 */
export const OBJECTIVES: Objective[] = [
  {
    id: 'climate',
    get name() { return t('objective.objectives.climate.name'); },
    get question() { return t('objective.objectives.climate.question'); },
    get description() { return t('objective.objectives.climate.description'); },
    get needs() { return t('objective.objectives.climate.needs'); },
    weights: { profiling: 0.45, mapping: 0.1, seasons: 0.35, diurnal: 0.1 },
    stormBonus: 0.03,
  },
  {
    id: 'dust',
    get name() { return t('objective.objectives.dust.name'); },
    get question() { return t('objective.objectives.dust.question'); },
    get description() { return t('objective.objectives.dust.description'); },
    get needs() { return t('objective.objectives.dust.needs'); },
    weights: { profiling: 0.25, mapping: 0.45, seasons: 0.2, diurnal: 0.1 },
    stormBonus: 0.08,
  },
  {
    id: 'clouds',
    get name() { return t('objective.objectives.clouds.name'); },
    get question() { return t('objective.objectives.clouds.question'); },
    get description() { return t('objective.objectives.clouds.description'); },
    get needs() { return t('objective.objectives.clouds.needs'); },
    weights: { profiling: 0.25, mapping: 0.25, seasons: 0.15, diurnal: 0.35 },
    stormBonus: 0.03,
  },
];

export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o])) as Record<ObjectiveId, Objective>;
