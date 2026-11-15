import { CircleHelp, Lightbulb, Sparkles } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { assistantReply, type AdviceLine } from '@/game/assistant/advice';
import { evaluateDesign } from '@/game/engine/resources';
import { useGame } from '@/game/state/store';
import { t, useLangStore, type MessageKey } from '@/i18n';
import { STAGES } from '@/game/state/store';
import type { SceneId } from '@/types';

const TONE_CLASS: Record<AdviceLine['tone'], string> = { info: 'ai-line', warn: 'ai-line ai-line--warn', block: 'ai-line ai-line--block' };

/** Drawer with the rule-based guide. It reads the stage and the state the simulation already computes. */
export function MissionAIDrawer({ onClose }: { onClose: () => void }) {
  useLangStore((s) => s.lang);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const scene = useGame((s) => s.scene);
  const design = useGame((s) => s.design);
  const readiness = useGame((s) => s.readiness);
  const ops = useGame((s) => s.ops);
  const evaluation = useMemo(() => evaluateDesign(design), [design]);
  const opsDecided = Object.values(ops).filter((v) => v !== undefined).length;

  const reply = useMemo(
    () =>
      assistantReply({
        scene: (scene === 'intro' ? 'briefing' : scene) as SceneId,
        evaluation,
        panelsViewed: readiness.panelsViewed.length,
        readinessChosen: readiness.choice !== undefined,
        opsDecided,
        opsTotal: 3,
      }),
    [scene, evaluation, readiness, opsDecided],
  );
  const stageLabel = STAGES.find((s) => s.id === reply.stage)?.label ?? t('ai.stage_label' as MessageKey);

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <aside className="drawer ai" role="dialog" aria-modal="true" aria-label={t('ai.title')} onClick={(e) => e.stopPropagation()} data-testid="mission-ai">
        <div className="drawer__head">
          <div>
            <div className="eyebrow">
              <Sparkles size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {t('ai.title')}
            </div>
            <p className="small muted" style={{ marginTop: 6 }}>{t('ai.subtitle')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('panel.close')}>
            <CircleHelp size={18} />
          </button>
        </div>
        <div className="drawer__body scroll stack stack--lg">
          <section className="stack stack--sm">
            <div className="row row--between">
              <span className="eyebrow eyebrow--muted">{t('ai.stage_label')}</span>
              <span className="tag tag--cyan">{stageLabel}</span>
            </div>
            <p>{t(reply.intro)}</p>
            {reply.progress !== null && (
              <div>
                <div className="xs muted">{t('ai.progress_label')}</div>
                <div className="meter__bar" style={{ marginTop: 6 }}>
                  <span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, reply.progress)})` }} />
                </div>
              </div>
            )}
          </section>

          <section className="stack stack--sm">
            {reply.lines.map((l) => (
              <div key={l.key} className={TONE_CLASS[l.tone]}>
                {t(l.key, l.params)}
              </div>
            ))}
          </section>

          <section className="stack stack--sm">
            <div className="eyebrow eyebrow--muted">{t('ai.issues_title')}</div>
            {reply.issues.length === 0 && <p className="small muted">{t('ai.no_issues')}</p>}
            {reply.issues.map((i) => (
              <div key={i.title} className={`issue ${i.severity === 'block' ? 'issue--block' : ''}`}>
                <span aria-hidden="true">{i.severity === 'block' ? '✕' : '!'}</span>
                <div>
                  <b>{i.title}</b>
                  {i.explain}
                  <div className="fix">→ {i.fix}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="ai-next">
            <div className="stack stack--sm">
              <div className="eyebrow">
                <Lightbulb size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {t('ai.next_label')}
              </div>
              <p>{t(reply.next, reply.nextParams)}</p>
            </div>
          </section>

          <p className="xs dim">{t('ai.disclaimer')}</p>
        </div>
      </aside>
    </div>
  );
}

export type { SceneId };
