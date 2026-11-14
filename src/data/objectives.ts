import type { ObjectiveId } from '@/types';

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
    name: 'Climate record',
    question: 'How does the atmosphere change through the Martian seasons?',
    description: 'Build a season-by-season record of temperature, dust and ice at every height.',
    needs: 'Vertical profiles and a full Mars year matter most.',
    weights: { profiling: 0.45, mapping: 0.1, seasons: 0.35, diurnal: 0.1 },
    stormBonus: 0.03,
  },
  {
    id: 'dust',
    name: 'Dust storm watch',
    question: 'Where do dust storms start, and how do they grow?',
    description: 'Catch storms as they form and follow them across the planet day by day.',
    needs: 'Sharp daily global maps matter most; vertical dust profiles add depth.',
    weights: { profiling: 0.25, mapping: 0.45, seasons: 0.2, diurnal: 0.1 },
    stormBonus: 0.08,
  },
  {
    id: 'clouds',
    name: 'Clouds & water cycle',
    question: 'How do water-ice clouds form and fade during a Martian day?',
    description: 'Follow clouds and water vapour from dawn to dusk across the whole disc.',
    needs: 'Seeing many times of day matters most, with both maps and profiles.',
    weights: { profiling: 0.25, mapping: 0.25, seasons: 0.15, diurnal: 0.35 },
    stormBonus: 0.03,
  },
];

export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o])) as Record<ObjectiveId, Objective>;
