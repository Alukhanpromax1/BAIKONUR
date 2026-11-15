import { PROVENANCE_LABEL, type ExtendedProvenance } from '@/data/nasa/sources';
import { t, type MessageKey } from '@/i18n';
import { useGame } from '@/game/state/store';

const TONE: Record<ExtendedProvenance, string> = {
  verified_nasa_data: 'tag--cyan',
  verified_mission_reference: 'tag--cyan',
  physical_constant: '',
  educational_game_assumption: 'tag--amber',
  synthetic_simulated_data: 'tag--amber',
};

/** Shows where a number comes from. Click to open the Data Sources panel. */
export function ProvenanceTag({ kind, label, passive = false }: { kind: ExtendedProvenance; label?: string; passive?: boolean }) {
  const open = useGame((s) => s.openPanel);
  const p = PROVENANCE_LABEL[kind];
  // `passive` renders a plain label for use inside other buttons (no nested interactive elements).
  if (passive) {
    return (
      <span className={`tag ${TONE[kind]}`} title={`${p.label} — ${p.explain}`}>
        {label ?? p.short}
      </span>
    );
  }
  return (
    <button type="button" className={`tag ${TONE[kind]}`} title={t('tag.click_for_sources', { p: p.label, explain: p.explain })} onClick={() => open('sources')}>
      {label ?? p.short}
    </button>
  );
}

export const GLOSSARY: Record<string, string> = {
  get 'false positive'() { return t('tag.glossary.false_positive'); },
  get 'false negative'() { return t('tag.glossary.false_negative'); },
  get 'sensor noise'() { return t('tag.glossary.sensor_noise'); },
  get 'data quality'() { return t('tag.glossary.data_quality'); },
  get correlation() { return t('tag.glossary.correlation'); },
  get 'moving average'() { return t('tag.glossary.moving_average'); },
  get 'light time'() { return t('tag.glossary.light_time'); },
  get 'delta-v'() { return t('tag.glossary.delta_v'); },
  get 'safe mode'() { return t('tag.glossary.safe_mode'); },
  get 'solar conjunction'() { return t('tag.glossary.solar_conjunction'); },
  get aerobraking() { return t('tag.glossary.aerobraking'); },
  get Mb() { return t('tag.glossary.mb'); },
  get Gb() { return t('tag.glossary.gb'); },
  get kbps() { return t('tag.glossary.kbps'); },
  get AU() { return t('tag.glossary.au'); },
};

/** The term itself, in the current language. */
export function termLabel(k: string): string {
  return t(`term.${k.toLowerCase().replace(/[ -]/g, '_')}` as MessageKey);
}

/** An underlined word with a plain-language definition on hover or focus. */
export function Term({ k, children, passive = false }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode; passive?: boolean }) {
  const text = GLOSSARY[k] ?? '';
  if (passive) {
    return (
      <span className="term" title={text}>
        {children ?? termLabel(k)}
        <span className="term__pop" role="tooltip">
          {text}
        </span>
      </span>
    );
  }
  return (
    <button type="button" className="term" aria-label={`${termLabel(k)}: ${text}`}>
      {children ?? termLabel(k)}
      <span className="term__pop" role="tooltip">
        {text}
      </span>
    </button>
  );
}
