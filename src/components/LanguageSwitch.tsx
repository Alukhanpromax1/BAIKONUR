import { LANGUAGES, t, useLangStore, type Lang } from '@/i18n';

/** Segmented language selector. The choice is saved and never resets mission progress. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return (
    <div className={`segmented lang-switch ${compact ? 'lang-switch--compact' : ''}`} role="group" aria-label={t('top.language')}>
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={lang === l.id}
          aria-label={l.label}
          title={l.label}
          onClick={() => setLang(l.id as Lang)}
          data-testid={`lang-${l.id}`}
        >
          {compact ? l.short : l.label}
        </button>
      ))}
    </div>
  );
}
