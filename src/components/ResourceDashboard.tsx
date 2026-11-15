import { Banknote, Battery, CalendarClock, Database, Radio, Weight, X } from 'lucide-react';
import { t } from '@/i18n';
import { T } from '@/i18n/Trans';
import { useEffect, useRef, useState } from 'react';
import { GAME, MARS_MEAN_SUN_DISTANCE_AU } from '@/data/constants';
import { formatData, formatLightTime, formatRate } from '@/game/engine/comms';
import type { DesignEvaluation, Issue, Status } from '@/game/engine/resources';
import { useGame } from '@/game/state/store';
import { formatJd } from '@/services/horizons/ephemeris';
import { ProvenanceTag, Term } from './Tags';

type ResourceId = Issue['resource'];

const STATUS_TEXT: Record<Status, string> = { get ok() { return t('dash.status_text.ok'); }, get tight() { return t('dash.status_text.tight'); }, get over() { return t('dash.status_text.over'); } };

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
            <span className="eyebrow">{open === 'comms' ? t('dash.communications') : open === 'duration' ? t('dash.mission_duration') : open === 'data' ? t('dash.science_data') : open}</span>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setOpen(null)} aria-label={t('dash.close_details')}>
              <X size={16} />
            </button>
          </div>
          {open === 'mass' && (
            <div>
              {e.mass.lines.map((l) => (
                <div className="kv" key={l.label}>
                  <span>{l.label}</span>
                  <span>{t('u.kg', { n: l.kg })}</span>
                </div>
              ))}
              <div className="kv">
                <span>
                  <T k="dash.propellant_line" params={{ dv: e.mass.deltaVKmS.toFixed(2), tank: e.mass.tankCapacityKg }} tags={{ term: (c) => <Term k="delta-v">{c}</Term> }} />
                </span>
                <span className={e.mass.tankOk ? '' : 'coral'}>{t('u.kg', { n: Math.round(e.mass.propellantKg) })}</span>
              </div>
              <div className="kv kv--total">
                <span>{t('dash.launch_mass_limit_kg', { capacityKg: e.mass.capacityKg })}</span>
                <span>{t('u.kg', { n: Math.round(e.mass.wetKg) })}</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                {t('dash.rocket_equation_note')}
                {advanced && t('dash.m_prop_m_dry_e_v')}
              </p>
            </div>
          )}
          {open === 'power' && (
            <div>
              <div className="kv">
                <span>{t('dash.sunlight_at_mars_mean_distance_au', { MARS_MEAN_SUN_DISTANCE_AU })}</span>
                <span>{Math.round(e.power.irradianceWm2)} W/m²</span>
              </div>
              <div className="kv">
                <span>{t('dash.array_output_in_sunlight')}</span>
                <span>{Math.round(e.power.sunlitW)} W</span>
              </div>
              <div className="kv kv--total">
                <span>{t('dash.available_after_time_in_shadow')}</span>
                <span>{Math.round(e.power.availableW)} W</span>
              </div>
              <div className="kv">
                <span>{t('dash.instrument_consumption')}</span>
                <span>{e.power.instrumentW} W</span>
              </div>
              <div className="kv">
                <span>{t('dash.bus_consumption')}</span>
                <span>{e.power.busW} W</span>
              </div>
              <div className="kv">
                <span>{t('dash.radio_recorder_and_propulsion_heaters')}</span>
                <span>{e.power.subsystemW} W</span>
              </div>
              <div className="kv kv--total">
                <span>{t('dash.remaining_power_margin')}</span>
                <span className={`status-${e.status.power}`}>{sign(e.power.marginW)} W</span>
              </div>
              <div className="kv">
                <span>{t('dash.margin_at_the_farthest_point_from', { distanceAu: e.powerWorst.distanceAu.toFixed(2) })}</span>
                <span>{sign(e.powerWorst.marginW)} W</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                {t('dash.inverse_square_note')}
                {advanced && t('dash.array_power_irradiance_area_cells_losses', { cellEfficiency: GAME.cellEfficiency, arraySystemFactor: GAME.arraySystemFactor })}
              </p>
            </div>
          )}
          {open === 'budget' && (
            <div>
              {e.budget.lines.map((l) => (
                <div className="kv" key={l.label}>
                  <span>{l.label}</span>
                  <span>{t('u.cr', { n: l.cr })}</span>
                </div>
              ))}
              <div className="kv kv--total">
                <span>{t('dash.total_budget_cr', { capCr: e.budget.capCr })}</span>
                <span className={e.budget.ok ? '' : 'coral'}>{t('u.cr', { n: e.budget.totalCr })}</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>{t('dash.credits_are_a_simulated_game_budget')}</p>
            </div>
          )}
          {open === 'data' && (
            <div>
              <div className="kv">
                <span>{t('dash.data_produced_by_the_payload')}</span>
                <span>{t('u.mbday', { n: e.data.generatedMbPerDay })}</span>
              </div>
              <div className="kv">
                <span>{t('dash.recorder_capacity')}</span>
                <span>{formatData(e.data.capacityMb)}</span>
              </div>
              <div className="kv">
                <span>{t('dash.days_of_observations_the_recorder_can')}</span>
                <span>{t('u.days', { n: e.data.bufferDays.toFixed(1) })}</span>
              </div>
              <div className="kv">
                <span>
                  <T k="dash.blackout_line" tags={{ sc: (c) => <Term k="solar conjunction">{c}</Term> }} />
                </span>
                <span>{t('u.days', { n: e.data.blackoutDays })}</span>
              </div>
              <div className="kv kv--total">
                <span>{t('dash.planned_science_data_for_the_whole')}</span>
                <span>{formatData(e.data.plannedMb)}</span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                {t('dash.1_gb_1000_mb_the_blackout', { conjunctionSepDeg: GAME.conjunctionSepDeg })}
              </p>
            </div>
          )}
          {open === 'comms' && (
            <div>
              <div className="kv">
                <span>{t('dash.link_speed_at_1_au')}</span>
                <span>{formatRate(e.comms.rateAt1AuKbps)}</span>
              </div>
              <div className="kv">
                <span>
                  {t('dash.earth_mars_distance_during_science')}{' '} <ProvenanceTag kind="verified_nasa_data" />
                </span>
                <span>
                  {t('dash.au', { minAu: e.comms.minAu.toFixed(2), maxAu: e.comms.maxAu.toFixed(2) })}
                </span>
              </div>
              <div className="kv">
                <span>{t('dash.link_speed_nearest_farthest')}</span>
                <span>
                  {formatRate(e.comms.bestRateKbps)} → {formatRate(e.comms.worstRateKbps)}
                </span>
              </div>
              <div className="kv">
                <span>{t('dash.contact_time_in_this_orbit')}</span>
                <span>{t('u.hday', { n: e.comms.contactHoursPerDay })}</span>
              </div>
              <div className="kv kv--total">
                <span>{t('dash.average_downlink_needed_mb_day', { generatedMbPerDay: e.data.generatedMbPerDay })}</span>
                <span className={`status-${e.status.comms}`}>{t('u.mbday', { n: Math.round(e.comms.avgDownlinkMbPerDay) })}</span>
              </div>
              <div className="kv">
                <span>{t('dash.one_way_signal_delay_nearest_farthest')}</span>
                <span>
                  {formatLightTime(e.comms.minLightTimeS)} → {formatLightTime(e.comms.maxLightTimeS)}
                </span>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                {t('dash.data_per_day_link_speed_contact')}
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
                {t('dash.educational_phases_not_a_computed_trajectory', { transitDays: e.timeline.transitDays })}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="dash__meters">
        <Meter
          id="mass"
          icon={<Weight size={13} />}
          label={t('dash.mass')}
          value={`${Math.round(e.mass.wetKg)}`}
          unit={t('dash.of_kg', { n: e.mass.capacityKg })}
          fill={e.mass.wetKg / e.mass.capacityKg}
          note={!e.mass.tankOk ? t('dash.tanks_too_small_for_this_orbit') : e.mass.marginKg >= 0 ? t('dash.kg_to_spare', { marginKg: Math.round(e.mass.marginKg) }) : t('dash.kg_too_heavy', { marginKg: Math.round(-e.mass.marginKg) })}
          status={e.status.mass}
          open={open === 'mass'}
          onToggle={() => toggle('mass')}
        />
        <Meter
          id="power"
          icon={<Battery size={13} />}
          label={t('dash.power')}
          value={`${Math.round(e.power.consumptionW)}`}
          unit={t('dash.of_w', { n: Math.round(e.power.availableW) })}
          fill={e.power.consumptionW / e.power.availableW}
          note={t('dash.w_margin', { marginW: sign(e.power.marginW) })}
          status={e.status.power}
          open={open === 'power'}
          onToggle={() => toggle('power')}
        />
        <Meter
          id="budget"
          icon={<Banknote size={13} />}
          label={t('dash.budget')}
          value={`${e.budget.totalCr}`}
          unit={t('dash.of_cr', { n: e.budget.capCr })}
          fill={e.budget.totalCr / e.budget.capCr}
          note={e.budget.ok ? t('dash.credits_left', { remainingCr: e.budget.remainingCr }) : t('dash.credits_over', { remainingCr: -e.budget.remainingCr })}
          status={e.status.budget}
          open={open === 'budget'}
          onToggle={() => toggle('budget')}
        />
        <Meter
          id="data"
          icon={<Database size={13} />}
          label={t('dash.data')}
          value={`${e.data.generatedMbPerDay}`}
          unit={t('dash.unit_mbday')}
          fill={e.data.blackoutVolumeMb / e.data.capacityMb}
          note={t('dash.recorder_days', { bufferDays: e.data.bufferDays.toFixed(0) })}
          status={e.status.data}
          open={open === 'data'}
          onToggle={() => toggle('data')}
        />
        <Meter
          id="comms"
          icon={<Radio size={13} />}
          label={t('dash.comms')}
          value={`${Math.round(e.comms.avgDownlinkMbPerDay)}`}
          unit={t('dash.unit_mbday')}
          fill={1 / e.comms.coverage}
          note={e.comms.coverage >= 1 ? t('dash.link_the_data', { coverage: e.comms.coverage.toFixed(1) }) : t('dash.only_fits', { coverage: Math.round(e.comms.coverage * 100) })}
          status={e.status.comms}
          open={open === 'comms'}
          onToggle={() => toggle('comms')}
        />
        <Meter
          id="duration"
          icon={<CalendarClock size={13} />}
          label={t('dash.duration')}
          value={`${e.timeline.scienceDays}`}
          unit={t('dash.unit_science_days')}
          fill={e.timeline.scienceDays / 687}
          note={t('dash.days_in_total', { totalDays: e.timeline.totalDays })}
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
      {sorted.length > max && <div className="xs muted">{t('dash.more_open_the_resource_meters_for', { sorted: sorted.length - max })}</div>}
    </div>
  );
}
