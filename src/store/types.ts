export type MGId = 'circuit' | 'oxygen' | 'solar' | 'greenhouse' | 'antenna';
export type EndingId = 'success' | 'survival' | 'ecological' | 'failed';
export type Mood = 'happy' | 'curious' | 'worried' | 'surprised' | 'thinking' | 'celebrating';
export type RoomId = 'airlock' | 'workshop' | 'command' | 'power' | 'life' | 'greenhouse' | 'lab' | 'shelter' | 'comm';

export interface MGState {
  /** Levels completed at least once. */
  solved: number[];
  /** The one-time main reward has been collected. */
  rewardClaimed: boolean;
  /** Day on which the small practice bonus was last collected. */
  practiceDay: number;
  attempts: number;
}

export interface ReportLine {
  label: string;
  icon: 'energy' | 'oxygen' | 'water' | 'food' | 'crew' | 'research' | 'eco';
  delta: number;
}

export interface DayReport {
  day: number;
  title: string;
  completed: string[];
  discoveries: string[];
  lines: ReportLine[];
  warnings: string[];
  before: Resources;
  after: Resources;
}

export interface Resources {
  energy: number;
  oxygen: number;
  water: number;
  food: number;
  crew: number;
  ecosystem: number;
  research: number;
}

/** One thing the player did during the day (recorded as it happens). */
export interface EngEvent {
  kind: 'repair' | 'upgrade' | 'decision' | 'science' | 'eva' | 'risk';
  text: string;
}

/** A resource change with its cause, e.g. { res: 'energy', delta: -15, label: 'Greenhouse Lights' }. */
export interface UsageItem { res: 'energy' | 'oxygen' | 'water'; delta: number; label: string }

/** What happened today so far. Reset when a day begins. */
export interface DayLog {
  day: number;
  start: Resources;
  events: EngEvent[];
  usage: UsageItem[];
}

export interface EngReport {
  day: number;
  title: string;
  decisions: string[];
  usage: Record<'energy' | 'oxygen' | 'water', { used: number; made: number; items: { label: string; delta: number }[] }>;
  risks: string[];
  analysis: string[];
  lesson: string;
  before: Resources;
  after: Resources;
}

export interface FinalReport {
  ending: EndingId;
  days: number;
  totals: Record<'energy' | 'oxygen' | 'water', { used: number; made: number }>;
  repairs: string[];
  science: string[];
  decisions: string[];
  riskDays: number;
  topRisk: string | null;
  crew: number;
  research: number;
  site: number;
  summary: string[];
  lessons: string[];
}

export interface GameState extends Resources {
  version: 2;
  day: number;
  phase: 'briefing' | 'play' | 'report' | 'ending';
  scene: 'base' | 'explore';
  baseX: number;
  exploreX: number;
  suitO2: number;
  flags: Record<string, number | boolean>;
  accepted: string[];
  /** Missions whose requirements have been met, whatever day that happened on. Never shrinks. */
  completed: string[];
  claimed: string[];
  minigames: Record<MGId, MGState>;
  upgrades: Record<string, boolean>;
  inventory: Record<string, number>;
  /** Legacy field from older saves (no longer used). */
  journal: Record<string, boolean>;
  /** Samples analyzed in the Rock Analyzer (ids from data/geology). */
  analyzed: string[];
  /** Drone survey images captured. */
  photos: string[];
  /** Research reports sent to Earth (no duplicates). */
  transmitted: { id: string; sol: number; at: number; delay: number }[];
  /** NOVA science cards already shown once. */
  scienceSeen: string[];
  /** Dust covering the solar panels, 0..100 % (simulated). */
  dust: number;
  /** Simulated mission clock in hours since landing (1 sol ≈ 24.66 h). */
  missionHours: number;
  /** Simulated accumulated suit dose in mSv. */
  radDose: number;
  /** NOVA Engineering Journal: today's log, and one saved report per finished day. */
  dayLog: DayLog;
  engReports: EngReport[];
  finalReport: FinalReport | null;
  decisions: Record<string, string>;
  carrying: string | null;
  report: DayReport | null;
  ending: EndingId | null;
  savedAt: number;
}
