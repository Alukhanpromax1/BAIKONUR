import gsap from 'gsap';
import { t, useLangStore } from '@/i18n';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sfx } from '@/audio/sound';
import { ProvenanceTag } from '@/components/Tags';
import { COMPONENT_BY_ID, SLOTS } from '@/data/components';
import { VEHICLE_BY_ID } from '@/data/launchVehicles';
import { OBJECTIVE_BY_ID } from '@/data/objectives';
import { DURATION_BY_ID, ORBIT_BY_ID } from '@/data/orbits';
import { formatData, formatLightTime } from '@/game/engine/comms';
import { CHOICE_LABEL } from '@/game/ops/evaluate';
import { evaluateMission } from '@/game/scoring/score';
import { MISTAKE_DEFINITIONS } from '@/game/scoring/mistakes';
import { useGame } from '@/game/state/store';
import { formatJd } from '@/services/horizons/ephemeris';

const AXIS = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#9aa8be' };
const EVENT_NAME = { get conjunction() { return t('debrief.event_name.conjunction'); }, get power() { return t('debrief.event_name.power'); }, get storm() { return t('debrief.event_name.storm'); } } as const;

function ScoreRing({ total, tone }: { total: number; tone: string }) {
  const ring = useRef<SVGCircleElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const C = 2 * Math.PI * 52;
  useLayoutEffect(() => {
    const target = { v: reduced ? total : 0 };
    const apply = () => {
      if (ring.current) ring.current.style.strokeDashoffset = String(C * (1 - target.v / 100));
      if (number.current) number.current.textContent = String(Math.round(target.v));
    };
    apply();
    if (reduced) return;
    const tween = gsap.to(target, { v: total, duration: 1.8, delay: 0.5, ease: 'power2.out', onUpdate: apply });
    return () => {
      tween.kill();
    };
  }, [total, reduced, C]);
  return (
    <div className="ring" role="img" aria-label={t('debrief.mission_score_out_of_100', { total })}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,178,214,0.16)" strokeWidth="5" />
        <circle ref={ring} cx="60" cy="60" r="52" fill="none" stroke={tone} strokeWidth="5" strokeDasharray={C} strokeDashoffset={C} transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring__text">
        <span className="ring__n mono" ref={number} data-testid="score-total" data-score={total}>
          {total}
        </span>
        <span className="xs mono muted">/ 100</span>
      </div>
    </div>
  );
}

/** Scene 7 — deterministic evaluation, mistake analysis and replay. */
export default function MissionDebrief() {
  const design = useGame((s) => s.design);
  const seed = useGame((s) => s.seed);
  const scenario = useGame((s) => s.scenario);
  const readiness = useGame((s) => s.readiness);
  const ops = useGame((s) => s.ops);
  const players = useGame((s) => s.players);
  const teamStats = useGame((s) => s.teamStats);
  const missionLog = useGame((s) => s.missionLog);
  const addLog = useGame((s) => s.addLog);
  const tryAgain = useGame((s) => s.tryAgain);
  const newMission = useGame((s) => s.newMission);
  const advanced = useGame((s) => s.settings.mode === 'advanced');
  const reduced = useGame((s) => s.settings.reducedMotion);
  const root = useRef<HTMLDivElement>(null);
  const logged = useRef(false);
  const lang = useLangStore((s) => s.lang);

  const report = useMemo(
    () => evaluateMission({ design, seed, readiness: { scenario, choice: readiness.choice ?? 'cross', panelsViewed: readiness.panelsViewed, finalCall: readiness.finalCall }, ops }),
    [design, seed, scenario, readiness, ops, lang],
  );

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    sfx.reveal();
    addLog({ at: new Date().toISOString(), total: report.total, tier: report.tierLabel, objective: design.objective, payload: design.selections.payload, orbit: design.orbit, seed });
  }, [addLog, report, design, seed]);

  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-reveal]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.09, delay: 0.15 });
      gsap.fromTo('.cat__fill', { scaleX: 0 }, { scaleX: (_i, el) => Number((el as HTMLElement).dataset.v), duration: 1.1, ease: 'power2.out', delay: 0.9, stagger: 0.08 });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  const { sim } = report;
  const tone = report.tier === 'exemplary' || report.tier === 'success' ? '#52D7E8' : report.tier === 'partial' ? '#FFB84D' : '#FF7A6B';
  const chart = useMemo(() => {
    const out: { day: number; stored: number; returned: number; lost: number }[] = [];
    for (let i = 0; i < sim.steps.length; i += 2) {
      const s = sim.steps[i];
      out.push({ day: s.day, stored: +(s.storedMb / 1000).toFixed(2), returned: +(s.totalReturnedMb / 1000).toFixed(2), lost: +(s.totalLostMb / 1000).toFixed(2) });
    }
    return out;
  }, [sim]);
  const lt = sim.steps.reduce((a, s) => ({ min: Math.min(a.min, s.lightTimeS), max: Math.max(a.max, s.lightTimeS) }), { min: Infinity, max: 0 });
  const objective = OBJECTIVE_BY_ID[design.objective];
  const previous = missionLog.slice(1, 6);

  return (
    <div className="debrief scroll hit" ref={root}>
      <div className="debrief__col">
        <section className="debrief__hero" data-reveal>
          <ScoreRing total={report.total} tone={tone} />
          <div className="stack stack--sm">
            <div className="eyebrow">{t('debrief.mission_debrief_kazmars_1', { objective: objective.name })}</div>
            <h1 className="display" style={{ color: tone }} data-testid="outcome-tier">
              {report.tierLabel}
            </h1>
            <p className="lead">{report.tierSummary}</p>
            <div className="row row--wrap" style={{ marginTop: 6 }}>
              <button type="button" className="btn btn--lg" onClick={tryAgain} data-testid="try-again">
                <RotateCcw size={16} /> {t('debrief.try_again')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={newMission} data-testid="new-mission">
                <Sparkles size={15} /> {t('debrief.new_mission')}
              </button>
              <span className="xs mono muted" data-testid="seed">{t('debrief.scenario_seed', { seed })}</span>
            </div>
            <p className="xs muted">{t('debrief.try_again_keeps_your_spacecraft_for')}</p>
          </div>
        </section>

        <section className="cats" data-reveal>
          {report.categories.map((c) => (
            <div key={c.id} className="panel cat" data-testid={`cat-${c.id}`}>
              <div className="panel__body stack stack--sm">
                <div className="row row--between">
                  <span className="eyebrow eyebrow--muted">{c.label}</span>
                  <span className="mono">
                    <b style={{ fontSize: 20, fontWeight: 500 }}>{c.points}</b>
                    <span className="muted"> / {c.max}</span>
                  </span>
                </div>
                <div className="meter__bar"><span className="cat__fill meter__fill" data-v={c.points / c.max} style={{ transform: `scaleX(${c.points / c.max})` }} /></div>
                {c.lines.map((l) => (
                  <div key={l.label} className="cat__line">
                    <span>
                      {l.label}
                      <span className="xs muted"> · {l.detail}</span>
                    </span>
                    <span className="mono xs">{l.points}/{l.max}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="panel" data-reveal>
          <div className="panel__head">
            <span className="eyebrow">{t('debrief.mission_results')}</span>
            <ProvenanceTag kind="educational_game_assumption" label={t('debrief.game_model')} />
          </div>
          <div className="panel__body">
            <dl className="facts">
              <div><dt>{t('debrief.scientific_value')}</dt><dd>{Math.round(report.scienceValue)} / 100</dd></div>
              <div><dt>{t('debrief.data_returned')}</dt><dd>{formatData(sim.returnedMb)} · {Math.round(report.dataReturnFraction * 100)} %</dd></div>
              <div><dt>{t('debrief.data_lost_on_board')}</dt><dd className={sim.lostMb > 0 ? 'coral' : ''}>{formatData(sim.lostMb)}</dd></div>
              <div><dt>{t('debrief.communication_performance')}</dt><dd>{t('debrief.delivered', { commsDelivery: Math.round(report.commsDelivery * 100) })}</dd></div>
              <div><dt>{t('debrief.budget')}</dt><dd className={report.budget.ok ? '' : 'coral'}>{t('debrief.cr', { totalCr: report.budget.totalCr, capCr: report.budget.capCr })}</dd></div>
              <div><dt>{t('debrief.launch_mass')}</dt><dd>{t('debrief.kg', { wetKg: Math.round(report.mass.wetKg), capacityKg: report.mass.capacityKg })}</dd></div>
              <div><dt>{t('debrief.lowest_power_margin')}</dt><dd className={sim.worstFullMarginPct < 0.05 ? 'amber' : ''}>{Math.round(sim.worstFullMarginPct * 100)} %</dd></div>
              <div><dt>{t('debrief.days_in_safe_mode')}</dt><dd className={sim.safeModeDays ? 'coral' : ''}>{sim.safeModeDays}</dd></div>
            </dl>
            <div className="chart chart--tall" data-testid="chart-mission">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 14, right: 12, bottom: 4, left: -6 }}>
                  <CartesianGrid stroke="rgba(148,178,214,0.12)" vertical={false} />
                  <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: 'rgba(148,178,214,0.12)' }} unit={t('fmt.axis_d')} type="number" domain={[0, sim.timeline.scienceDays]} tickCount={8} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} unit={t('fmt.axis_gb')} width={64} />
                  <Tooltip contentStyle={{ background: '#16223a', border: '1px solid rgba(148,178,214,0.32)', borderRadius: 2, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} labelFormatter={(v) => t('debrief.science_day', { v: Number(v) })} />
                  <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                  {sim.events.map((e) => (
                    <ReferenceLine key={e.id} x={e.promptStep * sim.stepDays} stroke="#FFB84D" strokeDasharray="3 4" label={{ value: EVENT_NAME[e.id], position: 'insideTopLeft', ...AXIS, fill: '#FFB84D' }} />
                  ))}
                  <Area name={t('debrief.returned_to_earth_running_total_gb')} type="monotone" dataKey="returned" stroke="#52D7E8" fill="rgba(82,215,232,0.14)" strokeWidth={1.6} isAnimationActive={!reduced} animationDuration={1400} />
                  <Line name={t('debrief.waiting_on_the_recorder_gb')} type="monotone" dataKey="stored" stroke="#E8ECF1" strokeWidth={1.2} dot={false} isAnimationActive={!reduced} />
                  <Line name={t('debrief.lost_on_board_running_total_gb')} type="monotone" dataKey="lost" stroke="#FF7A6B" strokeWidth={1.4} dot={false} isAnimationActive={!reduced} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="xs muted">
              {t('debrief.delay_range', { a: formatLightTime(lt.min), b: formatLightTime(lt.max) })}{' '}
              <ProvenanceTag kind="verified_nasa_data" label={t('debrief.jpl_horizons_cached')} /> {t('debrief.science_ran', { a: formatJd(sim.timeline.scienceStartJd), b: formatJd(sim.timeline.scienceEndJd) })}
            </p>
          </div>
        </section>

        <section className="panel" data-reveal>
          <div className="panel__head"><span className="eyebrow">{t('debrief.decisions_and_their_consequences')}</span></div>
          <div className="panel__body stack">
            <div className="review">
              <div className="row row--between row--wrap">
                <h3 className="subtitle">{t('debrief.launch_readiness', { headline: report.readiness.headline })}</h3>
                <span className="mono small">{report.readiness.points}/{report.readiness.maxPoints}</span>
              </div>
              <p className="small muted">{report.readiness.narrative}</p>
              <p className="small"><b>{t('debrief.ground_truth')}</b> {report.readiness.truthTitle}. <span className="muted">{report.readiness.truthExplain}</span></p>
            </div>
            {report.opsReviews.map((r) => (
              <div key={r.event} className="review" data-testid={`review-${r.event}`}>
                <div className="row row--between row--wrap">
                  <h3 className="subtitle">{EVENT_NAME[r.event]} — {CHOICE_LABEL[r.choice]}</h3>
                  <span className="mono small">{r.points}/{r.maxPoints}</span>
                </div>
                <p className="small muted">{r.evidence}</p>
                <p className="small">{r.why}{!r.good && <> <b>{t('debrief.better_option')}</b> {CHOICE_LABEL[r.best].toLowerCase()}.</>}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="stack" data-reveal>
          <div className="row row--between row--wrap">
            <h2 className="title">{report.mistakes.length ? t('debrief.key_mistakes_and_what_they_teach') : t('debrief.no_key_mistakes')}</h2>
            <span className="tag">{t('debrief.found', { mistakes: report.mistakes.length })}</span>
          </div>
          {report.mistakes.length === 0 && (
            <p className="muted">{t('debrief.your_decisions_matched_the_evidence_and')}</p>
          )}
          {report.mistakes.map((m) => (
            <article key={m.title} className="panel panel--amber mistake" data-testid="mistake">
              <div className="panel__body stack stack--sm">
                <div className="row row--wrap">
                  <span className="tag tag--amber" title={MISTAKE_DEFINITIONS[m.type]}>{m.type}</span>
                  <span className="xs muted">{MISTAKE_DEFINITIONS[m.type]}</span>
                </div>
                <h3 className="subtitle">{m.title}</h3>
                <ol className="mistake__steps">
                  <li><span>{t('debrief.the_decision')}</span><p>{m.decision}</p></li>
                  <li><span>{t('debrief.the_evidence_at_the_time')}</span><p>{m.evidence}</p></li>
                  <li><span>{t('debrief.what_was_misunderstood')}</span><p>{m.misunderstanding}</p></li>
                  <li><span>{t('debrief.the_consequence')}</span><p>{m.consequence}</p></li>
                  <li className="mistake__lesson"><span>{t('debrief.engineering_lesson')}</span><p>{m.lesson}</p></li>
                </ol>
              </div>
            </article>
          ))}
          <div className="panel panel--plain">
            <div className="panel__body">
              <div className="eyebrow">{t('debrief.what_went_well')}</div>
              <ul className="plain-list small" style={{ marginTop: 8 }}>
                {report.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="debrief__two" data-reveal>
          <div className="panel">
            <div className="panel__head"><span className="eyebrow">{t('debrief.spacecraft_configuration')}</span></div>
            <div className="panel__body">
              {SLOTS.map((s) => (
                <div className="kv" key={s.id}><span>{s.label}</span><span>{COMPONENT_BY_ID[design.selections[s.id]].name}</span></div>
              ))}
              <div className="kv"><span>{t('debrief.launch_vehicle')}</span><span>{VEHICLE_BY_ID[design.vehicle].name}</span></div>
              <div className="kv"><span>{t('debrief.orbit')}</span><span>{ORBIT_BY_ID[design.orbit].name}</span></div>
              <div className="kv"><span>{t('debrief.science_phase')}</span><span>{DURATION_BY_ID[design.duration].name}</span></div>
              {advanced && (
                <>
                  <div className="eyebrow eyebrow--muted" style={{ margin: '14px 0 4px' }}>{t('debrief.science_value_model')}</div>
                  {report.science.parts.map((p) => (
                    <div className="kv" key={p.key}><span>{t('debrief.quality_weight', { p: p.label, quality: Math.round(p.quality * 100), weight: Math.round(p.weight * 100) })}</span><span>{(p.contribution * 100).toFixed(1)}</span></div>
                  ))}
                  <div className="kv"><span>{t('debrief.data_returned_storm_bonus', { dataReturnFraction: Math.round(report.dataReturnFraction * 100), stormBonus: (1 + report.stormBonus).toFixed(2) })}</span><span>{report.scienceValue.toFixed(1)}</span></div>
                </>
              )}
            </div>
          </div>
          <div className="stack">
            {players.length > 1 && (
              <div className="panel" data-testid="team-report">
                <div className="panel__head"><span className="eyebrow">{t('debrief.team_coordination')}</span></div>
                <div className="panel__body">
                  <div className="kv"><span>{t('debrief.team_decisions_made')}</span><span>{teamStats.decisions}</span></div>
                  <div className="kv"><span>{t('debrief.every_role_proposed_before_deciding')}</span><span>{t('debrief.of', { fullyDiscussed: teamStats.fullyDiscussed, decisions: teamStats.decisions })}</span></div>
                  <div className="kv"><span>{t('debrief.unanimous_decisions')}</span><span>{t('debrief.of_2', { unanimous: teamStats.unanimous, decisions: teamStats.decisions })}</span></div>
                  <p className="xs muted" style={{ marginTop: 8 }}>
                    {teamStats.decisions > 0 && teamStats.fullyDiscussed === teamStats.decisions
                      ? t('debrief.well_coordinated_every_voice_was_heard')
                      : t('debrief.tip_let_every_role_propose_before')}
                  </p>
                </div>
              </div>
            )}
            <div className="panel">
              <div className="panel__head"><span className="eyebrow">{t('debrief.mission_log')}</span><span className="xs muted">{t('debrief.saved_on_this_device')}</span></div>
              <div className="panel__body">
                {previous.length === 0 && <p className="small muted">{t('debrief.this_is_your_first_recorded_mission')}</p>}
                {previous.map((l) => (
                  <div className="kv" key={l.at}>
                    <span>{OBJECTIVE_BY_ID[l.objective]?.name} · {COMPONENT_BY_ID[l.payload]?.short} · {ORBIT_BY_ID[l.orbit]?.name}</span>
                    <span>{l.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <p className="xs dim" data-reveal>
          {t('debrief.kazmars_1_is_a_fictional_educational')}
        </p>
      </div>
    </div>
  );
}
