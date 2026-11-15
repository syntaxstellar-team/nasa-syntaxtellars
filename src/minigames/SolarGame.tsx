import { useRef, useState } from 'react';
import type { PointerEvent as RPE } from 'react';
import { MW, MH, MiniGameProps, useLoop, logical } from './common';
import { rect, disc, line } from '../game/art/canvas';
import { drawText } from '../game/font';
import { audio } from '../game/audio';
import { Particles } from '../game/particles';

const DW = 12, DH = 5, CELL = 4; // dust grid per panel
interface Panel { x: number; tilt: number; dust: boolean[] }

export default function SolarGame({ level, onWin, hint }: MiniGameProps) {
  const lv = Math.min(2, level);
  const count = lv === 1 ? 2 : 3;
  const canvas = useRef<HTMLCanvasElement>(null);
  const panels = useRef<Panel[]>(Array.from({ length: count }, (_, i) => ({
    x: count === 2 ? 110 + i * 100 : 80 + i * 80,
    tilt: [-40, 35, -10][i],
    dust: Array.from({ length: DW * DH }, () => true),
  })));
  const [phase, setPhase] = useState<'clean' | 'aim' | 'won'>('clean');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [, force] = useState(0);
  const st = useRef({ t: 0, sun: lv === 1 ? 25 : -55, hold: 0, wonT: 0, scrubSnd: 0, power: 0 });
  const parts = useRef(new Particles());
  const brushing = useRef(false);
  (window as unknown as Record<string, unknown>).__mg = { kind: 'solar', panels: panels.current, st: st.current };
  const target = lv === 1 ? 0.85 : 0.8;
  const needHold = lv === 1 ? 2 : 4;
  const PANEL_Y = 132;

  const cleanFrac = (p: Panel) => p.dust.filter((d) => !d).length / p.dust.length;
  const efficiency = (p: Panel) => Math.max(0, Math.cos(((st.current.sun - p.tilt) * Math.PI) / 180)) * cleanFrac(p);

  useLoop((dt, t) => {
    const s = st.current;
    s.t = t;
    s.scrubSnd -= dt;
    const ph = phaseRef.current;
    if (ph === 'aim' && lv === 2) s.sun = Math.min(55, s.sun + dt * 3.2);
    const P = panels.current;
    s.power = P.reduce((a, p) => a + efficiency(p), 0) / P.length;
    if (ph === 'aim') {
      s.hold = s.power >= target ? s.hold + dt : Math.max(0, s.hold - dt * 0.5);
      if (s.hold >= needHold) { setPhase('won'); s.wonT = 0.01; audio.play('power'); hint('Full power! The panels are turning sunlight into electricity.', 'celebrating'); }
      if (lv === 2 && s.sun >= 55 && s.hold < needHold) s.sun = -55; // the day starts again
    }
    if (ph === 'won') {
      s.wonT += dt;
      if (Math.random() < 0.5) parts.current.add({ x: P[Math.floor(Math.random() * P.length)].x, y: PANEL_Y - 10, vx: (Math.random() - 0.5) * 20, vy: -60, max: 1, color: '#ffd43b', glow: true, fade: true, size: 2 });
      if (s.wonT > 1.4 && s.wonT < 50) { s.wonT = 99; onWin(); }
    }
    parts.current.update(dt);
    draw();
  });

  function sunPos(): { x: number; y: number } {
    const a = (st.current.sun * Math.PI) / 180;
    return { x: MW / 2 + Math.sin(a) * 130, y: 112 - Math.cos(a) * 95 };
  }

  function draw(): void {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = st.current;
    const g = ctx.createLinearGradient(0, 0, 0, MH);
    g.addColorStop(0, '#5a3a7a'); g.addColorStop(0.6, '#e08a6a'); g.addColorStop(1, '#ffc896');
    ctx.fillStyle = g; ctx.fillRect(0, 0, MW, MH);
    // sun path
    for (let a = -60; a <= 60; a += 6) { const r = (a * Math.PI) / 180; rect(ctx, MW / 2 + Math.sin(r) * 130, 112 - Math.cos(r) * 95, 1, 1, 'rgba(255,255,255,0.35)'); }
    const sp = sunPos();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 30); sg.addColorStop(0, 'rgba(255,240,200,0.7)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(sp.x - 30, sp.y - 30, 60, 60);
    ctx.restore();
    disc(ctx, sp.x, sp.y, 7, '#fff6e0');
    // ground
    rect(ctx, 0, 150, MW, 30, '#a64e30'); rect(ctx, 0, 150, MW, 2, '#f0a070');
    const ph = phaseRef.current;
    for (const p of panels.current) {
      // sunbeam to panel in aim phase
      if (ph !== 'clean') {
        const e = efficiency(p);
        ctx.strokeStyle = `rgba(255,240,180,${0.15 + e * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(p.x, PANEL_Y); ctx.stroke();
      }
      line(ctx, p.x, 150, p.x, PANEL_Y + 4, '#6d7690', 3);
      ctx.save();
      ctx.translate(p.x, PANEL_Y);
      ctx.rotate((p.tilt * Math.PI) / 180);
      const w = DW * CELL, h = DH * CELL;
      rect(ctx, -w / 2 - 2, -h - 2, w + 4, h + 4, '#c3c9da');
      rect(ctx, -w / 2, -h, w, h, '#1e3a8a');
      for (let k = 1; k < 4; k++) rect(ctx, -w / 2 + k * 12, -h, 1, h, '#3a5ac8');
      rect(ctx, -w / 2, -h / 2, w, 1, '#3a5ac8');
      for (let i = 0; i < DW * DH; i++) if (p.dust[i]) rect(ctx, -w / 2 + (i % DW) * CELL, -h + Math.floor(i / DW) * CELL, CELL, CELL, (i * 7) % 3 ? '#b8683e' : '#d08a5a');
      if (ph !== 'clean') rect(ctx, -1, -h - 8, 2, 6, '#ffd43b'); // normal arrow
      ctx.restore();
      drawText(ctx, `${Math.round(cleanFrac(p) * 100)}%`, p.x, 160, { align: 'center', color: cleanFrac(p) >= 0.9 ? '#3dff8a' : '#ffffff' });
    }
    parts.current.draw(ctx, 0, 0);
    // power meter
    rect(ctx, 296, 20, 14, 120, '#1e2236');
    const ph2 = Math.round(116 * Math.min(1, s.power));
    rect(ctx, 298, 138 - ph2, 10, ph2, s.power >= target ? '#3dff8a' : '#ffd43b');
    const ty = 138 - Math.round(116 * target);
    rect(ctx, 292, ty, 22, 1, '#ffffff');
    drawText(ctx, 'PWR', 303, 10, { align: 'center', color: '#ffd43b' });
    const label = ph === 'clean' ? '1. RUB THE DUST OFF EVERY PANEL' : ph === 'aim' ? `2. TILT PANELS TO FACE THE SUN${lv === 2 ? ' (IT MOVES!)' : ''}` : 'PANELS ONLINE!';
    drawText(ctx, label, 150, 6, { align: 'center', color: '#ffffff', shadow: '#3a1a2a' });
    if (ph === 'aim') {
      rect(ctx, 60, 172, 180, 5, '#1e2236');
      rect(ctx, 61, 173, Math.round(178 * Math.min(1, s.hold / needHold)), 3, '#3dff8a');
    }
  }

  const scrub = (e: RPE) => {
    if (phaseRef.current !== 'clean' || !brushing.current) return;
    const p = logical(e, canvas.current!);
    let changed = false;
    for (const pn of panels.current) {
      const a = (-pn.tilt * Math.PI) / 180;
      const dx = p.x - pn.x, dy = p.y - PANEL_Y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const w = DW * CELL, h = DH * CELL;
      for (let i = 0; i < DW * DH; i++) {
        if (!pn.dust[i]) continue;
        const cx = -w / 2 + (i % DW) * CELL + 2, cy = -h + Math.floor(i / DW) * CELL + 2;
        if (Math.hypot(cx - lx, cy - ly) < 7) { pn.dust[i] = false; changed = true; }
      }
    }
    if (changed) {
      parts.current.add({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 50, vy: -20, max: 0.6, color: '#d08a5a', fade: true, size: 2, grav: 120 });
      if (st.current.scrubSnd <= 0) { st.current.scrubSnd = 0.12; audio.play('step'); }
      if (panels.current.every((pn) => cleanFrac(pn) >= 0.9)) {
        panels.current.forEach((pn) => pn.dust.fill(false));
        setPhase('aim');
        audio.play('complete');
        hint('Sparkling clean! Now tilt each panel so its yellow arrow points at the Sun.', 'happy');
      }
    }
  };

  const tilt = (i: number, d: number) => {
    const p = panels.current[i];
    p.tilt = Math.max(-70, Math.min(70, p.tilt + d));
    audio.play('click');
    force((n) => n + 1);
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <canvas ref={canvas} width={MW} height={MH} className="mg-canvas cursor-crosshair touch-none" aria-label="Solar panels"
        onPointerDown={(e) => { brushing.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); scrub(e); }}
        onPointerMove={scrub} onPointerUp={() => { brushing.current = false; }} onPointerCancel={() => { brushing.current = false; }} />
      {phase === 'aim' && (
        <div className="flex flex-wrap justify-center gap-3">
          {panels.current.map((_, i) => (
            <div key={i} className="px-slot flex items-center gap-2 px-2 py-1">
              <button className="px-btn px-3 py-2 text-[10px]" aria-label={`Tilt panel ${i + 1} left`} onClick={() => tilt(i, -5)}>◀</button>
              <span className="font-pixel text-[9px]">PANEL {i + 1}</span>
              <button className="px-btn px-3 py-2 text-[10px]" aria-label={`Tilt panel ${i + 1} right`} onClick={() => tilt(i, 5)}>▶</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
