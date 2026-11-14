import { COMPONENT_BY_ID } from '@/data/components';
import { GAME } from '@/data/constants';
import { ORBIT_BY_ID } from '@/data/orbits';
import { computeTimeline, type MissionTimeline } from '@/game/engine/duration';
import { downlinkRateKbps, downlinkVolumeMb } from '@/game/engine/comms';
import { orbitAveragePowerW, totalConsumptionW } from '@/game/engine/power';
import { sampleAt } from '@/services/horizons/ephemeris';
import type { MissionDesign } from '@/types';

export type OpsEventId = 'conjunction' | 'power' | 'storm';
export type ConjunctionChoice = 'store' | 'reduce' | 'command';
export type PowerChoice = 'full' | 'cycle' | 'reserve';
export type StormChoice = 'campaign' | 'nominal' | 'protect';

export interface OpsDecisions {
  conjunction?: ConjunctionChoice;
  power?: PowerChoice;
  storm?: StormChoice;
}

/** Flight rule used by the game: keep at least this much power margin. */
export const POWER_MARGIN_RULE = 0.05;
export const POWER_MODE = {
  full: { consumption: 1, data: 1, downlink: 1 },
  cycle: { consumption: 0.88, data: 0.7, downlink: 0.8 },
  reserve: { consumption: 0.78, data: 0.3, downlink: 0.5 },
} as const;
export const STORM_MODE = { campaign: 1.8, nominal: 1, protect: 0.5 } as const;
export const STORM_DAYS = 20;
export const CONJUNCTION_REDUCE_FACTOR = 0.4;
const SAFE_MODE_CONSUMPTION = 0.6;

export interface OpsEvent {
  id: OpsEventId;
  /** Step index at which the team is asked to decide. */
  promptStep: number;
  /** Steps during which the event's conditions apply (inclusive start, exclusive end). */
  windowStart: number;
  windowEnd: number;
}

export interface SimStep {
  index: number;
  jd: number;
  /** Days since the start of the science phase. */
  day: number;
  sunMarsAu: number;
  earthMarsAu: number;
  lightTimeS: number;
  sepDeg: number;
  blackout: boolean;
  safeMode: boolean;
  powerMode: PowerChoice;
  availableW: number;
  consumptionW: number;
  marginW: number;
  marginPct: number;
  rateKbps: number;
  generatedMb: number;
  downlinkCapacityMb: number;
  returnedMb: number;
  lostMb: number;
  storedMb: number;
  /** Running totals. */
  totalGeneratedMb: number;
  totalReturnedMb: number;
  totalLostMb: number;
}

export interface SimOptions {
  /** Launch delay caused by the readiness outcome. */
  slipDays?: number;
  /** Days at the start of science with a degraded telemetry chain (readiness outcome). */
  degradedLinkDays?: number;
  decisions?: OpsDecisions;
  /** Stop after this step index (used to pause at a decision). */
  untilStep?: number;
}

export interface SimResult {
  timeline: MissionTimeline;
  events: OpsEvent[];
  steps: SimStep[];
  stepDays: number;
  capacityMb: number;
  nominalDailyMb: number;
  /** What the nominal plan would generate over the full science phase. */
  plannedMb: number;
  generatedMb: number;
  returnedMb: number;
  lostMb: number;
  /** Data still on the recorder at the end; played back during mission wrap-up. */
  finalPlaybackMb: number;
  safeModeDays: number;
  /** Lowest full-operations power margin seen during the science phase. */
  worstFullMarginPct: number;
  minMarginPct: number;
  /** Lost megabits attributed to each event window. */
  lostInWindowMb: Record<OpsEventId, number>;
  stormCampaignReturned: boolean;
  powerFault: 'none' | 'safe-mode' | 'brownout';
  conjunctionFault: boolean;
  complete: boolean;
}

interface Geometry {
  jd: number;
  sunMarsAu: number;
  earthMarsAu: number;
  lightTimeS: number;
  sepDeg: number;
}

function geometryFor(timeline: MissionTimeline): Geometry[] {
  const out: Geometry[] = [];
  const n = Math.ceil(timeline.scienceDays / GAME.simStepDays);
  for (let i = 0; i < n; i++) {
    const s = sampleAt(timeline.scienceStartJd + i * GAME.simStepDays);
    out.push({ jd: s.jd, sunMarsAu: s.sunMarsAu, earthMarsAu: s.earthMarsAu, lightTimeS: s.lightTimeS, sepDeg: s.sepDeg });
  }
  return out;
}

/**
 * Where the three operational events fall. Conjunction timing comes from the real
 * Sun–Earth–Mars geometry; the low-power season is centred on the real maximum Sun–Mars
 * distance in the science phase; the dust-storm date is a fictional gameplay event.
 */
export function planEvents(design: MissionDesign, geo: Geometry[]): OpsEvent[] {
  const n = geo.length;
  const dt = GAME.simStepDays;
  const steps = (days: number) => Math.round(days / dt);
  const events: OpsEvent[] = [];

  // 1 — Solar conjunction (real geometry).
  let cStart = -1;
  let cEnd = -1;
  for (let i = 0; i < n; i++) {
    if (geo[i].sepDeg < GAME.conjunctionSepDeg) {
      if (cStart < 0) cStart = i;
      cEnd = i + 1;
    }
  }
  if (cStart >= 0) {
    events.push({ id: 'conjunction', promptStep: Math.max(1, cStart - steps(6)), windowStart: cStart, windowEnd: cEnd });
  }

  // 2 — Low-power season around the farthest point from the Sun (real geometry).
  const area = COMPONENT_BY_ID[design.selections.power].arrayAreaM2 ?? 0;
  const eclipse = ORBIT_BY_ID[design.orbit].eclipseFraction;
  const consumption = totalConsumptionW(design);
  const marginAt = (i: number) => orbitAveragePowerW(area, geo[i].sunMarsAu, eclipse) / consumption - 1;
  let far = steps(20);
  for (let i = steps(20); i < n - steps(20); i++) if (geo[i].sunMarsAu > geo[far].sunMarsAu) far = i;
  let pStart = Math.max(1, far - steps(30));
  let pEnd = Math.min(n, far + steps(30));
  while (pStart > 1 && marginAt(pStart - 1) < POWER_MARGIN_RULE + 0.03) pStart--;
  while (pEnd < n && marginAt(pEnd) < POWER_MARGIN_RULE + 0.03) pEnd++;
  events.push({ id: 'power', promptStep: pStart, windowStart: pStart, windowEnd: pEnd });

  // 3 — Regional dust storm (fictional gameplay event), kept clear of the other prompts.
  const far60 = (i: number) => events.every((e) => Math.abs(e.promptStep - i) >= steps(60));
  const outside = (i: number) => events.every((e) => i + steps(STORM_DAYS) < e.windowStart || i > e.windowEnd);
  const candidates: number[] = [];
  for (const f of [0.55, 0.7, 0.42, 0.82, 0.3, 0.18, 0.62, 0.9, 0.12]) candidates.push(Math.round(n * f));
  const usable = (i: number) => i > 2 && i + steps(STORM_DAYS) < n;
  // Prefer a date clear of both other events; otherwise at least 60 days from their prompts.
  let storm = candidates.find((i) => usable(i) && far60(i) && outside(i)) ?? candidates.find((i) => usable(i) && far60(i)) ?? -1;
  if (storm < 0) {
    let best = -1;
    for (const i of candidates.filter(usable)) {
      const gap = Math.min(...events.map((e) => Math.abs(e.promptStep - i)));
      if (gap > best) {
        best = gap;
        storm = i;
      }
    }
  }
  if (storm < 0) storm = Math.round(n * 0.5);
  events.push({ id: 'storm', promptStep: storm, windowStart: storm, windowEnd: Math.min(n, storm + steps(STORM_DAYS)) });

  // Guarantee distinct prompt steps in chronological order.
  events.sort((a, b) => a.promptStep - b.promptStep);
  for (let i = 1; i < events.length; i++) {
    if (events[i].promptStep <= events[i - 1].promptStep) events[i].promptStep = events[i - 1].promptStep + 1;
  }
  return events;
}

const deeper = (mode: PowerChoice): PowerChoice => (mode === 'full' ? 'cycle' : 'reserve');

/**
 * Deterministic mission simulation of the science phase in 2-day steps.
 * Real inputs: Sun–Mars distance (solar power), Earth–Mars distance (data rate),
 * light time and Sun–Earth–Mars angle (conjunction) from the JPL Horizons snapshot.
 * Everything else is an illustrative game model.
 */
export function simulateMission(design: MissionDesign, options: SimOptions = {}): SimResult {
  const decisions = options.decisions ?? {};
  const timeline = computeTimeline(design, options.slipDays ?? 0);
  const geo = geometryFor(timeline);
  const events = planEvents(design, geo);
  const dt = GAME.simStepDays;
  const n = geo.length;
  const until = Math.min(n, options.untilStep ?? n);

  const sel = design.selections;
  const payload = COMPONENT_BY_ID[sel.payload];
  const orbit = ORBIT_BY_ID[design.orbit];
  const area = COMPONENT_BY_ID[sel.power].arrayAreaM2 ?? 0;
  const rate1Au = COMPONENT_BY_ID[sel.comms].rateKbpsAt1Au ?? 0;
  const capacityMb = (COMPONENT_BY_ID[sel.storage].capacityGb ?? 0) * 1000;
  const nominalDailyMb = payload.dataMbPerDay ?? 0;
  const consumptionFull = totalConsumptionW(design);

  const ev = (id: OpsEventId) => events.find((e) => e.id === id);
  const conj = ev('conjunction');
  const pow = ev('power');
  const storm = ev('storm');
  const inWindow = (e: OpsEvent | undefined, i: number) => !!e && i >= e.windowStart && i < e.windowEnd;

  const steps: SimStep[] = [];
  let stored = 0;
  let totalGenerated = 0;
  let totalReturned = 0;
  let totalLost = 0;
  let safeModeUntil = -1;
  let safeModeSteps = 0;
  let powerMode: PowerChoice = 'full';
  let powerFault: SimResult['powerFault'] = 'none';
  let conjunctionFault = false;
  let worstFull = Infinity;
  let minMargin = Infinity;
  const lostInWindow: Record<OpsEventId, number> = { conjunction: 0, power: 0, storm: 0 };
  const degradedSteps = Math.round((options.degradedLinkDays ?? 0) / dt);

  for (let i = 0; i < until; i++) {
    const g = geo[i];
    const blackout = inWindow(conj, i);
    const available = orbitAveragePowerW(area, g.sunMarsAu, orbit.eclipseFraction);
    const fullMargin = available / consumptionFull - 1;
    worstFull = Math.min(worstFull, fullMargin);

    // Power mode: the chosen mode applies inside the low-power window.
    if (pow && i === pow.windowStart) powerMode = decisions.power ?? 'full';
    if (pow && i === pow.windowEnd) powerMode = 'full';
    if (pow && inWindow(pow, i) && i >= safeModeUntil) {
      const modeMargin = available / (consumptionFull * POWER_MODE[powerMode].consumption) - 1;
      if (modeMargin < POWER_MARGIN_RULE && powerMode !== 'reserve') {
        // Margin rule broken: the spacecraft protects itself, then the Flight Director
        // orders the next deeper power-saving mode.
        const days = powerMode === 'full' ? 14 : 7;
        if (powerFault === 'none') powerFault = powerMode === 'full' ? 'safe-mode' : 'brownout';
        safeModeUntil = i + Math.round(days / dt);
        powerMode = deeper(powerMode);
      }
    }

    // Commanding through conjunction corrupts a command: safe mode after the blackout.
    if (conj && decisions.conjunction === 'command' && i === conj.windowEnd) {
      conjunctionFault = true;
      safeModeUntil = Math.max(safeModeUntil, i + Math.round(10 / dt));
    }

    const safeMode = i < safeModeUntil;
    if (safeMode) safeModeSteps++;
    const mode = POWER_MODE[powerMode];

    let dataFactor: number = mode.data;
    if (blackout && decisions.conjunction === 'reduce') dataFactor *= CONJUNCTION_REDUCE_FACTOR;
    if (inWindow(storm, i)) dataFactor *= STORM_MODE[decisions.storm ?? 'nominal'];
    if (safeMode) dataFactor = 0;

    const consumption = consumptionFull * (safeMode ? SAFE_MODE_CONSUMPTION : mode.consumption);
    const margin = available - consumption;
    minMargin = Math.min(minMargin, margin / consumption);

    const rateKbps = downlinkRateKbps(rate1Au, g.earthMarsAu);
    let downCap = downlinkVolumeMb(rateKbps, orbit.contactHoursPerDay) * dt * mode.downlink;
    if (i < degradedSteps) downCap *= 0.7;
    if (blackout || safeMode) downCap = 0;

    const generated = nominalDailyMb * dataFactor * dt;
    stored += generated;
    const returned = Math.min(stored, downCap);
    stored -= returned;
    let lost = 0;
    if (stored > capacityMb) {
      lost = stored - capacityMb;
      stored = capacityMb;
    }
    totalGenerated += generated;
    totalReturned += returned;
    totalLost += lost;
    if (lost > 0) {
      // Attribute losses to the event whose window (plus a recovery tail) covers this step.
      const tail = Math.round(40 / dt);
      if (conj && i >= conj.windowStart && i < conj.windowEnd + tail) lostInWindow.conjunction += lost;
      if (storm && i >= storm.windowStart && i < storm.windowEnd + tail) lostInWindow.storm += lost;
      if (pow && i >= pow.windowStart && i < pow.windowEnd) lostInWindow.power += lost;
    }

    steps.push({
      index: i,
      jd: g.jd,
      day: i * dt,
      sunMarsAu: g.sunMarsAu,
      earthMarsAu: g.earthMarsAu,
      lightTimeS: g.lightTimeS,
      sepDeg: g.sepDeg,
      blackout,
      safeMode,
      powerMode,
      availableW: available,
      consumptionW: consumption,
      marginW: margin,
      marginPct: margin / consumption,
      rateKbps: blackout || safeMode ? 0 : rateKbps * mode.downlink * (i < degradedSteps ? 0.7 : 1),
      generatedMb: generated,
      downlinkCapacityMb: downCap,
      returnedMb: returned,
      lostMb: lost,
      storedMb: stored,
      totalGeneratedMb: totalGenerated,
      totalReturnedMb: totalReturned,
      totalLostMb: totalLost,
    });
  }

  const complete = until >= n;
  const finalPlaybackMb = complete ? stored : 0;
  return {
    timeline,
    events,
    steps,
    stepDays: dt,
    capacityMb,
    nominalDailyMb,
    plannedMb: nominalDailyMb * timeline.scienceDays,
    generatedMb: totalGenerated,
    returnedMb: totalReturned + finalPlaybackMb,
    lostMb: totalLost,
    finalPlaybackMb,
    safeModeDays: safeModeSteps * dt,
    worstFullMarginPct: worstFull,
    minMarginPct: minMargin,
    lostInWindowMb: lostInWindow,
    stormCampaignReturned: decisions.storm === 'campaign' && lostInWindow.storm === 0,
    powerFault,
    conjunctionFault,
    complete,
  };
}
