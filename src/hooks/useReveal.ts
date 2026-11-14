import { useLayoutEffect, useRef } from 'react';
import { revealScene } from '@/app/navigation';

/** Runs the staggered entrance when a scene (or a step inside it) mounts. */
export function useReveal<T extends HTMLElement>(dep: unknown = null, delay = 0.15) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    revealScene(ref.current, delay);
  }, [dep, delay]);
  return ref;
}
