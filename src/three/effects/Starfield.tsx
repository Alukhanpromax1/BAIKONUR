import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '@/game/state/store';
import { createRng } from '@/game/scenarios/rng';
import { QUALITY, SUN_DIR } from '../config';

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * mv;
}
`;
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  float a = pow(core, 1.6) * vTwinkle;
  gl_FragColor = vec4(vColor * a, a);
}
`;

/** Stars sit at infinity: the field follows the camera so they never show parallax. */
export function Starfield() {
  const quality = useGame((s) => s.settings.quality);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const count = QUALITY[quality].stars;
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  const { geometry, material } = useMemo(() => {
    const rng = createRng(20261114);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const band = new THREE.Vector3(0.35, 0.9, 0.25).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Uniform on the sphere, with a denser band that reads as the Milky Way.
      do {
        v.set(rng.normal(), rng.normal(), rng.normal()).normalize();
      } while (i % 3 === 0 && Math.abs(v.dot(band)) > 0.22 && rng.next() < 0.85);
      positions.set([v.x * 900, v.y * 900, v.z * 900], i * 3);
      const mag = rng.next();
      sizes[i] = 1.5 + Math.pow(mag, 6) * 5.5 + rng.next() * 1.1;
      phases[i] = rng.next();
      const t = rng.next();
      const c = t < 0.12 ? [1.0, 0.82, 0.66] : t < 0.3 ? [0.72, 0.84, 1.0] : [0.93, 0.95, 1.0];
      const b = 0.7 + Math.pow(mag, 3) * 0.6;
      colors.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count]);

  useFrame((_, dt) => {
    group.current?.position.copy(camera.position);
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    if (!reducedMotion) material.uniforms.uTime.value += dt;
  });

  return (
    <group ref={group} renderOrder={-10}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <SunGlow />
    </group>
  );
}

/** A soft additive disc in the Sun's direction. */
function SunGlow() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.06, 'rgba(255,240,205,0.95)');
    g.addColorStop(0.16, 'rgba(255,214,150,0.28)');
    g.addColorStop(0.45, 'rgba(255,190,120,0.06)');
    g.addColorStop(1, 'rgba(255,180,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const pos = useMemo(() => SUN_DIR.clone().multiplyScalar(800), []);
  return (
    <sprite position={pos} scale={[330, 330, 1]}>
      <spriteMaterial map={texture} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} transparent />
    </sprite>
  );
}

/** Sparse drifting motes in the foreground volume: they give the camera moves a sense of depth. */
export function SpaceDust() {
  const quality = useGame((s) => s.settings.quality);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const count = QUALITY[quality].dust;
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rng = createRng(77);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) positions.set([rng.range(-90, 90), rng.range(-22, 22), rng.range(-50, 30)], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y += dt * 0.0015;
  });
  if (count === 0) return null;
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#9fc4e8" size={0.07} sizeAttenuation transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
