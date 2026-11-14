import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { SLOTS } from '@/data/components';
import { useGame } from '@/game/state/store';
import type { Selections, SlotId } from '@/types';
import { useOrbiterMaterials, type OrbiterMaterials } from './materials';

const HIGHLIGHT = new THREE.Color('#52D7E8');

interface OrbiterProps {
  selections: Selections;
  /** 0 = arrays folded, 1 = fully deployed. Read every frame. */
  deploy: { current: number };
  interactive?: boolean;
  shadows?: boolean;
}

/**
 * KAZMARS-1 — a fictional modular Mars orbiter built entirely from Three.js primitives.
 * Axes: +Y high-gain antenna, ±X solar wings, +Z instrument deck, −Y main engine.
 */
export function Orbiter({ selections, deploy, interactive = false, shadows = false }: OrbiterProps) {
  const m = useOrbiterMaterials();
  return (
    <group>
      <Bus m={m} shadows={shadows} />
      <Slot slot="power" id={selections.power} interactive={interactive}>
        <SolarWings m={m} enhanced={selections.power === 'array-enhanced'} deploy={deploy} shadows={shadows} />
      </Slot>
      <Slot slot="comms" id={selections.comms} interactive={interactive}>
        <Antenna m={m} high={selections.comms === 'comms-high'} shadows={shadows} />
      </Slot>
      <Slot slot="payload" id={selections.payload} interactive={interactive}>
        <Payload m={m} kind={selections.payload} />
      </Slot>
      <Slot slot="storage" id={selections.storage} interactive={interactive}>
        <Recorder m={m} high={selections.storage === 'storage-high'} />
      </Slot>
      <Slot slot="propulsion" id={selections.propulsion} interactive={interactive}>
        <Propulsion m={m} high={selections.propulsion === 'prop-high'} />
      </Slot>
      {interactive && <Callouts />}
    </group>
  );
}

/** Wraps the parts of one subsystem: hover/click selection, highlight glow and swap animation. */
function Slot({ slot, id, interactive, children }: { slot: SlotId; id: string; interactive: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const pop = useRef(1);
  const first = useRef(true);
  const setActive = useGame((s) => s.setActiveSlot);
  const setHovered = useGame((s) => s.setHoveredSlot);

  // Give this subsystem its own material instances so it can glow independently.
  useLayoutEffect(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    group.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (mat: THREE.Material) => {
        if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;
        let clone = cache.get(mat);
        if (!clone) {
          clone = (mat as THREE.MeshStandardMaterial).clone();
          clone.userData.baseEmissive = clone.emissive.clone();
          clone.userData.baseIntensity = clone.emissiveIntensity;
          cache.set(mat, clone);
          list.push(clone);
        }
        return clone;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    mats.current = list;
    return () => list.forEach((mat) => mat.dispose());
  }, [id]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.current = 0;
  }, [id]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    pop.current = Math.min(1, pop.current + dt * 2.6);
    const e = 1 - Math.pow(1 - pop.current, 3);
    g.scale.setScalar(0.9 + 0.1 * e);
    if (!interactive) return;
    const { activeSlot, hoveredSlot } = useGame.getState();
    const active = activeSlot === slot;
    const hovered = hoveredSlot === slot;
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3);
    const swapGlow = (1 - e) * 0.9;
    const glow = Math.max(swapGlow, hovered ? 0.3 : 0, active ? 0.1 + 0.08 * pulse : 0);
    for (const mat of mats.current) {
      const base = mat.userData.baseEmissive as THREE.Color;
      const baseI = mat.userData.baseIntensity as number;
      mat.emissive.copy(base).multiplyScalar(baseI).lerp(HIGHLIGHT, Math.min(1, glow));
      mat.emissiveIntensity = baseI > 0 ? 1 + glow : glow > 0 ? 1 : 0;
      if (baseI === 0 && glow === 0) mat.emissive.set(0, 0, 0);
    }
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(slot);
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: () => {
          setHovered(null);
          document.body.style.cursor = '';
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          setActive(slot);
        },
      }
    : {};

  return (
    <group ref={group} {...handlers}>
      {children}
    </group>
  );
}

function Bus({ m, shadows }: { m: OrbiterMaterials; shadows: boolean }) {
  const corners: [number, number][] = [
    [0.76, 0.66],
    [-0.76, 0.66],
    [0.76, -0.66],
    [-0.76, -0.66],
  ];
  return (
    <group>
      <mesh material={m.foil} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[1.5, 1.7, 1.3]} />
      </mesh>
      {[0.88, -0.88].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.frame} castShadow={shadows} receiveShadow={shadows}>
          <boxGeometry args={[1.62, 0.07, 1.42]} />
        </mesh>
      ))}
      {corners.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0, z]} material={m.frame}>
          <boxGeometry args={[0.06, 1.76, 0.06]} />
        </mesh>
      ))}
      {/* Radiator with louvres on the aft face */}
      <mesh position={[0, 0.05, -0.665]} material={m.radiator}>
        <boxGeometry args={[1.1, 1.25, 0.03]} />
      </mesh>
      {/* Access panels and blanket seams */}
      <mesh position={[0.3, 0.42, 0.656]} material={m.foilDark}>
        <boxGeometry args={[0.62, 0.5, 0.015]} />
      </mesh>
      <mesh position={[0.751, -0.35, 0.2]} material={m.white}>
        <boxGeometry args={[0.012, 0.6, 0.55]} />
      </mesh>
      {/* Star trackers: two angled baffles on the top deck */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.5 * s, 0.98, -0.42]} rotation={[-0.7, 0, 0.35 * s]}>
          <mesh material={m.black}>
            <cylinderGeometry args={[0.085, 0.06, 0.2, 20, 1, true]} />
          </mesh>
          <mesh position={[0, -0.12, 0]} material={m.frame}>
            <boxGeometry args={[0.14, 0.08, 0.14]} />
          </mesh>
        </group>
      ))}
      {/* Inertial measurement unit and sun sensors */}
      <mesh position={[-0.5, 0.97, 0.38]} material={m.white}>
        <boxGeometry args={[0.24, 0.12, 0.2]} />
      </mesh>
      {corners.map(([x, z]) => (
        <mesh key={`s${x}${z}`} position={[x * 0.98, 0.93, z * 0.98]} material={m.lens}>
          <sphereGeometry args={[0.035, 12, 8]} />
        </mesh>
      ))}
      {/* Low-gain antenna */}
      <group position={[0.58, 0.92, 0.5]}>
        <mesh position={[0, 0.12, 0]} material={m.steel}>
          <cylinderGeometry args={[0.018, 0.018, 0.24, 8]} />
        </mesh>
        <mesh position={[0, 0.27, 0]} material={m.white}>
          <coneGeometry args={[0.06, 0.1, 16]} />
        </mesh>
      </group>
    </group>
  );
}

const PANEL_W = 1.15;
const PANEL_H = 2.0;

function SolarWings({ m, enhanced, deploy, shadows }: { m: OrbiterMaterials; enhanced: boolean; deploy: { current: number }; shadows: boolean }) {
  return (
    <group rotation={[-0.32, 0, 0]}>
      <Wing m={m} side={1} panels={enhanced ? 3 : 2} deploy={deploy} shadows={shadows} />
      <Wing m={m} side={-1} panels={enhanced ? 3 : 2} deploy={deploy} shadows={shadows} />
    </group>
  );
}

function Wing({ m, side, panels, deploy, shadows }: { m: OrbiterMaterials; side: 1 | -1; panels: number; deploy: { current: number }; shadows: boolean }) {
  const hinges = useRef<(THREE.Group | null)[]>([]);
  const yoke = useRef<THREE.Group>(null);
  const panelMaterials = useMemo(() => [m.panelEdge, m.panelEdge, m.panelEdge, m.panelEdge, m.cells, m.panelBack], [m]);

  useFrame(() => {
    const fold = 1 - THREE.MathUtils.clamp(deploy.current, 0, 1);
    const eased = fold * fold * (3 - 2 * fold);
    if (yoke.current) yoke.current.rotation.y = -eased * 1.35;
    hinges.current.forEach((h, i) => {
      if (h) h.rotation.y = (i % 2 === 0 ? 1 : -1) * eased * Math.PI * 0.985 * (i === 0 ? 0.5 : 1);
    });
  });

  // Nested hinges so the wing folds like an accordion.
  const build = (i: number): ReactNode => (
    <group
      ref={(el) => {
        hinges.current[i] = el;
      }}
      position={[i === 0 ? 0.55 : PANEL_W + 0.03, 0, 0]}
    >
      <mesh position={[0, 0, 0]} material={m.steel}>
        <cylinderGeometry args={[0.022, 0.022, PANEL_H * 0.92, 8]} />
      </mesh>
      <mesh position={[PANEL_W / 2 + 0.015, 0, 0]} material={panelMaterials} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[PANEL_W, PANEL_H, 0.035]} />
      </mesh>
      {i + 1 < panels && build(i + 1)}
    </group>
  );

  return (
    <group position={[0.75 * side, 0, 0]} scale={[side, 1, 1]}>
      <group ref={yoke}>
        {/* Yoke: a V of two struts from the drive motor to the first panel */}
        <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.frame}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0.31, 0.3 * s, 0]} rotation={[0, 0, Math.PI / 2 - 0.86 * s]} material={m.steel}>
            <cylinderGeometry args={[0.016, 0.016, 0.78, 8]} />
          </mesh>
        ))}
        {build(0)}
      </group>
    </group>
  );
}

function Antenna({ m, high, shadows }: { m: OrbiterMaterials; high: boolean; shadows: boolean }) {
  const r = high ? 1.2 : 0.78;
  const depth = r * 0.28;
  const dish = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const x = (i / 18) * r;
      pts.push(new THREE.Vector2(x, depth * (x / r) ** 2));
    }
    return new THREE.LatheGeometry(pts, 56);
  }, [r, depth]);
  const dishMat = useMemo(() => {
    const mat = m.white.clone();
    mat.side = THREE.DoubleSide;
    return mat;
  }, [m]);
  const focus = (r * r) / (4 * depth);
  const struts = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 + 0.5);
  return (
    <group position={[-0.08, 0.92, -0.05]}>
      {/* Mast and two-axis gimbal */}
      <mesh position={[0, 0.2, 0]} material={m.steel}>
        <cylinderGeometry args={[0.055, 0.07, 0.4, 14]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} material={m.frame}>
        <boxGeometry args={[0.24, 0.14, 0.2]} />
      </mesh>
      <group position={[0, 0.52, 0]} rotation={[0.42, 0, -0.3]}>
        <mesh geometry={dish} material={dishMat} castShadow={shadows} receiveShadow={shadows} />
        <mesh position={[0, depth, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}>
          <torusGeometry args={[r, 0.016, 8, 64]} />
        </mesh>
        {/* Back ribs */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[0, -0.012, 0]} rotation={[0, (i / 6) * Math.PI, 0]} material={m.frame}>
            <boxGeometry args={[r * 1.2, 0.03, 0.02]} />
          </mesh>
        ))}
        {/* Feed support struts and sub-reflector */}
        {struts.map((a) => {
          const from = new THREE.Vector3(Math.cos(a) * r * 0.92, depth * 0.85, Math.sin(a) * r * 0.92);
          const to = new THREE.Vector3(0, focus * 0.78, 0);
          const mid = from.clone().add(to).multiplyScalar(0.5);
          const len = from.distanceTo(to);
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
          return (
            <mesh key={a} position={mid} quaternion={quat} material={m.steel}>
              <cylinderGeometry args={[0.011, 0.011, len, 6]} />
            </mesh>
          );
        })}
        <mesh position={[0, focus * 0.78, 0]} rotation={[Math.PI, 0, 0]} material={m.foil}>
          <coneGeometry args={[r * 0.13, r * 0.1, 24]} />
        </mesh>
        <mesh position={[0, 0.08, 0]} material={m.frame}>
          <cylinderGeometry args={[0.05, 0.075, 0.18, 16]} />
        </mesh>
      </group>
      {high && (
        <group>
          {/* Travelling-wave-tube amplifier and waveguide for the high-capacity link */}
          <mesh position={[0.5, 0.07, 0.18]} material={m.white}>
            <boxGeometry args={[0.42, 0.14, 0.26]} />
          </mesh>
          <mesh position={[0.5, 0.15, 0.18]} material={m.ledCyan}>
            <boxGeometry args={[0.3, 0.012, 0.03]} />
          </mesh>
          <mesh position={[0.24, 0.12, 0.1]} rotation={[0, 0, Math.PI / 2]} material={m.steel}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          </mesh>
          <mesh position={[-0.42, 0.12, 0.42]} rotation={[0.9, 0, 0]} material={m.foil}>
            <coneGeometry args={[0.1, 0.18, 4, 1, true]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Payload({ m, kind }: { m: OrbiterMaterials; kind: string }) {
  const sounder = kind === 'sounder' || kind === 'suite';
  const imager = kind === 'imager' || kind === 'suite';
  const both = sounder && imager;
  return (
    <group position={[0, -0.25, 0.66]}>
      {/* Instrument deck bracket */}
      <mesh position={[0, 0, 0.03]} material={m.frame}>
        <boxGeometry args={[both ? 1.3 : 0.8, 0.5, 0.06]} />
      </mesh>
      {sounder && <Sounder m={m} x={both ? -0.33 : 0} />}
      {imager && <Imager m={m} x={both ? 0.36 : 0} />}
    </group>
  );
}

/** Limb sounder: twin telescopes on an azimuth/elevation yoke, slowly scanning. */
function Sounder({ m, x }: { m: OrbiterMaterials; x: number }) {
  const head = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (head.current) head.current.rotation.x = -0.35 + Math.sin(state.clock.elapsedTime * 0.6) * 0.3;
  });
  return (
    <group position={[x, 0, 0.06]}>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}>
        <cylinderGeometry args={[0.15, 0.17, 0.1, 24]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.2 * s, 0, 0.24]} material={m.white}>
          <boxGeometry args={[0.04, 0.16, 0.3]} />
        </mesh>
      ))}
      <group ref={head} position={[0, 0, 0.3]}>
        <mesh material={m.white}>
          <boxGeometry args={[0.34, 0.26, 0.26]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0.085 * s, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={m.foil}>
              <cylinderGeometry args={[0.07, 0.07, 0.1, 20, 1, true]} />
            </mesh>
            <mesh position={[0, -0.03, 0]} material={m.lens}>
              <cylinderGeometry args={[0.062, 0.062, 0.02, 20]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.135, 0]} material={m.ledCyan}>
          <boxGeometry args={[0.1, 0.012, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}

/** Wide-angle weather camera with a sunshade. */
function Imager({ m, x }: { m: OrbiterMaterials; x: number }) {
  return (
    <group position={[x, 0, 0.06]}>
      <mesh position={[0, 0, 0.14]} material={m.foilDark}>
        <boxGeometry args={[0.3, 0.26, 0.26]} />
      </mesh>
      <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]} material={m.black}>
        <cylinderGeometry args={[0.1, 0.1, 0.16, 24]} />
      </mesh>
      <mesh position={[0, 0, 0.47]} rotation={[-Math.PI / 2, 0, 0]} material={m.black}>
        <cylinderGeometry args={[0.17, 0.105, 0.14, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 0, 0.415]} rotation={[Math.PI / 2, 0, 0]} material={m.lens}>
        <cylinderGeometry args={[0.092, 0.092, 0.02, 24]} />
      </mesh>
      <mesh position={[0.1, 0.135, 0.14]} material={m.ledAmber}>
        <boxGeometry args={[0.04, 0.012, 0.04]} />
      </mesh>
    </group>
  );
}

function Recorder({ m, high }: { m: OrbiterMaterials; high: boolean }) {
  const modules = high ? 2 : 1;
  return (
    <group position={[-0.42, 0.42, 0.66]}>
      {Array.from({ length: modules }).map((_, i) => (
        <group key={i} position={[0, -i * 0.26, 0]}>
          <mesh position={[0, 0, 0.06]} material={m.black}>
            <boxGeometry args={[0.52, 0.22, 0.12]} />
          </mesh>
          {/* Cooling fins */}
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[-0.2 + k * 0.05, 0, 0.13]} material={m.frame}>
              <boxGeometry args={[0.012, 0.2, 0.03]} />
            </mesh>
          ))}
          {[0, 1].map((k) => (
            <mesh key={k} position={[0.14 + k * 0.07, 0.06, 0.125]} material={i === 0 ? m.ledCyan : m.ledAmber}>
              <boxGeometry args={[0.035, 0.035, 0.012]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Propulsion({ m, high }: { m: OrbiterMaterials; high: boolean }) {
  const nozzle = useMemo(() => {
    const exit = high ? 0.4 : 0.3;
    const len = high ? 0.68 : 0.52;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector2(0.07 + (exit - 0.07) * Math.pow(t, 0.62), -t * len));
    }
    return new THREE.LatheGeometry(pts, 40);
  }, [high]);
  const tankR = high ? 0.36 : 0.4;
  const tanks: [number, number][] = high
    ? [
        [0.37, 0.37],
        [-0.37, 0.37],
        [0.37, -0.37],
        [-0.37, -0.37],
      ]
    : [[0, 0]];
  const corners: [number, number][] = [
    [0.7, 0.6],
    [-0.7, 0.6],
    [0.7, -0.6],
    [-0.7, -0.6],
  ];
  return (
    <group position={[0, -0.92, 0]}>
      {/* Thrust structure */}
      <mesh position={[0, -0.36, 0]} material={m.frame}>
        <cylinderGeometry args={[high ? 0.86 : 0.62, high ? 0.5 : 0.36, 0.72, 28, 1, true]} />
      </mesh>
      {tanks.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, -0.3, z]} material={m.tank}>
          <sphereGeometry args={[tankR, 28, 20]} />
        </mesh>
      ))}
      <mesh position={[0, -0.74, 0]} material={m.steel}>
        <cylinderGeometry args={[0.12, 0.09, 0.14, 20]} />
      </mesh>
      <mesh position={[0, -0.8, 0]} geometry={nozzle} material={m.nozzle} />
      {/* Attitude thruster clusters */}
      {corners.map(([x, z]) => (
        <group key={`t${x}${z}`} position={[x, -0.04, z]}>
          <mesh material={m.frame}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
          </mesh>
          <mesh position={[Math.sign(x) * 0.08, -0.03, 0]} rotation={[0, 0, Math.sign(x) * 1.1]} material={m.nozzle}>
            <coneGeometry args={[0.045, 0.1, 12, 1, true]} />
          </mesh>
          <mesh position={[0, -0.03, Math.sign(z) * 0.08]} rotation={[-Math.sign(z) * 1.1, 0, 0]} material={m.nozzle}>
            <coneGeometry args={[0.045, 0.1, 12, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const CALLOUT_POS: Record<SlotId, [number, number, number]> = {
  payload: [0, -0.25, 1.25],
  power: [2.5, 0.75, 0.1],
  comms: [-0.2, 2.35, 0.35],
  storage: [-0.42, 0.42, 0.95],
  propulsion: [0.2, -2.25, 0.2],
};

/** Clickable labels anchored to each subsystem — the keyboard-accessible way to inspect parts. */
function Callouts() {
  const active = useGame((s) => s.activeSlot);
  const setActive = useGame((s) => s.setActiveSlot);
  return (
    <>
      {SLOTS.map((s) => (
        <Html key={s.id} position={CALLOUT_POS[s.id]} center zIndexRange={[20, 10]}>
          <button type="button" className={`callout ${active === s.id ? 'is-active' : ''}`} onClick={() => setActive(s.id)} aria-label={`Inspect ${s.label}`}>
            <span className="callout__dot" />
            <span className="callout__label">{s.label}</span>
          </button>
        </Html>
      ))}
    </>
  );
}
