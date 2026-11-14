import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '@/game/state/store';
import { QUALITY, SUN_DIR, worldState } from '../config';
import { EARTH_FRAGMENT, HALO_FRAGMENT, HALO_VERTEX, MARS_FRAGMENT, PLANET_VERTEX } from './shaders';

interface PlanetProps {
  kind: 'mars' | 'earth';
  position: THREE.Vector3;
  radius: number;
  /** Axial tilt in radians. */
  tilt?: number;
  /** Rotation speed in radians per second. */
  spin?: number;
}

const HALO = {
  mars: { color: new THREE.Color(0.95, 0.52, 0.3), scale: 1.07, strength: 0.75 },
  earth: { color: new THREE.Color(0.3, 0.6, 1.0), scale: 1.12, strength: 1.25 },
};

/** A fully procedural planet: surface shader + atmospheric halo. No image textures. */
export function Planet({ kind, position, radius, tilt = 0.44, spin = 0.012 }: PlanetProps) {
  const quality = useGame((s) => s.settings.quality);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const q = QUALITY[quality];
  const surface = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERTEX,
      fragmentShader: kind === 'mars' ? MARS_FRAGMENT : EARTH_FRAGMENT,
      uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 }, uStorm: { value: 0 } },
      defines: { OCTAVES: q.octaves, ...(q.bump && kind === 'mars' ? { USE_BUMP: '' } : {}) },
    });
    return m;
  }, [kind, q.octaves, q.bump]);

  const halo = useMemo(() => {
    const h = HALO[kind];
    return new THREE.ShaderMaterial({
      vertexShader: HALO_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      uniforms: {
        uColor: { value: h.color },
        uSunDir: { value: SUN_DIR },
        uLimb: { value: Math.sqrt(1 - 1 / h.scale ** 2) },
        uStrength: { value: h.strength },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [kind]);

  useFrame((_, dt) => {
    const step = reducedMotion ? 0 : Math.min(dt, 0.05);
    material.uniforms.uTime.value += step;
    if (kind === 'mars') {
      const u = material.uniforms.uStorm;
      u.value += (worldState.storm - u.value) * Math.min(1, dt * 1.5);
    }
    if (surface.current) surface.current.rotation.y += spin * step;
  });

  return (
    <group position={position} rotation={[0, 0, tilt]}>
      <mesh ref={surface} material={material} scale={radius}>
        <sphereGeometry args={[1, q.segments, Math.round(q.segments * 0.66)]} />
      </mesh>
      <mesh material={halo} scale={radius * HALO[kind].scale}>
        <sphereGeometry args={[1, 64, 40]} />
      </mesh>
    </group>
  );
}
