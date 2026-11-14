import { COMPONENT_BY_ID } from '@/data/components';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { computeBudget, type BudgetSummary } from '@/game/engine/budget';
import { computeMass, type MassSummary } from '@/game/engine/mass';
import { sciencePotential, type ScienceBreakdown } from '@/game/engine/science';
import { reviewOpsDecisions, type OpsDecisionReview } from '@/game/ops/evaluate';
import { simulateMission, type OpsDecisions, type SimResult } from '@/game/ops/simulate';
import { resolveReadiness, type ReadinessInput, type ReadinessOutcome } from '@/game/scenarios/decision';
import type { MissionDesign } from '@/types';
import { findMistakes, type Mistake } from './mistakes';

export interface MissionRecord {
  design: MissionDesign;
  seed: number;
  readiness: ReadinessInput;
  ops: OpsDecisions;
}

export interface ScoreCategory {
  id: 'science' | 'efficiency' | 'decisions' | 'performance';
  label: string;
  points: number;
  max: number;
  lines: { label: string; points: number; max: number; detail: string }[];
}

export type OutcomeTier = 'exemplary' | 'success' | 'partial' | 'not-met';

export interface MissionReport {
  record: MissionRecord;
  total: number;
  tier: OutcomeTier;
  tierLabel: string;
  tierSummary: string;
  categories: ScoreCategory[];
  /** 0–100 science value actually achieved. */
  scienceValue: number;
  science: ScienceBreakdown;
  stormBonus: number;
  sim: SimResult;
  mass: MassSummary;
  budget: BudgetSummary;
  readiness: ReadinessOutcome;
  opsReviews: OpsDecisionReview[];
  dataReturnFraction: number;
  commsDelivery: number;
  availability: number;
  mistakes: Mistake[];
  strengths: string[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export const SCORE_MAX = { science: 35, efficiency: 20, decisions: 30, performance: 15 } as const;

/** Launch-mass margin: a small positive margin is ideal; a big one means paying for unused lift. */
export function massEfficiency(marginPct: number): number {
  if (marginPct < 0) return 0;
  if (marginPct < 0.03) return 0.7 + (marginPct / 0.03) * 0.3;
  if (marginPct <= 0.15) return 1;
  if (marginPct >= 0.45) return 0.4;
  return 1 - ((marginPct - 0.15) / 0.3) * 0.6;
}

/** Power margin at the worst point of the mission: healthy margins score best. */
export function powerEfficiency(minMarginPct: number): number {
  if (minMarginPct < 0) return 0.3;
  if (minMarginPct < 0.05) return 0.6 + (minMarginPct / 0.05) * 0.4;
  if (minMarginPct <= 0.6) return 1;
  return 0.8;
}

/**
 * Deterministic mission evaluation. The same design, scenario seed and decisions always give
 * the same report — there is no random component in the score.
 */
export function evaluateMission(record: MissionRecord): MissionReport {
  const { design } = record;
  const readiness = resolveReadiness(record.readiness);
  const simOptions = { slipDays: readiness.slipDays, degradedLinkDays: readiness.degradedLinkDays };
  const sim = simulateMission(design, { ...simOptions, decisions: record.ops });
  const opsReviews = reviewOpsDecisions(design, record.ops, simOptions);
  const mass = computeMass(design);
  const budget = computeBudget(design, readiness.costCr);
  const objective = OBJECTIVE_BY_ID[design.objective];

  // ── Science ────────────────────────────────────────────────────────────────
  const effectiveDays = sim.timeline.scienceDays - sim.safeModeDays;
  const science = sciencePotential(design, effectiveDays);
  const dataReturnFraction = clamp01(sim.returnedMb / sim.plannedMb);
  const stormBonus = record.ops.storm === 'campaign' && sim.stormCampaignReturned ? objective.stormBonus : record.ops.storm === 'nominal' ? objective.stormBonus * 0.4 : 0;
  const scienceValue = Math.min(100, science.potential * dataReturnFraction * (1 + stormBonus) * 100);
  const sciencePoints = SCORE_MAX.science * clamp01(scienceValue / 85);

  // ── Efficiency ─────────────────────────────────────────────────────────────
  const budgetEff = budget.ok ? clamp01(scienceValue / budget.totalCr / 0.16) : 0;
  const massEff = massEfficiency(mass.marginPct);
  const powerEff = powerEfficiency(sim.worstFullMarginPct);
  const efficiencyLines = [
    { label: 'Budget efficiency', points: r1(7 * budgetEff), max: 7, detail: budget.ok ? `${budget.totalCr} of ${budget.capCr} credits · ${(scienceValue / budget.totalCr * 100).toFixed(1)} science points per 100 credits` : `Over budget by ${-budget.remainingCr} credits after launch-campaign costs` },
    { label: 'Mass efficiency', points: r1(6 * massEff), max: 6, detail: `${Math.round(mass.wetKg)} kg on a ${mass.capacityKg} kg vehicle · ${Math.round(mass.marginPct * 100)} % unused` },
    { label: 'Power margin', points: r1(7 * powerEff), max: 7, detail: `Lowest full-operations margin ${Math.round(sim.worstFullMarginPct * 100)} %` },
  ];

  // ── Decisions ──────────────────────────────────────────────────────────────
  const decisionLines = [
    { label: 'Launch readiness call', points: readiness.points, max: readiness.maxPoints, detail: readiness.headline },
    ...opsReviews.map((r) => ({
      label: r.event === 'conjunction' ? 'Solar conjunction' : r.event === 'power' ? 'Low-power season' : 'Dust storm',
      points: r.points,
      max: r.maxPoints,
      detail: r.good ? 'Matched the situation' : 'A better option was available',
    })),
  ];

  // ── Performance ────────────────────────────────────────────────────────────
  const commsDelivery = sim.generatedMb > 0 ? clamp01(sim.returnedMb / sim.generatedMb) : 0;
  const availability = clamp01(effectiveDays / sim.timeline.scienceDays);
  const performanceLines = [
    { label: 'Data returned', points: r1(8 * dataReturnFraction), max: 8, detail: `${(sim.returnedMb / 1000).toFixed(1)} Gb of ${(sim.plannedMb / 1000).toFixed(1)} Gb planned` },
    { label: 'Communication performance', points: r1(4 * commsDelivery), max: 4, detail: `${Math.round(commsDelivery * 100)} % of collected data reached Earth` },
    { label: 'Spacecraft availability', points: r1(3 * availability), max: 3, detail: sim.safeModeDays ? `${sim.safeModeDays} days lost in safe mode` : 'No days lost to safe mode' },
  ];

  const sum = (lines: { points: number }[]) => r1(lines.reduce((s, l) => s + l.points, 0));
  const categories: ScoreCategory[] = [
    {
      id: 'science',
      label: 'Scientific value',
      points: r1(sciencePoints),
      max: SCORE_MAX.science,
      lines: [{ label: 'Science value achieved', points: r1(sciencePoints), max: SCORE_MAX.science, detail: `${Math.round(scienceValue)} / 100 for “${objective.name}”` }],
    },
    { id: 'efficiency', label: 'Resource efficiency', points: sum(efficiencyLines), max: SCORE_MAX.efficiency, lines: efficiencyLines },
    { id: 'decisions', label: 'Decision quality', points: sum(decisionLines), max: SCORE_MAX.decisions, lines: decisionLines },
    { id: 'performance', label: 'Mission performance', points: sum(performanceLines), max: SCORE_MAX.performance, lines: performanceLines },
  ];
  const total = Math.round(categories.reduce((s, c) => s + c.points, 0));

  const tier: OutcomeTier = total >= 85 ? 'exemplary' : total >= 70 ? 'success' : total >= 50 ? 'partial' : 'not-met';
  const tierLabel = { exemplary: 'Exemplary mission', success: 'Mission success', partial: 'Partial success', 'not-met': 'Objectives not met' }[tier];
  const tierSummary = {
    exemplary: 'KAZMARS-1 answered its science question, and your team’s decisions were backed by evidence at every step.',
    success: 'KAZMARS-1 returned valuable science. A few decisions or design choices left performance on the table.',
    partial: 'KAZMARS-1 returned some science, but design limits or decisions cost a large part of the mission’s value.',
    'not-met': 'KAZMARS-1 could not deliver its science objective. The report below shows exactly where the mission was lost.',
  }[tier];

  const partial = { record, sim, mass, budget, readiness, opsReviews, science, scienceValue, dataReturnFraction };
  const mistakes = findMistakes(partial);

  const strengths: string[] = [];
  if (readiness.verdict === 'correct') strengths.push('Your launch-readiness call matched the evidence.');
  if (opsReviews.every((r) => r.good)) strengths.push('All three operational decisions fitted the situation.');
  if (dataReturnFraction >= 0.97) strengths.push('Almost every planned observation reached Earth.');
  if (budgetEff >= 0.95) strengths.push('Excellent science return for the budget spent.');
  if (massEff === 1) strengths.push('The launch vehicle was well matched to the spacecraft.');
  const topPart = [...science.parts].sort((a, b) => b.contribution - a.contribution)[0];
  strengths.push(`Strongest science contribution: ${topPart.label.toLowerCase()} from the ${COMPONENT_BY_ID[design.selections.payload].short.toLowerCase()}.`);

  return {
    record,
    total,
    tier,
    tierLabel,
    tierSummary,
    categories,
    scienceValue,
    science,
    stormBonus,
    sim,
    mass,
    budget,
    readiness,
    opsReviews,
    dataReturnFraction,
    commsDelivery,
    availability,
    mistakes,
    strengths,
  };
}
