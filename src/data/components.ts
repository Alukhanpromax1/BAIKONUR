import type { Provenance, SlotId, ObjectiveId } from '@/types';

export interface ComponentOption {
  id: string;
  slot: SlotId;
  name: string;
  short: string;
  description: string;
  /** Why you might pick it — shown in Guided mode. */
  tradeoff: string;
  massKg: number;
  /** Electrical consumption in watts (solar arrays consume nothing — they generate). */
  powerW: number;
  costCr: number;
  provenance: Provenance;
  provenanceNote: string;
  // Slot-specific properties
  dataMbPerDay?: number;
  profiling?: number;
  mapping?: number;
  arrayAreaM2?: number;
  rateKbpsAt1Au?: number;
  capacityGb?: number;
  tankCapacityKg?: number;
  ispS?: number;
}

export interface SlotInfo {
  id: SlotId;
  label: string;
  question: string;
  explain: string;
}

export const SLOTS: SlotInfo[] = [
  {
    id: 'payload',
    label: 'Science payload',
    question: 'What will KAZMARS-1 measure?',
    explain: 'Instruments are the reason the mission exists. More capable payloads return more science, but add mass, power draw, cost and data to send home.',
  },
  {
    id: 'power',
    label: 'Solar arrays',
    question: 'How much sunlight will you collect?',
    explain: 'Mars is about 1.5× farther from the Sun than Earth, so each square metre of solar panel collects less than half the power it would near Earth.',
  },
  {
    id: 'comms',
    label: 'Communications',
    question: 'How fast can you send data home?',
    explain: 'A bigger dish and stronger amplifier send more data per second. The rate also falls with the square of the Earth–Mars distance.',
  },
  {
    id: 'storage',
    label: 'Data recorder',
    question: 'How much data can wait on board?',
    explain: 'The recorder holds data until Earth is listening. When Mars passes behind the Sun, nothing can be sent for about two weeks.',
  },
  {
    id: 'propulsion',
    label: 'Propulsion',
    question: 'How much propellant can you carry?',
    explain: 'The engine slows the spacecraft into Mars orbit. Tighter orbits need more propellant, and a heavier spacecraft needs more again.',
  },
];

const GAME_VALUE = 'Illustrative game value — not a real hardware specification.';

export const COMPONENTS: ComponentOption[] = [
  // ── Science payload ────────────────────────────────────────────────────────
  {
    id: 'sounder',
    slot: 'payload',
    name: 'ATMOS-S limb sounder',
    short: 'MCS-inspired sounder',
    description:
      'Looks at the edge of the atmosphere in infrared light to build vertical profiles of temperature, dust and water ice — layer by layer.',
    tradeoff: 'Best for vertical structure and climate records. Small data volume. Cannot make wide weather maps.',
    massKg: 9,
    powerW: 11,
    costCr: 55,
    provenance: 'verified_mission_reference',
    provenanceNote:
      'Mass (≈9 kg) and power (11 W) match NASA’s published figures for the Mars Climate Sounder on Mars Reconnaissance Orbiter. Cost, data volume and science ratings are illustrative game values.',
    dataMbPerDay: 180,
    profiling: 1,
    mapping: 0.25,
  },
  {
    id: 'imager',
    slot: 'payload',
    name: 'ATMOS-I weather imager',
    short: 'Wide-angle imager',
    description:
      'A simplified wide-angle camera that photographs the whole planet every day to map dust storms and clouds from above.',
    tradeoff: 'Best for daily global maps. Light and cheap — but images are data-hungry and it cannot see vertical layers.',
    massKg: 6,
    powerW: 14,
    costCr: 38,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    dataMbPerDay: 1100,
    profiling: 0.1,
    mapping: 1,
  },
  {
    id: 'suite',
    slot: 'payload',
    name: 'Dual payload',
    short: 'Sounder + imager',
    description: 'Carries both instruments: vertical profiles and daily global maps of the same weather systems.',
    tradeoff: 'Highest science potential — and the highest mass, power, cost and data load.',
    massKg: 16,
    powerW: 25,
    costCr: 86,
    provenance: 'educational_game_assumption',
    provenanceNote:
      'Combines the sounder (NASA MCS reference: ≈9 kg, 11 W) and the imager, plus an illustrative 1 kg mounting bracket. The price reflects shared electronics.',
    dataMbPerDay: 1280,
    profiling: 1,
    mapping: 1,
  },
  // ── Power ──────────────────────────────────────────────────────────────────
  {
    id: 'array-standard',
    slot: 'power',
    name: 'Standard solar arrays',
    short: '7 m² · two panels per wing',
    description: 'Two folding wings with 7 m² of solar cells in total.',
    tradeoff: 'Light and affordable. Power becomes tight in low orbits, where Mars’ shadow covers more of each lap.',
    massKg: 38,
    powerW: 0,
    costCr: 34,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    arrayAreaM2: 7,
  },
  {
    id: 'array-enhanced',
    slot: 'power',
    name: 'Enhanced solar arrays',
    short: '11 m² · three panels per wing',
    description: 'Longer wings with 11 m² of solar cells in total.',
    tradeoff: 'Comfortable power margin all year — for 24 kg more mass and a higher price.',
    massKg: 62,
    powerW: 0,
    costCr: 52,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    arrayAreaM2: 11,
  },
  // ── Communications ─────────────────────────────────────────────────────────
  {
    id: 'comms-standard',
    slot: 'comms',
    name: 'Standard antenna',
    short: '1.5 m dish · 110 kbps at 1 AU',
    description: 'A 1.5 m high-gain dish with a modest transmitter.',
    tradeoff: 'Enough for the sounder alone. Struggles with image data when Mars is far from Earth.',
    massKg: 24,
    powerW: 70,
    costCr: 40,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    rateKbpsAt1Au: 110,
  },
  {
    id: 'comms-high',
    slot: 'comms',
    name: 'High-capacity link',
    short: '2.4 m dish · 420 kbps at 1 AU',
    description: 'A larger 2.4 m dish and a stronger amplifier.',
    tradeoff: 'Almost four times the data rate — but heavier, more expensive and nearly double the power draw.',
    massKg: 41,
    powerW: 135,
    costCr: 78,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    rateKbpsAt1Au: 420,
  },
  // ── Storage ────────────────────────────────────────────────────────────────
  {
    id: 'storage-standard',
    slot: 'storage',
    name: 'Standard recorder',
    short: '12 Gb solid-state memory',
    description: 'Holds 12 gigabits of science data between passes.',
    tradeoff: 'Fine for small data volumes. Fills quickly if you cannot downlink for a while.',
    massKg: 5,
    powerW: 12,
    costCr: 12,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    capacityGb: 12,
  },
  {
    id: 'storage-high',
    slot: 'storage',
    name: 'High-capacity recorder',
    short: '48 Gb solid-state memory',
    description: 'Holds 48 gigabits — four times more buffer.',
    tradeoff: 'Rides through communication blackouts without losing data. Costs more mass, power and budget.',
    massKg: 9,
    powerW: 28,
    costCr: 30,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    capacityGb: 48,
  },
  // ── Propulsion ─────────────────────────────────────────────────────────────
  {
    id: 'prop-standard',
    slot: 'propulsion',
    name: 'Standard propulsion',
    short: '230 kg tank · Isp 318 s',
    description: 'One main engine with a 230 kg propellant tank.',
    tradeoff: 'Enough for easier orbits with a light spacecraft.',
    massKg: 48,
    powerW: 20,
    costCr: 36,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    tankCapacityKg: 230,
    ispS: 318,
  },
  {
    id: 'prop-high',
    slot: 'propulsion',
    name: 'High-capacity propulsion',
    short: '420 kg tanks · Isp 326 s',
    description: 'Larger tanks and a slightly more efficient engine.',
    tradeoff: 'Reaches demanding orbits with a heavy spacecraft — but the bigger system is itself heavier.',
    massKg: 74,
    powerW: 32,
    costCr: 62,
    provenance: 'educational_game_assumption',
    provenanceNote: GAME_VALUE,
    tankCapacityKg: 420,
    ispS: 326,
  },
];

export const COMPONENT_BY_ID: Record<string, ComponentOption> = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));

export function optionsFor(slot: SlotId): ComponentOption[] {
  return COMPONENTS.filter((c) => c.slot === slot);
}

/** The recommended starting configuration for each objective (Guided mode). */
export const RECOMMENDED: Record<ObjectiveId, Record<SlotId, string>> = {
  climate: { payload: 'sounder', power: 'array-enhanced', comms: 'comms-standard', storage: 'storage-standard', propulsion: 'prop-standard' },
  dust: { payload: 'suite', power: 'array-enhanced', comms: 'comms-high', storage: 'storage-standard', propulsion: 'prop-standard' },
  clouds: { payload: 'suite', power: 'array-standard', comms: 'comms-high', storage: 'storage-standard', propulsion: 'prop-standard' },
};

/** The launch plan that accompanies each recommended spacecraft. */
export const RECOMMENDED_PLAN: Record<ObjectiveId, { vehicle: 'tulpar-l' | 'tulpar-m' | 'tulpar-h'; orbit: 'low-polar' | 'mid-inclined' | 'high-elliptical'; duration: 'half-year' | 'full-year' }> = {
  climate: { vehicle: 'tulpar-m', orbit: 'low-polar', duration: 'full-year' },
  dust: { vehicle: 'tulpar-m', orbit: 'low-polar', duration: 'half-year' },
  clouds: { vehicle: 'tulpar-m', orbit: 'high-elliptical', duration: 'half-year' },
};
