import { Database, Settings, Users, Volume2, VolumeX } from 'lucide-react';
import { t } from '@/i18n';
import { useEffect } from 'react';
import { setSoundEnabled, sfx } from '@/audio/sound';
import { formatLightTime } from '@/game/engine/comms';
import { SCENE_ORDER, STAGES, useGame } from '@/game/state/store';
import { LanguageSwitch } from './LanguageSwitch';
import { useLightTime } from '@/hooks/useLightTime';

export function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="13" fill="#C4673F" />
      <ellipse cx="32" cy="34" rx="25" ry="8.5" fill="none" stroke="#52D7E8" strokeWidth="2.4" transform="rotate(-24 32 34)" />
      <circle cx="53" cy="22.5" r="3.4" fill="#52D7E8" />
    </svg>
  );
}

export function TopBar() {
  const scene = useGame((s) => s.scene);
  const sound = useGame((s) => s.settings.sound);
  const players = useGame((s) => s.players);
  const setSettings = useGame((s) => s.setSettings);
  const openPanel = useGame((s) => s.openPanel);
  const { reading } = useLightTime();
  const index = SCENE_ORDER.indexOf(scene);
  const bare = scene === 'intro';

  useEffect(() => {
    // Browsers only allow audio after a user gesture; the first click anywhere arms it.
    const arm = () => setSoundEnabled(useGame.getState().settings.sound);
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

  const toggleSound = () => {
    setSettings({ sound: !sound });
    setSoundEnabled(!sound);
    if (!sound) setTimeout(() => sfx.select(), 150);
  };

  return (
    <header className={`topbar ${bare ? 'topbar--bare' : ''}`}>
      <div className="brand" aria-label={t('top.baikonur_mission_control')}>
        <BrandMark />
        {!bare && (
          <div className="brand__text">
            <div className="brand__name">{t('top.baikonur')}</div>
            <div className="brand__sub">{t('top.mission_control')}</div>
          </div>
        )}
      </div>

      {!bare && (
        <ol className="stages" aria-label={t('top.mission_stages')}>
          {STAGES.map((st, i) => {
            const pos = SCENE_ORDER.indexOf(st.id);
            const cls = pos < index ? 'stage--done' : pos === index ? 'stage--current' : '';
            return (
              <li key={st.id} className={`stage ${cls}`} aria-current={pos === index ? 'step' : undefined}>
                <span className="stage__n">{i + 1}</span>
                <span className="stage__label">{st.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="topbar__right">
        <LanguageSwitch compact />
        {!bare && (
          <button type="button" className="lt-chip" onClick={() => openPanel('sources')} title={t('top.earth_mars_one_way_light_time')}>
            <span className="lt-chip__label">{t('top.earth_mars')}</span>
            <span data-testid="light-time">{formatLightTime(reading.oneWayLightTimeS)}</span>
            <span className={`tag ${reading.status === 'live' ? 'tag--cyan' : 'tag--amber'}`} data-testid="light-time-status">
              <span className={`tag__dot ${reading.status === 'live' ? 'tag__dot--pulse' : ''}`} />
              {reading.status === 'live' ? t('top.live') : t('top.cached')}
            </span>
          </button>
        )}
        {!bare && (
          <button type="button" className="icon-btn" onClick={() => openPanel('team')} aria-label={t('top.team_player', { n: players.length })} title={t('top.team')}>
            <Users size={18} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={() => openPanel('sources')} aria-label={t('top.data_sources')} title={t('top.data_sources')}>
          <Database size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? t('top.mute_sound') : t('top.turn_sound_on')} title={sound ? t('top.mute_sound') : t('top.turn_sound_on')}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button type="button" className="icon-btn" onClick={() => openPanel('settings')} aria-label={t('top.settings')} title={t('top.settings')}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
