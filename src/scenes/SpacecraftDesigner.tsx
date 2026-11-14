import { ArrowRight, Battery, ChevronDown, Database, Flame, Radio, Sparkles, Telescope } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { navigate } from '@/app/navigation';
import { sfx } from '@/audio/sound';
import { Coach } from '@/components/Avatar';
import { IssueList, ResourceDashboard } from '@/components/ResourceDashboard';
import { ProvenanceTag } from '@/components/Tags';
import { COMPONENT_BY_ID, optionsFor, RECOMMENDED, SLOTS, type ComponentOption } from '@/data/components';
import { VEHICLE_BY_ID } from '@/data/launchVehicles';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { DURATION_BY_ID, ORBIT_BY_ID } from '@/data/orbits';
import { evaluateDesign } from '@/game/engine/resources';
import { ROLES, useGame } from '@/game/state/store';
import { useReveal } from '@/hooks/useReveal';
import { calloutScreen } from '@/three/state';
import type { SlotId } from '@/types';

const SLOT_ICON: Record<SlotId, React.ReactNode> = {
  payload: <Telescope size={16} />,
  power: <Battery size={16} />,
  comms: <Radio size={16} />,
  storage: <Database size={16} />,
  propulsion: <Flame size={16} />,
};

const COACH: Record<SlotId, { who: 'arman' | 'dana'; text: string }> = {
  payload: { who: 'dana', text: 'Pick the instrument your science question needs — then check whether the link can carry its data home.' },
  power: { who: 'arman', text: 'Watch the power margin. Near zero is not “enough”: Mars drifts farther from the Sun during the mission.' },
  comms: { who: 'dana', text: 'Compare the Comms meter with the Data meter. If the link carries less than the payload produces, data will be lost.' },
  storage: { who: 'dana', text: 'In March 2028 Mars goes behind the Sun and we cannot talk to the spacecraft. The recorder has to hold everything until then.' },
  propulsion: { who: 'arman', text: 'Bigger tanks are only worth their mass if your orbit needs the propellant. Check the Mass meter.' },
};

export function SciencePotential({ evaluation, objectiveName }: { evaluation: ReturnType<typeof evaluateDesign>; objectiveName: string }) {
  const s = evaluation.science;
  return (
    <div className="science" data-testid="science-potential">
      <div className="row row--between">
        <span className="eyebrow eyebrow--muted">Science potential · {objectiveName}</span>
        <span className="mono" style={{ fontSize: 18 }}>
          {Math.round(s.potential * 100)}
          <small className="muted"> /100</small>
        </span>
      </div>
      <div className="science__grid">
        {s.parts.map((p) => (
          <div key={p.key} className="science__part" title={`${p.label}: quality ${Math.round(p.quality * 100)} % × importance ${Math.round(p.weight * 100)} % for this objective`}>
            <span className="row row--between xs">
              <span className="muted">{p.label}</span>
              <span className="mono dim">×{Math.round(p.weight * 100)}%</span>
            </span>
            <span className="science__track">
              <span className="science__fill" style={{ transform: `scaleX(${Math.max(0.02, p.quality)})` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function specs(o: ComponentOption): [string, string][] {
  const out: [string, string][] = [
    ['Mass', `${o.massKg} kg`],
    ['Power', o.slot === 'power' ? 'generates' : `${o.powerW} W`],
    ['Cost', `${o.costCr} cr`],
  ];
  if (o.dataMbPerDay) out.push(['Data', `${o.dataMbPerDay} Mb/day`]);
  if (o.arrayAreaM2) out.push(['Area', `${o.arrayAreaM2} m²`]);
  if (o.rateKbpsAt1Au) out.push(['Rate at 1 AU', `${o.rateKbpsAt1Au} kbps`]);
  if (o.capacityGb) out.push(['Capacity', `${o.capacityGb} Gb`]);
  if (o.tankCapacityKg) out.push(['Tank', `${o.tankCapacityKg} kg`]);
  return out;
}

/** Labels pinned to the 3D subsystems. Positions come from the render loop; the buttons are real DOM. */
function Callouts() {
  const active = useGame((s) => s.activeSlot);
  const setActive = useGame((s) => s.setActiveSlot);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const slot of SLOTS) {
        const el = refs.current[slot.id];
        const p = calloutScreen[slot.id];
        if (!el) continue;
        if (!p || !p.visible) {
          el.style.opacity = '0';
          continue;
        }
        el.style.opacity = '1';
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-12px, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="callouts" aria-label="Spacecraft subsystems">
      {SLOTS.map((s) => (
        <button
          key={s.id}
          ref={(el) => {
            refs.current[s.id] = el;
          }}
          type="button"
          className={`callout ${active === s.id ? 'is-active' : ''}`}
          style={{ opacity: 0 }}
          onClick={() => {
            sfx.click();
            setActive(s.id);
          }}
          aria-label={`Inspect ${s.label}`}
          data-testid={`callout-${s.id}`}
        >
          <span className="callout__dot" />
          <span className="callout__label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Scene 3 — the interactive 3D design bay. */
export default function SpacecraftDesigner() {
  const design = useGame((s) => s.design);
  const activeSlot = useGame((s) => s.activeSlot);
  const hoveredSlot = useGame((s) => s.hoveredSlot);
  const setActiveSlot = useGame((s) => s.setActiveSlot);
  const select = useGame((s) => s.select);
  const applyRecommended = useGame((s) => s.applyRecommended);
  const mode = useGame((s) => s.settings.mode);
  const players = useGame((s) => s.players);
  const evaluation = useMemo(() => evaluateDesign(design), [design]);
  const ref = useReveal<HTMLDivElement>();
  const objective = OBJECTIVE_BY_ID[design.objective];
  const recommended = RECOMMENDED[design.objective];
  const isRecommended = SLOTS.every((s) => design.selections[s.id] === recommended[s.id]);
  const engineer = players.find((p) => p.role === 'engineer');
  // Problems that this screen can fix; launch-plan problems are handled on the next screen.
  const blocking = evaluation.issues.filter((i) => i.severity === 'block');

  const choose = (slot: SlotId, id: string) => {
    if (design.selections[slot] === id) return;
    sfx.select();
    select(slot, id);
  };

  return (
    <div className="workbench" ref={ref}>
      <Callouts />
      <div className="workbench__head hit" data-reveal>
        <div className="eyebrow">Design bay · {objective.name}</div>
        <h1 className="title">Build KAZMARS-1</h1>
        <p className="small muted">
          {hoveredSlot ? (
            <>
              <b className="cyan">{SLOTS.find((s) => s.id === hoveredSlot)?.label}</b> — click to configure
            </>
          ) : (
            'Drag to rotate · scroll or pinch to zoom · click a part to inspect it'
          )}
        </p>
        {engineer && players.length > 1 && (
          <span className="tag tag--cyan" style={{ marginTop: 6 }}>
            Lead: {engineer.name} · {ROLES.engineer.label}
          </span>
        )}
      </div>

      <aside className="workbench__panel panel" data-reveal>
        <div className="panel__head">
          <span className="eyebrow eyebrow--muted">Subsystems</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { sfx.select(); applyRecommended(); }} disabled={isRecommended} data-testid="use-recommended">
            <Sparkles size={13} /> {isRecommended ? 'Recommended build' : 'Use recommended'}
          </button>
        </div>
        <div className="workbench__slots scroll">
          {SLOTS.map((slot) => {
            const current = COMPONENT_BY_ID[design.selections[slot.id]];
            const open = activeSlot === slot.id;
            return (
              <section key={slot.id} className={`slot ${open ? 'is-open' : ''}`}>
                <button type="button" className="slot__head" aria-expanded={open} onClick={() => { sfx.click(); setActiveSlot(slot.id); }} data-testid={`slot-${slot.id}`}>
                  <span className="slot__icon">{SLOT_ICON[slot.id]}</span>
                  <span className="grow">
                    <span className="slot__label">{slot.label}</span>
                    <span className="slot__current">{current.name}</span>
                  </span>
                  <ChevronDown size={16} className="slot__chev" />
                </button>
                {open && (
                  <div className="slot__body stack stack--sm">
                    <p className="small">
                      <b>{slot.question}</b> <span className="muted">{slot.explain}</span>
                    </p>
                    {optionsFor(slot.id).map((o) => {
                      const selected = current.id === o.id;
                      return (
                        <button key={o.id} type="button" className="option" aria-pressed={selected} onClick={() => choose(slot.id, o.id)} data-testid={`option-${o.id}`}>
                          <div className="option__top">
                            <span className="option__name">{o.name}</span>
                            {mode === 'guided' && recommended[slot.id] === o.id && <span className="tag tag--cyan">Suggested</span>}
                          </div>
                          <div className="small muted">{selected ? o.description : o.short}</div>
                          <div className="option__meta">
                            {specs(o).map(([k, v]) => (
                              <span key={k}>
                                {k} <b>{v}</b>
                              </span>
                            ))}
                          </div>
                          {selected && (
                            <div className="small" style={{ marginTop: 8 }}>
                              {o.tradeoff}
                              <div className="row row--wrap" style={{ marginTop: 6, gap: 8 }}>
                                <ProvenanceTag kind={o.provenance} passive />
                                {mode === 'advanced' && <span className="xs muted">{o.provenanceNote}</span>}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {mode === 'guided' && <Coach who={COACH[slot.id].who}>{COACH[slot.id].text}</Coach>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="workbench__foot stack">
          <SciencePotential evaluation={evaluation} objectiveName={objective.name} />
          <button type="button" className="btn btn--lg" onClick={() => navigate('launch')} data-testid="to-launch">
            Plan the launch <ArrowRight size={16} />
          </button>
          {blocking.length > 0 && <p className="xs muted">Some limits are exceeded. You can fix them here, or by changing the rocket and orbit on the next screen.</p>}
        </div>
      </aside>

      <div className="workbench__bottom" data-reveal>
        <IssueList issues={evaluation.issues} max={2} />
        <ResourceDashboard
          evaluation={evaluation}
          context={`Checked against your current launch plan: ${VEHICLE_BY_ID[design.vehicle].name} · ${ORBIT_BY_ID[design.orbit].name} · ${DURATION_BY_ID[design.duration].name}. You confirm these next.`}
        />
      </div>
    </div>
  );
}
