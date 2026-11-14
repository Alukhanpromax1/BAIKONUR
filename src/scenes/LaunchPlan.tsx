import { ArrowLeft, ArrowRight, ChevronDown, Clock, Orbit, Rocket } from 'lucide-react';
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
import { SciencePotential } from './SpacecraftDesigner';

type Section = 'vehicle' | 'orbit' | 'duration';

function RocketCompare({ wetKg, selected }: { wetKg: number; selected: string }) {
  const maxH = Math.max(...LAUNCH_VEHICLES.map((v) => v.heightM));
  return (
    <svg className="rockets" viewBox="0 0 300 150" role="img" aria-label="Launch vehicle size comparison">
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
              {v.capacityKg} kg
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
  const evaluation = useMemo(() => evaluateDesign(design), [design]);
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
        <div className="eyebrow">Launch plan · {objective.name}</div>
        <h1 className="title">Choose the rocket, the orbit and the mission length</h1>
        <p className="small muted">Orbits are drawn compressed, not to scale. Simplified educational model — not a flight trajectory.</p>
        {lead && players.length > 1 && (
          <span className="tag tag--cyan" style={{ marginTop: 6 }}>
            Lead: {lead.name} · {ROLES.comms.label}
          </span>
        )}
      </div>

      <aside className="workbench__panel panel" data-reveal>
        <div className="panel__head">
          <span className="eyebrow eyebrow--muted">Three choices</span>
          <ProvenanceTag kind="educational_game_assumption" />
        </div>
        <div className="workbench__slots scroll">
          <section className={`slot ${open === 'vehicle' ? 'is-open' : ''}`}>
            <button type="button" className="slot__head" aria-expanded={open === 'vehicle'} onClick={() => toggle('vehicle')} data-testid="section-vehicle">
              <span className="slot__icon"><Rocket size={16} /></span>
              <span className="grow">
                <span className="slot__label">1 · Launch vehicle</span>
                <span className="slot__current">{VEHICLE_BY_ID[design.vehicle].name} · {VEHICLE_BY_ID[design.vehicle].capacityKg} kg</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'vehicle' && (
              <div className="slot__body stack stack--sm">
                <p className="small muted">
                  Fictional “Tulpar” rockets invented for this game. Your fuelled spacecraft weighs <b className="mono" style={{ color: 'var(--text)' }}>{Math.round(evaluation.mass.wetKg)} kg</b>.
                </p>
                <RocketCompare wetKg={evaluation.mass.wetKg} selected={design.vehicle} />
                {LAUNCH_VEHICLES.map((v) => {
                  const fits = evaluation.mass.wetKg <= v.capacityKg;
                  return (
                    <button key={v.id} type="button" className="option" aria-pressed={design.vehicle === v.id} onClick={() => { sfx.select(); setVehicle(v.id); }} data-testid={`vehicle-${v.id}`}>
                      <div className="option__top">
                        <span className="option__name">{v.name} <span className="small muted">· {v.klass}</span></span>
                        <span className={`tag ${fits ? '' : 'tag--coral'}`}>{fits ? 'Fits' : 'Too small'}</span>
                      </div>
                      <div className="small muted">{v.description}</div>
                      <div className="option__meta">
                        <span>Capacity to Mars <b>{v.capacityKg} kg</b></span>
                        <span>Cost <b>{v.costCr} cr</b></span>
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
                <span className="slot__label">2 · Orbit at Mars</span>
                <span className="slot__current">{orbit.name}</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'orbit' && (
              <div className="slot__body stack stack--sm">
                {ORBITS.map((o) => {
                  const selected = design.orbit === o.id;
                  return (
                    <button key={o.id} type="button" className="option" aria-pressed={selected} onClick={() => { sfx.select(); setOrbit(o.id); }} data-testid={`orbit-${o.id}`}>
                      <div className="option__top">
                        <span className="option__name">{o.name}</span>
                        {guided && plan.orbit === o.id && <span className="tag tag--cyan">Suggested</span>}
                      </div>
                      <div className="small muted">{o.shape}</div>
                      {selected && (
                        <>
                          <p className="small" style={{ marginTop: 8 }}>{o.description}</p>
                          <dl className="effects">
                            <dt>Coverage</dt><dd>{o.effects.coverage}</dd>
                            <dt>Science</dt><dd>{o.effects.science}</dd>
                            <dt>Comms</dt><dd>{o.effects.comms}</dd>
                            <dt>Duration</dt><dd>{o.effects.duration}</dd>
                            <dt>Limits</dt><dd>{o.effects.constraints}</dd>
                          </dl>
                        </>
                      )}
                      <div className="option__meta">
                        <span><Term k="delta-v" passive>Δv</Term> <b>{o.deltaVKmS.toFixed(2)} km/s</b></span>
                        <span>In shadow <b>{Math.round(o.eclipseFraction * 100)} %</b></span>
                        <span>Contact <b>{o.contactHoursPerDay} h/day</b></span>
                      </div>
                    </button>
                  );
                })}
                {mode === 'advanced' && (
                  <p className="xs muted">
                    Assumptions: velocity change, shadow fraction and contact hours are fixed illustrative values per orbit. Orbit rings in the 3D view use a
                    logarithmic altitude scale. Low orbit assumes <Term k="aerobraking" />.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className={`slot ${open === 'duration' ? 'is-open' : ''}`}>
            <button type="button" className="slot__head" aria-expanded={open === 'duration'} onClick={() => toggle('duration')} data-testid="section-duration">
              <span className="slot__icon"><Clock size={16} /></span>
              <span className="grow">
                <span className="slot__label">3 · Science mission length</span>
                <span className="slot__current">{DURATION_BY_ID[design.duration].name} · {DURATION_BY_ID[design.duration].scienceDays} days</span>
              </span>
              <ChevronDown size={16} className="slot__chev" />
            </button>
            {open === 'duration' && (
              <div className="slot__body stack stack--sm">
                {DURATIONS.map((d) => (
                  <button key={d.id} type="button" className="option" aria-pressed={design.duration === d.id} onClick={() => { sfx.select(); setDuration(d.id); }} data-testid={`duration-${d.id}`}>
                    <div className="option__top">
                      <span className="option__name">{d.name}</span>
                      {guided && plan.duration === d.id && <span className="tag tag--cyan">Suggested</span>}
                    </div>
                    <div className="small muted">{d.description}</div>
                    <div className="option__meta"><span>Science <b>{d.scienceDays} days</b></span></div>
                  </button>
                ))}
              </div>
            )}
          </section>
          {guided && (
            <div style={{ padding: '4px 14px 14px' }}>
              <Coach who="arman">
                Rocket, orbit and spacecraft have to agree. If a meter turns red, the message above it says exactly which number is over and what would fix it.
              </Coach>
            </div>
          )}
        </div>
        <div className="workbench__foot stack">
          <SciencePotential evaluation={evaluation} objectiveName={objective.name} />
          <div className="row">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('designer')} data-testid="back-to-designer" aria-label="Back to the design bay">
              <ArrowLeft size={16} />
            </button>
            <button type="button" className="btn btn--lg grow" disabled={!evaluation.launchReady} onClick={() => navigate('readiness')} data-testid="to-readiness">
              {evaluation.launchReady ? 'Go to launch readiness' : 'Resolve the red limits first'} {evaluation.launchReady && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="workbench__bottom" data-reveal>
        <IssueList issues={evaluation.issues} max={2} />
        <ResourceDashboard evaluation={evaluation} context={evaluation.launchReady ? 'Resource check passed. Amber warnings will matter during the mission — you can still launch.' : 'Resource check failed: every red meter must be fixed before launch.'} />
      </div>
    </div>
  );
}
