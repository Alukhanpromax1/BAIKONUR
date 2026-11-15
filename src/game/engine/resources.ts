import { COMPONENT_BY_ID } from '@/data/components';
import { t } from '@/i18n';
import { GAME } from '@/data/constants';
import { VEHICLE_BY_ID } from '@/data/launchVehicles';
import { ORBIT_BY_ID } from '@/data/orbits';
import { simulateMission } from '@/game/ops/simulate';
import type { MissionDesign } from '@/types';
import { computeBudget, type BudgetSummary } from './budget';
import { downlinkRateKbps, downlinkVolumeMb } from './comms';
import { computeTimeline, type MissionTimeline } from './duration';
import { computeMass, type MassSummary } from './mass';
import { computePower, type PowerSummary } from './power';
import { sciencePotential, type ScienceBreakdown } from './science';

export type Status = 'ok' | 'tight' | 'over';

export interface DataSummary {
  generatedMbPerDay: number;
  capacityMb: number;
  /** Days of observations the recorder can hold with no downlink. */
  bufferDays: number;
  /** Days of communications blackout at solar conjunction in this mission. */
  blackoutDays: number;
  blackoutVolumeMb: number;
  plannedMb: number;
}

export interface CommsSummary {
  rateAt1AuKbps: number;
  contactHoursPerDay: number;
  /** Earth–Mars distance range during the science phase (real, from JPL Horizons). */
  minAu: number;
  maxAu: number;
  avgDownlinkMbPerDay: number;
  worstDownlinkMbPerDay: number;
  bestRateKbps: number;
  worstRateKbps: number;
  /** Average downlink ÷ data generated. Below 1, data piles up. */
  coverage: number;
  minLightTimeS: number;
  maxLightTimeS: number;
  /** Share of the planned data a hands-off mission would return. */
  predictedReturn: number;
}

export interface Issue {
  severity: 'block' | 'warn';
  resource: 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'duration';
  title: string;
  explain: string;
  fix: string;
}

export interface DesignEvaluation {
  mass: MassSummary;
  power: PowerSummary;
  powerWorst: PowerSummary;
  budget: BudgetSummary;
  data: DataSummary;
  comms: CommsSummary;
  timeline: MissionTimeline;
  science: ScienceBreakdown;
  issues: Issue[];
  status: Record<Issue['resource'], Status>;
  launchReady: boolean;
}

/** The full resource picture of a design. Pure and deterministic. */
export function evaluateDesign(design: MissionDesign): DesignEvaluation {
  const mass = computeMass(design);
  const power = computePower(design);
  const budget = computeBudget(design);
  const timeline = computeTimeline(design);
  const sim = simulateMission(design);
  const orbit = ORBIT_BY_ID[design.orbit];
  const payload = COMPONENT_BY_ID[design.selections.payload];
  const comm = COMPONENT_BY_ID[design.selections.comms];
  const rate1 = comm.rateKbpsAt1Au ?? 0;

  let maxSun = 0;
  let minAu = Infinity;
  let maxAu = 0;
  let minLt = Infinity;
  let maxLt = 0;
  let sumDown = 0;
  let countDown = 0;
  let worstDown = Infinity;
  let blackoutSteps = 0;
  for (const s of sim.steps) {
    maxSun = Math.max(maxSun, s.sunMarsAu);
    minAu = Math.min(minAu, s.earthMarsAu);
    maxAu = Math.max(maxAu, s.earthMarsAu);
    minLt = Math.min(minLt, s.lightTimeS);
    maxLt = Math.max(maxLt, s.lightTimeS);
    if (s.blackout) {
      blackoutSteps++;
      continue;
    }
    const perDay = downlinkVolumeMb(downlinkRateKbps(rate1, s.earthMarsAu), orbit.contactHoursPerDay);
    sumDown += perDay;
    countDown++;
    worstDown = Math.min(worstDown, perDay);
  }
  const powerWorst = computePower(design, maxSun);
  const gen = payload.dataMbPerDay ?? 0;
  const capacityMb = sim.capacityMb;
  const blackoutDays = blackoutSteps * GAME.simStepDays;
  const data: DataSummary = {
    generatedMbPerDay: gen,
    capacityMb,
    bufferDays: capacityMb / gen,
    blackoutDays,
    blackoutVolumeMb: blackoutDays * gen,
    plannedMb: sim.plannedMb,
  };
  const avgDown = countDown ? sumDown / countDown : 0;
  const comms: CommsSummary = {
    rateAt1AuKbps: rate1,
    contactHoursPerDay: orbit.contactHoursPerDay,
    minAu,
    maxAu,
    avgDownlinkMbPerDay: avgDown,
    worstDownlinkMbPerDay: worstDown,
    bestRateKbps: downlinkRateKbps(rate1, minAu),
    worstRateKbps: downlinkRateKbps(rate1, maxAu),
    coverage: avgDown / gen,
    minLightTimeS: minLt,
    maxLightTimeS: maxLt,
    predictedReturn: Math.min(1, sim.returnedMb / sim.plannedMb),
  };
  const science = sciencePotential(design, timeline.scienceDays);

  const issues: Issue[] = [];
  const vehicle = VEHICLE_BY_ID[design.vehicle];
  if (!mass.tankOk) {
    issues.push({
      severity: 'block',
      resource: 'mass',
      title: t('issue.not_enough_propellant_capacity'),
      explain: t('issue.reaching_the_with_a_kg_spacecraft', { orbit: orbit.name.toLowerCase(), dryKg: Math.round(mass.dryKg), propellantKg: Math.round(mass.propellantKg), tankCapacityKg: mass.tankCapacityKg }),
      fix: t('issue.choose_high_capacity_propulsion_lighten_the'),
    });
  }
  if (!mass.launchOk) {
    issues.push({
      severity: 'block',
      resource: 'mass',
      title: t('issue.too_heavy_for_the_launch_vehicle'),
      explain: t('issue.your_fuelled_spacecraft_weighs_kg_but', { wetKg: Math.round(mass.wetKg), vehicle: vehicle.name, capacityKg: vehicle.capacityKg }),
      fix: t('issue.pick_a_larger_launch_vehicle_remove'),
    });
  } else if (mass.marginPct > 0.3) {
    issues.push({
      severity: 'warn',
      resource: 'mass',
      title: t('issue.paying_for_unused_lift'),
      explain: t('issue.kg_of_launch_capacity_is_unused', { marginKg: Math.round(mass.marginKg), marginPct: Math.round(mass.marginPct * 100) }),
      fix: t('issue.a_smaller_launch_vehicle_may_free'),
    });
  }
  if (power.marginW < 0) {
    issues.push({
      severity: 'block',
      resource: 'power',
      title: t('issue.power_demand_exceeds_supply'),
      explain: t('issue.your_selected_configuration_needs_w_but', { consumptionW: Math.round(power.consumptionW), availableW: Math.round(power.availableW) }),
      fix: t('issue.fit_the_enhanced_solar_arrays_choose'),
    });
  } else if (powerWorst.marginPct < 0.05) {
    issues.push({
      severity: 'warn',
      resource: 'power',
      title: t('issue.thin_power_margin_far_from_the'),
      explain: t('issue.at_the_farthest_point_of_this', { maxSun: maxSun.toFixed(2), marginW: Math.round(powerWorst.marginW) }),
      fix: t('issue.enhanced_arrays_or_a_higher_orbit'),
    });
  }
  if (!budget.ok) {
    issues.push({
      severity: 'block',
      resource: 'budget',
      title: t('issue.over_budget'),
      explain: t('issue.this_mission_costs_credits_more_than', { totalCr: budget.totalCr, remainingCr: -budget.remainingCr, capCr: budget.capCr }),
      fix: t('issue.look_for_the_most_expensive_item'),
    });
  }
  if (comms.coverage < 1) {
    issues.push({
      severity: 'warn',
      resource: 'comms',
      title: t('issue.downlink_cannot_keep_up'),
      explain: t('issue.the_payload_produces_mb_per_day', { gen: Math.round(gen), avgDown: Math.round(avgDown) }),
      fix: t('issue.fit_the_high_capacity_link_choose'),
    });
  } else if (worstDown < gen) {
    issues.push({
      severity: 'warn',
      resource: 'comms',
      title: t('issue.link_is_slow_when_mars_is'),
      explain: t('issue.at_au_the_link_carries_mb', { maxAu: maxAu.toFixed(2), worstDown: Math.round(worstDown), gen: Math.round(gen) }),
      fix: t('issue.a_bigger_recorder_or_a_faster'),
    });
  }
  if (blackoutDays > 0 && data.blackoutVolumeMb > capacityMb) {
    issues.push({
      severity: 'warn',
      resource: 'data',
      title: t('issue.recorder_too_small_for_the_solar'),
      explain: t('issue.for_about_days_mars_is_behind', { blackoutDays, blackoutVolumeMb: (data.blackoutVolumeMb / 1000).toFixed(1), capacityMb: (capacityMb / 1000).toFixed(0) }),
      fix: t('issue.carry_the_high_capacity_recorder_or'),
    });
  }

  const worst = (resource: Issue['resource']): Status => {
    const list = issues.filter((i) => i.resource === resource);
    if (list.some((i) => i.severity === 'block')) return 'over';
    if (list.some((i) => i.severity === 'warn')) return 'tight';
    return 'ok';
  };
  const status = {
    mass: worst('mass'),
    power: worst('power'),
    budget: worst('budget'),
    data: worst('data'),
    comms: worst('comms'),
    duration: worst('duration'),
  };
  return {
    mass,
    power,
    powerWorst,
    budget,
    data,
    comms,
    timeline,
    science,
    issues,
    status,
    launchReady: !issues.some((i) => i.severity === 'block'),
  };
}
