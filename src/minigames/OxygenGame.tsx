import { useRef, useState } from 'react';
import type { PointerEvent as RPE } from 'react';
import { MW, MH, MiniGameProps, useLoop, logical, panelBg, shuffle } from './common';
import { rect, disc, line } from '../game/art/canvas';
import { drawText } from '../game/font';
import { audio } from '../game/audio';
import { Particles } from '../game/particles';

type Piece = 'h' | 'v' | 'elbow' | 'tee';
interface Seg { x1: number; y1: number; x2: number; y2: number }
interface Gap { x: number; y: number; need: 'h' | 'v'; filled: boolean }
interface Leak { x: number; y: number; sealed: boolean; phase: number }
interface Def { segs: Seg[]; gaps: Gap[]; leaks: Leak[]; green: [number, number]; drift: number }

function level(n: number): Def {
  if (n === 1) {
    return {
      segs: [
        { x1: 52, y1: 60, x2: 200, y2: 60 }, { x1: 224, y1: 60, x2: 270, y2: 60 },
        { x1: 140, y1: 60, x2: 140, y2: 110 }, { x1: 140, y1: 110, x2: 270, y2: 110 },
      ],
      gaps: [{ x: 212, y: 60, need: 'h', filled: false }],
      leaks: [{ x: 96, y: 60, sealed: false, phase: 0 }, { x: 190, y: 110, sealed: false, phase: 1.3 }],
      green: [0.55, 0.8], drift: 0,
    };
  }
  return {
    segs: [
      { x1: 52, y1: 50, x2: 180, y2: 50 }, { x1: 204, y1: 50, x2: 270, y2: 50 },
      { x1: 110, y1: 50, x2: 110, y2: 78 }, { x1: 110, y1: 102, x2: 110, y2: 124 }, { x1: 110, y1: 124, x2: 270, y2: 124 },
      { x1: 230, y1: 50, x2: 230, y2: 124 },
    ],
    gaps: [{ x: 192, y: 50, need: 'h', filled: false }, { x: 110, y: 90, need: 'v', filled: false }],
    leaks: [
      { x: 74, y: 50, sealed: false, phase: 0 }, { x: 170, y: 124, sealed: false, phase: 0.8 }, { x: 230, y: 88, sealed: false, phase: 1.7 },
    ],
    green: [0.6, 0.78], drift: 0.12,
  };
}

const TRAY_Y = 156;

export default function OxygenGame({ level: lv, onWin, hint }: MiniGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const def = useRef<Def>(level(Math.min(2, lv)));
  const [phase, setPhase] = useState<'leaks' | 'gaps' | 'pump' | 'won'>('leaks');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const tray = useRef<{ kind: Piece; x: number; y: number; hx: number; hy: number; drag: boolean }[]>(
    shuffle<Piece>(['h', 'v', 'elbow', 'tee']).map((k, i) => ({ kind: k, x: 70 + i * 60, y: TRAY_Y, hx: 70 + i * 60, hy: TRAY_Y, drag: false })),
  );
  const parts = useRef(new Particles());
  const st = useRef({ pressure: 0.35, pumping: false, hold: 0, o2: 0.35, t: 0, wonT: 0, hissT: 0 });
  (window as unknown as Record<string, unknown>).__mg = { kind: 'oxygen', def: def.current, tray: tray.current, st: st.current };

  useLoop((dt, t) => {
    const s = st.current;
    const d = def.current;
    s.t = t;
    const ph = phaseRef.current;
    // leaks puff every now and then: you have to watch to find them
    for (const l of d.leaks) {
      if (l.sealed) continue;
      const on = Math.sin(t * 2.2 + l.phase * 3) > 0.2;
      if (on && Math.random() < 0.5) parts.current.add({ x: l.x, y: l.y, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, max: 0.6, color: '#dff8ff', fade: true, size: 2 });
    }
    s.hissT -= dt;
    if (ph === 'leaks' && s.hissT <= 0) { s.hissT = 1.2; audio.play('whoosh'); }
    const leaking = d.leaks.filter((l) => !l.sealed).length;
    if (ph === 'leaks' || ph === 'gaps') s.pressure = Math.max(0.1, s.pressure - dt * 0.01 * leaking);
    if (ph === 'pump') {
      s.pressure += (s.pumping ? 0.32 : -0.22) * dt + (Math.random() - 0.5) * d.drift * dt * 6;
      s.pressure = Math.max(0, Math.min(1, s.pressure));
      const inGreen = s.pressure >= d.green[0] && s.pressure <= d.green[1];
      s.hold = inGreen ? s.hold + dt : Math.max(0, s.hold - dt * 0.6);
      s.o2 = Math.min(1, 0.35 + (s.hold / 2.5) * 0.65);
      if (s.hold >= 2.5) {
        setPhase('won');
        s.wonT = 0.01;
        audio.play('power');
        hint('Air pressure is stable. Fresh oxygen is flowing!', 'celebrating');
      }
    }
    if (ph === 'won') {
      s.wonT += dt;
      if (Math.random() < 0.6) parts.current.add({ x: 270 + Math.random() * 20, y: 40 + Math.random() * 90, vx: 30, vy: -10, max: 1, color: '#5ff3ff', glow: true, fade: true, size: 2 });
      if (s.wonT > 1.4 && s.wonT < 50) { s.wonT = 99; onWin(); }
    }
    parts.current.update(dt);
    draw();
  });

  function draw(): void {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    panelBg(ctx);
    const d = def.current, s = st.current, ph = phaseRef.current;
    // generator on the left
    rect(ctx, 12, 30, 40, 100, '#4c5068'); rect(ctx, 12, 30, 40, 2, '#8f99b3');
    for (let k = 0; k < 2; k++) { rect(ctx, 18 + k * 16, 44, 10, 70, '#43d9ff'); rect(ctx, 18 + k * 16, 44, 3, 70, '#bff6ff'); }
    drawText(ctx, 'O2', 32, 120, { align: 'center', color: '#ffffff', shadow: null });
    // vents on the right
    for (const y of new Set(d.segs.filter((sg) => sg.x2 >= 268).map((sg) => sg.y2))) {
      rect(ctx, 270, y - 8, 14, 16, '#2e3448');
      for (let k = 0; k < 3; k++) rect(ctx, 272, y - 6 + k * 5, 10, 2, ph === 'won' ? '#5ff3ff' : '#454c63');
    }
    // pipes
    const flow = ph === 'pump' || ph === 'won';
    for (const sg of d.segs) {
      line(ctx, sg.x1, sg.y1, sg.x2, sg.y2, '#262a40', 9);
      line(ctx, sg.x1, sg.y1 - 1, sg.x2, sg.y2 - 1, '#8f99b3', 6);
      line(ctx, sg.x1, sg.y1 - 3, sg.x2, sg.y2 - 3, '#c3c9da', 1);
      if (flow) {
        const len = Math.hypot(sg.x2 - sg.x1, sg.y2 - sg.y1);
        for (let k = (s.t * 40) % 12; k < len; k += 12) {
          const fx = sg.x1 + ((sg.x2 - sg.x1) * k) / len, fy = sg.y1 + ((sg.y2 - sg.y1) * k) / len;
          rect(ctx, fx - 1, fy - 2, 2, 2, '#5ff3ff');
        }
      }
    }
    // gaps
    for (const g of d.gaps) {
      if (g.filled) {
        const h = g.need === 'h';
        rect(ctx, g.x - (h ? 12 : 4), g.y - (h ? 4 : 12), h ? 24 : 8, h ? 8 : 24, '#ffd43b');
        rect(ctx, g.x - (h ? 12 : 3), g.y - (h ? 3 : 12), h ? 24 : 6, h ? 6 : 24, '#c3c9da');
      } else {
        const blink = Math.floor(s.t * 3) % 2;
        ctx.strokeStyle = blink ? '#ff4d6d' : '#ffd43b';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(g.x - 12 + 0.5, g.y - 12 + 0.5, 23, 23);
        ctx.setLineDash([]);
      }
    }
    // leaks (sealed ones get a patch)
    for (const l of d.leaks) {
      if (l.sealed) { rect(ctx, l.x - 5, l.y - 6, 10, 8, '#ff8a3d'); rect(ctx, l.x - 4, l.y - 5, 8, 1, '#ffb27a'); }
      else if (ph !== 'leaks') { /* still leaking — shouldn't happen */ }
    }
    parts.current.draw(ctx, 0, 0);
    // pressure gauge
    const gx = 300, gy = 150;
    disc(ctx, gx, gy, 16, '#1e2236');
    for (let a = 0; a <= 20; a++) {
      const k = a / 20, ang = Math.PI + k * Math.PI;
      const col = k >= d.green[0] && k <= d.green[1] ? '#3dff8a' : k > d.green[1] ? '#ff4d6d' : '#ffd43b';
      rect(ctx, gx + Math.cos(ang) * 13, gy + Math.sin(ang) * 13, 2, 2, col);
    }
    const na = Math.PI + s.pressure * Math.PI;
    line(ctx, gx, gy, gx + Math.cos(na) * 11, gy + Math.sin(na) * 11, '#ffffff', 1);
    drawText(ctx, 'PSI', gx, gy + 4, { align: 'center', color: '#8f99b3', shadow: null });
    // oxygen level bar
    rect(ctx, 296, 20, 10, 100, '#1e2236');
    const oh = Math.round(96 * (ph === 'won' ? 1 : s.o2));
    rect(ctx, 298, 118 - oh, 6, oh, '#43d9ff');
    drawText(ctx, 'O2', 301, 10, { align: 'center', color: '#43d9ff', shadow: null });
    // tray
    if (ph === 'gaps') {
      rect(ctx, 40, TRAY_Y - 16, 240, 32, '#1a1d2e');
      drawText(ctx, 'SPARE PIPES', 160, TRAY_Y - 26, { align: 'center', color: '#8f99b3', shadow: null });
      for (const p of tray.current) drawPiece(ctx, p.kind, p.x, p.y);
    }
    // phase label
    const label = ph === 'leaks' ? `1. FIND THE LEAKS (${d.leaks.filter((l) => l.sealed).length}/${d.leaks.length})` : ph === 'gaps' ? `2. FILL THE GAPS (${d.gaps.filter((g) => g.filled).length}/${d.gaps.length})` : ph === 'pump' ? '3. HOLD PUMP: KEEP NEEDLE IN GREEN' : 'AIR RESTORED!';
    drawText(ctx, label, 150, 6, { align: 'center', color: '#5ff3ff' });
    if (ph === 'pump') {
      rect(ctx, 60, 140, 180, 6, '#1e2236');
      rect(ctx, 61, 141, Math.round(178 * Math.min(1, s.hold / 2.5)), 4, '#3dff8a');
    }
  }

  function drawPiece(ctx: CanvasRenderingContext2D, k: Piece, x: number, y: number): void {
    const P = (x1: number, y1: number, x2: number, y2: number) => { line(ctx, x + x1, y + y1, x + x2, y + y2, '#262a40', 8); line(ctx, x + x1, y + y1, x + x2, y + y2, '#c3c9da', 5); };
    if (k === 'h') P(-12, 0, 12, 0);
    if (k === 'v') P(0, -12, 0, 12);
    if (k === 'elbow') { P(-12, 0, 0, 0); P(0, 0, 0, 12); }
    if (k === 'tee') { P(-12, 0, 12, 0); P(0, 0, 0, 12); }
  }

  const drag = useRef<number>(-1);
  const down = (e: RPE) => {
    const p = logical(e, canvas.current!);
    const d = def.current;
    const ph = phaseRef.current;
    if (ph === 'leaks') {
      const l = d.leaks.find((k) => !k.sealed && Math.hypot(k.x - p.x, k.y - p.y) < 14);
      if (l) {
        l.sealed = true;
        audio.play('place');
        parts.current.burst(l.x, l.y, '#ff8a3d', 8, 40);
        const left = d.leaks.filter((k) => !k.sealed).length;
        if (left === 0) { setPhase('gaps'); hint('Leaks sealed! Now drag the right spare pipe into each blinking gap.', 'happy'); }
        else hint(`Sealed! ${left} more leak${left > 1 ? 's' : ''}. Watch for the puffs of air.`, 'happy');
      } else {
        audio.play('error');
        hint('No leak there. Look for little puffs of air escaping from the pipes.', 'thinking');
      }
    } else if (ph === 'gaps') {
      drag.current = tray.current.findIndex((t) => Math.abs(t.x - p.x) < 16 && Math.abs(t.y - p.y) < 16);
      if (drag.current >= 0) (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };
  const move = (e: RPE) => {
    if (drag.current < 0) return;
    const p = logical(e, canvas.current!);
    const t = tray.current[drag.current];
    t.x = p.x; t.y = p.y;
  };
  const up = () => {
    const i = drag.current;
    drag.current = -1;
    if (i < 0) return;
    const t = tray.current[i];
    const d = def.current;
    const g = d.gaps.find((gg) => !gg.filled && Math.hypot(gg.x - t.x, gg.y - t.y) < 20);
    if (g && g.need === t.kind) {
      g.filled = true;
      audio.play('place');
      parts.current.burst(g.x, g.y, '#ffd43b', 8, 40, { glow: true });
      t.x = t.hx; t.y = t.hy;
      if (d.gaps.every((gg) => gg.filled)) { setPhase('pump'); hint('Pipes connected! Hold PUMP to raise the pressure, and let go before it goes into the red.', 'happy'); }
    } else {
      if (g) { audio.play('error'); hint(g.need === 'h' ? 'That piece doesn\'t line up. This gap runs side to side.' : 'That piece doesn\'t line up. This gap runs up and down.', 'thinking'); }
      t.x = t.hx; t.y = t.hy;
    }
  };
  const pump = (on: boolean) => { st.current.pumping = on; if (on) audio.play('whoosh'); };

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <canvas ref={canvas} width={MW} height={MH} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="mg-canvas cursor-pointer touch-none" aria-label="Oxygen pipe network" />
      {phase === 'pump' && (
        <button className="px-btn select-none text-xs" onPointerDown={() => pump(true)} onPointerUp={() => pump(false)} onPointerLeave={() => pump(false)}
          onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pump(true); } }} onKeyUp={() => pump(false)}>
          HOLD TO PUMP
        </button>
      )}
    </div>
  );
}
