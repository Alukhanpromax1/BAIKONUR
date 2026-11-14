import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Fallback2D } from '@/components/Fallback2D';
import { Panels } from '@/components/Panels';
import { TopBar } from '@/components/TopBar';
import { useGame } from '@/game/state/store';
import CinematicIntro from '@/scenes/CinematicIntro';
import MissionBriefing from '@/scenes/MissionBriefing';
import SpacecraftDesigner from '@/scenes/SpacecraftDesigner';

// Heavy parts are loaded on demand: the 3D world and the chart-based scenes.
const World = lazy(() => import('@/three/World'));
const LaunchPlan = lazy(() => import('@/scenes/LaunchPlan'));
const LaunchReadiness = lazy(() => import('@/scenes/LaunchReadiness'));
const MarsOperations = lazy(() => import('@/scenes/MarsOperations'));
const MissionDebrief = lazy(() => import('@/scenes/MissionDebrief'));

function webglAvailable(): boolean {
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

class WorldBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function App() {
  const scene = useGame((s) => s.scene);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const [use3d, setUse3d] = useState(webglAvailable);

  useEffect(() => {
    document.title = scene === 'intro' ? 'BAIKONUR: MISSION CONTROL — The Space Mission Decision Simulator' : `BAIKONUR: MISSION CONTROL · ${scene[0].toUpperCase()}${scene.slice(1)}`;
  }, [scene]);

  return (
    <div className={`app ${reducedMotion ? 'reduced-motion' : ''}`} data-scene={scene} data-renderer={use3d ? '3d' : '2d'}>
      {use3d ? (
        <WorldBoundary onError={() => setUse3d(false)}>
          <Suspense fallback={<Fallback2D loading />}>
            <World onContextLost={() => setUse3d(false)} />
          </Suspense>
        </WorldBoundary>
      ) : (
        <Fallback2D />
      )}
      <div className={`vignette vignette--${scene}`} />
      <div className="ui">
        <TopBar />
        <main className="scene-root" key={scene}>
          <Suspense fallback={<div className="loading">Loading mission systems</div>}>
            {scene === 'intro' && <CinematicIntro />}
            {scene === 'briefing' && <MissionBriefing />}
            {scene === 'designer' && <SpacecraftDesigner />}
            {scene === 'launch' && <LaunchPlan />}
            {scene === 'readiness' && <LaunchReadiness />}
            {scene === 'operations' && <MarsOperations />}
            {scene === 'debrief' && <MissionDebrief />}
          </Suspense>
        </main>
      </div>
      <Panels />
    </div>
  );
}
