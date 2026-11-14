import type { MissionDesign } from '@/types';
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
  store: 'Keep observing and store everything',
  reduce: 'Observe less during the blackout',
  command: 'Keep commanding through the blackout',
  full: 'Continue full operations',
  cycle: 'Duty-cycle instruments and radio',
  reserve: 'Deep power saving',
  campaign: 'Run a high-rate storm campaign',
  nominal: 'Continue the normal plan',
  protect: 'Cut data to protect the recorder',
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
      const evidence = `Mars passed behind the Sun: about ${blackoutDays} days with no link. Recorder capacity ${gb(actual.capacityMb)}; a full-rate blackout would produce ${gb(blackoutDays * actual.nominalDailyMb)} on top of what was already stored.`;
      let points = 0;
      let why = '';
      if (choice === 'command') {
        why = 'Radio signals passing close to the Sun are corrupted by its hot outer atmosphere. A garbled command put the spacecraft into safe mode for ten days. Real missions pause commanding during conjunction for this reason.';
      } else if (choice === best) {
        points = OPS_POINTS_EACH;
        why = overflow
          ? 'The recorder could not hold a full-rate blackout, so trimming observations to the most valuable ones avoided overwriting data.'
          : 'The recorder had room for the whole blackout, so nothing was lost and no science was given up.';
      } else if (choice === 'store') {
        points = 1;
        why = `The recorder filled during the blackout and ${gb(actual.lostInWindowMb.conjunction)} of data was overwritten before it could be sent.`;
      } else {
        points = 2;
        why = 'A safe choice, but more cautious than needed: the recorder had room for everything, so some science was given up for no reason.';
      }
      reviews.push({ event: 'conjunction', choice, best, points, maxPoints: OPS_POINTS_EACH, evidence, why, good: choice === best });
    }

    if (event.id === 'power') {
      const choice: PowerChoice = decisions.power ?? 'full';
      const worst = actual.worstFullMarginPct;
      const best = requiredPowerMode(worst);
      const gap = POWER_ORDER.indexOf(choice) - POWER_ORDER.indexOf(best);
      const evidence = `Farthest from the Sun, the full-operations power margin fell to ${pct(worst)}. Flight rule: keep at least +5 %, because heaters and the transmitter draw more than the average.`;
      let points: number;
      let why: string;
      if (gap === 0) {
        points = OPS_POINTS_EACH;
        why =
          best === 'full'
            ? 'Your arrays had margin to spare, so there was no reason to give up observations.'
            : 'The margin was too thin for full operations. Saving just enough power kept the spacecraft healthy with the smallest loss of science.';
      } else if (gap > 0) {
        points = gap === 1 ? 2 : 1;
        why = 'The spacecraft stayed safe, but you saved more power than the margin required and gave up observations you could have made.';
      } else {
        points = 0;
        why = `The margin rule was broken and the battery ran down. The spacecraft protected itself in safe mode and lost ${actual.safeModeDays} days of science before the Flight Director ordered deeper power saving.`;
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
      const evidence = `When the storm began, the recorder held ${gb(step.storedMb)} of ${gb(actual.capacityMb)} and the link could carry ${Math.round(step.downlinkCapacityMb / actual.stepDays)} Mb per day against ${Math.round(actual.nominalDailyMb)} Mb produced.`;
      let points: number;
      let why: string;
      if (gap === 0) {
        points = OPS_POINTS_EACH;
        why =
          best === 'campaign'
            ? 'Link and recorder had headroom, so the extra storm observations all reached Earth — a rare science opportunity fully used.'
            : best === 'nominal'
              ? 'There was no room for extra data, but the normal plan fitted. You observed the storm without losing anything.'
              : 'The recorder was already under pressure. Cutting the data rate protected what was stored.';
      } else if (gap > 0) {
        points = 1;
        why = `More data was collected than the link and recorder could handle: ${gb(actual.lostInWindowMb.storm)} was overwritten before it reached Earth.`;
      } else {
        points = 2;
        why = 'Nothing was lost, but there was headroom you did not use. A once-a-year storm was observed with less detail than your spacecraft could have delivered.';
      }
      reviews.push({ event: 'storm', choice, best, points, maxPoints: OPS_POINTS_EACH, evidence, why, good: gap === 0 });
    }
  }
  return reviews;
}
