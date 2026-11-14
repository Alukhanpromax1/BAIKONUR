import * as THREE from 'three';
import { ORBIT_BY_ID } from '@/data/orbits';
import type { OrbitId } from '@/types';
import { displayRadius } from './config';

/**
 * Simplified display orbits around Mars (educational, not to scale and not propagated).
 * Each orbit is an ellipse with Mars at one focus, drawn in a tilted plane.
 */
export interface DisplayOrbit {
  a: number;
  e: number;
  /** Rotation that takes the orbit's own plane (XZ) into the scene. */
  quat: THREE.Quaternion;
}

const PLANES: Record<OrbitId, [number, number, number]> = {
  'low-polar': [Math.PI / 2 - 0.05, 0.5, 0],
  'mid-inclined': [1.05, -0.35, 0],
  'high-elliptical': [0.52, 0.9, 0.15],
};

const cache = new Map<OrbitId, DisplayOrbit>();

export function displayOrbit(id: OrbitId): DisplayOrbit {
  let o = cache.get(id);
  if (!o) {
    const def = ORBIT_BY_ID[id];
    const rp = displayRadius(def.periapsisKm);
    const ra = displayRadius(def.apoapsisKm);
    const [x, y, z] = PLANES[id];
    o = { a: (rp + ra) / 2, e: (ra - rp) / (ra + rp), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ')) };
    cache.set(id, o);
  }
  return o;
}

/** Position relative to Mars' centre at true anomaly ν. */
export function orbitPoint(o: DisplayOrbit, nu: number, out = new THREE.Vector3()): THREE.Vector3 {
  const r = (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(nu));
  return out.set(Math.cos(nu) * r, 0, Math.sin(nu) * r).applyQuaternion(o.quat);
}

/** Angular rate factor from Kepler's second law: faster near periapsis. */
export function angularRate(o: DisplayOrbit, nu: number): number {
  const r = (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(nu));
  return (o.a * o.a * Math.sqrt(1 - o.e * o.e)) / (r * r);
}

export function orbitPolyline(o: DisplayOrbit, segments = 180): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) pts.push(orbitPoint(o, (i / segments) * Math.PI * 2));
  return pts;
}
