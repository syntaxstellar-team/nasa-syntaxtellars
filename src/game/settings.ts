import { SETTINGS_KEY } from './constants';
import { audio } from './audio';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  muted: boolean;
  readAloud: boolean;
  touch: 'auto' | 'on' | 'off';
}

const DEFAULTS: Settings = { music: 0.55, sfx: 0.8, muted: false, readAloud: false, touch: 'auto' };

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function loadSettings(): Settings {
  if (current) return current;
  let s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) s = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  current = s;
  return s;
}

export function saveSettings(s: Settings): void {
  current = s;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  applySettings();
  listeners.forEach((l) => l());
}

export function applySettings(): void {
  const s = loadSettings();
  audio.setVolumes(s.muted ? 0 : s.music, s.muted ? 0 : s.sfx);
}

export function onSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function touchEnabled(): boolean {
  const s = loadSettings();
  if (s.touch === 'on') return true;
  if (s.touch === 'off') return false;
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

/** Optional read-aloud for young players. Silently does nothing where speech synthesis is unavailable. */
export function speak(text: string): void {
  const s = loadSettings();
  if (!s.readAloud || s.muted) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[⚡★]/g, ''));
    u.rate = 0.95;
    u.pitch = 1.15;
    synth.speak(u);
  } catch { /* unsupported */ }
}

export function stopSpeaking(): void {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
