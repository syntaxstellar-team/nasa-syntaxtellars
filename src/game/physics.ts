import { TILE } from './constants';

export interface Solids {
  solid(tx: number, ty: number): boolean;
}

export interface Body {
  x: number; // left px
  y: number; // top px
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitWallX: boolean;
}

function overlapsSolid(world: Solids, x: number, y: number, w: number, h: number): boolean {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) return true;
  return false;
}

/** Move a body through a tile grid, resolving collisions axis by axis (with optional 1-tile step-up). */
export function moveBody(world: Solids, b: Body, dt: number, stepUp = false): void {
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt) / 6));
  const sdt = dt / steps;
  b.hitWallX = false;
  let grounded = false;
  for (let s = 0; s < steps; s++) {
    const nx = b.x + b.vx * sdt;
    if (!overlapsSolid(world, nx, b.y, b.w, b.h)) {
      b.x = nx;
    } else if (stepUp && b.onGround && !overlapsSolid(world, nx, b.y - TILE - 0.5, b.w, b.h) && !overlapsSolid(world, b.x, b.y - TILE - 0.5, b.w, b.h)) {
      b.y = Math.floor((b.y + b.h) / TILE) * TILE - TILE - b.h;
      b.x = nx;
    } else {
      if (b.vx > 0) b.x = Math.floor((nx + b.w) / TILE) * TILE - b.w - 0.01;
      else if (b.vx < 0) b.x = Math.floor(nx / TILE) * TILE + TILE + 0.01;
      b.vx = 0;
      b.hitWallX = true;
    }
    const ny = b.y + b.vy * sdt;
    if (!overlapsSolid(world, b.x, ny, b.w, b.h)) {
      b.y = ny;
    } else {
      if (b.vy > 0) {
        b.y = Math.floor((ny + b.h) / TILE) * TILE - b.h - 0.01;
        grounded = true;
      } else if (b.vy < 0) {
        b.y = Math.floor(ny / TILE) * TILE + TILE + 0.01;
      }
      b.vy = 0;
    }
  }
  if (!grounded) grounded = overlapsSolid(world, b.x, b.y + 1, b.w, b.h);
  b.onGround = grounded;
}

// ---------------------------------------------------------------- Mars gravity
/** Surface gravity in m/s² (NASA Mars fact sheet: 3.71; Earth: 9.81). */
export const EARTH_G = 9.81;
export const MARS_G = 3.71;
/**
 * Motion scale of the game world: how many pixels of movement stand for one metre when
 * computing acceleration. The original Earth-feel tuning used 900 px/s², so 900 / 9.81.
 * Every falling thing in the world (player, dust particles) uses GRAVITY below, so the
 * whole base and the surface obey the same Mars gravity (≈38% of Earth's).
 */
export const PX_PER_M = 900 / EARTH_G;
export const GRAVITY = MARS_G * PX_PER_M; // ≈ 340 px/s²
/** Push-off speed of a jump (same legs, lower gravity → higher, slower jumps). */
export const JUMP_SPEED = 230; // full jump: apex ≈ 65–78 px (4–5 tiles, Earth tuning gave ≈45), air time ≈ 1.3 s
/** Safety cap for collision stability only; Mars' thin air adds almost no drag. */
export const MAX_FALL = 420;
