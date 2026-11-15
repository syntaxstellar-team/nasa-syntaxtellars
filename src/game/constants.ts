export const TILE = 16;
/** Logical game resolution. Everything is drawn at this size and scaled up with crisp pixels. */
export const VIEW_W = 480;
export const VIEW_H = 270;

export const SAVE_KEY = 'lostsignal_aurelia_save_v2';
export const DAYSTART_KEY = 'lostsignal_aurelia_daystart_v2';
export const SETTINGS_KEY = 'lostsignal_aurelia_settings_v2';

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
