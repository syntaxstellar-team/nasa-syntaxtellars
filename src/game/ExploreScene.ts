import { VIEW_W, VIEW_H, TILE, clamp } from './constants';
import { makeCanvas, rect, px, line, disc, poly, Canv } from './art/canvas';
import { buildMountainLayer } from './art/backdrop';
import { bakeBaseExterior } from './art/baseArt';
import { drawText, measure } from './font';
import { mulberry32, hash2 } from './rng';
import { audio } from './audio';
import type { Interactable, Scene, World } from './World';
import type { Solids } from './physics';
import {
  getState, update, say, ask, openModal, toast, decide, inputBlocked, ui, withScience, collectSample, recordPhoto, markScienceSeen, logEvent, trackUsage,
} from '../store/gameStore';
import { sampleCollected, samplesAnalyzed, DRONE_TARGET } from '../data/geology';
import { MISSION_BY_ID } from '../data/missions';

const COLS = 172;
const ROWS = 17;
const GROUND = 13;

// Landmarks (tile columns)
export const X = {
  hatch: 14, solar: 20, pad: 25, rocks: 28, caveL: 35, caveR: 46, basalt: 40, soil: 50, ice: 55,
  canyonL: 64, canyonR: 88, hematite: 76, ridgeTop: 104, ridgeTopR: 112, vent: 108, arch: 156, end: 168,
};

/** Scout drone flight (fictional; inspired by NASA's Ingenuity helicopter). */
interface Drone {
  x: number; y: number; vx: number; vy: number;
  battery: number; // 1 = full
  phase: 'fly' | 'return' | 'land';
  t: number;
  flash: number;
}
const DRONE_FLIGHT_SECONDS = 50;

export class ExploreScene implements Scene {
  kind = 'explore' as const;
  width = COLS * TILE;
  private top = new Int16Array(COLS);
  private ceil = new Int16Array(COLS).fill(-1); // cave overhang bottom row (exclusive)
  private terrain: Canv;
  private baseImg: Canv = bakeBaseExterior();
  private mountains: Canv[];
  drone: Drone | null = null;
  private t = 0;
  private dark: Canv;
  private dctx: CanvasRenderingContext2D;
  private warned = false;
  private lowBatteryWarned = false;
  solids: Solids = {
    solid: (tx: number, ty: number) => {
      if (tx < 0 || tx >= COLS) return true;
      if (ty >= this.top[tx]) return true;
      if (this.ceil[tx] > 0 && ty < this.ceil[tx] && ty >= this.ceil[tx] - 2) return true;
      return false;
    },
  };

  constructor() {
    this.buildHeights();
    this.terrain = this.bakeTerrain();
    this.mountains = [
      buildMountainLayer(31, 1024, 200, 140, 70, '#c97a5a', '#e09a72', false),
      buildMountainLayer(47, 1024, 200, 160, 60, '#a8573a', '#c06a48', false),
    ];
    [this.dark, this.dctx] = makeCanvas(VIEW_W, VIEW_H);
  }

  private buildHeights(): void {
    const t = this.top;
    for (let x = 0; x < COLS; x++) t[x] = GROUND;
    // little bumps
    for (let x = 117; x < 150; x++) t[x] = GROUND - (Math.sin(x * 0.35) > 0.6 ? 1 : 0);
    // cave: floor dips, rock overhang on top
    for (let x = X.caveL; x <= X.caveR; x++) { t[x] = GROUND + 1; this.ceil[x] = 10; }
    for (let x = X.caveL - 2; x < X.caveL; x++) this.ceil[x] = 9;
    for (let x = X.caveR + 1; x <= X.caveR + 2; x++) this.ceil[x] = 9;
    // canyon with stairs
    t[X.canyonL] = 14; t[X.canyonL + 1] = 14; t[X.canyonL + 2] = 15;
    for (let x = X.canyonL + 3; x <= X.canyonR - 3; x++) t[x] = 15;
    t[X.canyonR - 2] = 15; t[X.canyonR - 1] = 14; t[X.canyonR] = 14;
    // ridge: one-tile steps so everyone can climb it
    const steps: [number, number][] = [[92, 12], [94, 11], [96, 10], [98, 9], [100, 8], [102, 7]];
    for (const [sx, h] of steps) for (let x = sx; x < sx + 2; x++) t[x] = h;
    for (let x = X.ridgeTop; x <= X.ridgeTopR; x++) t[x] = 6;
    const down: [number, number][] = [[113, 7], [115, 8], [117, 9], [119, 10], [121, 11], [123, 12]];
    for (const [sx, h] of down) for (let x = sx; x < sx + 2; x++) t[x] = h;
    t[103] = 7;
    // world edge cliff
    for (let x = X.end; x < COLS; x++) t[x] = 4;
  }

  /** A reddish-brown Martian rock arch: rough edges, rock layers, lit from the upper left, with a ground shadow. */
  private bakeArch(ctx: CanvasRenderingContext2D, ax: number, gy: number): void {
    // ground shadow first (falls to the lower right, away from the Sun)
    for (let x = -34; x <= 78; x++) {
      const k = 1 - Math.abs(x - 22) / 58;
      if (k <= 0) continue;
      const h = k > 0.55 ? 2 : 1;
      rect(ctx, ax + x, gy, 1, h, hash2(x, 1, 9) < 0.15 ? '#6a2e1c' : '#7a3420');
    }
    // smooth, repeatable bumps for the rough outline
    const bump = (a: number, seed: number) => Math.sin(a * 7 + seed) * 0.5 + Math.sin(a * 13 + seed * 2) * 0.3 + Math.sin(a * 23 + seed * 3) * 0.2;
    for (let dy = -64; dy < 0; dy++) {
      for (let dx = -66; dx <= 66; dx++) {
        const r = Math.hypot(dx, dy * 1.12);
        const a = Math.atan2(-dy, dx); // 0..π across the arch
        const outer = 56 + bump(a, 1.3) * 4 + (dy > -14 ? (14 + dy) * 0.35 : 0); // legs flare at the base
        const inner = 33 + bump(a, 4.1) * 3 - (dy > -10 ? (10 + dy) * 0.5 : 0);
        if (r > outer || r < inner) continue;
        // rock layers (wavy strata) and simple lighting
        const layer = Math.floor((-dy + bump(dx * 0.05, 2) * 2) / 5) % 3;
        let col = ['#a64e30', '#9a4a30', '#b0603a'][layer];
        const nx = dx / r, ny = dy / r; // outward normal (ny < 0 = up)
        const light = -nx * 0.55 - ny * 0.85; // Sun from the upper left
        const toOuter = outer - r, toInner = r - inner;
        if (toOuter < 2 && light > 0.2) col = toOuter < 1 ? '#f0a070' : '#d8794a';
        else if (toOuter < 2.5 && light < -0.3) col = '#6a2e1c';
        else if (toInner < 3) col = toInner < 1.5 ? '#4a1e12' : '#6a2e1c'; // the underside of the arch is in shadow
        else if (light < -0.35) col = layer === 2 ? '#8a3e26' : '#7a3420';
        // grain and small pits
        const hsh = hash2(dx + 200, dy + 200, 5);
        if (hsh < 0.06) col = '#5a2416';
        else if (hsh > 0.95 && light > 0) col = '#d8794a';
        rect(ctx, ax + dx, gy + dy, 1, 1, col);
      }
    }
    // a few fallen blocks at the feet
    for (const [ox, w, h] of [[-62, 9, 6], [52, 11, 7], [60, 6, 4]] as [number, number, number][]) {
      poly(ctx, [ax + ox, gy, ax + ox + 1, gy - h, ax + ox + w - 2, gy - h - 1, ax + ox + w, gy], '#8a3e26');
      rect(ctx, ax + ox + 2, gy - h, w - 5, 1, '#d8794a');
      rect(ctx, ax + ox + w - 2, gy - h + 2, 1, h - 2, '#5a2416');
    }
  }

  private bakeTerrain(): Canv {
    const W = COLS * TILE, H = ROWS * TILE;
    const [c, ctx] = makeCanvas(W, H);
    const r = mulberry32(77);
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const solidTile = y >= this.top[x] || (this.ceil[x] > 0 && y < this.ceil[x] && y >= this.ceil[x] - 2);
        const overhangRock = this.ceil[x] > 0 && y < this.ceil[x] - 2 && y >= 6;
        if (!solidTile && !overhangRock) continue;
        const depth = y - this.top[x];
        const base = overhangRock ? '#7a3a2a' : depth <= 0 ? '#c0603a' : depth < 2 ? '#a64e30' : '#8a3e26';
        rect(ctx, x * TILE, y * TILE, TILE, TILE, base);
        for (let k = 0; k < 10; k++) px(ctx, x * TILE + Math.floor(r() * 16), y * TILE + Math.floor(r() * 16), r() < 0.5 ? '#7a3420' : '#d8794a');
        if (r() < 0.25) { rect(ctx, x * TILE + 3 + Math.floor(r() * 8), y * TILE + 4 + Math.floor(r() * 8), 4, 3, '#6a2e1c'); }
        const exposedTop = y === this.top[x] && !(this.ceil[x] > 0 && y < this.ceil[x]);
        if (exposedTop) {
          rect(ctx, x * TILE, y * TILE, TILE, 2, '#f0a070');
          rect(ctx, x * TILE, y * TILE + 2, TILE, 1, '#d8794a');
          if (hash2(x, y, 3) < 0.3) { rect(ctx, x * TILE + 5, y * TILE - 2, 4, 2, '#d8794a'); px(ctx, x * TILE + 6, y * TILE - 3, '#f0a070'); }
        }
        // side edge shading
        if (x > 0 && this.top[x - 1] > y && !overhangRock) rect(ctx, x * TILE, y * TILE, 1, TILE, '#f0a070');
        if (x < COLS - 1 && this.top[x + 1] > y && !overhangRock) rect(ctx, x * TILE + 15, y * TILE, 1, TILE, '#5a2416');
      }
    }
    // striped rocks
    const rx0 = X.rocks * TILE, gy = GROUND * TILE;
    for (let k = 0; k < 3; k++) {
      const bx = rx0 + k * 20 - 10, h = 26 + k * 8 - (k === 2 ? 14 : 0);
      rect(ctx, bx, gy - h, 18, h, '#b0603a');
      for (let s = 0; s < h; s += 5) rect(ctx, bx, gy - h + s, 18, 2, s % 10 ? '#e8b08a' : '#7a3a2a');
      rect(ctx, bx, gy - h, 18, 1, '#f0c0a0');
    }
    // canyon walls decoration
    for (let x = X.canyonL + 3; x < X.canyonR - 2; x += 4) rect(ctx, x * TILE + 4, 15 * TILE - 6, 6, 6, '#7a3420');
    // natural rock arch (wind-eroded sandstone look), pixel by pixel with irregular edges
    this.bakeArch(ctx, X.arch * TILE, gy);
    // scattered boulders
    for (const bx of [8, 60, 92, 126, 133, 141, 148, 162]) {
      const x = bx * TILE, y = this.top[bx] * TILE;
      poly(ctx, [x, y, x + 3, y - 9, x + 10, y - 12, x + 16, y - 6, x + 18, y], '#8a3e26');
      rect(ctx, x + 4, y - 9, 5, 2, '#c0603a');
    }
    return c;
  }

  enter(w: World, from: 'start' | 'door'): void {
    const s = getState();
    const x = from === 'door' || !s.exploreX ? X.hatch * TILE + 8 : s.exploreX;
    w.player.place(x, this.top[Math.floor(x / TILE)] * TILE);
    w.player.facing = 1;
    w.nova.x = x - 30;
    w.nova.y = GROUND * TILE - 40;
    this.warned = false;
    this.drone = null;
    if (from === 'door' && !s.flags.firstOutside) {
      update((st) => { st.flags.firstOutside = true; });
      say('Welcome to the surface of Mars! The air out here is thin and mostly carbon dioxide, so watch your suit oxygen at the top of the screen.', 'surprised');
      say('Try a jump! Mars has only about 38% of Earth\'s surface gravity. That means objects fall more slowly, and you can stay in the air longer when you jump.', 'celebrating', 'NOVA', () => markScienceSeen('gravity'));
      say('The solar panels are just to the right. Walk over and press E.', 'happy');
    }
  }

  areaName(x: number): string {
    const tx = x / TILE;
    if (tx < X.hatch + 3) return 'OUTSIDE ARES-7';
    if (tx < X.rocks + 4) return 'SOLAR FIELD';
    if (tx >= X.caveL && tx <= X.caveR) return 'ROCK OVERHANG';
    if (tx < X.canyonL) return 'FROST FLATS';
    if (tx <= X.canyonR) return 'PEBBLE CANYON';
    if (tx < 125) return 'WIND RIDGE';
    if (tx < 150) return 'DUNE PLAINS';
    return 'ROCK ARCH';
  }

  music(): 'day' | 'night' | 'tense' {
    return 'night';
  }

  /**
   * Short NOVA hints at the research rocks: if the rock research mission is not on the list yet,
   * NOVA asks the player to accept it (then explains how); once it is active, she says how to
   * investigate. Each hint is shown at most once per mission (saved in flags).
   */
  private rockHintT = 0;
  private rockResearchHints(w: World, dt: number): void {
    const s = getState();
    if (inputBlocked() || w.cine || this.drone) return;
    // which rock research mission applies here, and which rocks count
    const geo = s.day >= 8 && samplesAnalyzed(s) < 3;
    const mid = geo ? 'm-geology' : 'x-rocks';
    const m = MISSION_BY_ID[mid];
    if (!m || m.day > s.day || s.completed.includes(mid)) return;
    const spots = geo ? [X.rocks, X.basalt, X.hematite] : [X.rocks];
    const near = spots.some((t) => Math.abs(w.player.cx - (t * TILE + 8)) < 56);
    if (!near) return;
    const active = s.accepted.includes(mid);
    const key = (n: number) => `rockHint${n}:${mid}`;
    if (!active) {
      this.rockHintT += dt;
      if (!s.flags[key(1)]) {
        update((st) => { st.flags[key(1)] = true; });
        this.rockHintT = 0;
        say(`Explorer, activate the "${m.title}" mission first!`, 'surprised');
      } else if (!s.flags[key(2)] && this.rockHintT > 12) {
        update((st) => { st.flags[key(2)] = true; });
        say(`Open MISSIONS (top right), find "${m.title}" and press ACCEPT MISSION.`, 'thinking');
      }
      return;
    }
    if (!s.flags[key(3)]) {
      update((st) => { st.flags[key(3)] = true; });
      say(geo
        ? 'Great! Now collect rock samples here (HOLD E), then analyze them in the Science Lab.'
        : 'Great! Now walk up to the striped rocks and HOLD E to investigate.', 'happy');
    }
  }

  update(w: World, dt: number): void {
    this.t += dt;
    const s = getState();
    const p = w.player;
    this.rockResearchHints(w, dt);
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) update((st) => { st.exploreX = p.cx; }, { silent: true });
    // suit oxygen
    if (!w.cine && !inputBlocked()) {
      const o2 = Math.max(0, s.suitO2 - dt * 0.75);
      update((st) => { st.suitO2 = o2; }, { silent: true });
      if (o2 < 25 && !this.warned) { this.warned = true; say('Your suit oxygen is getting low! Head back to the airlock on the left.', 'worried'); }
      if (o2 <= 0) {
        update((st) => { st.oxygen = Math.max(0, st.oxygen - 3); trackUsage('oxygen', -3, 'Suit refill after running out', st); logEvent('risk', 'Suit oxygen ran out outside — refilled from base air', st); }, { silent: true });
        w.goInside('Phew! Your suit ran out of air, so I guided you back inside. We used a little of the base oxygen to refill it.');
        update((st) => { st.suitO2 = 100; });
      }
    }
    if (this.drone) this.updateDrone(w, dt);
    // dust in the air
    if (Math.random() < dt * 6) w.particles.add({ x: w.camX + VIEW_W + 4, y: Math.random() * VIEW_H * 0.8, vx: -40 - Math.random() * 40, vy: 6, max: 6, color: '#f0c0a0', fade: true });
  }

  // ----------------------------------------------------------------- drawing
  drawBack(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    const s = getState();
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#6a4a5a');
    g.addColorStop(0.45, '#d8946a');
    g.addColorStop(1, '#f0c090');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // the small, distant Sun and the little moon Phobos
    disc(ctx, 380 - camX * 0.02, 46, 8, '#fff6e0');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(380 - camX * 0.02, 46, 0, 380 - camX * 0.02, 46, 50);
    sg.addColorStop(0, 'rgba(255,240,210,0.5)'); sg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sg; ctx.fillRect(300, 0, 180, 120);
    ctx.restore();
    disc(ctx, 90 - camX * 0.03, 30, 3, '#f6e8ff');
    this.mountains.forEach((m, i) => {
      const f = [0.15, 0.3][i];
      const ox = -((camX * f) % m.width);
      for (let x = ox - m.width; x < VIEW_W; x += m.width) ctx.drawImage(m, Math.round(x), 30 + i * 20);
    });
    // base exterior
    const bx = Math.round(-4 - camX), by = GROUND * TILE - 120;
    ctx.drawImage(this.baseImg, bx, by);
    // antenna on the roof
    const ax = bx + 120, ay = by + 40;
    line(ctx, ax, ay, ax, ay - 22, '#8f99b3', 2);
    if (s.minigames.antenna.solved.length) {
      disc(ctx, ax - 3, ay - 28, 9, '#e8e6f2'); disc(ctx, ax - 2, ay - 27, 6, '#c3c9da');
      if (Math.floor(this.t * 2) % 2) px(ctx, ax - 7, ay - 33, '#5ff3ff');
    } else {
      line(ctx, ax, ay - 22, ax + 12, ay - 14, '#c3c9da', 3);
      if (Math.random() < 0.05) w.particles.burst(ax + 12, ay - 14, '#ffe08a', 3, 40, { glow: true });
    }
    // terrain
    ctx.drawImage(this.terrain, Math.round(camX), 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    this.drawProps(w, ctx, camX);
  }

  private drawProps(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    const s = getState();
    const gy = GROUND * TILE;
    // solar array (dust builds up again over time — simulated)
    const clean = s.minigames.solar.solved.length > 0;
    const dusty = !clean || s.dust >= 50;
    for (let k = 0; k < 4; k++) {
      const x = Math.round(X.solar * TILE + k * 22 - 30 - camX);
      line(ctx, x + 9, gy, x + 9, gy - 14, '#6d7690', 2);
      poly(ctx, [x, gy - 14, x + 18, gy - 22, x + 20, gy - 18, x + 2, gy - 10], dusty ? '#9a5a3a' : '#2a4aa8');
      if (!dusty) { line(ctx, x + 2, gy - 13, x + 18, gy - 20, '#5a8aff'); px(ctx, x + 14, gy - 19, '#ffffff'); }
      else for (let d = 0; d < 6; d++) px(ctx, x + 3 + d * 3, gy - 13 - d, '#d8a07a');
      if (clean && !dusty && s.dust >= 20) for (let d = 0; d < 3; d++) px(ctx, x + 5 + d * 4, gy - 14 - d, '#c08a6a');
    }
    // drone pad
    {
      const x = Math.round(X.pad * TILE - camX);
      rect(ctx, x - 12, gy - 2, 24, 2, '#6d7690');
      rect(ctx, x - 10, gy - 3, 20, 1, '#ffd43b');
      if (!this.drone) ctx.drawImage(w.spr.drone[0], x - 12, gy - 18);
    }
    // soil sample flag
    {
      const x = Math.round(X.soil * TILE + 8 - camX);
      if (!s.flags.soilCollected) {
        line(ctx, x, gy, x, gy - 18, '#e8e6f2');
        rect(ctx, x + 1, gy - 18, 8, 5, Math.floor(this.t * 2) % 2 ? '#ffd43b' : '#ff8a3d');
      } else rect(ctx, x - 4, gy - 1, 8, 2, '#5a2416');
    }
    // basalt outcrop in the rock overhang
    {
      const x = Math.round(X.basalt * TILE - camX), y = (GROUND + 1) * TILE;
      poly(ctx, [x - 14, y, x - 10, y - 12, x - 2, y - 16, x + 8, y - 13, x + 14, y], '#3e3846');
      rect(ctx, x - 6, y - 12, 8, 2, '#5a5266');
      for (const [hx, hy] of [[-6, -7], [1, -9], [5, -5], [-2, -4], [9, -8]]) px(ctx, x + hx, y + hy, '#1e1a24');
      if (sampleCollected(s, 'basalt')) rect(ctx, x + 6, y - 13, 5, 4, '#2a2632');
    }
    // ice pocket
    {
      const x = Math.round(X.ice * TILE - camX);
      const drilled = !!s.flags.iceDrilled;
      rect(ctx, x - 10, gy - 3, 36, 3, drilled ? '#8a9aa8' : '#dff8ff');
      for (let k = 0; k < 6; k++) px(ctx, x - 8 + k * 6, gy - 4, '#ffffff');
      if (drilled) { rect(ctx, x + 4, gy - 30, 4, 30, '#6d7690'); rect(ctx, x, gy - 34, 12, 6, '#ff8a3d'); }
    }
    // hematite spherules on the canyon floor
    {
      const x = Math.round(X.hematite * TILE - camX), y = 15 * TILE;
      if (!sampleCollected(s, 'hematite')) for (let k = 0; k < 9; k++) {
        const hx = x - 14 + k * 3 + (k % 2), hy = y - 1 - (k % 3 === 0 ? 1 : 0);
        rect(ctx, hx, hy, 2, 2, k % 2 ? '#6a6f80' : '#8a90a0');
      }
      if (s.decisions.canyon === 'chisel') rect(ctx, x + 18, y - 12, 8, 6, '#5a2416');
    }
    // wind-carved rocks (ventifacts) on Wind Ridge — the drone's survey target
    {
      const x = Math.round(X.vent * TILE - camX), y = 6 * TILE;
      for (const [ox, h] of [[-14, 14], [2, 20], [16, 10]] as [number, number][]) {
        poly(ctx, [x + ox - 7, y, x + ox - 5, y - h, x + ox + 3, y - h - 2, x + ox + 8, y - h + 4, x + ox + 8, y], '#9a4a30');
        for (let g = 4; g < h; g += 4) line(ctx, x + ox - 5, y - g, x + ox + 7, y - g - 2, '#6a2e1c');
      }
      if (s.photos.includes(DRONE_TARGET.id)) disc(ctx, x + 2, y - 26, 2, Math.floor(this.t * 2) % 2 ? '#5ff3ff' : '#bff6ff');
    }
    // beacon spot at the arch
    {
      const x = Math.round(X.arch * TILE - camX);
      if (s.flags.beaconPlaced) {
        line(ctx, x, gy, x, gy - 20, '#c3c9da', 2);
        disc(ctx, x, gy - 22, 3, Math.floor(this.t * 2) % 2 ? '#5ff3ff' : '#bff6ff');
      } else if (s.day >= 8) {
        rect(ctx, x - 6, gy - 1, 12, 1, '#ffd43b');
        if (Math.floor(this.t * 2) % 2) drawText(ctx, '?', x, gy - 14, { align: 'center', color: '#ffd43b' });
      }
    }
  }

  drawFront(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    this.drawCave(w, ctx, camX);
    if (this.drone) this.drawDrone(w, ctx, camX);
  }

  private drawCave(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    // darkness under the rock overhang, with light from the helmet lamp, NOVA and the drone
    const d = this.dctx;
    const x0 = X.caveL * TILE - camX - 8, x1 = (X.caveR + 1) * TILE - camX + 8;
    if (x1 < 0 || x0 > VIEW_W) return;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = 'rgba(20,8,30,0.72)';
    d.fillRect(x0, 9 * TILE, x1 - x0, 6 * TILE);
    d.globalCompositeOperation = 'destination-out';
    const holes: [number, number, number][] = [[w.player.cx - camX, w.player.body.y + 8, 56], [w.nova.x - camX, w.nova.y, 30]];
    if (this.drone) holes.push([this.drone.x - camX, this.drone.y, 30]);
    for (const [lx, ly, r] of holes) {
      const g = d.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    ctx.drawImage(this.dark, 0, 0);
  }

  // ----------------------------------------------------------------- scout drone
  droneAvailable(): boolean {
    return getState().day >= 6;
  }

  launchDrone(w: World): void {
    if (this.drone) return;
    const gy = GROUND * TILE;
    this.drone = { x: X.pad * TILE, y: gy - 10, vx: 0, vy: -30, battery: 1, phase: 'fly', t: 0, flash: 0 };
    this.lowBatteryWarned = false;
    audio.play('whoosh');
    w.player.facing = 1;
    say('Drone launched! Fly with A/D (or the arrows). W or Space climbs, S sinks. The thin air means its rotors spin very fast.', 'happy');
    say(`Fly east to Wind Ridge and find the ${DRONE_TARGET.name.toLowerCase()}. Press E near them to take a picture.`, 'curious');
  }

  /** The camera follows the drone while it flies. */
  cameraTarget(): number | null {
    return this.drone ? this.drone.x : null;
  }

  /** While the drone flies the astronaut stands still holding the controller. */
  controlsLocked(): boolean {
    return !!this.drone;
  }

  private nearTarget(): boolean {
    const d = this.drone;
    if (!d) return false;
    return Math.abs(d.x - X.vent * TILE) < 44 && Math.abs(d.y - (6 * TILE - 16)) < 46;
  }

  private groundAt(px: number): number {
    const tx = clamp(Math.floor(px / TILE), 0, COLS - 1);
    return this.top[tx] * TILE;
  }

  private updateDrone(w: World, dt: number): void {
    const d = this.drone!;
    d.t += dt;
    d.flash = Math.max(0, d.flash - dt);
    const busy = inputBlocked() || !!w.cine;
    const s = getState();
    if (d.phase === 'fly') {
      if (!busy) d.battery = Math.max(0, d.battery - dt / DRONE_FLIGHT_SECONDS);
      const inp = w.input;
      let ax = 0, ay = 0;
      if (!busy) {
        if (inp.key('KeyA', 'ArrowLeft')) ax -= 1;
        if (inp.key('KeyD', 'ArrowRight')) ax += 1;
        if (inp.key('KeyW', 'ArrowUp', 'Space')) ay -= 1;
        if (inp.key('KeyS', 'ArrowDown')) ay += 1;
      }
      d.vx += ax * 260 * dt;
      d.vy += ay * 220 * dt + 10 * dt; // no input: it holds altitude and drifts down very gently
      const damp = Math.exp(-dt * 2.2);
      d.vx *= ax ? 1 : damp; d.vy *= ay ? 1 : damp;
      d.vx = clamp(d.vx, -110, 110); d.vy = clamp(d.vy, -80, 80);
      if (!busy && inp.hit('KeyE', 'Enter')) {
        if (this.nearTarget()) {
          d.flash = 0.4;
          audio.play('transmit');
          w.particles.burst(d.x, d.y + 6, '#ffffff', 10, 40, { glow: true });
          const first = !s.photos.includes(DRONE_TARGET.id);
          recordPhoto(DRONE_TARGET.id);
          if (first) {
            say(`Picture taken! ${DRONE_TARGET.text}`, 'surprised');
            say('The image is saved in the Research Journal. Bringing the drone home now.', 'happy');
          } else say('Another nice picture! Bringing the drone home.', 'happy');
          d.phase = 'return';
        } else toast('Fly closer to the wind-carved rocks on Wind Ridge');
      }
      if (d.battery < 0.25 && !this.lowBatteryWarned) { this.lowBatteryWarned = true; say('Drone battery is getting low! I will bring it home soon.', 'worried'); }
      if (d.battery <= 0) { d.phase = 'return'; say('Battery empty — the drone is flying itself home.', 'thinking'); }
    } else if (d.phase === 'return') {
      const tx = X.pad * TILE, ty = 6 * TILE - 30;
      const dx = tx - d.x;
      d.vx = clamp(dx * 2, -170, 170);
      d.vy = clamp((Math.abs(dx) > 30 ? ty : GROUND * TILE - 10) - d.y, -90, 90);
      if (Math.abs(dx) < 3 && d.y > GROUND * TILE - 14) d.phase = 'land';
    } else {
      d.vx = 0; d.vy = 25;
      if (d.y >= GROUND * TILE - 9) {
        this.drone = null;
        audio.play('place');
        update((st) => { st.flags.droneFlights = Number(st.flags.droneFlights ?? 0) + 1; });
        return;
      }
    }
    d.x = clamp(d.x + d.vx * dt, 10, (X.end - 1) * TILE);
    d.y += d.vy * dt;
    // keep clear of the ground, the overhang roof and the sky limit
    const floor = this.groundAt(d.x) - 9;
    if (d.y > floor) { d.y = floor; d.vy = Math.min(0, d.vy); }
    const tx = Math.floor(d.x / TILE);
    if (this.ceil[tx] > 0 && d.y < this.ceil[tx] * TILE + 8 && d.y > (this.ceil[tx] - 3) * TILE) d.y = this.ceil[tx] * TILE + 8;
    if (d.y < 22) { d.y = 22; d.vy = Math.max(0, d.vy); }
    // rotor wash kicks up dust near the ground
    if (floor - d.y < 30 && Math.random() < dt * 20) w.particles.add({ x: d.x + (Math.random() - 0.5) * 20, y: floor + 8, vx: (Math.random() - 0.5) * 60, vy: -15, max: 0.6, color: '#d9875a', fade: true });
  }

  private drawDrone(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    const d = this.drone!;
    const x = Math.round(d.x - camX), y = Math.round(d.y);
    ctx.drawImage(w.spr.drone[Math.floor(d.t * 30) % 3], x - 12, y - 8);
    if (d.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${d.flash})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    // battery and hint bar
    rect(ctx, 6, VIEW_H - 22, 104, 16, '#0b0816');
    drawText(ctx, 'DRONE', 10, VIEW_H - 18, { color: '#5ff3ff' });
    rect(ctx, 44, VIEW_H - 18, 60, 7, '#1e1840');
    rect(ctx, 45, VIEW_H - 17, Math.round(58 * d.battery), 5, d.battery < 0.25 ? '#ff4d6d' : '#3dff8a');
    // where the target is
    const tgt = X.vent * TILE - camX;
    if (d.phase === 'fly') {
      if (this.nearTarget()) {
        const label = 'E  CAPTURE IMAGE';
        const bw = measure(label) + 10;
        rect(ctx, x - bw / 2, y - 26, bw, 12, '#1e1840');
        rect(ctx, x - bw / 2, y - 26, bw, 1, '#ffd43b');
        drawText(ctx, label, x, y - 23, { align: 'center', color: '#ffd43b' });
      } else if (tgt > VIEW_W - 10) {
        drawText(ctx, 'WIND RIDGE >', VIEW_W - 8, 30, { align: 'right', color: '#ffd43b' });
      } else if (tgt < 10) drawText(ctx, '< WIND RIDGE', 8, 30, { color: '#ffd43b' });
    } else drawText(ctx, 'RETURNING TO PAD', VIEW_W / 2, 30, { align: 'center', color: '#5ff3ff' });
  }

  // ----------------------------------------------------------------- interactions
  interactables(w: World): Interactable[] {
    const s = getState();
    const L: Interactable[] = [];
    if (this.drone) return L;
    const gy = GROUND * TILE;
    L.push({ id: 'hatch', x: X.hatch * TILE - 8, y: gy, w: 26, h: 46, label: 'AIRLOCK - GO INSIDE', action: () => w.goInside() });
    const solarOk = s.minigames.solar.solved.length > 0;
    L.push({
      id: 'solar', x: X.solar * TILE + 4, y: gy, w: 80, h: 30, label: solarOk && s.dust >= 20 ? `SOLAR ARRAY - DUST ${Math.round(s.dust)}%` : 'SOLAR ARRAY',
      action: () => withScience('solar', () => this.solar(w)),
    });
    L.push({
      id: 'pad', x: X.pad * TILE, y: gy, w: 26, h: 24, label: 'SCOUT DRONE',
      action: () => {
        if (!this.droneAvailable()) { say('The scout drone is still charging after the long trip here. It will be ready on Day 6.', 'thinking'); return; }
        withScience('drone', () => ask('Launch the scout drone? Its battery lasts about 50 seconds.', 'happy', [
          { label: 'Launch it!', action: () => this.launchDrone(w) },
          { label: 'Not now', action: () => {} },
        ]));
      },
    });
    if (!s.flags.rocksScanned) L.push({
      id: 'rocks', x: X.rocks * TILE + 10, y: gy, w: 56, h: 40, label: 'STRIPED ROCKS', hold: 1.4,
      action: () => {
        update((st) => { st.flags.rocksScanned = true; });
        w.nova.scan = 1;
        collectSample('sediment');
        say('Scan complete! Each stripe is a layer of sand or mud that settled long ago, one on top of another.', 'surprised');
        say('NASA\'s Curiosity rover found layered rocks like these in Gale Crater. They formed in an ancient lake! I picked up a small loose chip for the Rock Analyzer.', 'curious');
      },
    });
    else if (!sampleCollected(s, 'sediment')) L.push({ id: 'rocks3', x: X.rocks * TILE + 10, y: gy, w: 56, h: 40, label: 'TAKE A LOOSE ROCK CHIP', action: () => { w.player.act('repair', 0.6); collectSample('sediment'); say('A small chip that had already fallen off. Perfect for the Rock Analyzer.', 'happy'); } });
    else L.push({ id: 'rocks2', x: X.rocks * TILE + 10, y: gy, w: 56, h: 40, label: 'STRIPED ROCKS', action: () => say('Layer upon layer, like pages in a history book.', 'happy') });
    if (!s.flags.soilCollected) L.push({
      id: 'soil', x: X.soil * TILE + 8, y: gy, w: 20, h: 24, label: 'DIG SOIL SAMPLE',
      action: () => {
        w.player.act('repair', 0.8);
        audio.play('break');
        w.particles.burst(X.soil * TILE + 8, gy, '#c0603a', 12, 50);
        collectSample('soil');
        say('A regolith sample! That is what scientists call the loose dust, sand and broken rock on Mars. The Rock Analyzer can tell us what it is made of.', 'happy');
      },
    });
    if (!sampleCollected(s, 'basalt')) L.push({
      id: 'basalt', x: X.basalt * TILE, y: (GROUND + 1) * TILE, w: 30, h: 22, label: 'DARK ROCK - COLLECT SAMPLE', hold: 1.2,
      action: () => {
        w.player.act('repair', 0.8);
        audio.play('mine');
        w.particles.burst(X.basalt * TILE, (GROUND + 1) * TILE - 10, '#5a5266', 10, 40);
        collectSample('basalt');
        say('Got a piece! Dark rock full of tiny holes... those could be old gas bubbles from lava. Let\'s analyze it in the lab.', 'curious');
      },
    });
    else L.push({ id: 'basalt2', x: X.basalt * TILE, y: (GROUND + 1) * TILE, w: 30, h: 22, label: 'DARK ROCK', action: () => say(s.analyzed.includes('basalt') ? 'Basalt — rock made from cooled lava.' : 'Our sample of this rock is waiting for the Rock Analyzer.', 'happy') });
    L.push({
      id: 'ice', x: X.ice * TILE + 8, y: gy, w: 40, h: 16, label: 'FROST PATCH',
      action: () => say(s.flags.iceDrilled
        ? 'Our drill took most of this ice. This spot was an untouched research site, and now it is disturbed.'
        : 'Water ice hides just under the dust here! NASA\'s Phoenix lander found ice like this under the soil near the north pole of Mars.', 'curious'),
    });
    if (!sampleCollected(s, 'hematite')) L.push({
      id: 'hematite', x: X.hematite * TILE, y: 15 * TILE, w: 40, h: 20, label: 'GREY PEBBLES',
      action: () => this.hematite(w),
    });
    if (s.day >= 8 || s.flags.beaconPlaced) L.push({
      id: 'arch', x: X.arch * TILE, y: gy, w: 40, h: 50, label: s.flags.beaconPlaced ? 'ROCK ARCH' : 'PLACE BEACON',
      action: () => {
        if (s.flags.beaconPlaced) { say('Our beacon marks this spot for future scientists.', 'happy'); return; }
        update((st) => { st.flags.beaconPlaced = true; st.inventory.beacon = 0; logEvent('science', 'Placed a research beacon at the Rock Arch', st); });
        audio.play('power');
        w.player.act('repair', 0.8);
        say('Beacon placed! On Earth, wind and blowing sand can carve rock into shapes like this over a very long time. A great place for future study.', 'celebrating');
      },
    });
    return L;
  }

  private solar(w: World): void {
    const s = getState();
    if (!s.minigames.solar.solved.length || s.dust < 20) { openModal({ kind: 'launcher', id: 'solar' }); return; }
    ask(`Dust covers about ${Math.round(s.dust)}% of the panels (simulated). Dust blocks sunlight, so the panels make less power.`, 'thinking', [
      {
        label: 'Brush the dust off', note: 'Quick maintenance',
        action: () => {
          w.player.act('repair', 1);
          audio.play('mine');
          w.particles.burst(X.solar * TILE + 4, GROUND * TILE - 18, '#d8a07a', 16, 60);
          update((st) => { logEvent('repair', `Brushed ${Math.round(st.dust)}% dust off the solar panels`, st); st.dust = 0; });
          say('Sparkling clean! Real rovers could not brush their panels — they had to wait for a lucky gust of wind.', 'celebrating');
        },
      },
      { label: 'Play Solar Panel Alignment', action: () => openModal({ kind: 'launcher', id: 'solar' }) },
      { label: 'Not now', action: () => {} },
    ]);
  }

  private hematite(w: World): void {
    const take = () => { w.player.act('repair', 0.8); audio.play('pickup'); collectSample('hematite'); };
    if (getState().decisions.canyon) { take(); say('Hematite spherules collected.', 'happy'); return; }
    ask('Tiny grey balls of hematite! We could pick up the loose ones... or cut a big block out of the untouched canyon wall to get more. What should we do?', 'thinking', [
      {
        label: 'Pick up the loose spherules', note: 'The site stays untouched.',
        action: () => {
          decide('canyon', 'loose');
          take();
          say('Great choice. Scientists try to keep special sites unspoiled, so others can study them later.', 'celebrating');
          say('NASA\'s Opportunity rover found spheres like these. Scientists nicknamed them "blueberries".', 'curious');
        },
      },
      {
        label: 'Cut a big block from the wall', note: 'Extra research, but it damages the site.',
        action: () => {
          decide('canyon', 'chisel', (st) => { st.ecosystem -= 25; st.research += 1; });
          take();
          w.particles.burst(X.hematite * TILE + 22, 15 * TILE - 10, '#a64e30', 18, 70);
          say('We got lots of rock... but the layered wall is damaged now, and those layers took millions of years to form.', 'worried');
        },
      },
    ]);
  }
}

export { clamp, ui };
