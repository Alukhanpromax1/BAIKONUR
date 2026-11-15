import type { Provenance } from '@/types';
import { t } from '@/i18n';
import { SNAPSHOT_META } from '@/services/horizons/ephemeris';

export type ExtendedProvenance = Provenance | 'physical_constant';

export interface DataSource {
  id: string;
  provenance: ExtendedProvenance;
  title: string;
  organization: string;
  url?: string;
  units?: string;
  retrieved?: string;
  /** Exactly which values come from this source. */
  fields: string[];
  /** Where the player meets this data in the game. */
  usedFor: string[];
  status?: string;
}

export const PROVENANCE_LABEL: Record<ExtendedProvenance, { label: string; short: string; explain: string }> = {
  verified_nasa_data: {
    get label() { return t('source.provenance_label.verified_nasa_data.label'); },
    get short() { return t('source.provenance_label.verified_nasa_data.short'); },
    get explain() { return t('source.provenance_label.verified_nasa_data.explain'); },
  },
  verified_mission_reference: {
    get label() { return t('source.provenance_label.verified_mission_reference.label'); },
    get short() { return t('source.provenance_label.verified_mission_reference.short'); },
    get explain() { return t('source.provenance_label.verified_mission_reference.explain'); },
  },
  physical_constant: {
    get label() { return t('source.provenance_label.physical_constant.label'); },
    get short() { return t('source.provenance_label.physical_constant.short'); },
    get explain() { return t('source.provenance_label.physical_constant.explain'); },
  },
  educational_game_assumption: {
    get label() { return t('source.provenance_label.educational_game_assumption.label'); },
    get short() { return t('source.provenance_label.educational_game_assumption.short'); },
    get explain() { return t('source.provenance_label.educational_game_assumption.explain'); },
  },
  synthetic_simulated_data: {
    get label() { return t('source.provenance_label.synthetic_simulated_data.label'); },
    get short() { return t('source.provenance_label.synthetic_simulated_data.short'); },
    get explain() { return t('source.provenance_label.synthetic_simulated_data.explain'); },
  },
};

export const MCS_REFERENCE = {
  get name() { return t('source.mcs_reference.name'); },
  get spacecraft() { return t('source.mcs_reference.spacecraft'); },
  massKg: 9,
  get massQuote() { return t('source.mcs_reference.massquote'); },
  powerW: 11,
  get powerQuote() { return t('source.mcs_reference.powerquote'); },
  get channels() { return t('source.mcs_reference.channels'); },
  get measures() { return ['temperature', 'pressure', t('source.mcs_reference.measures.2'), 'dust']; },
  get method() { return t('source.mcs_reference.method'); },
  get products() { return t('source.mcs_reference.products'); },
  url: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/',
  retrieved: '2026-11-14',
} as const;

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'horizons',
    provenance: 'verified_nasa_data',
    get title() { return t('source.data_sources.horizons.title'); },
    organization: SNAPSHOT_META.organization,
    url: SNAPSHOT_META.documentation,
    get units() { return t('source.data_sources.horizons.units'); },
    retrieved: SNAPSHOT_META.retrievedAt,
    get fields() { return [
      t('source.data_sources.horizons.fields.0'),
      t('source.data_sources.horizons.fields.1'),
      t('source.data_sources.horizons.fields.2'),
      t('source.data_sources.horizons.fields.3', { sampleCount: SNAPSHOT_META.sampleCount, start: SNAPSHOT_META.start, stop: SNAPSHOT_META.stop, step: SNAPSHOT_META.step }),
    ]; },
    get usedFor() { return [
      t('source.data_sources.horizons.usedfor.0'),
      t('source.data_sources.horizons.usedfor.1'),
      t('source.data_sources.horizons.usedfor.2'),
      t('source.data_sources.horizons.usedfor.3'),
    ]; },
    get status() { return t('source.data_sources.horizons.status'); },
  },
  {
    id: 'mcs-reference',
    provenance: 'verified_mission_reference',
    get title() { return t('source.data_sources.mcs-reference.title'); },
    get organization() { return t('source.data_sources.mcs-reference.organization'); },
    url: MCS_REFERENCE.url,
    get units() { return t('source.data_sources.mcs-reference.units'); },
    retrieved: MCS_REFERENCE.retrieved,
    get fields() { return [`Mass: ${MCS_REFERENCE.massQuote}`, `Power: ${MCS_REFERENCE.powerQuote}`, t('source.data_sources.mcs-reference.fields.2'), t('source.data_sources.mcs-reference.fields.3')]; },
    get usedFor() { return [
      t('source.data_sources.mcs-reference.usedfor.0'),
      t('source.data_sources.mcs-reference.usedfor.1'),
    ]; },
    get status() { return t('source.data_sources.mcs-reference.status'); },
  },
  {
    id: 'mcs-pds',
    provenance: 'verified_nasa_data',
    get title() { return t('source.data_sources.mcs-pds.title'); },
    get organization() { return t('source.data_sources.mcs-pds.organization'); },
    url: 'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Mars/Mars.html',
    get fields() { return [t('source.data_sources.mcs-pds.fields.0')]; },
    get usedFor() { return [t('source.data_sources.mcs-pds.usedfor.0')]; },
    get status() { return t('source.data_sources.mcs-pds.status'); },
  },
  {
    id: 'constants',
    provenance: 'physical_constant',
    get title() { return t('source.data_sources.constants.title'); },
    get organization() { return t('source.data_sources.constants.organization'); },
    get units() { return t('source.data_sources.constants.units'); },
    get fields() { return [
      t('source.data_sources.constants.fields.0'),
      t('source.data_sources.constants.fields.1'),
      t('source.data_sources.constants.fields.2'),
      t('source.data_sources.constants.fields.3'),
    ]; },
    get usedFor() { return [t('source.data_sources.constants.usedfor.0'), t('source.data_sources.constants.usedfor.1'), t('source.data_sources.constants.usedfor.2')]; },
  },
  {
    id: 'game-values',
    provenance: 'educational_game_assumption',
    get title() { return t('source.data_sources.game-values.title'); },
    get organization() { return t('source.data_sources.game-values.organization'); },
    get units() { return t('source.data_sources.game-values.units'); },
    get fields() { return [
      t('source.data_sources.game-values.fields.0'),
      t('source.data_sources.game-values.fields.1'),
      t('source.data_sources.game-values.fields.2'),
      t('source.data_sources.game-values.fields.3'),
      t('source.data_sources.game-values.fields.4'),
    ]; },
    get usedFor() { return [t('source.data_sources.game-values.usedfor.0'), t('source.data_sources.game-values.usedfor.1'), t('source.data_sources.game-values.usedfor.2'), t('source.data_sources.game-values.usedfor.3')]; },
    get status() { return t('source.data_sources.game-values.status'); },
  },
  {
    id: 'telemetry',
    provenance: 'synthetic_simulated_data',
    get title() { return t('source.data_sources.telemetry.title'); },
    get organization() { return t('source.data_sources.telemetry.organization'); },
    get units() { return t('source.data_sources.telemetry.units'); },
    get fields() { return [t('source.data_sources.telemetry.fields.0'), t('source.data_sources.telemetry.fields.1'), t('source.data_sources.telemetry.fields.2')]; },
    get usedFor() { return [t('source.data_sources.telemetry.usedfor.0')]; },
    get status() { return t('source.data_sources.telemetry.status'); },
  },
];

export const CHALLENGE_REFERENCE = {
  get title() { return t('source.challenge_reference.title'); },
  site: 'https://www.spaceappschallenge.org/2026/',
  get note() { return t('source.challenge_reference.note'); },
};
