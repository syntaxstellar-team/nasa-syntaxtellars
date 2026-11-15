import { useEffect, useRef } from 'react';
import { useGame, retryDay } from '../store/gameStore';
import type { EndingId } from '../store/types';
import { VIEW_W } from '../game/constants';
import { bakeBaseExterior } from '../game/art/baseArt';
import { makeStars } from '../game/planet';
import { disc, rect, line } from '../game/art/canvas';
import { sprites } from '../game/art/sprites';
import { audio } from '../game/audio';
import { NovaFace, Icon, click } from './Panels';
import { EngArchive } from './EngJournal';

const ENDINGS: Record<EndingId, { title: string; color: string; text: string }> = {
  success: {
    title: 'SUCCESSFUL MISSION', color: '#7dffb0',
    text: 'The crew is healthy, Earth can hear us again, and your rock studies are on their way home. You explored Mars carefully and kept its research sites unspoiled. That is real scientist behavior!',
  },
  survival: {
    title: 'SURVIVAL FIRST', color: '#ffd43b',
    text: 'The crew is safe and communication is restored. Some research is still unfinished — Mars still has secrets for the next expedition to discover.',
  },
  ecological: {
    title: 'DAMAGED RESEARCH SITES', color: '#ff8a5a',
    text: 'Earth can hear us again, but some of our choices spoiled untouched sites that scientists wanted to study. Next time, maybe we can find ways that protect what we explore.'
  },
  failed: {
    title: 'MISSION FAILED', color: '#ff4d6d',
    text: 'The base ran too low on air, water or food, and the crew had to stop the mission. Every explorer has setbacks. Try the day again and keep life support powered first!',
  },
};

const CAREERS = [
  { id: 'astronaut', name: 'Astronaut', text: 'Flies to space, runs experiments and keeps the station working.' },
  { id: 'engineer', name: 'Space Engineer', text: 'Designs power systems, habitats and rockets.' },
  { id: 'robotics', name: 'Robotics Engineer', text: 'Builds and programs robots like NOVA and Mars rovers.' },
  { id: 'astrobiologist', name: 'Planetary Geologist', text: 'Studies rocks to learn how planets like Mars formed and changed.' },
];

function EndingCanvas({ ending }: { ending: EndingId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    c.width = VIEW_W; c.height = 150;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const base = bakeBaseExterior();
    const stars = makeStars(120);
    const spr = sprites();
    let raf = 0, t = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
      const g = ctx.createLinearGradient(0, 0, 0, 150);
      g.addColorStop(0, '#1a1048'); g.addColorStop(1, ending === 'failed' ? '#3a1a2a' : '#c97a5a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 150);
      for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t + s.tw)); rect(ctx, s.x * VIEW_W, s.y * 90, 1, 1, '#ffffff'); }
      ctx.globalAlpha = 1;
      disc(ctx, 400, 30, 4, '#3a8dff'); rect(ctx, 399, 29, 2, 1, '#5ccf5c');
      rect(ctx, 0, 130, VIEW_W, 20, '#a64e30'); rect(ctx, 0, 130, VIEW_W, 2, '#f0a070');
      ctx.drawImage(base, 110, 10);
      if (ending !== 'failed') {
        for (let k = 0; k < 5; k++) {
          const p = ((t * 0.5 + k / 5) % 1);
          const x = 230 + (400 - 230) * p, y = 50 + (30 - 50) * p;
          ctx.strokeStyle = `rgba(95,243,255,${1 - p})`;
          ctx.beginPath(); ctx.arc(x, y, 3 + p * 6, -0.8, 0.8); ctx.stroke();
        }
      } else if (Math.floor(t * 2) % 2) rect(ctx, 228, 46, 4, 4, '#ff4d6d');
      // the astronaut, NOVA and the scout drone
      ctx.drawImage(spr.astro.idle[Math.floor(t * 2) % 2], 70, 106);
      ctx.drawImage(spr.nova[ending === 'failed' ? 'worried' : 'celebrating'][Math.floor(t * 8) % 2], 40, 96 + Math.round(Math.sin(t * 2) * 2));
      if (ending !== 'failed') ctx.drawImage(spr.drone[Math.floor(t * 30) % 3], 340 + Math.round(Math.sin(t * 0.6) * 40), 70 + Math.round(Math.sin(t) * 8));
      line(ctx, 0, 149, VIEW_W, 149, '#5a2416');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    audio.setMusic(ending === 'failed' ? 'night' : 'ending');
    return () => cancelAnimationFrame(raf);
  }, [ending]);
  return <canvas ref={ref} className="ending-canvas" aria-label="The outpost after the mission" />;
}

export function Ending({ onMenu, onNewGame }: { onMenu: () => void; onNewGame: () => void }) {
  const s = useGame();
  const id = s.ending ?? 'survival';
  const e = ENDINGS[id];
  const rocks = s.analyzed.length;
  return (
    <div className="ending-root" role="dialog" aria-modal="true" aria-label="Ending">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-6">
        <EndingCanvas ending={id} />
        <header className="text-center">
          <div className="font-pixel text-[10px] text-lilac">{id === 'failed' ? `DAY ${s.day}` : 'DAY 10 — HOME SIGNAL'}</div>
          <h1 className="font-pixel mt-2 text-xl leading-9 sm:text-2xl" style={{ color: e.color }}>{e.title}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-2xl leading-7">{e.text}</p>
        </header>
        <ul className="grid grid-cols-2 gap-2 text-xl sm:grid-cols-4">
          <li className="px-slot flex items-center gap-2 p-2"><Icon name="crew" size={22} />Crew health <b className="ml-auto">{Math.round(s.crew)}</b></li>
          <li className="px-slot flex items-center gap-2 p-2"><Icon name="research" size={22} />Research <b className="ml-auto">{s.research}</b></li>
          <li className="px-slot flex items-center gap-2 p-2"><Icon name="eco" size={22} />Site protection <b className="ml-auto">{s.ecosystem}%</b></li>
          <li className="px-slot flex items-center gap-2 p-2"><Icon name="basalt" size={22} />Rocks analyzed <b className="ml-auto">{rocks}/4</b></li>
        </ul>
        {id !== 'failed' && (
          <>
            <div className="px-panel flex items-start gap-4 p-4">
              <NovaFace mood="celebrating" size={72} />
              <p className="text-2xl leading-7">"You did it, explorer! You helped save ARES-7! Remember, real space missions need engineers, scientists, programmers, roboticists, biologists and astronauts. Maybe one day you'll be one of them!"</p>
            </div>
            <section>
              <h2 className="font-pixel mb-3 text-center text-[10px] text-cyan">WHO WORKS ON SPACE MISSIONS?</h2>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {CAREERS.map((c) => (
                  <li key={c.id} className="px-slot flex flex-col items-center gap-2 p-3 text-center">
                    <img src={sprites().careerUrl[c.id]} alt="" width={72} height={72} className="pixelated" />
                    <b className="text-2xl leading-6">{c.name}</b>
                    <span className="text-xl leading-5 text-[var(--muted)]">{c.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {(s.finalReport || s.engReports.length > 0) && (
          <section className="px-panel p-4">
            <div className="mb-3 flex items-center gap-3">
              <NovaFace mood={id === 'failed' ? 'worried' : 'thinking'} size={48} />
              <h2 className="font-pixel text-[11px] leading-6 text-cyan">NOVA ENGINEERING JOURNAL — FINAL MISSION REPORT</h2>
            </div>
            <EngArchive reports={s.engReports} final={s.finalReport} />
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {id === 'failed' && <button autoFocus className="px-btn text-xs" onClick={() => { click(); retryDay(); }}>TRY DAY {s.day} AGAIN</button>}
          <button className="px-btn text-xs" onClick={() => { click(); onNewGame(); }}>PLAY AGAIN</button>
          <button className="px-btn ghost text-xs" onClick={() => { click(); onMenu(); }}>MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}
