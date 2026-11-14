import { COMPONENT_BY_ID } from '@/data/components';
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
      title: 'Not enough propellant capacity',
      explain: `Reaching the ${orbit.name.toLowerCase()} with a ${Math.round(mass.dryKg)} kg spacecraft needs ${Math.round(mass.propellantKg)} kg of propellant, but the selected tanks hold ${mass.tankCapacityKg} kg.`,
      fix: 'Choose high-capacity propulsion, lighten the spacecraft, or pick an orbit that needs less velocity change.',
    });
  }
  if (!mass.launchOk) {
    issues.push({
      severity: 'block',
      resource: 'mass',
      title: 'Too heavy for the launch vehicle',
      explain: `Your fuelled spacecraft weighs ${Math.round(mass.wetKg)} kg, but ${vehicle.name} can send only ${vehicle.capacityKg} kg toward Mars.`,
      fix: 'Pick a larger launch vehicle, remove mass, or choose an orbit that needs less propellant.',
    });
  } else if (mass.marginPct > 0.3) {
    issues.push({
      severity: 'warn',
      resource: 'mass',
      title: 'Paying for unused lift',
      explain: `${Math.round(mass.marginKg)} kg of launch capacity (${Math.round(mass.marginPct * 100)} %) is unused.`,
      fix: 'A smaller launch vehicle may free budget for better instruments.',
    });
  }
  if (power.marginW < 0) {
    issues.push({
      severity: 'block',
      resource: 'power',
      title: 'Power demand exceeds supply',
      explain: `Your selected configuration needs ${Math.round(power.consumptionW)} W, but the arrays deliver only ${Math.round(power.availableW)} W on average in this orbit.`,
      fix: 'Fit the enhanced solar arrays, choose lower-power equipment, or pick an orbit with less time in shadow.',
    });
  } else if (powerWorst.marginPct < 0.05) {
    issues.push({
      severity: 'warn',
      resource: 'power',
      title: 'Thin power margin far from the Sun',
      explain: `At the farthest point of this mission (${maxSun.toFixed(2)} AU from the Sun) the margin drops to ${Math.round(powerWorst.marginW)} W. You will have to save power for part of the mission.`,
      fix: 'Enhanced arrays or a higher orbit give more margin.',
    });
  }
  if (!budget.ok) {
    issues.push({
      severity: 'block',
      resource: 'budget',
      title: 'Over budget',
      explain: `This mission costs ${budget.totalCr} credits, ${-budget.remainingCr} more than the ${budget.capCr}-credit budget.`,
      fix: 'Look for the most expensive item that your science objective does not really need.',
    });
  }
  if (comms.coverage < 1) {
    issues.push({
      severity: 'warn',
      resource: 'comms',
      title: 'Downlink cannot keep up',
      explain: `The payload produces ${Math.round(gen)} Mb per day, but the link averages only ${Math.round(avgDown)} Mb per day. Data will pile up and some will be lost.`,
      fix: 'Fit the high-capacity link, choose an orbit with more contact time, or carry a smaller payload.',
    });
  } else if (worstDown < gen) {
    issues.push({
      severity: 'warn',
      resource: 'comms',
      title: 'Link is slow when Mars is far away',
      explain: `At ${maxAu.toFixed(2)} AU the link carries ${Math.round(worstDown)} Mb per day, less than the ${Math.round(gen)} Mb produced. The recorder must absorb the difference.`,
      fix: 'A bigger recorder or a faster link protects your data in those months.',
    });
  }
  if (blackoutDays > 0 && data.blackoutVolumeMb > capacityMb) {
    issues.push({
      severity: 'warn',
      resource: 'data',
      title: 'Recorder too small for the solar conjunction',
      explain: `For about ${blackoutDays} days Mars is behind the Sun and nothing can be sent. The payload would produce ${(data.blackoutVolumeMb / 1000).toFixed(1)} Gb, but the recorder holds ${(capacityMb / 1000).toFixed(0)} Gb.`,
      fix: 'Carry the high-capacity recorder, or plan to observe less during the blackout.',
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
