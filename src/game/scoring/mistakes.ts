import type { BudgetSummary } from '@/game/engine/budget';
import type { MassSummary } from '@/game/engine/mass';
import type { ScienceBreakdown } from '@/game/engine/science';
import { CHOICE_LABEL, type OpsDecisionReview } from '@/game/ops/evaluate';
import type { SimResult } from '@/game/ops/simulate';
import { SCENARIO_TRUTH, type ReadinessOutcome } from '@/game/scenarios/decision';
import type { MissionRecord } from './score';

export type MistakeType = 'False Positive' | 'False Negative' | 'Poor Data Validation' | 'Resource Mismanagement' | 'Poor Risk Assessment';

export const MISTAKE_DEFINITIONS: Record<MistakeType, string> = {
  'False Positive': 'Treating a harmless signal as a real problem — a false alarm that costs time and money.',
  'False Negative': 'Missing a real problem because the warning was dismissed.',
  'Poor Data Validation': 'Trusting a measurement without checking where it came from or whether other data agrees.',
  'Resource Mismanagement': 'Running out of — or wasting — mass, power, data capacity or budget.',
  'Poor Risk Assessment': 'Accepting a risk without knowing how likely or how serious it is.',
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

const PRIMARY_LABEL = { hold: 'Hold and investigate the hardware', cross: 'Cross-validate the evidence', proceed: 'Proceed with the countdown' } as const;
const CALL_LABEL = { scrub: 'recommend a scrub for hardware inspection', resync: 'switch to the backup telemetry path and resume', resume: 'resume the count and keep watching' } as const;

/** Turns the mission record into plain-language lessons. Deterministic. */
export function findMistakes(ctx: Context): Mistake[] {
  const { record, sim, mass, budget, readiness, opsReviews } = ctx;
  const out: Mistake[] = [];
  const r = record.readiness;
  const truth = SCENARIO_TRUTH[r.scenario];
  const viewed = readiness.evidenceQuality;
  const decisionText = r.choice === 'cross' ? `${PRIMARY_LABEL.cross}, then ${CALL_LABEL[r.finalCall ?? 'resume']}.` : `${PRIMARY_LABEL[r.choice]}.`;
  const evidenceSeen = r.choice === 'cross' ? 'All three evidence panels were reviewed.' : viewed === 0 ? 'No evidence panel was opened before deciding.' : `${viewed} of 3 evidence panels were opened before deciding.`;

  if (readiness.verdict === 'false-positive') {
    out.push({
      type: 'False Positive',
      title: 'The countdown was stopped for a problem that was not there',
      decision: decisionText,
      evidence: `${evidenceSeen} The clue that was available: ${truth.clue}`,
      misunderstanding: r.scenario === 'data-chain' ? 'A fault in how the data was delivered and processed was read as a fault in the hardware.' : 'One abnormal sample was treated as proof of a physical failure.',
      consequence: `Launch slipped ${readiness.slipDays} days and cost ${readiness.costCr} credits for an inspection that found nothing.`,
      lesson: 'An alarm tells you where to look, not what is true. Check whether independent measurements agree before acting on one of them.',
    });
  }
  if (readiness.verdict === 'false-negative') {
    out.push({
      type: 'False Negative',
      title: 'A real leak was treated as if it were harmless',
      decision: decisionText,
      evidence: `${evidenceSeen} The clue that was available: ${truth.clue}`,
      misunderstanding: 'A persistent trend confirmed by two independent sensors is not noise. Each sensor could be wrong alone; both wrong in the same way at the same time is very unlikely.',
      consequence: `The Flight Director’s safety rule stopped the count at T−10 s. Launch slipped ${readiness.slipDays} days and cost ${readiness.costCr} credits.`,
      lesson: 'When independent sensors tell the same story, believe the story. Safety rules are the last line of defence — good decisions should not need them.',
    });
  }
  if (readiness.verdict === 'misdiagnosed') {
    out.push({
      type: 'Poor Data Validation',
      title: 'The evidence was checked, but the cause was misread',
      decision: decisionText,
      evidence: `All three panels were reviewed. The clue that was available: ${truth.clue}`,
      misunderstanding: r.scenario === 'data-chain' ? 'Packet gaps, duplicates and a raw-versus-processed mismatch point to the data chain, not to random sensor noise.' : 'The packet log was clean and raw counts matched the processed values, so the data chain was not the cause.',
      consequence: readiness.degradedLinkDays ? `The unfixed data path garbled part of the downlink for the first ${readiness.degradedLinkDays} days at Mars.` : 'No harm this time — but the real cause went unrecorded, so the same glitch could confuse the next team.',
      lesson: 'Ask two questions of every strange reading: “Is the sensor right?” and “Did the number reach me unchanged?” They have different answers and different fixes.',
    });
  }
  if ((readiness.verdict === 'lucky' || readiness.verdict === 'right-thin-evidence') && viewed < 2) {
    out.push({
      type: 'Poor Data Validation',
      title: 'The decision was made before the evidence was read',
      decision: decisionText,
      evidence: `${evidenceSeen} Sensor comparison, raw telemetry and trend analysis were all one click away.`,
      misunderstanding: 'The outcome was acceptable, so the decision feels right — but with the information you had, the opposite result was just as possible.',
      consequence: readiness.verdict === 'lucky' ? 'The mission continued by good fortune rather than good judgement.' : 'The hold was correct, but it could not have been justified to the Flight Director.',
      lesson: 'Judge a decision by what you knew when you made it, not by how it turned out.',
    });
  }
  if (r.choice === 'proceed' && readiness.verdict !== 'correct') {
    out.push({
      type: 'Poor Risk Assessment',
      title: 'The countdown continued with an unexplained alarm',
      decision: decisionText,
      evidence: `${evidenceSeen} Two engineers disagreed about the cause, and neither view had been tested.`,
      misunderstanding: 'An unexplained alarm is an unknown risk. “Probably fine” is a guess until the evidence says so.',
      consequence: readiness.verdict === 'false-negative' ? 'A real leak reached the final seconds of the count before a safety rule caught it.' : 'Nothing failed at launch, but the risk was accepted without being understood.',
      lesson: 'Before accepting a risk, be able to say what the alarm is — not only what you hope it is.',
    });
  }

  for (const review of opsReviews) {
    if (review.good) continue;
    const decision = `${CHOICE_LABEL[review.choice]}.`;
    if (review.event === 'conjunction' && review.choice === 'command') {
      out.push({
        type: 'Poor Risk Assessment',
        title: 'Commands were sent through the Sun’s interference',
        decision,
        evidence: review.evidence,
        misunderstanding: 'A weak signal is not the only danger near the Sun: a corrupted command can be worse than no command at all.',
        consequence: 'The spacecraft entered safe mode and lost ten days of science after the blackout.',
        lesson: 'Sometimes the safest action is to wait. Plan ahead so the spacecraft can look after itself while you cannot talk to it.',
      });
    } else if (review.points <= 1) {
      out.push({
        type: review.event === 'power' ? 'Poor Risk Assessment' : 'Resource Mismanagement',
        title: review.event === 'power' ? 'Full operations with too little power margin' : review.event === 'storm' ? 'More data was collected than could be returned' : 'The recorder overflowed during the blackout',
        decision,
        evidence: review.evidence,
        misunderstanding: review.event === 'power' ? 'An average margin near zero is not “enough”: heaters and transmitters peak above the average.' : 'Collected data only counts as science once it reaches Earth. Recorder space and link speed set the real limit.',
        consequence: review.why,
        lesson: review.event === 'power' ? 'Margins exist for the bad days. Spend them deliberately, not by accident.' : 'Match what you collect to what you can store and send. The better option here was: ' + CHOICE_LABEL[review.best].toLowerCase() + '.',
      });
    } else {
      out.push({
        type: 'Resource Mismanagement',
        title: review.event === 'power' ? 'More power was saved than necessary' : review.event === 'storm' ? 'Spare capacity went unused during the storm' : 'Observations were cut although the recorder had room',
        decision,
        evidence: review.evidence,
        misunderstanding: 'Caution has a cost too. The numbers on the console showed room to do more.',
        consequence: review.why,
        lesson: 'Being careful means reading the margins, not avoiding every risk. The better option here was: ' + CHOICE_LABEL[review.best].toLowerCase() + '.',
      });
    }
  }

  const designLost = sim.lostMb - sim.lostInWindowMb.conjunction - sim.lostInWindowMb.storm;
  if (designLost > sim.plannedMb * 0.03) {
    out.push({
      type: 'Resource Mismanagement',
      title: 'The link could not keep up with the payload',
      decision: 'Spacecraft design: payload, antenna and recorder as launched.',
      evidence: `The payload produced ${Math.round(sim.nominalDailyMb)} Mb per day. The designer warned when the average downlink or the recorder was too small for it.`,
      misunderstanding: 'An instrument’s value depends on the whole chain behind it — recorder, antenna, contact time and distance to Earth.',
      consequence: `${(sim.lostMb / 1000).toFixed(1)} Gb of observations were overwritten on board before they could be sent.`,
      lesson: 'Design the data path first: a smaller instrument whose data all reaches Earth beats a larger one whose data is lost.',
    });
  }
  if (!budget.ok) {
    out.push({
      type: 'Resource Mismanagement',
      title: 'Launch-campaign costs pushed the mission over budget',
      decision: 'A design that used almost the entire budget, followed by a costly countdown event.',
      evidence: `Planned cost left ${budget.remainingCr + budget.eventsCr} credits of reserve; the countdown event cost ${budget.eventsCr}.`,
      misunderstanding: 'A budget with no reserve assumes that nothing will ever go wrong.',
      consequence: `The mission ended ${-budget.remainingCr} credits over budget.`,
      lesson: 'Keep a reserve. Real projects hold back part of the budget for the surprises they cannot predict.',
    });
  }
  if (mass.marginPct > 0.3) {
    out.push({
      type: 'Resource Mismanagement',
      title: 'A larger rocket than the spacecraft needed',
      decision: 'Launch vehicle selection.',
      evidence: `The fuelled spacecraft weighed ${Math.round(mass.wetKg)} kg; the vehicle could lift ${mass.capacityKg} kg.`,
      misunderstanding: 'Unused launch capacity is budget that could have bought science.',
      consequence: `${Math.round(mass.marginPct * 100)} % of the launch capacity flew empty.`,
      lesson: 'Size the launch vehicle to the spacecraft, with a small margin — not the other way round.',
    });
  }
  return out;
}
