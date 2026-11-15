import { Check } from 'lucide-react';
import { t } from '@/i18n';
import { T } from '@/i18n/Trans';
import { useState } from 'react';
import { sfx } from '@/audio/sound';
import { ROLES, useGame } from '@/game/state/store';
import type { RoleId } from '@/types';

export interface Choice {
  id: string;
  title: string;
  text: string;
  /** Small line above the title, e.g. who recommends it. */
  kicker?: React.ReactNode;
  recommended?: boolean;
}

interface Props {
  choices: Choice[];
  confirmLabel: string;
  onConfirm: (id: string) => void;
  initial?: string;
  testId?: string;
}

/**
 * One decision, one confirm button. With several players each role first proposes an answer
 * (pass-and-play), then the Mission Director confirms the shared choice.
 */
export function TeamDecision({ choices, confirmLabel, onConfirm, initial, testId = 'decision' }: Props) {
  const players = useGame((s) => s.players);
  const guided = useGame((s) => s.settings.mode === 'guided');
  const record = useGame((s) => s.recordTeamDecision);
  const team = players.length > 1;
  const [proposals, setProposals] = useState<Partial<Record<RoleId, string>>>({});
  const [turn, setTurn] = useState(0);
  const [final, setFinal] = useState<string | undefined>(initial);

  const allProposed = players.every((p) => proposals[p.role]);
  const proposing = team && !allProposed;
  const current = players[Math.min(turn, players.length - 1)];

  const pick = (id: string) => {
    sfx.select();
    if (proposing) {
      const next = { ...proposals, [current.role]: id };
      setProposals(next);
      const remaining = players.findIndex((p) => !next[p.role]);
      if (remaining >= 0) setTurn(remaining);
      else {
        // Pre-select the majority view for the Director to confirm or overrule.
        const counts = new Map<string, number>();
        Object.values(next).forEach((v) => v && counts.set(v, (counts.get(v) ?? 0) + 1));
        setFinal([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
      }
    } else {
      setFinal(id);
    }
  };

  const confirm = () => {
    if (!final) return;
    if (team) {
      const values = players.map((p) => proposals[p.role]);
      record(values.every(Boolean), values.every((v) => v && v === values[0]));
    }
    onConfirm(final);
  };

  const votes = (id: string) => players.filter((p) => proposals[p.role] === id);
  const split = team && allProposed && new Set(players.map((p) => proposals[p.role])).size > 1;

  return (
    <div className="decision stack" data-testid={testId}>
      {team && (
        <div className="decision__team">
          <span className="eyebrow eyebrow--muted">{proposing ? t('team.each_role_proposes_pass_the_device') : split ? t('team.the_team_is_split_mission_director') : t('team.the_team_agrees_mission_director_confirms')}</span>
          <div className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
            {players.map((p, i) => (
              <button
                key={p.role}
                type="button"
                className={`seat ${proposals[p.role] ? 'seat--done' : ''} ${proposing && i === turn ? 'seat--turn' : ''}`}
                onClick={() => {
                  setTurn(i);
                  setProposals({ ...proposals, [p.role]: undefined });
                }}
                title={t('team.tap_to_propose_again', { role: ROLES[p.role].label })}
              >
                {proposals[p.role] ? <Check size={12} /> : <span className="seat__dot" />}
                <b>{p.name}</b>
                <span>{ROLES[p.role].short}</span>
              </button>
            ))}
          </div>
          {proposing && (
            <div className="small" style={{ marginTop: 8 }}>
              <T k="team.your_turn" params={{ name: current.name, role: ROLES[current.role].label }} tags={{ b: (c) => <b className="cyan">{c}</b> }} />
            </div>
          )}
        </div>
      )}
      <div className="stack stack--sm" role="radiogroup">
        {choices.map((c) => {
          const v = votes(c.id);
          const selected = proposing ? proposals[current.role] === c.id : final === c.id;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={selected} className="option" onClick={() => pick(c.id)} data-testid={`${testId}-${c.id}`}>
              {c.kicker && <div className="eyebrow eyebrow--muted" style={{ marginBottom: 4 }}>{c.kicker}</div>}
              <div className="option__top">
                <span className="option__name">{c.title}</span>
                <span className="row" style={{ gap: 4 }}>
                  {guided && c.recommended && <span className="tag tag--cyan">{t('team.suggested')}</span>}
                  {v.map((p) => (
                    <span key={p.role} className="tag" title={t('team.proposes_this', { p: p.name })}>
                      {ROLES[p.role].short}
                    </span>
                  ))}
                </span>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {c.text}
              </div>
            </button>
          );
        })}
      </div>
      <div className="row row--wrap">
        <button type="button" className="btn" disabled={!final || proposing} onClick={confirm} data-testid={`${testId}-confirm`}>
          {confirmLabel}
        </button>
        {proposing && (
          <button
            type="button"
            className="link-btn small"
            onClick={() => {
              const filled = Object.fromEntries(players.map((p) => [p.role, proposals[p.role] ?? '—']));
              setProposals(filled);
              setTurn(0);
            }}
          >
            {t('team.skip_the_discussion')}
          </button>
        )}
      </div>
    </div>
  );
}
