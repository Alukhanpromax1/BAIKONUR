import gsap from 'gsap';
import { t, useLangStore } from '@/i18n';
import { T } from '@/i18n/Trans';
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
const TEMP = CHANNELS.temperature;

const clock = (s: number) => `T−${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;


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
  const lang = useLangStore((s) => s.lang);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [clockS, setClockS] = useState(246);
  const telemetry = useMemo(() => generateTelemetry(seed, scenario), [seed, scenario]);
  const ref = useReveal<HTMLDivElement>(phase, 0.05);

  // Countdown runs to the built-in hold at T−04:00, where the alarm fires.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setInterval(() => {
      setClockS((v) => {
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
    [scenario, readiness, lang],
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
    let t1 = TEMP.nominal as number;
    for (const s of telemetry.samples) {
      if (s.p1 !== null && Math.abs(s.p1 - P.nominal) > Math.abs(p1 - P.nominal)) p1 = s.p1;
      if (s.t1 !== null && Math.abs(s.t1 - TEMP.nominal) > Math.abs(t1 - TEMP.nominal)) t1 = s.t1;
    }
    return { p1, t1 };
  }, [telemetry]);

  return (
    <div className="readiness scroll hit" ref={ref}>
      <div className="readiness__bar" data-reveal>
        <div className="row row--wrap" style={{ gap: 14 }}>
          <span className={`countdown mono ${phase === 'countdown' ? '' : 'countdown--hold'}`} data-testid="countdown">
            {clock(clockS)}
          </span>
          <span className={`tag ${phase === 'countdown' ? 'tag--cyan' : 'tag--amber'}`}>
            <span className="tag__dot tag__dot--pulse" />
            {phase === 'countdown' ? t('ready.count_running') : phase === 'liftoff' ? t('ready.count_released') : t('ready.built_in_hold')}
          </span>
        </div>
        <span className="tag tag--amber" data-testid="sim-label">
          {t('ready.sim_label')}
        </span>
      </div>

      {phase === 'countdown' && <CountdownView seconds={clockS} />}

      {phase === 'alarm' && (
        <div className="readiness__col">
          <div className="panel panel--amber alarm" data-reveal role="alert">
            <div className="panel__body stack">
              <div className="row">
                <AlertTriangle size={22} className="amber" />
                <div>
                  <div className="eyebrow eyebrow--amber">{t('ready.telemetry_alert_propellant_tank')}</div>
                  <h1 className="title">{t('ready.pressure_and_temperature_anomaly')}</h1>
                </div>
              </div>
              <div className="readouts">
                <Readout label={t('ready.p1_tank_pressure')} value={`${worst.p1.toFixed(2)} bar`} limits={t('ready.bar', { low: P.low, high: P.high })} flag={t('ready.out_of_limits')} />
                <Readout label={t('ready.t1_tank_temperature')} value={`${worst.t1.toFixed(1)} °C`} limits={`${TEMP.low}–${TEMP.high} °C`} flag={t('ready.deviation_flagged')} />
                <Readout label={t('ready.p2_second_sensor')} value={t('ready.not_reviewed')} limits={t('ready.bar', { low: P.low, high: P.high })} note={t('ready.see_the_evidence_panels')} />
              </div>
              <p className="xs muted">{t('ready.values_are_the_most_extreme_readings', { samples: telemetry.samples.length })}</p>
              <p className="small muted">{t('ready.the_automatic_sequencer_has_paused_at')}</p>
            </div>
          </div>
          <div className="panel" data-reveal>
            <div className="panel__body stack">
              <Speech who="arman">
                <T k="ready.arman_alarm" />
              </Speech>
              <Speech who="dana">
                <T k="ready.dana_alarm" />
              </Speech>
              <Speech who="director" compact>
                {t('ready.mission_director_its_your_recommendation_i')}
              </Speech>
            </div>
          </div>
          <div data-reveal>
            <button type="button" className="btn btn--lg" onClick={() => { sfx.confirm(); setPhase('investigate'); }} data-testid="open-evidence">
              {t('ready.open_the_evidence')}{' '} <ArrowRight size={16} />
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
                  <div className="eyebrow">{t('ready.your_recommendation')}</div>
                  <h2 className="subtitle" style={{ marginTop: 4 }}>{t('ready.go_or_no_go')}</h2>
                </div>
                <div className="row row--wrap" style={{ gap: 6 }}>
                  <span className="xs muted">{t('ready.evidence_reviewed')}</span>
                  {(['compare', 'raw', 'trend'] as EvidencePanel[]).map((p) => (
                    <span key={p} className={`tag ${readiness.panelsViewed.includes(p) ? 'tag--cyan' : ''}`}>
                      {readiness.panelsViewed.includes(p) ? <Check size={11} /> : <Eye size={11} />}
                      {PANEL_LABEL[p]}
                    </span>
                  ))}
                </div>
                <TeamDecision testId="readiness" choices={PRIMARY_CHOICES} confirmLabel={t('ready.confirm_recommendation')} onConfirm={(id) => decide(id as PrimaryChoice)} />
                {guided && (
                  <Coach who="director">
                    {t('ready.neither_of_them_is_automatically_right')}
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
                <div className="eyebrow">{t('ready.cross_validation_complete')}</div>
                <h2 className="subtitle" style={{ marginTop: 4 }}>{t('ready.what_does_the_evidence_support')}</h2>
              </div>
              <p className="small muted">{t('ready.you_compared_the_independent_sensors_the')}</p>
              <TeamDecision testId="final" choices={FINAL_CHOICES} confirmLabel={t('ready.send_to_flight_director')} onConfirm={(id) => finalCall(id as FinalCall)} />
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
                  {t('ready.decision_quality', { points: outcome.points, maxPoints: outcome.maxPoints })}
                </span>
              </div>
              <h1 className="title">{outcome.headline}</h1>
              <p className="lead">{outcome.narrative}</p>
              <hr className="rule" />
              <div className="eyebrow eyebrow--muted">{t('ready.what_was_really_happening')}</div>
              <h2 className="subtitle">{outcome.truthTitle}</h2>
              <p className="muted">{outcome.truthExplain}</p>
              <div className="facts facts--compact">
                <div><dt>{t('ready.launch_delay')}</dt><dd>{outcome.slipDays ? `${outcome.slipDays} days` : t('ready.none')}</dd></div>
                <div><dt>{t('ready.extra_cost')}</dt><dd>{outcome.costCr ? `${outcome.costCr} credits` : t('ready.none')}</dd></div>
                <div><dt>{t('ready.evidence_used')}</dt><dd>{t('ready.of_3_panels', { evidenceQuality: outcome.evidenceQuality })}</dd></div>
                <div><dt>{t('ready.effect_at_mars')}</dt><dd>{outcome.degradedLinkDays ? t('ready.weak_link_for_days', { degradedLinkDays: outcome.degradedLinkDays }) : t('ready.none')}</dd></div>
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
              {outcome.slipDays ? t('ready.launch_on_the_new_date') : t('ready.resume_the_count')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {phase === 'liftoff' && outcome && <Liftoff slipDays={outcome.slipDays} timeline={computeTimeline(design, outcome.slipDays)} />}
    </div>
  );
}

const PANEL_LABEL: Record<EvidencePanel, string> = { get compare() { return t('ready.panel_label.compare'); }, get raw() { return t('ready.panel_label.raw'); }, get trend() { return t('ready.panel_label.trend'); } };

const PRIMARY_CHOICES: Choice[] = [
  { id: 'hold', get kicker() { return t('ready.primary_choices.hold.kicker'); }, get title() { return t('ready.primary_choices.hold.title'); }, get text() { return t('ready.primary_choices.hold.text'); } },
  { id: 'cross', get kicker() { return t('ready.primary_choices.cross.kicker'); }, get title() { return t('ready.primary_choices.cross.title'); }, get text() { return t('ready.primary_choices.cross.text'); } },
  { id: 'proceed', get kicker() { return t('ready.primary_choices.proceed.kicker'); }, get title() { return t('ready.primary_choices.proceed.title'); }, get text() { return t('ready.primary_choices.proceed.text'); } },
];

const FINAL_CHOICES: Choice[] = [
  { id: 'scrub', get title() { return t('ready.final_choices.scrub.title'); }, get text() { return t('ready.final_choices.scrub.text'); } },
  { id: 'resync', get title() { return t('ready.final_choices.resync.title'); }, get text() { return t('ready.final_choices.resync.text'); } },
  { id: 'resume', get title() { return t('ready.final_choices.resume.title'); }, get text() { return t('ready.final_choices.resume.text'); } },
];

const VERDICT_LABEL = {
  get correct() { return t('ready.verdict_label.correct'); },
  get 'right-thin-evidence'() { return t('ready.verdict_label.right_thin_evidence'); },
  get 'false-positive'() { return t('ready.verdict_label.false_positive'); },
  get 'false-negative'() { return t('ready.verdict_label.false_negative'); },
  get misdiagnosed() { return t('ready.verdict_label.misdiagnosed'); },
  get lucky() { return t('ready.verdict_label.lucky'); },
} as const;

const REACTIONS = {
  hardware: [
    { who: 'arman' as const, get text() { return t('ready.reactions.hardware.text'); } },
    { who: 'dana' as const, get text() { return t('ready.reactions.hardware.text_2'); } },
  ],
  'data-chain': [
    { who: 'dana' as const, get text() { return t('ready.reactions.data_chain.text'); } },
    { who: 'arman' as const, get text() { return t('ready.reactions.data_chain.text_2'); } },
  ],
  noise: [
    { who: 'dana' as const, get text() { return t('ready.reactions.noise.text'); } },
    { who: 'arman' as const, get text() { return t('ready.reactions.noise.text_2'); } },
  ],
};

function Readout({ label, value, limits, flag, note }: { label: string; value: string; limits: string; flag?: string; note?: string }) {
  return (
    <div className={`readout ${flag ? 'readout--flag' : ''}`}>
      <span className="eyebrow eyebrow--muted">{label}</span>
      <span className="readout__value mono">{value}</span>
      <span className="xs mono muted">{t('ready.limits', { limits })}</span>
      {flag && <span className="xs mono amber">{flag}</span>}
      {note && <span className="xs mono muted">{note}</span>}
    </div>
  );
}

const POLLS = ['ready.poll.range', 'ready.poll.ground', 'ready.poll.spacecraft', 'ready.poll.comms', 'ready.poll.guidance', 'ready.poll.propulsion'] as const;

function CountdownView({ seconds }: { seconds: number }) {
  const done = Math.min(POLLS.length, 246 - seconds);
  return (
    <div className="readiness__col">
      <div data-reveal>
        <div className="eyebrow">{t('ready.launch_readiness_baikonur_training_centre')}</div>
        <h1 className="display" style={{ marginTop: 8 }}>{t('ready.final_readiness_poll')}</h1>
        <p className="lead" style={{ marginTop: 10 }}>{t('ready.kazmars_1_is_fuelled_and_on')}</p>
      </div>
      <div className="polls" data-reveal>
        {POLLS.map((p, i) => (
          <div key={p} className={`poll ${i < done ? 'poll--go' : ''}`}>
            <span>{p}</span>
            <span className="mono">{i < done ? t('ready.go') : '· · ·'}</span>
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
        <div className="eyebrow eyebrow--muted">{t('ready.words_worth_knowing_hover_or_tap')}</div>
        <div className="glossary">
          <Term k="false positive" />
          <Term k="false negative" />
          <Term k="sensor noise" />
          <Term k="data quality" />
          <Term k="correlation" />
          <Term k="moving average" />
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          {t('ready.abnormal_readings_are_never_deleted_from')}
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
        <span className="eyebrow">{t('ready.evidence_last_seconds', { samples: telemetry.samples.length })}</span>
        <span className="xs mono muted">{t('ready.seed', { seed: telemetry.seed })}</span>
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
            <p className="lead">{t('ready.three_ways_to_look_at_the')}</p>
            <p className="muted">{t('ready.open_a_tab_to_inspect_it')}</p>
          </div>
        )}

        {tab === 'compare' && (
          <div className="stack">
            <p className="small">
              <b>{t('ready.what_to_look_for')}</b> <span className="muted">{t('ready.p1_and_p2_are_two_separate')}</span>
            </p>
            <div className="chart" data-testid="chart-compare">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit={t('fmt.axis_s')} interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit={t('fmt.axis_bar')} width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" label={{ value: t('ready.lower_limit'), position: 'insideBottomLeft', ...AXIS, fill: '#FFB84D' }} />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" label={{ value: t('ready.upper_limit'), position: 'insideTopLeft', ...AXIS, fill: '#FFB84D' }} />
                  <Line name={t('ready.p1_pressure_bar')} type="linear" dataKey="p1" stroke="#52D7E8" strokeWidth={1.6} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                  <Line name={t('ready.p2_pressure_bar')} type="linear" dataKey="p2" stroke="#E8ECF1" strokeWidth={1.3} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart chart--short">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit={t('fmt.axis_s')} interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[12, 29]} ticks={[14, 19.5, 25]} unit={t('fmt.axis_degc')} width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={TEMP.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={TEMP.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name={t('ready.t1_temperature_c')} type="linear" dataKey="t1" stroke="#FFB84D" strokeWidth={1.4} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label={t('ready.p1_samples_outside_limits')} value={`${evidence.outOfLimits.p1}`} />
              <Stat label={t('ready.p2_samples_outside_limits')} value={`${evidence.outOfLimits.p2}`} />
              <Stat label={t('ready.p1_p2_gap_last_30_s')} value={`${evidence.lateDisagreementBar.toFixed(2)} bar`} />
              <Stat label={<><Term k="correlation">{t('ready.correlation')}</Term> P1–P2</>} value={evidence.correlationP1P2.toFixed(2)} hint={t('ready.1_move_together_0_unrelated')} />
            </div>
          </div>
        )}

        {tab === 'raw' && (
          <div className="stack">
            <p className="small">
              <b>{t('ready.what_to_look_for')}</b> <span className="muted"><T k="ready.look_raw" tags={{ dq: (c) => <Term k="data quality">{c}</Term> }} /></span>
            </p>
            <div className="chart" data-testid="chart-raw">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit={t('fmt.axis_s')} interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit={t('fmt.axis_bar')} width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name={t('ready.p1_as_shown_on_console_bar')} type="linear" dataKey="p1" stroke="#52D7E8" strokeWidth={1.6} dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                  <Line name={t('ready.p1_from_raw_counts_0_005')} type="linear" dataKey="p1Raw" stroke="#FFB84D" strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive={anim} animationDuration={1100} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label={t('ready.raw_console_value')} value={`${evidence.packets.rawMismatch} packets`} />
              <Stat label={t('ready.missing_packets')} value={`${evidence.packets.missing}`} />
              <Stat label={t('ready.repeated_packets')} value={`${evidence.packets.duplicates}`} />
              <Stat label={t('ready.out_of_order_timestamps')} value={`${evidence.packets.outOfOrder}`} />
            </div>
            <div className="packet-log scroll">
              <table className="table" data-testid="packet-log">
                <thead>
                  <tr>
                    <th>{t('ready.seq')}</th><th>{t('ready.time_s')}</th><th>{t('ready.p1_counts')}</th><th>{t('ready.raw_bar')}</th><th>{t('ready.console_bar')}</th><th>{t('ready.p2_bar')}</th><th>T1 °C</th><th>{t('ready.note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const raw = p.p1Counts * P.countsToBar;
                    const notes = [p.flags.gapBefore ? t('ready.missing_before', { gapBefore: p.flags.gapBefore }) : '', p.flags.duplicate ? 'repeat' : '', p.flags.outOfOrder ? t('ready.out_of_order') : '', Math.abs(raw - p.p1) > 0.02 ? t('ready.raw_console') : '', p.p1 < P.low || p.p1 > P.high ? 'limit' : ''].filter(Boolean);
                    return (
                      <tr key={p.arrival} className={notes.length ? 'flag' : ''}>
                        <td>{p.seq}</td><td>{p.time}</td><td>{p.p1Counts}</td><td>{raw.toFixed(3)}</td><td>{p.p1.toFixed(3)}</td><td>{p.p2.toFixed(3)}</td><td>{p.t1.toFixed(2)}</td><td>{notes.join(' · ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="xs muted">{advanced ? t('ready.all_packets_in_arrival_order', { packets: telemetry.packets.length }) : t('ready.packets_around_the_first_unusual_reading')}</p>
          </div>
        )}

        {tab === 'trend' && (
          <div className="stack">
            <p className="small">
              <b>{t('ready.what_to_look_for')}</b> <span className="muted"><T k="ready.look_trend" params={{ n: MOVING_AVERAGE_WINDOW }} tags={{ noise: (c) => <Term k="sensor noise">{c}</Term>, ma: (c) => <Term k="moving average">{c}</Term> }} /></span>
            </p>
            <div className="chart" data-testid="chart-trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} unit={t('fmt.axis_s')} interval={19} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[15.6, 19.2]} ticks={[16, 16.8, 17.5, 18.2, 19]} unit={t('fmt.axis_bar')} width={62} />
                  <Tooltip {...TOOLTIP} labelFormatter={(v) => `t = ${v} s`} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  <ReferenceLine y={P.low} stroke="#FFB84D" strokeDasharray="4 4" />
                  <ReferenceLine y={P.high} stroke="#FFB84D" strokeDasharray="4 4" />
                  <Line name={t('ready.p1_every_sample_bar')} type="linear" dataKey="p1" stroke="rgba(82,215,232,0.45)" strokeWidth={1} dot={{ r: 1.2, fill: '#52D7E8', strokeWidth: 0 }} isAnimationActive={anim} animationDuration={900} connectNulls={false} />
                  <Line name={t('ready.p1_moving_average_samples_bar', { MOVING_AVERAGE_WINDOW })} type="linear" dataKey="avg" stroke="#E8ECF1" strokeWidth={2} dot={false} isAnimationActive={anim} animationDuration={1300} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stats">
              <Stat label={t('ready.p1_trend_last_60_s')} value={t('u.barmin', { n: fmt(evidence.p1.slopePerMin) })} hint={`± ${evidence.p1.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label={t('ready.p2_trend_last_60_s')} value={t('u.barmin', { n: fmt(evidence.p2.slopePerMin) })} hint={`± ${evidence.p2.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label={t('ready.t1_trend_last_60_s')} value={t('u.degcmin', { n: fmt(evidence.t1.slopePerMin) })} hint={`± ${evidence.t1.uncertaintyPerMin.toFixed(2)}`} />
              <Stat label={t('ready.longest_run_outside_limits')} value={t('ready.in_a_row', { longestRunP1: evidence.longestRunP1 })} />
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
        <span className="eyebrow">{t('ready.cross_validation_worksheet')}</span>
      </div>
      <div className="panel__body">
        <div className="kv"><span>{t('ready.p1_samples_outside_limits_longest_run')}</span><span>{t('ready.in_a_row_2', { p1: e.outOfLimits.p1, longestRunP1: e.longestRunP1 })}</span></div>
        <div className="kv"><span>{t('ready.p2_independent_sensor_samples_outside_limits')}</span><span>{e.outOfLimits.p2}</span></div>
        <div className="kv"><span>{t('ready.p1_trend_p2_trend_last_60')}</span><span>{t('ready.bar_min', { slopePerMin: fmt(e.p1.slopePerMin), slopePerMin2: fmt(e.p2.slopePerMin) })}</span></div>
        <div className="kv"><span>{t('ready.t1_trend_last_60_s')}</span><span>{t('u.degcmin', { n: fmt(e.t1.slopePerMin) })}</span></div>
        <div className="kv"><span>{t('ready.packets_where_raw_counts_console_value')}</span><span>{e.packets.rawMismatch}</span></div>
        <div className="kv"><span>{t('ready.missing_repeated_out_of_order_packets')}</span><span>{e.packets.missing} · {e.packets.duplicates} · {e.packets.outOfOrder}</span></div>
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
      <div className="eyebrow">{t('ready.simulated_launch', { date: formatJd(timeline.launchJd) })}{slipDays ? t('ready.days_after_the_first_attempt', { slipDays }) : ''}</div>
      <h1 className="liftoff__title">{t('ready.liftoff')}</h1>
      <p className="lead">{t('ready.kazmars_1_is_on_its_way')}</p>
      <div className="stack stack--sm">
        <div className="liftoff__row kv"><span>{t('ready.transit_simplified_hohmann_estimate')}</span><span>{t('u.days', { n: timeline.transitDays })}</span></div>
        <div className="liftoff__row kv"><span>{t('ready.mars_arrival')}</span><span>{formatJd(timeline.arrivalJd)}</span></div>
        <div className="liftoff__row kv"><span>{t('ready.reaching_the_science_orbit')}</span><span>{t('u.days', { n: timeline.commissioningDays })}</span></div>
        <div className="liftoff__row kv"><span>{t('ready.science_begins')}</span><span>{formatJd(timeline.scienceStartJd)}</span></div>
      </div>
      <div className="liftoff__cta">
        <button type="button" className="btn btn--lg" onClick={() => navigate('operations')} data-testid="to-operations">
          {t('ready.begin_mars_operations')}{' '} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
