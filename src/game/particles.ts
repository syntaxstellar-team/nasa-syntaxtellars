import { GRAVITY } from './physics';
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; color: string; size: number;
  grav: number; glow?: boolean; fade?: boolean;
}

export class Particles {
  list: Particle[] = [];

  burst(x: number, y: number, color: string, n: number, speed = 60, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4,
        life: 0, max: 0.4 + Math.random() * 0.5, color, size: Math.random() < 0.3 ? 2 : 1, grav: GRAVITY, fade: true,
        ...opts,
      });
    }
  }

  add(p: Partial<Particle> & { x: number; y: number }): void {
    this.list.push({ vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 1, grav: 0, ...p });
  }

  update(dt: number): void {
    const out: Particle[] = [];
    for (const p of this.list) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      out.push(p);
    }
    if (out.length > 900) out.splice(0, out.length - 900);
    this.list = out;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.list) {
      const a = p.fade ? 1 - p.life / p.max : 1;
      ctx.globalAlpha = a;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}
