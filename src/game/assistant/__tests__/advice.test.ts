import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '@/game/engine/resources';
import { assistantReply } from '../advice';
import { baseDesign, withSelection } from '@/game/__tests__/fixtures';

const base = { panelsViewed: 0, readinessChosen: false, opsDecided: 0, opsTotal: 3 };

describe('MISSION AI rules', () => {
  it('names the stage the player is in', () => {
    const e = evaluateDesign(baseDesign);
    expect(assistantReply({ ...base, scene: 'designer', evaluation: e }).stage).toBe('designer');
    expect(assistantReply({ ...base, scene: 'launch', evaluation: e }).intro).toBe('ai.stage.launch.intro');
  });

  it('suggests a fix when a limit is exceeded, and never suggests a decision', () => {
    const e = evaluateDesign({ ...baseDesign, vehicle: 'tulpar-l' });
    const reply = assistantReply({ ...base, scene: 'launch', evaluation: e });
    expect(reply.next).toBe('ai.next.launch.fix');
    expect(reply.lines[0]).toMatchObject({ tone: 'block', key: 'ai.launch.blocked' });
    expect(reply.issues.length).toBeGreaterThan(0);
  });

  it('moves the player on once the launch plan is feasible', () => {
    const e = evaluateDesign(baseDesign);
    expect(e.launchReady).toBe(true);
    expect(assistantReply({ ...base, scene: 'launch', evaluation: e }).next).toBe('ai.next.launch.readiness');
  });

  it('points at the tightest resource in the design bay', () => {
    const e = evaluateDesign(withSelection(baseDesign, 'power', 'array-standard'));
    const reply = assistantReply({ ...base, scene: 'designer', evaluation: e });
    expect(reply.lines.map((l) => l.key).some((k) => k.startsWith('ai.meter.power'))).toBe(e.status.power !== 'ok');
  });

  it('asks for evidence before a decision in readiness, and reports progress', () => {
    const e = evaluateDesign(baseDesign);
    expect(assistantReply({ ...base, scene: 'readiness', evaluation: e, panelsViewed: 0 }).next).toBe('ai.next.readiness.evidence');
    expect(assistantReply({ ...base, scene: 'readiness', evaluation: e, panelsViewed: 3 }).next).toBe('ai.next.readiness.decide');
    expect(assistantReply({ ...base, scene: 'readiness', evaluation: e, panelsViewed: 3, readinessChosen: true }).next).toBe('ai.next.readiness.done');
  });

  it('counts remaining operational decisions without making them', () => {
    const e = evaluateDesign(baseDesign);
    const reply = assistantReply({ ...base, scene: 'operations', evaluation: e, opsDecided: 1, opsTotal: 3 });
    expect(reply.next).toBe('ai.next.ops.decide');
    expect(reply.nextParams).toEqual({ n: 2 });
    expect(reply.progress).toBeCloseTo(1 / 3);
  });

  it('is deterministic for the same state', () => {
    const e = evaluateDesign(baseDesign);
    expect(assistantReply({ ...base, scene: 'designer', evaluation: e })).toEqual(assistantReply({ ...base, scene: 'designer', evaluation: e }));
  });
});
