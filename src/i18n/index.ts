import { create } from 'zustand';
import { en, type MessageKey } from './locales/en';
import { ru } from './locales/ru';

/**
 * Central localization. Every player-facing string lives in src/i18n/locales/<lang>/ and is
 * looked up by key through t(). Components and the game engine use the same function, so
 * warnings, outcomes and score lines are translated together with the interface.
 *
 * Message syntax:
 *   {name}            parameter
 *   {n:day|days}      plural form chosen from parameter n (English: one|other;
 *                     Russian: one|few|many — e.g. {n:день|дня|дней})
 *   <b>text</b>       rich-text tag, rendered by <T> (see Trans.tsx)
 */
export type Lang = 'en' | 'ru' | 'kk';
export type { MessageKey };
export type Params = Record<string, string | number>;

export const LANGUAGES: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ru', label: 'Русский', short: 'РУ' },
];

const DICTIONARIES: Partial<Record<Lang, Partial<Record<MessageKey, string>>>> = { en, ru };

const STORAGE_KEY = 'bmc.lang.v1';

function initialLang(): Lang {
  try {
    const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
    const saved = fromUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    if (saved && saved in DICTIONARIES) return saved as Lang;
  } catch {
    /* storage unavailable */
  }
  // English is the default; the player chooses another language explicitly.
  return 'en';
}

let current: Lang = initialLang();

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangStore>((set) => ({
  lang: current,
  setLang: (lang) => {
    if (!(lang in DICTIONARIES)) return;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    set({ lang });
  },
}));

if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {};
function pluralIndex(lang: Lang, n: number, forms: number): number {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang === 'kk' ? 'kk' : lang));
  const category = rules.select(Math.abs(n));
  if (forms === 1) return 0;
  if (forms === 2) return category === 'one' ? 0 : 1;
  // Three forms (Russian): one | few | many. Fractions take the "few" form.
  return category === 'one' ? 0 : category === 'many' ? 2 : 1;
}

const TOKEN = /\{(\w+)(?::([^}]*))?\}/g;

export function format(template: string, params: Params | undefined, lang: Lang): string {
  if (!params) return template;
  return template.replace(TOKEN, (match, name: string, forms?: string) => {
    const value = params[name];
    if (value === undefined) return match;
    if (forms === undefined) return String(value);
    const options = forms.split('|');
    return options[Math.min(options.length - 1, pluralIndex(lang, Number(value), options.length))];
  });
}

/** Translates a key in the current language. Falls back to English for a missing entry. */
export function t(key: MessageKey, params?: Params): string {
  const template = DICTIONARIES[current]?.[key] ?? en[key] ?? key;
  return format(template, params, current);
}

/** Translation for a specific language (used by tests and tools). */
export function tIn(lang: Lang, key: MessageKey, params?: Params): string {
  return format(DICTIONARIES[lang]?.[key] ?? en[key] ?? key, params, lang);
}

/**
 * Hook for components: subscribes to the language so the component re-renders on change.
 * Returns the same t() plus the current language (use it as a memo dependency when a memo
 * calls engine functions that produce text).
 */
export function useT(): { t: typeof t; lang: Lang } {
  const lang = useLangStore((s) => s.lang);
  return { t, lang };
}
