import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPE } from 'react';
import { MW, MH, MiniGameProps, useLoop, logical, panelBg } from './common';
import { rect, disc, line } from '../game/art/canvas';
import { drawText } from '../game/font';
import { audio } from '../game/audio';

// Connection bits
const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;

interface Cell { mask: number; rock: boolean; fixed: boolean }
interface LevelDef { cols: number; rows: number; source: number; targets: number[]; paths: [number, number][][]; rocks: [number, number][] }

const LEVELS: LevelDef[] = [
  { cols: 5, rows: 4, source: 1, targets: [2], paths: [[[0, 1], [1, 1], [2, 1], [2, 2], [3, 2], [4, 2]]], rocks: [] },
  {
    cols: 6, rows: 5, source: 0, targets: [4],
    paths: [[[0, 0], [1, 0], [1, 1], [1, 2], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [5, 4]]],
    rocks: [[2, 0], [2, 1], [4, 2], [0, 3], [5, 1]],
  },
  {
    cols: 7, rows: 5, source: 2, targets: [0, 4],
    paths: [
      [[0, 2], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0], [4, 0], [5, 0], [6, 0]],
      [[3, 2], [3, 3], [3, 4], [4, 4], [5, 4], [6, 4]],
    ],
    rocks: [[1, 0], [5, 2], [1, 4], [6, 2]],
  },
  // Day 2 "Power Distribution Emergency": one battery feeding two branches (Life Support + Command).
  // Played through its own panel; it does not count as repairing the main circuit (that is Day 3).
  {
    cols: 5, rows: 4, source: 1, targets: [0, 3],
    paths: [
      [[0, 1], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0]],
      [[2, 1], [2, 2], [2, 3], [3, 3], [4, 3]],
    ],
    rocks: [[4, 1]],
  },
];

/** Level number used by the Day 2 power distribution challenge. */
export const DISTRIBUTION_LEVEL = 4;

function build(levelIdx: number): Cell[][] {
  const L = LEVELS[levelIdx];
  const g: Cell[][] = [];
  for (let y = 0; y < L.rows; y++) {
    g.push([]);
    for (let x = 0; x < L.cols; x++) g[y].push({ mask: 0, rock: false, fixed: false });
  }
  for (const [x, y] of L.rocks) g[y][x].rock = true;
  // carve the solution paths
  for (const path of L.paths) {
    path.forEach(([x, y], i) => {
      const c = g[y][x];
      const prev = path[i - 1];
      const next = path[i + 1];
      for (const nb of [prev, next]) {
        if (!nb) continue;
        const d = DIRS.find((dd) => dd.dx === nb[0] - x && dd.dy === nb[1] - y)!;
        c.mask |= d.bit;
      }
      if (i === 0 && x === 0) c.mask |= W;
      if (!next && x === L.cols - 1) c.mask |= E;
    });
  }
  // filler pieces make it a real puzzle
  const fillers = [5, 3, 5, 3, 7, 10];
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const c = g[y][x];
    if (c.rock || c.mask) continue;
    c.mask = fillers[(x * 3 + y * 5 + levelIdx) % fillers.length];
  }
  // scramble rotations
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const c = g[y][x];
    if (c.rock) continue;
    const turns = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < turns; k++) c.mask = rot(c.mask);
  }
  return g;
}

function flow(g: Cell[][], L: LevelDef): { powered: boolean[][]; lit: boolean[] } {
  const powered = g.map((r) => r.map(() => false));
  const start = g[L.source][0];
  const q: [number, number][] = [];
  if (!start.rock && start.mask & W) { powered[L.source][0] = true; q.push([0, L.source]); }
  while (q.length) {
    const [x, y] = q.shift()!;
    const c = g[y][x];
    for (const d of DIRS) {
      if (!(c.mask & d.bit)) continue;
      const nx = x + d.dx, ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
      const n = g[ny][nx];
      if (n.rock || powered[ny][nx] || !(n.mask & d.opp)) continue;
      powered[ny][nx] = true;
      q.push([nx, ny]);
    }
  }
  const lit = L.targets.map((ty) => powered[ty][L.cols - 1] && !!(g[ty][L.cols - 1].mask & E));
  return { powered, lit };
}

export default function CircuitGame({ level, onWin, hint }: MiniGameProps) {
  const li = Math.min(level, LEVELS.length) - 1;
  const L = LEVELS[li];
  const canvas = useRef<HTMLCanvasElement>(null);
  const grid = useMemo(() => {
    const g = build(li);
    if (flow(g, L).lit.every(Boolean)) g[0][0].mask = rot(g[0][0].mask);
    return g;
  }, [li, L]);
  const [, setTick] = useState(0);
  (window as unknown as Record<string, unknown>).__mg = { kind: 'circuit', L, grid, ox: 0, oy: 0, CS: 28 };
  const anim = useRef({ t: 0, won: 0, fizzle: 0, spin: new Map<string, number>() });
  const CS = 28;
  const ox = Math.round((MW - L.cols * CS) / 2), oy = Math.round((MH - L.rows * CS) / 2) + 4;
  Object.assign((window as unknown as { __mg: object }).__mg, { ox, oy });

  useLoop((dt) => {
    const a = anim.current;
    a.t += dt;
    a.fizzle = Math.max(0, a.fizzle - dt);
    for (const [k, v] of a.spin) { const nv = Math.max(0, v - dt * 8); if (nv === 0) a.spin.delete(k); else a.spin.set(k, nv); }
    if (a.won > 0) {
      a.won += dt;
      if (a.won > 1.6 && a.won < 99) { a.won = 99; onWin(); }
    }
    draw();
  });

  function draw(): void {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    panelBg(ctx);
    const a = anim.current;
    const { powered, lit } = flow(grid, L);
    // board frame
    rect(ctx, ox - 4, oy - 4, L.cols * CS + 8, L.rows * CS + 8, '#262a40');
    rect(ctx, ox - 2, oy - 2, L.cols * CS + 4, L.rows * CS + 4, '#1a1d2e');
    // battery
    const sy = oy + L.source * CS + CS / 2;
    rect(ctx, ox - 30, sy - 12, 22, 24, '#3d3a63'); rect(ctx, ox - 30, sy - 12, 22, 2, '#6d6a9a');
    rect(ctx, ox - 26, sy - 8, 14, 16, '#ffd43b');
    drawText(ctx, '+', ox - 21, sy - 4, { color: '#3d3a63', shadow: null });
    rect(ctx, ox - 8, sy - 2, 6, 4, '#ffd43b');
    // targets (lamps)
    L.targets.forEach((ty, k) => {
      const tx = ox + L.cols * CS + 4, y = oy + ty * CS + CS / 2;
      rect(ctx, tx, y - 2, 6, 4, lit[k] ? '#ffd43b' : '#6d7690');
      disc(ctx, tx + 16, y, 8, lit[k] ? '#fff2a0' : '#3a3d52');
      disc(ctx, tx + 16, y, 5, lit[k] ? '#ffffff' : '#262a40');
      rect(ctx, tx + 12, y + 7, 8, 4, '#8f99b3');
      if (lit[k]) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(tx + 16, y, 0, tx + 16, y, 26);
        gg.addColorStop(0, 'rgba(255,230,120,0.6)'); gg.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = gg; ctx.fillRect(tx - 10, y - 26, 52, 52);
        ctx.restore();
      }
    });
    // cells
    for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
      const c = grid[y][x];
      const px0 = ox + x * CS, py0 = oy + y * CS;
      rect(ctx, px0 + 1, py0 + 1, CS - 2, CS - 2, '#20253f');
      rect(ctx, px0 + 1, py0 + 1, CS - 2, 1, '#2c3354');
      if (c.rock) {
        disc(ctx, px0 + 14, py0 + 16, 9, '#8a3e26'); disc(ctx, px0 + 12, py0 + 13, 5, '#c0603a');
        continue;
      }
      const on = powered[y][x];
      const col = a.won > 0 ? (Math.floor(a.t * 12 + x + y) % 2 ? '#ffffff' : '#ffd43b') : on ? '#ffd43b' : '#8a90b0';
      const cx = px0 + CS / 2, cy = py0 + CS / 2;
      const spin = a.spin.get(`${x},${y}`) ?? 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-spin * Math.PI / 2);
      for (const d of DIRS) if (c.mask & d.bit) {
        line(ctx, -1 + d.dx * 0, -1, d.dx * 13 - 1, d.dy * 13 - 1, on ? '#a07a10' : '#454c63', 5);
        line(ctx, -1, -1, d.dx * 13 - 1, d.dy * 13 - 1, col, 3);
      }
      disc(ctx, 0, 0, 3, on ? '#ffe08a' : '#6d7690');
      ctx.restore();
      if (on && Math.random() < 0.04) { /* sparkle */ rect(ctx, cx + (Math.random() - 0.5) * 16, cy + (Math.random() - 0.5) * 16, 1, 1, '#ffffff'); }
    }
    if (a.fizzle > 0) drawText(ctx, 'NOT CONNECTED YET', MW / 2, MH - 12, { align: 'center', color: '#ff4d6d' });
    else if (level === DISTRIBUTION_LEVEL) {
      drawText(ctx, 'REROUTE POWER TO BOTH ROOMS', MW / 2, 6, { align: 'center', color: '#ffd43b' });
      drawText(ctx, 'LIFE SUPPORT', MW - 4, 22, { align: 'right', color: '#5ff3ff' });
      drawText(ctx, 'COMMAND', MW - 4, MH - 30, { align: 'right', color: '#43d9ff' });
    } else drawText(ctx, `LEVEL ${level}: LIGHT ${L.targets.length > 1 ? 'BOTH LAMPS' : 'THE LAMP'}`, MW / 2, 6, { align: 'center', color: '#ffd43b' });
  }

  const click = (e: RPE) => {
    if (anim.current.won) return;
    const p = logical(e, canvas.current!);
    const x = Math.floor((p.x - ox) / CS), y = Math.floor((p.y - oy) / CS);
    if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return;
    const c = grid[y][x];
    if (c.rock) { audio.play('error'); hint('Rocks cannot be moved. Find a way around them!', 'thinking'); return; }
    c.mask = rot(c.mask);
    anim.current.spin.set(`${x},${y}`, 1);
    audio.play('click');
    setTick((t) => t + 1);
  };

  const activate = () => {
    if (anim.current.won) return;
    const { lit } = flow(grid, L);
    if (lit.every(Boolean)) {
      anim.current.won = 0.01;
      audio.play('power');
      hint('Power is flowing! The circuit is complete.', 'celebrating');
    } else {
      anim.current.fizzle = 1.6;
      audio.play('error');
      hint(lit.some(Boolean) ? 'One lamp works! The other path still has a gap.' : 'Follow the yellow cable from the battery. Where does it stop? Turn the next piece.', 'thinking');
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <canvas ref={canvas} width={MW} height={MH} onPointerDown={click} className="mg-canvas cursor-pointer" aria-label="Circuit board: tap pieces to rotate them" />
      <button className="px-btn text-xs" onClick={activate}>ACTIVATE CIRCUIT</button>
    </div>
  );
}
