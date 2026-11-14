import { COMPONENTS, RECOMMENDED } from '@/data/components';
import { LAUNCH_VEHICLES } from '@/data/launchVehicles';
import { OBJECTIVES } from '@/data/objectives';
import { DURATIONS, ORBITS } from '@/data/orbits';
import type { MissionDesign, Selections, SlotId } from '@/types';

export const baseDesign: MissionDesign = {
  objective: 'climate',
  selections: { ...RECOMMENDED.climate },
  vehicle: 'tulpar-m',
  orbit: 'low-polar',
  duration: 'full-year',
};

export function withSelection(design: MissionDesign, slot: SlotId, id: string): MissionDesign {
  return { ...design, selections: { ...design.selections, [slot]: id } };
}

/** Every possible mission design (3 objectives × 48 spacecraft × 3 vehicles × 3 orbits × 2 durations). */
export function allDesigns(): MissionDesign[] {
  const slots: SlotId[] = ['payload', 'power', 'comms', 'storage', 'propulsion'];
  let combos: Selections[] = [{} as Selections];
  for (const slot of slots) {
    const next: Selections[] = [];
    for (const c of combos) for (const o of COMPONENTS.filter((x) => x.slot === slot)) next.push({ ...c, [slot]: o.id });
    combos = next;
  }
  const out: MissionDesign[] = [];
  for (const objective of OBJECTIVES)
    for (const selections of combos)
      for (const v of LAUNCH_VEHICLES) for (const o of ORBITS) for (const d of DURATIONS) out.push({ objective: objective.id, selections, vehicle: v.id, orbit: o.id, duration: d.id });
  return out;
}
