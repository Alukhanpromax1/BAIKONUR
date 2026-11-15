import { ExternalLink, X } from 'lucide-react';
import { t } from '@/i18n';
import { useEffect } from 'react';
import { CHALLENGE_REFERENCE, DATA_SOURCES, PROVENANCE_LABEL } from '@/data/nasa/sources';
import { formatLightTime, roundTripS } from '@/game/engine/comms';
import { defaultPlayers, ROLES, useGame } from '@/game/state/store';
import { useLightTime } from '@/hooks/useLightTime';
import type { GameMode, Quality } from '@/types';

function Drawer({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 className="title" style={{ marginTop: 6 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('panel.close')}>
            <X size={20} />
          </button>
        </div>
        <div className="drawer__body scroll">{children}</div>
      </aside>
    </div>
  );
}

function SourcesPanel({ onClose }: { onClose: () => void }) {
  const { reading } = useLightTime();
  return (
    <Drawer title={t('panel.data_sources')} eyebrow={t('panel.where_the_science_comes_from')} onClose={onClose}>
      <div className="stack stack--lg">
        <p className="muted">
          {t('panel.every_number_in_the_game_carries')}
        </p>

        <section className="panel panel--plain" data-testid="live-reading">
          <div className="panel__body stack stack--sm">
            <div className="row row--between row--wrap">
              <span className="eyebrow">{t('panel.earth_mars_signal_delay', { epochIso: reading.epochIso })}</span>
              <span className={`tag ${reading.status === 'live' ? 'tag--cyan' : 'tag--amber'}`}>
                <span className="tag__dot" />
                {reading.status === 'live' ? t('panel.live_from_jpl_horizons') : t('panel.cached_snapshot')}
              </span>
            </div>
            <div className="kv">
              <span>{t('panel.one_way_light_time_horizons_lt')}</span>
              <span>
                {reading.oneWayLightTimeS.toFixed(1)} s · {formatLightTime(reading.oneWayLightTimeS)}
              </span>
            </div>
            <div className="kv">
              <span>{t('panel.round_trip_2_one_way')}</span>
              <span>{formatLightTime(roundTripS(reading.oneWayLightTimeS))}</span>
            </div>
            <div className="kv">
              <span>{t('panel.range_horizons_rg')}</span>
              <span>
                {t('panel.range_value', { km: Math.round(reading.rangeKm).toLocaleString('en-US'), au: reading.rangeAu.toFixed(3) })}
              </span>
            </div>
            <div className="kv">
              <span>{t('panel.range_rate_horizons_rr')}</span>
              <span>{t('u.kms', { n: reading.rangeRateKmS.toFixed(2) })}</span>
            </div>
            <p className="xs muted">
              {t('panel.retrieved_utc', { time: new Date(reading.retrievedAt).toISOString().replace('T', ' ').slice(0, 16) })}{' '}
              {reading.status === 'cached' ? t('panel.the_live_service_was_not_reachable') : t('panel.read_just_now_through_the_games')}{' '}
              {t('panel.accelerated_note')}
            </p>
          </div>
        </section>

        {DATA_SOURCES.map((s) => {
          const p = PROVENANCE_LABEL[s.provenance];
          const tone = s.provenance.startsWith('verified') ? 'tag--cyan' : s.provenance === 'physical_constant' ? '' : 'tag--amber';
          return (
            <section key={s.id} className="stack stack--sm" data-testid={`source-${s.id}`}>
              <div className="row row--wrap" style={{ gap: 8 }}>
                <span className={`tag ${tone}`}>{p.label}</span>
                {s.retrieved && <span className="xs mono muted">{t('panel.retrieved', { retrieved: s.retrieved.slice(0, 10) })}</span>}
              </div>
              <h3 className="subtitle">{s.title}</h3>
              <div className="small muted">{s.organization}</div>
              {s.url && (
                <a className="small row" style={{ gap: 6 }} href={s.url} target="_blank" rel="noreferrer">
                  {s.url.replace('https://', '')} <ExternalLink size={13} />
                </a>
              )}
              {s.units && (
                <div className="xs mono muted">
                  <span className="dim">{t('panel.units')} </span>
                  {s.units}
                </div>
              )}
              <div className="small">
                <div className="eyebrow eyebrow--muted" style={{ margin: '6px 0 4px' }}>
                  {t('panel.values_used')}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {s.fields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="eyebrow eyebrow--muted" style={{ margin: '10px 0 4px' }}>
                  {t('panel.where_it_affects_the_game')}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {s.usedFor.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              {s.status && <p className="xs muted" style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>{s.status}</p>}
              <hr className="rule" />
            </section>
          );
        })}

        <section className="stack stack--sm">
          <h3 className="subtitle">{CHALLENGE_REFERENCE.title}</h3>
          <p className="small muted">{CHALLENGE_REFERENCE.note}</p>
          <p className="small muted">
            {t('panel.ai_disclosure_this_games_code_was')}
          </p>
        </section>
      </div>
    </Drawer>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings);
  const set = useGame((s) => s.setSettings);
  const modes: { id: GameMode; label: string; text: string }[] = [
    { id: 'guided', label: t('panel.guided'), text: t('panel.explains_each_decision_and_recommends_sensible') },
    { id: 'advanced', label: t('panel.advanced'), text: t('panel.adds_engineering_detail_formulas_assumptions_a') },
  ];
  const qualities: { id: Quality; label: string }[] = [
    { id: 'high', label: t('panel.high') },
    { id: 'balanced', label: t('panel.balanced') },
    { id: 'low', label: t('panel.low') },
  ];
  return (
    <Drawer title={t('panel.settings')} eyebrow={t('panel.play_your_way')} onClose={onClose}>
      <div className="stack stack--lg">
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('panel.game_mode')}</div>
          <div className="stack stack--sm">
            {modes.map((m) => (
              <button key={m.id} type="button" className="option" aria-pressed={settings.mode === m.id} onClick={() => set({ mode: m.id })}>
                <div className="option__name">{t('panel.mode', { m: m.label })}</div>
                <div className="small muted">{m.text}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('panel.visual_quality')}</div>
          <div className="segmented" role="group" aria-label={t('panel.visual_quality')}>
            {qualities.map((q) => (
              <button key={q.id} type="button" aria-pressed={settings.quality === q.id} onClick={() => set({ quality: q.id })}>
                {q.label}
              </button>
            ))}
          </div>
          <p className="xs muted">{t('panel.low_uses_fewer_stars_simpler_planet')}</p>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('panel.motion')}</div>
          <div className="segmented" role="group" aria-label={t('panel.motion')}>
            <button type="button" aria-pressed={!settings.reducedMotion} onClick={() => set({ reducedMotion: false })}>
              {t('panel.full_motion')}
            </button>
            <button type="button" aria-pressed={settings.reducedMotion} onClick={() => set({ reducedMotion: true })}>
              {t('panel.reduced_motion')}
            </button>
          </div>
          <p className="xs muted">{t('panel.reduced_motion_removes_camera_flights_rotati')}</p>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('panel.sound')}</div>
          <p className="small muted">{t('panel.use_the_speaker_button_in_the')}</p>
        </section>
      </div>
    </Drawer>
  );
}

export function TeamSetup() {
  const players = useGame((s) => s.players);
  const setPlayers = useGame((s) => s.setPlayers);
  const resize = (n: number) => setPlayers(defaultPlayers(n).map((p, i) => ({ ...p, name: players[i]?.name ?? p.name })));
  return (
    <div className="stack">
      <div className="row row--wrap">
        <span className="small muted">{t('panel.players_on_this_device')}</span>
        <div className="segmented" role="group" aria-label={t('panel.number_of_players')}>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={players.length === n} onClick={() => resize(n)} data-testid={`players-${n}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="team-grid">
        {players.map((p, i) => (
          <label key={p.role} className="team-seat">
            <span className="eyebrow">{ROLES[p.role].label}</span>
            <input
              value={p.name}
              maxLength={18}
              aria-label={t('panel.name_of_the', { role: ROLES[p.role].label })}
              onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <span className="xs muted">{ROLES[p.role].focus}</span>
          </label>
        ))}
      </div>
      {players.length > 1 ? (
        <p className="xs muted">{t('panel.at_each_key_decision_every_role')}</p>
      ) : (
        <p className="xs muted">{t('panel.playing_solo_you_hold_all_four')}</p>
      )}
    </div>
  );
}

function TeamPanel({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title={t('panel.mission_team')} eyebrow={t('panel.one_to_four_players_same_screen')} onClose={onClose}>
      <TeamSetup />
    </Drawer>
  );
}

export function Panels() {
  const panel = useGame((s) => s.panel);
  const open = useGame((s) => s.openPanel);
  const close = () => open(null);
  if (panel === 'sources') return <SourcesPanel onClose={close} />;
  if (panel === 'settings') return <SettingsPanel onClose={close} />;
  if (panel === 'team') return <TeamPanel onClose={close} />;
  return null;
}
