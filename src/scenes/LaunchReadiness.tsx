import gsap from 'gsap';
import { AlertTriangle, ArrowRight, Check, Eye } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { navigate } from '@/app/navigation';
import { sfx } from '@/audio/sound';
import { Coach, Speech } from '@/components/Avatar';
import { Term } from '@/components/Tags';
import { TeamDecision, type Choice } from '@/components/TeamDecision';
import { computeTimeline } from '@/game/engine/duration';
import { resolveReadiness, type EvidencePanel, type FinalCall, type PrimaryChoice } from '@/game/scenarios/decision';
import { analyzeEvidence, MOVING_AVERAGE_WINDOW } from '@/game/scenarios/evidence';
import { CHANNELS, generateTelemetry, type Telemetry } from '@/game/scenarios/telemetry';
import { useGame } from '@/game/state/store';
import { useReveal } from '@/hooks/useReveal';
import { formatJd } from '@/services/horizons/ephemeris';

type Phase = 'countdown' | 'alarm' | 'investigate' | 'final' | 'outcome' | 'liftoff';

const AXIS = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#9aa8be' };
const GRID = 'rgba(148,178,214,0.12)';
const TOOLTIP = {
  contentStyle: { background: '#16223a', border: '1px solid rgba(148,178,214,0.32)', borderRadius: 2, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
  labelStyle: { color: '#9aa8be' },
  itemStyle: { padding: 0 },
};
const P = CHANNELS.pressure;
const T = CHANNELS.temperature;

const clock = (s: number) => `T−${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const SIM_LABEL = 'SIMULATED TELEMETRY — EDUCATIONAL SCENARIO';

/** Scene 5 — countdown, anomaly, evidence investigation and the Go/No-Go call. */
export default function LaunchReadiness() {
  const seed = useGame((s) => s.seed);
  const scenario = useGame((s) => s.scenario);
  const design = useGame((s) => s.design);
  const readiness = useGame((s) => s.readiness);
  const viewPanel = useGame((s) => s.viewPanel);
  const setChoice = useGame((s) => s.setReadinessChoice);
  const guided = useGame((s) => s.settings.mode === 'guided');
  const reduced = useGame((s) => s.settings.reducedMotion);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [t, setT] = useState(246);
  const telemetry = useMemo(() => generateTelemetry(seed, scenario), [seed, scenario]);
  const ref = useReveal<HTMLDivElement>(phase, 0.05);

  // Countdown runs to the built-in hold at T−04:00, where the alarm fires.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setInterval(() => {
      setT((v) => {
        if (v <= 241) {
          clearInterval(id);
          sfx.warning();
          setPhase('alarm');
          return 240;
        }
        sfx.tick();
        return v - 1;
      });
    }, reduced ? 250 : 1000);
    return () => clearInterval(id);
  }, [phase, reduced]);

  const outcome = useMemo(
    () => (readiness.choice ? resolveReadiness({ scenario, choice: readiness.choice, panelsViewed: readiness.panelsViewed, finalCall: readiness.finalCall }) : null),
    [scenario, readiness],
  );

  const decide = (choice: PrimaryChoice) => {
    if (choice === 'cross') {
      (['compare', 'raw', 'trend'] as EvidencePanel[]).forEach(viewPanel);
      setPhase('final');
      return;
    }
    setChoice(choice);
    sfx.reveal();
    setPhase('outcome');
  };
  const finalCall = (call: FinalCall) => {
    setChoice('cross', call);
    sfx.reveal();
    setPhase('outcome');
  };

  // The alarm shows the worst reading of each flagged channel — not the cause.
  const worst = useMemo(() => {
    let p1 = P.nominal as number;
    let t1 = T.nominal as number;
    for (const s of telemetry.samples) {
      if (s.p1 !== null && Math.abs(s.p1 - P.nominal) > Math.abs(p1 - P.nominal)) p1 = s.p1;
      if (s.t1 !== null && Math.abs(s.t1 - T.nominal) > Math.abs(t1 - T.nominal)) t1 = s.t1;
    }
    return { p1, t1 };
  }, [telemetry]);

  return (
    <div className="readiness scroll hit" ref={ref}>
      <div className="readiness__bar" data-reveal>
        <div className="row row--wrap" style={{ gap: 14 }}>
          <span className={`countdown mono ${phase === 'countdown' ? '' : 'countdown--hold'}`} data-testid="countdown">
            {clock(t)}
          </span>
          <span className={`tag ${phase === 'countdown' ? 'tag--cyan' : 'tag--amber'}`}>
            <span className="tag__dot tag__dot--pulse" />
            {phase === 'countdown' ? 'Count running' : phase === 'liftoff' ? 'Count released' : 'Built-in hold'}
          </span>
        </div>
        <span className="tag tag--amber" data-testid="sim-label">
          {SIM_LABEL}
        </span>
      </div>

      {phase === 'countdown' && <CountdownView t={t} />}

      {phase === 'alarm' && (
        <div className="readiness__col">
          <div className="panel panel--amber alarm" data-reveal role="alert">
            <div className="panel__body stack">
              <div className="row">
                <AlertTriangle size={22} className="amber" />
                <div>
                  <div className="eyebrow eyebrow--amber">Telemetry alert · propellant tank</div>
                  <h1 className="title">Pressure and temperature anomaly</h1>
                </div>
              </div>
              <div className="readouts">
                <Readout label="P1 tank pressure" value={`${worst.p1.toFixed(2)} bar`} limits={`${P.low}–${P.high} bar`} flag="OUT OF LIMITS" />
                <Readout label="T1 tank temperature" value={`${worst.t1.toFixed(1)} °C`} limits={`${T.low}–${T.high} °C`} flag="DEVIATION FLAGGED" />
                <Readout label="P2 · second sensor" value="Not reviewed" limits={`${P.low}–${P.high} bar`} note="See the evidence panels" />
              </div>
              <p className="xs muted">Values are the most extreme readings of each flagged channel in the last {telemetry.samples.length} seconds.</p>
              <p className="small muted">The automatic sequencer has paused at the planned hold. You have time to decide — use it.</p>
            </div>
          </div>
          <div className="panel" data-reveal>
            <div className="panel__body stack">
              <Speech who="arman">
                That’s the pressurant tank. If it’s leaking, we do not want to find out after launch. <b>Hold the countdown. Verify the hardware condition before proceeding.</b>
              </Speech>
              <Speech who="dana">
                Or the tank is fine and the number is wrong. We’ve had glitchy packets all morning. <b>Cross-check the raw signals and independent sensors before concluding that the hardware has failed.</b>
              </Speech>
              <Speech who="director" compact>
                Mission Director, it’s your recommendation. I keep the final word on launch safety — but I want to hear what the evidence says.
              </Speech>
            </div>
          </div>
          <div data-reveal>
            <button type="button" className="btn btn--lg" onClick={() => { sfx.confirm(); setPhase('investigate'); }} data-testid="open-evidence">
              Open the evidence <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {phase === 'investigate' && (
        <div className="readiness__split">
          <div data-reveal>
            <EvidenceBoard telemetry={telemetry} viewed={readiness.panelsViewed} onView={viewPanel} />
          </div>
          <div className="stack" data-reveal>
            <div className="panel">
              <div className="panel__body stack">
                <div>
                  <div className="eyebrow">Your recommendation</div>
                  <h2 className="subtitle" style={{ marginTop: 4 }}>Go or no-go?</h2>
                </div>
                <div className="row row--wrap" style={{ gap: 6 }}>
                  <span className="xs muted">Evidence reviewed</span>
                  {(['compare', 'raw', 'trend'] as EvidencePanel[]).map((p) => (
                    <span key={p} className={`tag ${readiness.panelsViewed.includes(p) ? 'tag--cyan' : ''}`}>
                      {readiness.panelsViewed.includes(p) ? <Check size={11} /> : <Eye size={11} />}
                      {PANEL_LABEL[p]}
                    </span>
                  ))}
                </div>
                <TeamDecision testId="readiness" choices={PRIMARY_CHOICES} confirmLabel="Confirm recommendation" onConfirm={(id) => decide(id as PrimaryChoice)} />
                {guided && (
                  <Coach who="director">
                    Neither of them is automatically right. Open each evidence tab before you choose — a decision is judged by what you knew, not by how it turned out.
                  </Coach>
                )}
              </div>
            </div>
            <Glossary />
          </div>
        </div>
      )}

      {phase === 'final' && (
        <div className="readiness__split">
          <div className="stack" data-reveal>
            <EvidenceSummary telemetry={telemetry} />
            <EvidenceBoard telemetry={telemetry} viewed={readiness.panelsViewed} onView={viewPanel} compact />
          </div>
          <div className="panel" data-reveal>
            <div className="panel__body stack">
              <div>
                <div className="eyebrow">Cross-validation complete</div>
                <h2 className="subtitle" style={{ marginTop: 4 }}>What does the evidence support?</h2>
              </div>
              <p className="small muted">You compared the independent sensors, the raw counts and the trend. Now tell the Flight Director what to do.</p>
              <TeamDecision testId="final" choices={FINAL_CHOICES} confirmLabel="Send to Flight Director" onConfirm={(id) => finalCall(id as FinalCall)} />
            </div>
          </div>
        </div>
      )}

      {phase === 'outcome' && outcome && (
        <div className="readiness__col">
          <div className="panel" data-reveal data-testid="readiness-outcome">
            <div className="panel__body stack">
              <div className="row row--between row--wrap">
                <div className={`eyebrow ${outcome.verdict === 'correct' ? '' : 'eyebrow--amber'}`}>{VERDICT_LABEL[outcome.verdict]}</div>
                <span className="mono">
                  Decision quality {outcome.points}/{outcome.maxPoints}
                </span>
              </div>
              <h1 className="title">{outcome.headline}</h1>
              <p className="lead">{outcome.narrative}</p>
              <hr className="rule" />
              <div className="eyebrow eyebrow--muted">What was really happening</div>
              <h2 className="subtitle">{outcome.truthTitle}</h2>
              <p className="muted">{outcome.truthExplain}</p>
              <div className="facts facts--compact">
                <div><dt>Launch delay</dt><dd>{outcome.slipDays ? `${outcome.slipDays} days` : 'None'}</dd></div>
                <div><dt>Extra cost</dt><dd>{outcome.costCr ? `${outcome.costCr} credits` : 'None'}</dd></div>
                <div><dt>Evidence used</dt><dd>{outcome.evidenceQuality} of 3 panels</dd></div>
                <div><dt>Effect at Mars</dt><dd>{outcome.degradedLinkDays ? `Weak link for ${outcome.degradedLinkDays} days` : 'None'}</dd></div>
              </div>
            </div>
          </div>
          <div className="panel" data-reveal>
            <div className="panel__body stack">
              {REACTIONS[scenario].map((r) => (
                <Speech key={r.who} who={r.who} compact>
                  {r.text}
                </Speech>
              ))}
            </div>
          </div>
          <div data-reveal>
            <button type="button" className="btn btn--lg" onClick={() => { sfx.launch(); setPhase('liftoff'); }} data-testid="to-liftoff">
              {outcome.slipDays ? 'Launch on the new date' : 'Resume the count'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {phase === 'liftoff' && outcome && <Liftoff slipDays={outcome.slipDays} timeline={computeTimeline(design, outcome.slipDays)} />}
    </div>
  );
}

const PANEL_LABEL: Record<EvidencePanel, string> = { compare: 'Sensor comparison', raw: 'Raw telemetry', trend: 'Trend analysis' };

const PRIMARY_CHOICES: Choice[] = [
  { id: 'hold', kicker: 'Arman recommends', title: 'Hold and investigate', text: 'Stop the countdown and send technicians to inspect the tank. Right if the fault is real — costs days and credits if it is not.' },
  { id: 'cross', kicker: 'Dana recommends', title: 'Cross-validate the evidence', text: 'Use the built-in hold to compare raw signals and independent sensors, then recommend an action to the Flight Director.' },
  { id: 'proceed', kicker: 'No further checks', title: 'Proceed with the countdown', text: 'Treat the alarm as harmless and resume. Fastest — and a real risk if the evidence does not support it.' },
];

const FINAL_CHOICES: Choice[] = [
  { id: 'scrub', title: 'Scrub and inspect the hardware', text: 'The evidence shows a physical problem in the tank.' },
  { id: 'resync', title: 'Switch to the backup telemetry path, then resume', text: 'The evidence shows the data chain is corrupting good measurements.' },
  { id: 'resume', title: 'Resume and keep the sensor on watch', text: 'The evidence shows an isolated noise spike with no trend.' },
];

const VERDICT_LABEL = {
  correct: 'Evidence-based decision',
  'right-thin-evidence': 'Right call · thin evidence',
  'false-positive': 'False positive',
  'false-negative': 'False negative',
  misdiagnosed: 'Misdiagnosed',
  lucky: 'Lucky outcome',
} as const;

const REACTIONS = {
  hardware: [
    { who: 'arman' as const, text: 'Two sensors, same story, and the temperature followed. That is why I wanted eyes on the hardware.' },
    { who: 'dana' as const, text: 'And the data is what proved it. I would rather check and agree with you than guess and be right.' },
  ],
  'data-chain': [
    { who: 'dana' as const, text: 'The raw counts never moved. It was our own ground software misreading good packets.' },
    { who: 'arman' as const, text: 'Fine — this time the hardware was innocent. I still want that processor fixed before the next count.' },
  ],
  noise: [
    { who: 'dana' as const, text: 'One point is not a trend. The second sensor never even blinked.' },
    { who: 'arman' as const, text: 'Agreed. But I would rather look and find nothing than assume and be wrong.' },
  ],
};

function Readout({ label, value, limits, flag, note }: { label: string; value: string; limits: string; flag?: string; note?: string }) {
  return (
    <div className={`readout ${flag ? 'readout--flag' : ''}`}>
      <span className="eyebrow eyebrow--muted">{label}</span>
      <span className="readout__value mono">{value}</span>
      <span className="xs mono muted">limits {limits}</span>
      {flag && <span className="xs mono amber">{flag}</span>}
      {note && <span className="xs mono muted">{note}</span>}
    </div>
  );
}

const POLLS = ['Range safety', 'Ground power', 'Spacecraft power', 'Communications', 'Guidance', 'Propulsion'];

function CountdownView({ t }: { t: number }) {
  const done = Math.min(POLLS.length, 246 - t);
  return (
    <div className="readiness__col">
      <div data-reveal>
        <div className="eyebrow">Launch readiness · Baikonur training centre</div>
        <h1 className="display" style={{ marginTop: 8 }}>Final readiness poll</h1>
        <p className="lead" style={{ marginTop: 10 }}>KAZMARS-1 is fuelled and on internal power. The team is polling each console before the planned hold at T−04:00.</p>
      </div>
      <div className="polls" data-reveal>
        {POLLS.map((p, i) => (
          <div key={p} className={`poll ${i < done ? 'poll--go' : ''}`}>
            <span>{p}</span>
            <span className="mono">{i < done ? 'GO' : '· · ·'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Glossary() {
  return (
    <div className="panel panel--plain">
      <div className="panel__body">
        <div className="eyebrow eyebrow--muted">Words worth knowing — hover or tap</div>
        <div className="glossary">
          <Term k="false positive" />
          <Term k="false negative" />
          <Term k="sensor noise" />
          <Term k="data quality" />
          <Term k="correlation" />
          <Term k="moving average" />
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          Abnormal readings are never deleted from these charts. An outlier may be noise — or the first sign of something real.
        </p>
      </div>
    </div>
  );
}

function EvidenceBoard({ telemetry, viewed, onView, compact = false }: { telemetry: Telemetry; viewed: EvidencePanel[]; onView: (p: EvidencePanel) => void; compact?: boolean }) {
  const [tab, setTab] = useState<EvidencePanel | null>(compact ? 'compare' : null);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const advanced = useGame((s) => s.settings.mode === 'advanced');
  const evidence = useMemo(() => analyzeEvidence(telemetry), [telemetry]);
  const open = (p: EvidencePanel) => {
    sfx.click();
    setTab(p);
    onView(p);
  };
  const data = useMemo(
    () => telemetry.samples.map((s, i) => ({ ...s, avg: evidence.movingAverageP1[i] })),
    [telemetry, evidence],
  );
  const anim = !reduced;
  const firstFlag = telemetry.packets.findIndex((p) => p.flags.duplicate || p.flags.outOfOrder || p.flags.gapBefore > 0 || Math.abs(p.p1Counts * P.countsToBar - p.p1) > 0.02 || p.p1 < P.low || p.p1 > P.high);
  const from = Math.max(0, (firstFlag < 0 ? 40 : firstFlag) - 4);
  const rows = advanced ? telemetry.packets : telemetry.packets.slice(from, from + 26);
  const fmt = (n: number, d = 2) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`;

  return (
    <div className="panel evidence">
      <div className="panel__head">
        <span className="eyebrow">Evidence · last {telemetry.samples.length} seconds</span>
        <span className="xs mono muted">seed {telemetry.seed}</span>
      </div>
      <div className="tabs tabs--flush" role="tablist">
        {(['compare', 'raw', 'trend'] as EvidencePanel[]).map((p, i) => (
          <button key={p} type="button" role="tab" aria-selected={tab === p} className={`tab ${viewed.includes(p) ? 'is-seen' : ''}`} onClick={() => open(p)} data-testid={`evidence-${p}`}>
            <span className="mono xs">{i + 1}</span>
            <span>{PANEL_LABEL[p]}</span>
          </button>
        ))}
      </div>
      <div className="panel__body">
        {tab === null && (
          <div className="evidence__empty">
            <p className="lead">Three ways to look at the same alarm.</p>
            <p className="muted">Open a tab to inspect it. Nothing here tells you the answer — each view shows a different part of the picture.</p>
          </div>
        )}

        {tab === 'compare' && (
          <div className="stack">
            <p className="small">
              <b>What to look for:</b> <span className="muted">P1 and P2 are two separate sensors on the same tank. If the tank is really losing pressure, both should show it. If only one moves, suspect that sensor or its data.</span>
            </p>
            <div className="chart" data-testid="chart-compare">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit=" s" interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit=" bar" width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" label={{ value: 'lower limit', position: 'insideBottomLeft', ...AXIS, fill: '#FFB84D' }} />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" label={{ value: 'upper limit', position: 'insideTopLeft', ...AXIS, fill: '#FFB84D' }} />
                  <Line name="P1 pressure (bar)" type="linear" dataKey="p1" stroke="#52D7E8" strokeWidth={1.6} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                  <Line name="P2 pressure (bar)" type="linear" dataKey="p2" stroke="#E8ECF1" strokeWidth={1.3} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart chart--short">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit=" s" interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[12, 29]} ticks={[14, 19.5, 25]} unit=" °C" width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={T.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={T.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name="T1 temperature (°C)" type="linear" dataKey="t1" stroke="#FFB84D" strokeWidth={1.4} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label="P1 samples outside limits" value={`${evidence.outOfLimits.p1}`} />
              <Stat label="P2 samples outside limits" value={`${evidence.outOfLimits.p2}`} />
              <Stat label="P1–P2 gap, last 30 s" value={`${evidence.lateDisagreementBar.toFixed(2)} bar`} />
              <Stat label={<><Term k="correlation">Correlation</Term> P1–P2</>} value={evidence.correlationP1P2.toFixed(2)} hint="1 = move together · 0 = unrelated" />
            </div>
          </div>
        )}

        {tab === 'raw' && (
          <div className="stack">
            <p className="small">
              <b>What to look for:</b> <span className="muted">Raw counts come straight from the sensor. Console values pass through ground software first. If the two disagree, or packets are missing, repeated or out of order, the problem lies in between — in the <Term k="data quality" />.</span>
            </p>
            <div className="chart" data-testid="chart-raw">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit=" s" interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit=" bar" width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name="P1 as shown on console (bar)" type="linear" dataKey="p1" stroke="#52D7E8" strokeWidth={1.6} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                  <Line name="P1 from raw counts × 0.005 (bar)" type="linear" dataKey="p1Raw" stroke="#FFB84D" strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label="Raw ≠ console value" value={`${evidence.packets.rawMismatch} packets`} />
              <Stat label="Missing packets" value={`${evidence.packets.missing}`} />
              <Stat label="Repeated packets" value={`${evidence.packets.duplicates}`} />
              <Stat label="Out-of-order timestamps" value={`${evidence.packets.outOfOrder}`} />
            </div>
            <div className="packet-log scroll">
              <table className="table" data-testid="packet-log">
                <thead>
                  <tr>
                    <th>Seq</th><th>Time s</th><th>P1 counts</th><th>Raw bar</th><th>Console bar</th><th>P2 bar</th><th>T1 °C</th><th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const raw = p.p1Counts * P.countsToBar;
                    const notes = [p.flags.gapBefore ? `${p.flags.gapBefore} missing before` : '', p.flags.duplicate ? 'repeat' : '', p.flags.outOfOrder ? 'out of order' : '', Math.abs(raw - p.p1) > 0.02 ? 'raw ≠ console' : '', p.p1 < P.low || p.p1 > P.high ? 'limit' : ''].filter(Boolean);
                    return (
                      <tr key={p.arrival} className={notes.length ? 'flag' : ''}>
                        <td>{p.seq}</td><td>{p.time}</td><td>{p.p1Counts}</td><td>{raw.toFixed(3)}</td><td>{p.p1.toFixed(3)}</td><td>{p.p2.toFixed(3)}</td><td>{p.t1.toFixed(2)}</td><td>{notes.join(' · ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="xs muted">{advanced ? `All ${telemetry.packets.length} packets in arrival order.` : 'Packets around the first unusual reading, in arrival order. Advanced mode shows the full log.'}</p>
          </div>
        )}

        {tab === 'trend' && (
          <div className="stack">
            <p className="small">
              <b>What to look for:</b> <span className="muted">Every sensor shows <Term k="sensor noise" />. The <Term k="moving average" /> ({MOVING_AVERAGE_WINDOW} samples) smooths single jumps. A real change keeps going and is larger than its uncertainty; a glitch does not.</span>
            </p>
            <div className="chart" data-testid="chart-trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit=" s" interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit=" bar" width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name="P1 every sample (bar)" type="linear" dataKey="p1" stroke="rgba(82,215,232,0.45)" strokeWidth={1} dot={{ r: 1.2, fill: '#52D7E8', strokeWidth: 0 }} isAnimationActive={anim} animationDuration={900} connectNulls={false} />
                  <Line name={`P1 moving average, ${MOVING_AVERAGE_WINDOW} samples (bar)`} type="linear" dataKey="avg" stroke="#E8ECF1" strokeWidth={2} dot={false} isAnimationActive={anim} animationDuration={1300} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label="P1 trend, last 60 s" value={`${fmt(evidence.p1.slopePerMin)} bar/min`} hint={`± ${evidence.p1.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label="P2 trend, last 60 s" value={`${fmt(evidence.p2.slopePerMin)} bar/min`} hint={`± ${evidence.p2.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label="T1 trend, last 60 s" value={`${fmt(evidence.t1.slopePerMin)} °C/min`} hint={`± ${evidence.t1.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label="Longest run outside limits" value={`${evidence.longestRunP1} in a row`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: React.ReactNode; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="xs muted">{label}</span>
      <span className="mono">{value}</span>
      {hint && <span className="xs mono dim">{hint}</span>}
    </div>
  );
}

/** The cross-validation worksheet: the key numbers from all three panels side by side. */
function EvidenceSummary({ telemetry }: { telemetry: Telemetry }) {
  const e = useMemo(() => analyzeEvidence(telemetry), [telemetry]);
  const fmt = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
  return (
    <div className="panel" data-testid="evidence-summary">
      <div className="panel__head">
        <span className="eyebrow">Cross-validation worksheet</span>
      </div>
      <div className="panel__body">
        <div className="kv"><span>P1 samples outside limits · longest run</span><span>{e.outOfLimits.p1} · {e.longestRunP1} in a row</span></div>
        <div className="kv"><span>P2 (independent sensor) samples outside limits</span><span>{e.outOfLimits.p2}</span></div>
        <div className="kv"><span>P1 trend · P2 trend, last 60 s</span><span>{fmt(e.p1.slopePerMin)} · {fmt(e.p2.slopePerMin)} bar/min</span></div>
        <div className="kv"><span>T1 trend, last 60 s</span><span>{fmt(e.t1.slopePerMin)} °C/min</span></div>
        <div className="kv"><span>Packets where raw counts ≠ console value</span><span>{e.packets.rawMismatch}</span></div>
        <div className="kv"><span>Missing · repeated · out-of-order packets</span><span>{e.packets.missing} · {e.packets.duplicates} · {e.packets.outOfOrder}</span></div>
      </div>
    </div>
  );
}

function Liftoff({ slipDays, timeline }: { slipDays: number; timeline: ReturnType<typeof computeTimeline> }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useGame((s) => s.settings.reducedMotion);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reduced) return;
      gsap.fromTo('.liftoff__title', { opacity: 0, scale: 1.12, letterSpacing: '0.5em' }, { opacity: 1, scale: 1, letterSpacing: '0.18em', duration: 1.6, ease: 'power3.out' });
      gsap.fromTo('.liftoff__row', { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.35, delay: 1.1, ease: 'power2.out' });
      gsap.fromTo('.liftoff__cta', { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 2.8 });
    }, root);
    return () => ctx.revert();
  }, [reduced]);
  return (
    <div className="readiness__col liftoff" ref={root} data-testid="liftoff">
      <div className="eyebrow">Simulated launch · {formatJd(timeline.launchJd)}{slipDays ? ` · ${slipDays} days after the first attempt` : ''}</div>
      <h1 className="liftoff__title">LIFTOFF</h1>
      <p className="lead">KAZMARS-1 is on its way. The next time you make a decision, your spacecraft will be more than a hundred million kilometres away.</p>
      <div className="stack stack--sm">
        <div className="liftoff__row kv"><span>Transit · simplified Hohmann estimate</span><span>{timeline.transitDays} days</span></div>
        <div className="liftoff__row kv"><span>Mars arrival</span><span>{formatJd(timeline.arrivalJd)}</span></div>
        <div className="liftoff__row kv"><span>Reaching the science orbit</span><span>{timeline.commissioningDays} days</span></div>
        <div className="liftoff__row kv"><span>Science begins</span><span>{formatJd(timeline.scienceStartJd)}</span></div>
      </div>
      <div className="liftoff__cta">
        <button type="button" className="btn btn--lg" onClick={() => navigate('operations')} data-testid="to-operations">
          Begin Mars operations <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
