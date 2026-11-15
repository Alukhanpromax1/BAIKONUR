import type { MissionDesign } from '@/types';
import { t } from '@/i18n';
import {
  POWER_MARGIN_RULE,
  POWER_MODE,
  simulateMission,
  type ConjunctionChoice,
  type OpsDecisions,
  type OpsEventId,
  type PowerChoice,
  type SimOptions,
  type StormChoice,
} from './simulate';

export const OPS_POINTS_EACH = 4;

export interface OpsDecisionReview {
  event: OpsEventId;
  choice: string;
  best: string;
  points: number;
  maxPoints: number;
  /** What the situation looked like when the team decided. */
  evidence: string;
  /** Why the choice worked or did not. */
  why: string;
  good: boolean;
}

const POWER_ORDER: PowerChoice[] = ['full', 'cycle', 'reserve'];
const STORM_ORDER: StormChoice[] = ['protect', 'nominal', 'campaign'];

/** The shallowest power mode that keeps the 5 % margin rule at the worst point. */
export function requiredPowerMode(worstFullMarginPct: number): PowerChoice {
  for (const mode of POWER_ORDER) {
    if ((1 + worstFullMarginPct) / POWER_MODE[mode].consumption - 1 >= POWER_MARGIN_RULE) return mode;
  }
  return 'reserve';
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)} %`;
const gb = (mb: number) => `${(mb / 1000).toFixed(1)} Gb`;

export const CHOICE_LABEL: Record<string, string> = {
  get store() { return t('review.choice_label.store'); },
  get reduce() { return t('review.choice_label.reduce'); },
  get command() { return t('review.choice_label.command'); },
  get full() { return t('review.choice_label.full'); },
  get cycle() { return t('review.choice_label.cycle'); },
  get reserve() { return t('review.choice_label.reserve'); },
  get campaign() { return t('review.choice_label.campaign'); },
  get nominal() { return t('review.choice_label.nominal'); },
  get protect() { return t('review.choice_label.protect'); },
};

/**
 * Reviews the three operational decisions by re-running the deterministic simulation with the
 * alternatives ("what would have happened if…"). No randomness is involved.
 */
export function reviewOpsDecisions(design: MissionDesign, decisions: OpsDecisions, base: Omit<SimOptions, 'decisions' | 'untilStep'> = {}): OpsDecisionReview[] {
  const run = (d: OpsDecisions) => simulateMission(design, { ...base, decisions: d });
  const actual = run(decisions);
  const reviews: OpsDecisionReview[] = [];

  for (const event of actual.events) {
    if (event.id === 'conjunction') {
      const choice: ConjunctionChoice = decisions.conjunction ?? 'store';
      const probe = run({ ...decisions, conjunction: 'store' });
      const overflow = probe.lostInWindowMb.conjunction > 0;
      const best: ConjunctionChoice = overflow ? 'reduce' : 'store';
      const blackoutDays = (event.windowEnd - event.windowStart) * actual.stepDays;
      const evidence = t('review.mars_passed_behind_the_sun_about', { blackoutDays, capacityMb: gb(actual.capacityMb), nominalDailyMb: gb(blackoutDays * actual.nominalDailyMb) });
      let points = 0;
      let why = '';
      if (choice === 'command') {
        why = t('review.radio_signals_passing_close_to_the');
      } else if (choice === best) {
        points = OPS_POINTS_EACH;
        why = overflow
          ? t('review.the_recorder_could_not_hold_a')
          : t('review.the_recorder_had_room_for_the');
      } else if (choice === 'store') {
        points = 1;
        why = t('review.the_recorder_filled_during_the_blackout', { conjunction: gb(actual.lostInWindowMb.conjunction) });
      } else {
        points = 2;
        why = t('review.a_safe_choice_but_more_cautious');
      }
      reviews.push({ event: 'conjunction', choice, best, points, maxPoints: OPS_POINTS_EACH, evidence, why, good: choice === best });
    }

    if (event.id === 'power') {
      const choice: PowerChoice = decisions.power ?? 'full';
      const worst = actual.worstFullMarginPct;
      const best = requiredPowerMode(worst);
      const gap = POWER_ORDER.indexOf(choice) - POWER_ORDER.indexOf(best);
      const evidence = t('review.farthest_from_the_sun_the_full', { worst: pct(worst) });
      let points: number;
      let why: string;
      if (gap === 0) {
        points = OPS_POINTS_EACH;
        why =
          best === 'full'
            ? t('review.your_arrays_had_margin_to_spare')
            : t('review.the_margin_was_too_thin_for');
      } else if (gap > 0) {
        points = gap === 1 ? 2 : 1;
        why = t('review.the_spacecraft_stayed_safe_but_you');
      } else {
        points = 0;
        why = t('review.the_margin_rule_was_broken_and', { safeModeDays: actual.safeModeDays });
      }
      reviews.push({ event: 'power', choice, best, points, maxPoints: OPS_POINTS_EACH, evidence, why, good: gap === 0 });
    }

    if (event.id === 'storm') {
      const choice: StormChoice = decisions.storm ?? 'nominal';
      const campaign = run({ ...decisions, storm: 'campaign' });
      const nominal = run({ ...decisions, storm: 'nominal' });
      const best: StormChoice = campaign.lostInWindowMb.storm === 0 ? 'campaign' : nominal.lostInWindowMb.storm === 0 ? 'nominal' : 'protect';
      const gap = STORM_ORDER.indexOf(choice) - STORM_ORDER.indexOf(best);
      const step = actual.steps[event.promptStep] ?? actual.steps[actual.steps.length - 1];
      const evidence = t('review.when_the_storm_began_the_recorder', { storedMb: gb(step.storedMb), capacityMb: gb(actual.capacityMb), stepDays: Math.round(step.downlinkCapacityMb / actual.stepDays), nominalDailyMb: Math.round(actual.nominalDailyMb) });
      let points: number;
      let why: string;
      if (gap === 0) {
        points = OPS_POINTS_EACH;
        why =
          best === 'campaign'
            ? t('review.link_and_recorder_had_headroom_so')
            : best === 'nominal'
              ? t('review.there_was_no_room_for_extra')
              : t('review.the_recorder_was_already_under_pressure');
      } else if (gap > 0) {
        points = 1;
        why = t('review.more_data_was_collected_than_the', { storm: gb(actual.lostInWindowMb.storm) });
      } else {
        points = 2;
        why = t('review.nothing_was_lost_but_there_was');
      }
      reviews.push({ event: 'storm', choice, best, points, maxPoints: OPS_POINTS_EACH, evidence, why, good: gap === 0 });
    }
  }
  return reviews;
}
