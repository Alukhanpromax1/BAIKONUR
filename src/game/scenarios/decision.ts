import type { ScenarioId } from './telemetry';
import { t } from '@/i18n';

export type EvidencePanel = 'compare' | 'raw' | 'trend';
export type PrimaryChoice = 'hold' | 'cross' | 'proceed';
/** Recommendation to the Flight Director after cross-validating. */
export type FinalCall = 'scrub' | 'resync' | 'resume';

export interface ReadinessInput {
  scenario: ScenarioId;
  choice: PrimaryChoice;
  panelsViewed: EvidencePanel[];
  finalCall?: FinalCall;
}

export type Verdict = 'correct' | 'right-thin-evidence' | 'false-positive' | 'false-negative' | 'misdiagnosed' | 'lucky';

export interface ReadinessOutcome {
  points: number;
  maxPoints: number;
  verdict: Verdict;
  /** 0–3: how many evidence panels informed the decision. */
  evidenceQuality: number;
  slipDays: number;
  costCr: number;
  /** Days of degraded downlink at the start of science (unresolved data-chain fault). */
  degradedLinkDays: number;
  headline: string;
  narrative: string;
  truthTitle: string;
  truthExplain: string;
}

export const READINESS_MAX_POINTS = 18;

export const SCENARIO_TRUTH: Record<ScenarioId, { title: string; explain: string; clue: string }> = {
  hardware: {
    get title() { return t('verdict.scenario_truth.hardware.title'); },
    get explain() { return t('verdict.scenario_truth.hardware.explain'); },
    get clue() { return t('verdict.scenario_truth.hardware.clue'); },
  },
  'data-chain': {
    get title() { return t('verdict.scenario_truth.data_chain.title'); },
    get explain() { return t('verdict.scenario_truth.data_chain.explain'); },
    get clue() { return t('verdict.scenario_truth.data_chain.clue'); },
  },
  noise: {
    get title() { return t('verdict.scenario_truth.noise.title'); },
    get explain() { return t('verdict.scenario_truth.noise.explain'); },
    get clue() { return t('verdict.scenario_truth.noise.clue'); },
  },
};

const ABORT = { slipDays: 9, costCr: 22 };
const SCRUB_JUSTIFIED = { slipDays: 3, costCr: 8 };
const SCRUB_UNNEEDED = { slipDays: 2, costCr: 6 };

/**
 * Deterministic consequence of the launch-readiness decision. Neither engineer is always
 * right: the outcome depends on the hidden ground truth and on the evidence the team used.
 * All countdown events are simulated; an adult Flight Director keeps launch-safety authority.
 */
export function resolveReadiness(input: ReadinessInput): ReadinessOutcome {
  const { scenario, choice } = input;
  const viewed = choice === 'cross' ? 3 : new Set(input.panelsViewed).size;
  const truth = SCENARIO_TRUTH[scenario];
  const base = { maxPoints: READINESS_MAX_POINTS, evidenceQuality: viewed, truthTitle: truth.title, truthExplain: truth.explain, degradedLinkDays: 0 };
  const informed = viewed >= 2;

  const abort = (how: string): ReadinessOutcome => ({
    ...base,
    points: choice === 'cross' ? 2 : 0,
    verdict: 'false-negative',
    ...ABORT,
    headline: t('verdict.countdown_stopped_by_the_flight_director'),
    narrative: t('verdict.at_t_10_s_the_flight', { how }),
  });

  if (choice === 'hold') {
    if (scenario === 'hardware') {
      return {
        ...base,
        points: informed ? 18 : viewed === 1 ? 15 : 12,
        verdict: informed ? 'correct' : 'right-thin-evidence',
        ...SCRUB_JUSTIFIED,
        headline: t('verdict.justified_hold'),
        narrative: informed
          ? t('verdict.you_stopped_the_countdown_and_the')
          : t('verdict.you_stopped_the_countdown_and_the_2'),
      };
    }
    return {
      ...base,
      points: informed ? 6 : 4,
      verdict: 'false-positive',
      ...SCRUB_UNNEEDED,
      headline: t('verdict.unnecessary_hold'),
      narrative:
        scenario === 'data-chain'
          ? t('verdict.the_hardware_inspection_found_a_perfectly')
          : t('verdict.the_hardware_inspection_found_nothing_wrong'),
    };
  }

  if (choice === 'cross') {
    const call = input.finalCall ?? 'resume';
    if (scenario === 'hardware') {
      if (call === 'scrub') {
        return {
          ...base,
          points: 18,
          verdict: 'correct',
          ...SCRUB_JUSTIFIED,
          headline: t('verdict.evidence_based_hold'),
          narrative:
            t('verdict.cross_checking_showed_both_pressure_sensors'),
        };
      }
      return abort(t('verdict.you_cross_checked_the_data_but'));
    }
    if (scenario === 'data-chain') {
      if (call === 'resync') {
        return {
          ...base,
          points: 18,
          verdict: 'correct',
          slipDays: 0,
          costCr: 0,
          headline: t('verdict.fault_found_in_the_data_chain'),
          narrative:
            t('verdict.raw_counts_were_steady_while_processed'),
        };
      }
      if (call === 'scrub') {
        return {
          ...base,
          points: 8,
          verdict: 'false-positive',
          ...SCRUB_UNNEEDED,
          headline: t('verdict.careful_but_the_wrong_conclusion'),
          narrative:
            t('verdict.you_checked_the_evidence_then_recommended'),
        };
      }
      return {
        ...base,
        points: 9,
        verdict: 'misdiagnosed',
        slipDays: 0,
        costCr: 0,
        degradedLinkDays: 30,
        headline: t('verdict.launched_with_an_unfixed_data_fault'),
        narrative:
          t('verdict.you_judged_the_alarm_to_be'),
      };
    }
    // noise
    if (call === 'resume') {
      return {
        ...base,
        points: 18,
        verdict: 'correct',
        slipDays: 0,
        costCr: 0,
        headline: t('verdict.noise_correctly_identified'),
        narrative:
          t('verdict.one_isolated_sample_no_confirmation_from'),
      };
    }
    if (call === 'resync') {
      return {
        ...base,
        points: 14,
        verdict: 'misdiagnosed',
        slipDays: 0,
        costCr: 0,
        headline: t('verdict.safe_call_wrong_diagnosis'),
        narrative:
          t('verdict.you_switched_to_the_backup_telemetry'),
      };
    }
    return {
      ...base,
      points: 8,
      verdict: 'false-positive',
      ...SCRUB_UNNEEDED,
      headline: t('verdict.careful_but_the_wrong_conclusion'),
      narrative:
        t('verdict.you_checked_the_evidence_then_recommended_2'),
    };
  }

  // proceed
  if (scenario === 'hardware') return abort(t('verdict.you_continued_the_countdown_without_resolving'));
  if (scenario === 'data-chain') {
    return {
      ...base,
      points: informed ? 5 : 3,
      verdict: 'lucky',
      slipDays: 0,
      costCr: 0,
      degradedLinkDays: 30,
      headline: t('verdict.launched_by_luck_not_by_evidence'),
      narrative:
        t('verdict.the_tank_was_healthy_so_the'),
    };
  }
  return {
    ...base,
    points: informed ? 14 : 6,
    verdict: informed ? 'correct' : 'lucky',
    slipDays: 0,
    costCr: 0,
    headline: informed ? t('verdict.proceeded_on_good_evidence') : t('verdict.launched_by_luck_not_by_evidence'),
    narrative: informed
      ? t('verdict.you_had_looked_one_isolated_sample')
      : t('verdict.it_was_only_sensor_noise_so'),
  };
}
