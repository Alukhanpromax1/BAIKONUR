import * as THREE from 'three';
import type { Quality, SceneId } from '@/types';

/** Shared layout of the 3D world. One canvas, one starfield, every scene is a place in it. */
export const SUN_DIR = new THREE.Vector3(-0.74, 0.3, 0.6).normalize();
export const EARTH_POS = new THREE.Vector3(-70, -4, -30);
export const EARTH_RADIUS = 7;
export const MARS_POS = new THREE.Vector3(70, 0, -20);
export const MARS_RADIUS = 5;
export const MARS_RADIUS_KM = 3389.5;
export const BAY_POS = new THREE.Vector3(0, 0, 0);

export const QUALITY: Record<Quality, { dpr: [number, number]; stars: number; octaves: number; bump: boolean; shadows: boolean; segments: number; dust: number }> = {
  high: { dpr: [1, 2], stars: 5200, octaves: 6, bump: true, shadows: true, segments: 128, dust: 420 },
  balanced: { dpr: [1, 1.5], stars: 3200, octaves: 5, bump: true, shadows: true, segments: 96, dust: 260 },
  low: { dpr: [1, 1], stars: 1400, octaves: 3, bump: false, shadows: false, segments: 64, dust: 0 },
};

export interface Rig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Shifts the picture sideways (fraction of width) so the subject clears the UI panel. */
  shiftX: number;
  /** Shifts the picture up (fraction of height) on wide screens. */
  shiftY: number;
  /** Same, used on narrow screens where the controls sit below the 3D view. */
  shiftYMobile: number;
}

export const RIGS: Record<Exclude<SceneId, 'intro'>, Rig> = {
  briefing: { position: [50, 3, 4], target: [70, 0, -20], fov: 38, shiftX: -0.2, shiftY: 0, shiftYMobile: 0.18 },
  designer: { position: [7.6, 4.1, 10.6], target: [0, 0, 0], fov: 36, shiftX: 0.15, shiftY: 0.07, shiftYMobile: 0.27 },
  launch: { position: [62, 15, 19], target: [70, 0, -20], fov: 38, shiftX: 0.17, shiftY: 0.04, shiftYMobile: 0.27 },
  readiness: { position: [-65, 1.5, -12.5], target: [-70, -4, -30], fov: 40, shiftX: -0.26, shiftY: 0, shiftYMobile: 0.24 },
  operations: { position: [70, 13, 24], target: [70, 0, -20], fov: 38, shiftX: 0, shiftY: 0.02, shiftYMobile: 0.2 },
  debrief: { position: [44, 5, 12], target: [70, 0, -20], fov: 36, shiftX: -0.24, shiftY: 0, shiftYMobile: 0.22 },
};

export { worldState } from './state';

/** Display radius for an orbit altitude. Orbits are drawn compressed (not to scale). */
export function displayRadius(altitudeKm: number): number {
  return MARS_RADIUS * (1 + Math.log10(1 + altitudeKm / 600));
}
