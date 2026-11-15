import { t } from '@/i18n';
export type CharacterId = 'arman' | 'dana' | 'director';

export const CHARACTERS: Record<CharacterId, { name: string; role: string; age?: number; accent: string }> = {
  arman: { get name() { return t('crew.characters.arman.name'); }, get role() { return t('crew.characters.arman.role'); }, age: 17, accent: '#52D7E8' },
  dana: { get name() { return t('crew.characters.dana.name'); }, get role() { return t('crew.characters.dana.role'); }, age: 16, accent: '#FFB84D' },
  director: { get name() { return t('crew.characters.director.name'); }, get role() { return t('crew.characters.director.role'); }, accent: '#9AA8BE' },
};

/** Flat vector portraits drawn in code — no photographs or generated images. */
export function Avatar({ who, small = false }: { who: CharacterId; small?: boolean }) {
  const c = CHARACTERS[who];
  return (
    <svg className={`avatar ${small ? 'avatar--sm' : ''}`} viewBox="0 0 64 64" role="img" aria-label={c.name}>
      <rect width="64" height="64" fill="#152238" />
      <path d="M8 66c0-14 10-22 24-22s24 8 24 22z" fill={who === 'director' ? '#2b3a52' : '#1f3554'} />
      <path d="M22 46l10 8 10-8-3-3H25z" fill={c.accent} opacity="0.9" />
      <circle cx="32" cy="27" r="11.5" fill="#d9b08c" />
      {who === 'arman' && <path d="M20 26c-1-10 6-15 13-15 8 0 13 6 11 15-2-5-5-7-8-8-5 2-11 3-16 8z" fill="#1c1a1a" />}
      {who === 'dana' && (
        <>
          <path d="M19 30c-3-12 4-20 13-20s16 8 13 20l2 16h-7l1-18c-4-1-8-4-10-8-2 4-5 7-8 8l1 18h-7z" fill="#2a1d18" />
        </>
      )}
      {who === 'director' && <path d="M20 25c0-9 6-14 12-14s12 5 12 14c-3-4-7-6-12-6s-9 2-12 6z" fill="#7d8796" />}
      {/* Headset */}
      <path d="M19 28a13 13 0 0 1 26 0" fill="none" stroke={c.accent} strokeWidth="2" />
      <rect x="16.5" y="26" width="4.5" height="8" rx="2" fill={c.accent} />
      <path d="M19 34c0 5 4 7 9 7" fill="none" stroke={c.accent} strokeWidth="1.6" />
      <circle cx="29" cy="41" r="1.6" fill={c.accent} />
    </svg>
  );
}

export function Speech({ who, children, compact = false }: { who: CharacterId; children: React.ReactNode; compact?: boolean }) {
  const c = CHARACTERS[who];
  return (
    <div className="speech">
      <Avatar who={who} />
      <div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="speech__name" style={{ color: c.accent }}>
            {c.name}
            {c.age ? `, ${c.age}` : ''}
          </span>
          {!compact && <span className="speech__role">{c.role}</span>}
        </div>
        <div className="speech__text">{children}</div>
      </div>
    </div>
  );
}

/** A short hint from one of the trainees, shown in Guided mode. */
export function Coach({ who, children }: { who: CharacterId; children: React.ReactNode }) {
  return (
    <div className="coach">
      <Avatar who={who} small />
      <div>
        <b style={{ color: CHARACTERS[who].accent }}>{CHARACTERS[who].name}:</b> {children}
      </div>
    </div>
  );
}
