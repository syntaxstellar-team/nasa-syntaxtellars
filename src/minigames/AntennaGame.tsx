import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPE } from 'react';
import { MW, MH, MiniGameProps, useLoop, logical } from './common';
import { rect, disc, line } from '../game/art/canvas';
import { drawText } from '../game/font';
import { audio } from '../game/audio';

const FMIN = 100, FMAX = 200;

export default function AntennaGame({ level, onWin, hint }: MiniGameProps) {
  const lv = Math.min(2, level);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'tune' | 'lock' | 'ready' | 'send' | 'won'>('tune');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const st = useRef({
    t: 0, f: 112, target: 140 + Math.round(Math.random() * 45) + 0.5, sweep: FMIN, drift: 0, hold: 0, sendT: 0, wonT: 0, beep: 0,
    turning: 0,
  });
  const tol = lv === 1 ? 2.2 : 1.4;
  (window as unknown as Record<string, unknown>).__mg = { kind: 'antenna', st: st.current };
  const dragging = useRef<{ x: number; f: number } | null>(null);

  const strength = () => {
    const d = Math.abs(st.current.f - st.current.target);
    return Math.exp(-(d * d) / 60);
  };

  useLoop((dt, t) => {
    const s = st.current;
    s.t = t;
    const ph = phaseRef.current;
    s.f = Math.max(FMIN, Math.min(FMAX, s.f + s.turning * dt * 14));
    // scanning sweep: a moving indicator that blips near the hidden frequency
    s.sweep += dt * 30;
    if (s.sweep > FMAX) s.sweep = FMIN;
    s.beep -= dt;
    const sig = strength();
    if (ph === 'tune') {
      if (s.beep <= 0 && sig > 0.3) { s.beep = 0.6 - sig * 0.45; audio.play('click'); }
      if (sig > 0.92) { setPhase('lock'); audio.play('robot'); hint('There it is! Now the static will push the dial around. Keep the needle inside the green LOCK zone.', 'surprised'); }
    }
    if (ph === 'lock') {
      // interference drifts the dial; the player has to correct it
      s.drift += (Math.random() - 0.5) * dt * (lv === 1 ? 6 : 12);
      s.drift *= 0.985;
      s.f += s.drift * dt * (lv === 1 ? 2.2 : 3.4);
      const inside = Math.abs(s.f - s.target) < tol;
      s.hold = inside ? s.hold + dt : Math.max(0, s.hold - dt * 0.7);
      if (s.hold >= 3) { setPhase('ready'); audio.play('complete'); hint('Signal locked and steady! Press TRANSMIT to call Earth.', 'celebrating'); }
    }
    if (ph === 'send') {
      s.sendT += dt;
      if (s.sendT > 3.2) { setPhase('won'); s.wonT = 0.01; audio.play('complete'); }
    }
    if (ph === 'won') { s.wonT += dt; if (s.wonT > 1.2 && s.wonT < 50) { s.wonT = 99; onWin(); } }
    draw();
  });

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.current.turning = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') st.current.turning = 1;
    };
    const ku = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) st.current.turning = 0; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  function draw(): void {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = st.current, ph = phaseRef.current;
    rect(ctx, 0, 0, MW, MH, '#120a2a');
    if (ph === 'send' || ph === 'won') { drawSend(ctx, s.sendT); return; }
    // radio screen
    rect(ctx, 16, 18, 288, 92, '#1e2236'); rect(ctx, 20, 22, 280, 84, '#06140e');
    const sig = strength();
    for (let x = 0; x < 280; x++) {
      const noise = (Math.random() - 0.5) * 30 * (1 - sig);
      const wave = Math.sin(x * 0.25 + s.t * 10) * 18 * sig;
      const y = 64 + Math.round(wave + noise);
      rect(ctx, 20 + x, y, 1, 1, sig > 0.9 ? '#3dff8a' : '#2a8a5a');
    }
    // frequency band + sweep indicator
    rect(ctx, 20, 116, 280, 14, '#1e2236');
    const fx = (f: number) => 20 + ((f - FMIN) / (FMAX - FMIN)) * 280;
    for (let f = FMIN; f <= FMAX; f += 10) { rect(ctx, fx(f), 116, 1, 4, '#5a6080'); }
    const swx = fx(s.sweep);
    const near = Math.abs(s.sweep - s.target) < 6;
    rect(ctx, swx, 116, 1, 14, near ? '#ffd43b' : '#5a6080');
    if (near) rect(ctx, swx - 2, 112, 5, 3, '#ffd43b');
    // lock zone
    if (ph !== 'tune') {
      const zx = fx(s.target - tol), zw = fx(s.target + tol) - zx;
      rect(ctx, zx, 116, zw, 14, 'rgba(61,255,138,0.35)');
      drawText(ctx, 'LOCK', zx + zw / 2, 133, { align: 'center', color: '#3dff8a' });
    }
    // needle
    const nx = fx(s.f);
    rect(ctx, nx - 1, 114, 3, 18, '#ff8a3d');
    rect(ctx, nx - 3, 112, 7, 3, '#ff8a3d');
    // readouts
    drawText(ctx, `${s.f.toFixed(1)} MHZ`, 30, 28, { color: '#3dff8a' });
    for (let k = 0; k < 6; k++) rect(ctx, 250 + k * 7, 40 - k * 3, 5, 6 + k * 3, sig > (k + 1) / 7 ? '#3dff8a' : '#1e3a2a');
    drawText(ctx, 'SIGNAL', 270, 46, { align: 'center', color: '#3dff8a' });
    // dial knob
    disc(ctx, 160, 152, 14, '#4c5068'); disc(ctx, 160, 152, 10, '#8f99b3');
    const a = (s.f / 4) % (Math.PI * 2);
    line(ctx, 160, 152, 160 + Math.cos(a) * 8, 152 + Math.sin(a) * 8, '#1e2236', 2);
    drawText(ctx, 'DRAG OR USE ARROWS', 160, 169, { align: 'center', color: '#8f99b3' });
    if (ph === 'lock') {
      rect(ctx, 210, 150, 90, 6, '#1e2236');
      rect(ctx, 211, 151, Math.round(88 * Math.min(1, s.hold / 3)), 4, '#3dff8a');
      drawText(ctx, 'HOLD STEADY', 255, 160, { align: 'center', color: '#3dff8a' });
    }
    const label = ph === 'tune' ? '1. FIND EARTH: FILL THE SIGNAL BARS' : ph === 'lock' ? '2. KEEP THE NEEDLE IN THE LOCK ZONE' : '3. READY TO TRANSMIT!';
    drawText(ctx, label, MW / 2, 6, { align: 'center', color: '#b49cff' });
  }

  function drawSend(ctx: CanvasRenderingContext2D, t: number): void {
    // a pixel signal travels from Mars to Earth
    for (let k = 0; k < 60; k++) rect(ctx, (k * 53) % MW, (k * 31) % MH, 1, 1, '#ffffff');
    disc(ctx, 30, 120, 18, '#c0603a'); disc(ctx, 26, 116, 8, '#e08a5a');
    drawText(ctx, 'MARS', 30, 144, { align: 'center', color: '#e08a5a' });
    disc(ctx, 290, 50, 10, '#3a8dff'); rect(ctx, 286, 46, 6, 4, '#5ccf5c'); rect(ctx, 292, 52, 4, 3, '#5ccf5c');
    drawText(ctx, 'EARTH', 290, 66, { align: 'center', color: '#9fd0ff' });
    const k = Math.min(1, t / 3);
    for (let w = 0; w < 4; w++) {
      const kk = Math.max(0, k - w * 0.06);
      const x = 48 + (276 - 48) * kk, y = 110 - (110 - 54) * kk;
      ctx.strokeStyle = `rgba(95,243,255,${1 - w * 0.22})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 4 + w * 3, -Math.PI * 0.25, Math.PI * 0.25); ctx.stroke();
    }
    drawText(ctx, 'MESSAGE TRAVELLING AT THE SPEED OF LIGHT...', MW / 2, 8, { align: 'center', color: '#5ff3ff' });
    drawText(ctx, k >= 1 ? 'RECEIVED BY EARTH!' : `${Math.round(k * 100)}%`, MW / 2, 166, { align: 'center', color: k >= 1 ? '#3dff8a' : '#ffffff' });
  }

  const down = (e: RPE) => {
    const p = logical(e, canvas.current!);
    if (p.y > 108) {
      dragging.current = { x: p.x, f: st.current.f };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };
  const move = (e: RPE) => {
    if (!dragging.current) return;
    const p = logical(e, canvas.current!);
    st.current.f = Math.max(FMIN, Math.min(FMAX, dragging.current.f + (p.x - dragging.current.x) * 0.35));
  };
  const up = () => { dragging.current = null; };
  const hold = (dir: number) => () => { st.current.turning = dir; };

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <canvas ref={canvas} width={MW} height={MH} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="mg-canvas cursor-ew-resize touch-none" aria-label="Radio tuner" />
      <div className="flex flex-wrap items-center justify-center gap-3">
        {(phase === 'tune' || phase === 'lock') && (
          <>
            <button className="px-btn select-none px-4 text-xs" aria-label="Tune down" onPointerDown={hold(-1)} onPointerUp={hold(0)} onPointerLeave={hold(0)}>◀ TUNE</button>
            <button className="px-btn select-none px-4 text-xs" aria-label="Tune up" onPointerDown={hold(1)} onPointerUp={hold(0)} onPointerLeave={hold(0)}>TUNE ▶</button>
          </>
        )}
        {phase === 'ready' && <button className="px-btn text-xs" onClick={() => { setPhase('send'); audio.play('transmit'); }}>TRANSMIT ▸</button>}
      </div>
    </div>
  );
}
