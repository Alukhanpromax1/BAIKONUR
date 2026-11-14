/** How trustworthy a number is. Every data-driven display in the game carries one of these. */
export type Provenance =
  | 'verified_nasa_data'
  | 'verified_mission_reference'
  | 'educational_game_assumption'
  | 'synthetic_simulated_data';

export type SceneId = 'intro' | 'briefing' | 'designer' | 'launch' | 'readiness' | 'operations' | 'debrief';

export type GameMode = 'guided' | 'advanced';
export type Quality = 'high' | 'balanced' | 'low';

export type SlotId = 'payload' | 'power' | 'comms' | 'storage' | 'propulsion';
export type ObjectiveId = 'dust' | 'climate' | 'clouds';
export type VehicleId = 'tulpar-l' | 'tulpar-m' | 'tulpar-h';
export type OrbitId = 'low-polar' | 'mid-inclined' | 'high-elliptical';
export type DurationId = 'half-year' | 'full-year';

export type Selections = Record<SlotId, string>;

export interface MissionDesign {
  objective: ObjectiveId;
  selections: Selections;
  vehicle: VehicleId;
  orbit: OrbitId;
  duration: DurationId;
}

export type RoleId = 'director' | 'engineer' | 'science' | 'comms';

export interface Player {
  name: string;
  role: RoleId;
}
