import gsap from 'gsap';
import { ArrowLeft, ArrowRight, Battery, Radio, Rocket, Telescope, Weight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { navigate } from '@/app/navigation';
import { sfx } from '@/audio/sound';
import { Speech } from '@/components/Avatar';
import { TeamSetup } from '@/components/Panels';
import { ProvenanceTag, Term } from '@/components/Tags';
import { TeamDecision } from '@/components/TeamDecision';
import { GAME } from '@/data/constants';
import { LAUNCH_VEHICLES } from '@/data/launchVehicles';
import { MCS_REFERENCE } from '@/data/nasa/sources';
import { OBJECTIVES } from '@/data/objectives';
import { formatLightTime, roundTripS } from '@/game/engine/comms';
import { propellantForDeltaV } from '@/game/engine/mass';
import { solarIrradianceWm2 } from '@/game/engine/power';
import { useGame } from '@/game/state/store';
import { useLightTime } from '@/hooks/useLightTime';
import { useReveal } from '@/hooks/useReveal';
import type { ObjectiveId } from '@/types';

const STEPS = ['The mission', 'Five things to know', 'Your science focus'];

export default function MissionBriefing() {
  const [step, setStep] = useState(0);
  const ref = useReveal<HTMLDivElement>(step, 0.1);
  const go = (n: number) => {
    sfx.click();
    setStep(n);
  };
  return (
    <div className="briefing scroll hit" ref={ref}>
      <div className="briefing__col">
        <div className="row row--wrap" data-reveal style={{ gap: 14 }}>
          <span className="eyebrow">Mission briefing · KAZMARS-1</span>
          <div className="steps" aria-label="Briefing steps">
            {STEPS.map((s, i) => (
              <button key={s} type="button" className={`steps__dot ${i === step ? 'is-current' : i < step ? 'is-done' : ''}`} onClick={() => go(i)} aria-label={`${i + 1}. ${s}`} aria-current={i === step} />
            ))}
            <span className="xs mono muted">
              {step + 1}/3 · {STEPS[step]}
            </span>
          </div>
        </div>
        {step === 0 && <StepMission onNext={() => go(1)} />}
        {step === 1 && <StepTutorial onBack={() => go(0)} onNext={() => go(2)} />}
        {step === 2 && <StepFocus onBack={() => go(1)} />}
      </div>
    </div>
  );
}

function StepMission({ onNext }: { onNext: () => void }) {
  const { reading } = useLightTime();
  return (
    <>
      <h1 className="display" data-reveal>
        Study the dust and climate of Mars.
      </h1>
      <p className="lead" data-reveal>
        You are the Mission Director of <b>KAZMARS-1</b>, a student-designed orbiter. Your goal: study Martian atmospheric dust and climate variability using a
        scientific orbiter — the kind of science NASA’s Mars Climate Sounder does from Mars Reconnaissance Orbiter.
      </p>
      <dl className="facts" data-reveal>
        <div>
          <dt>Launch window</dt>
          <dd>November 2026</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>
            {GAME.budgetCapCr} credits <ProvenanceTag kind="educational_game_assumption" />
          </dd>
        </div>
        <div>
          <dt>Mission length</dt>
          <dd>Up to one Mars year of science</dd>
        </div>
        <div>
          <dt>Signal delay today</dt>
          <dd>
            {formatLightTime(reading.oneWayLightTimeS)} one way <ProvenanceTag kind="verified_nasa_data" label={reading.status === 'live' ? 'JPL · LIVE' : 'JPL · CACHED'} />
          </dd>
        </div>
      </dl>
      <div className="briefing__grid" data-reveal>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Science priorities</div>
          <ul className="plain-list">
            <li>How dust moves through the atmosphere</li>
            <li>How temperature and ice change with the seasons</li>
            <li>How weather builds up from day to day</li>
          </ul>
        </div>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">Engineering limits</div>
          <ul className="plain-list">
            <li>The rocket can only lift so much mass</li>
            <li>Sunlight at Mars is weak, so power is scarce</li>
            <li>Data only counts once it reaches Earth</li>
          </ul>
        </div>
      </div>
      <div className="panel" data-reveal>
        <div className="panel__body stack">
          <div className="eyebrow eyebrow--muted">Your training crew</div>
          <Speech who="arman">
            I’m Arman. I look after the hardware — mass, power, anything that can break. If a number looks wrong, I want to know why before we go anywhere.
          </Speech>
          <Speech who="dana">
            And I’m Dana — telemetry and data. A strange number isn’t always a broken part. Sometimes the measurement is the problem. We… don’t always agree.
          </Speech>
          <p className="xs muted">
            Arman and Dana are trainees in a fictional international student aerospace programme at a training centre associated with the Baikonur Cosmodrome.
            Every countdown here is a simulation. An adult Flight Director keeps authority over launch safety.
          </p>
        </div>
      </div>
      <div className="row row--wrap" data-reveal>
        <button type="button" className="btn btn--lg" onClick={onNext} data-testid="briefing-next">
          Continue <ArrowRight size={16} />
        </button>
        <button type="button" className="link-btn small" onClick={() => navigate('designer')} data-testid="briefing-skip">
          Skip the briefing — I’ve played before
        </button>
      </div>
    </>
  );
}

const TOPICS = [
  { id: 'mass', label: 'Mass', icon: <Weight size={15} /> },
  { id: 'power', label: 'Power', icon: <Battery size={15} /> },
  { id: 'instruments', label: 'Instruments', icon: <Telescope size={15} /> },
  { id: 'delay', label: 'Signal delay', icon: <Radio size={15} /> },
  { id: 'launch', label: 'Launch capacity', icon: <Rocket size={15} /> },
] as const;
type TopicId = (typeof TOPICS)[number]['id'];

function StepTutorial({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [topic, setTopic] = useState<TopicId>('mass');
  const [seen, setSeen] = useState<TopicId[]>(['mass']);
  const pick = (id: TopicId) => {
    sfx.click();
    setTopic(id);
    setSeen((s) => (s.includes(id) ? s : [...s, id]));
  };
  const index = TOPICS.findIndex((t) => t.id === topic);
  return (
    <>
      <h1 className="display" data-reveal>
        Five ideas that decide every mission.
      </h1>
      <p className="lead" data-reveal>
        Try each one — it takes a minute. You will use all five in the design bay.
      </p>
      <div className="tabs" role="tablist" data-reveal>
        {TOPICS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={topic === t.id} className={`tab ${seen.includes(t.id) ? 'is-seen' : ''}`} onClick={() => pick(t.id)} data-testid={`topic-${t.id}`}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="panel" data-reveal>
        <div className="panel__body">
          {topic === 'mass' && <MassLesson />}
          {topic === 'power' && <PowerLesson />}
          {topic === 'instruments' && <InstrumentLesson />}
          {topic === 'delay' && <DelayLesson />}
          {topic === 'launch' && <LaunchLesson />}
        </div>
      </div>
      <div className="row row--wrap" data-reveal>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        {index < TOPICS.length - 1 ? (
          <button type="button" className="btn btn--lg" onClick={() => pick(TOPICS[index + 1].id)} data-testid="topic-next">
            Next idea <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn--lg" onClick={onNext} data-testid="tutorial-done">
            Choose the science focus <ArrowRight size={16} />
          </button>
        )}
        {index < TOPICS.length - 1 && (
          <button type="button" className="link-btn small" onClick={onNext} data-testid="tutorial-skip">
            Skip the tutorial
          </button>
        )}
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="slider">
      <span className="row row--between">
        <span className="eyebrow eyebrow--muted">{label}</span>
        <span className="mono">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Bar({ label, value, max, text, tone = 'cyan' }: { label: string; value: number; max: number; text: string; tone?: 'cyan' | 'amber' | 'coral' }) {
  return (
    <div className="lesson-bar">
      <span className="small muted">{label}</span>
      <span className="lesson-bar__track">
        <span className={`lesson-bar__fill lesson-bar__fill--${tone}`} style={{ transform: `scaleX(${Math.max(0.01, Math.min(1, value / max))})` }} />
      </span>
      <span className="mono small">{text}</span>
    </div>
  );
}

function MassLesson() {
  const [extra, setExtra] = useState(0);
  const dry = 314 + extra;
  const prop = propellantForDeltaV(dry, 1.57, 318) * GAME.propellantReserveFactor;
  const base = propellantForDeltaV(314, 1.57, 318) * GAME.propellantReserveFactor;
  return (
    <div className="stack">
      <h3 className="subtitle">Mass: every kilogram costs propellant</h3>
      <p className="muted">
        Mass is how much “stuff” your spacecraft is made of. To slow down into Mars orbit the engine must burn propellant — and a heavier spacecraft needs
        more. Add equipment and watch the total climb faster than you would expect.
      </p>
      <Slider label="Add equipment" value={extra} min={0} max={80} step={5} onChange={setExtra} format={(v) => `+${v} kg`} />
      <Bar label="Spacecraft (dry)" value={dry} max={700} text={`${dry} kg`} />
      <Bar label="Propellant needed" value={prop} max={700} text={`${Math.round(prop)} kg`} tone="amber" />
      <Bar label="Total at launch" value={dry + prop} max={700} text={`${Math.round(dry + prop)} kg`} />
      <p className="small">
        {extra === 0 ? 'Move the slider.' : `+${extra} kg of equipment became +${Math.round(extra + prop - base)} kg at launch.`}{' '}
        <span className="muted">Example for a low Mars orbit · illustrative game values.</span>
      </p>
    </div>
  );
}

function PowerLesson() {
  const [au, setAu] = useState(1);
  const w = solarIrradianceWm2(au);
  return (
    <div className="stack">
      <h3 className="subtitle">Power: sunlight fades with distance</h3>
      <p className="muted">
        Everything on board runs on electricity from solar panels. Move twice as far from the Sun and the light becomes four times weaker — the{' '}
        <b>inverse-square law</b>.
      </p>
      <Slider label="Distance from the Sun" value={au} min={1} max={1.67} step={0.01} onChange={setAu} format={(v) => `${v.toFixed(2)} AU`} />
      <Bar label="Sunlight on each m²" value={w} max={1361} text={`${Math.round(w)} W/m²`} tone={w < 700 ? 'amber' : 'cyan'} />
      <div className="row row--wrap small">
        <button type="button" className="tag" onClick={() => setAu(1)}>Earth · 1.00 AU</button>
        <button type="button" className="tag" onClick={() => setAu(1.38)}>Mars nearest · 1.38 AU</button>
        <button type="button" className="tag" onClick={() => setAu(1.52)}>Mars average · 1.52 AU</button>
        <button type="button" className="tag" onClick={() => setAu(1.67)}>Mars farthest · 1.67 AU</button>
      </div>
      <p className="small">
        At {au.toFixed(2)} <Term k="AU" /> a panel collects <b>{Math.round((w / 1361) * 100)} %</b> of what it would at Earth.{' '}
        <span className="muted">Mars’ distances come from JPL Horizons; 1361 W/m² is the standard value at 1 AU.</span>
      </p>
    </div>
  );
}

function InstrumentLesson() {
  const [view, setView] = useState<'sounder' | 'imager'>('sounder');
  return (
    <div className="stack">
      <h3 className="subtitle">Instruments: the reason the mission exists</h3>
      <p className="muted">Instruments turn light into measurements. Different instruments answer different questions about the same atmosphere.</p>
      <div className="segmented" role="group" aria-label="Instrument type">
        <button type="button" aria-pressed={view === 'sounder'} onClick={() => setView('sounder')}>
          Limb sounder
        </button>
        <button type="button" aria-pressed={view === 'imager'} onClick={() => setView('imager')}>
          Weather imager
        </button>
      </div>
      <div className="instrument-demo">
        <svg viewBox="0 0 220 120" role="img" aria-label={view === 'sounder' ? 'A sounder looks sideways through the layers of the atmosphere' : 'An imager looks straight down to map the planet'}>
          <path d="M-20 150 A150 150 0 0 1 240 150" fill="#8a3f22" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${-20 - i * 7} 150 A${150 + i * 7} ${150 + i * 7} 0 0 1 ${240 + i * 7} 150`} fill="none" stroke="#e9a37a" strokeOpacity={0.5 - i * 0.1} strokeWidth="5" />
          ))}
          {view === 'sounder' ? (
            <>
              <rect x="14" y="18" width="16" height="10" fill="#52D7E8" />
              <path d="M30 23 L205 34 L205 62 Z" fill="#52D7E8" opacity="0.22" />
              <path d="M30 23 L205 48" stroke="#52D7E8" strokeDasharray="3 3" />
              <text x="120" y="20" className="svg-label">sideways, through the layers</text>
            </>
          ) : (
            <>
              <rect x="102" y="6" width="16" height="10" fill="#FFB84D" />
              <path d="M110 16 L50 78 L170 78 Z" fill="#FFB84D" opacity="0.2" />
              <text x="110" y="100" className="svg-label" textAnchor="middle">
                straight down, a wide map
              </text>
            </>
          )}
        </svg>
        <div className="stack stack--sm small">
          {view === 'sounder' ? (
            <>
              <p>
                A sounder measures how temperature, dust and ice change with <b>height</b> — one vertical slice at a time.
              </p>
              <p className="muted">
                Real example: NASA’s {MCS_REFERENCE.name}. Mass {MCS_REFERENCE.massQuote}; power {MCS_REFERENCE.powerQuote}. It measures{' '}
                {MCS_REFERENCE.measures.join(', ')}. <ProvenanceTag kind="verified_mission_reference" />
              </p>
            </>
          ) : (
            <>
              <p>
                An imager photographs the whole planet to map <b>where</b> dust storms and clouds are, day by day.
              </p>
              <p className="muted">
                Pictures are large: the game’s imager produces about six times more data than its sounder. <ProvenanceTag kind="educational_game_assumption" />
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DelayLesson() {
  const { reading } = useLightTime();
  const dot = useRef<SVGCircleElement>(null);
  const [phase, setPhase] = useState<'idle' | 'out' | 'back' | 'done'>('idle');
  const reduced = useGame((s) => s.settings.reducedMotion);
  const send = () => {
    if (!dot.current || phase === 'out' || phase === 'back') return;
    sfx.select();
    const d = reduced ? 0.01 : 2;
    setPhase('out');
    gsap
      .timeline({ onComplete: () => setPhase('done') })
      .fromTo(dot.current, { attr: { cx: 24 }, opacity: 1 }, { attr: { cx: 276 }, duration: d, ease: 'none' })
      .call(() => setPhase('back'))
      .to(dot.current, { attr: { cx: 24 }, duration: d, ease: 'none' });
  };
  return (
    <div className="stack">
      <h3 className="subtitle">Signal delay: Mars cannot be flown with a joystick</h3>
      <p className="muted">
        Radio travels at the speed of light, and Mars is far. Right now a command takes <b>{formatLightTime(reading.oneWayLightTimeS)}</b> to arrive, and the
        answer needs the same time to come back.
      </p>
      <svg viewBox="0 0 300 60" className="delay-track" role="img" aria-label="Signal travelling between Earth and Mars">
        <line x1="24" y1="30" x2="276" y2="30" stroke="#94b2d6" strokeOpacity="0.3" strokeDasharray="2 5" />
        <circle cx="24" cy="30" r="11" fill="#2f7fd0" />
        <circle cx="276" cy="30" r="8" fill="#c4673f" />
        <circle ref={dot} cx="24" cy="30" r="4" fill="#52D7E8" opacity="0" />
        <text x="24" y="56" className="svg-label" textAnchor="middle">Earth</text>
        <text x="276" y="56" className="svg-label" textAnchor="middle">Mars</text>
      </svg>
      <div className="row row--wrap">
        <button type="button" className="btn btn--sm" onClick={send} data-testid="send-command">
          Send a command
        </button>
        <span className="small mono">
          {phase === 'idle' && 'Ready.'}
          {phase === 'out' && `Command on its way… (${formatLightTime(reading.oneWayLightTimeS)})`}
          {phase === 'back' && `Answer on its way… (${formatLightTime(reading.oneWayLightTimeS)})`}
          {phase === 'done' && `Round trip: ${formatLightTime(roundTripS(reading.oneWayLightTimeS))}`}
        </span>
      </div>
      <div className="small muted">
        <ProvenanceTag kind="verified_nasa_data" label={reading.status === 'live' ? 'JPL Horizons · live' : 'JPL Horizons · cached'} /> One-way{' '}
        <Term k="light time" /> for {reading.epochIso}: {reading.oneWayLightTimeS.toFixed(1)} s over {(reading.rangeKm / 1e6).toFixed(1)} million km. The
        animation is sped up for play — the real wait is shown in the text.
      </div>
    </div>
  );
}

function LaunchLesson() {
  const [mass, setMass] = useState(520);
  return (
    <div className="stack">
      <h3 className="subtitle">Launch capacity: the rocket sets the limit</h3>
      <p className="muted">Each launch vehicle can push only so much mass toward Mars. A bigger rocket lifts more — and takes more of your budget.</p>
      <Slider label="Spacecraft mass with propellant" value={mass} min={380} max={980} step={10} onChange={setMass} format={(v) => `${v} kg`} />
      {LAUNCH_VEHICLES.map((v) => {
        const fits = mass <= v.capacityKg;
        return <Bar key={v.id} label={`${v.name} · ${v.costCr} cr`} value={mass} max={v.capacityKg} tone={fits ? 'cyan' : 'coral'} text={fits ? `fits · ${v.capacityKg - mass} kg spare` : `too heavy by ${mass - v.capacityKg} kg`} />;
      })}
      <p className="small muted">
        The Tulpar rockets are fictional vehicles invented for this game. <ProvenanceTag kind="educational_game_assumption" />
      </p>
    </div>
  );
}

function StepFocus({ onBack }: { onBack: () => void }) {
  const objective = useGame((s) => s.design.objective);
  const setObjective = useGame((s) => s.setObjective);
  const mode = useGame((s) => s.settings.mode);
  const setSettings = useGame((s) => s.setSettings);
  const choices = useMemo(
    () => OBJECTIVES.map((o) => ({ id: o.id, title: o.name, kicker: o.question, text: `${o.description} ${o.needs}` })),
    [],
  );
  return (
    <>
      <h1 className="display" data-reveal>
        What should KAZMARS-1 find out?
      </h1>
      <p className="lead" data-reveal>
        Define the objective before you design anything. It decides which instruments, orbit and mission length are worth their cost — there is no single best
        spacecraft.
      </p>
      <div className="briefing__grid" data-reveal>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">How much help do you want?</div>
          <div className="segmented" role="group" aria-label="Game mode">
            <button type="button" aria-pressed={mode === 'guided'} onClick={() => setSettings({ mode: 'guided' })} data-testid="mode-guided">
              Guided
            </button>
            <button type="button" aria-pressed={mode === 'advanced'} onClick={() => setSettings({ mode: 'advanced' })} data-testid="mode-advanced">
              Advanced
            </button>
          </div>
          <p className="xs muted">{mode === 'guided' ? 'Arman and Dana explain each decision and suggest sensible options.' : 'Adds formulas, assumptions and raw data. No suggestions.'}</p>
        </div>
        <TeamSetup />
      </div>
      <div data-reveal>
        <TeamDecision
          testId="objective"
          choices={choices}
          initial={objective}
          confirmLabel="Enter the design bay"
          onConfirm={(id) => {
            setObjective(id as ObjectiveId);
            navigate('designer');
          }}
        />
      </div>
      <div data-reveal>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    </>
  );
}
