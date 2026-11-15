import type { GameState } from '../store/types';

/**
 * Simulated mission clock and suit radiation monitor.
 *
 * Real basis: Curiosity's RAD instrument reported an average dose-equivalent rate of about
 * 0.64 mSv per day on the surface of Mars (Hassler et al., Science, 2014). That value is used
 * for the outdoor rate. Every other number here (indoor shielding, the Day 7 solar particle
 * event, the shelter) is SIMULATED for the game and is not a NASA measurement or threshold.
 */
export const SOL_HOURS = 24.66; // one Mars day ≈ 24 h 39 min
export const DAY_START_HOUR = 7; // the crew wakes at 07:00 base time
/** Simulated minutes that pass for each real second of play. */
export const SIM_MINUTES_PER_SECOND = 2;

export const DOSE_RATES = {
  outdoor: 0.64, // based on Curiosity RAD surface average
  indoor: 0.4, // simulated: base walls give some shielding
  event: 1.5, // simulated: solar particle event, inside the base
  shelter: 0.3, // simulated: inside the water-walled shelter
} as const;

export type RadStatus = 'OUTDOORS' | 'INSIDE BASE' | 'SOLAR EVENT' | 'SHELTERED';

export function doseNow(s: GameState, outside: boolean): { rate: number; status: RadStatus } {
  if (outside) return { rate: DOSE_RATES.outdoor, status: 'OUTDOORS' };
  if (s.day === 7) return s.flags.shelterDone ? { rate: DOSE_RATES.shelter, status: 'SHELTERED' } : { rate: DOSE_RATES.event, status: 'SOLAR EVENT' };
  return { rate: DOSE_RATES.indoor, status: 'INSIDE BASE' };
}

export const dayStartHours = (day: number) => (day - 1) * SOL_HOURS + DAY_START_HOUR;
/** Latest clock time within a sol (the clock waits here until the crew sleeps). */
export const dayEndHours = (day: number) => (day - 1) * SOL_HOURS + 23.5;

export function solClock(hours: number): { sol: number; hh: number; mm: number; text: string } {
  const sol = Math.floor(hours / SOL_HOURS) + 1;
  const h = hours - (sol - 1) * SOL_HOURS;
  const hh = Math.floor(h);
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return { sol, hh, mm, text: `SOL ${sol} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

/** Advance the simulated clock by `dtSeconds` of real play and add the dose received. */
export function tickClock(s: GameState, dtSeconds: number, outside: boolean): void {
  const end = dayEndHours(s.day);
  const start = dayStartHours(s.day);
  if (s.missionHours < start) s.missionHours = start;
  const dh = Math.min((dtSeconds * SIM_MINUTES_PER_SECOND) / 60, Math.max(0, end - s.missionHours));
  if (dh <= 0) return;
  s.missionHours += dh;
  s.radDose += (doseNow(s, outside).rate * dh) / 24;
}

/** Overnight: the rest of the sol passes indoors until the next morning. */
export function sleepUntilMorning(s: GameState): void {
  const target = dayStartHours(s.day + 1);
  const from = Math.max(s.missionHours, dayStartHours(s.day));
  if (target > from) {
    const rate = s.day === 7 ? DOSE_RATES.shelter : DOSE_RATES.indoor;
    s.radDose += (rate * (target - from)) / 24;
  }
  s.missionHours = target;
}
