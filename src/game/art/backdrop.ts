import { makeCanvas, rect, Canv, disc, px } from './canvas';
import { fbm1, hash2, noise2, fbm2 } from '../rng';

/** Wide, horizontally tileable mountain silhouette layer. */
export function buildMountainLayer(seed: number, width: number, height: number, base: number, amp: number, col: string, top: string, crystals: boolean): Canv {
  const [c, ctx] = makeCanvas(width, height);
  for (let x = 0; x < width; x++) {
    // tileable: blend noise sampled at x and x-width
    const t = x / width;
    const n1 = fbm1(x * 0.012, seed, 5);
    const n2 = fbm1((x - width) * 0.012, seed, 5);
    const n = n1 * (1 - t) + n2 * t;
    const peak = Math.abs(Math.sin(x * 0.004 + seed)) * 0.35;
    const h = Math.floor(base - (n + peak) * amp);
    rect(ctx, x, h, 1, height - h, col);
    px(ctx, x, h, top);
    if (x % 3 === 0 && hash2(x, 1, seed) < 0.5) px(ctx, x, h + 1, top);
    if (crystals && hash2(x, 7, seed) < 0.012) {
      const ch = 6 + Math.floor(hash2(x, 3, seed) * 14);
      rect(ctx, x, h - ch, 2, ch, col);
      px(ctx, x, h - ch, top);
    }
  }
  return c;
}

export function buildSkyPlanet(): Canv {
  // ringed gas giant seen in the sky
  const R = 34;
  const [c, ctx] = makeCanvas(R * 4, R * 2 + 20);
  const cx = R * 2, cy = R + 10;
  // back half of ring
  ringPart(ctx, cx, cy, R, true);
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = x * x + y * y;
      if (d > R * R) continue;
      const band = Math.sin((y / R) * 7 + noise2(x * 0.08, y * 0.3, 5) * 2);
      const light = (-x - y * 0.6) / R; // lit from upper-left
      let col = band > 0.3 ? '#b07ad6' : band > -0.4 ? '#8a5cc0' : '#6a46a8';
      if (light < -0.35) col = band > 0 ? '#4d3685' : '#3c2a6b';
      if (light < -0.75) col = '#2a1f4f';
      if (light > 0.55 && (x + y) % 2 === 0) col = '#d3a6f0';
      px(ctx, cx + x, cy + y, col);
    }
  }
  ringPart(ctx, cx, cy, R, false);
  return c;
}

function ringPart(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, back: boolean): void {
  for (let a = 0; a < Math.PI * 2; a += 0.004) {
    const isBack = Math.sin(a) < 0;
    if (isBack !== back) continue;
    for (let rr = R * 1.35; rr < R * 1.85; rr += 1) {
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(cy + Math.sin(a) * rr * 0.22 - Math.cos(a) * rr * 0.12);
      const inside = (x - cx) ** 2 + (y - cy) ** 2 < R * R;
      if (back && inside) continue;
      const band = Math.floor(rr) % 5;
      px(ctx, x, y, band === 0 ? '#5d4a8a' : band === 2 ? '#e0c8ff' : '#a68ad6');
    }
  }
}

export function buildMoon(): Canv {
  const [c, ctx] = makeCanvas(18, 18);
  disc(ctx, 9, 9, 8, '#c9e6ff');
  disc(ctx, 11, 7, 7, 'rgba(0,0,0,0)');
  px(ctx, 6, 6, '#9cc1e6'); px(ctx, 10, 11, '#9cc1e6'); px(ctx, 7, 12, '#9cc1e6');
  return c;
}

/** Sphere texture data for the rotating menu planet. */
export function buildPlanetTexture(w: number, h: number, palette: 'kepler' | 'mars' = 'kepler'): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // tileable horizontally
      const t = x / w;
      const a = fbm2(x * 0.03, y * 0.05, 11, 5);
      const b = fbm2((x - w) * 0.03, y * 0.05, 11, 5);
      const n = a * (1 - t) + b * t;
      const lat = Math.abs(y / h - 0.5) * 2;
      let r: number, g: number, bb: number;
      if (palette === 'mars') {
        if (n > 0.6) { r = 236; g = 150; bb = 100; } // bright dusty highlands
        else if (n > 0.5) { r = 200; g = 96; bb = 58; }
        else if (n > 0.42) { r = 160; g = 70; bb = 44; }
        else { r = 110; g = 48; bb = 40; } // dark basins
        if (lat > 0.84) { r = 245; g = 240; bb = 250; } // ice caps
      } else {
      if (n > 0.58) { r = 70; g = 214; bb = 190; } // teal biolum. continents
      else if (n > 0.5) { r = 74; g = 47; bb = 92; } // purple lowlands
      else if (n > 0.42) { r = 96; g = 72; bb = 160; }
      else { r = 40; g = 34; bb = 98; } // deep violet seas
      if (lat > 0.82) { r = 200; g = 210; bb = 255; }
      }
      const swirl = noise2(x * 0.08, y * 0.4, 99);
      if (swirl > 0.72) { r = (r + 230) / 2; g = (g + 220) / 2; bb = (bb + 255) / 2; }
      const i = (y * w + x) * 3;
      data[i] = r; data[i + 1] = g; data[i + 2] = bb;
    }
  }
  return data;
}
