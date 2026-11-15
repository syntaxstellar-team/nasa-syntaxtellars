import { VIEW_W, VIEW_H, TILE, clamp } from './constants';
import { ROOMS, ROOM_W, FLOOR_Y, CEIL_Y, ROOF_Y, ROOM_INDEX, bakeRoom, windowLandscape } from './art/baseArt';
import { makeCanvas, rect, disc, line, px } from './art/canvas';
import { drawText } from './font';
import { audio } from './audio';
import type { Interactable, Scene, World } from './World';
import type { Solids } from './physics';
import type { GameState, RoomId } from '../store/types';
import {
  getState, update, say, ask, openModal, addItem, buyUpgrade, toast, dayComplete, nextDay, decide, gainEnergy, withScience, logEvent, trackUsage,
} from '../store/gameStore';
import { samplesAnalyzed } from '../data/geology';
import { dayDef } from '../data/days';
import { UPGRADE_BY_ID } from '../data/upgrades';

const COLS = (ROOMS.length * ROOM_W) / TILE;

/** Which rooms are open. A room's left door is locked when this returns a reason. */
export function roomLock(id: RoomId, s: GameState): string | null {
  switch (id) {
    case 'lab': return s.upgrades['lab-power'] ? null : s.day >= 6 ? 'The Science Lab door needs power (10 energy).' : 'The Science Lab is closed until Day 6.';
    case 'greenhouse': return s.upgrades['greenhouse-lights'] ? null : s.minigames.circuit.solved.length ? 'The Greenhouse has no power. Turn on its lights (15 energy).' : 'No power to the Greenhouse door. Fix the Power Room circuit first.';
    case 'shelter': return s.day >= 7 ? null : 'The Radiation Shelter is sealed. We will open it if we ever need it.';
    case 'comm': return s.upgrades['comm-power'] ? null : s.day >= 9 ? 'The Comm Room door needs power (20 energy).' : 'The Comm Room is offline until the final repair on Day 9.';
    default: return null;
  }
}

/** The room a bulkhead door leads into, seen from the Command Center (the Lab sits left of the Airlock). */
export function doorRoom(i: number): RoomId {
  return i === 1 ? 'lab' : ROOMS[i].id;
}

const LOCK_UPGRADE: Partial<Record<RoomId, string>> = { lab: 'lab-power', greenhouse: 'greenhouse-lights', comm: 'comm-power' };

/** How bright each room is (0 dark .. 1 fully lit) and whether its alarm light flashes. */
function roomLight(id: RoomId, s: GameState): { level: number; alarm: boolean } {
  switch (id) {
    case 'airlock': return { level: 0.8, alarm: false };
    case 'workshop': return { level: s.upgrades['workshop-lights'] ? 1 : 0.35, alarm: false };
    case 'command': return { level: s.minigames.circuit.solved.length ? 1 : 0.6, alarm: !s.minigames.oxygen.solved.length };
    case 'power': return { level: s.minigames.circuit.solved.length ? 1 : 0.3, alarm: !s.minigames.circuit.solved.length };
    case 'life': return { level: s.minigames.oxygen.solved.length ? 1 : 0.5, alarm: !s.minigames.oxygen.solved.length };
    case 'greenhouse': return { level: s.upgrades['greenhouse-lights'] ? 1 : 0.2, alarm: false };
    case 'lab': return { level: s.upgrades['lab-power'] ? 1 : 0.2, alarm: false };
    case 'shelter': return { level: s.upgrades['shelter-shield'] ? 1 : 0.55, alarm: s.day === 7 && !s.flags.shelterDone };
    case 'comm': return { level: s.upgrades['comm-power'] ? 1 : 0.2, alarm: false };
  }
}

const CABLES: { id: string; room: RoomId; x: number }[] = [
  { id: 'cw', room: 'workshop', x: 88 },
  { id: 'cp', room: 'power', x: 80 },
  { id: 'cl', room: 'life', x: 112 },
];

const TANKS: { id: string; room: RoomId; x: number }[] = [
  { id: 'tw', room: 'workshop', x: 138 },
  { id: 'tl', room: 'life', x: 166 },
  { id: 'tg', room: 'greenhouse', x: 166 },
];

const rx = (room: RoomId, x: number) => ROOM_INDEX[room] * ROOM_W + x;

export class BaseScene implements Scene {
  kind = 'base' as const;
  width = ROOMS.length * ROOM_W;
  private bg: HTMLCanvasElement[] = ROOMS.map((_, i) => bakeRoom(i));
  private dark: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private t = 0;
  solids: Solids = {
    solid: (tx: number, ty: number) => {
      if (tx <= 0 || tx >= COLS - 1) return true;
      if (ty >= 13 || ty <= 3) return true;
      if (tx % 15 === 0) {
        if (ty <= 7) return true;
        return !!roomLock(doorRoom(tx / 15), getState());
      }
      return false;
    },
  };

  constructor() {
    [this.dark, this.dctx] = makeCanvas(VIEW_W, VIEW_H);
  }

  enter(w: World, from: 'start' | 'door'): void {
    const s = getState();
    const x = from === 'door' ? rx('airlock', 150) : s.baseX > 0 ? s.baseX : rx('command', 150);
    w.player.place(x, FLOOR_Y);
    w.player.state = 'idle';
    w.nova.x = x - 30;
    w.nova.y = FLOOR_Y - 34;
  }

  areaName(x: number): string {
    const i = clamp(Math.floor(x / ROOM_W), 0, ROOMS.length - 1);
    return ROOMS[i].name;
  }

  music(): 'day' | 'night' | 'tense' {
    const s = getState();
    return s.day === 5 || (s.day === 7 && !s.flags.shelterDone) ? 'tense' : 'day';
  }

  dishX(): number {
    return rx('comm', 160);
  }

  update(w: World, dt: number): void {
    this.t += dt;
    const s = getState();
    // remember position for saving (silent)
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) update((st) => { st.baseX = w.player.cx; }, { silent: true });
    // sparks from loose cables and broken circuit
    for (const c of CABLES) {
      if (s.flags[`cable:${c.id}`]) continue;
      if (Math.random() < dt * 3) w.particles.burst(rx(c.room, c.x), FLOOR_Y - 4, '#ffe08a', 3, 50, { glow: true });
    }
    if (!s.minigames.oxygen.solved.length && Math.random() < dt * 8) {
      w.particles.add({ x: rx('life', 130), y: 152, vx: 30 + Math.random() * 40, vy: -10 + Math.random() * 20, max: 0.8, color: '#dff8ff', fade: true, size: 2 });
    }
    if (!s.minigames.circuit.solved.length && Math.random() < dt * 2) w.particles.burst(rx('power', 180), 140, '#ffe08a', 4, 60, { glow: true });
    // storm dust against windows
    if (s.day === 5 && Math.random() < dt * 2) w.shake(0.15);
  }

  // ----------------------------------------------------------------- drawing
  drawBack(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    const s = getState();
    // sky above the roof
    const g = ctx.createLinearGradient(0, 0, 0, ROOF_Y);
    g.addColorStop(0, s.day === 5 ? '#6a3a2a' : '#3a2a5a');
    g.addColorStop(1, s.day === 5 ? '#b0603a' : '#c47a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, ROOF_Y);
    const i0 = Math.max(0, Math.floor(camX / ROOM_W)), i1 = Math.min(ROOMS.length - 1, Math.floor((camX + VIEW_W) / ROOM_W));
    for (let i = i0; i <= i1; i++) {
      const x0 = i * ROOM_W - camX;
      ctx.drawImage(this.bg[i], Math.round(x0), 0);
      this.drawWindows(ctx, i, x0, s);
      this.drawDynamic(w, ctx, i, x0, s);
    }
    // bulkheads and doors
    for (let i = 1; i < ROOMS.length; i++) {
      const x = i * ROOM_W - camX;
      if (x < -20 || x > VIEW_W + 20) continue;
      this.drawDoor(ctx, Math.round(x), roomLock(doorRoom(i), s), ROOMS[i]);
    }
  }

  private drawWindows(ctx: CanvasRenderingContext2D, i: number, x0: number, s: GameState): void {
    const room = ROOMS[i];
    for (const win of room.windows) {
      const x = Math.round(x0 + win.x);
      if (s.day === 5) {
        // storm outside: churning dust
        ctx.fillStyle = '#8a4a2a';
        ctx.fillRect(x, win.y, win.w, win.h);
        for (let k = 0; k < 14; k++) {
          const yy = win.y + ((k * 7 + this.t * 60 * (1 + (k % 3))) % win.h);
          ctx.fillStyle = k % 2 ? '#c27a4a' : '#6a3420';
          ctx.fillRect(x + ((k * 23 + Math.floor(this.t * 200)) % win.w), Math.round(yy), 6, 1);
        }
      } else if (s.day === 7 && !s.flags.shelterDone) {
        ctx.fillStyle = `rgba(255,220,120,${0.15 + 0.1 * Math.sin(this.t * 6)})`;
        ctx.fillRect(x, win.y, win.w, win.h);
      }
      if (room.id === 'comm') {
        // antenna dish seen through the window
        const fixed = s.minigames.antenna.solved.length > 0;
        const dx = x + win.w - 26, dy = win.y + win.h;
        line(ctx, dx, dy, dx, dy - 18, '#6d7690', 2);
        if (fixed) {
          disc(ctx, dx - 2, dy - 24, 8, '#c3c9da');
          disc(ctx, dx - 1, dy - 23, 5, '#8f99b3');
          px(ctx, dx - 6, dy - 28, Math.floor(this.t * 3) % 2 ? '#5ff3ff' : '#ffffff');
        } else {
          line(ctx, dx, dy - 18, dx + 10, dy - 12, '#c3c9da', 3);
        }
      }
    }
    void windowLandscape;
  }

  private drawDoor(ctx: CanvasRenderingContext2D, x: number, locked: string | null, room: { accent: string }): void {
    rect(ctx, x, CEIL_Y, 16, 64, '#262a40');
    rect(ctx, x + 1, CEIL_Y, 1, 64, '#5a6080');
    rect(ctx, x, 128, 16, 2, '#5a6080');
    if (locked) {
      rect(ctx, x + 2, 130, 12, 78, '#5a6080');
      for (let y = 136; y < 208; y += 10) rect(ctx, x + 3, y, 10, 1, '#3d4466');
      rect(ctx, x + 4, 114, 8, 6, '#1e2236');
      rect(ctx, x + 5, 115, 6, 4, Math.floor(this.t * 2) % 2 ? '#ff4d6d' : '#8a1a2a');
    } else {
      rect(ctx, x + 2, 130, 12, 3, '#5a6080');
      rect(ctx, x + 4, 114, 8, 6, '#1e2236');
      rect(ctx, x + 5, 115, 6, 4, '#3dff8a');
      rect(ctx, x, 206, 16, 2, room.accent);
    }
  }

  private drawDynamic(w: World, ctx: CanvasRenderingContext2D, i: number, x0: number, s: GameState): void {
    const room = ROOMS[i];
    const X = (x: number) => Math.round(x0 + x);
    const t = this.t;
    switch (room.id) {
      case 'lab':
        if (s.upgrades['lab-power'] && Math.floor(t * 2) % 2) px(ctx, X(70), 150, '#5ff3ff');
        if (s.upgrades['lab-power']) { rect(ctx, X(180), 146, 4, 2, '#c48cff'); for (let k = 0; k < 3; k++) rect(ctx, X(182), 150 + k * 4, 20 + ((Math.floor(t * 3) + k) % 3) * 4, 1, '#c48cff'); }
        break;
      case 'airlock':
        if (!s.inventory.spacesuit) {
          // suit hanging in the locker
          ctx.drawImage(w.spr.astro.idle[0], X(30), 150);
        }
        for (let k = 0; k < 5; k++) {
          const have = ['spacesuit', 'o2tank', 'battery', 'radio', 'scanner'].map((g) => (s.inventory[g] ?? 0) > 0)[k];
          rect(ctx, X(184), 124 + k * 6, 3, 3, have ? '#3dff8a' : '#ff4d6d');
        }
        // weather terminal (simulated readings, inspired by NASA's MEDA)
        rect(ctx, X(220), 148, 18, 14, '#1e2236'); rect(ctx, X(221), 149, 16, 12, '#0b1020');
        for (let k = 0; k < 3; k++) rect(ctx, X(223), 151 + k * 3, 4 + ((Math.floor(t * 2) + k) % 3) * 3, 1, k === 1 ? '#ffd43b' : '#43d9ff');
        rect(ctx, X(228), 162, 2, 46, '#454c63');
        if (s.day === 5) {
          rect(ctx, X(84), 146, 72, 8, s.flags.airlockSealed ? '#3dff8a' : '#ff4d6d');
          drawText(ctx, s.flags.airlockSealed ? 'SEALED' : 'UNSEALED', X(120), 147, { align: 'center', color: '#1e2236', shadow: null });
        }
        break;
      case 'workshop':
        if (!s.inventory.radio) { rect(ctx, X(122), 148, 8, 12, '#4c5068'); rect(ctx, X(123), 150, 6, 3, '#3dff8a'); line(ctx, X(128), 148, X(129), 143, '#c3c9da'); }
        rect(ctx, X(156), 144, 34, 20, s.upgrades['workshop-lights'] ? '#3a1e06' : '#1a0e04');
        drawText(ctx, 'UPGRADE', X(173), 147, { align: 'center', color: '#ff8a3d', shadow: null });
        drawText(ctx, `${s.energy}`, X(173), 156, { align: 'center', color: '#ffd43b', shadow: null });
        break;
      case 'command': {
        // big status screen
        const sig = s.minigames.antenna.solved.length > 0;
        if (sig) {
          drawText(ctx, 'EARTH LINK', X(146), 88, { align: 'center', color: '#3dff8a', shadow: null });
          for (let k = 0; k < 5; k++) rect(ctx, X(122 + k * 10), 118 - k * 4, 6, 4 + k * 4, '#3dff8a');
        } else {
          for (let k = 0; k < 40; k++) px(ctx, X(98 + Math.random() * 96), 78 + Math.random() * 50, Math.random() < 0.5 ? '#3a4a6a' : '#1a2a4a');
          if (Math.floor(t * 2) % 2 === 0) drawText(ctx, 'NO SIGNAL', X(146), 98, { align: 'center', color: '#ff4d6d', shadow: null });
        }
        // computer screen text
        drawText(ctx, 'SYS', X(130), 146, { align: 'center', color: '#43d9ff', shadow: null });
        const fixedCount = (['circuit', 'oxygen', 'solar', 'antenna'] as const).filter((k) => s.minigames[k].solved.length).length;
        for (let k = 0; k < 4; k++) rect(ctx, X(116 + k * 8), 156, 6, 4, k < fixedCount ? '#3dff8a' : '#ff4d6d');
        // resource console bars
        const bars = [s.energy / 100, s.oxygen / 100, s.water / 100, s.food / 100];
        const cols = ['#ffd43b', '#43d9ff', '#3a8dff', '#5ccf5c'];
        bars.forEach((v, k) => rect(ctx, X(168 + k * 5), 162 - Math.round(18 * clamp(v, 0, 1)), 3, Math.round(18 * clamp(v, 0, 1)), cols[k]));
        // mission board pins
        const pins = [1, 2, 3, 4, 5, 6].map((k) => k <= s.claimed.length);
        pins.forEach((p, k) => rect(ctx, X(32 + (k % 3) * 16), 140 + Math.floor(k / 3) * 12, 10, 8, p ? '#3dff8a' : '#ffd43b'));
        // research desk with scanner
        rect(ctx, X(76), 182, 26, 4, '#6d7690');
        rect(ctx, X(78), 186, 3, 22, '#454c63'); rect(ctx, X(97), 186, 3, 22, '#454c63');
        if (!s.inventory.scanner) ctx.drawImage(w.spr.icons.scanner, X(82), 170);
        if (dayComplete(s) && s.phase === 'play') {
          if (Math.floor(t * 2) % 2 === 0) drawText(ctx, 'ZZZ', X(217), 150, { align: 'center', color: '#ffd43b' });
        }
        break;
      }
      case 'power': {
        const on = s.minigames.circuit.solved.length > 0;
        for (let k = 0; k < 3; k++) {
          const lvl = clamp(s.energy / 120, 0, 1);
          const filled = Math.round(5 * lvl);
          for (let j = 0; j < 5; j++) rect(ctx, X(21 + k * 22), 194 - j * 14, 12, 8, j < filled ? '#ffd43b' : '#2a2a1a');
        }
        // generator rotor
        const a = on ? t * 6 : 0;
        for (let k = 0; k < 4; k++) line(ctx, X(120), 168, X(120 + Math.cos(a + k * Math.PI / 2) * 16), 168 + Math.sin(a + k * Math.PI / 2) * 16, on ? '#ffd43b' : '#6d7690', 2);
        disc(ctx, X(120), 168, 4, on ? '#ffe08a' : '#4c5068');
        // circuit panel state
        for (let k = 0; k < 4; k++) line(ctx, X(166), 124 + k * 9, X(194), 124 + k * 9 + (on ? 0 : (k % 2 ? 4 : -4)), on ? '#ffd43b' : '#6d7690', 2);
        // charger
        rect(ctx, X(216), 178, 12, 6, s.inventory.battery ? '#3dff8a' : on ? '#ffd43b' : '#2a2a1a');
        if (s.day === 5) { drawText(ctx, 'STORM', X(120), 130, { align: 'center', color: '#ff8a3d' }); drawText(ctx, 'PLAN', X(120), 139, { align: 'center', color: '#ff8a3d' }); }
        break;
      }
      case 'life': {
        const on = s.minigames.oxygen.solved.length > 0;
        drawText(ctx, on ? 'O2 OK' : 'LEAK!', X(69), 120, { align: 'center', color: on ? '#3dff8a' : Math.floor(t * 3) % 2 ? '#ff4d6d' : '#ffd43b', shadow: null });
        rect(ctx, X(44), 132, Math.round(50 * s.oxygen / 100), 4, '#43d9ff');
        const a = on ? t * 10 : t * 0.5;
        for (let k = 0; k < 3; k++) line(ctx, X(140), 180, X(140 + Math.cos(a + k * 2.09) * 14), 180 + Math.sin(a + k * 2.09) * 14, '#8f99b3', 3);
        disc(ctx, X(140), 180, 3, '#c3c9da');
        if (on) for (let k = 0; k < 3; k++) if (!s.inventory.o2tank || k > 0) { rect(ctx, X(184 + k * 13), 176, 8, 26, '#43d9ff'); rect(ctx, X(184 + k * 13), 176, 2, 26, '#bff6ff'); }
        break;
      }
      case 'greenhouse': {
        const lit = !!s.upgrades['greenhouse-lights'];
        const grown = s.minigames.greenhouse.solved.length;
        const healthy = grown ? 2 : lit ? 1 : 0;
        for (let k = 0; k < 3; k++) {
          const bx = 18 + k * 56;
          if (lit) { rect(ctx, X(bx + 4), 123, 40, 2, '#ff6fd8'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,111,216,0.07)'; ctx.fillRect(X(bx + 4), 125, 40, 55); ctx.restore(); }
          for (let p = 0; p < 4; p++) this.plant(ctx, X(bx + 8 + p * 11), 180, healthy, p + k);
        }
        // water level
        const lvl = clamp(s.water / 100, 0, 1);
        rect(ctx, X(196), 132 + Math.round(72 * (1 - lvl)), 28, Math.round(72 * lvl), '#3a8dff');
        rect(ctx, X(196), 132 + Math.round(72 * (1 - lvl)), 28, 1, '#9fd0ff');
        break;
      }
      case 'shelter': {
        for (let k = 0; k < 3; k++) if (s.flags[`slot:${k}`]) { rect(ctx, X(30 + k * 52), 126, 32, 50, '#3a8dff'); rect(ctx, X(30 + k * 52), 126, 32, 3, '#9fd0ff'); rect(ctx, X(34 + k * 52), 132, 4, 40, '#9fd0ff'); }
        rect(ctx, X(190), 118, 26, 28, s.upgrades['shelter-shield'] ? '#0f3a2a' : '#2a0f1a');
        drawText(ctx, 'SHIELD', X(203), 122, { align: 'center', color: s.upgrades['shelter-shield'] ? '#3dff8a' : '#ff4d6d', shadow: null });
        drawText(ctx, s.upgrades['shelter-shield'] ? 'ON' : 'OFF', X(203), 134, { align: 'center', color: s.upgrades['shelter-shield'] ? '#3dff8a' : '#ff4d6d', shadow: null });
        if (s.upgrades['shelter-shield'] && w.cine?.name === 'radiation') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(122,168,255,${0.12 + 0.08 * Math.sin(t * 8)})`;
          ctx.fillRect(X(0), CEIL_Y, ROOM_W, FLOOR_Y - CEIL_Y);
          ctx.restore();
        }
        break;
      }
      case 'comm': {
        const on = !!s.upgrades['comm-power'];
        const fixed = s.minigames.antenna.solved.length > 0;
        for (let x = 0; x < 50; x++) {
          const y = 153 + Math.round(Math.sin(x * 0.4 + t * 8) * (fixed ? 6 : 2) + (fixed ? 0 : (Math.random() - 0.5) * 8));
          if (on) px(ctx, X(32 + x), y, fixed ? '#3dff8a' : '#b49cff');
        }
        for (let k = 0; k < 5; k++) rect(ctx, X(112), 150 + k * 10, s.upgrades.transmitter ? 26 : 6, 2, s.upgrades.transmitter ? '#5ff3ff' : '#454c63');
        // data link terminal
        rect(ctx, X(188), 160, 24, 18, '#1e2236'); rect(ctx, X(189), 161, 22, 14, '#0b1020');
        if (on && fixed) { for (let k = 0; k < 3; k++) rect(ctx, X(191), 163 + k * 4, 6 + ((Math.floor(t * 3) + k) % 4) * 3, 2, s.transmitted.length ? '#3dff8a' : '#5ff3ff'); }
        rect(ctx, X(186), 178, 28, 3, '#6d7690'); rect(ctx, X(198), 181, 4, 27, '#454c63');
        break;
      }
    }
    // loose cables
    for (const c of CABLES) {
      if (c.room !== room.id) continue;
      const x = X(c.x);
      if (s.flags[`cable:${c.id}`]) { line(ctx, x - 10, 206, x + 10, 206, '#ffd43b', 2); continue; }
      line(ctx, x - 12, 206, x - 2, 196, '#1a1d2e', 2);
      line(ctx, x + 12, 206, x + 3, 199, '#1a1d2e', 2);
      px(ctx, x - 2, 195, '#ffd43b'); px(ctx, x + 3, 198, '#ff8a3d');
    }
    // water containers on Day 7
    if (s.day === 7) {
      for (const tk of TANKS) {
        if (tk.room !== room.id || s.flags[`tank:${tk.id}`]) continue;
        ctx.drawImage(w.spr.icons.water_container, X(tk.x - 6), 196);
        if (Math.floor(t * 2) % 2) px(ctx, X(tk.x), 192, '#ffffff');
      }
    }
  }

  private plant(ctx: CanvasRenderingContext2D, x: number, y: number, health: number, seed: number): void {
    if (health === 0) {
      line(ctx, x, y, x + 1, y - 6, '#6a5a3a');
      line(ctx, x + 1, y - 6, x + 4, y - 4, '#8a7a4a');
      return;
    }
    const h = health === 2 ? 14 + (seed % 3) * 2 : 8;
    const g = health === 2 ? '#5ccf5c' : '#a8b84a';
    line(ctx, x, y, x, y - h, health === 2 ? '#2f8a3a' : '#7a8a3a');
    for (let k = 3; k < h; k += 4) {
      rect(ctx, x - 3, y - k, 3, 2, g);
      rect(ctx, x + 1, y - k - 2, 3, 2, g);
    }
    if (health === 2 && seed % 2 === 0) rect(ctx, x - 1, y - h - 2, 3, 3, '#ff6b6b');
  }

  drawFront(w: World, ctx: CanvasRenderingContext2D, camX: number): void {
    const s = getState();
    // per-room lighting
    const d = this.dctx;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    const i0 = Math.max(0, Math.floor(camX / ROOM_W)), i1 = Math.min(ROOMS.length - 1, Math.floor((camX + VIEW_W) / ROOM_W));
    let anyDark = false;
    for (let i = i0; i <= i1; i++) {
      const L = roomLight(ROOMS[i].id, s);
      const x0 = i * ROOM_W - camX;
      let lvl = L.level;
      if (L.level < 1 && Math.random() < 0.02) lvl *= 0.7; // flicker
      const a = (1 - lvl) * 0.85;
      if (a > 0.01) {
        anyDark = true;
        d.fillStyle = `rgba(8,6,22,${a})`;
        d.fillRect(Math.round(x0), CEIL_Y - 10, ROOM_W, FLOOR_Y - CEIL_Y + 26);
      }
      if (L.alarm) {
        const on = Math.sin(this.t * 4) > 0.2;
        if (on) { d.fillStyle = 'rgba(255,40,60,0.16)'; d.fillRect(Math.round(x0), CEIL_Y - 10, ROOM_W, FLOOR_Y - CEIL_Y + 26); }
        rect(ctx, Math.round(x0 + 120 - 4), CEIL_Y + 1, 8, 4, on ? '#ff4d6d' : '#5a1a2a');
      }
    }
    if (anyDark) {
      // helmet lamp and NOVA light cut holes in the darkness
      d.globalCompositeOperation = 'destination-out';
      for (const [lx, ly, r] of [[w.player.cx - camX + w.player.facing * 10, w.player.body.y + 8, 60], [w.nova.x - camX, w.nova.y, 36]] as [number, number, number][]) {
        const g = d.createRadialGradient(lx, ly, 0, lx, ly, r);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g;
        d.fillRect(lx - r, ly - r, r * 2, r * 2);
      }
      ctx.drawImage(this.dark, 0, 0);
    }
    // warm light glow in powered rooms
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = i0; i <= i1; i++) {
      if (roomLight(ROOMS[i].id, s).level < 1) continue;
      for (const lx of [60, 180]) {
        const x = i * ROOM_W + lx - camX;
        const g = ctx.createLinearGradient(0, CEIL_Y + 4, 0, FLOOR_Y);
        g.addColorStop(0, 'rgba(255,190,110,0.10)');
        g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 10, CEIL_Y + 5);
        ctx.lineTo(x + 10, CEIL_Y + 5);
        ctx.lineTo(x + 40, FLOOR_Y);
        ctx.lineTo(x - 40, FLOOR_Y);
        ctx.fill();
      }
    }
    ctx.restore();
    // room name plates on the roof
    const i = clamp(Math.floor(w.player.cx / ROOM_W), 0, ROOMS.length - 1);
    void i;
  }

  // ----------------------------------------------------------------- interactions
  interactables(w: World): Interactable[] {
    const s = getState();
    const L: Interactable[] = [];
    const add = (room: RoomId, x: number, label: string, action: () => void, opts: Partial<Interactable> = {}) =>
      L.push({ id: `${room}:${label}`, x: rx(room, x), y: FLOOR_Y, w: 30, h: 50, label, action, ...opts });
    const repair = () => w.player.act('repair', 0.8);

    // locked doors
    for (let i = 1; i < ROOMS.length; i++) {
      const id = doorRoom(i);
      const reason = roomLock(id, s);
      if (!reason) continue;
      L.push({
        id: `door:${id}`, x: i * ROOM_W + 8, y: FLOOR_Y, w: 18, h: 78, label: 'LOCKED DOOR',
        action: () => {
          const up = LOCK_UPGRADE[id];
          const u = up ? UPGRADE_BY_ID[up] : null;
          if (u && !u.locked(s)) {
            ask(reason, 'thinking', [
              { label: `Power it (${u.cost} energy)`, disabled: s.energy < u.cost, note: s.energy < u.cost ? `You have ${s.energy}` : undefined, action: () => { if (buyUpgrade(u.id)) say('Door open! Power is flowing.', 'celebrating'); } },
              { label: 'Not now', action: () => {} },
            ]);
          } else say(reason, 'thinking');
        },
      });
    }

    // ---- science lab
    add('lab', 60, 'ROCK ANALYZER', () => withScience('analyzer', () => openModal({ kind: 'analyzer' })));
    add('lab', 128, 'SAMPLE CACHE', () => {
      const n = samplesAnalyzed(s);
      say(n ? `${n} analyzed sample${n > 1 ? 's are' : ' is'} sealed in here. Physical samples stay on Mars — we only send data to Earth.` : 'Sealed containers for our rock samples, so they don\'t get mixed up or contaminated.', 'happy');
      if (s.flags.stormFreezer) say('The freezer kept everything safe during the storm. Good choice!', 'happy');
    });
    add('lab', 196, 'RESEARCH JOURNAL', () => openModal({ kind: 'journal' }));

    // ---- airlock
    add('airlock', 42, s.inventory.spacesuit ? 'SUIT LOCKER' : 'TAKE SPACESUIT', () => {
      if (!s.inventory.spacesuit) { addItem('spacesuit'); toast('Got: Spacesuit'); say('Your spacesuit! It keeps you warm and gives you air pressure outside.', 'happy'); }
      else say('The locker is empty now. You are wearing the suit.', 'happy');
    });
    add('airlock', 120, 'OUTER HATCH', () => this.hatch(w), { w: 60 });
    add('airlock', 198, 'GEAR CHECKLIST', () => openModal({ kind: 'checklist' }));
    add('airlock', 228, 'WEATHER TERMINAL', () => withScience('weather', () => openModal({ kind: 'weather' })), { w: 18 });

    // ---- workshop
    if (!s.inventory.radio) add('workshop', 124, 'TAKE RADIO', () => { addItem('radio'); toast('Got: Communication Device'); say('With this radio I can talk to you when you are outside.', 'happy'); });
    add('workshop', 58, 'WORKBENCH', () => say('Spare parts and tools. Engineers fix things by testing one small change at a time.', 'thinking'));
    add('workshop', 173, 'UPGRADE BASE', () => openModal({ kind: 'upgrades' }));
    add('workshop', 217, 'ROBOT DOCK', () => say('My charging dock! I recharge here at night. It tickles.', 'celebrating'));

    // ---- command center
    add('command', 50, 'MISSION BOARD', () => openModal({ kind: 'board' }), { w: 50 });
    add('command', 89, s.inventory.scanner ? 'RESEARCH DESK' : 'TAKE SCANNER', () => {
      if (!s.inventory.scanner) { addItem('scanner'); toast('Got: Research Scanner'); say('The research scanner! Hold E next to something interesting to study it.', 'curious'); }
      else say('The research desk. Our discoveries are saved in the Research Journal.', 'happy');
    }, { w: 20 });
    add('command', 130, 'CENTRAL COMPUTER', () => {
      const first = !s.flags.ccComputer;
      update((st) => { st.flags.ccComputer = true; });
      w.nova.scan = 1;
      const broken: string[] = [];
      if (!s.minigames.oxygen.solved.length) broken.push('an oxygen leak');
      if (!s.minigames.circuit.solved.length) broken.push('broken power cables');
      if (!s.minigames.solar.solved.length) broken.push('dusty solar panels');
      if (!s.minigames.antenna.solved.length) broken.push('no signal to Earth');
      if (broken.length) say(`Systems report: ${broken.join(', ')}.`, first ? 'worried' : 'thinking');
      else say('Systems report: everything is working! ARES-7 is healthy.', 'celebrating');
      if (first) say('The most important problem is the oxygen leak. Let\'s check the Mission Board.', 'thinking');
    });
    add('command', 177, 'ENERGY RESERVES', () => {
      update((st) => { st.flags.energyChecked = true; });
      openModal({ kind: 'resources' });
    });
    add('command', 217, 'SLEEP POD', () => {
      if (dayComplete(s)) {
        ask(`Everything for Day ${s.day} is done. Sleep and start the next day?`, 'happy', [
          { label: 'Yes, end the day', action: () => nextDay() },
          { label: 'Not yet', action: () => {} },
        ]);
      } else {
        const next = dayDef(s.day).objectives.find((o) => !o.done(s));
        say(`Not sleepy yet! We still need to: ${next?.text ?? 'finish today\'s work'}.`, 'thinking');
      }
    });

    // ---- power room
    add('power', 40, s.day === 2 && !s.flags['chk:power'] ? 'BATTERIES - SYSTEM CHECK' : 'BATTERIES', () => {
      if (s.day === 2 && !s.flags['chk:power']) { this.systemQuiz('power'); return; }
      say(`Our batteries hold ${s.energy} energy. Every machine we switch on uses some.`, 'thinking');
    });
    const gridAlert = s.day === 2 && !s.flags.powerGrid;
    add('power', 120, s.day === 5 ? 'STORM POWER PLAN' : gridAlert ? 'POWER DISTRIBUTION' : 'GENERATOR', () => {
      if (s.day === 5) openModal({ kind: 'stormplan' });
      else if (gridAlert) {
        say('Here is the fault! The cable that carries power to Life Support and the Command Center has come loose.', 'worried');
        say('Power distribution means sending electricity from the batteries to every room. Let\'s reroute it so BOTH rooms get power!', 'thinking', 'NOVA', () => openModal({ kind: 'powergrid' }));
      }
      else say(s.minigames.circuit.solved.length ? 'The generator spreads power to every room.' : 'The generator is spinning down. The circuit panel is broken.', 'thinking');
    });
    add('power', 180, 'CIRCUIT PANEL', () => openModal({ kind: 'launcher', id: 'circuit' }));
    add('power', 222, 'BATTERY CHARGER', () => {
      if (s.inventory.battery) { say('Your expedition battery is full.', 'happy'); return; }
      if (!s.minigames.circuit.solved.length) { say('The charger has no power. Fix the circuit panel first.', 'worried'); return; }
      ask('Charge a battery for your trips outside? It costs 10 energy.', 'thinking', [
        { label: 'Charge it (10 energy)', disabled: s.energy < 10, action: () => { if (buyUpgrade('battery-charge')) { toast('Got: Battery'); } } },
        { label: 'Not now', action: () => {} },
      ]);
    });

    // ---- life support
    add('life', 69, 'OXYGEN GENERATOR', () => withScience('oxygen', () => openModal({ kind: 'launcher', id: 'oxygen' })), { w: 60 });
    add('life', 140, s.day === 2 && !s.flags['chk:air'] ? 'VENTILATION - SYSTEM CHECK' : 'VENTILATION', () => (s.day === 2 && !s.flags['chk:air'] ? this.systemQuiz('air') : say(s.minigames.oxygen.solved.length ? 'The fan moves fresh air through every room.' : 'The fan is barely turning. The leak keeps the pressure too low.', 'thinking')));
    add('life', 200, s.inventory.o2tank ? 'OXYGEN TANKS' : 'TAKE OXYGEN TANK', () => {
      if (s.inventory.o2tank) { say('Your suit tank refills every time you come back inside.', 'happy'); return; }
      if (!s.minigames.oxygen.solved.length) { say('The tanks are empty. Fix the oxygen generator first.', 'worried'); return; }
      addItem('o2tank'); toast('Got: Oxygen Supply');
    });

    // ---- greenhouse
    add('greenhouse', 70, 'HYDROPONIC PLANTER', () => withScience('greenhouse', () => openModal({ kind: 'launcher', id: 'greenhouse' })), { w: 100 });
    add('greenhouse', 210, 'WATER RECOVERY', () => withScience('water', () => openModal({ kind: 'water' })), { w: 34 });

    // ---- shelter
    for (let k = 0; k < 3; k++) {
      add('shelter', 46 + k * 52, `WATER SLOT ${k + 1}`, () => {
        if (s.flags[`slot:${k}`]) { say('This slot is full of water. Nice and heavy!', 'happy'); return; }
        if (s.carrying !== 'water') { say(s.day === 7 ? 'Bring a water container here. They are in the Workshop, Life Support and Greenhouse.' : 'An empty slot for shielding.', 'thinking'); return; }
        update((st) => { st.flags[`slot:${k}`] = true; st.flags.tanksPlaced = Number(st.flags.tanksPlaced ?? 0) + 1; st.carrying = null; logEvent('repair', 'Placed a water container in the shelter wall', st); });
        audio.play('place');
        repair();
        const n = Number(getState().flags.tanksPlaced);
        say(n >= 3 ? 'All three slots are full! Now power the shield panel.' : `Container placed: ${n} of 3.`, n >= 3 ? 'celebrating' : 'happy');
      }, { w: 40 });
    }
    add('shelter', 204, s.day === 7 && s.upgrades['shelter-shield'] && !s.flags.shelterDone ? 'TAKE COVER' : 'SHIELD PANEL', () => {
      if (s.day !== 7) { say('The shelter is ready if we ever need it again.', 'happy'); return; }
      if (s.flags.shelterDone) { say('The particle storm is over. We are safe!', 'celebrating'); return; }
      if (Number(s.flags.tanksPlaced ?? 0) < 3) { say('First fill all three wall slots with water containers.', 'thinking'); return; }
      if (!s.upgrades['shelter-shield']) {
        ask('Power the shelter shield? It costs 15 energy.', 'thinking', [
          { label: 'Power it (15 energy)', disabled: s.energy < 15, action: () => { if (buyUpgrade('shelter-shield')) say('Shield on! Now sit on the bench and take cover.', 'happy'); } },
          { label: 'Not now', action: () => {} },
        ]);
        return;
      }
      w.player.place(rx('shelter', 204), FLOOR_Y);
      w.startCinematic('radiation');
    }, { w: 50 });

    // ---- comm room
    add('comm', 57, 'RADIO CONSOLE', () => withScience('comm', () => openModal({ kind: 'launcher', id: 'antenna' })), { w: 60 });
    add('comm', 200, 'DATA LINK', () => {
      if (!s.minigames.antenna.solved.length) { say('The data link needs the antenna. Tune the radio console first.', 'thinking'); return; }
      withScience('comm', () => openModal({ kind: 'datalink' }));
    }, { w: 30 });
    add('comm', 127, 'TRANSMITTER', () => {
      if (s.day < 10) { say(s.minigames.antenna.solved.length ? 'The big transmitter is for our final message on Day 10.' : 'First we need the antenna working. Try the radio console.', 'thinking'); return; }
      if (!s.minigames.antenna.solved.length) { say('Fix the antenna signal at the radio console first.', 'thinking'); return; }
      if (!s.upgrades.transmitter) {
        ask('The transmitter needs 40 energy to reach Earth. Power it up?', 'thinking', [
          { label: 'Power it (40 energy)', disabled: s.energy < 40, note: s.energy < 40 ? `You have ${s.energy}. Play a mini-game or finish NOVA tasks.` : undefined, action: () => { if (buyUpgrade('transmitter')) say('The transmitter is humming! Press E again to send the home signal.', 'celebrating'); } },
          { label: 'Not now', action: () => {} },
        ]);
        return;
      }
      ask('Ready to send the home signal to Earth?', 'celebrating', [
        { label: 'Send it!', action: () => w.startCinematic('final') },
        { label: 'Wait a moment', action: () => {} },
      ]);
    }, { w: 46 });

    // ---- cables
    for (const c of CABLES) {
      if (s.flags[`cable:${c.id}`]) continue;
      add(c.room, c.x, 'FIX LOOSE CABLE', () => {
        repair();
        audio.play('mine');
        w.particles.burst(rx(c.room, c.x), FLOOR_Y - 4, '#ffd43b', 10, 60, { glow: true });
        update((st) => { st.flags[`cable:${c.id}`] = true; st.flags.cablesFixed = Number(st.flags.cablesFixed ?? 0) + 1; logEvent('repair', 'Fixed a loose cable', st); });
        const n = Number(getState().flags.cablesFixed);
        say(n >= 3 ? 'That was the last loose cable. No more sparks!' : `Cable fixed! ${3 - n} more to find.`, n >= 3 ? 'celebrating' : 'happy');
      }, { w: 26 });
    }
    // ---- water containers (Day 7)
    if (s.day === 7) {
      for (const tk of TANKS) {
        if (s.flags[`tank:${tk.id}`]) continue;
        add(tk.room, tk.x, 'PICK UP WATER', () => {
          if (s.carrying) { say('Your hands are full! Take this one to the Shelter first.', 'thinking'); return; }
          update((st) => { st.carrying = 'water'; st.flags[`tank:${tk.id}`] = true; });
          audio.play('pickup');
          say('Heavy! Carry it to the Radiation Shelter, right of the Greenhouse.', 'happy');
        }, { w: 20 });
      }
    }
    return L;
  }

  private hatch(w: World): void {
    const s = getState();
    const day = dayDef(s.day);
    if (s.day === 5) {
      if (!s.flags.airlockSealed) {
        ask('The storm is outside! Seal the airlock so dust can\'t get in?', 'worried', [
          { label: 'Seal it', action: () => { update((st) => { st.flags.airlockSealed = true; logEvent('decision', 'Sealed the airlock against the storm', st); }); audio.play('place'); w.shake(0.3); say('Sealed tight!', 'celebrating'); } },
          { label: 'Not yet', action: () => {} },
        ]);
      } else say('The airlock is sealed. Nobody goes out in this storm!', 'happy');
      return;
    }
    if (!day.outside) {
      say(s.day < 4 ? 'We have to fix the inside of the base first. Our first trip outside is on Day 4.' : 'It\'s too dangerous outside today. Let\'s stay in.', 'thinking');
      return;
    }
    openModal({ kind: 'checklist' });
  }

  /** Day 2 System Check: a short question at each inspected system. Only a correct answer ticks it off. */
  systemQuiz(id: 'air' | 'power' | 'weather'): void {
    const s = getState();
    if (s.flags[`chk:${id}`]) return;
    const pass = (text: string, explain: string) => {
      update((st) => { st.flags[`chk:${id}`] = true; logEvent('repair', `System check passed: ${text}`, st); });
      audio.play('complete');
      say(`Correct! ${explain}`, 'celebrating');
      const left = (['air', 'power', 'weather'] as const).filter((k) => k !== id && !getState().flags[`chk:${k}`]);
      if (left.length) say(`Next system check: ${left[0] === 'air' ? 'the VENTILATION fan in Life Support' : left[0] === 'power' ? 'the BATTERIES in the Power Room' : 'the WEATHER TERMINAL in the Airlock'}.`, 'happy');
      else say('System check complete! Every system is inspected. That is how real crews start their day.', 'celebrating');
    };
    const fail = (explain: string) => { audio.play('error'); say(`Not quite. ${explain} Press E here to try again.`, 'thinking'); };
    if (id === 'air') {
      if (!s.minigames.oxygen.solved.length) { say('The ventilation can\'t be checked while air is leaking. Repair the Oxygen Generator first — it\'s in this room.', 'worried'); return; }
      ask('Ventilation check! The fan spreads fresh air. On Earth, about how much of the air we breathe is oxygen?', 'curious', [
        { label: 'About 21%', action: () => pass('ventilation', 'About 21% is oxygen and most of the rest is nitrogen. Our generator keeps the base air like Earth\'s — the air outside on Mars is mostly carbon dioxide.') },
        { label: 'About 78%', action: () => fail('About 78% of Earth\'s air is nitrogen, not oxygen.') },
        { label: '100% oxygen', action: () => fail('Pure oxygen is not what we normally breathe — and it is a fire risk in a closed base.') },
      ]);
    } else if (id === 'power') {
      ask(`Battery check! We have ${s.energy} energy, and life support needs 8 energy every night. If we spent ALL our energy today, what would happen tonight?`, 'thinking', [
        { label: 'Life support would switch off', action: () => pass('batteries', 'That is why engineers always keep a reserve of energy for the night.') },
        { label: 'The batteries refill by magic', action: () => fail('Batteries only refill when something charges them, like solar panels.') },
        { label: 'Solar panels work at night', action: () => fail('Solar panels need sunlight, so they make no power at night.') },
      ]);
    } else {
      ask('Weather check! The terminal showed air pressure of about 730 Pa. On Earth at sea level it is about 101,325 Pa. So the air on Mars is...', 'curious', [
        { label: 'Much thinner than Earth\'s', action: () => pass('weather terminal', 'Mars air has less than 1% of Earth\'s pressure. That\'s why we need sealed rooms and spacesuits.') },
        { label: 'Thicker than Earth\'s', action: () => fail('Compare the numbers: 730 is much smaller than 101,325.') },
        { label: 'About the same', action: () => fail('Compare the numbers: 730 is much smaller than 101,325.') },
      ]);
    }
  }

  waterTank(): void {
    const s = getState();
    if (s.decisions.water) {
      say(s.decisions.water === 'recycler' ? 'The water recycler is cleaning our water every day.' : 'We drilled the frost patch. The tank is fuller, but an untouched research site is now disturbed.', 'thinking');
      return;
    }
    if (s.day < 6) { say(`The tank is ${s.water}% full. We should keep an eye on it.`, 'thinking'); return; }
    ask('Our water is low. How should we get more?', 'thinking', [
      {
        label: 'Build a Water Recycler (20 energy)', note: '+8 water every day. Slow but gentle.', disabled: s.energy < 20,
        action: () => {
          if (buyUpgrade('water-recycler')) {
            decide('water', 'recycler');
            say('Great thinking! On the space station, the water system recovers about 98% of the water — even moisture from breath and sweat!', 'celebrating');
          }
        },
      },
      {
        label: 'Drill the frost patch outside (free)', note: '+35 water now, but it disturbs a research site.',
        action: () => {
          decide('water', 'drill', (st) => { trackUsage('water', Math.min(100, st.water + 35) - st.water, 'Drilled frost patch', st); st.water = Math.min(100, st.water + 35); st.ecosystem -= 30; st.flags.iceDrilled = true; });
          say('We got lots of water fast... but that frost patch was an untouched site that scientists wanted to study.', 'worried');
          say('Sometimes the quickest choice has a hidden cost. Scientists try to keep special places on other planets clean and unspoiled.', 'thinking');
        },
      },
      { label: 'Think about it later', action: () => {} },
    ]);
  }
}

export { gainEnergy };
