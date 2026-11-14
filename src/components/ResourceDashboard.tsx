import { Banknote, Battery, CalendarClock, Database, Radio, Weight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GAME, MARS_MEAN_SUN_DISTANCE_AU } from '@/data/constants';
import { formatData, formatLightTime, formatRate } from '@/game/engine/comms';
import type { DesignEvaluation, Issue, Status } from '@/game/engine/resources';
import { useGame } from '@/game/state/store';
import { formatJd } from '@/services/horizons/ephemeris';
import { ProvenanceTag, Term } from './Tags';

type ResourceId = Issue['resource'];

const STATUS_TEXT: Record<Status, string> = { ok: 'OK', tight: 'TIGHT', over: 'OVER LIMIT' };

function Bumped({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && ref.current) {
      ref.current.classList.remove('bump');
      void ref.current.offsetWidth;
      ref.current.classList.add('bump');
    }
    prev.current = value;
  }, [value]);
  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      {value}
    </span>
  );
}

interface MeterProps {
  id: ResourceId;
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  fill: number;
  note: string;
  status: Status;
  open: boolean;
  onToggle: () => void;
}

function Meter({ id, icon, label, value, unit, fill, note, status, open, onToggle }: MeterProps) {
  return (
    <button type="button" className={`meter meter--${status}`} onClick={onToggle} aria-expanded={open} data-testid={`meter-${id}`} data-status={status}>
      <span className="meter__head">
        <span className="meter__label">
          {icon}
          {label}
        </span>
        <span className={`xs mono status-${status}`}>{STATUS_TEXT[status]}</span>
      </span>
      <span className="meter__value">
        <Bumped value={value} /> <small>{unit}</small>
      </span>
      <span className="meter__bar" aria-hidden="true">
        <span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, fill))})` }} />
      </span>
      <span className="meter__note">{note}</span>
    </button>
  );
}

/** The six mission resources, always computed from the real calculation engine. */
export function ResourceDashboard({ evaluation, context }: { evaluation: DesignEvaluation; context?: string }) {
  const [open, setOpen] = useState<ResourceId | null>(null);
  const advanced = useGame((s) => s.settings.mode === 'advanced');
  const e = evaluation;
  const toggle = (id: ResourceId) => setOpen((o) => (o === id ? null : id));
  const sign = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;

  return (
    <div className="dash panel hit" data-testid="resource-dashboard">
      {open && (
        <div className="dash__detail scroll">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <span className="eyebrow">{open === 'comms' ? 'Communications' : open === 'duration' ? 'Mission duration' : open === 'data' ? 'Science data' : open}</span>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setOpen(null)} aria-label="Close details">
              <X size={16} />
            </button>
          </div>
          {open === 'mass' && (
            <div>
              {e.mass.lines.map((l) => (
                <div className="kv" key={l.label}>
                  <span>{l.label}</span>
                  <span>{l.kg} kg</span>
                </div>
              ))}
              <div className="kv">
                <span>
                  Propellant for {e.mass.deltaVKmS.toFixed(2)} km/s of <Term k="delta-v" /> (tank holds {e.mass.tankCapacityKg} kg)
                </span>
                <span className={e.mass.tankOk ? '' : 'coral'}>{Math.round(e.mass.propellantKg)} kg</span>
              </div>
              <div className="kv kv--total">
                <span>Launch mass · limit {e.mass.capacityKg} kg</span>
                <span>{Math.round(e.mass.wetKg)} kg</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                Propellant comes from the rocket equation: a heavier spacecraft needs more propellant, which makes it heavier still.
                {advanced && ' m_prop = m_dry · (e^(Δv / (Isp·g₀)) − 1), plus a 3 % reserve.'}
              </p>
            </div>
          )}
          {open === 'power' && (
            <div>
              <div className="kv">
                <span>Sunlight at Mars’ mean distance ({MARS_MEAN_SUN_DISTANCE_AU} AU)</span>
                <span>{Math.round(e.power.irradianceWm2)} W/m²</span>
              </div>
              <div className="kv">
                <span>Array output in sunlight</span>
                <span>{Math.round(e.power.sunlitW)} W</span>
              </div>
              <div className="kv kv--total">
                <span>Available after time in shadow</span>
                <span>{Math.round(e.power.availableW)} W</span>
              </div>
              <div className="kv">
                <span>Instrument consumption</span>
                <span>{e.power.instrumentW} W</span>
              </div>
              <div className="kv">
                <span>Bus consumption</span>
                <span>{e.power.busW} W</span>
              </div>
              <div className="kv">
                <span>Radio, recorder and propulsion heaters</span>
                <span>{e.power.subsystemW} W</span>
              </div>
              <div className="kv kv--total">
                <span>Remaining power margin</span>
                <span className={`status-${e.status.power}`}>{sign(e.power.marginW)} W</span>
              </div>
              <div className="kv">
                <span>Margin at the farthest point from the Sun ({e.powerWorst.distanceAu.toFixed(2)} AU)</span>
                <span>{sign(e.powerWorst.marginW)} W</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                Sunlight weakens with the square of distance: 1361 W/m² at Earth becomes 1361 ÷ distance² at Mars.
                {advanced && ` Array power = irradiance × area × ${GAME.cellEfficiency} (cells) × ${GAME.arraySystemFactor} (losses) × (1 − shadow fraction).`}
              </p>
            </div>
          )}
          {open === 'budget' && (
            <div>
              {e.budget.lines.map((l) => (
                <div className="kv" key={l.label}>
                  <span>{l.label}</span>
                  <span>{l.cr} cr</span>
                </div>
              ))}
              <div className="kv kv--total">
                <span>Total · budget {e.budget.capCr} cr</span>
                <span className={e.budget.ok ? '' : 'coral'}>{e.budget.totalCr} cr</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>Credits are a simulated game budget. They are not real mission costs.</p>
            </div>
          )}
          {open === 'data' && (
            <div>
              <div className="kv">
                <span>Data produced by the payload</span>
                <span>{e.data.generatedMbPerDay} Mb/day</span>
              </div>
              <div className="kv">
                <span>Recorder capacity</span>
                <span>{formatData(e.data.capacityMb)}</span>
              </div>
              <div className="kv">
                <span>Days of observations the recorder can hold</span>
                <span>{e.data.bufferDays.toFixed(1)} days</span>
              </div>
              <div className="kv">
                <span>
                  <Term k="solar conjunction">Solar-conjunction</Term> blackout in this mission
                </span>
                <span>{e.data.blackoutDays} days</span>
              </div>
              <div className="kv kv--total">
                <span>Planned science data for the whole mission</span>
                <span>{formatData(e.data.plannedMb)}</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                1 Gb = 1000 Mb. The blackout length comes from real Sun–Earth–Mars geometry (JPL Horizons): the link is suspended while the angle is below{' '}
                {GAME.conjunctionSepDeg}°.
              </p>
            </div>
          )}
          {open === 'comms' && (
            <div>
              <div className="kv">
                <span>Link speed at 1 AU</span>
                <span>{formatRate(e.comms.rateAt1AuKbps)}</span>
              </div>
              <div className="kv">
                <span>
                  Earth–Mars distance during science <ProvenanceTag kind="verified_nasa_data" />
                </span>
                <span>
                  {e.comms.minAu.toFixed(2)}–{e.comms.maxAu.toFixed(2)} AU
                </span>
              </div>
              <div className="kv">
                <span>Link speed, nearest → farthest</span>
                <span>
                  {formatRate(e.comms.bestRateKbps)} → {formatRate(e.comms.worstRateKbps)}
                </span>
              </div>
              <div className="kv">
                <span>Contact time in this orbit</span>
                <span>{e.comms.contactHoursPerDay} h/day</span>
              </div>
              <div className="kv kv--total">
                <span>Average downlink · needed {e.data.generatedMbPerDay} Mb/day</span>
                <span className={`status-${e.status.comms}`}>{Math.round(e.comms.avgDownlinkMbPerDay)} Mb/day</span>
              </div>
              <div className="kv">
                <span>One-way signal delay, nearest → farthest</span>
                <span>
                  {formatLightTime(e.comms.minLightTimeS)} → {formatLightTime(e.comms.maxLightTimeS)}
                </span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                Data per day = link speed × contact time. Link speed falls with distance squared, so twice as far means one quarter of the speed.
              </p>
            </div>
          )}
          {open === 'duration' && (
            <div>
              {e.timeline.phases.map((p) => (
                <div className="kv" key={p.id}>
                  <span>
                    {p.label}
                    <span className="muted"> · {p.note}</span>
                  </span>
                  <span>
                    {formatJd(p.startJd)}
                    {p.days ? ` · ${p.days} d` : ''}
                  </span>
                </div>
              ))}
              <p className="xs muted" style={{ marginTop: 8 }}>
                Educational phases, not a computed trajectory. Transit uses a simplified Hohmann estimate ({e.timeline.transitDays} days).
              </p>
            </div>
          )}
        </div>
      )}
      <div className="dash__meters">
        <Meter
          id="mass"
          icon={<Weight size={13} />}
          label="Mass"
          value={`${Math.round(e.mass.wetKg)}`}
          unit={`/ ${e.mass.capacityKg} kg`}
          fill={e.mass.wetKg / e.mass.capacityKg}
          note={!e.mass.tankOk ? 'Tanks too small for this orbit' : e.mass.marginKg >= 0 ? `${Math.round(e.mass.marginKg)} kg to spare` : `${Math.round(-e.mass.marginKg)} kg too heavy`}
          status={e.status.mass}
          open={open === 'mass'}
          onToggle={() => toggle('mass')}
        />
        <Meter
          id="power"
          icon={<Battery size={13} />}
          label="Power"
          value={`${Math.round(e.power.consumptionW)}`}
          unit={`/ ${Math.round(e.power.availableW)} W`}
          fill={e.power.consumptionW / e.power.availableW}
          note={`${sign(e.power.marginW)} W margin`}
          status={e.status.power}
          open={open === 'power'}
          onToggle={() => toggle('power')}
        />
        <Meter
          id="budget"
          icon={<Banknote size={13} />}
          label="Budget"
          value={`${e.budget.totalCr}`}
          unit={`/ ${e.budget.capCr} cr`}
          fill={e.budget.totalCr / e.budget.capCr}
          note={e.budget.ok ? `${e.budget.remainingCr} credits left` : `${-e.budget.remainingCr} credits over`}
          status={e.status.budget}
          open={open === 'budget'}
          onToggle={() => toggle('budget')}
        />
        <Meter
          id="data"
          icon={<Database size={13} />}
          label="Data"
          value={`${e.data.generatedMbPerDay}`}
          unit="Mb/day"
          fill={e.data.blackoutVolumeMb / e.data.capacityMb}
          note={`Recorder: ${e.data.bufferDays.toFixed(0)} days`}
          status={e.status.data}
          open={open === 'data'}
          onToggle={() => toggle('data')}
        />
        <Meter
          id="comms"
          icon={<Radio size={13} />}
          label="Comms"
          value={`${Math.round(e.comms.avgDownlinkMbPerDay)}`}
          unit="Mb/day"
          fill={1 / e.comms.coverage}
          note={e.comms.coverage >= 1 ? `Link: ${e.comms.coverage.toFixed(1)}× the data` : `Only ${Math.round(e.comms.coverage * 100)} % fits`}
          status={e.status.comms}
          open={open === 'comms'}
          onToggle={() => toggle('comms')}
        />
        <Meter
          id="duration"
          icon={<CalendarClock size={13} />}
          label="Duration"
          value={`${e.timeline.scienceDays}`}
          unit="science days"
          fill={e.timeline.scienceDays / 687}
          note={`${e.timeline.totalDays} days in total`}
          status={e.status.duration}
          open={open === 'duration'}
          onToggle={() => toggle('duration')}
        />
      </div>
      {context && <div className="dash__context xs muted">{context}</div>}
    </div>
  );
}

export function IssueList({ issues, max = 3 }: { issues: Issue[]; max?: number }) {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'block' ? -1 : 1));
  if (sorted.length === 0) return null;
  return (
    <div className="stack stack--sm" data-testid="issues">
      {sorted.slice(0, max).map((i) => (
        <div key={i.title} className={`issue ${i.severity === 'block' ? 'issue--block' : ''}`} role={i.severity === 'block' ? 'alert' : 'status'}>
          <span className={i.severity === 'block' ? 'coral' : 'amber'} aria-hidden="true">
            {i.severity === 'block' ? '✕' : '!'}
          </span>
          <div>
            <b>{i.title}</b>
            {i.explain}
            <div className="fix">→ {i.fix}</div>
          </div>
        </div>
      ))}
      {sorted.length > max && <div className="xs muted">+ {sorted.length - max} more — open the resource meters for details.</div>}
    </div>
  );
}
