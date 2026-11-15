import { Info } from 'lucide-react';
import { useState } from 'react';
import { t, type MessageKey } from '@/i18n';

export type InfoKey =
  | 'power_margin'
  | 'data_recorder'
  | 'solar_conjunction'
  | 'payload'
  | 'mass'
  | 'budget'
  | 'data_rate'
  | 'comm_link'
  | 'orbital_altitude'
  | 'mission_duration'
  | 'instruments'
  | 'power_consumption';

/**
 * A small information icon. It shows a plain-language explanation on hover, focus or click.
 * Rendered as a span (not a button) so it can sit inside clickable meters and labels.
 */
export function InfoTip({ k, label }: { k: InfoKey; label?: string }) {
  const [open, setOpen] = useState(false);
  const text = t(`info.${k}` as MessageKey);
  return (
    <span
      className={`infotip ${open ? 'is-open' : ''}`}
      tabIndex={0}
      role="note"
      aria-label={text}
      data-testid={`info-${k}`}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((o) => !o);
        }
        if (e.key === 'Escape') setOpen(false);
      }}
      onBlur={() => setOpen(false)}
    >
      <Info size={13} aria-hidden="true" />
      <span className="infotip__pop" role="tooltip">
        {label && <b className="infotip__title">{label}</b>}
        {text}
      </span>
    </span>
  );
}
