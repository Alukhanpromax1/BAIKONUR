import type { ScenarioId } from './telemetry';

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
    title: 'Genuine hardware anomaly',
    explain:
      'A slow pressurant leak in the tank. Two independent pressure sensors fell together, and the temperature dropped with them — the physical signature of escaping gas.',
    clue: 'Independent sensors agreed, and the change persisted and grew.',
  },
  'data-chain': {
    title: 'Telemetry data-chain fault',
    explain:
      'The tank was healthy. After a packet-sequence reset, the ground processor applied the wrong calibration to some packets, and the link dropped, repeated and reordered others.',
    clue: 'Raw sensor counts stayed normal while processed values jumped, and the packet log showed gaps, duplicates and out-of-order timestamps.',
  },
  noise: {
    title: 'Benign sensor noise',
    explain:
      'A single-sample glitch on one pressure sensor. The second sensor never moved, the moving average stayed flat, and the slow temperature drift was the morning sun warming the pad.',
    clue: 'One isolated point, no confirmation from the independent sensor, no trend.',
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
    headline: 'Countdown stopped by the Flight Director',
    narrative: `${how} At T−10 s the Flight Director’s independent redline monitor saw tank pressure below the launch limit and stopped the count. Nobody was at risk — that safety rule exists for exactly this. But the vehicle had to be made safe and the tank repaired: nine days and 22 credits lost.`,
  });

  if (choice === 'hold') {
    if (scenario === 'hardware') {
      return {
        ...base,
        points: informed ? 18 : viewed === 1 ? 15 : 12,
        verdict: informed ? 'correct' : 'right-thin-evidence',
        ...SCRUB_JUSTIFIED,
        headline: 'Justified hold',
        narrative: informed
          ? 'You stopped the countdown, and the evidence backed you: two independent sensors falling together. Technicians found and fixed a leaking pressurant fitting. Launch moved three days to the backup slot.'
          : 'You stopped the countdown and the inspection found a real leak — the right call. But you made it with little evidence; with the same information the alarm could just as easily have been false.',
      };
    }
    return {
      ...base,
      points: informed ? 6 : 4,
      verdict: 'false-positive',
      ...SCRUB_UNNEEDED,
      headline: 'Unnecessary hold',
      narrative:
        scenario === 'data-chain'
          ? 'The hardware inspection found a perfectly healthy tank. Two days later the data team traced the alarm to the ground processing chain. The evidence to tell the difference was on your console.'
          : 'The hardware inspection found nothing wrong. The alarm was a single noisy sample that the second sensor never confirmed. Two days and 6 credits were spent on a problem that did not exist.',
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
          headline: 'Evidence-based hold',
          narrative:
            'Cross-checking showed both pressure sensors falling together with the temperature. You recommended a scrub; technicians found a leaking pressurant fitting and repaired it. Launch moved three days to the backup slot.',
        };
      }
      return abort('You cross-checked the data but recommended continuing, although both independent sensors showed the same falling trend.');
    }
    if (scenario === 'data-chain') {
      if (call === 'resync') {
        return {
          ...base,
          points: 18,
          verdict: 'correct',
          slipDays: 0,
          costCr: 0,
          headline: 'Fault found in the data chain',
          narrative:
            'Raw counts were steady while processed values jumped, and the packet log was full of gaps and repeats. You recommended switching to the backup telemetry path. The readings cleared at once and the count resumed inside the built-in hold. No delay.',
        };
      }
      if (call === 'scrub') {
        return {
          ...base,
          points: 8,
          verdict: 'false-positive',
          ...SCRUB_UNNEEDED,
          headline: 'Careful, but the wrong conclusion',
          narrative:
            'You checked the evidence, then recommended a hardware scrub. The inspection found a healthy tank — the raw counts had been normal all along. Two days and 6 credits lost.',
        };
      }
      return {
        ...base,
        points: 9,
        verdict: 'misdiagnosed',
        slipDays: 0,
        costCr: 0,
        degradedLinkDays: 30,
        headline: 'Launched with an unfixed data fault',
        narrative:
          'You judged the alarm to be harmless noise and resumed. The launch went well — but the faulty ground-processing path was never fixed, and it garbled part of the downlink for the first month at Mars.',
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
        headline: 'Noise correctly identified',
        narrative:
          'One isolated sample, no confirmation from the second sensor, a flat moving average. You recommended resuming with the channel on watch. The count continued inside the built-in hold and the readings stayed normal.',
      };
    }
    if (call === 'resync') {
      return {
        ...base,
        points: 14,
        verdict: 'misdiagnosed',
        slipDays: 0,
        costCr: 0,
        headline: 'Safe call, wrong diagnosis',
        narrative:
          'You switched to the backup telemetry path. It did no harm and the count resumed — but the packet log had been clean. The glitch came from the sensor itself, not the data chain.',
      };
    }
    return {
      ...base,
      points: 8,
      verdict: 'false-positive',
      ...SCRUB_UNNEEDED,
      headline: 'Careful, but the wrong conclusion',
      narrative:
        'You checked the evidence, then recommended a hardware scrub for a single noisy sample. The inspection found nothing. Two days and 6 credits lost.',
    };
  }

  // proceed
  if (scenario === 'hardware') return abort('You continued the countdown without resolving the alarm.');
  if (scenario === 'data-chain') {
    return {
      ...base,
      points: informed ? 5 : 3,
      verdict: 'lucky',
      slipDays: 0,
      costCr: 0,
      degradedLinkDays: 30,
      headline: 'Launched — by luck, not by evidence',
      narrative:
        'The tank was healthy, so the launch succeeded. But nothing you knew at the time ruled out a real leak, and the faulty data path was never fixed: it garbled part of the downlink for the first month at Mars.',
    };
  }
  return {
    ...base,
    points: informed ? 14 : 6,
    verdict: informed ? 'correct' : 'lucky',
    slipDays: 0,
    costCr: 0,
    headline: informed ? 'Proceeded on good evidence' : 'Launched — by luck, not by evidence',
    narrative: informed
      ? 'You had looked: one isolated sample, a steady second sensor, no trend. Continuing was a defensible call, and the launch was clean. Recording that reasoning with a formal cross-check would have made it stronger still.'
      : 'It was only sensor noise, so the launch was clean. But you did not know that when you decided — the same alarm could have been a real leak.',
  };
}
