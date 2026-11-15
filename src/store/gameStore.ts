import { useSyncExternalStore } from 'react';
import type { EngEvent, UsageItem, DayReport, EndingId, GameState, MGId, Mood, ReportLine, Resources } from './types';
import { SAVE_KEY, DAYSTART_KEY, clamp } from '../game/constants';
import { MISSIONS, MISSION_BY_ID, MissionDef } from '../data/missions';
import { dayDef } from '../data/days';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { MINIGAMES } from '../data/minigames';
import { SAMPLES, SampleId, sampleFlag, DRONE_TARGET } from '../data/geology';
import type { ScienceId } from '../data/scienceInfo';
import { dayStartHours, sleepUntilMorning } from '../data/radiation';
import { buildEngReport, buildFinalReport, freshDayLog } from '../data/engineering';
import { audio } from '../game/audio';
import { speak } from '../game/settings';

// ============================================================================
// Persistent game state
// ============================================================================

const emptyMG = () => ({ solved: [] as number[], rewardClaimed: false, practiceDay: 0, attempts: 0 });

export function freshState(): GameState {
  const s: GameState = {
    version: 2,
    day: 1,
    phase: 'briefing',
    energy: 40, oxygen: 60, water: 60, food: 65, crew: 90, ecosystem: 100, research: 0,
    scene: 'base',
    baseX: 0,
    exploreX: 0,
    suitO2: 100,
    flags: {},
    accepted: [],
    completed: [],
    claimed: [],
    minigames: { circuit: emptyMG(), oxygen: emptyMG(), solar: emptyMG(), greenhouse: emptyMG(), antenna: emptyMG() },
    upgrades: {},
    inventory: { beacon: 1 },
    journal: {},
    analyzed: [],
    photos: [],
    transmitted: [],
    scienceSeen: [],
    dust: 0,
    missionHours: dayStartHours(1),
    radDose: 0,
    decisions: {},
    carrying: null,
    report: null,
    ending: null,
    savedAt: Date.now(),
    dayLog: { day: 1, start: { energy: 0, oxygen: 0, water: 0, food: 0, crew: 0, ecosystem: 0, research: 0 }, events: [], usage: [] },
    engReports: [],
    finalReport: null,
  };
  s.dayLog = freshDayLog(s);
  return s;
}

let state: GameState = freshState();
let version = 0;
const listeners = new Set<() => void>();
let saveTimer: number | null = null;

function emit(): void {
  version++;
  state = { ...state };
  listeners.forEach((l) => l());
}

export function getState(): GameState {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Change state. Every change re-checks missions and schedules an autosave. */
export function update(fn: (s: GameState) => void, opts: { silent?: boolean } = {}): void {
  fn(state);
  if (opts.silent) return;
  reconcileMissions(state);
  checkMissions();
  emit();
  scheduleSave();
}

// ---------------- saving ----------------
export function scheduleSave(): void {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 400);
}

export function saveNow(): boolean {
  if (state.phase === 'ending' && state.ending) return false;
  state.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    ui.lastSaved = Date.now();
    emitUi();
    return true;
  } catch {
    return false;
  }
}

function validSave(d: unknown): d is GameState {
  const g = d as GameState;
  return !!g && g.version === 2 && typeof g.day === 'number' && g.day >= 1 && g.day <= 10 && !!g.minigames && !!g.flags;
}

export function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return validSave(d) ? d : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  const s = readSave();
  return !!s && !(s.phase === 'ending' && s.ending);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(DAYSTART_KEY);
  } catch { /* ignore */ }
}

function merge(d: GameState): GameState {
  const base = freshState();
  const merged: GameState = {
    ...base, ...d,
    minigames: { ...base.minigames, ...d.minigames },
    journal: { ...d.journal },
    analyzed: [...(d.analyzed ?? [])],
    photos: [...(d.photos ?? [])],
    transmitted: [...(d.transmitted ?? [])],
    scienceSeen: [...(d.scienceSeen ?? [])],
    dust: d.dust ?? 0,
    missionHours: d.missionHours ?? dayStartHours(d.day),
    radDose: d.radDose ?? 0,
    engReports: [...(d.engReports ?? [])],
    finalReport: d.finalReport ?? null,
    inventory: { ...d.inventory },
    flags: { ...d.flags },
    upgrades: { ...d.upgrades },
    decisions: { ...d.decisions },
    accepted: [...(d.accepted ?? [])],
    completed: [...(d.completed ?? [])], // saves from before this field existed get it rebuilt below
    claimed: [...(d.claimed ?? [])],
  };
  // older saves: the soil analyzed with the old microscope counts as an analyzed sample
  if (merged.flags.sampleAnalyzed && !merged.analyzed.includes('soil')) merged.analyzed.push('soil');
  // saves from before the Engineering Journal start logging from the moment they are loaded
  if (!d.dayLog || d.dayLog.day !== merged.day) merged.dayLog = freshDayLog(merged);
  else merged.dayLog = { ...d.dayLog, events: [...d.dayLog.events], usage: [...d.dayLog.usage] };
  reconcileMissions(merged);
  return merged;
}

export function newGame(): void {
  clearSave();
  state = freshState();
  resetUi();
  emit();
  saveNow();
}

export function continueGame(): boolean {
  const d = readSave();
  if (!d) return false;
  state = merge(d);
  resetUi();
  requeueUnclaimedRewards();
  if (state.phase === 'play') autoAcceptMissions();
  if (state.phase === 'play') ui.notice = { title: `Day ${state.day} — ${dayDef(state.day).title}`, sub: 'Welcome back, explorer!' };
  emit();
  return true;
}

function snapshotDayStart(): void {
  try { localStorage.setItem(DAYSTART_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function retryDay(): boolean {
  try {
    const raw = localStorage.getItem(DAYSTART_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!validSave(d)) return false;
    state = merge(d);
    state.phase = 'briefing';
    state.ending = null;
    resetUi();
    emit();
    saveNow();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Transient UI state (dialogue, popups, effects) — not saved
// ============================================================================

export interface Choice {
  label: string;
  note?: string;
  disabled?: boolean;
  action: () => void;
}

export interface Line {
  speaker: string;
  text: string;
  mood: Mood;
  choices?: Choice[];
  then?: () => void;
}

export type Modal =
  | { kind: 'board' }
  | { kind: 'journal' }
  | { kind: 'inventory' }
  | { kind: 'upgrades'; focus?: string }
  | { kind: 'checklist' }
  | { kind: 'stormplan' }
  | { kind: 'launcher'; id: MGId }
  | { kind: 'minigame'; id: MGId; level: number }
  | { kind: 'pause' }
  | { kind: 'settings' }
  | { kind: 'science' }
  | { kind: 'info'; id: ScienceId; next?: (() => void) | null; back?: Modal | null }
  | { kind: 'weather' }
  | { kind: 'water' }
  | { kind: 'analyzer' }
  | { kind: 'dosimeter' }
  | { kind: 'datalink' }
  | { kind: 'about' }
  | { kind: 'powergrid' }
  | { kind: 'resources' };

export interface RewardPopup {
  key: string;
  title: string;
  text: string;
  energy: number;
  research: number;
  missionId?: string;
}

export interface UiState {
  modal: Modal | null;
  dialogue: Line[];
  rewards: RewardPopup[];
  energyFx: { id: number; amount: number }[];
  toasts: { id: number; text: string }[];
  notice: { title: string; sub?: string } | null;
  lastSaved: number;
  cinematic: string | null;
  live: { area: string; suitO2: number; outside: boolean; dose: number; hours: number } | null;
}

export const ui: UiState = { modal: null, dialogue: [], rewards: [], energyFx: [], toasts: [], notice: null, lastSaved: 0, cinematic: null, live: null };
let uiSnap: UiState = { ...ui };
const uiListeners = new Set<() => void>();

export function emitUi(): void {
  uiSnap = { ...ui };
  uiListeners.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore((l) => { uiListeners.add(l); return () => uiListeners.delete(l); }, () => uiSnap);
}

function resetUi(): void {
  ui.modal = null;
  ui.dialogue = [];
  ui.rewards = [];
  ui.energyFx = [];
  ui.toasts = [];
  ui.notice = null;
  ui.cinematic = null;
  emitUi();
}

/** True when an overlay is open and the world should not take player input. */
export function inputBlocked(): boolean {
  return !!ui.modal || ui.dialogue.length > 0 || ui.rewards.length > 0 || !!ui.cinematic || state.phase !== 'play';
}

export function openModal(m: Modal | null): void {
  ui.modal = m;
  if (m) audio.play('click');
  emitUi();
}

export function say(text: string, mood: Mood = 'happy', speaker = 'NOVA', then?: () => void): void {
  const wasEmpty = ui.dialogue.length === 0;
  ui.dialogue.push({ speaker, text, mood, then });
  if (wasEmpty) { audio.play('robot'); speak(text); }
  emitUi();
}

export function ask(text: string, mood: Mood, choices: Choice[]): void {
  const wasEmpty = ui.dialogue.length === 0;
  ui.dialogue.push({ speaker: 'NOVA', text, mood, choices });
  if (wasEmpty) { audio.play('robot'); speak(text); }
  emitUi();
}

export function advanceDialogue(): void {
  const cur = ui.dialogue[0];
  if (!cur || cur.choices) return;
  ui.dialogue.shift();
  cur.then?.();
  const next = ui.dialogue[0];
  if (next) { audio.play('robot'); speak(next.text); }
  emitUi();
}

export function choose(c: Choice): void {
  if (c.disabled) { audio.play('error'); return; }
  ui.dialogue.shift();
  audio.play('click');
  c.action();
  const next = ui.dialogue[0];
  if (next) speak(next.text);
  emitUi();
}

let fxId = 1;
export function toast(text: string): void {
  const id = fxId++;
  ui.toasts.push({ id, text });
  emitUi();
  window.setTimeout(() => { ui.toasts = ui.toasts.filter((t) => t.id !== id); emitUi(); }, 2600);
}

function energyFx(amount: number): void {
  const id = fxId++;
  ui.energyFx.push({ id, amount });
  emitUi();
  window.setTimeout(() => { ui.energyFx = ui.energyFx.filter((t) => t.id !== id); emitUi(); }, 1400);
}

export function setCinematic(name: string | null): void {
  ui.cinematic = name;
  emitUi();
}

// ============================================================================
// Actions
// ============================================================================

export function setFlag(key: string, value: number | boolean = true): void {
  update((s) => { s.flags[key] = value; });
}

// ---------------- engineering journal log ----------------
/** Record something the player did today (call inside or outside update()). */
export function logEvent(kind: EngEvent['kind'], text: string, s: GameState = state): void {
  s.dayLog.events.push({ kind, text });
}

/** Record a daytime resource change with its cause. */
export function trackUsage(res: UsageItem['res'], delta: number, label: string, s: GameState = state): void {
  if (delta) s.dayLog.usage.push({ res, delta, label });
}

export function addItem(id: string, n = 1): void {
  update((s) => { s.inventory[id] = (s.inventory[id] ?? 0) + n; });
}

export function gainEnergy(amount: number, label = 'Rewards'): void {
  if (amount <= 0) return;
  update((s) => { s.energy += amount; trackUsage('energy', amount, label, s); });
  energyFx(amount);
  audio.play('complete');
}

export function canAfford(cost: number): boolean {
  return state.energy >= cost;
}

/** Spend energy on an upgrade. Returns false (and explains) when it can't be bought. */
export function buyUpgrade(id: string): boolean {
  const u = UPGRADE_BY_ID[id];
  if (!u || state.upgrades[id]) return false;
  const reason = u.locked(state);
  if (reason) { audio.play('error'); toast(reason); return false; }
  if (state.energy < u.cost) {
    audio.play('error');
    toast(`Need ${u.cost - state.energy} more energy. Try a mini-game or a NOVA task!`);
    return false;
  }
  update((s) => {
    s.energy -= u.cost;
    s.upgrades[id] = true;
    trackUsage('energy', -u.cost, u.title, s);
    logEvent('upgrade', `Powered: ${u.title} (−${u.cost} energy)`, s);
    if (id === 'battery-charge') s.inventory.battery = 1;
  });
  energyFx(-u.cost);
  audio.play('power');
  return true;
}

// ---------------- missions ----------------
export type MissionStatus = 'upcoming' | 'available' | 'active' | 'complete' | 'claimed';

/** True once a mission's requirements have been met, on any day (recorded in s.completed). */
export function missionDone(m: MissionDef, s: GameState = state): boolean {
  return s.completed.includes(m.id) || m.progress(s) >= m.target;
}

function hasReward(m: MissionDef): boolean {
  if (m.minigame) return !!(MINIGAMES[m.minigame].reward.energy || MINIGAMES[m.minigame].reward.research);
  return !!(m.reward.energy || m.reward.research);
}

/**
 * Bring mission bookkeeping in line with what the player has actually done.
 * Runs after every change and when a save is loaded, so the order in which
 * activities are completed never matters:
 *  - completion is recorded independently of the story day;
 *  - a mission that is already done counts as accepted once its day arrives;
 *  - a mini-game mission whose one-time reward was paid is marked claimed;
 *  - missions without any reward are claimed as soon as they are done.
 */
export function reconcileMissions(s: GameState): void {
  for (const m of MISSIONS) {
    const done = s.completed.includes(m.id) || m.progress(s) >= m.target;
    if (!done) continue;
    if (!s.completed.includes(m.id)) s.completed.push(m.id);
    if (m.day <= s.day && !s.accepted.includes(m.id)) s.accepted.push(m.id);
    if (s.claimed.includes(m.id)) continue;
    if (m.minigame && s.minigames[m.minigame].rewardClaimed) s.claimed.push(m.id);
    else if (!hasReward(m) && m.day <= s.day) s.claimed.push(m.id);
  }
}

export function missionStatus(m: MissionDef, s: GameState = state): MissionStatus {
  if (s.claimed.includes(m.id)) return 'claimed';
  if (missionDone(m, s)) return m.day > s.day ? 'upcoming' : 'complete';
  if (m.day > s.day) return 'upcoming';
  return s.accepted.includes(m.id) ? 'active' : 'available';
}

export function acceptMission(id: string): void {
  if (state.accepted.includes(id)) return;
  update((s) => { s.accepted.push(id); });
  audio.play('pickup');
  const m = MISSION_BY_ID[id];
  if (m) toast(`Mission accepted: ${m.title}`);
}

/** Pay a completed mission's reward. Safe to call any number of times: it pays once. */
export function claimMission(id: string): void {
  const m = MISSION_BY_ID[id];
  if (!m || state.claimed.includes(id) || missionStatus(m) !== 'complete') return;
  let energy = m.reward.energy ?? 0;
  let research = m.reward.research ?? 0;
  if (m.minigame) {
    // a won mini-game whose reward was never collected: pay the mini-game's one-time reward here
    const g = state.minigames[m.minigame];
    if (g.rewardClaimed) { update((s) => { if (!s.claimed.includes(id)) s.claimed.push(id); }); return; }
    energy = MINIGAMES[m.minigame].reward.energy;
    research = MINIGAMES[m.minigame].reward.research ?? 0;
  }
  update((s) => {
    s.claimed.push(id);
    s.research += research;
    if (m.minigame) s.minigames[m.minigame].rewardClaimed = true;
  });
  if (energy) gainEnergy(energy, 'Mission rewards');
  else audio.play('complete');
  ui.rewards = ui.rewards.filter((r) => r.missionId !== id);
  emitUi();
}

function rewardPopup(m: MissionDef): RewardPopup {
  return { key: m.id, missionId: m.id, title: 'Mission complete!', text: m.title, energy: m.reward.energy ?? 0, research: m.reward.research ?? 0 };
}

/** Called after every state change: queues a reward popup for missions that became complete and active. */
function checkMissions(): void {
  for (const m of MISSIONS) {
    if (m.minigame || m.day > state.day || state.claimed.includes(m.id)) continue;
    if (state.flags[`seen:${m.id}`]) continue;
    if (missionDone(m)) {
      state.flags[`seen:${m.id}`] = true;
      if (!ui.rewards.some((r) => r.missionId === m.id)) ui.rewards.push(rewardPopup(m));
      audio.play('complete');
      window.setTimeout(emitUi, 0);
    }
  }
}

/** After loading a save, show again any reward the player completed but never collected. */
function requeueUnclaimedRewards(): void {
  for (const m of MISSIONS) {
    if (m.minigame || !hasReward(m) || missionStatus(m) !== 'complete') continue;
    if (!ui.rewards.some((r) => r.missionId === m.id)) ui.rewards.push(rewardPopup(m));
  }
}

export function dayComplete(s: GameState = state): boolean {
  return dayDef(s.day).objectives.every((o) => o.done(s));
}

// ---------------- mini-games ----------------
export function startMinigame(id: MGId, level: number): void {
  update((s) => { s.minigames[id].attempts++; });
  ui.modal = { kind: 'minigame', id, level };
  emitUi();
}

export interface MGResult {
  firstWin: boolean;
  newLevel: boolean;
  energy: number;
  research: number;
  practice: boolean;
}

/** Record a win. The reward is only paid when the player presses Collect Reward. */
export function previewMinigameReward(id: MGId, level: number): MGResult {
  const g = state.minigames[id];
  const meta = MINIGAMES[id];
  const firstWin = !g.rewardClaimed;
  const newLevel = !g.solved.includes(level);
  if (firstWin) return { firstWin, newLevel, energy: meta.reward.energy, research: meta.reward.research ?? 0, practice: false };
  if (g.practiceDay !== state.day) return { firstWin, newLevel, energy: meta.practice, research: 0, practice: true };
  return { firstWin, newLevel, energy: 0, research: 0, practice: false };
}

export function winMinigame(id: MGId, level: number): void {
  update((s) => {
    const g = s.minigames[id];
    if (!g.solved.includes(level)) {
      logEvent('repair', g.solved.length ? `${MINIGAMES[id].title}: finished level ${level}` : `Repaired: ${MINIGAMES[id].title} (level ${level})`, s);
      g.solved.push(level);
    }
    if (id === 'solar') s.dust = 0; // wiping the panels clean is part of the game
  });
}

export function collectMinigameReward(id: MGId, level: number): MGResult {
  const r = previewMinigameReward(id, level);
  update((s) => {
    const g = s.minigames[id];
    if (r.firstWin) {
      g.rewardClaimed = true;
      const linked = MISSIONS.find((m) => m.minigame === id);
      if (linked && !s.claimed.includes(linked.id)) s.claimed.push(linked.id);
    } else if (r.practice) g.practiceDay = s.day;
    s.research += r.research;
  });
  if (r.energy) gainEnergy(r.energy, 'Mini-game rewards');
  return r;
}

// ---------------- science cards ----------------
/**
 * Open a device with NOVA's science card the first time: the card shows, CONTINUE runs `fn`.
 * Afterwards `fn` runs straight away (the card stays available from the SCIENCE INFO button).
 */
export function withScience(id: ScienceId, fn: () => void): void {
  if (state.scienceSeen.includes(id)) { fn(); return; }
  openModal({ kind: 'info', id, next: fn });
}

export function markScienceSeen(id: ScienceId): void {
  if (state.scienceSeen.includes(id)) return;
  update((s) => { s.scienceSeen.push(id); });
}

// ---------------- geology, drone & data link ----------------
export function collectSample(id: SampleId): void {
  if (state.flags[sampleFlag(id)]) return;
  update((s) => {
    s.flags[sampleFlag(id)] = true;
    s.inventory[id] = (s.inventory[id] ?? 0) + 1;
    logEvent('science', `Collected sample: ${SAMPLES[id].name}`, s);
  });
  audio.play('pickup');
  toast(`Got: ${SAMPLES[id].name}`);
}

/** Analyze a carried sample. The rock is then stored in the Lab's sample cache (it stays on Mars). */
export function analyzeSample(id: SampleId): void {
  if (state.analyzed.includes(id) || !(state.inventory[id] ?? 0)) return;
  update((s) => {
    s.inventory[id] = 0;
    s.analyzed.push(id);
    logEvent('science', `Analyzed ${SAMPLES[id].name} in the Rock Analyzer`, s);
    if (id === 'soil') s.flags.sampleAnalyzed = true;
  });
  audio.play('complete');
  ui.notice = { title: `Analyzed: ${SAMPLES[id].name}`, sub: 'Saved in your Research Journal' };
  emitUi();
}

export function recordPhoto(id: string): void {
  if (state.photos.includes(id)) return;
  update((s) => { s.photos.push(id); logEvent('science', `Drone survey: photographed ${DRONE_TARGET.name.toLowerCase()}`, s); });
  audio.play('complete');
  ui.notice = { title: `Drone image saved: ${DRONE_TARGET.name}`, sub: 'Added to your Research Journal' };
  emitUi();
}

/** Record a research report as sent to Earth. Returns false for a duplicate. */
export function recordTransmission(id: string, delaySeconds: number): boolean {
  if (state.transmitted.some((t) => t.id === id)) return false;
  update((s) => { s.transmitted.push({ id, sol: s.day, at: s.missionHours, delay: delaySeconds }); logEvent('science', `Sent a research report to Earth (${id.replace(/^\w+:/, '')})`, s); });
  return true;
}

const DECISION_TEXT: Record<string, string> = {
  'water:recycler': 'Water plan: build the recycler',
  'water:drill': 'Water plan: drill the frost patch (+35 water)',
  'canyon:loose': 'Canyon sample: picked up loose spherules',
  'canyon:chisel': 'Canyon sample: cut a block from the canyon wall',
};

export function decide(key: string, value: string, fn?: (s: GameState) => void): void {
  update((s) => {
    s.decisions[key] = value;
    const text = DECISION_TEXT[`${key}:${value}`];
    if (text) logEvent('decision', text, s);
    fn?.(s);
  });
}

// ---------------- day flow ----------------
export function beginDay(): void {
  update((s) => {
    s.phase = 'play';
    s.suitO2 = 100;
    if (s.day === 5) s.flags.airlockSealed = false;
    s.dayLog = freshDayLog(s);
  });
  const added = autoAcceptMissions();
  if (added) toast(`NOVA added ${added} new mission${added > 1 ? 's' : ''} to your Mission Board`);
  snapshotDayStart();
  audio.play('click');
}

/**
 * From Day 2 on, NOVA puts every mission that is open today straight onto the player's list,
 * so no task is ever blocked because ACCEPT MISSION was missed. (Day 1 keeps the Mission Board
 * lesson: accepting the first mission is one of its objectives.)
 */
function autoAcceptMissions(): number {
  if (state.day < 2) return 0;
  const open = MISSIONS.filter((m) => m.day <= state.day && !state.accepted.includes(m.id) && !state.claimed.includes(m.id));
  if (!open.length) return 0;
  update((s) => { for (const m of open) if (!s.accepted.includes(m.id)) s.accepted.push(m.id); }, { silent: true });
  return open.length;
}

function resources(s: GameState): Resources {
  return { energy: s.energy, oxygen: s.oxygen, water: s.water, food: s.food, crew: s.crew, ecosystem: s.ecosystem, research: s.research };
}

/** End the day: apply the base's daily needs and production, then show the Mission Report. */
export function nextDay(): void {
  if (!dayComplete()) return;
  const s = state;
  const before = resources(s);
  const lines: ReportLine[] = [];
  const warnings: string[] = [];
  const add = (label: string, icon: ReportLine['icon'], delta: number) => { if (delta) lines.push({ label, icon, delta }); };
  const storm = dayDef(s.day).storm;

  // energy
  const solarOk = s.minigames.solar.solved.length > 0;
  if (solarOk && !storm) add('Solar panels made electricity', 'energy', 15);
  if (solarOk && !storm && s.upgrades['solar-tracker']) add('Solar tracker bonus', 'energy', 10);
  let lifeSupportOn = true;
  if (!storm) {
    const gh = s.upgrades['greenhouse-lights'] ? 5 : 0;
    const need = 8 + gh;
    const income = lines.filter((l) => l.icon === 'energy').reduce((a, l) => a + l.delta, 0);
    if (s.energy + income >= need) {
      add('Life support used power', 'energy', -8);
      if (gh) add('Greenhouse lamps used power', 'energy', -gh);
    } else {
      lifeSupportOn = s.energy + income >= 8;
      if (lifeSupportOn) add('Life support used power', 'energy', -8);
      else {
        add('Life support used the last power', 'energy', -(s.energy + income));
        warnings.push('We ran out of energy and life support switched off for a while!');
      }
    }
  } else {
    lifeSupportOn = !!s.flags.stormLife;
  }
  // oxygen
  const o2Fixed = s.minigames.oxygen.solved.length > 0;
  if (o2Fixed && lifeSupportOn) add('Oxygen generator made fresh air', 'oxygen', 12);
  else add(o2Fixed ? 'Oxygen generator had no power' : 'Air leaked from the broken pipe', 'oxygen', -10);
  // water
  add('Crew drank and washed', 'water', -6);
  if (s.upgrades['water-recycler']) add('Water recycler cleaned water', 'water', 8);
  // food
  add('Crew ate meals', 'food', -8);
  const grown = s.minigames.greenhouse.solved.length > 0 && s.upgrades['greenhouse-lights'];
  if (grown) add('Greenhouse harvest', 'food', 12);
  else if (s.upgrades['greenhouse-lights']) add('A few sprouts under the grow lamps', 'food', 4);
  if (storm && !s.flags.stormHeaters) add('Cold storm night hurt the plants', 'food', -8);
  if (storm && s.flags.stormFreezer) add('Frozen samples kept safe for research', 'research', 1);
  // dust slowly settles on the panels (simulated); heavy dust blocks some sunlight
  if (solarOk && !storm && s.dust >= 50) add('Dust on the panels blocked some sunlight', 'energy', -5);

  // apply
  const after = { ...before };
  for (const l of lines) (after as unknown as Record<string, number>)[l.icon === 'crew' ? 'crew' : l.icon === 'eco' ? 'ecosystem' : l.icon] += l.delta;
  after.energy = Math.max(0, after.energy);
  after.oxygen = clamp(after.oxygen, 0, 100);
  after.water = clamp(after.water, 0, 100);
  after.food = clamp(after.food, 0, 100);
  // crew health follows the supplies
  let crewDelta = 0;
  if (after.oxygen < 20) { crewDelta -= 12; warnings.push('Oxygen is very low!'); }
  if (after.water < 20) { crewDelta -= 8; warnings.push('Water is very low!'); }
  if (after.food < 20) { crewDelta -= 8; warnings.push('Food is very low!'); }
  if (after.oxygen >= 40 && after.water >= 40 && after.food >= 40) crewDelta += 5;
  add(crewDelta >= 0 ? 'Crew rested well' : 'Crew felt unwell', 'crew', crewDelta);
  after.crew = clamp(after.crew + crewDelta, 0, 100);
  if (after.energy < 15) warnings.push('Energy is low. Mini-games and NOVA tasks can earn more.');

  const def = dayDef(s.day);
  const completed = MISSIONS.filter((m) => m.day <= s.day && (missionStatus(m) === 'complete' || missionStatus(m) === 'claimed') && !s.flags[`reported:${m.id}`]).map((m) => m.title);
  const discoveries = [
    ...s.analyzed.filter((k) => !s.flags[`reported:${k}`]).map((k) => `Analyzed ${SAMPLES[k as SampleId]?.name ?? k}`),
    ...s.photos.filter((k) => !s.flags[`reported:${k}`]).map(() => `Drone image: ${DRONE_TARGET.name}`),
  ];
  const report: DayReport = { day: s.day, title: def.title, completed, discoveries, lines, warnings, before, after };
  for (const t of completed) logEvent('decision', `Mission complete: ${t}`, s);
  const eng = buildEngReport(s, report);

  update((st) => {
    MISSIONS.forEach((m) => { if (completed.includes(m.title)) st.flags[`reported:${m.id}`] = true; });
    [...st.analyzed, ...st.photos].forEach((k) => { st.flags[`reported:${k}`] = true; });
    if (solarOk) st.dust = Math.min(100, st.dust + (storm ? 35 : 15));
    sleepUntilMorning(st);
    Object.assign(st, { energy: after.energy, oxygen: after.oxygen, water: after.water, food: after.food, crew: after.crew, research: after.research });
    st.report = report;
    st.engReports = [...st.engReports.filter((r) => r.day !== eng.day), eng];
    st.phase = 'report';
    st.carrying = null;
    if (st.crew <= 0) {
      st.phase = 'ending';
      st.ending = 'failed';
      st.finalReport = buildFinalReport(st);
    }
  });
  audio.play('complete');
}

/** Leave the report and open the next day's briefing. */
export function continueToNextDay(): void {
  update((s) => {
    s.day = Math.min(10, s.day + 1);
    s.phase = 'briefing';
    s.scene = 'base';
    s.baseX = 0;
    s.suitO2 = 100;
  });
}

export function computeEnding(s: GameState = state): EndingId {
  if (s.crew <= 0) return 'failed';
  if (s.ecosystem < 50) return 'ecological';
  const geology = s.analyzed.length >= 3;
  if (geology && s.research >= 7 && s.crew >= 50) return 'success';
  return 'survival';
}

export function finishGame(): void {
  update((s) => {
    s.flags.finalSignal = true;
    logEvent('decision', 'Sent the home signal to Mission Control', s);
    s.ending = computeEnding(s);
    const eng = buildEngReport(s, null);
    s.engReports = [...s.engReports.filter((r) => r.day !== eng.day), eng];
    s.finalReport = buildFinalReport(s);
    s.phase = 'ending';
  });
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// debugging handle for the browser console
(window as unknown as { __aurelia?: unknown }).__aurelia = {
  get state() { return state; }, ui, update, say, gainEnergy, nextDay, continueToNextDay, beginDay, winMinigame, setFlag, collectSample, analyzeSample, recordPhoto,
};
void version;
