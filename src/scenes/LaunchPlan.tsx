import { ArrowLeft, ArrowRight, ChevronDown, Clock, Orbit, Rocket } from 'lucide-react';
import { t, useLangStore } from '@/i18n';
import { T } from '@/i18n/Trans';
import { useMemo, useState } from 'react';
import { navigate } from '@/app/navigation';
import { sfx } from '@/audio/sound';
import { Coach } from '@/components/Avatar';
import { IssueList, ResourceDashboard } from '@/components/ResourceDashboard';
import { ProvenanceTag, Term } from '@/components/Tags';
import { RECOMMENDED_PLAN } from '@/data/components';
import { LAUNCH_VEHICLES, VEHICLE_BY_ID } from '@/data/launchVehicles';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { DURATIONS, DURATION_BY_ID, ORBITS, ORBIT_BY_ID } from '@/data/orbits';
import { evaluateDesign } from '@/game/engine/resources';
import { ROLES, useGame } from '@/game/state/store';
import { useReveal } from '@/hooks/useReveal';
import { InfoTip } from '@/components/InfoTip';
import { SciencePotential } from './SpacecraftDesigner';

type Section = 'vehicle' | 'orbit' | 'duration';

function RocketCompare({ wetKg, selected }: { wetKg: number; selected: string }) {
  const maxH = Math.max(...LAUNCH_VEHICLES.map((v) => v.heightM));
  return (
    <svg className="rockets" viewBox="0 0 300 150" role="img" aria-label={t('launch.launch_vehicle_size_comparison')}>
      <line x1="10" y1="132" x2="290" y2="132" stroke="#94b2d6" strokeOpacity="0.3" />
      {LAUNCH_VEHICLES.map((v, i) => {
        const h = (v.heightM / maxH) * 110;
        const w = 14 + i * 5;
        const x = 55 + i * 95;
        const fits = wetKg <= v.capacityKg;
        const color = v.id === selected ? '#52D7E8' : '#5d7fa6';
        return (
          <g key={v.id} opacity={v.id === selected ? 1 : 0.7}>
            <path d={`M${x - w / 2} 132 V${132 - h + w} Q${x - w / 2} ${132 - h} ${x} ${132 - h - 6} Q${x + w / 2} ${132 - h} ${x + w / 2} ${132 - h + w} V132 Z`} fill="none" stroke={color} strokeWidth="1.5" />
            <line x1={x - w / 2} y1={132 - h * 0.45} x2={x + w / 2} y2={132 - h * 0.45} stroke={color} strokeOpacity="0.6" />
            {i > 0 && (
              <>
                <rect x={x - w / 2 - 5} y={132 - h * 0.4} width="4" height={h * 0.4} fill="none" stroke={color} />
                <rect x={x + w / 2 + 1} y={132 - h * 0.4} width="4" height={h * 0.4} fill="none" stroke={color} />
              </>
            )}
            <text x={x} y="146" textAnchor="middle" className="svg-label" fill={color}>
              {v.name}
            </text>
            <text x={x + w / 2 + 12} y={132 - h + 14} className="svg-label" fill={fits ? '#9aa8be' : '#ff7a6b'}>
              {t('u.kg', { n: v.capacityKg })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Scene 4 — launch vehicle, orbit and mission length, with the final resource check. */
export default function LaunchPlan() {
  const design = useGame((s) => s.design);
  const setVehicle = useGame((s) => s.setVehicle);
  const setOrbit = useGame((s) => s.setOrbit);
  const setDuration = useGame((s) => s.setDuration);
  const mode = useGame((s) => s.settings.mode);
  const players = useGame((s) => s.players);
  const [open, setOpen] = useState<Section>('vehicle');
  const lang = useLangStore((s) => s.lang);
  const evaluation = useMemo(() => evaluateDesign(design), [design, lang]);
  const ref = useReveal<HTMLDivElement>();
  const objective = OBJECTIVE_BY_ID[design.objective];
  const plan = RECOMMENDED_PLAN[design.objective];
  const guided = mode === 'guided';
  const lead = players.find((p) => p.role === 'comms');
  const toggle = (s: Section) => {
    sfx.click();
    setOpen(s);
  };
  const orbit = ORBIT_BY_ID[design.orbit];

  return (
    <div className="workbench" ref={ref}>
      <div className="workbench__head hit" data-reveal>
        <div className="eyebrow">{t('launch.launch_plan', { objective: objective.name })}</div>
        <h1 className="title">{t('launch.choose_the_rocket_the_orbit_and')}</h1>
        <p className="small muted">{t('launch.orbits_are_drawn_compressed_not_to')}</p>
        {lead && players.length > 1 && (
          <span className="tag tag--cyan" style={{ marginTop: 6 }}>
            {t('launch.lead', { lead: lead.name, comms: ROLES.comms.label })}
          </span>
        )}
      </div>

      <aside className="workbench__panel panel" data-reveal>
        <div className="panel__head">
          <span className="eyebrow eyebrow--muted">{t('launch.three_choices')}</span>
          <ProvenanceTag kind="educational_game_assumption" />
        </div>
        <div className="workbench__slots scroll">
          <section className={`slot ${open === 'vehicle' ? 'is-open' : ''}`}>
            <button type="button" className="slot__head" aria-expanded={open === 'vehicle'} onClick={() => toggle('vehicle')} data-testid="section-vehicle">
              <span className="slot__icon"><Rocket size={16} /></span>
              <span className="grow">
                <span className="slot__label">{t('launch.1_launch_vehicle')}</span>
                <span className="slot__current">{t('launch.kg_2', { vehicle: VEHICLE_BY_ID[design.vehicle].name, capacityKg: VEHICLE_BY_ID[design.vehicle].capacityKg })}</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'vehicle' && (
              <div className="slot__body stack stack--sm">
                <p className="small muted">
                  <T k="launch.vehicle_intro" params={{ kg: Math.round(evaluation.mass.wetKg) }} tags={{ b: (c) => <b className="mono" style={{ color: 'var(--text)' }}>{c}</b> }} />
                </p>
                <RocketCompare wetKg={evaluation.mass.wetKg} selected={design.vehicle} />
                {LAUNCH_VEHICLES.map((v) => {
                  const fits = evaluation.mass.wetKg <= v.capacityKg;
                  return (
                    <button key={v.id} type="button" className="option" aria-pressed={design.vehicle === v.id} onClick={() => { sfx.select(); setVehicle(v.id); }} data-testid={`vehicle-${v.id}`}>
                      <div className="option__top">
                        <span className="option__name">{v.name} <span className="small muted">· {v.klass}</span></span>
                        <span className={`tag ${fits ? '' : 'tag--coral'}`}>{fits ? t('launch.fits') : t('launch.too_small')}</span>
                      </div>
                      <div className="small muted">{v.description}</div>
                      <div className="option__meta">
                        <span><T k="launch.meta_capacity" params={{ n: v.capacityKg }} /></span>
                        <span><T k="launch.meta_cost" params={{ n: v.costCr }} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`slot ${open === 'orbit' ? 'is-open' : ''}`}>
            <button type="button" className="slot__head" aria-expanded={open === 'orbit'} onClick={() => toggle('orbit')} data-testid="section-orbit">
              <span className="slot__icon"><Orbit size={16} /></span>
              <span className="grow">
                <span className="slot__label">{t('launch.2_orbit_at_mars')}</span>
                <span className="slot__current">{orbit.name}</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'orbit' && (
              <div className="slot__body stack stack--sm">
                <div className="row"><span className="small muted">{t('launch.orbit_altitude_hint')}</span><InfoTip k="orbital_altitude" /></div>
                {ORBITS.map((o) => {
                  const selected = design.orbit === o.id;
                  return (
                    <button key={o.id} type="button" className="option" aria-pressed={selected} onClick={() => { sfx.select(); setOrbit(o.id); }} data-testid={`orbit-${o.id}`}>
                      <div className="option__top">
                        <span className="option__name">{o.name}</span>
                        {guided && plan.orbit === o.id && <span className="tag tag--cyan">{t('launch.suggested')}</span>}
                      </div>
                      <div className="small muted">{o.shape}</div>
                      {selected && (
                        <>
                          <p className="small" style={{ marginTop: 8 }}>{o.description}</p>
                          <dl className="effects">
                            <dt>{t('launch.coverage')}</dt><dd>{o.effects.coverage}</dd>
                            <dt>{t('launch.science')}</dt><dd>{o.effects.science}</dd>
                            <dt>{t('launch.comms')}</dt><dd>{o.effects.comms}</dd>
                            <dt>{t('launch.duration')}</dt><dd>{o.effects.duration}</dd>
                            <dt>{t('launch.limits')}</dt><dd>{o.effects.constraints}</dd>
                          </dl>
                        </>
                      )}
                      <div className="option__meta">
                        <span><Term k="delta-v" passive>Δv</Term> <b>{t('u.kms', { n: o.deltaVKmS.toFixed(2) })}</b></span>
                        <span><T k="launch.meta_shadow" params={{ n: Math.round(o.eclipseFraction * 100) }} /></span>
                        <span><T k="launch.meta_contact" params={{ n: o.contactHoursPerDay }} /></span>
                      </div>
                    </button>
                  );
                })}
                {mode === 'advanced' && (
                  <p className="xs muted">
                    <T k="launch.assumptions" tags={{ ab: (c) => <Term k="aerobraking">{c}</Term> }} />
                  </p>
                )}
              </div>
            )}
          </section>

          <section className={`slot ${open === 'duration' ? 'is-open' : ''}`}>
            <button type="button" className="slot__head" aria-expanded={open === 'duration'} onClick={() => toggle('duration')} data-testid="section-duration">
              <span className="slot__icon"><Clock size={16} /></span>
              <span className="grow">
                <span className="slot__label">{t('launch.3_science_mission_length')}</span>
                <span className="slot__current">{t('launch.days', { duration: DURATION_BY_ID[design.duration].name, scienceDays: DURATION_BY_ID[design.duration].scienceDays })}</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'duration' && (
              <div className="slot__body stack stack--sm">
                {DURATIONS.map((d) => (
                  <button key={d.id} type="button" className="option" aria-pressed={design.duration === d.id} onClick={() => { sfx.select(); setDuration(d.id); }} data-testid={`duration-${d.id}`}>
                    <div className="option__top">
                      <span className="option__name">{d.name}</span>
                      {guided && plan.duration === d.id && <span className="tag tag--cyan">{t('launch.suggested')}</span>}
                    </div>
                    <div className="small muted">{d.description}</div>
                    <div className="option__meta"><span><T k="launch.meta_science" params={{ n: d.scienceDays }} /></span></div>
                  </button>
                ))}
              </div>
            )}
          </section>
          {guided && (
            <div style={{ padding: '4px 14px 14px' }}>
              <Coach who="arman">
                {t('launch.rocket_orbit_and_spacecraft_have_to')}
              </Coach>
            </div>
          )}
        </div>
        <div className="workbench__foot stack">
          <SciencePotential evaluation={evaluation} objectiveName={objective.name} />
          <div className="row">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('designer')} data-testid="back-to-designer" aria-label={t('launch.back_to_the_design_bay')}>
              <ArrowLeft size={16} />
            </button>
            <button type="button" className="btn btn--lg grow" disabled={!evaluation.launchReady} onClick={() => navigate('readiness')} data-testid="to-readiness">
              {evaluation.launchReady ? t('launch.go_to_launch_readiness') : t('launch.resolve_the_red_limits_first')} {evaluation.launchReady && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="workbench__bottom" data-reveal>
        <IssueList issues={evaluation.issues} max={2} />
        <ResourceDashboard evaluation={evaluation} context={evaluation.launchReady ? t('launch.check_passed') : t('launch.check_failed')} />
      </div>
    </div>
  );
}
