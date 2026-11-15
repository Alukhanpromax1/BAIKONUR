import { COMPONENT_BY_ID } from '@/data/components';
import { t } from '@/i18n';
import { GAME } from '@/data/constants';
import { VEHICLE_BY_ID } from '@/data/launchVehicles';
import { DURATION_BY_ID, ORBIT_BY_ID } from '@/data/orbits';
import type { MissionDesign, SlotId } from '@/types';

export interface BudgetLine {
  label: string;
  cr: number;
  slot?: SlotId;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  spacecraftCr: number;
  launchCr: number;
  operationsCr: number;
  /** Extra costs caused by events (for example a launch scrub). */
  eventsCr: number;
  totalCr: number;
  capCr: number;
  remainingCr: number;
  ok: boolean;
}

export function operationsCostCr(design: MissionDesign): number {
  const days = ORBIT_BY_ID[design.orbit].commissioningDays + DURATION_BY_ID[design.duration].scienceDays;
  return Math.round(days * GAME.opsCostCrPerDay);
}

/** All values are simulated game credits — not real mission costs. */
export function computeBudget(design: MissionDesign, eventsCr = 0): BudgetSummary {
  const s = design.selections;
  const slots: SlotId[] = ['payload', 'power', 'comms', 'storage', 'propulsion'];
  const componentLines: BudgetLine[] = slots.map((slot) => ({
    label: COMPONENT_BY_ID[s[slot]].name,
    cr: COMPONENT_BY_ID[s[slot]].costCr,
    slot,
  }));
  const spacecraftCr = GAME.busCostCr + componentLines.reduce((sum, l) => sum + l.cr, 0);
  const launchCr = VEHICLE_BY_ID[design.vehicle].costCr;
  const operationsCr = operationsCostCr(design);
  const lines: BudgetLine[] = [
    { label: t('budget.spacecraft_bus_integration'), cr: GAME.busCostCr },
    ...componentLines,
    { label: t('budget.launch', { vehicle: VEHICLE_BY_ID[design.vehicle].name }), cr: launchCr },
    { label: t('budget.mission_operations'), cr: operationsCr },
  ];
  if (eventsCr > 0) lines.push({ label: t('budget.launch_campaign_events'), cr: eventsCr });
  const totalCr = spacecraftCr + launchCr + operationsCr + eventsCr;
  return {
    lines,
    spacecraftCr,
    launchCr,
    operationsCr,
    eventsCr,
    totalCr,
    capCr: GAME.budgetCapCr,
    remainingCr: GAME.budgetCapCr - totalCr,
    ok: totalCr <= GAME.budgetCapCr,
  };
}
