import { describe, expect, it } from 'vitest';
import { en } from '../locales/en';
import { ru } from '../locales/ru';
import { format, tIn } from '../index';

describe('dictionary completeness', () => {
  it('Russian defines every English message key', () => {
    const missing = Object.keys(en).filter((k) => !(k in ru));
    expect(missing).toEqual([]);
  });

  it('no Russian key is unknown to the English source', () => {
    const extra = Object.keys(ru).filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it('every placeholder used in a Russian message exists in the English message', () => {
    const names = (s: string) => new Set([...s.matchAll(/\{(\w+)(?::[^}]*)?\}/g)].map((m) => m[1]));
    const bad: string[] = [];
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      const a = names(en[k]);
      const b = names(ru[k]);
      for (const n of b) if (!a.has(n)) bad.push(`${k}:{${n}}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('formatting', () => {
  it('fills named parameters', () => {
    expect(format('{a} of {b}', { a: 2, b: 3 }, 'en')).toBe('2 of 3');
  });

  it('chooses English plural forms', () => {
    expect(format('{n} {n:day|days}', { n: 1 }, 'en')).toBe('1 day');
    expect(format('{n} {n:day|days}', { n: 5 }, 'en')).toBe('5 days');
  });

  it('chooses Russian plural forms (one / few / many)', () => {
    const f = (n: number) => format('{n} {n:день|дня|дней}', { n }, 'ru');
    expect(f(1)).toBe('1 день');
    expect(f(2)).toBe('2 дня');
    expect(f(4)).toBe('4 дня');
    expect(f(5)).toBe('5 дней');
    expect(f(11)).toBe('11 дней');
    expect(f(21)).toBe('21 день');
    expect(f(112)).toBe('112 дней');
  });

  it('leaves unknown placeholders visible rather than hiding them', () => {
    expect(format('x {missing}', { other: 1 }, 'en')).toBe('x {missing}');
  });

  it('translates through the language-specific dictionary', () => {
    expect(tIn('ru', 'panel.close')).toBe('Закрыть');
    expect(tIn('en', 'panel.close')).toBe('Close');
  });
});
