import * as THREE from 'three';
import type { Quality, SceneId } from '@/types';

/** Shared layout of the 3D world. One canvas, one starfield, every scene is a place in it. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.32, 0.77).normalize();
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
  /** Same, vertically, used on narrow screens. */
  shiftYMobile: number;
}

export const RIGS: Record<Exclude<SceneId, 'intro'>, Rig> = {
  briefing: { position: [50, 3, 4], target: [70, 0, -20], fov: 38, shiftX: -0.2, shiftYMobile: 0.18 },
  designer: { position: [6.2, 3.2, 8.6], target: [0, 0, 0], fov: 36, shiftX: 0.16, shiftYMobile: 0.2 },
  launch: { position: [62, 15, 19], target: [70, 0, -20], fov: 38, shiftX: 0.17, shiftYMobile: 0.2 },
  readiness: { position: [-57, 2, -16], target: [-70, -4, -30], fov: 40, shiftX: -0.26, shiftYMobile: 0.24 },
  operations: { position: [70, 13, 24], target: [70, 0, -20], fov: 38, shiftX: 0, shiftYMobile: 0.08 },
  debrief: { position: [44, 5, 12], target: [70, 0, -20], fov: 36, shiftX: -0.24, shiftYMobile: 0.22 },
};

/**
 * Mutable animation state shared between the DOM layer and the render loop.
 * Values here change every frame and deliberately live outside React state.
 */
export const worldState = {
  /** 0 → 1 progress of the opening cinematic. */
  intro: 0,
  /** Seconds of launch interstitial, −1 when inactive. */
  launchT: -1,
  /** Orbit phase advance per second in the operations scene (set by the sim playback). */
  opsSpeed: 1,
  /** 0–1 dust storm strength on Mars. */
  storm: 0,
  /** True while the player is dragging the spacecraft in the designer. */
  interacting: false,
};

/** Display radius for an orbit altitude. Orbits are drawn compressed (not to scale). */
export function displayRadius(altitudeKm: number): number {
  return MARS_RADIUS * (1 + Math.log10(1 + altitudeKm / 600));
}
