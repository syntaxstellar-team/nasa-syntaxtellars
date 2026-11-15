import { VIEW_W, VIEW_H, clamp, lerp } from './constants';
import { PlanetRenderer, makeStars, Star } from './planet';
import { drawText } from './font';
import { Particles } from './particles';
import { audio } from './audio';
import { makeCanvas, rect, disc, line, poly, outline, Canv } from './art/canvas';
import { bakeBaseExterior } from './art/baseArt';
import { buildMountainLayer } from './art/backdrop';
import { sprites } from './art/sprites';

export const INTRO_LENGTH = 64;

export interface Caption { t: number; end: number; text: string; speaker?: string }

export const CAPTIONS: Caption[] = [
  { t: 1, end: 8.2, text: 'Humanity has always looked to the sky. For generations, explorers have dreamed of visiting other worlds.' },
  { t: 8.6, end: 15.6, text: 'Today, an international scientific expedition is beginning its most ambitious mission yet.' },
  { t: 17, end: 23.6, text: 'Welcome to Mars, the red planet — fourth from the Sun.' },
  { t: 24, end: 31.6, text: 'Your mission is to help run the ARES-7 research base and study the rocks, weather and sky of Mars.' },
  { t: 33, end: 43.5, text: "Hello, explorer! I'm NOVA, your research assistant. I'll help you keep the base running and explore this cold, dusty world.", speaker: 'NOVA' },
  { t: 45.5, end: 51, text: 'But Mars had a surprise waiting...' },
  { t: 51.5, end: 57.5, text: 'A giant dust storm swept over the outpost.' },
];

function buildShip(): Canv {
  const [c, ctx] = makeCanvas(56, 24);
  poly(ctx, [6, 8, 34, 5, 52, 11, 54, 14, 34, 19, 6, 16], '#e8e6f2');
  poly(ctx, [6, 12, 54, 13, 34, 19, 6, 16], '#b5b0c9');
  poly(ctx, [18, 7, 26, 0, 32, 0, 30, 7], '#c3c9da');
  poly(ctx, [18, 17, 26, 24, 32, 24, 30, 17], '#9aa3c0');
  rect(ctx, 40, 8, 8, 4, '#1b1530'); rect(ctx, 41, 9, 6, 2, '#43d9ff');
  rect(ctx, 8, 11, 40, 1, '#ff8a3d');
  rect(ctx, 2, 8, 5, 8, '#4c5068');
  return outline(c);
}

function buildGalaxy(seed: number): Canv {
  const [c, ctx] = makeCanvas(60, 40);
  for (let i = 0; i < 260; i++) {
    const a = i * 0.11 + seed, r = i * 0.09;
    const arm = i % 2 ? Math.PI : 0;
    const x = 30 + Math.cos(a + arm) * r * 1.4, y = 20 + Math.sin(a + arm) * r * 0.6;
    rect(ctx, x, y, 1, 1, i < 40 ? '#fff6e0' : i % 3 ? '#b49cff' : '#7aa8ff');
  }
  disc(ctx, 30, 20, 3, '#fff6e0');
  return c;
}

/** Plays the animated story introduction on a canvas. Captions are shown by the React view. */
export class IntroScene {
  t = 0;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  private done = false;
  private stars: Star[] = makeStars(240);
  private planet = new PlanetRenderer(70, 'mars');
  private parts = new Particles();
  private ship = buildShip();
  private galaxies = [buildGalaxy(1), buildGalaxy(4)];
  private baseImg = bakeBaseExterior();
  private mountains = [buildMountainLayer(31, 1024, 200, 140, 70, '#c97a5a', '#e09a72', false), buildMountainLayer(47, 1024, 200, 160, 60, '#a8573a', '#c06a48', false)];
  private cues = new Set<string>();

  constructor(canvas: HTMLCanvasElement, private onDone: () => void, private onTime: (t: number) => void) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d')!;
    audio.setMusic('intro');
    this.raf = requestAnimationFrame(this.frame);
  }

  skip(): void {
    if (this.done) return;
    this.done = true;
    this.onDone();
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
  }

  private cue(name: string, at: number, fn: () => void): void {
    if (this.t >= at && !this.cues.has(name)) { this.cues.add(name); fn(); }
  }

  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.parts.update(dt);
    this.onTime(this.t);
    this.draw(dt);
    if (this.t >= INTRO_LENGTH && !this.done) { this.done = true; this.onDone(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number): void {
    const { ctx, t } = this;
    ctx.imageSmoothingEnabled = false;
    this.cue('land', 27, () => audio.play('rumble'));
    this.cue('nova', 33, () => audio.play('robot'));
    this.cue('wind', 45, () => audio.setAmbient(1, 0.6));
    this.cue('alarm', 52, () => audio.play('alarm'));
    this.cue('snap', 55, () => { audio.play('explosion'); });
    this.cue('dark', 58, () => { audio.setMusic('none'); audio.setAmbient(0, 0); audio.play('error'); });
    let shake = 0;
    if (t > 26 && t < 29) shake = 1.5;
    if (t > 48 && t < 58) shake = (t - 48) * 0.25;
    ctx.save();
    ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
    if (t < 16) this.space(t);
    else if (t < 24) this.approach(t - 16);
    else {
      const z = t < 31 ? 1 : t < 33 ? lerp(1, 2, (t - 31) / 2) : t < 44 ? 2 : t < 46 ? lerp(2, 1, (t - 44) / 2) : 1;
      ctx.translate(310, 200);
      ctx.scale(z, z);
      ctx.translate(-310, -200);
      this.surface(t, dt);
    }
    ctx.restore();
    // letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, 18);
    ctx.fillRect(0, VIEW_H - 18, VIEW_W, 18);
    // cross-fades between scenes
    for (const edge of [16, 24]) {
      const d = Math.abs(t - edge);
      if (d < 0.6) { ctx.fillStyle = `rgba(0,0,0,${1 - d / 0.6})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    }
    if (t < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - t})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    // the disaster: darkness, then the lost connection message
    if (t >= 58) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const a = clamp((t - 58.6) * 2, 0, 1) * (t > 63.2 ? clamp((64 - t) / 0.8, 0, 1) : 1);
      if (Math.floor(t * 3) % 2 === 0 || t > 60) drawText(ctx, 'CONNECTION LOST', VIEW_W / 2, 110, { align: 'center', scale: 3, color: '#ff4d6d', alpha: a });
      if (t > 60) drawText(ctx, 'MISSION CONTROL: NO SIGNAL', VIEW_W / 2, 146, { align: 'center', scale: 2, color: '#ffd43b', alpha: a });
    }
  }

  private starfield(speed: number): void {
    const { ctx, t } = this;
    for (const s of this.stars) {
      const x = ((s.x - t * speed * s.z) % 1 + 1) % 1;
      ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s.tw));
      ctx.fillStyle = s.z === 3 ? '#c8e6ff' : '#ffffff';
      ctx.fillRect(Math.round(x * VIEW_W), Math.round(s.y * VIEW_H), s.z === 3 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Scene 1: a spacecraft travelling past galaxies and planets. */
  private space(t: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#05030f';
    ctx.fillRect(-10, -10, VIEW_W + 20, VIEW_H + 20);
    const neb = ctx.createRadialGradient(140, 90, 0, 140, 90, 200);
    neb.addColorStop(0, 'rgba(120,80,200,0.25)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.starfield(0.01);
    ctx.drawImage(this.galaxies[0], Math.round(360 - t * 4), 40);
    ctx.drawImage(this.galaxies[1], Math.round(80 - t * 2), 170);
    // a ringed giant and a small blue planet drifting by
    disc(ctx, Math.round(420 - t * 9), 200, 26, '#7a5ac8'); disc(ctx, Math.round(414 - t * 9), 194, 20, '#a88cf0');
    ctx.strokeStyle = '#e0c8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(420 - t * 9, 200, 44, 8, -0.3, 0, Math.PI * 2); ctx.stroke();
    disc(ctx, Math.round(60 + t * 3), 60, 7, '#3a8dff'); disc(ctx, Math.round(58 + t * 3), 58, 3, '#5ccf5c');
    // the ship cruises across with a camera push
    const x = lerp(-60, VIEW_W * 0.55, clamp(t / 14, 0, 1));
    const y = 130 + Math.sin(t * 1.4) * 4;
    if (Math.random() < 0.9) this.parts.add({ x: x - 26, y: y + (Math.random() - 0.5) * 3, vx: -80, vy: 0, max: 0.5, color: '#5ff3ff', glow: true, fade: true, size: 2 });
    this.parts.draw(ctx, 0, 0);
    ctx.drawImage(this.ship, Math.round(x - 28), Math.round(y - 12));
  }

  /** Scene 2a: Mars seen from space. */
  private approach(k: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#05030f';
    ctx.fillRect(-10, -10, VIEW_W + 20, VIEW_H + 20);
    this.starfield(0.004);
    const pc = this.planet.render(k * 0.01);
    const s = 1.2 + k * 0.12;
    const w = pc.width * s;
    ctx.drawImage(pc, Math.round(VIEW_W * 0.62 - w / 2), Math.round(VIEW_H * 0.52 - w / 2), Math.round(w), Math.round(w));
    const x = lerp(60, VIEW_W * 0.5, k / 8), y = lerp(80, 150, k / 8);
    const sc = lerp(0.9, 0.4, k / 8);
    ctx.drawImage(this.ship, Math.round(x), Math.round(y), Math.round(56 * sc), Math.round(24 * sc));
    drawText(ctx, 'MARS', VIEW_W * 0.62, 34, { align: 'center', scale: 2, color: '#ffc896', alpha: clamp(k - 1, 0, 1) });
  }

  /** Scenes 2b–4 on the surface: landing, meeting NOVA, the storm. */
  private surface(t: number, dt: number): void {
    const { ctx } = this;
    const storm = clamp((t - 45) / 10, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, storm > 0 ? `rgb(${lerp(90, 70, storm)},${lerp(58, 40, storm)},${lerp(122, 40, storm)})` : '#5a3a7a');
    g.addColorStop(0.5, '#e08a6a');
    g.addColorStop(1, '#ffc896');
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, VIEW_W + 20, VIEW_H + 20);
    disc(ctx, 380, 50, 8, '#fff6e0');
    this.mountains.forEach((m, i) => ctx.drawImage(m, Math.round(-((t * (2 + i * 3)) % 400)), 40 + i * 20));
    const gy = 208;
    rect(ctx, 0, gy, VIEW_W, VIEW_H - gy, '#a64e30');
    rect(ctx, 0, gy, VIEW_W, 2, '#f0a070');
    // outpost
    const bx = 150, by = gy - 120;
    ctx.drawImage(this.baseImg, bx, by);
    const flick = t > 50 && Math.random() < 0.4;
    if (flick) { ctx.fillStyle = 'rgba(20,10,30,0.6)'; for (let k = 0; k < 4; k++) ctx.fillRect(bx + 31 + k * 30, by + 53, 12, 8); }
    // solar panels get dusty
    for (let k = 0; k < 3; k++) {
      const px = 40 + k * 26;
      line(ctx, px + 9, gy, px + 9, gy - 12, '#6d7690', 2);
      const dusty = clamp((t - 48) / 4, 0, 1);
      poly(ctx, [px, gy - 12, px + 18, gy - 20, px + 20, gy - 16, px + 2, gy - 8], dusty > 0.5 ? '#9a5a3a' : '#2a4aa8');
    }
    // antenna: snaps at 55s
    const ax = bx + 120, ay = by + 40;
    line(ctx, ax, ay, ax, ay - 22, '#8f99b3', 2);
    if (t < 55) { disc(ctx, ax - 3, ay - 28, 9, '#e8e6f2'); disc(ctx, ax - 2, ay - 27, 6, '#c3c9da'); }
    else {
      line(ctx, ax, ay - 22, ax + 12, ay - 14, '#c3c9da', 3);
      if (t < 56) this.parts.burst(ax + 10, ay - 16, '#ffe08a', 4, 60, { glow: true });
    }
    // the lander arrives (24–31s)
    if (t < 33) {
      const k = clamp((t - 24) / 6, 0, 1);
      const lx = 330, ly = lerp(-30, gy - 24, 1 - (1 - k) * (1 - k));
      rect(ctx, lx, ly, 34, 18, '#e8e6f2'); rect(ctx, lx + 4, ly + 4, 8, 5, '#43d9ff'); rect(ctx, lx, ly + 18, 4, 6, '#6d7690'); rect(ctx, lx + 30, ly + 18, 4, 6, '#6d7690');
      if (k < 1) { for (let i = 0; i < 3; i++) this.parts.add({ x: lx + 17 + (Math.random() - 0.5) * 10, y: ly + 22, vx: (Math.random() - 0.5) * 40, vy: 60, max: 0.4, color: '#ffb347', glow: true, fade: true, size: 2 }); }
      if (k > 0.9 && k < 1) for (let i = 0; i < 4; i++) this.parts.add({ x: lx + 17, y: gy, vx: (Math.random() - 0.5) * 160, vy: -20 - Math.random() * 30, max: 1.2, color: '#d8794a', fade: true, size: 3, grav: 60 });
    }
    // astronaut and NOVA (from 32s)
    const spr = sprites();
    if (t > 32) {
      const walk = clamp((t - 32) / 3, 0, 1);
      const px = lerp(330, 300, walk);
      const frames = walk < 1 ? spr.astroL.walk : spr.astroL.idle;
      ctx.drawImage(frames[Math.floor(t * 8) % frames.length], Math.round(px - 12), gy - 24);
      const novaIn = clamp((t - 33) / 1.5, 0, 1);
      const nx = lerp(bx + 220, px - 30, novaIn), ny = gy - 40 + Math.sin(t * 2) * 3;
      const mood = t > 47 ? 'worried' : t > 45 ? 'surprised' : 'happy';
      ctx.drawImage(spr.nova[mood][Math.floor(t * 8) % 2], Math.round(nx - 11), Math.round(ny - 11));
    }
    // storm wall rolling in from the right
    if (storm > 0) {
      const front = lerp(VIEW_W + 40, 330, storm);
      ctx.globalAlpha = 0.9;
      for (let y = 20; y < VIEW_H; y += 6) {
        const wob = Math.sin(y * 0.15 + t * 3) * 14;
        ctx.fillStyle = y % 12 ? '#8a4a2a' : '#6a3420';
        ctx.fillRect(Math.round(front + wob), y, VIEW_W, 6);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) this.parts.add({ x: front + Math.random() * 40, y: 20 + Math.random() * 230, vx: -220 - Math.random() * 120, vy: (Math.random() - 0.5) * 30, max: 2.4, color: Math.random() < 0.5 ? '#c27a4a' : '#e0a070', fade: true, size: 2 });
      ctx.fillStyle = `rgba(110,50,30,${storm * 0.3})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.parts.draw(ctx, 0, 0);
    // warning indicators
    if (t > 52 && t < 58 && Math.floor(t * 3) % 2 === 0) {
      for (const [wx, wy, label] of [[90, 40, 'POWER LOW'], [370, 60, 'ANTENNA'], [230, 30, 'WARNING']] as [number, number, string][]) {
        poly(ctx, [wx, wy - 10, wx + 10, wy + 8, wx - 10, wy + 8], '#ffd43b');
        drawText(ctx, '!', wx, wy - 3, { align: 'center', color: '#1e1840', shadow: null });
        drawText(ctx, label, wx, wy + 12, { align: 'center', color: '#ffd43b' });
      }
    }
    void dt;
  }
}
