export type Canv = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): [Canv, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Thick pixel line (Bresenham with square brush). */
export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, t = 1): void {
  ctx.fillStyle = c;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(x0, y0, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string): void {
  ctx.fillStyle = c;
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      if (x * x + y * y <= r * r) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

/** Remove anti-aliasing: alpha becomes 0 or 255. */
export function crisp(c: Canv): Canv {
  const ctx = c.getContext('2d')!;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 110 ? 255 : 0;
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Add a 1px dark outline around opaque pixels. */
export function outline(c: Canv, color = [18, 14, 34]): Canv {
  const ctx = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const d = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(d.data);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
        const i = (y * w + x) * 4;
        d.data[i] = color[0]; d.data[i + 1] = color[1]; d.data[i + 2] = color[2]; d.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Fill a polygon crisply (no AA). */
export function poly(ctx: CanvasRenderingContext2D, pts: number[], color: string): void {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const [tc, t] = makeCanvas(w, h);
  t.fillStyle = color;
  t.beginPath();
  t.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) t.lineTo(pts[i], pts[i + 1]);
  t.closePath();
  t.fill();
  crisp(tc);
  ctx.drawImage(tc, 0, 0);
}

export function flipped(src: Canv): Canv {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function glowSprite(r: number, rgb: [number, number, number], strength = 1): Canv {
  const [c, ctx] = makeCanvas(r * 2, r * 2);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.55 * strength})`);
  g.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.18 * strength})`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}
