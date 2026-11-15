// A tiny original 5x7 bitmap font so every piece of in-game text stays crisp.
const RAW: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11110 00001 00001 01110 00001 00001 11110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  ';': '00000 01100 01100 00000 01100 00100 01000',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  '"': '01010 01010 00000 00000 00000 00000 00000',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000',
  '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000',
  '[': '01110 01000 01000 01000 01000 01000 01110',
  ']': '01110 00010 00010 00010 00010 00010 01110',
  '%': '11001 11010 00010 00100 01000 01011 10011',
  '>': '01000 00100 00010 00001 00010 00100 01000',
  '<': '00010 00100 01000 10000 01000 00100 00010',
  '=': '00000 00000 11111 00000 11111 00000 00000',
  _: '00000 00000 00000 00000 00000 00000 11111',
  '#': '01010 01010 11111 01010 11111 01010 01010',
  '*': '00000 10101 01110 11111 01110 10101 00000',
  '&': '01100 10010 10100 01000 10101 10010 01101',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
};

const CHARS = Object.keys(RAW);
const INDEX: Record<string, number> = {};
CHARS.forEach((c, i) => (INDEX[c] = i));

export const GLYPH_W = 6;
export const GLYPH_H = 8;

const atlases = new Map<string, HTMLCanvasElement>();

function atlas(color: string): HTMLCanvasElement {
  let a = atlases.get(color);
  if (a) return a;
  a = document.createElement('canvas');
  a.width = CHARS.length * GLYPH_W;
  a.height = GLYPH_H;
  const c = a.getContext('2d')!;
  c.fillStyle = color;
  CHARS.forEach((ch, i) => {
    const rows = RAW[ch].split(' ');
    rows.forEach((row, y) => {
      for (let x = 0; x < 5; x++) if (row[x] === '1') c.fillRect(i * GLYPH_W + x, y, 1, 1);
    });
  });
  atlases.set(color, a);
  return a;
}

export interface TextOpts {
  color?: string;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: string | null;
  alpha?: number;
}

export function measure(text: string, scale = 1): number {
  return Math.max(0, text.length * GLYPH_W * scale - scale);
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts = {}): void {
  const scale = opts.scale ?? 1;
  const color = opts.color ?? '#ffffff';
  const t = text.toUpperCase();
  let sx = x;
  const w = measure(t, scale);
  if (opts.align === 'center') sx = x - w / 2;
  else if (opts.align === 'right') sx = x - w;
  sx = Math.round(sx);
  const sy = Math.round(y);
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  if (opts.shadow !== null) {
    blit(ctx, t, sx + scale, sy + scale, scale, opts.shadow ?? '#0b0816');
  }
  blit(ctx, t, sx, sy, scale, color);
  ctx.globalAlpha = prevAlpha;
}

function blit(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, scale: number, color: string): void {
  const a = atlas(color);
  for (let i = 0; i < t.length; i++) {
    const idx = INDEX[t[i]];
    if (idx === undefined || t[i] === ' ') continue;
    ctx.drawImage(a, idx * GLYPH_W, 0, GLYPH_W, GLYPH_H, x + i * GLYPH_W * scale, y, GLYPH_W * scale, GLYPH_H * scale);
  }
}

export function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur.length) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}
