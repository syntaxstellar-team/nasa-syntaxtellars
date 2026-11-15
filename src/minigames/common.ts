import { useEffect, useRef } from 'react';
import type { Mood } from '../store/types';

export const MW = 320;
export const MH = 180;

export interface MiniGameProps {
  level: number;
  onWin: () => void;
  hint: (text: string, mood?: Mood) => void;
}

/** Run a requestAnimationFrame loop while the component is mounted. */
export function useLoop(fn: (dt: number, t: number) => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += dt;
      ref.current(dt, t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Convert a pointer event to the mini-game's logical pixel coordinates. */
export function logical(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
}

export function panelBg(ctx: CanvasRenderingContext2D, w = MW, h = MH): void {
  ctx.fillStyle = '#0d1126';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#141a36';
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
