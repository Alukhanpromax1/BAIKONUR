import { SLOTS } from '@/data/components';
import { useGame } from '@/game/state/store';

/**
 * Shown when WebGL is unavailable or the 3D scene fails. The whole game stays playable:
 * planets become CSS gradients and the spacecraft becomes an interactive SVG schematic.
 */
export function Fallback2D({ loading = false }: { loading?: boolean }) {
  const scene = useGame((s) => s.scene);
  const selections = useGame((s) => s.design.selections);
  const active = useGame((s) => s.activeSlot);
  const setActive = useGame((s) => s.setActiveSlot);
  const nearEarth = scene === 'readiness';
  const panels = selections.power === 'array-enhanced' ? 3 : 2;
  const dish = selections.comms === 'comms-high' ? 46 : 30;
  const cls = (slot: string) => `schematic__part ${active === slot ? 'is-active' : ''}`;
  return (
    <div className={`world-fallback world-fallback--${scene}`} data-testid="fallback-2d">
      <div className="fallback-stars" />
      {scene !== 'designer' && <div className={`fallback-planet ${nearEarth || scene === 'intro' ? 'fallback-planet--earth' : 'fallback-planet--mars'}`} />}
      {scene === 'intro' && <div className="fallback-planet fallback-planet--mars fallback-planet--far" />}
      {scene === 'designer' && (
        <svg className="schematic" viewBox="-220 -150 440 300" role="group" aria-label="Spacecraft schematic">
          {[1, -1].map((side) => (
            <g key={side} className={cls('power')} onClick={() => setActive('power')} transform={`scale(${side} 1)`}>
              <line x1="38" y1="0" x2="58" y2="0" />
              {Array.from({ length: panels }).map((_, i) => (
                <rect key={i} x={58 + i * 44} y="-42" width="40" height="84" rx="1" />
              ))}
            </g>
          ))}
          <rect className="schematic__bus" x="-38" y="-44" width="76" height="88" rx="2" />
          <g className={cls('comms')} onClick={() => setActive('comms')}>
            <line x1="0" y1="-44" x2="0" y2="-64" />
            <path d={`M${-dish} -${64 + dish * 0.55} Q0 -${58} ${dish} -${64 + dish * 0.55}`} />
            <circle cx="0" cy={-(72 + dish * 0.55)} r="3" />
          </g>
          <g className={cls('payload')} onClick={() => setActive('payload')}>
            {(selections.payload === 'sounder' || selections.payload === 'suite') && <rect x="-28" y="6" width="22" height="18" rx="1" />}
            {(selections.payload === 'imager' || selections.payload === 'suite') && <circle cx="16" cy="15" r="10" />}
          </g>
          <g className={cls('storage')} onClick={() => setActive('storage')}>
            <rect x="-30" y="-34" width="26" height="9" />
            {selections.storage === 'storage-high' && <rect x="-30" y="-22" width="26" height="9" />}
          </g>
          <g className={cls('propulsion')} onClick={() => setActive('propulsion')}>
            <circle cx={selections.propulsion === 'prop-high' ? -16 : 0} cy="62" r="15" />
            {selections.propulsion === 'prop-high' && <circle cx="16" cy="62" r="15" />}
            <path d="M-9 78 L-16 104 L16 104 L9 78 Z" />
          </g>
          {SLOTS.map((s, i) => (
            <text key={s.id} x={-210} y={-120 + i * 18} className={`schematic__label ${active === s.id ? 'is-active' : ''}`} onClick={() => setActive(s.id)}>
              {active === s.id ? '▸ ' : ''}
              {s.label}
            </text>
          ))}
        </svg>
      )}
      <div className="fallback-note">{loading ? 'Loading 3D view…' : '2D mode — 3D graphics are not available on this device. The full mission is still playable.'}</div>
    </div>
  );
}
