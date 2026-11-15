import { ArrowRight, FastForward, Pause, Play } from 'lucide-react';
import { t } from '@/i18n';
import { T } from '@/i18n/Trans';
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '@/app/navigation';
import { sfx } from '@/audio/sound';
import { Coach } from '@/components/Avatar';
import { ProvenanceTag, Term } from '@/components/Tags';
import { TeamDecision, type Choice } from '@/components/TeamDecision';
import { COMPONENT_BY_ID } from '@/data/components';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { ORBIT_BY_ID } from '@/data/orbits';
import { formatData, formatLightTime, formatRate, roundTripS } from '@/game/engine/comms';
import { POWER_MARGIN_RULE, simulateMission, STORM_DAYS, type OpsEvent, type OpsEventId, type SimResult, type SimStep } from '@/game/ops/simulate';
import { resolveReadiness } from '@/game/scenarios/decision';
import { useGame } from '@/game/state/store';
import { useReveal } from '@/hooks/useReveal';
import { formatJd } from '@/services/horizons/ephemeris';
import { worldState } from '@/three/state';

const STEPS_PER_SECOND = 9;

const EVENT_NAME: Record<OpsEventId, string> = { get conjunction() { return t('ops.event_name.conjunction'); }, get power() { return t('ops.event_name.power'); }, get storm() { return t('ops.event_name.storm'); } };

/** Scene 6 — the science phase at Mars, played in accelerated time with three decisions. */
export default function MarsOperations() {
  const design = useGame((s) => s.design);
  const scenario = useGame((s) => s.scenario);
  const readiness = useGame((s) => s.readiness);
  const decisions = useGame((s) => s.ops);
  const setDecision = useGame((s) => s.setOpsDecision);
  const setHighlight = useGame((s) => s.setOpsHighlight);
  const guided = useGame((s) => s.settings.mode === 'guided');
  const advanced = !guided;
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [fast, setFast] = useState(false);
  const [pending, setPending] = useState<OpsEvent | null>(null);
  const [log, setLog] = useState<{ day: number; event: OpsEventId; choice: string }[]>([]);
  const ref = useReveal<HTMLDivElement>();

  const simOptions = useMemo(() => {
    const r = resolveReadiness({ scenario, choice: readiness.choice ?? 'cross', panelsViewed: readiness.panelsViewed, finalCall: readiness.finalCall });
    return { slipDays: r.slipDays, degradedLinkDays: r.degradedLinkDays };
  }, [scenario, readiness]);
  const sim: SimResult = useMemo(() => simulateMission(design, { ...simOptions, decisions }), [design, simOptions, decisions]);
  const total = sim.steps.length;
  const step: SimStep = sim.steps[Math.min(index, total - 1)];
  const finished = index >= total;
  const decided = (id: OpsEventId) => decisions[id] !== undefined;

  // Playback clock. React state is updated a few times per second, not every frame.
  const state = useRef({ index, sim, decisions });
  state.current = { index, sim, decisions };
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => {
        const { index: i, sim: s, decisions: d } = state.current;
        const next = i + 1;
        const event = s.events.find((e) => e.promptStep === next && d[e.id] === undefined);
        if (event) {
          setRunning(false);
          setPending(event);
          sfx.warning();
        }
        if (next >= s.steps.length) {
          setRunning(false);
          sfx.reveal();
        }
        setIndex(next);
      },
      1000 / (STEPS_PER_SECOND * (fast ? 2.5 : 1)),
    );
    return () => clearInterval(id);
  }, [running, fast]);

  // Tell the 3D scene what is happening.
  useEffect(() => {
    const storm = sim.events.find((e) => e.id === 'storm');
    worldState.storm = storm && index >= storm.windowStart && index < storm.windowEnd + 6 ? 1 : 0;
    worldState.opsSpeed = running ? (fast ? 2.2 : 1) : 0.25;
    setHighlight(finished ? null : step.safeMode ? 'safe' : step.blackout ? 'blackout' : null);
  }, [index, running, fast, sim, step, finished, setHighlight]);
  useEffect(
    () => () => {
      worldState.storm = 0;
      worldState.opsSpeed = 1;
      setHighlight(null);
    },
    [setHighlight],
  );

  const confirm = (event: OpsEvent, choice: string) => {
    setDecision({ [event.id]: choice });
    setLog((l) => [{ day: step.day, event: event.id, choice }, ...l].slice(0, 4));
    setPending(null);
    setRunning(true);
  };

  const payload = COMPONENT_BY_ID[design.selections.payload];
  const linkState = finished ? 'COMPLETE' : step.safeMode ? t('ops.safe_mode') : step.blackout ? 'BLACKOUT' : t('ops.link_up');
  const linkTone = step.safeMode ? 'coral' : step.blackout ? 'amber' : 'cyan';
  const progress = Math.min(1, index / total);
  const marginTone = step.marginPct < 0 ? 'over' : step.marginPct < POWER_MARGIN_RULE ? 'tight' : 'ok';
  const storedTone = step.storedMb >= sim.capacityMb * 0.999 ? 'over' : step.storedMb > sim.capacityMb * 0.7 ? 'tight' : 'ok';
  const returnedSoFar = step.totalReturnedMb;
  const sciencePct = Math.min(100, (returnedSoFar / sim.plannedMb) * 100);

  return (
    <div className="ops" ref={ref}>
      <div className="ops__clock hit" data-reveal>
        <div className="eyebrow">{t('ops.mars_operations', { orbit: ORBIT_BY_ID[design.orbit].name })}</div>
        <div className="ops__date mono" data-testid="ops-date">{formatJd(step.jd)}</div>
        <div className="small muted">
          <T k="ops.science_day" params={{ day: Math.min(sim.timeline.scienceDays, step.day), total: sim.timeline.scienceDays, objective: OBJECTIVE_BY_ID[design.objective].name }} tags={{ b: (c) => <b className="mono" style={{ color: 'var(--text)' }}>{c}</b> }} />
        </div>
        <div className="xs dim">{t('ops.time_is_accelerated_for_play_one', { fast: STEPS_PER_SECOND * 2 * (fast ? 2.5 : 1) })}</div>
      </div>

      <div className="ops__left" data-reveal>
        <div className="panel hud" data-status={marginTone}>
          <div className="hud__head"><span className="eyebrow eyebrow--muted">{t('ops.power')}</span><span className={`xs mono status-${marginTone}`}>{step.safeMode ? t('ops.safe_mode') : step.powerMode === 'full' ? t('ops.full_ops') : step.powerMode === 'cycle' ? t('ops.duty_cycled') : t('ops.deep_saving')}</span></div>
          <div className="hud__value mono" data-testid="ops-power">{Math.round(step.marginW) >= 0 ? '+' : '−'}{Math.abs(Math.round(step.marginW))} <small>{t('ops.w_margin')}</small></div>
          <div className={`meter__bar meter--${marginTone}`}><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, step.consumptionW / step.availableW))})` }} /></div>
          <div className="hud__rows">
            <div><span>{t('ops.available')}</span><span>{Math.round(step.availableW)} W</span></div>
            <div><span>{t('ops.in_use')}</span><span>{Math.round(step.consumptionW)} W</span></div>
            <div><span>{t('ops.sun_distance')}{' '} <ProvenanceTag kind="verified_nasa_data" label={t('ops.jpl')} /></span><span>{t('u.au', { n: step.sunMarsAu.toFixed(3) })}</span></div>
          </div>
        </div>
        <div className="panel hud" data-status={storedTone}>
          <div className="hud__head"><span className="eyebrow eyebrow--muted">{t('ops.data_recorder')}</span><span className={`xs mono status-${storedTone}`}>{storedTone === 'over' ? t('ops.full_overwriting') : storedTone === 'tight' ? t('ops.filling') : t('ops.ok')}</span></div>
          <div className="hud__value mono" data-testid="ops-stored">{formatData(step.storedMb)} <small>/ {formatData(sim.capacityMb)}</small></div>
          <div className={`meter__bar meter--${storedTone}`}><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, step.storedMb / sim.capacityMb))})` }} /></div>
          <div className="hud__rows">
            <div><span>{t('ops.collecting')}</span><span>{t('u.mbday', { n: Math.round(step.generatedMb / sim.stepDays) })}</span></div>
            <div><span>{t('ops.link_can_carry')}</span><span>{t('u.mbday', { n: Math.round(step.downlinkCapacityMb / sim.stepDays) })}</span></div>
            <div><span>{t('ops.lost_so_far')}</span><span className={step.totalLostMb > 0 ? 'coral' : ''}>{formatData(step.totalLostMb)}</span></div>
          </div>
        </div>
      </div>

      <div className="ops__right" data-reveal>
        <div className="panel hud">
          <div className="hud__head"><span className="eyebrow eyebrow--muted">{t('ops.communications')}</span><span className={`xs mono ${linkTone}`} data-testid="ops-link">{linkState}</span></div>
          <div className="hud__value mono">{formatRate(step.rateKbps)}</div>
          <div className="hud__rows">
            <div><span><T k="ops.one_way_delay" tags={{ lt: (c) => <Term k="light time">{c}</Term> }} /></span><span data-testid="ops-lighttime">{formatLightTime(step.lightTimeS)}</span></div>
            <div><span>{t('ops.round_trip')}</span><span>{formatLightTime(roundTripS(step.lightTimeS))}</span></div>
            <div><span>{t('ops.earth_distance')}{' '} <ProvenanceTag kind="verified_nasa_data" label={t('ops.jpl')} /></span><span>{t('u.au', { n: step.earthMarsAu.toFixed(3) })}</span></div>
            {advanced && <div><span>{t('ops.sun_earth_mars_angle')}</span><span>{step.sepDeg.toFixed(1)}°</span></div>}
          </div>
        </div>
        <div className="panel hud">
          <div className="hud__head"><span className="eyebrow eyebrow--muted">{t('ops.science')}</span><span className="xs mono muted">{payload.short}</span></div>
          <div className="hud__value mono" data-testid="ops-science">{sciencePct.toFixed(0)} <small>{t('ops.of_planned_data_on_earth')}</small></div>
          <div className="meter__bar"><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, sciencePct / 100)})` }} /></div>
          <div className="hud__rows">
            <div><span>{t('ops.returned')}</span><span>{formatData(returnedSoFar)}</span></div>
            <div><span>{t('ops.planned_total')}</span><span>{formatData(sim.plannedMb)}</span></div>
          </div>
        </div>
        {log.length > 0 && (
          <div className="panel panel--plain hud">
            <div className="eyebrow eyebrow--muted">{t('ops.decision_log')}</div>
            {log.map((l) => (
              <div key={l.event} className="xs" style={{ marginTop: 6 }}>
                <span className="mono dim">{t('ops.day', { day: l.day })} </span>
                {EVENT_NAME[l.event]}: {CHOICES[l.event].find((c) => c.id === l.choice)?.title}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ops__bottom panel hit" data-reveal>
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => { sfx.click(); setRunning((r) => !r); }} disabled={!started || finished || !!pending} aria-label={running ? t('ops.pause') : t('ops.play')} data-testid="ops-play">
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => { sfx.click(); setFast((f) => !f); }} aria-pressed={fast} aria-label={t('ops.faster_playback')} title={t('ops.faster_playback')} data-testid="ops-fast">
            <FastForward size={18} />
          </button>
          <div className="track grow" aria-label={t('ops.mission_timeline')}>
            <span className="track__fill" style={{ transform: `scaleX(${progress})` }} />
            {sim.events.map((e, i) => (
              <span key={e.id} className={`track__event ${decided(e.id) ? 'is-done' : ''} ${i % 2 ? 'track__event--low' : ''}`} style={{ left: `${(e.promptStep / total) * 100}%` }} title={EVENT_NAME[e.id]}>
                <span className="track__label">{EVENT_NAME[e.id]}</span>
              </span>
            ))}
          </div>
          <span className="xs mono muted hide-mobile">{formatJd(sim.timeline.scienceEndJd)}</span>
        </div>
      </div>

      {!started && (
        <div className="ops__modal">
          <div className="panel dialog scroll" data-testid="ops-start">
            <div className="panel__body stack">
              <div className="eyebrow">{t('ops.kazmars_1_has_arrived', { scienceStartJd: formatJd(sim.timeline.scienceStartJd) })}</div>
              <h1 className="title">{t('ops.the_science_phase_begins')}</h1>
              <p className="muted">
                {t('ops.your_spacecraft_now_runs_for_days', { scienceDays: sim.timeline.scienceDays })}
              </p>
              <ul className="plain-list small">
                <li><T k="ops.gauge_power" /></li>
                <li><T k="ops.gauge_recorder" /></li>
                <li><T k="ops.gauge_comms" /></li>
                <li><T k="ops.gauge_science" /></li>
              </ul>
              <p className="xs muted">{t('ops.distances_signal_delay_and_the_march')}</p>
              <button type="button" className="btn btn--lg" onClick={() => { sfx.confirm(); setStarted(true); setRunning(true); }} data-testid="ops-begin">
                {t('ops.begin_operations')}{' '} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="ops__modal">
          <div className="panel panel--amber dialog scroll" role="alertdialog" aria-label={EVENT_NAME[pending.id]} data-testid={`ops-event-${pending.id}`}>
            <div className="panel__body stack">
              <EventBrief event={pending} sim={sim} step={step} />
              <TeamDecision testId="ops" choices={CHOICES[pending.id]} confirmLabel={t('ops.send_the_plan')} onConfirm={(id) => confirm(pending, id)} />
              {guided && <Coach who={HINT[pending.id].who}>{HINT[pending.id].text}</Coach>}
              <p className="xs muted">
                {t('ops.your_command_reaches_mars_after_you', { lightTimeS: formatLightTime(step.lightTimeS) })}
              </p>
            </div>
          </div>
        </div>
      )}

      {finished && (
        <div className="ops__modal">
          <div className="panel dialog" data-testid="ops-complete">
            <div className="panel__body stack">
              <div className="eyebrow">{t('ops.science_phase_complete', { scienceEndJd: formatJd(sim.timeline.scienceEndJd) })}</div>
              <h1 className="title">{t('ops.kazmars_1_has_finished_its_mission')}</h1>
              <p className="muted">
                {t('ops.complete_returned', { data: formatData(sim.returnedMb) })} {sim.lostMb > 0 ? t('ops.complete_lost', { data: formatData(sim.lostMb) }) : t('ops.complete_no_loss')} {sim.safeModeDays > 0 ? t('ops.complete_safe', { n: sim.safeModeDays }) : ''} {t('ops.complete_next')}
              </p>
              <button type="button" className="btn btn--lg" onClick={() => navigate('debrief')} data-testid="to-debrief">
                {t('ops.open_the_mission_debrief')}{' '} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CHOICES: Record<OpsEventId, Choice[]> = {
  conjunction: [
    { id: 'store', get title() { return t('ops.choices.conjunction.store.title'); }, get text() { return t('ops.choices.conjunction.store.text'); } },
    { id: 'reduce', get title() { return t('ops.choices.conjunction.reduce.title'); }, get text() { return t('ops.choices.conjunction.reduce.text'); } },
    { id: 'command', get title() { return t('ops.choices.conjunction.command.title'); }, get text() { return t('ops.choices.conjunction.command.text'); } },
  ],
  power: [
    { id: 'full', get title() { return t('ops.choices.power.full.title'); }, get text() { return t('ops.choices.power.full.text'); } },
    { id: 'cycle', get title() { return t('ops.choices.power.cycle.title'); }, get text() { return t('ops.choices.power.cycle.text'); } },
    { id: 'reserve', get title() { return t('ops.choices.power.reserve.title'); }, get text() { return t('ops.choices.power.reserve.text'); } },
  ],
  storm: [
    { id: 'campaign', get title() { return t('ops.choices.storm.campaign.title'); }, get text() { return t('ops.choices.storm.campaign.text', { STORM_DAYS }); } },
    { id: 'nominal', get title() { return t('ops.choices.storm.nominal.title'); }, get text() { return t('ops.choices.storm.nominal.text'); } },
    { id: 'protect', get title() { return t('ops.choices.storm.protect.title'); }, get text() { return t('ops.choices.storm.protect.text', { STORM_DAYS }); } },
  ],
};

const HINT: Record<OpsEventId, { who: 'arman' | 'dana'; text: string }> = {
  conjunction: { who: 'dana', get text() { return t('ops.hint.conjunction.text'); } },
  power: { who: 'arman', get text() { return t('ops.hint.power.text'); } },
  storm: { who: 'dana', get text() { return t('ops.hint.storm.text'); } },
};

function EventBrief({ event, sim, step }: { event: OpsEvent; sim: SimResult; step: SimStep }) {
  const days = (event.windowEnd - event.windowStart) * sim.stepDays;
  const perDay = sim.nominalDailyMb;
  const free = sim.capacityMb - step.storedMb;
  const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))} %`;
  if (event.id === 'conjunction') {
    return (
      <>
        <div className="eyebrow eyebrow--amber">{t('ops.decision_real_geometry_from_jpl_horizons')}</div>
        <h1 className="title">{t('ops.mars_is_about_to_pass_behind')}</h1>
        <p className="muted">
          <T k="ops.conj_text" params={{ date: formatJd(sim.steps[event.windowStart].jd), n: days }} tags={{ sc: (c) => <Term k="solar conjunction">{c}</Term> }} />
        </p>
        <div className="facts facts--compact">
          <div><dt>{t('ops.recorder_free_space')}</dt><dd>{formatData(free)}</dd></div>
          <div><dt>{t('ops.full_rate_data_in_the_blackout')}</dt><dd>{formatData(days * perDay)}</dd></div>
          <div><dt>{t('ops.recorder_capacity')}</dt><dd>{formatData(sim.capacityMb)}</dd></div>
          <div><dt>{t('ops.sun_earth_mars_angle_now')}</dt><dd>{step.sepDeg.toFixed(1)}°</dd></div>
        </div>
      </>
    );
  }
  if (event.id === 'power') {
    let far = event.windowStart;
    for (let i = event.windowStart; i < Math.min(event.windowEnd, sim.steps.length); i++) if (sim.steps[i].sunMarsAu > sim.steps[far].sunMarsAu) far = i;
    const f = sim.steps[far];
    return (
      <>
        <div className="eyebrow eyebrow--amber">{t('ops.decision_real_sun_distance_from_jpl')}</div>
        <h1 className="title">{t('ops.mars_is_moving_away_from_the')}</h1>
        <p className="muted">
          <T k="ops.power_text" params={{ date: formatJd(f.jd), au: f.sunMarsAu.toFixed(3) }} />
        </p>
        <div className="facts facts--compact">
          <div><dt>{t('ops.margin_now')}</dt><dd>{pct(step.marginPct)}</dd></div>
          <div><dt>{t('ops.forecast_at_the_farthest_point')}</dt><dd className={sim.worstFullMarginPct < POWER_MARGIN_RULE ? 'amber' : ''}>{pct(sim.worstFullMarginPct)}</dd></div>
          <div><dt>{t('ops.flight_rule')}</dt><dd>{t('ops.at_least_5')}</dd></div>
          <div><dt>{t('ops.season_length')}</dt><dd>{t('u.days', { n: days })}</dd></div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="eyebrow eyebrow--amber">{t('ops.decision_fictional_gameplay_event')}</div>
      <h1 className="title">{t('ops.a_regional_dust_storm_is_growing')}</h1>
      <p className="muted">
        {t('ops.dust_is_lifting_across_the_southern', { STORM_DAYS })}
      </p>
      <div className="facts facts--compact">
        <div><dt>{t('ops.recorder_free_space')}</dt><dd>{formatData(free)}</dd></div>
        <div><dt>{t('ops.link_can_carry')}</dt><dd>{t('u.mbday', { n: Math.round(step.downlinkCapacityMb / sim.stepDays) })}</dd></div>
        <div><dt>{t('ops.normal_data_rate')}</dt><dd>{t('u.mbday', { n: Math.round(perDay) })}</dd></div>
        <div><dt>{t('ops.campaign_data_rate')}</dt><dd>{t('u.mbday', { n: Math.round(perDay * 1.8) })}</dd></div>
      </div>
    </>
  );
}
