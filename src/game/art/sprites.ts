import { makeCanvas, rect, px, line, outline, Canv, disc, flipped, poly } from './canvas';
import { buildAstronaut } from './characters';
import type { Mood } from '../../store/types';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// NOVA — round floating research robot with a screen face
// ---------------------------------------------------------------------------
const N_BODY = '#eef6ff';
const N_SHADE = '#a9c2e0';
const N_DARK = '#6d84a8';
const N_SCREEN = '#0d1633';
const N_FACE = '#5ff3ff';
const N_ORANGE = '#ff9b3d';

function novaFace(ctx: Ctx, mood: Mood, ox: number, oy: number, blink: boolean): void {
  const F = mood === 'worried' ? '#ffd36b' : mood === 'celebrating' ? '#ffe08a' : N_FACE;
  const p = (x: number, y: number, c = F) => px(ctx, ox + x, oy + y, c);
  if (blink && mood !== 'surprised' && mood !== 'celebrating') {
    for (const ex of [2, 7]) { p(ex, 3); p(ex + 1, 3); p(ex + 2, 3); }
    return;
  }
  switch (mood) {
    case 'happy':
      for (const ex of [2, 7]) { p(ex, 3); p(ex + 1, 2); p(ex + 2, 3); }
      p(4, 5); p(5, 6); p(6, 6); p(7, 5);
      break;
    case 'curious':
      rect(ctx, ox + 2, oy + 2, 2, 2, F);
      rect(ctx, ox + 7, oy + 1, 3, 3, F);
      p(8, 2, N_SCREEN);
      p(5, 5); p(6, 5);
      break;
    case 'worried':
      p(2, 1); p(3, 2); p(9, 1); p(8, 2);
      rect(ctx, ox + 2, oy + 3, 2, 1, F); rect(ctx, ox + 8, oy + 3, 2, 1, F);
      p(4, 6); p(5, 5); p(6, 5); p(7, 6);
      break;
    case 'surprised':
      for (const ex of [2, 7]) { rect(ctx, ox + ex, oy + 1, 3, 3, F); p(ex + 1, 2, N_SCREEN); }
      rect(ctx, ox + 5, oy + 5, 2, 2, F);
      break;
    case 'thinking':
      rect(ctx, ox + 3, oy + 1, 2, 2, F); rect(ctx, ox + 8, oy + 1, 2, 2, F);
      rect(ctx, ox + 4, oy + 5, 4, 1, F);
      break;
    case 'celebrating':
      for (const ex of [3, 8]) { p(ex, 1); p(ex - 1, 2); p(ex, 2); p(ex + 1, 2); p(ex, 3); }
      rect(ctx, ox + 3, oy + 5, 6, 1, F); p(4, 6); p(5, 6); p(6, 6); p(7, 6);
      break;
  }
}

/** One NOVA frame on a 22x22 canvas. */
function drawNova(mood: Mood, blink: boolean, flame: number): Canv {
  const [c, ctx] = makeCanvas(22, 22);
  // arms
  if (mood === 'celebrating') {
    line(ctx, 3, 9, 1, 4, N_SHADE, 2); line(ctx, 18, 9, 20, 4, N_SHADE, 2);
    px(ctx, 1, 3, N_ORANGE); px(ctx, 20, 3, N_ORANGE);
  } else if (mood === 'thinking') {
    line(ctx, 3, 11, 1, 14, N_SHADE, 2); line(ctx, 18, 12, 16, 9, N_SHADE, 2);
  } else {
    line(ctx, 3, 11, 1, 14, N_SHADE, 2); line(ctx, 18, 11, 20, 14, N_SHADE, 2);
  }
  // head/body: rounded capsule
  rect(ctx, 6, 3, 10, 1, N_BODY);
  rect(ctx, 4, 4, 14, 1, N_BODY);
  rect(ctx, 3, 5, 16, 9, N_BODY);
  rect(ctx, 4, 14, 14, 1, N_SHADE);
  rect(ctx, 6, 15, 10, 1, N_SHADE);
  rect(ctx, 8, 16, 6, 1, N_DARK);
  rect(ctx, 3, 12, 16, 2, N_SHADE);
  px(ctx, 4, 5, '#ffffff'); px(ctx, 5, 4, '#ffffff');
  // ear lights
  rect(ctx, 2, 7, 1, 3, N_ORANGE); rect(ctx, 19, 7, 1, 3, N_ORANGE);
  // screen
  rect(ctx, 5, 5, 12, 8, N_SCREEN);
  novaFace(ctx, mood, 5, 5, blink);
  // antenna
  line(ctx, 11, 3, 11, 1, N_DARK);
  px(ctx, 11, 0, mood === 'worried' ? '#ff5a6e' : N_ORANGE);
  // thruster flame
  rect(ctx, 9, 17, 4, 1, '#ffb347');
  if (flame) { rect(ctx, 10, 18, 2, 2, '#ffe08a'); px(ctx, 10, 20, '#ff9b3d'); } else rect(ctx, 10, 18, 2, 1, '#ffe08a');
  return outline(c, [14, 18, 40]);
}

export const MOODS: Mood[] = ['happy', 'curious', 'worried', 'surprised', 'thinking', 'celebrating'];

// ---------------------------------------------------------------------------
// Scout drone (fictional, inspired by NASA's Ingenuity helicopter)
// ---------------------------------------------------------------------------
function drawDrone(f: number): Canv {
  const [c, ctx] = makeCanvas(24, 16);
  // two stacked rotors, spinning
  const w = [11, 4, 9][f % 3];
  rect(ctx, 12 - w, 1, w * 2, 1, '#c3c9da');
  rect(ctx, 12 - (13 - w), 3, (13 - w) * 2, 1, '#8f99b3');
  rect(ctx, 11, 1, 2, 7, '#6d7690');
  // body with solar panel on top and camera
  rect(ctx, 8, 7, 8, 5, '#e8e6f2');
  rect(ctx, 8, 7, 8, 1, '#2a4aa8');
  rect(ctx, 10, 9, 2, 2, '#0d1633'); px(ctx, 10, 9, '#5ff3ff');
  // four thin legs
  line(ctx, 8, 12, 4, 15, '#8f99b3'); line(ctx, 16, 12, 20, 15, '#8f99b3');
  line(ctx, 10, 12, 8, 15, '#6d7690'); line(ctx, 14, 12, 16, 15, '#6d7690');
  return outline(c, [20, 14, 40]);
}

// ---------------------------------------------------------------------------
// Icons for the DOM HUD / inventory (12x12, pixel art)
// ---------------------------------------------------------------------------
const ICONS: Record<string, (ctx: Ctx) => void> = {
  energy: (c) => { poly(c, [7, 0, 2, 7, 6, 7, 4, 12, 10, 4, 6, 4, 8, 0], '#ffd43b'); px(c, 6, 2, '#fff6b0'); },
  oxygen: (c) => { disc(c, 6, 6, 5, '#43d9ff'); disc(c, 6, 6, 3, '#bff6ff'); rect(c, 4, 5, 4, 2, '#1a6f8f'); px(c, 4, 4, '#ffffff'); },
  water: (c) => { poly(c, [6, 0, 2, 7, 3, 10, 6, 11, 9, 10, 10, 7], '#3a8dff'); px(c, 4, 6, '#bfe0ff'); px(c, 4, 7, '#bfe0ff'); },
  food: (c) => { disc(c, 6, 7, 4, '#5ccf5c'); line(c, 6, 3, 8, 0, '#3a8a2a'); rect(c, 7, 1, 3, 2, '#7fe07f'); px(c, 4, 5, '#c8ffc8'); },
  crew: (c) => { poly(c, [6, 11, 1, 6, 1, 3, 3, 1, 6, 3, 9, 1, 11, 3, 11, 6], '#ff5a7a'); px(c, 3, 3, '#ffc0cf'); },
  research: (c) => { poly(c, [6, 0, 7, 4, 11, 4, 8, 7, 9, 11, 6, 9, 3, 11, 4, 7, 1, 4, 5, 4], '#c48cff'); px(c, 6, 3, '#ffffff'); },
  eco: (c) => { poly(c, [2, 10, 3, 4, 7, 1, 11, 1, 10, 6, 6, 9], '#4fd08a'); line(c, 2, 10, 8, 4, '#1f7a4a'); },
  spacesuit: (c) => { rect(c, 3, 1, 6, 5, '#e8e6f2'); rect(c, 5, 2, 3, 2, '#43d9ff'); rect(c, 2, 6, 8, 5, '#e8e6f2'); rect(c, 2, 8, 8, 1, '#ff8a3d'); },
  o2tank: (c) => { rect(c, 4, 2, 4, 9, '#43d9ff'); rect(c, 4, 2, 1, 9, '#bff6ff'); rect(c, 5, 0, 2, 2, '#8f8aa8'); rect(c, 4, 6, 4, 1, '#ffffff'); },
  battery: (c) => { rect(c, 2, 3, 8, 7, '#3d3a63'); rect(c, 10, 5, 1, 3, '#8f8aa8'); rect(c, 3, 4, 5, 5, '#ffd43b'); },
  radio: (c) => { rect(c, 3, 3, 6, 8, '#4c5068'); line(c, 8, 3, 9, 0, '#c3c9da'); rect(c, 4, 4, 4, 2, '#3dff8a'); rect(c, 4, 7, 1, 1, '#ff8a3d'); rect(c, 6, 7, 1, 1, '#ff8a3d'); },
  scanner: (c) => { rect(c, 2, 2, 8, 6, '#ff8a3d'); rect(c, 3, 3, 6, 4, '#0d1633'); line(c, 4, 6, 7, 3, '#5ff3ff'); rect(c, 5, 8, 2, 3, '#4c5068'); },
  soil: (c) => { rect(c, 3, 3, 6, 8, '#c8d6e8'); rect(c, 3, 6, 6, 5, '#c0532f'); px(c, 5, 8, '#e88a5a'); rect(c, 3, 2, 6, 1, '#6d84a8'); },
  sediment: (c) => { rect(c, 2, 3, 8, 8, '#b0603a'); rect(c, 2, 4, 8, 1, '#e8b08a'); rect(c, 2, 6, 8, 1, '#7a3a2a'); rect(c, 2, 8, 8, 1, '#e8b08a'); rect(c, 2, 10, 8, 1, '#7a3a2a'); },
  basalt: (c) => { poly(c, [1, 10, 2, 5, 5, 2, 9, 3, 11, 7, 10, 10], '#4a4250'); px(c, 4, 6, '#1e1a24'); px(c, 7, 5, '#1e1a24'); px(c, 6, 8, '#1e1a24'); px(c, 5, 3, '#7a7090'); },
  hematite: (c) => { disc(c, 4, 7, 2, '#6a6f80'); disc(c, 8, 8, 2, '#5a5f70'); disc(c, 7, 4, 2, '#7a8090'); px(c, 3, 6, '#c3c9da'); px(c, 6, 3, '#c3c9da'); },
  drone: (c) => { rect(c, 1, 1, 10, 1, '#c3c9da'); rect(c, 5, 1, 2, 5, '#6d7690'); rect(c, 3, 5, 6, 4, '#e8e6f2'); rect(c, 3, 5, 6, 1, '#2a4aa8'); line(c, 3, 9, 1, 11, '#8f99b3'); line(c, 8, 9, 10, 11, '#8f99b3'); },
  rad: (c) => { disc(c, 6, 6, 5, '#ffd43b'); disc(c, 6, 6, 1, '#1e1a24'); poly(c, [6, 5, 3, 1, 9, 1], '#1e1a24'); poly(c, [5, 7, 1, 8, 3, 11], '#1e1a24'); poly(c, [7, 7, 11, 8, 9, 11], '#1e1a24'); },
  weather: (c) => { line(c, 6, 2, 6, 11, '#c3c9da'); rect(c, 3, 2, 7, 1, '#c3c9da'); disc(c, 3, 3, 1, '#43d9ff'); disc(c, 10, 3, 1, '#43d9ff'); rect(c, 4, 9, 5, 2, '#6d7690'); },
  beacon: (c) => { line(c, 6, 3, 6, 11, '#c3c9da'); rect(c, 4, 9, 5, 2, '#4c5068'); disc(c, 6, 2, 2, '#5ff3ff'); },
  water_container: (c) => { rect(c, 2, 2, 8, 9, '#3a8dff'); rect(c, 2, 2, 8, 2, '#8f8aa8'); rect(c, 3, 5, 2, 5, '#9fd0ff'); },
};

function icon(name: string, scale = 1): Canv {
  const [c, ctx] = makeCanvas(12, 12);
  ICONS[name](ctx);
  const o = outline(c, [20, 14, 40]);
  if (scale === 1) return o;
  const [b, bctx] = makeCanvas(12 * scale, 12 * scale);
  bctx.drawImage(o, 0, 0, 12 * scale, 12 * scale);
  return b;
}

// ---------------------------------------------------------------------------
// Career portraits for the ending
// ---------------------------------------------------------------------------
function person(ctx: Ctx, skin: string, hair: string, outfit: string, accent: string): void {
  rect(ctx, 9, 3, 8, 2, hair);
  rect(ctx, 8, 5, 10, 7, skin);
  rect(ctx, 8, 5, 10, 2, hair);
  px(ctx, 11, 8, '#1a0f1f'); px(ctx, 15, 8, '#1a0f1f');
  rect(ctx, 12, 10, 3, 1, '#a0503a');
  rect(ctx, 6, 13, 14, 9, outfit);
  rect(ctx, 12, 13, 2, 9, accent);
}

const CAREERS: Record<string, (ctx: Ctx) => void> = {
  astronaut: (c) => {
    disc(c, 13, 9, 7, '#e8e6f2'); rect(c, 9, 6, 9, 6, '#43d9ff'); px(c, 10, 7, '#c8f8ff');
    rect(c, 6, 15, 14, 9, '#e8e6f2'); rect(c, 6, 18, 14, 1, '#ff8a3d'); rect(c, 15, 16, 3, 2, '#3a7bff');
  },
  engineer: (c) => {
    person(c, '#c98a5a', '#2a1a14', '#ff8a3d', '#ffd43b');
    rect(c, 8, 2, 10, 3, '#ffd43b'); rect(c, 7, 4, 12, 1, '#e8b82a');
    line(c, 18, 22, 22, 16, '#8f8aa8', 2);
  },
  robotics: (c) => {
    person(c, '#f2c9a0', '#6a3a8a', '#3a7bff', '#c3c9da');
    rect(c, 18, 14, 6, 6, '#eef6ff'); rect(c, 19, 15, 4, 3, '#0d1633'); px(c, 20, 16, '#5ff3ff'); px(c, 22, 16, '#5ff3ff');
  },
  astrobiologist: (c) => {
    person(c, '#8a5a3a', '#1a1014', '#f2f2f8', '#4fd08a');
    rect(c, 18, 15, 5, 7, '#bff6ff'); rect(c, 18, 18, 5, 4, '#4fd08a'); rect(c, 19, 14, 3, 1, '#8f8aa8');
  },
};

function career(name: string): string {
  const [c, ctx] = makeCanvas(26, 26);
  CAREERS[name](ctx);
  const o = outline(c, [20, 14, 40]);
  const [b, bctx] = makeCanvas(104, 104);
  bctx.drawImage(o, 0, 0, 104, 104);
  return b.toDataURL();
}

function scaled(src: Canv, s: number, bg?: string): Canv {
  const [c, ctx] = makeCanvas(src.width * s, src.height * s);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(src, 0, 0, src.width * s, src.height * s);
  return c;
}

export interface Sprites {
  astro: Record<string, Canv[]>;
  astroL: Record<string, Canv[]>;
  nova: Record<Mood, Canv[]>; // [open, open-flame, blink, blink-flame]
  novaL: Record<Mood, Canv[]>;
  novaPortrait: Record<Mood, string>;
  drone: Canv[];
  icons: Record<string, Canv>;
  iconUrl: Record<string, string>;
  careerUrl: Record<string, string>;
}

let cached: Sprites | null = null;

export function sprites(): Sprites {
  if (cached) return cached;
  const astro = buildAstronaut();
  const astroL: Record<string, Canv[]> = {};
  for (const k of Object.keys(astro)) astroL[k] = astro[k].map(flipped);
  const nova = {} as Record<Mood, Canv[]>;
  const novaL = {} as Record<Mood, Canv[]>;
  const novaPortrait = {} as Record<Mood, string>;
  for (const m of MOODS) {
    nova[m] = [drawNova(m, false, 0), drawNova(m, false, 1), drawNova(m, true, 0), drawNova(m, true, 1)];
    novaL[m] = nova[m].map(flipped);
    novaPortrait[m] = scaled(nova[m][0], 4).toDataURL();
  }
  const icons: Record<string, Canv> = {};
  const iconUrl: Record<string, string> = {};
  for (const k of Object.keys(ICONS)) {
    icons[k] = icon(k);
    iconUrl[k] = icon(k, 3).toDataURL();
  }
  cached = {
    astro, astroL, nova, novaL, novaPortrait,
    drone: [0, 1, 2].map(drawDrone),
    icons, iconUrl,
    careerUrl: Object.fromEntries(Object.keys(CAREERS).map((k) => [k, career(k)])),
  };
  return cached;
}
