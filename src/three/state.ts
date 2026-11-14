/**
 * Mutable animation state shared between the DOM layer and the render loop.
 * Values here change every frame and deliberately live outside React state.
 * This module must not import three.js, so UI scenes can use it without loading the 3D bundle.
 */
export const worldState = {
  /** 0 → 1 progress of the opening cinematic. */
  intro: 0,
  /** Orbit speed multiplier in the operations scene (set by the simulation playback). */
  opsSpeed: 1,
  /** 0–1 dust storm strength on Mars. */
  storm: 0,
  /** True once the player has dragged the spacecraft in the designer. */
  interacting: false,
};

/** Screen positions (CSS pixels) of the spacecraft's subsystem labels, written by the render loop. */
export const calloutScreen: Record<string, { x: number; y: number; visible: boolean }> = {};
