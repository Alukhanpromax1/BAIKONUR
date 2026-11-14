import { PROVENANCE_LABEL, type ExtendedProvenance } from '@/data/nasa/sources';
import { useGame } from '@/game/state/store';

const TONE: Record<ExtendedProvenance, string> = {
  verified_nasa_data: 'tag--cyan',
  verified_mission_reference: 'tag--cyan',
  physical_constant: '',
  educational_game_assumption: 'tag--amber',
  synthetic_simulated_data: 'tag--amber',
};

/** Shows where a number comes from. Click to open the Data Sources panel. */
export function ProvenanceTag({ kind, label }: { kind: ExtendedProvenance; label?: string }) {
  const open = useGame((s) => s.openPanel);
  const p = PROVENANCE_LABEL[kind];
  return (
    <button type="button" className={`tag ${TONE[kind]}`} title={`${p.label} — ${p.explain} Click for sources.`} onClick={() => open('sources')}>
      {label ?? p.short}
    </button>
  );
}

export const GLOSSARY: Record<string, string> = {
  'false positive': 'An alarm for a problem that is not really there. It costs time and money.',
  'false negative': 'A real problem that goes unnoticed because the warning was dismissed.',
  'sensor noise': 'Small random jumps that every real sensor shows, even when nothing is changing.',
  'data quality': 'How well a number survived its journey: missing, repeated or scrambled packets lower it.',
  correlation: 'When two independent measurements rise or fall together. Agreement between them makes a real cause more likely.',
  'moving average': 'The average of the last few readings. It smooths out single jumps so a real trend stands out.',
  'light time': 'How long a radio signal, travelling at the speed of light, takes to cross the distance.',
  'delta-v': 'The total change in speed a spacecraft’s engine must provide. More delta-v needs more propellant.',
  'safe mode': 'A protective state: the spacecraft switches off its instruments, points at the Sun and waits for help.',
  'solar conjunction': 'When Mars passes behind the Sun as seen from Earth. The Sun’s hot atmosphere corrupts radio signals.',
  aerobraking: 'Using drag from the upper atmosphere, pass after pass, to shrink an orbit without burning propellant.',
  Mb: 'Megabit: one million bits of data.',
  Gb: 'Gigabit: one thousand megabits.',
  kbps: 'Kilobits per second: one thousand bits each second.',
  AU: 'Astronomical unit: the average Earth–Sun distance, about 149.6 million km.',
};

/** An underlined word with a plain-language definition on hover or focus. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const text = GLOSSARY[k] ?? '';
  return (
    <button type="button" className="term" aria-label={`${k}: ${text}`}>
      {children ?? k}
      <span className="term__pop" role="tooltip">
        {text}
      </span>
    </button>
  );
}
