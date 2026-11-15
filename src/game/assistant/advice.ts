import type { MessageKey, Params } from '@/i18n';
import type { DesignEvaluation, Issue } from '@/game/engine/resources';
import type { SceneId } from '@/types';

/**
 * MISSION AI — a rule-based guide. It reads the current stage and the game state that the
 * simulation already computes, and explains what it sees. It never selects a decision, never
 * changes the design and never completes a stage: those choices stay with the player.
 *
 * Pure function: no randomness, no network, no external AI service.
 */
export type Tone = 'info' | 'warn' | 'block';

export interface AdviceLine {
  tone: Tone;
  key: MessageKey;
  params?: Params;
}

export interface AssistantInput {
  scene: SceneId;
  evaluation: DesignEvaluation;
  panelsViewed: number;
  readinessChosen: boolean;
  opsDecided: number;
  opsTotal: number;
}

export interface AssistantReply {
  /** What stage the player is in, and what it is for. */
  stage: SceneId;
  intro: MessageKey;
  /** What the game state says right now — problems first, then notes. */
  lines: AdviceLine[];
  /** Blocking problems, with the fix the simulation suggests. */
  issues: Issue[];
  /** The next objective, phrased as a suggestion. */
  next: MessageKey;
  nextParams?: Params;
  /** Share of the stage that is complete, 0–1, when the stage has measurable steps. */
  progress: number | null;
}

const blockers = (issues: Issue[]) => issues.filter((i) => i.severity === 'block');

export function assistantReply(input: AssistantInput): AssistantReply {
  const { scene, evaluation: e } = input;
  const lines: AdviceLine[] = [];
  const issues = e.issues;
  const block = blockers(issues);

  switch (scene) {
    case 'designer': {
      const tightest = (['power', 'mass', 'budget', 'data', 'comms'] as const).find((r) => e.status[r] === 'over' || e.status[r] === 'tight');
      if (tightest) lines.push({ tone: e.status[tightest] === 'over' ? 'block' : 'warn', key: `ai.meter.${tightest}.${e.status[tightest]}` as MessageKey });
      else lines.push({ tone: 'info', key: 'ai.design.all_green' });
      const nextKey: MessageKey = block.length ? 'ai.next.design.fix' : 'ai.next.design.plan';
      return { stage: scene, intro: 'ai.stage.designer.intro', lines, issues, next: nextKey, progress: block.length ? 0.5 : 1 };
    }
    case 'launch': {
      if (block.length) lines.push({ tone: 'block', key: 'ai.launch.blocked' });
      else lines.push({ tone: 'info', key: 'ai.launch.ready' });
      if (e.mass.marginPct > 0.3) lines.push({ tone: 'warn', key: 'ai.launch.unused_lift' });
      return {
        stage: scene,
        intro: 'ai.stage.launch.intro',
        lines,
        issues,
        next: e.launchReady ? 'ai.next.launch.readiness' : 'ai.next.launch.fix',
        progress: e.launchReady ? 1 : 0.6,
      };
    }
    case 'readiness': {
      lines.push({ tone: 'info', key: 'ai.readiness.alarm' });
      if (input.panelsViewed === 0) lines.push({ tone: 'warn', key: 'ai.readiness.no_evidence' });
      else if (input.panelsViewed < 3) lines.push({ tone: 'info', key: 'ai.readiness.some_evidence', params: { n: input.panelsViewed } });
      else lines.push({ tone: 'info', key: 'ai.readiness.all_evidence' });
      const nextKey: MessageKey = input.readinessChosen ? 'ai.next.readiness.done' : input.panelsViewed < 3 ? 'ai.next.readiness.evidence' : 'ai.next.readiness.decide';
      return {
        stage: scene,
        intro: 'ai.stage.readiness.intro',
        lines,
        issues: [],
        next: nextKey,
        progress: Math.min(1, input.panelsViewed / 3) * (input.readinessChosen ? 1 : 0.8),
      };
    }
    case 'operations': {
      lines.push({ tone: 'info', key: 'ai.ops.telemetry' });
      const remaining = input.opsTotal - input.opsDecided;
      const nextKey: MessageKey = remaining > 0 ? 'ai.next.ops.decide' : 'ai.next.ops.debrief';
      return {
        stage: scene,
        intro: 'ai.stage.operations.intro',
        lines,
        issues: [],
        next: nextKey,
        nextParams: { n: remaining },
        progress: input.opsTotal ? input.opsDecided / input.opsTotal : null,
      };
    }
    case 'debrief': {
      lines.push({ tone: 'info', key: 'ai.debrief.review' });
      return { stage: scene, intro: 'ai.stage.debrief.intro', lines, issues: [], next: 'ai.next.debrief.retry', progress: 1 };
    }
    default: {
      return { stage: scene, intro: 'ai.stage.briefing.intro', lines: [{ tone: 'info', key: 'ai.briefing.start' }], issues: [], next: 'ai.next.briefing.start', progress: null };
    }
  }
}
