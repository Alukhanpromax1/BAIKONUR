import gsap from 'gsap';
import { sfx } from '@/audio/sound';
import { useGame } from '@/game/state/store';
import type { SceneId } from '@/types';

let busy = false;

/** Fades the interface out, switches scene, and lets the new scene choreograph its entrance. */
export function navigate(scene: SceneId) {
  if (busy) return;
  const state = useGame.getState();
  if (state.scene === scene) return;
  const root = document.querySelector('.scene-root');
  const reduced = state.settings.reducedMotion;
  sfx.confirm();
  if (!root || reduced) {
    state.go(scene);
    return;
  }
  busy = true;
  gsap.to(root, {
    opacity: 0,
    y: -8,
    duration: 0.28,
    ease: 'power2.in',
    onComplete: () => {
      useGame.getState().go(scene);
      gsap.set(root, { opacity: 1, y: 0 });
      busy = false;
    },
  });
}

/** Staggered entrance for elements marked with data-reveal inside a scene. */
export function revealScene(container: HTMLElement | null, delay = 0.15) {
  if (!container) return;
  const items = container.querySelectorAll<HTMLElement>('[data-reveal]');
  if (useGame.getState().settings.reducedMotion) {
    gsap.set(items, { opacity: 1, y: 0, x: 0 });
    return;
  }
  gsap.fromTo(
    items,
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, delay, clearProps: 'transform' },
  );
}
