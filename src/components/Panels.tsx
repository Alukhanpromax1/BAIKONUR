import { ExternalLink, X } from 'lucide-react';
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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
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
    <Drawer title="Data sources" eyebrow="Where the science comes from" onClose={onClose}>
      <div className="stack stack--lg">
        <p className="muted">
          Every number in the game carries one of these labels. KAZMARS-1 is a fictional educational mission — it is not a NASA or government mission, and this
          simulator is not spacecraft design software.
        </p>

        <section className="panel panel--plain" data-testid="live-reading">
          <div className="panel__body stack stack--sm">
            <div className="row row--between row--wrap">
              <span className="eyebrow">Earth–Mars signal delay · {reading.epochIso}</span>
              <span className={`tag ${reading.status === 'live' ? 'tag--cyan' : 'tag--amber'}`}>
                <span className="tag__dot" />
                {reading.status === 'live' ? 'Live from JPL Horizons' : 'Cached snapshot'}
              </span>
            </div>
            <div className="kv">
              <span>One-way light time (Horizons “LT”)</span>
              <span>
                {reading.oneWayLightTimeS.toFixed(1)} s · {formatLightTime(reading.oneWayLightTimeS)}
              </span>
            </div>
            <div className="kv">
              <span>Round trip (2 × one-way)</span>
              <span>{formatLightTime(roundTripS(reading.oneWayLightTimeS))}</span>
            </div>
            <div className="kv">
              <span>Range (Horizons “RG”)</span>
              <span>
                {Math.round(reading.rangeKm).toLocaleString('en-US')} km · {reading.rangeAu.toFixed(3)} AU
              </span>
            </div>
            <div className="kv">
              <span>Range-rate (Horizons “RR”)</span>
              <span>{reading.rangeRateKmS.toFixed(2)} km/s</span>
            </div>
            <p className="xs muted">
              Retrieved {new Date(reading.retrievedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC.{' '}
              {reading.status === 'cached' ? 'The live service was not reachable, so this value comes from the dated snapshot bundled with the game.' : 'Read just now through the game’s Horizons proxy.'}{' '}
              In mission operations, time is accelerated for play: real delays are shown but you do not wait for them.
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
                {s.retrieved && <span className="xs mono muted">Retrieved {s.retrieved.slice(0, 10)}</span>}
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
                  <span className="dim">UNITS </span>
                  {s.units}
                </div>
              )}
              <div className="small">
                <div className="eyebrow eyebrow--muted" style={{ margin: '6px 0 4px' }}>
                  Values used
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {s.fields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="eyebrow eyebrow--muted" style={{ margin: '10px 0 4px' }}>
                  Where it affects the game
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
            AI disclosure: this game’s code was written with AI assistance (Claude Code) under the team’s direction. It contains no AI-generated images, video or
            recorded audio; all 3D visuals are procedural and all sounds are synthesised in the browser. Fonts: Space Grotesk, Inter and IBM Plex Mono (SIL Open
            Font License).
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
    { id: 'guided', label: 'Guided', text: 'Explains each decision and recommends sensible options.' },
    { id: 'advanced', label: 'Advanced', text: 'Adds engineering detail, formulas, assumptions and raw data.' },
  ];
  const qualities: { id: Quality; label: string }[] = [
    { id: 'high', label: 'High' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'low', label: 'Low' },
  ];
  return (
    <Drawer title="Settings" eyebrow="Play your way" onClose={onClose}>
      <div className="stack stack--lg">
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Game mode</div>
          <div className="stack stack--sm">
            {modes.map((m) => (
              <button key={m.id} type="button" className="option" aria-pressed={settings.mode === m.id} onClick={() => set({ mode: m.id })}>
                <div className="option__name">{m.label} mode</div>
                <div className="small muted">{m.text}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Visual quality</div>
          <div className="segmented" role="group" aria-label="Visual quality">
            {qualities.map((q) => (
              <button key={q.id} type="button" aria-pressed={settings.quality === q.id} onClick={() => set({ quality: q.id })}>
                {q.label}
              </button>
            ))}
          </div>
          <p className="xs muted">Low uses fewer stars, simpler planet shading and no shadows — choose it if the game feels slow.</p>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Motion</div>
          <div className="segmented" role="group" aria-label="Motion">
            <button type="button" aria-pressed={!settings.reducedMotion} onClick={() => set({ reducedMotion: false })}>
              Full motion
            </button>
            <button type="button" aria-pressed={settings.reducedMotion} onClick={() => set({ reducedMotion: true })}>
              Reduced motion
            </button>
          </div>
          <p className="xs muted">Reduced motion removes camera flights, rotation and animated transitions.</p>
        </section>
        <section className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Sound</div>
          <p className="small muted">Use the speaker button in the top bar. All sounds are synthesised in your browser and are never needed to play.</p>
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
        <span className="small muted">Players on this device</span>
        <div className="segmented" role="group" aria-label="Number of players">
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
              aria-label={`Name of the ${ROLES[p.role].label}`}
              onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <span className="xs muted">{ROLES[p.role].focus}</span>
          </label>
        ))}
      </div>
      {players.length > 1 ? (
        <p className="xs muted">At each key decision every role proposes an answer, then the Mission Director confirms the team’s choice.</p>
      ) : (
        <p className="xs muted">Playing solo? You hold all four roles. Add players any time from the team button in the top bar.</p>
      )}
    </div>
  );
}

function TeamPanel({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="Mission team" eyebrow="One to four players · same screen" onClose={onClose}>
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
