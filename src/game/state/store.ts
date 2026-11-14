import { create } from 'zustand';
import { RECOMMENDED, RECOMMENDED_PLAN } from '@/data/components';
import type { OpsDecisions } from '@/game/ops/simulate';
import type { EvidencePanel, FinalCall, PrimaryChoice } from '@/game/scenarios/decision';
import { randomSeed } from '@/game/scenarios/rng';
import { scenarioFromSeed, type ScenarioId } from '@/game/scenarios/telemetry';
import type { DurationId, GameMode, MissionDesign, ObjectiveId, OrbitId, Player, Quality, RoleId, SceneId, SlotId, VehicleId } from '@/types';

const SETTINGS_KEY = 'bmc.settings.v1';
const LOG_KEY = 'bmc.missionlog.v1';

export interface Settings {
  mode: GameMode;
  quality: Quality;
  sound: boolean;
  reducedMotion: boolean;
}

export interface LogEntry {
  at: string;
  total: number;
  tier: string;
  objective: ObjectiveId;
  payload: string;
  orbit: OrbitId;
  seed: number;
}

export interface TeamStats {
  decisions: number;
  fullyDiscussed: number;
  unanimous: number;
}

interface ReadinessState {
  panelsViewed: EvidencePanel[];
  choice?: PrimaryChoice;
  finalCall?: FinalCall;
}

export interface GameState {
  scene: SceneId;
  /** Furthest scene reached, for the stage indicator. */
  settings: Settings;
  players: Player[];
  teamStats: TeamStats;
  seed: number;
  scenario: ScenarioId;
  design: MissionDesign;
  /** True once the player has confirmed the launch plan. */
  activeSlot: SlotId;
  hoveredSlot: SlotId | null;
  readiness: ReadinessState;
  ops: OpsDecisions;
  /** Which operations event (if any) is currently highlighted in the 3D scene. */
  opsHighlight: 'storm' | 'blackout' | 'safe' | null;
  missionLog: LogEntry[];
  panel: 'sources' | 'settings' | 'team' | null;

  go: (scene: SceneId) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setPlayers: (players: Player[]) => void;
  recordTeamDecision: (fullyDiscussed: boolean, unanimous: boolean) => void;
  setObjective: (objective: ObjectiveId) => void;
  select: (slot: SlotId, id: string) => void;
  applyRecommended: () => void;
  setVehicle: (vehicle: VehicleId) => void;
  setOrbit: (orbit: OrbitId) => void;
  setDuration: (duration: DurationId) => void;
  setActiveSlot: (slot: SlotId) => void;
  setHoveredSlot: (slot: SlotId | null) => void;
  viewPanel: (panel: EvidencePanel) => void;
  setReadinessChoice: (choice: PrimaryChoice, finalCall?: FinalCall) => void;
  setOpsDecision: (patch: OpsDecisions) => void;
  setOpsHighlight: (h: GameState['opsHighlight']) => void;
  addLog: (entry: LogEntry) => void;
  openPanel: (panel: GameState['panel']) => void;
  /** Keep the design, draw a new scenario, go back to the design bay. */
  tryAgain: () => void;
  /** Start over from the briefing. */
  newMission: () => void;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the game works without it */
  }
}

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

function initialSeed(): number {
  const fromUrl = Number(params.get('seed'));
  return params.has('seed') && Number.isFinite(fromUrl) ? Math.abs(Math.floor(fromUrl)) : randomSeed();
}

function scenarioFor(seed: number): ScenarioId {
  const forced = params.get('scenario');
  if (forced === 'hardware' || forced === 'data-chain' || forced === 'noise') return forced;
  return scenarioFromSeed(seed);
}

const prefersReducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaultSettings: Settings = { mode: 'guided', quality: 'balanced', sound: true, reducedMotion: prefersReducedMotion };

const designFor = (objective: ObjectiveId): MissionDesign => ({
  objective,
  selections: { ...RECOMMENDED[objective] },
  ...RECOMMENDED_PLAN[objective],
});

const ROLE_ORDER: RoleId[] = ['director', 'engineer', 'science', 'comms'];
export const defaultPlayers = (count: number): Player[] =>
  ROLE_ORDER.slice(0, Math.max(1, Math.min(4, count))).map((role, i) => ({ name: `Player ${i + 1}`, role }));

const seed0 = initialSeed();

/** Testing aid: ?scene=designer (etc.) opens the game directly on a scene. */
function initialScene(): SceneId {
  const s = params.get('scene');
  return s && (SCENE_NAMES as string[]).includes(s) ? (s as SceneId) : 'intro';
}
const SCENE_NAMES: SceneId[] = ['intro', 'briefing', 'designer', 'launch', 'readiness', 'operations', 'debrief'];

export const useGame = create<GameState>((set, get) => ({
  scene: initialScene(),
  settings: { ...loadJson(SETTINGS_KEY, defaultSettings), ...(params.get('motion') === 'reduced' ? { reducedMotion: true } : {}) },
  players: defaultPlayers(1),
  teamStats: { decisions: 0, fullyDiscussed: 0, unanimous: 0 },
  seed: seed0,
  scenario: scenarioFor(seed0),
  design: designFor('climate'),
  activeSlot: 'payload',
  hoveredSlot: null,
  readiness: { panelsViewed: [] },
  ops: {},
  opsHighlight: null,
  missionLog: loadLog(),
  panel: null,

  go: (scene) => set({ scene }),
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    save(SETTINGS_KEY, settings);
    set({ settings });
  },
  setPlayers: (players) => set({ players }),
  recordTeamDecision: (fullyDiscussed, unanimous) =>
    set((s) => ({
      teamStats: {
        decisions: s.teamStats.decisions + 1,
        fullyDiscussed: s.teamStats.fullyDiscussed + (fullyDiscussed ? 1 : 0),
        unanimous: s.teamStats.unanimous + (unanimous ? 1 : 0),
      },
    })),
  setObjective: (objective) => set({ design: designFor(objective) }),
  select: (slot, id) => set((s) => ({ design: { ...s.design, selections: { ...s.design.selections, [slot]: id } } })),
  applyRecommended: () => set((s) => ({ design: designFor(s.design.objective) })),
  setVehicle: (vehicle) => set((s) => ({ design: { ...s.design, vehicle } })),
  setOrbit: (orbit) => set((s) => ({ design: { ...s.design, orbit } })),
  setDuration: (duration) => set((s) => ({ design: { ...s.design, duration } })),
  setActiveSlot: (activeSlot) => set({ activeSlot }),
  setHoveredSlot: (hoveredSlot) => set({ hoveredSlot }),
  viewPanel: (panel) =>
    set((s) => (s.readiness.panelsViewed.includes(panel) ? s : { readiness: { ...s.readiness, panelsViewed: [...s.readiness.panelsViewed, panel] } })),
  setReadinessChoice: (choice, finalCall) => set((s) => ({ readiness: { ...s.readiness, choice, finalCall } })),
  setOpsDecision: (patch) => set((s) => ({ ops: { ...s.ops, ...patch } })),
  setOpsHighlight: (opsHighlight) => set({ opsHighlight }),
  addLog: (entry) => {
    const missionLog = [entry, ...get().missionLog].slice(0, 8);
    save(LOG_KEY, missionLog);
    set({ missionLog });
  },
  openPanel: (panel) => set({ panel }),
  tryAgain: () => {
    const seed = randomSeed();
    set({ seed, scenario: scenarioFromSeed(seed), readiness: { panelsViewed: [] }, ops: {}, opsHighlight: null, teamStats: { decisions: 0, fullyDiscussed: 0, unanimous: 0 }, scene: 'designer' });
  },
  newMission: () => {
    const seed = randomSeed();
    set({ seed, scenario: scenarioFromSeed(seed), readiness: { panelsViewed: [] }, ops: {}, opsHighlight: null, teamStats: { decisions: 0, fullyDiscussed: 0, unanimous: 0 }, design: designFor('climate'), scene: 'briefing' });
  },
}));

export const SCENE_ORDER: SceneId[] = ['intro', 'briefing', 'designer', 'launch', 'readiness', 'operations', 'debrief'];
export const STAGES: { id: SceneId; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'designer', label: 'Design' },
  { id: 'launch', label: 'Launch plan' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'operations', label: 'Operations' },
  { id: 'debrief', label: 'Debrief' },
];

export const ROLES: Record<RoleId, { label: string; short: string; focus: string }> = {
  director: { label: 'Mission Director', short: 'DIR', focus: 'Confirms the team’s final answer.' },
  engineer: { label: 'Spacecraft Engineer', short: 'ENG', focus: 'Owns mass, power and propulsion.' },
  science: { label: 'Science Lead', short: 'SCI', focus: 'Protects the science objective.' },
  comms: { label: 'Communications & Resources', short: 'COM', focus: 'Owns data, link and budget.' },
};
