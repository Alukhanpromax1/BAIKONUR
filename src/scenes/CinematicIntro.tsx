import gsap from 'gsap';
import { t } from '@/i18n';
import { ArrowRight, SkipForward } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { navigate } from '@/app/navigation';
import { useGame } from '@/game/state/store';
import { worldState } from '@/three/state';

const DURATION = 9.5;

/** Scene 1 — a short camera flight from Earth toward Mars, then the title. */
export default function CinematicIntro() {
  const reduced = useGame((s) => s.settings.reducedMotion);
  const setSettings = useGame((s) => s.setSettings);
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [done, setDone] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reduced) {
        worldState.intro = 1;
        gsap.set('.intro__reveal', { opacity: 1, y: 0 });
        setDone(true);
        return;
      }
      worldState.intro = 0;
      setDone(false);
      const tl = gsap.timeline({ onComplete: () => setDone(true) });
      tl.to(worldState, { intro: 1, duration: DURATION, ease: 'none' }, 0)
        .fromTo('.intro__eyebrow', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 5.4)
        .fromTo('.intro__title span', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, stagger: 0.16, ease: 'power3.out' }, 5.8)
        .fromTo('.intro__tagline', { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.3em', duration: 1.2, ease: 'power2.out' }, 7.2)
        .fromTo('.intro__cta', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 8.3)
        .fromTo('.intro__foot', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 8.6);
      timeline.current = tl;
    }, root);
    return () => {
      timeline.current = null;
      ctx.revert();
    };
  }, [reduced]);

  const skip = () => {
    timeline.current?.progress(1);
    worldState.intro = 1;
    setDone(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !done) skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  return (
    <div className="intro" ref={root}>
      {!done && (
        <button type="button" className="btn btn--ghost btn--sm intro__skip" onClick={skip} data-testid="skip-intro">
          {t('intro.skip_intro')}{' '} <SkipForward size={14} />
        </button>
      )}
      <div className="intro__content">
        <div className="eyebrow intro__eyebrow intro__reveal">{t('intro.the_space_mission_decision_simulator')}</div>
        <h1 className="intro__title">
          <span className="intro__reveal">{t('intro.baikonur')}</span>
          <span className="intro__reveal intro__title-2">{t('intro.mission_control')}</span>
        </h1>
        <p className="intro__tagline intro__reveal">{t('intro.every_decision_has_a_consequence')}</p>
        <div className="intro__cta intro__reveal row row--wrap">
          <button type="button" className="btn btn--lg" onClick={() => navigate('briefing')} data-testid="start-mission">
            {t('intro.start_mission')}{' '} <ArrowRight size={16} />
          </button>
          <span className="small muted">{t('intro.about_10_15_minutes_1_4')}</span>
        </div>
      </div>
      <div className="intro__foot intro__reveal">
        <button type="button" className="link-btn xs" onClick={() => setSettings({ reducedMotion: !reduced })} data-testid="toggle-motion">
          {reduced ? t('intro.turn_full_motion_on') : t('intro.reduce_motion')}
        </button>
        <span className="xs dim">
          {t('intro.kazmars_1_is_a_fictional_educational')}
        </span>
      </div>
    </div>
  );
}
