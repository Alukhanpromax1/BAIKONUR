import { ArrowRight, FastForward, Pause, Play } from 'lucide-react';
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

const EVENT_NAME: Record<OpsEventId, string> = { conjunction: 'Solar conjunction', power: 'Low-power season', storm: 'Dust storm' };

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
  const [log, setLog] = useState<{ day: number; text: string }[]>([]);
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
    setLog((l) => [{ day: step.day, text: `${EVENT_NAME[event.id]}: ${CHOICES[event.id].find((c) => c.id === choice)?.title}` }, ...l].slice(0, 4));
    setPending(null);
    setRunning(true);
  };

  const payload = COMPONENT_BY_ID[design.selections.payload];
  const linkState = finished ? 'COMPLETE' : step.safeMode ? 'SAFE MODE' : step.blackout ? 'BLACKOUT' : 'LINK UP';
  const linkTone = step.safeMode ? 'coral' : step.blackout ? 'amber' : 'cyan';
  const progress = Math.min(1, index / total);
  const marginTone = step.marginPct < 0 ? 'over' : step.marginPct < POWER_MARGIN_RULE ? 'tight' : 'ok';
  const storedTone = step.storedMb >= sim.capacityMb * 0.999 ? 'over' : step.storedMb > sim.capacityMb * 0.7 ? 'tight' : 'ok';
  const returnedSoFar = step.totalReturnedMb;
  const sciencePct = Math.min(100, (returnedSoFar / sim.plannedMb) * 100);

  return (
    <div className="ops" ref={ref}>
      <div className="ops__clock hit" data-reveal>
        <div className="eyebrow">Mars operations · {ORBIT_BY_ID[design.orbit].name}</div>
        <div className="ops__date mono" data-testid="ops-date">{formatJd(step.jd)}</div>
        <div className="small muted">
          Science day <b className="mono" style={{ color: 'var(--text)' }}>{Math.min(sim.timeline.scienceDays, step.day)}</b> of {sim.timeline.scienceDays} · {OBJECTIVE_BY_ID[design.objective].name}
        </div>
        <div className="xs dim">Time is accelerated for play: one second ≈ {STEPS_PER_SECOND * 2 * (fast ? 2.5 : 1)} days. Simplified educational orbit, not to scale.</div>
      </div>

      <div className="ops__left" data-reveal>
        <div className="panel hud" data-status={marginTone}>
          <div className="hud__head"><span className="eyebrow eyebrow--muted">Power</span><span className={`xs mono status-${marginTone}`}>{step.safeMode ? 'SAFE MODE' : step.powerMode === 'full' ? 'FULL OPS' : step.powerMode === 'cycle' ? 'DUTY-CYCLED' : 'DEEP SAVING'}</span></div>
          <div className="hud__value mono" data-testid="ops-power">{Math.round(step.marginW) >= 0 ? '+' : '−'}{Math.abs(Math.round(step.marginW))} <small>W margin</small></div>
          <div className={`meter__bar meter--${marginTone}`}><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, step.consumptionW / step.availableW))})` }} /></div>
          <div className="hud__rows">
            <div><span>Available</span><span>{Math.round(step.availableW)} W</span></div>
            <div><span>In use</span><span>{Math.round(step.consumptionW)} W</span></div>
            <div><span>Sun distance <ProvenanceTag kind="verified_nasa_data" label="JPL" /></span><span>{step.sunMarsAu.toFixed(3)} AU</span></div>
          </div>
        </div>
        <div className="panel hud" data-status={storedTone}>
          <div className="hud__head"><span className="eyebrow eyebrow--muted">Data recorder</span><span className={`xs mono status-${storedTone}`}>{storedTone === 'over' ? 'FULL — OVERWRITING' : storedTone === 'tight' ? 'FILLING' : 'OK'}</span></div>
          <div className="hud__value mono" data-testid="ops-stored">{formatData(step.storedMb)} <small>/ {formatData(sim.capacityMb)}</small></div>
          <div className={`meter__bar meter--${storedTone}`}><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, step.storedMb / sim.capacityMb))})` }} /></div>
          <div className="hud__rows">
            <div><span>Collecting</span><span>{Math.round(step.generatedMb / sim.stepDays)} Mb/day</span></div>
            <div><span>Link can carry</span><span>{Math.round(step.downlinkCapacityMb / sim.stepDays)} Mb/day</span></div>
            <div><span>Lost so far</span><span className={step.totalLostMb > 0 ? 'coral' : ''}>{formatData(step.totalLostMb)}</span></div>
          </div>
        </div>
      </div>

      <div className="ops__right" data-reveal>
        <div className="panel hud">
          <div className="hud__head"><span className="eyebrow eyebrow--muted">Communications</span><span className={`xs mono ${linkTone}`} data-testid="ops-link">{linkState}</span></div>
          <div className="hud__value mono">{formatRate(step.rateKbps)}</div>
          <div className="hud__rows">
            <div><span>One-way <Term k="light time">signal delay</Term></span><span data-testid="ops-lighttime">{formatLightTime(step.lightTimeS)}</span></div>
            <div><span>Round trip</span><span>{formatLightTime(roundTripS(step.lightTimeS))}</span></div>
            <div><span>Earth distance <ProvenanceTag kind="verified_nasa_data" label="JPL" /></span><span>{step.earthMarsAu.toFixed(3)} AU</span></div>
            {advanced && <div><span>Sun–Earth–Mars angle</span><span>{step.sepDeg.toFixed(1)}°</span></div>}
          </div>
        </div>
        <div className="panel hud">
          <div className="hud__head"><span className="eyebrow eyebrow--muted">Science</span><span className="xs mono muted">{payload.short}</span></div>
          <div className="hud__value mono" data-testid="ops-science">{sciencePct.toFixed(0)} <small>% of planned data on Earth</small></div>
          <div className="meter__bar"><span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, sciencePct / 100)})` }} /></div>
          <div className="hud__rows">
            <div><span>Returned</span><span>{formatData(returnedSoFar)}</span></div>
            <div><span>Planned total</span><span>{formatData(sim.plannedMb)}</span></div>
          </div>
        </div>
        {log.length > 0 && (
          <div className="panel panel--plain hud">
            <div className="eyebrow eyebrow--muted">Decision log</div>
            {log.map((l) => (
              <div key={l.text} className="xs" style={{ marginTop: 6 }}>
                <span className="mono dim">Day {l.day} · </span>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ops__bottom panel hit" data-reveal>
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => { sfx.click(); setRunning((r) => !r); }} disabled={!started || finished || !!pending} aria-label={running ? 'Pause' : 'Play'} data-testid="ops-play">
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => { sfx.click(); setFast((f) => !f); }} aria-pressed={fast} aria-label="Faster playback" title="Faster playback" data-testid="ops-fast">
            <FastForward size={18} />
          </button>
          <div className="track grow" aria-label="Mission timeline">
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
              <div className="eyebrow">KAZMARS-1 has arrived · {formatJd(sim.timeline.scienceStartJd)}</div>
              <h1 className="title">The science phase begins</h1>
              <p className="muted">
                Your spacecraft now runs for {sim.timeline.scienceDays} days in accelerated time. Three situations will need a decision from you. Each depends on
                what you built — so read the gauges before you choose.
              </p>
              <ul className="plain-list small">
                <li><b>Power</b> — margin between what the arrays deliver and what the spacecraft uses.</li>
                <li><b>Data recorder</b> — how full the on-board memory is.</li>
                <li><b>Communications</b> — link speed and the real Earth–Mars signal delay.</li>
                <li><b>Science</b> — how much of the planned data has reached Earth.</li>
              </ul>
              <p className="xs muted">Distances, signal delay and the March 2028 solar conjunction come from NASA/JPL Horizons (cached snapshot). Everything else is a simplified educational model.</p>
              <button type="button" className="btn btn--lg" onClick={() => { sfx.confirm(); setStarted(true); setRunning(true); }} data-testid="ops-begin">
                Begin operations <ArrowRight size={16} />
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
              <TeamDecision testId="ops" choices={CHOICES[pending.id]} confirmLabel="Send the plan" onConfirm={(id) => confirm(pending, id)} />
              {guided && <Coach who={HINT[pending.id].who}>{HINT[pending.id].text}</Coach>}
              <p className="xs muted">
                Your command reaches Mars {formatLightTime(step.lightTimeS)} after you send it, and the confirmation takes as long to return — so the spacecraft
                must already hold a safe plan.
              </p>
            </div>
          </div>
        </div>
      )}

      {finished && (
        <div className="ops__modal">
          <div className="panel dialog" data-testid="ops-complete">
            <div className="panel__body stack">
              <div className="eyebrow">Science phase complete · {formatJd(sim.timeline.scienceEndJd)}</div>
              <h1 className="title">KAZMARS-1 has finished its mission</h1>
              <p className="muted">
                {formatData(sim.returnedMb)} of data reached Earth{sim.lostMb > 0 ? `, ${formatData(sim.lostMb)} was lost on board` : ' and nothing was lost'}
                {sim.safeModeDays > 0 ? `, and ${sim.safeModeDays} days were spent in safe mode` : ''}. Time to see what it all added up to.
              </p>
              <button type="button" className="btn btn--lg" onClick={() => navigate('debrief')} data-testid="to-debrief">
                Open the mission debrief <ArrowRight size={16} />
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
    { id: 'store', title: 'Keep observing and store everything', text: 'Record at the full rate and send it all after the blackout. Works only if the recorder is big enough.' },
    { id: 'reduce', title: 'Observe less during the blackout', text: 'Keep only the most valuable 40 % of observations so the recorder does not overflow.' },
    { id: 'command', title: 'Keep commanding through the blackout', text: 'Try to stay in contact anyway, sending commands past the Sun.' },
  ],
  power: [
    { id: 'full', title: 'Continue full operations', text: 'Change nothing. Right if the margin stays above the 5 % flight rule.' },
    { id: 'cycle', title: 'Duty-cycle instruments and radio', text: 'Use 12 % less power. Costs about 30 % of the data during this season.' },
    { id: 'reserve', title: 'Deep power saving', text: 'Use 22 % less power. Costs about 70 % of the data during this season.' },
  ],
  storm: [
    { id: 'campaign', title: 'Run a high-rate storm campaign', text: `Collect 1.8× the data for ${STORM_DAYS} days. Great science — if the link and recorder can take it.` },
    { id: 'nominal', title: 'Continue the normal plan', text: 'Observe the storm at the usual rate.' },
    { id: 'protect', title: 'Cut data to protect the recorder', text: `Halve the data rate for ${STORM_DAYS} days to keep memory free.` },
  ],
};

const HINT: Record<OpsEventId, { who: 'arman' | 'dana'; text: string }> = {
  conjunction: { who: 'dana', text: 'Compare the free space on the recorder with what a full-rate blackout would produce. If it fits, store it. If not, choose what to keep.' },
  power: { who: 'arman', text: 'Flight rule: at least 5 % margin. Pick the gentlest mode that still keeps it — saving more than you need throws science away.' },
  storm: { who: 'dana', text: 'Extra data only counts if it gets home. Is the link carrying more than we collect, and is there room on the recorder?' },
};

function EventBrief({ event, sim, step }: { event: OpsEvent; sim: SimResult; step: SimStep }) {
  const days = (event.windowEnd - event.windowStart) * sim.stepDays;
  const perDay = sim.nominalDailyMb;
  const free = sim.capacityMb - step.storedMb;
  const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))} %`;
  if (event.id === 'conjunction') {
    return (
      <>
        <div className="eyebrow eyebrow--amber">Decision · real geometry from JPL Horizons</div>
        <h1 className="title">Mars is about to pass behind the Sun</h1>
        <p className="muted">
          From {formatJd(sim.steps[event.windowStart].jd)}, for about <b>{days} days</b>, the Sun sits almost directly between Earth and Mars. Its hot outer
          atmosphere scrambles radio signals: this is <Term k="solar conjunction" />.
        </p>
        <div className="facts facts--compact">
          <div><dt>Recorder free space</dt><dd>{formatData(free)}</dd></div>
          <div><dt>Full-rate data in the blackout</dt><dd>{formatData(days * perDay)}</dd></div>
          <div><dt>Recorder capacity</dt><dd>{formatData(sim.capacityMb)}</dd></div>
          <div><dt>Sun–Earth–Mars angle now</dt><dd>{step.sepDeg.toFixed(1)}°</dd></div>
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
        <div className="eyebrow eyebrow--amber">Decision · real Sun distance from JPL Horizons</div>
        <h1 className="title">Mars is moving away from the Sun</h1>
        <p className="muted">
          Around {formatJd(f.jd)} Mars reaches <b>{f.sunMarsAu.toFixed(3)} AU</b> — the farthest point of this mission. Sunlight, and your solar power, fall
          with the square of that distance.
        </p>
        <div className="facts facts--compact">
          <div><dt>Margin now</dt><dd>{pct(step.marginPct)}</dd></div>
          <div><dt>Forecast at the farthest point</dt><dd className={sim.worstFullMarginPct < POWER_MARGIN_RULE ? 'amber' : ''}>{pct(sim.worstFullMarginPct)}</dd></div>
          <div><dt>Flight rule</dt><dd>at least +5 %</dd></div>
          <div><dt>Season length</dt><dd>{days} days</dd></div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="eyebrow eyebrow--amber">Decision · fictional gameplay event</div>
      <h1 className="title">A regional dust storm is growing</h1>
      <p className="muted">
        Dust is lifting across the southern hemisphere — exactly what KAZMARS-1 came to study. For the next {STORM_DAYS} days you could observe far more often
        than planned.
      </p>
      <div className="facts facts--compact">
        <div><dt>Recorder free space</dt><dd>{formatData(free)}</dd></div>
        <div><dt>Link can carry</dt><dd>{Math.round(step.downlinkCapacityMb / sim.stepDays)} Mb/day</dd></div>
        <div><dt>Normal data rate</dt><dd>{Math.round(perDay)} Mb/day</dd></div>
        <div><dt>Campaign data rate</dt><dd>{Math.round(perDay * 1.8)} Mb/day</dd></div>
      </div>
    </>
  );
}
