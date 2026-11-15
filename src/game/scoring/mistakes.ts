import type { BudgetSummary } from '@/game/engine/budget';
import { t } from '@/i18n';
import type { MassSummary } from '@/game/engine/mass';
import type { ScienceBreakdown } from '@/game/engine/science';
import { CHOICE_LABEL, type OpsDecisionReview } from '@/game/ops/evaluate';
import type { SimResult } from '@/game/ops/simulate';
import { SCENARIO_TRUTH, type ReadinessOutcome } from '@/game/scenarios/decision';
import type { MissionRecord } from './score';

export type MistakeType = 'False Positive' | 'False Negative' | 'Poor Data Validation' | 'Resource Mismanagement' | 'Poor Risk Assessment';

export const MISTAKE_DEFINITIONS: Record<MistakeType, string> = {
  get 'False Positive'() { return t('mistake.mistake_definitions.false_positive'); },
  get 'False Negative'() { return t('mistake.mistake_definitions.false_negative'); },
  get 'Poor Data Validation'() { return t('mistake.mistake_definitions.poor_data_validation'); },
  get 'Resource Mismanagement'() { return t('mistake.mistake_definitions.resource_mismanagement'); },
  get 'Poor Risk Assessment'() { return t('mistake.mistake_definitions.poor_risk_assessment'); },
};

export interface Mistake {
  type: MistakeType;
  title: string;
  /** 1 — what the team decided. */
  decision: string;
  /** 2 — the evidence available at that time. */
  evidence: string;
  /** 3 — what was misunderstood. */
  misunderstanding: string;
  /** 4 — what it caused. */
  consequence: string;
  /** 5 — the engineering lesson. */
  lesson: string;
}

interface Context {
  record: MissionRecord;
  sim: SimResult;
  mass: MassSummary;
  budget: BudgetSummary;
  readiness: ReadinessOutcome;
  opsReviews: OpsDecisionReview[];
  science: ScienceBreakdown;
  scienceValue: number;
  dataReturnFraction: number;
}

const PRIMARY_LABEL = { get hold() { return t('mistake.primary_label.hold'); }, get cross() { return t('mistake.primary_label.cross'); }, get proceed() { return t('mistake.primary_label.proceed'); } } as const;
const CALL_LABEL = { get scrub() { return t('mistake.call_label.scrub'); }, get resync() { return t('mistake.call_label.resync'); }, get resume() { return t('mistake.call_label.resume'); } } as const;

/** Turns the mission record into plain-language lessons. Deterministic. */
export function findMistakes(ctx: Context): Mistake[] {
  const { record, sim, mass, budget, readiness, opsReviews } = ctx;
  const out: Mistake[] = [];
  const r = record.readiness;
  const truth = SCENARIO_TRUTH[r.scenario];
  const viewed = readiness.evidenceQuality;
  const decisionText = r.choice === 'cross' ? `${PRIMARY_LABEL.cross}, then ${CALL_LABEL[r.finalCall ?? 'resume']}.` : `${PRIMARY_LABEL[r.choice]}.`;
  const evidenceSeen = r.choice === 'cross' ? t('mistake.all_three_evidence_panels_were_reviewed') : viewed === 0 ? t('mistake.no_evidence_panel_was_opened_before') : t('mistake.of_3_evidence_panels_were_opened', { viewed });

  if (readiness.verdict === 'false-positive') {
    out.push({
      type: 'False Positive',
      title: t('mistake.the_countdown_was_stopped_for_a'),
      decision: decisionText,
      evidence: t('mistake.the_clue_that_was_available', { evidenceSeen, clue: truth.clue }),
      misunderstanding: r.scenario === 'data-chain' ? t('mistake.a_fault_in_how_the_data') : t('mistake.one_abnormal_sample_was_treated_as'),
      consequence: t('mistake.launch_slipped_days_and_cost_credits', { slipDays: readiness.slipDays, costCr: readiness.costCr }),
      lesson: t('mistake.an_alarm_tells_you_where_to'),
    });
  }
  if (readiness.verdict === 'false-negative') {
    out.push({
      type: 'False Negative',
      title: t('mistake.a_real_leak_was_treated_as'),
      decision: decisionText,
      evidence: t('mistake.the_clue_that_was_available', { evidenceSeen, clue: truth.clue }),
      misunderstanding: t('mistake.a_persistent_trend_confirmed_by_two'),
      consequence: t('mistake.the_flight_directors_safety_rule_stopped', { slipDays: readiness.slipDays, costCr: readiness.costCr }),
      lesson: t('mistake.when_independent_sensors_tell_the_same'),
    });
  }
  if (readiness.verdict === 'misdiagnosed') {
    out.push({
      type: 'Poor Data Validation',
      title: t('mistake.the_evidence_was_checked_but_the'),
      decision: decisionText,
      evidence: t('mistake.all_three_panels_were_reviewed_the', { clue: truth.clue }),
      misunderstanding: r.scenario === 'data-chain' ? t('mistake.packet_gaps_duplicates_and_a_raw') : t('mistake.the_packet_log_was_clean_and'),
      consequence: readiness.degradedLinkDays ? t('mistake.the_unfixed_data_path_garbled_part', { degradedLinkDays: readiness.degradedLinkDays }) : t('mistake.no_harm_this_time_but_the'),
      lesson: t('mistake.ask_two_questions_of_every_strange'),
    });
  }
  if ((readiness.verdict === 'lucky' || readiness.verdict === 'right-thin-evidence') && viewed < 2) {
    out.push({
      type: 'Poor Data Validation',
      title: t('mistake.the_decision_was_made_before_the'),
      decision: decisionText,
      evidence: t('mistake.sensor_comparison_raw_telemetry_and_trend', { evidenceSeen }),
      misunderstanding: t('mistake.the_outcome_was_acceptable_so_the'),
      consequence: readiness.verdict === 'lucky' ? t('mistake.the_mission_continued_by_good_fortune') : t('mistake.the_hold_was_correct_but_it'),
      lesson: t('mistake.judge_a_decision_by_what_you'),
    });
  }
  if (r.choice === 'proceed' && readiness.verdict !== 'correct') {
    out.push({
      type: 'Poor Risk Assessment',
      title: t('mistake.the_countdown_continued_with_an_unexplained'),
      decision: decisionText,
      evidence: t('mistake.two_engineers_disagreed_about_the_cause', { evidenceSeen }),
      misunderstanding: t('mistake.an_unexplained_alarm_is_an_unknown'),
      consequence: readiness.verdict === 'false-negative' ? t('mistake.a_real_leak_reached_the_final') : t('mistake.nothing_failed_at_launch_but_the'),
      lesson: t('mistake.before_accepting_a_risk_be_able'),
    });
  }

  for (const review of opsReviews) {
    if (review.good) continue;
    const decision = `${CHOICE_LABEL[review.choice]}.`;
    if (review.event === 'conjunction' && review.choice === 'command') {
      out.push({
        type: 'Poor Risk Assessment',
        title: t('mistake.commands_were_sent_through_the_suns'),
        decision,
        evidence: review.evidence,
        misunderstanding: t('mistake.a_weak_signal_is_not_the'),
        consequence: t('mistake.the_spacecraft_entered_safe_mode_and'),
        lesson: t('mistake.sometimes_the_safest_action_is_to'),
      });
    } else if (review.points <= 1) {
      out.push({
        type: review.event === 'power' ? 'Poor Risk Assessment' : 'Resource Mismanagement',
        title: review.event === 'power' ? t('mistake.full_operations_with_too_little_power') : review.event === 'storm' ? t('mistake.more_data_was_collected_than_could') : t('mistake.the_recorder_overflowed_during_the_blackout'),
        decision,
        evidence: review.evidence,
        misunderstanding: review.event === 'power' ? t('mistake.an_average_margin_near_zero_is') : t('mistake.collected_data_only_counts_as_science'),
        consequence: review.why,
        lesson: review.event === 'power' ? t('mistake.margins_exist_for_the_bad_days') : t('mistake.match_what_you_collect_to_what') + CHOICE_LABEL[review.best].toLowerCase() + '.',
      });
    } else {
      out.push({
        type: 'Resource Mismanagement',
        title: review.event === 'power' ? t('mistake.more_power_was_saved_than_necessary') : review.event === 'storm' ? t('mistake.spare_capacity_went_unused_during_the') : t('mistake.observations_were_cut_although_the_recorder'),
        decision,
        evidence: review.evidence,
        misunderstanding: t('mistake.caution_has_a_cost_too_the'),
        consequence: review.why,
        lesson: t('mistake.being_careful_means_reading_the_margins') + CHOICE_LABEL[review.best].toLowerCase() + '.',
      });
    }
  }

  const designLost = sim.lostMb - sim.lostInWindowMb.conjunction - sim.lostInWindowMb.storm;
  if (designLost > sim.plannedMb * 0.03) {
    out.push({
      type: 'Resource Mismanagement',
      title: t('mistake.the_link_could_not_keep_up'),
      decision: t('mistake.spacecraft_design_payload_antenna_and_recorder'),
      evidence: t('mistake.the_payload_produced_mb_per_day', { nominalDailyMb: Math.round(sim.nominalDailyMb) }),
      misunderstanding: t('mistake.an_instruments_value_depends_on_the'),
      consequence: t('mistake.gb_of_observations_were_overwritten_on', { lostMb: (sim.lostMb / 1000).toFixed(1) }),
      lesson: t('mistake.design_the_data_path_first_a'),
    });
  }
  if (!budget.ok) {
    out.push({
      type: 'Resource Mismanagement',
      title: t('mistake.launch_campaign_costs_pushed_the_mission'),
      decision: t('mistake.a_design_that_used_almost_the'),
      evidence: t('mistake.planned_cost_left_credits_of_reserve', { eventsCr: budget.remainingCr + budget.eventsCr, eventsCr2: budget.eventsCr }),
      misunderstanding: t('mistake.a_budget_with_no_reserve_assumes'),
      consequence: t('mistake.the_mission_ended_credits_over_budget', { remainingCr: -budget.remainingCr }),
      lesson: t('mistake.keep_a_reserve_real_projects_hold'),
    });
  }
  if (mass.marginPct > 0.3) {
    out.push({
      type: 'Resource Mismanagement',
      title: t('mistake.a_larger_rocket_than_the_spacecraft'),
      decision: t('mistake.launch_vehicle_selection'),
      evidence: t('mistake.the_fuelled_spacecraft_weighed_kg_the', { wetKg: Math.round(mass.wetKg), capacityKg: mass.capacityKg }),
      misunderstanding: t('mistake.unused_launch_capacity_is_budget_that'),
      consequence: t('mistake.of_the_launch_capacity_flew_empty', { marginPct: Math.round(mass.marginPct * 100) }),
      lesson: t('mistake.size_the_launch_vehicle_to_the'),
    });
  }
  return out;
}
