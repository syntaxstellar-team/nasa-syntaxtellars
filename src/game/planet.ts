import { buildPlanetTexture } from './art/backdrop';
import { makeCanvas } from './art/canvas';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Renders the rotating pixel-art planet Kepler-186f. */
export class PlanetRenderer {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private tex: Uint8ClampedArray;
  private tw = 256;
  private th = 128;
  private map: Float32Array; // per-pixel [u, v, shade] or -1

  constructor(public R: number, palette: 'kepler' | 'mars' = 'mars') {
    const size = R * 2 + 8;
    [this.canvas, this.ctx] = makeCanvas(size, size);
    this.img = this.ctx.createImageData(size, size);
    this.tex = buildPlanetTexture(this.tw, this.th, palette);
    this.map = new Float32Array(size * size * 3).fill(-1);
    const c = size / 2;
    const lx = -0.55, ly = -0.45, lz = 0.7;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - c) / R, ny = (y + 0.5 - c) / R;
      const d = nx * nx + ny * ny;
      const k = (y * size + x) * 3;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      const u = 0.5 + Math.atan2(nx, nz) / (2 * Math.PI);
      const v = 0.5 + Math.asin(ny) / Math.PI;
      const shade = Math.max(0, nx * lx + ny * ly + nz * lz);
      this.map[k] = u; this.map[k + 1] = v; this.map[k + 2] = shade;
    }
  }

  render(rot: number): HTMLCanvasElement {
    const size = this.canvas.width;
    const d = this.img.data;
    const c = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = (y * size + x) * 3;
      const i = (y * size + x) * 4;
      const u = this.map[k];
      if (u < 0) {
        // atmosphere halo
        const dist = Math.hypot(x + 0.5 - c, y + 0.5 - c) / this.R;
        if (dist < 1.06) {
          const a = (1.06 - dist) / 0.06;
          const th = BAYER[(y % 4) * 4 + (x % 4)] / 16;
          if (a > th) { d[i] = 255; d[i + 1] = 180; d[i + 2] = 140; d[i + 3] = 140; continue; }
        }
        d[i + 3] = 0;
        continue;
      }
      const tx = Math.floor(((u + rot) % 1) * this.tw);
      const ty = Math.min(this.th - 1, Math.floor(this.map[k + 1] * this.th));
      const ti = (ty * this.tw + tx) * 3;
      const shade = this.map[k + 2];
      const th = BAYER[(y % 4) * 4 + (x % 4)] / 16;
      // banded, dithered lighting
      const lvl = shade * 3.2 + th * 0.9;
      const f = lvl < 0.55 ? 0.12 : lvl < 1.2 ? 0.38 : lvl < 2.1 ? 0.72 : 1;
      let r = this.tex[ti] * f, g = this.tex[ti + 1] * f, b = this.tex[ti + 2] * f;
      // night side gets a faint violet tint, rim gets atmosphere
      const rim = 1 - Math.sqrt(Math.max(0, 1 - ((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2) / (this.R * this.R)));
      if (rim > 0.72 && shade > 0.05) { r = r * 0.6 + 110; g = g * 0.6 + 90; b = b * 0.6 + 80; }
      if (f <= 0.12) { r += 14; g += 6; b += 30; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

export interface Star { x: number; y: number; z: number; tw: number }

export function makeStars(n: number): Star[] {
  const s: Star[] = [];
  for (let i = 0; i < n; i++) s.push({ x: Math.random(), y: Math.random(), z: Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3, tw: Math.random() * 6 });
  return s;
}

/** Size a canvas to fill its parent at a fixed internal height. */
export function fitCanvas(canvas: HTMLCanvasElement, H: number, minW = 320, maxW = 1000): { W: number; H: number } {
  const parent = canvas.parentElement;
  const cw = parent ? parent.clientWidth : window.innerWidth;
  const ch = parent ? parent.clientHeight : window.innerHeight;
  const W = Math.round(Math.min(maxW, Math.max(minW, (H * cw) / Math.max(1, ch))));
  canvas.width = W;
  canvas.height = H;
  const scale = Math.max(cw / W, ch / H);
  canvas.style.width = `${Math.ceil(W * scale)}px`;
  canvas.style.height = `${Math.ceil(H * scale)}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { W, H };
}
