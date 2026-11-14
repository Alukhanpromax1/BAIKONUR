import { Environment, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ORBITS } from '@/data/orbits';
import { useGame } from '@/game/state/store';
import type { OrbitId, SceneId } from '@/types';
import { BAY_POS, EARTH_POS, EARTH_RADIUS, MARS_POS, MARS_RADIUS, QUALITY, RIGS, SUN_DIR, worldState } from './config';
import { SpaceDust, Starfield } from './effects/Starfield';
import { angularRate, displayOrbit, orbitPoint, orbitPolyline } from './orbits';
import { Planet } from './planets/Planet';
import { Orbiter } from './spacecraft/Orbiter';

// ── Opening cinematic paths ───────────────────────────────────────────────────
const INTRO_CAM = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(-34, 9, 34), new THREE.Vector3(-45, 4, 16), new THREE.Vector3(-34, 2.5, 13), new THREE.Vector3(-21, 2.2, 13.5)],
  false,
  'catmullrom',
  0.5,
);
const INTRO_LOOK = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(-10, 14, -70), new THREE.Vector3(-64, -2, -30), new THREE.Vector3(-22, 0, -8), new THREE.Vector3(30, 0, -22)],
  false,
  'catmullrom',
  0.5,
);
const INTRO_CRAFT = new THREE.CatmullRomCurve3([new THREE.Vector3(-64, -3, -6), new THREE.Vector3(-44, -1, -4), new THREE.Vector3(-22, 0.6, -6), new THREE.Vector3(0, 1.6, -12)]);

const ease = (t: number) => t * t * (3 - 2 * t);
const damp = (current: number, target: number, lambda: number, dt: number) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(-10, 14, -70));
  const shift = useRef({ x: 0, y: 0 });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const designerArmed = useRef(false);
  const scene = useGame((s) => s.scene);

  useEffect(() => {
    designerArmed.current = false;
    if (controls.current) controls.current.enabled = false;
  }, [scene, controls]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { scene: sc, settings } = useGame.getState();
    const cam = camera as THREE.PerspectiveCamera;
    const mobile = size.width < 900;
    let fov = 40;
    let sx = 0;
    let sy = 0;

    if (sc === 'intro') {
      const t = ease(THREE.MathUtils.clamp(worldState.intro, 0, 1));
      INTRO_CAM.getPoint(t, tmp);
      INTRO_LOOK.getPoint(t, tmp2);
      cam.position.copy(tmp);
      look.current.copy(tmp2);
      cam.lookAt(look.current);
      // As the title arrives, slide the picture up and right so the spacecraft and Mars clear the text.
      sx = mobile ? 0 : -0.1 * t;
      sy = (mobile ? 0.3 : 0.24) * t;
    } else {
      const rig = RIGS[sc];
      fov = rig.fov;
      sx = mobile ? 0 : rig.shiftX;
      sy = mobile ? rig.shiftYMobile : rig.shiftY;
      const c = controls.current;
      if (sc === 'designer' && designerArmed.current && c) {
        // Player controls the camera; keep a slow turntable until they take over.
        c.autoRotate = !settings.reducedMotion && !worldState.interacting;
        c.update();
      } else {
        const lambda = settings.reducedMotion ? 60 : 2.6;
        tmp.set(...rig.position);
        if (mobile) tmp.sub(tmp2.set(...rig.target)).multiplyScalar(1.35).add(tmp2);
        cam.position.set(damp(cam.position.x, tmp.x, lambda, dt), damp(cam.position.y, tmp.y, lambda, dt), damp(cam.position.z, tmp.z, lambda, dt));
        tmp2.set(...rig.target);
        look.current.set(damp(look.current.x, tmp2.x, lambda, dt), damp(look.current.y, tmp2.y, lambda, dt), damp(look.current.z, tmp2.z, lambda, dt));
        cam.lookAt(look.current);
        if (sc === 'designer' && c && cam.position.distanceTo(tmp) < 0.25) {
          c.target.copy(BAY_POS);
          c.enabled = true;
          c.update();
          designerArmed.current = true;
        }
      }
    }

    const lambda = settings.reducedMotion ? 60 : 3;
    shift.current.x = damp(shift.current.x, sx, lambda, dt);
    shift.current.y = damp(shift.current.y, sy, lambda, dt);
    cam.fov = damp(cam.fov, mobile ? fov + 6 : fov, lambda, dt);
    cam.setViewOffset(size.width, size.height, shift.current.x * size.width, shift.current.y * size.height, size.width, size.height);
  });
  return null;
}

/** The single spacecraft instance: it is placed differently in every scene. */
function SpacecraftActor() {
  const group = useRef<THREE.Group>(null);
  const selections = useGame((s) => s.design.selections);
  const scene = useGame((s) => s.scene);
  const quality = useGame((s) => s.settings.quality);
  const deploy = useRef(1);
  const deployTarget = useRef(1);
  const nu = useRef(0.6);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    if (scene === 'designer') {
      // Arrays unfold each time the design bay opens.
      deploy.current = useGame.getState().settings.reducedMotion ? 1 : 0;
      deployTarget.current = 1;
    } else {
      deploy.current = 1;
    }
  }, [scene]);

  useFrame((state, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const { scene: sc, design, settings } = useGame.getState();
    // Real elapsed time here, so the arrays finish unfolding even on slow machines.
    deploy.current = Math.min(deployTarget.current, deploy.current + Math.min(rawDt, 0.25) * 0.42);
    g.visible = sc !== 'readiness';

    if (sc === 'intro') {
      const t = ease(THREE.MathUtils.clamp(worldState.intro * 1.05, 0, 1));
      INTRO_CRAFT.getPoint(t, g.position);
      // Turns slowly from side-on to facing the camera, so the arrays catch the sunlight at the end.
      g.rotation.set(0.22 - 0.1 * t, -2.1 + 1.45 * t, 0.42 - 0.26 * t + Math.sin(state.clock.elapsedTime * 0.3) * 0.02);
      g.scale.setScalar(1);
    } else if (sc === 'designer') {
      g.position.copy(BAY_POS);
      g.rotation.set(0.06, -0.42, 0.04);
      g.scale.setScalar(1);
    } else {
      const orbit = displayOrbit(design.orbit);
      const speed = sc === 'operations' ? 0.55 * worldState.opsSpeed : 0.14;
      if (!settings.reducedMotion || sc === 'operations') nu.current += dt * speed * angularRate(orbit, nu.current) * (design.orbit === 'low-polar' ? 1 : 0.6);
      orbitPoint(orbit, nu.current, tmp).add(MARS_POS);
      g.position.copy(tmp);
      // Nadir pointing: the instrument deck (+Z) faces the planet.
      g.lookAt(MARS_POS);
      g.rotateZ(0.4);
      g.scale.setScalar(sc === 'launch' ? 0.11 : 0.13);
    }
  });

  return (
    <group ref={group}>
      <Orbiter selections={selections} deploy={deploy} interactive={scene === 'designer'} shadows={scene === 'designer' && QUALITY[quality].shadows} />
      <CommBeam />
    </group>
  );
}

/** Downlink beam toward Earth, visible in mission operations while the link is up. */
function CommBeam() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#52D7E8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const pq = useMemo(() => new THREE.Quaternion(), []);
  useFrame((state, dt) => {
    const mesh = ref.current;
    if (!mesh || !mesh.parent) return;
    const { scene, opsHighlight } = useGame.getState();
    const on = scene === 'operations' && opsHighlight !== 'blackout' && opsHighlight !== 'safe';
    const target = on ? 0.3 + 0.12 * Math.sin(state.clock.elapsedTime * 5) : 0;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 4);
    mesh.visible = mat.opacity > 0.01;
    if (!mesh.visible) return;
    // Aim the beam at Earth in world space, then express it in the spacecraft's local frame.
    mesh.parent.getWorldPosition(tmp);
    tmp.subVectors(EARTH_POS, tmp).normalize();
    q.setFromUnitVectors(up, tmp);
    mesh.parent.getWorldQuaternion(pq).invert();
    mesh.quaternion.copy(pq.multiply(q));
  });
  return (
    <mesh ref={ref} material={mat}>
      <cylinderGeometry args={[0.05, 0.05, 420, 6, 1, true]} />
    </mesh>
  );
}

function OrbitRings() {
  const scene = useGame((s) => s.scene);
  const selected = useGame((s) => s.design.orbit);
  const show: Partial<Record<SceneId, 'all' | 'selected'>> = { launch: 'all', operations: 'selected', debrief: 'selected' };
  const mode = show[scene];
  const lines = useMemo(() => Object.fromEntries(ORBITS.map((o) => [o.id, orbitPolyline(displayOrbit(o.id))])) as Record<OrbitId, THREE.Vector3[]>, []);
  if (!mode) return null;
  return (
    <group position={MARS_POS}>
      {ORBITS.filter((o) => mode === 'all' || o.id === selected).map((o) => {
        const active = o.id === selected;
        return (
          <Line
            key={o.id}
            points={lines[o.id]}
            color={active ? '#52D7E8' : '#5d7fa6'}
            lineWidth={active ? 1.8 : 1}
            transparent
            opacity={active ? 0.95 : 0.32}
            dashed={!active}
            dashSize={0.5}
            gapSize={0.35}
          />
        );
      })}
    </group>
  );
}

function Lights() {
  const scene = useGame((s) => s.scene);
  const quality = useGame((s) => s.settings.quality);
  const shadows = scene === 'designer' && QUALITY[quality].shadows;
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.position.copy(SUN_DIR).multiplyScalar(14);
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <ambientLight intensity={0.1} color="#7fa8d8" />
      <directionalLight
        ref={light}
        intensity={3.4}
        color="#fff3e0"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={2}
        shadow-camera-far={30}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      {/* Cool bounce light so the shadowed side of the spacecraft keeps its form */}
      <directionalLight position={[6, -3, -8]} intensity={0.35} color="#4f8fd6" />
    </>
  );
}

function Scene() {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const scene = useGame((s) => s.scene);
  return (
    <>
      <color attach="background" args={['#04070F']} />
      <Lights />
      <Environment resolution={128} frames={1} background={false}>
        <mesh scale={50}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#0a1322" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="rect" intensity={5} color="#fff4e2" position={SUN_DIR.clone().multiplyScalar(12)} scale={9} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#3f79c4" position={[8, -4, -9]} scale={14} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.6} color="#52D7E8" position={[-9, 1, -7]} scale={[12, 1.6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#c96b3d" position={[2, -9, 3]} scale={7} target={[0, 0, 0]} />
      </Environment>
      <Starfield />
      <SpaceDust />
      <Planet kind="earth" position={EARTH_POS} radius={EARTH_RADIUS} tilt={0.41} spin={0.02} />
      <Planet kind="mars" position={MARS_POS} radius={MARS_RADIUS} tilt={0.44} spin={0.016} />
      <OrbitRings />
      <SpacecraftActor />
      <OrbitControls
        ref={controls}
        enabled={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={24}
        autoRotateSpeed={0.55}
        onStart={() => {
          worldState.interacting = true;
        }}
        domElement={undefined}
      />
      <CameraRig controls={controls} />
      {scene === 'designer' && <DesignerFloor />}
    </>
  );
}

/** A faint shadow-catching disc under the spacecraft in the design bay. */
function DesignerFloor() {
  const quality = useGame((s) => s.settings.quality);
  if (!QUALITY[quality].shadows) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.1, 0]} receiveShadow>
      <circleGeometry args={[9, 48]} />
      <shadowMaterial transparent opacity={0.28} />
    </mesh>
  );
}

export default function World({ onContextLost }: { onContextLost: () => void }) {
  const quality = useGame((s) => s.settings.quality);
  const scene = useGame((s) => s.scene);
  const q = QUALITY[quality];
  return (
    <Canvas
      className={`world world--${scene}`}
      dpr={q.dpr}
      shadows={q.shadows}
      camera={{ fov: 40, near: 0.1, far: 3000, position: [-34, 9, 34] }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
