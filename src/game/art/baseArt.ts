import { makeCanvas, rect, px, line, disc, Canv, poly } from './canvas';
import { drawText } from '../font';
import { mulberry32 } from '../rng';
import type { RoomId } from '../../store/types';

type Ctx = CanvasRenderingContext2D;

export const ROOM_W = 240;
export const FLOOR_Y = 208;
export const CEIL_Y = 64;
export const ROOF_Y = 40;

export interface RoomInfo {
  id: RoomId;
  name: string;
  accent: string;
  wall: string;
  windows: { x: number; y: number; w: number; h: number }[];
}

export const ROOMS: RoomInfo[] = [
  { id: 'lab', name: 'SCIENCE LAB', accent: '#c48cff', wall: '#3d3f66', windows: [{ x: 150, y: 84, w: 56, h: 36 }] },
  { id: 'airlock', name: 'AIRLOCK', accent: '#ffd43b', wall: '#3a3f5c', windows: [] },
  { id: 'workshop', name: 'WORKSHOP', accent: '#ff8a3d', wall: '#423f5c', windows: [{ x: 168, y: 82, w: 44, h: 30 }] },
  { id: 'command', name: 'COMMAND CENTER', accent: '#43d9ff', wall: '#38406a', windows: [{ x: 26, y: 80, w: 50, h: 34 }] },
  { id: 'power', name: 'POWER ROOM', accent: '#ffd43b', wall: '#3c3b5e', windows: [] },
  { id: 'life', name: 'LIFE SUPPORT', accent: '#5ff3ff', wall: '#354666', windows: [{ x: 190, y: 82, w: 34, h: 30 }] },
  { id: 'greenhouse', name: 'GREENHOUSE', accent: '#5ccf5c', wall: '#34485a', windows: [{ x: 24, y: 70, w: 200, h: 40 }] },
  { id: 'shelter', name: 'RADIATION SHELTER', accent: '#7aa8ff', wall: '#2f3550', windows: [] },
  { id: 'comm', name: 'COMM ROOM', accent: '#b49cff', wall: '#3a3866', windows: [{ x: 120, y: 78, w: 90, h: 40 }] },
];

export const ROOM_INDEX: Record<RoomId, number> = Object.fromEntries(ROOMS.map((r, i) => [r.id, i])) as Record<RoomId, number>;

/** Exterior landscape painted behind the windows. */
let landscape: Canv | null = null;
export function windowLandscape(): Canv {
  if (landscape) return landscape;
  const [c, ctx] = makeCanvas(480, 80);
  const g = ctx.createLinearGradient(0, 0, 0, 80);
  g.addColorStop(0, '#f3a571');
  g.addColorStop(1, '#ffd2a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, 80);
  disc(ctx, 380, 18, 7, '#fff3d6');
  const r = mulberry32(5);
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#a8492e' : '#d07048';
    let h = 50 + layer * 8;
    for (let x = 0; x < 480; x++) {
      h += (r() - 0.5) * 3;
      h = Math.max(30 + layer * 10, Math.min(68, h));
      ctx.fillRect(x, Math.round(h), 1, 80 - Math.round(h));
    }
  }
  landscape = c;
  return c;
}

function panelWall(ctx: Ctx, wall: string, accent: string): void {
  rect(ctx, 0, CEIL_Y, ROOM_W, FLOOR_Y - CEIL_Y, wall);
  for (let x = 0; x < ROOM_W; x += 32) {
    rect(ctx, x, CEIL_Y, 1, FLOOR_Y - CEIL_Y, '#2a2e48');
    rect(ctx, x + 1, CEIL_Y, 1, FLOOR_Y - CEIL_Y, 'rgba(255,255,255,0.06)');
  }
  rect(ctx, 0, 132, ROOM_W, 1, '#2a2e48');
  rect(ctx, 0, 133, ROOM_W, 1, 'rgba(255,255,255,0.05)');
  // lower wainscot
  rect(ctx, 0, 176, ROOM_W, FLOOR_Y - 176, '#2c3150');
  rect(ctx, 0, 176, ROOM_W, 1, accent);
  for (let x = 6; x < ROOM_W; x += 32) { rect(ctx, x, 184, 3, 3, '#3d4468'); px(ctx, x, 184, '#56608a'); }
}

function ceiling(ctx: Ctx): void {
  // roof hull (cutaway)
  rect(ctx, 0, ROOF_Y, ROOM_W, CEIL_Y - ROOF_Y, '#5a6080');
  rect(ctx, 0, ROOF_Y, ROOM_W, 2, '#9aa0c0');
  rect(ctx, 0, ROOF_Y + 2, ROOM_W, 1, '#c3c9da');
  for (let x = 4; x < ROOM_W; x += 20) px(ctx, x, ROOF_Y + 6, '#8a90b0');
  rect(ctx, 0, CEIL_Y - 10, ROOM_W, 10, '#262a40');
  // pipes along the ceiling
  rect(ctx, 0, CEIL_Y - 8, ROOM_W, 3, '#6d7690');
  rect(ctx, 0, CEIL_Y - 8, ROOM_W, 1, '#9aa3c0');
  rect(ctx, 0, CEIL_Y - 3, ROOM_W, 2, '#8a4a32');
  for (let x = 10; x < ROOM_W; x += 40) rect(ctx, x, CEIL_Y - 9, 3, 6, '#454c63');
  // light fixtures
  for (const x of [60, 180]) {
    rect(ctx, x - 12, CEIL_Y, 24, 3, '#454c63');
    rect(ctx, x - 10, CEIL_Y + 3, 20, 2, '#ffe9b8');
  }
}

function floor(ctx: Ctx): void {
  rect(ctx, 0, FLOOR_Y, ROOM_W, 6, '#3d4466');
  rect(ctx, 0, FLOOR_Y, ROOM_W, 1, '#7d86aa');
  for (let x = 0; x < ROOM_W; x += 4) rect(ctx, x, FLOOR_Y + 2, 2, 3, '#262a40');
  rect(ctx, 0, FLOOR_Y + 6, ROOM_W, 10, '#262a40');
  rect(ctx, 0, FLOOR_Y + 6, ROOM_W, 1, '#1a1d2e');
  // ground below
  rect(ctx, 0, FLOOR_Y + 16, ROOM_W, 270 - FLOOR_Y - 16, '#9a4a2e');
  const r = mulberry32(9);
  for (let i = 0; i < 70; i++) px(ctx, Math.floor(r() * ROOM_W), FLOOR_Y + 17 + Math.floor(r() * 44), r() < 0.5 ? '#7a3620' : '#b85c38');
  for (let x = 14; x < ROOM_W; x += 60) { rect(ctx, x, FLOOR_Y + 16, 6, 18, '#4c5068'); rect(ctx, x - 2, FLOOR_Y + 32, 10, 3, '#3a3d52'); }
}

function windowFrame(ctx: Ctx, w: { x: number; y: number; w: number; h: number }, offset: number): void {
  rect(ctx, w.x - 3, w.y - 3, w.w + 6, w.h + 6, '#1e2236');
  rect(ctx, w.x - 2, w.y - 2, w.w + 4, w.h + 4, '#8a90b0');
  ctx.drawImage(windowLandscape(), offset % 400, 80 - w.h, w.w, w.h, w.x, w.y, w.w, w.h);
  rect(ctx, w.x, w.y, w.w, 1, 'rgba(255,255,255,0.4)');
  line(ctx, w.x + 4, w.y + w.h - 4, w.x + 12, w.y + 4, 'rgba(255,255,255,0.25)');
  if (w.w > 80) for (let x = w.x + 40; x < w.x + w.w; x += 40) rect(ctx, x, w.y, 2, w.h, '#8a90b0');
}

function sign(ctx: Ctx, text: string, x: number, accent: string): void {
  const w = text.length * 6 + 8;
  rect(ctx, x - w / 2, CEIL_Y + 8, w, 11, '#1e2236');
  rect(ctx, x - w / 2, CEIL_Y + 8, w, 1, accent);
  drawText(ctx, text, x, CEIL_Y + 10, { align: 'center', color: accent, shadow: null });
}

function console_(ctx: Ctx, x: number, w: number, screen: string): void {
  rect(ctx, x, 168, w, 40, '#4c5068');
  rect(ctx, x, 168, w, 2, '#7d839e');
  rect(ctx, x + 3, 174, w - 6, 3, '#2e3448');
  for (let i = 0; i < w - 10; i += 5) px(ctx, x + 5 + i, 175, i % 10 ? '#3dff8a' : '#ff8a3d');
  rect(ctx, x + 4, 140, w - 8, 26, '#2e3448');
  rect(ctx, x + 6, 142, w - 12, 22, screen);
  rect(ctx, x + w / 2 - 3, 166, 6, 2, '#2e3448');
}

// ----------------------------------------------------------------------------
// Static room art. Dynamic machines are drawn on top every frame.
// ----------------------------------------------------------------------------
export function bakeRoom(i: number): Canv {
  const room = ROOMS[i];
  const [c, ctx] = makeCanvas(ROOM_W, 270);
  ctx.clearRect(0, 0, ROOM_W, ROOF_Y);
  panelWall(ctx, room.wall, room.accent);
  ceiling(ctx);
  floor(ctx);
  for (const w of room.windows) windowFrame(ctx, w, i * 37);
  const r = mulberry32(i * 13 + 1);
  switch (room.id) {
    case 'lab': {
      sign(ctx, 'SCIENCE LAB', 70, room.accent);
      // bench with microscope
      rect(ctx, 30, 176, 70, 6, '#c3c9da'); rect(ctx, 34, 182, 4, 26, '#6d7690'); rect(ctx, 92, 182, 4, 26, '#6d7690');
      rect(ctx, 54, 158, 10, 18, '#e8e6f2'); rect(ctx, 50, 172, 18, 4, '#8f99b3'); line(ctx, 58, 158, 64, 150, '#e8e6f2', 3); rect(ctx, 63, 148, 4, 4, '#43d9ff');
      for (let k = 0; k < 4; k++) { rect(ctx, 74 + k * 6, 166, 4, 10, '#bff6ff'); rect(ctx, 74 + k * 6, 170, 4, 6, ['#5ccf5c', '#c48cff', '#ff8a3d', '#43d9ff'][k]); }
      // freezer
      rect(ctx, 114, 136, 28, 72, '#d8dcec'); rect(ctx, 114, 136, 28, 2, '#ffffff'); rect(ctx, 116, 170, 24, 1, '#8f99b3');
      rect(ctx, 136, 150, 2, 12, '#6d7690'); rect(ctx, 136, 180, 2, 12, '#6d7690'); drawText(ctx, '-80', 118, 140, { color: '#3a7bff', shadow: null });
      // research terminal
      console_(ctx, 174, 44, '#24104a');
      break;
    }
    case 'airlock': {
      sign(ctx, 'AIRLOCK', 120, room.accent);
      // hazard stripes on floor edge
      for (let x = 0; x < ROOM_W; x += 8) poly(ctx, [x, 206, x + 4, 206, x + 8, 200, x + 4, 200], '#1e2236');
      rect(ctx, 0, 200, ROOM_W, 1, room.accent);
      // big round outer hatch
      disc(ctx, 120, 150, 34, '#2e3448');
      disc(ctx, 120, 150, 30, '#6d7690');
      disc(ctx, 120, 150, 24, '#8f99b3');
      disc(ctx, 120, 150, 10, '#4c5068');
      rect(ctx, 96, 148, 48, 4, '#4c5068');
      rect(ctx, 118, 126, 4, 48, '#4c5068');
      // suit locker
      rect(ctx, 22, 112, 40, 96, '#4c5068'); rect(ctx, 22, 112, 40, 2, '#8f99b3'); rect(ctx, 24, 116, 36, 88, '#262a40');
      // checklist panel
      rect(ctx, 178, 118, 40, 40, '#1e2236'); rect(ctx, 180, 120, 36, 36, '#0d1633');
      for (let k = 0; k < 5; k++) { rect(ctx, 184, 124 + k * 6, 3, 3, '#ffd43b'); rect(ctx, 190, 125 + k * 6, 20, 1, '#5a6080'); }
      break;
    }
    case 'workshop': {
      sign(ctx, 'WORKSHOP', 92, room.accent);
      // tool wall
      rect(ctx, 20, 96, 64, 44, '#2c3150');
      for (let k = 0; k < 6; k++) { const tx = 26 + k * 10; line(ctx, tx, 102, tx, 122 + (k % 3) * 4, '#c3c9da', 2); rect(ctx, tx - 1, 100, 4, 3, ['#ff8a3d', '#ffd43b', '#43d9ff'][k % 3]); }
      // workbench
      rect(ctx, 16, 172, 84, 6, '#8a5a3c'); rect(ctx, 16, 172, 84, 1, '#b07a52'); rect(ctx, 20, 178, 4, 30, '#5a3a2a'); rect(ctx, 92, 178, 4, 30, '#5a3a2a');
      rect(ctx, 30, 164, 14, 8, '#6d7690'); rect(ctx, 50, 166, 20, 6, '#c3c9da'); disc(ctx, 80, 168, 3, '#ffd43b');
      // shelf
      rect(ctx, 104, 140, 40, 3, '#8a5a3c'); rect(ctx, 104, 164, 40, 3, '#8a5a3c');
      rect(ctx, 108, 132, 8, 8, '#ff8a3d'); rect(ctx, 130, 156, 10, 8, '#6d7690');
      // upgrade terminal
      console_(ctx, 150, 46, '#2a1a0a');
      // robot charging dock
      rect(ctx, 204, 196, 26, 12, '#4c5068'); rect(ctx, 204, 196, 26, 2, '#8f99b3'); rect(ctx, 214, 184, 6, 12, '#6d7690'); px(ctx, 216, 186, '#3dff8a');
      break;
    }
    case 'command': {
      sign(ctx, 'COMMAND CENTER', 52, room.accent);
      // big wall screen frame
      rect(ctx, 96, 76, 100, 54, '#1e2236'); rect(ctx, 98, 78, 96, 50, '#0d1633');
      // central computer
      console_(ctx, 104, 52, '#06202a');
      // resource console
      console_(ctx, 162, 30, '#1a1a06');
      // mission board (holo panel on wall left)
      rect(ctx, 24, 124, 56, 44, '#1e2236'); rect(ctx, 26, 126, 52, 40, '#14324a');
      drawText(ctx, 'MISSIONS', 52, 128, { align: 'center', color: '#43d9ff', shadow: null });
      // sleep pod
      rect(ctx, 198, 160, 38, 48, '#4c5068'); rect(ctx, 200, 164, 34, 18, '#1e2236');
      rect(ctx, 202, 166, 30, 14, '#5a7acc'); rect(ctx, 202, 166, 8, 6, '#e8e6f2');
      rect(ctx, 200, 188, 34, 18, '#1e2236'); rect(ctx, 202, 190, 30, 14, '#5a7acc'); rect(ctx, 202, 190, 8, 6, '#e8e6f2');
      break;
    }
    case 'power': {
      sign(ctx, 'POWER ROOM', 120, room.accent);
      // battery racks
      for (let k = 0; k < 3; k++) {
        const bx = 18 + k * 22;
        rect(ctx, bx, 128, 18, 80, '#2e3448'); rect(ctx, bx, 128, 18, 2, '#6d7690');
        for (let j = 0; j < 5; j++) rect(ctx, bx + 3, 134 + j * 14, 12, 10, '#1a1d2e');
      }
      // generator housing
      disc(ctx, 120, 168, 26, '#4c5068'); disc(ctx, 120, 168, 22, '#2e3448'); rect(ctx, 94, 192, 52, 16, '#4c5068');
      // circuit panel box
      rect(ctx, 158, 108, 44, 56, '#1e2236'); rect(ctx, 160, 110, 40, 52, '#2e3448');
      drawText(ctx, 'CIRCUIT', 180, 112, { align: 'center', color: '#ffd43b', shadow: null });
      // charger
      rect(ctx, 210, 172, 24, 36, '#4c5068'); rect(ctx, 214, 176, 16, 10, '#0d1633');
      // floor cables
      for (let k = 0; k < 3; k++) line(ctx, 60 + k * 4, 206, 150, 196 + k, '#1a1d2e', 2);
      break;
    }
    case 'life': {
      sign(ctx, 'LIFE SUPPORT', 100, room.accent);
      // oxygen generator: tall machine with tanks
      rect(ctx, 34, 104, 70, 104, '#4c5068'); rect(ctx, 34, 104, 70, 2, '#8f99b3');
      rect(ctx, 40, 112, 58, 30, '#1e2236');
      for (let k = 0; k < 3; k++) { rect(ctx, 42 + k * 20, 150, 14, 52, '#43d9ff'); rect(ctx, 42 + k * 20, 150, 4, 52, '#bff6ff'); rect(ctx, 44 + k * 20, 146, 10, 4, '#8f99b3'); }
      // pipes to ceiling
      rect(ctx, 104, 120, 60, 6, '#8f99b3'); rect(ctx, 104, 120, 60, 1, '#c3c9da');
      rect(ctx, 158, 64, 6, 62, '#8f99b3');
      rect(ctx, 104, 150, 40, 5, '#8f99b3');
      // vent grille housing
      rect(ctx, 120, 160, 40, 40, '#2e3448'); disc(ctx, 140, 180, 17, '#1a1d2e');
      // tank rack
      rect(ctx, 176, 168, 48, 4, '#6d7690'); rect(ctx, 176, 204, 48, 4, '#6d7690'); rect(ctx, 176, 168, 3, 40, '#6d7690'); rect(ctx, 221, 168, 3, 40, '#6d7690');
      break;
    }
    case 'greenhouse': {
      sign(ctx, 'GREENHOUSE', 120, room.accent);
      // planter beds
      for (let k = 0; k < 3; k++) {
        const bx = 18 + k * 56;
        rect(ctx, bx, 180, 48, 28, '#5a3a2a'); rect(ctx, bx, 180, 48, 3, '#8a5a3c'); rect(ctx, bx + 2, 183, 44, 4, '#3a2418');
        rect(ctx, bx + 4, 120, 40, 3, '#454c63');
      }
      // water tank
      rect(ctx, 192, 128, 36, 80, '#4c5068'); rect(ctx, 196, 132, 28, 72, '#1e2236');
      drawText(ctx, 'H2O', 210, 120, { align: 'center', color: '#43d9ff', shadow: null });
      break;
    }
    case 'shelter': {
      sign(ctx, 'RADIATION SHELTER', 120, room.accent);
      // thick walls
      rect(ctx, 0, CEIL_Y, ROOM_W, 10, '#3d4466');
      for (let k = 0; k < 3; k++) { const sx = 26 + k * 52; rect(ctx, sx, 120, 40, 60, '#262a40'); rect(ctx, sx, 120, 40, 2, '#7aa8ff'); drawText(ctx, `SLOT ${k + 1}`, sx + 20, 184, { align: 'center', color: '#7aa8ff', shadow: null }); }
      // bench
      rect(ctx, 176, 186, 56, 6, '#6d7690'); rect(ctx, 180, 192, 4, 16, '#454c63'); rect(ctx, 224, 192, 4, 16, '#454c63');
      // shield panel
      rect(ctx, 186, 112, 34, 40, '#1e2236'); rect(ctx, 188, 114, 30, 36, '#0d1633');
      break;
    }
    case 'comm': {
      sign(ctx, 'COMM ROOM', 60, room.accent);
      // radio console
      console_(ctx, 22, 70, '#10082a');
      for (let k = 0; k < 4; k++) disc(ctx, 34 + k * 14, 172, 3, '#8f99b3');
      // transmitter cabinet
      rect(ctx, 104, 140, 46, 68, '#4c5068'); rect(ctx, 104, 140, 46, 2, '#8f99b3');
      for (let k = 0; k < 5; k++) rect(ctx, 110, 148 + k * 10, 34, 6, '#2e3448');
      // dish visible through window is dynamic
      rect(ctx, 214, 160, 18, 48, '#2e3448');
      break;
    }
  }
  // grime
  for (let k = 0; k < 40; k++) px(ctx, Math.floor(r() * ROOM_W), CEIL_Y + Math.floor(r() * 140), 'rgba(0,0,0,0.15)');
  return c;
}

/** Exterior view of the base module, used on the planet surface. */
export function bakeBaseExterior(): Canv {
  const [c, ctx] = makeCanvas(260, 120);
  // main module
  rect(ctx, 10, 40, 220, 72, '#c3c9da');
  rect(ctx, 10, 40, 220, 3, '#eef1fa');
  rect(ctx, 10, 104, 220, 8, '#8f99b3');
  for (let x = 30; x < 230; x += 40) rect(ctx, x, 43, 1, 61, '#9aa3c0');
  rect(ctx, 10, 70, 220, 4, '#ff8a3d');
  // dome greenhouse
  disc(ctx, 190, 42, 26, '#9fd8ff');
  rect(ctx, 160, 42, 60, 30, '#c3c9da');
  for (let k = -2; k <= 2; k++) line(ctx, 190 + k * 10, 18 + Math.abs(k) * 3, 190 + k * 13, 42, '#eef1fa');
  // windows
  for (let k = 0; k < 4; k++) { rect(ctx, 30 + k * 30, 52, 14, 10, '#1e2236'); rect(ctx, 31 + k * 30, 53, 12, 8, '#ffcf7a'); }
  // airlock hatch
  rect(ctx, 214, 66, 24, 46, '#8f99b3'); disc(ctx, 226, 86, 9, '#4c5068'); disc(ctx, 226, 86, 6, '#6d7690');
  rect(ctx, 214, 66, 24, 2, '#ffd43b');
  drawText(ctx, 'ARES-7', 70, 82, { color: '#3a3d52', shadow: null });
  // legs
  for (const x of [20, 80, 140, 200]) { rect(ctx, x, 112, 6, 8, '#6d7690'); rect(ctx, x - 3, 118, 12, 2, '#4c5068'); }
  return c;
}
