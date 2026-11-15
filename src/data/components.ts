import type { Provenance, SlotId, ObjectiveId } from '@/types';
import { t } from '@/i18n';

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
    get label() { return t('comp.slots.payload.label'); },
    get question() { return t('comp.slots.payload.question'); },
    get explain() { return t('comp.slots.payload.explain'); },
  },
  {
    id: 'power',
    get label() { return t('comp.slots.power.label'); },
    get question() { return t('comp.slots.power.question'); },
    get explain() { return t('comp.slots.power.explain'); },
  },
  {
    id: 'comms',
    get label() { return t('comp.slots.comms.label'); },
    get question() { return t('comp.slots.comms.question'); },
    get explain() { return t('comp.slots.comms.explain'); },
  },
  {
    id: 'storage',
    get label() { return t('comp.slots.storage.label'); },
    get question() { return t('comp.slots.storage.question'); },
    get explain() { return t('comp.slots.storage.explain'); },
  },
  {
    id: 'propulsion',
    get label() { return t('comp.slots.propulsion.label'); },
    get question() { return t('comp.slots.propulsion.question'); },
    get explain() { return t('comp.slots.propulsion.explain'); },
  },
];


export const COMPONENTS: ComponentOption[] = [
  // ── Science payload ────────────────────────────────────────────────────────
  {
    id: 'sounder',
    slot: 'payload',
    get name() { return t('comp.components.sounder.name'); },
    get short() { return t('comp.components.sounder.short'); },
    get description() { return t('comp.components.sounder.description'); },
    get tradeoff() { return t('comp.components.sounder.tradeoff'); },
    massKg: 9,
    powerW: 11,
    costCr: 55,
    provenance: 'verified_mission_reference',
    get provenanceNote() { return t('comp.components.sounder.provenancenote'); },
    dataMbPerDay: 180,
    profiling: 1,
    mapping: 0.25,
  },
  {
    id: 'imager',
    slot: 'payload',
    get name() { return t('comp.components.imager.name'); },
    get short() { return t('comp.components.imager.short'); },
    get description() { return t('comp.components.imager.description'); },
    get tradeoff() { return t('comp.components.imager.tradeoff'); },
    massKg: 6,
    powerW: 14,
    costCr: 38,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    dataMbPerDay: 1100,
    profiling: 0.1,
    mapping: 1,
  },
  {
    id: 'suite',
    slot: 'payload',
    get name() { return t('comp.components.suite.name'); },
    get short() { return t('comp.components.suite.short'); },
    get description() { return t('comp.components.suite.description'); },
    get tradeoff() { return t('comp.components.suite.tradeoff'); },
    massKg: 16,
    powerW: 25,
    costCr: 86,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.components.suite.provenancenote'); },
    dataMbPerDay: 1280,
    profiling: 1,
    mapping: 1,
  },
  // ── Power ──────────────────────────────────────────────────────────────────
  {
    id: 'array-standard',
    slot: 'power',
    get name() { return t('comp.components.array-standard.name'); },
    get short() { return t('comp.components.array-standard.short'); },
    get description() { return t('comp.components.array-standard.description'); },
    get tradeoff() { return t('comp.components.array-standard.tradeoff'); },
    massKg: 38,
    powerW: 0,
    costCr: 34,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    arrayAreaM2: 7,
  },
  {
    id: 'array-enhanced',
    slot: 'power',
    get name() { return t('comp.components.array-enhanced.name'); },
    get short() { return t('comp.components.array-enhanced.short'); },
    get description() { return t('comp.components.array-enhanced.description'); },
    get tradeoff() { return t('comp.components.array-enhanced.tradeoff'); },
    massKg: 62,
    powerW: 0,
    costCr: 52,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    arrayAreaM2: 11,
  },
  // ── Communications ─────────────────────────────────────────────────────────
  {
    id: 'comms-standard',
    slot: 'comms',
    get name() { return t('comp.components.comms-standard.name'); },
    get short() { return t('comp.components.comms-standard.short'); },
    get description() { return t('comp.components.comms-standard.description'); },
    get tradeoff() { return t('comp.components.comms-standard.tradeoff'); },
    massKg: 24,
    powerW: 70,
    costCr: 40,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    rateKbpsAt1Au: 110,
  },
  {
    id: 'comms-high',
    slot: 'comms',
    get name() { return t('comp.components.comms-high.name'); },
    get short() { return t('comp.components.comms-high.short'); },
    get description() { return t('comp.components.comms-high.description'); },
    get tradeoff() { return t('comp.components.comms-high.tradeoff'); },
    massKg: 41,
    powerW: 135,
    costCr: 78,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    rateKbpsAt1Au: 420,
  },
  // ── Storage ────────────────────────────────────────────────────────────────
  {
    id: 'storage-standard',
    slot: 'storage',
    get name() { return t('comp.components.storage-standard.name'); },
    get short() { return t('comp.components.storage-standard.short'); },
    get description() { return t('comp.components.storage-standard.description'); },
    get tradeoff() { return t('comp.components.storage-standard.tradeoff'); },
    massKg: 5,
    powerW: 12,
    costCr: 12,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    capacityGb: 12,
  },
  {
    id: 'storage-high',
    slot: 'storage',
    get name() { return t('comp.components.storage-high.name'); },
    get short() { return t('comp.components.storage-high.short'); },
    get description() { return t('comp.components.storage-high.description'); },
    get tradeoff() { return t('comp.components.storage-high.tradeoff'); },
    massKg: 9,
    powerW: 28,
    costCr: 30,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    capacityGb: 48,
  },
  // ── Propulsion ─────────────────────────────────────────────────────────────
  {
    id: 'prop-standard',
    slot: 'propulsion',
    get name() { return t('comp.components.prop-standard.name'); },
    get short() { return t('comp.components.prop-standard.short'); },
    get description() { return t('comp.components.prop-standard.description'); },
    get tradeoff() { return t('comp.components.prop-standard.tradeoff'); },
    massKg: 48,
    powerW: 20,
    costCr: 36,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
    tankCapacityKg: 230,
    ispS: 318,
  },
  {
    id: 'prop-high',
    slot: 'propulsion',
    get name() { return t('comp.components.prop-high.name'); },
    get short() { return t('comp.components.prop-high.short'); },
    get description() { return t('comp.components.prop-high.description'); },
    get tradeoff() { return t('comp.components.prop-high.tradeoff'); },
    massKg: 74,
    powerW: 32,
    costCr: 62,
    provenance: 'educational_game_assumption',
    get provenanceNote() { return t('comp.game_value'); },
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
  climate: { payload: 'sounder', power: 'array-enhanced', get comms() { return t('comp.recommended.climate.comms'); }, storage: 'storage-standard', propulsion: 'prop-standard' },
  dust: { payload: 'suite', power: 'array-enhanced', get comms() { return t('comp.recommended.dust.comms'); }, storage: 'storage-standard', propulsion: 'prop-standard' },
  clouds: { payload: 'suite', power: 'array-standard', get comms() { return t('comp.recommended.clouds.comms'); }, storage: 'storage-standard', propulsion: 'prop-standard' },
};

/** The launch plan that accompanies each recommended spacecraft. */
export const RECOMMENDED_PLAN: Record<ObjectiveId, { vehicle: 'tulpar-l' | 'tulpar-m' | 'tulpar-h'; orbit: 'low-polar' | 'mid-inclined' | 'high-elliptical'; duration: 'half-year' | 'full-year' }> = {
  climate: { vehicle: 'tulpar-m', orbit: 'low-polar', duration: 'full-year' },
  dust: { vehicle: 'tulpar-m', orbit: 'low-polar', duration: 'half-year' },
  clouds: { vehicle: 'tulpar-m', orbit: 'high-elliptical', duration: 'half-year' },
};
