import { PlanetRenderer, makeStars, fitCanvas, Star } from './planet';
import { drawText, measure } from './font';

export const SPLASHES = [
  'Ready for liftoff?',
  'Lots of science!',
  'NOVA says hi!',
  'Hello from Mars!',
  'Hello, explorer!',
  'Mind the dust!',
];

interface Shooting { x: number; y: number; vx: number; vy: number; life: number }

/** Animated main-menu backdrop: Mars, drifting stars, shooting stars, title + splash. */
export class MenuScene {
  private ctx: CanvasRenderingContext2D;
  private W = 480;
  private H = 270;
  private planet = new PlanetRenderer(120, 'mars');
  private stars: Star[] = makeStars(220);
  private shooting: Shooting[] = [];
  private t = 0;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  showTitle = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  resize(): void {
    const s = fitCanvas(this.canvas, 270, 360, 640);
    this.W = s.W;
    this.H = s.H;
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number): void {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05030f');
    g.addColorStop(0.6, '#120a2e');
    g.addColorStop(1, '#2a1250');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // nebula wash
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const nx = W * (0.2 + i * 0.3) + Math.sin(this.t * 0.05 + i) * 20;
      const ny = H * (0.25 + (i % 2) * 0.2);
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, 140);
      rg.addColorStop(0, i === 1 ? 'rgba(67,217,255,0.08)' : 'rgba(180,108,255,0.10)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    // stars drift slowly
    for (const s of this.stars) {
      s.x -= dt * 0.004 * s.z;
      if (s.x < 0) s.x += 1;
      const tw = 0.5 + 0.5 * Math.sin(this.t * (1 + s.z) + s.tw);
      ctx.globalAlpha = 0.35 + tw * 0.65;
      ctx.fillStyle = s.z === 3 ? '#c8e6ff' : s.z === 2 ? '#e0d0ff' : '#ffffff';
      const size = s.z === 3 ? 2 : 1;
      ctx.fillRect(Math.round(s.x * W), Math.round(s.y * H), size, size);
      if (s.z === 3 && tw > 0.9) { ctx.fillRect(Math.round(s.x * W) - 1, Math.round(s.y * H) + 0.5, 4, 1); }
    }
    ctx.globalAlpha = 1;
    // shooting stars
    if (Math.random() < dt * 0.35) {
      this.shooting.push({ x: W * (0.2 + Math.random() * 0.8), y: Math.random() * H * 0.4, vx: -160 - Math.random() * 120, vy: 60 + Math.random() * 50, life: 0 });
    }
    this.shooting = this.shooting.filter((s) => s.life < 1.2);
    for (const s of this.shooting) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = 1 - s.life / 1.2;
      for (let i = 0; i < 14; i++) {
        ctx.globalAlpha = a * (1 - i / 14);
        ctx.fillStyle = i < 2 ? '#ffffff' : '#9ef0ff';
        ctx.fillRect(Math.round(s.x - (s.vx / 60) * i * 0.5), Math.round(s.y - (s.vy / 60) * i * 0.5), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    // the planet
    const pc = this.planet.render(this.t * 0.006);
    const px = Math.round(W * 0.62), py = Math.round(H * 0.42);
    // glow behind
    const rg = ctx.createRadialGradient(px + pc.width / 2, py + pc.height / 2, 100, px + pc.width / 2, py + pc.height / 2, 190);
    rg.addColorStop(0, 'rgba(255,150,100,0.22)');
    rg.addColorStop(1, 'rgba(255,150,100,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(pc, px, py);
    // small moon orbiting
    const ma = this.t * 0.15;
    const mx = px + pc.width / 2 + Math.cos(ma) * 170, my = py + pc.height / 2 + Math.sin(ma) * 30 - 40;
    const behind = Math.sin(ma) < 0;
    if (!behind || mx < px || mx > px + pc.width) {
      ctx.fillStyle = '#7a6ea8';
      ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 3, 6, 6);
      ctx.fillStyle = '#b9b0e0';
      ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 3, 3, 3);
    }
    drawText(ctx, 'MARS', px + pc.width / 2, py + pc.height - 8, { align: 'center', color: '#c07a5a', shadow: null, alpha: 0.7 });

    if (this.showTitle) this.drawTitle();
  }

  private drawTitle(): void {
    const { ctx, W } = this;
    const title = 'LOST SIGNAL';
    const scale = measure(title, 5) < W - 30 ? 5 : 4;
    const tw = measure(title, scale);
    const x = Math.round(W / 2 - tw / 2), y = 26 + Math.round(Math.sin(this.t * 1.2) * 1);
    // extruded shadow
    for (let i = scale; i >= 1; i--) drawText(ctx, title, x, y + i, { scale, color: i > scale / 2 ? '#140a2e' : '#3a2470', shadow: null });
    // two-tone fill via clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, y + 3 * scale);
    ctx.clip();
    drawText(ctx, title, x, y, { scale, color: '#f2ecff', shadow: null });
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y + 3 * scale, W, 100);
    ctx.clip();
    drawText(ctx, title, x, y, { scale, color: '#b49cff', shadow: null });
    ctx.restore();
    // subtitle
    drawText(ctx, 'SURVIVE THE UNKNOWN.', W / 2, y + 8 * scale + 6, { align: 'center', scale: 1, color: '#43d9ff', shadow: '#0b2a44' });
    drawText(ctx, 'PROTECT WHAT YOU DISCOVER.', W / 2, y + 8 * scale + 17, { align: 'center', scale: 1, color: '#ffc896', shadow: '#3a1a10' });
    // splash text
    ctx.save();
    const pulse = 1 + Math.abs(Math.sin(this.t * 4)) * 0.08;
    ctx.translate(x + tw - 6, y + 8 * scale + 2);
    ctx.rotate(-0.33);
    ctx.scale(pulse, pulse);
    const sscale = this.splash.length > 24 ? 1 : 1;
    drawText(ctx, this.splash, 0, 0, { align: 'center', scale: sscale, color: '#ffff55', shadow: '#3f3f15' });
    ctx.restore();
  }
}
