import { COMPONENT_BY_ID } from '@/data/components';
import { t } from '@/i18n';
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
    { label: t('score.budget_efficiency'), points: r1(7 * budgetEff), max: 7, detail: budget.ok ? t('score.of_credits_science_points_per_100', { totalCr: budget.totalCr, capCr: budget.capCr, totalCr2: (scienceValue / budget.totalCr * 100).toFixed(1) }) : t('score.over_budget_by_credits_after_launch', { remainingCr: -budget.remainingCr }) },
    { label: t('score.mass_efficiency'), points: r1(6 * massEff), max: 6, detail: t('score.kg_on_a_kg_vehicle_unused', { wetKg: Math.round(mass.wetKg), capacityKg: mass.capacityKg, marginPct: Math.round(mass.marginPct * 100) }) },
    { label: t('score.power_margin'), points: r1(7 * powerEff), max: 7, detail: t('score.lowest_full_operations_margin', { worstFullMarginPct: Math.round(sim.worstFullMarginPct * 100) }) },
  ];

  // ── Decisions ──────────────────────────────────────────────────────────────
  const decisionLines = [
    { label: t('score.launch_readiness_call'), points: readiness.points, max: readiness.maxPoints, detail: readiness.headline },
    ...opsReviews.map((r) => ({
      label: r.event === 'conjunction' ? t('score.solar_conjunction') : r.event === 'power' ? t('score.low_power_season') : t('score.dust_storm'),
      points: r.points,
      max: r.maxPoints,
      detail: r.good ? t('score.matched_the_situation') : t('score.a_better_option_was_available'),
    })),
  ];

  // ── Performance ────────────────────────────────────────────────────────────
  const commsDelivery = sim.generatedMb > 0 ? clamp01(sim.returnedMb / sim.generatedMb) : 0;
  const availability = clamp01(effectiveDays / sim.timeline.scienceDays);
  const performanceLines = [
    { label: t('score.data_returned'), points: r1(8 * dataReturnFraction), max: 8, detail: t('score.gb_of_gb_planned', { returnedMb: (sim.returnedMb / 1000).toFixed(1), plannedMb: (sim.plannedMb / 1000).toFixed(1) }) },
    { label: t('score.communication_performance'), points: r1(4 * commsDelivery), max: 4, detail: t('score.of_collected_data_reached_earth', { commsDelivery: Math.round(commsDelivery * 100) }) },
    { label: t('score.spacecraft_availability'), points: r1(3 * availability), max: 3, detail: sim.safeModeDays ? t('score.days_lost_in_safe_mode', { safeModeDays: sim.safeModeDays }) : t('score.no_days_lost_to_safe_mode') },
  ];

  const sum = (lines: { points: number }[]) => r1(lines.reduce((s, l) => s + l.points, 0));
  const categories: ScoreCategory[] = [
    {
      id: 'science',
      label: t('score.scientific_value'),
      points: r1(sciencePoints),
      max: SCORE_MAX.science,
      lines: [{ label: t('score.science_value_achieved'), points: r1(sciencePoints), max: SCORE_MAX.science, detail: t('score.100_for', { scienceValue: Math.round(scienceValue), objective: objective.name }) }],
    },
    { id: 'efficiency', label: t('score.resource_efficiency'), points: sum(efficiencyLines), max: SCORE_MAX.efficiency, lines: efficiencyLines },
    { id: 'decisions', label: t('score.decision_quality'), points: sum(decisionLines), max: SCORE_MAX.decisions, lines: decisionLines },
    { id: 'performance', label: t('score.mission_performance'), points: sum(performanceLines), max: SCORE_MAX.performance, lines: performanceLines },
  ];
  const total = Math.round(categories.reduce((s, c) => s + c.points, 0));

  const tier: OutcomeTier = total >= 85 ? 'exemplary' : total >= 70 ? 'success' : total >= 50 ? 'partial' : 'not-met';
  const tierLabel = { exemplary: t('score.exemplary_mission'), success: t('score.mission_success'), partial: t('score.partial_success'), 'not-met': t('score.objectives_not_met') }[tier];
  const tierSummary = {
    exemplary: t('score.kazmars_1_answered_its_science_question'),
    success: t('score.kazmars_1_returned_valuable_science_a'),
    partial: t('score.kazmars_1_returned_some_science_but'),
    'not-met': t('score.kazmars_1_could_not_deliver_its'),
  }[tier];

  const partial = { record, sim, mass, budget, readiness, opsReviews, science, scienceValue, dataReturnFraction };
  const mistakes = findMistakes(partial);

  const strengths: string[] = [];
  if (readiness.verdict === 'correct') strengths.push(t('score.your_launch_readiness_call_matched_the'));
  if (opsReviews.every((r) => r.good)) strengths.push(t('score.all_three_operational_decisions_fitted_the'));
  if (dataReturnFraction >= 0.97) strengths.push(t('score.almost_every_planned_observation_reached_earth'));
  if (budgetEff >= 0.95) strengths.push(t('score.excellent_science_return_for_the_budget'));
  if (massEff === 1) strengths.push(t('score.the_launch_vehicle_was_well_matched'));
  const topPart = [...science.parts].sort((a, b) => b.contribution - a.contribution)[0];
  strengths.push(t('score.strongest_science_contribution_from_the', { topPart: topPart.label.toLowerCase(), short: COMPONENT_BY_ID[design.selections.payload].short.toLowerCase() }));

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
