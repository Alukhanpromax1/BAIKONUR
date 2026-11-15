import gsap from 'gsap';
import { t } from '@/i18n';
import { T } from '@/i18n/Trans';
import { ArrowLeft, ArrowRight, Battery, Radio, Rocket, Telescope, Weight } from 'lucide-react';
import { useRef, useState } from 'react';
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

const STEPS = ['briefing.step.mission', 'briefing.step.ideas', 'briefing.step.focus'] as const;

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
          <span className="eyebrow">{t('briefing.mission_briefing_kazmars_1')}</span>
          <div className="steps" aria-label={t('briefing.briefing_steps')}>
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
        {t('briefing.study_the_dust_and_climate_of')}
      </h1>
      <p className="lead" data-reveal>
        <T k="briefing.lead" />
      </p>
      <dl className="facts" data-reveal>
        <div>
          <dt>{t('briefing.launch_window')}</dt>
          <dd>{t('briefing.november_2026')}</dd>
        </div>
        <div>
          <dt>{t('briefing.budget')}</dt>
          <dd>
            {t('u.credits', { n: GAME.budgetCapCr })}{' '} <ProvenanceTag kind="educational_game_assumption" />
          </dd>
        </div>
        <div>
          <dt>{t('briefing.mission_length')}</dt>
          <dd>{t('briefing.up_to_one_mars_year_of')}</dd>
        </div>
        <div>
          <dt>{t('briefing.signal_delay_today')}</dt>
          <dd>
            {t('briefing.one_way', { oneWayLightTimeS: formatLightTime(reading.oneWayLightTimeS) })}{' '} <ProvenanceTag kind="verified_nasa_data" label={reading.status === 'live' ? t('briefing.jpl_live') : t('briefing.jpl_cached')} />
          </dd>
        </div>
      </dl>
      <div className="briefing__grid" data-reveal>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('briefing.science_priorities')}</div>
          <ul className="plain-list">
            <li>{t('briefing.how_dust_moves_through_the_atmosphere')}</li>
            <li>{t('briefing.how_temperature_and_ice_change_with')}</li>
            <li>{t('briefing.how_weather_builds_up_from_day')}</li>
          </ul>
        </div>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('briefing.engineering_limits')}</div>
          <ul className="plain-list">
            <li>{t('briefing.the_rocket_can_only_lift_so')}</li>
            <li>{t('briefing.sunlight_at_mars_is_weak_so')}</li>
            <li>{t('briefing.data_only_counts_once_it_reaches')}</li>
          </ul>
        </div>
      </div>
      <div className="panel" data-reveal>
        <div className="panel__body stack">
          <div className="eyebrow eyebrow--muted">{t('briefing.your_training_crew')}</div>
          <Speech who="arman">
            {t('briefing.im_arman_i_look_after_the')}
          </Speech>
          <Speech who="dana">
            {t('briefing.and_im_dana_telemetry_and_data')}
          </Speech>
          <p className="xs muted">
            {t('briefing.arman_and_dana_are_trainees_in')}
          </p>
        </div>
      </div>
      <div className="row row--wrap" data-reveal>
        <button type="button" className="btn btn--lg" onClick={onNext} data-testid="briefing-next">
          {t('briefing.continue')}{' '} <ArrowRight size={16} />
        </button>
        <button type="button" className="link-btn small" onClick={() => navigate('designer')} data-testid="briefing-skip">
          {t('briefing.skip_the_briefing_ive_played_before')}
        </button>
      </div>
    </>
  );
}

const TOPICS = [
  { id: 'mass', get label() { return t('briefing.topics.mass.label'); }, icon: <Weight size={15} /> },
  { id: 'power', get label() { return t('briefing.topics.power.label'); }, icon: <Battery size={15} /> },
  { id: 'instruments', get label() { return t('briefing.topics.instruments.label'); }, icon: <Telescope size={15} /> },
  { id: 'delay', get label() { return t('briefing.topics.delay.label'); }, icon: <Radio size={15} /> },
  { id: 'launch', get label() { return t('briefing.topics.launch.label'); }, icon: <Rocket size={15} /> },
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
        {t('briefing.five_ideas_that_decide_every_mission')}
      </h1>
      <p className="lead" data-reveal>
        {t('briefing.try_each_one_it_takes_a')}
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
          <ArrowLeft size={16} /> {t('briefing.back')}
        </button>
        {index < TOPICS.length - 1 ? (
          <button type="button" className="btn btn--lg" onClick={() => pick(TOPICS[index + 1].id)} data-testid="topic-next">
            {t('briefing.next_idea')}{' '} <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn--lg" onClick={onNext} data-testid="tutorial-done">
            {t('briefing.choose_the_science_focus')}{' '} <ArrowRight size={16} />
          </button>
        )}
        {index < TOPICS.length - 1 && (
          <button type="button" className="link-btn small" onClick={onNext} data-testid="tutorial-skip">
            {t('briefing.skip_the_tutorial')}
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
      <h3 className="subtitle">{t('briefing.mass_every_kilogram_costs_propellant')}</h3>
      <p className="muted">
        {t('briefing.mass_is_how_much_stuff_your')}
      </p>
      <Slider label={t('briefing.add_equipment')} value={extra} min={0} max={80} step={5} onChange={setExtra} format={(v) => `+${v} kg`} />
      <Bar label={t('briefing.spacecraft_dry')} value={dry} max={700} text={`${dry} kg`} />
      <Bar label={t('briefing.propellant_needed')} value={prop} max={700} text={`${Math.round(prop)} kg`} tone="amber" />
      <Bar label={t('briefing.total_at_launch')} value={dry + prop} max={700} text={`${Math.round(dry + prop)} kg`} />
      <p className="small">
        {extra === 0 ? t('briefing.move_the_slider') : t('briefing.kg_of_equipment_became_kg_at', { extra, base: Math.round(extra + prop - base) })}{' '}
        <span className="muted">{t('briefing.example_for_a_low_mars_orbit')}</span>
      </p>
    </div>
  );
}

function PowerLesson() {
  const [au, setAu] = useState(1);
  const w = solarIrradianceWm2(au);
  return (
    <div className="stack">
      <h3 className="subtitle">{t('briefing.power_sunlight_fades_with_distance')}</h3>
      <p className="muted">
        <T k="briefing.power_text" />
      </p>
      <Slider label={t('briefing.distance_from_the_sun')} value={au} min={1} max={1.67} step={0.01} onChange={setAu} format={(v) => `${v.toFixed(2)} AU`} />
      <Bar label={t('briefing.sunlight_on_each_m')} value={w} max={1361} text={`${Math.round(w)} W/m²`} tone={w < 700 ? 'amber' : 'cyan'} />
      <div className="row row--wrap small">
        <button type="button" className="tag" onClick={() => setAu(1)}>{t('briefing.earth_1_00_au')}</button>
        <button type="button" className="tag" onClick={() => setAu(1.38)}>{t('briefing.mars_nearest_1_38_au')}</button>
        <button type="button" className="tag" onClick={() => setAu(1.52)}>{t('briefing.mars_average_1_52_au')}</button>
        <button type="button" className="tag" onClick={() => setAu(1.67)}>{t('briefing.mars_farthest_1_67_au')}</button>
      </div>
      <p className="small">
        <T k="briefing.power_result" params={{ au: au.toFixed(2), pct: Math.round((w / 1361) * 100) }} tags={{ au: (c) => <Term k="AU">{c}</Term> }} />{' '}
        <span className="muted">{t('briefing.mars_distances_come_from_jpl_horizons')}</span>
      </p>
    </div>
  );
}

function InstrumentLesson() {
  const [view, setView] = useState<'sounder' | 'imager'>('sounder');
  return (
    <div className="stack">
      <h3 className="subtitle">{t('briefing.instruments_the_reason_the_mission_exists')}</h3>
      <p className="muted">{t('briefing.instruments_turn_light_into_measurements_dif')}</p>
      <div className="segmented" role="group" aria-label={t('briefing.instrument_type')}>
        <button type="button" aria-pressed={view === 'sounder'} onClick={() => setView('sounder')}>
          {t('briefing.limb_sounder')}
        </button>
        <button type="button" aria-pressed={view === 'imager'} onClick={() => setView('imager')}>
          {t('briefing.weather_imager')}
        </button>
      </div>
      <div className="instrument-demo">
        <svg viewBox="0 0 220 120" role="img" aria-label={view === 'sounder' ? t('briefing.a_sounder_looks_sideways_through_the') : t('briefing.an_imager_looks_straight_down_to')}>
          <path d="M-20 150 A150 150 0 0 1 240 150" fill="#8a3f22" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${-20 - i * 7} 150 A${150 + i * 7} ${150 + i * 7} 0 0 1 ${240 + i * 7} 150`} fill="none" stroke="#e9a37a" strokeOpacity={0.5 - i * 0.1} strokeWidth="5" />
          ))}
          {view === 'sounder' ? (
            <>
              <rect x="14" y="18" width="16" height="10" fill="#52D7E8" />
              <path d="M30 23 L205 34 L205 62 Z" fill="#52D7E8" opacity="0.22" />
              <path d="M30 23 L205 48" stroke="#52D7E8" strokeDasharray="3 3" />
              <text x="120" y="20" className="svg-label">{t('briefing.sideways_through_the_layers')}</text>
            </>
          ) : (
            <>
              <rect x="102" y="6" width="16" height="10" fill="#FFB84D" />
              <path d="M110 16 L50 78 L170 78 Z" fill="#FFB84D" opacity="0.2" />
              <text x="110" y="100" className="svg-label" textAnchor="middle">
                {t('briefing.straight_down_a_wide_map')}
              </text>
            </>
          )}
        </svg>
        <div className="stack stack--sm small">
          {view === 'sounder' ? (
            <>
              <p>
                <T k="briefing.sounder_text" />
              </p>
              <p className="muted">
                {t('briefing.real_example_nasas_mass_power_it', { MCS_REFERENCE: MCS_REFERENCE.name, massQuote: MCS_REFERENCE.massQuote, powerQuote: MCS_REFERENCE.powerQuote, join: MCS_REFERENCE.measures.join(', ') })}{' '} <ProvenanceTag kind="verified_mission_reference" />
              </p>
            </>
          ) : (
            <>
              <p>
                <T k="briefing.imager_text" />
              </p>
              <p className="muted">
                {t('briefing.pictures_are_large_the_games_imager')}{' '} <ProvenanceTag kind="educational_game_assumption" />
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
      <h3 className="subtitle">{t('briefing.signal_delay_mars_cannot_be_flown')}</h3>
      <p className="muted">
        <T k="briefing.delay_text" params={{ time: formatLightTime(reading.oneWayLightTimeS) }} />
      </p>
      <svg viewBox="0 0 300 60" className="delay-track" role="img" aria-label={t('briefing.signal_travelling_between_earth_and_mars')}>
        <line x1="24" y1="30" x2="276" y2="30" stroke="#94b2d6" strokeOpacity="0.3" strokeDasharray="2 5" />
        <circle cx="24" cy="30" r="11" fill="#2f7fd0" />
        <circle cx="276" cy="30" r="8" fill="#c4673f" />
        <circle ref={dot} cx="24" cy="30" r="4" fill="#52D7E8" opacity="0" />
        <text x="24" y="56" className="svg-label" textAnchor="middle">{t('briefing.earth')}</text>
        <text x="276" y="56" className="svg-label" textAnchor="middle">{t('briefing.mars')}</text>
      </svg>
      <div className="row row--wrap">
        <button type="button" className="btn btn--sm" onClick={send} data-testid="send-command">
          {t('briefing.send_a_command')}
        </button>
        <span className="small mono">
          {phase === 'idle' && t('briefing.ready')}
          {phase === 'out' && t('briefing.command_on_its_way', { oneWayLightTimeS: formatLightTime(reading.oneWayLightTimeS) })}
          {phase === 'back' && t('briefing.answer_on_its_way', { oneWayLightTimeS: formatLightTime(reading.oneWayLightTimeS) })}
          {phase === 'done' && t('briefing.round_trip', { oneWayLightTimeS: formatLightTime(roundTripS(reading.oneWayLightTimeS)) })}
        </span>
      </div>
      <div className="small muted">
        <ProvenanceTag kind="verified_nasa_data" label={reading.status === 'live' ? t('briefing.jpl_horizons_live') : t('briefing.jpl_horizons_cached')} /> <T k="briefing.delay_note" params={{ date: reading.epochIso, s: reading.oneWayLightTimeS.toFixed(1), mkm: (reading.rangeKm / 1e6).toFixed(1) }} tags={{ lt: (c) => <Term k="light time">{c}</Term> }} />
      </div>
    </div>
  );
}

function LaunchLesson() {
  const [mass, setMass] = useState(520);
  return (
    <div className="stack">
      <h3 className="subtitle">{t('briefing.launch_capacity_the_rocket_sets_the')}</h3>
      <p className="muted">{t('briefing.each_launch_vehicle_can_push_only')}</p>
      <Slider label={t('briefing.spacecraft_mass_with_propellant')} value={mass} min={380} max={980} step={10} onChange={setMass} format={(v) => `${v} kg`} />
      {LAUNCH_VEHICLES.map((v) => {
        const fits = mass <= v.capacityKg;
        return <Bar key={v.id} label={t('briefing.cr', { v: v.name, costCr: v.costCr })} value={mass} max={v.capacityKg} tone={fits ? 'cyan' : 'coral'} text={fits ? t('briefing.fits_kg_spare', { mass: v.capacityKg - mass }) : t('briefing.too_heavy_by_kg', { capacityKg: mass - v.capacityKg })} />;
      })}
      <p className="small muted">
        {t('briefing.the_tulpar_rockets_are_fictional_vehicles')}{' '} <ProvenanceTag kind="educational_game_assumption" />
      </p>
    </div>
  );
}

function StepFocus({ onBack }: { onBack: () => void }) {
  const objective = useGame((s) => s.design.objective);
  const setObjective = useGame((s) => s.setObjective);
  const mode = useGame((s) => s.settings.mode);
  const setSettings = useGame((s) => s.setSettings);
  // Rebuilt on every render so the texts follow the selected language.
  const choices = OBJECTIVES.map((o) => ({ id: o.id, title: o.name, kicker: o.question, text: `${o.description} ${o.needs}` }));
  return (
    <>
      <h1 className="display" data-reveal>
        {t('briefing.what_should_kazmars_1_find_out')}
      </h1>
      <p className="lead" data-reveal>
        {t('briefing.define_the_objective_before_you_design')}
      </p>
      <div className="briefing__grid" data-reveal>
        <div className="stack stack--sm">
          <div className="eyebrow eyebrow--muted">{t('briefing.how_much_help_do_you_want')}</div>
          <div className="segmented" role="group" aria-label={t('briefing.game_mode')}>
            <button type="button" aria-pressed={mode === 'guided'} onClick={() => setSettings({ mode: 'guided' })} data-testid="mode-guided">
              {t('briefing.guided')}
            </button>
            <button type="button" aria-pressed={mode === 'advanced'} onClick={() => setSettings({ mode: 'advanced' })} data-testid="mode-advanced">
              {t('briefing.advanced')}
            </button>
          </div>
          <p className="xs muted">{mode === 'guided' ? t('briefing.arman_and_dana_explain_each_decision') : t('briefing.adds_formulas_assumptions_and_raw_data')}</p>
        </div>
        <TeamSetup />
      </div>
      <div data-reveal>
        <TeamDecision
          testId="objective"
          choices={choices}
          initial={objective}
          confirmLabel={t('briefing.enter_the_design_bay')}
          onConfirm={(id) => {
            setObjective(id as ObjectiveId);
            navigate('designer');
          }}
        />
      </div>
      <div data-reveal>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          <ArrowLeft size={14} /> {t('briefing.back')}
        </button>
      </div>
    </>
  );
}
