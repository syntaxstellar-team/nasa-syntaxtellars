import { useRef, useState } from 'react';
import { MW, MH, MiniGameProps, useLoop } from './common';
import { rect, disc, line } from '../game/art/canvas';
import { drawText } from '../game/font';
import { audio } from '../game/audio';

interface Plant { name: string; water: [number, number]; light: [number, number]; temp: [number, number]; days: number }
const PLANTS: Plant[] = [
  { name: 'SPACE LETTUCE', water: [5, 7], light: [12, 16], temp: [16, 24], days: 6 },
  { name: 'MOON POTATO', water: [3, 5], light: [14, 18], temp: [14, 20], days: 9 },
];

type Problem = 'dry' | 'soggy' | 'dark' | 'scorched' | 'cold' | 'hot';
interface Result { problems: Problem[]; mature: boolean; growth: number }

function evaluate(p: Plant, water: number, light: number, temp: number, days: number): Result {
  const problems: Problem[] = [];
  if (water < p.water[0]) problems.push('dry');
  if (water > p.water[1]) problems.push('soggy');
  if (light < p.light[0]) problems.push('dark');
  if (light > p.light[1]) problems.push('scorched');
  if (temp < p.temp[0]) problems.push('cold');
  if (temp > p.temp[1]) problems.push('hot');
  return { problems, mature: days >= p.days, growth: Math.min(1, days / p.days) };
}

const ADVICE: Record<Problem, string> = {
  dry: 'The leaves are droopy and crispy. The roots are thirsty: try more water.',
  soggy: 'The leaves turned yellow and the roots look soggy. Too much water stops roots from breathing.',
  dark: 'The stem got tall and pale, stretching to find light. It needs more hours of light.',
  scorched: 'Brown burnt spots! Too many hours of strong light. Plants need some dark time too.',
  cold: 'The plant is tiny and purple. It is too cold to grow quickly.',
  hot: 'The plant is wilting in the heat. Cool the greenhouse down a little.',
};

/**
 * NOVA's three greenhouse hints, from general to exact. Hint 3 reads the plant's real
 * growing ranges straight from PLANTS, so it always matches what evaluate() checks.
 */
export function greenhouseHint(level: 1 | 2 | 3, p: Plant, water: number, light: number, temp: number, days: number): string {
  if (level === 1) return 'Plants need enough water, light and warmth — but not too much of any of them. After each try, look at the leaves: their colour and shape tell you what to change.';
  if (level === 2) {
    const r = evaluate(p, water, light, temp, days);
    const part = (name: string, low: Problem, high: Problem, ok: string) => (r.problems.includes(low) ? `${name}: needs MORE` : r.problems.includes(high) ? `${name}: needs LESS` : `${name}: ${ok}`);
    return [
      `With your current settings — ${part('water', 'dry', 'soggy', 'good')}; ${part('light', 'dark', 'scorched', 'good')}; ${part('temperature', 'cold', 'hot', 'good')};`,
      `growing time: ${r.mature ? 'long enough' : 'needs MORE days'}.`,
    ].join(' ');
  }
  return `${p.name} grows well with ${p.water[0]}–${p.water[1]} cups of water, ${p.light[0]}–${p.light[1]} hours of light and ${p.temp[0]}–${p.temp[1]} °C, and needs at least ${p.days} growing days.`;
}

function Slider({ id, label, value, set, min, max, unit, disabled }: { id: string; label: string; value: number; set: (v: number) => void; min: number; max: number; unit: string; disabled: boolean }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="flex justify-between text-xl"><span>{label}</span><b className="text-cyan">{value}{unit}</b></span>
      <input id={id} className="px-range w-full" type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}

export default function GreenhouseGame({ level, onWin, hint }: MiniGameProps) {
  const plant = PLANTS[Math.min(2, level) - 1];
  const canvas = useRef<HTMLCanvasElement>(null);
  const [water, setWater] = useState(2);
  const [light, setLight] = useState(6);
  const [temp, setTemp] = useState(30);
  const [days, setDays] = useState(3);
  const [growing, setGrowing] = useState(false);
  const [tries, setTries] = useState<{ w: number; l: number; t: number; d: number; ok: boolean }[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const askNova = () => {
    const next = Math.min(3, hintLevel + 1) as 1 | 2 | 3;
    setHintLevel(next);
    audio.play('robot');
    hint(`Hint ${next} of 3: ${greenhouseHint(next, plant, water, light, temp, days)}`, next === 3 ? 'happy' : 'thinking');
  };
  const st = useRef({ t: 0, grow: 0, result: null as Result | null, wonT: 0, dayShown: 0 });

  useLoop((dt, t) => {
    const s = st.current;
    s.t = t;
    if (growing && s.grow < 1) {
      s.grow = Math.min(1, s.grow + dt / 2.6);
      const dshow = Math.floor(s.grow * days);
      if (dshow !== s.dayShown) { s.dayShown = dshow; audio.play('pickup'); }
      if (s.grow >= 1) finish();
    }
    if (s.wonT > 0) { s.wonT += dt; if (s.wonT > 1.4 && s.wonT < 50) { s.wonT = 99; onWin(); } }
    draw();
  });

  function finish(): void {
    const s = st.current;
    setGrowing(false);
    const r = s.result!;
    const ok = r.problems.length === 0 && r.mature;
    setTries((tr) => [{ w: water, l: light, t: temp, d: days, ok }, ...tr].slice(0, 4));
    if (ok) {
      audio.play('complete');
      s.wonT = 0.01;
      hint(`A healthy ${plant.name.toLowerCase()}! You found the right water, light and warmth.`, 'celebrating');
    } else if (r.problems.length) {
      audio.play('error');
      hint(ADVICE[r.problems[0]], 'thinking');
    } else {
      audio.play('error');
      hint('The plant is healthy, but still small. Give it more growing days!', 'curious');
    }
  }

  const grow = () => {
    if (growing) return;
    st.current.result = evaluate(plant, water, light, temp, days);
    st.current.grow = 0;
    st.current.dayShown = 0;
    setGrowing(true);
    audio.play('whoosh');
  };

  function draw(): void {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = st.current;
    // greenhouse interior
    rect(ctx, 0, 0, MW, MH, '#1c2a2a');
    for (let x = 0; x < MW; x += 40) rect(ctx, x, 0, 2, 120, '#2a3c3c');
    // grow lamp glow by light hours
    const lightK = Math.min(1, light / 18);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,111,216,${0.05 + lightK * 0.18})`;
    ctx.fillRect(100, 18, 120, 120);
    ctx.restore();
    rect(ctx, 100, 14, 120, 4, '#454c63'); rect(ctx, 104, 18, 112, 2, light > 0 ? '#ff6fd8' : '#3a2a3a');
    // thermometer
    rect(ctx, 28, 30, 8, 90, '#e8e6f2'); rect(ctx, 30, 32, 4, 86, '#1e2236');
    const th = Math.round(86 * Math.min(1, temp / 40));
    rect(ctx, 30, 118 - th, 4, th, temp > plant.temp[1] ? '#ff4d6d' : temp < plant.temp[0] ? '#43d9ff' : '#3dff8a');
    disc(ctx, 32, 124, 6, temp > plant.temp[1] ? '#ff4d6d' : temp < plant.temp[0] ? '#43d9ff' : '#3dff8a');
    drawText(ctx, `${temp}C`, 32, 134, { align: 'center', color: '#ffffff' });
    // water gauge
    rect(ctx, 270, 40, 22, 80, '#4c5068'); rect(ctx, 273, 43, 16, 74, '#1e2236');
    const wh = Math.round(74 * water / 10);
    rect(ctx, 273, 117 - wh, 16, wh, '#3a8dff');
    drawText(ctx, 'H2O', 281, 128, { align: 'center', color: '#3a8dff' });
    // pot
    rect(ctx, 136, 140, 48, 26, '#8a5a3c'); rect(ctx, 132, 136, 56, 6, '#b07a52');
    rect(ctx, 136, 142, 48, 4, water > plant.water[1] && s.result ? '#2a4a6a' : '#3a2418');
    // plant
    const r = growing || s.result ? s.result : null;
    const k = growing ? s.grow : s.result ? 1 : 0;
    this_plant(ctx, 160, 138, r, k, s.t);
    // day counter while growing
    if (growing) drawText(ctx, `DAY ${Math.max(1, Math.ceil(s.grow * days))} / ${days}`, 160, 6, { align: 'center', color: '#ffd43b' });
    else drawText(ctx, plant.name, 160, 6, { align: 'center', color: '#5ccf5c' });
  }

  // pixel plant drawn from the result
  function this_plant(ctx: CanvasRenderingContext2D, x: number, y: number, r: Result | null, k: number, t: number): void {
    if (!r || k <= 0) { rect(ctx, x - 1, y - 3, 3, 3, '#5ccf5c'); return; }
    const has = (p: Problem) => r.problems.includes(p);
    let leaf = '#5ccf5c', stem = '#2f8a3a';
    if (has('soggy')) leaf = '#d8d05a';
    if (has('dry')) leaf = '#9aa84a';
    if (has('dark')) { leaf = '#b8e0a0'; stem = '#9ac08a'; }
    if (has('cold')) leaf = '#7a5aa8';
    if (has('hot')) leaf = '#8aa04a';
    const sizeK = has('cold') ? 0.4 : 1;
    const tall = has('dark') ? 1.6 : 1;
    const h = Math.round(70 * k * sizeK * tall * r.growth + 6);
    const droop = has('dry') || has('hot') ? 1 : 0;
    const sway = Math.round(Math.sin(t * 1.5) * 1);
    line(ctx, x, y, x + sway, y - h, stem, 2);
    const leaves = Math.max(1, Math.floor((h / 9) * (has('dark') ? 0.5 : 1)));
    for (let i = 0; i < leaves; i++) {
      const ly = y - 6 - i * 9;
      const lw = Math.round((has('dark') ? 4 : 9) * sizeK * (0.6 + 0.4 * k));
      const dy = droop ? 4 : -2;
      line(ctx, x, ly, x - lw, ly + dy, leaf, 3);
      line(ctx, x, ly - 3, x + lw, ly - 3 + dy, leaf, 3);
      if (has('scorched') && i % 2 === 0) { rect(ctx, x - lw + 1, ly + dy, 2, 2, '#6a3a1a'); rect(ctx, x + lw - 2, ly - 3 + dy, 2, 2, '#6a3a1a'); }
    }
    if (r.mature && r.problems.length === 0 && k >= 1) {
      if (plant.name.includes('POTATO')) { disc(ctx, x - 10, y + 10, 4, '#c8a060'); disc(ctx, x + 9, y + 12, 3, '#c8a060'); }
      else { disc(ctx, x, y - h, 6, '#7fe07f'); disc(ctx, x - 3, y - h + 2, 4, '#5ccf5c'); }
      if (Math.floor(t * 3) % 2) rect(ctx, x + 10, y - h - 4, 2, 2, '#ffffff');
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <canvas ref={canvas} width={MW} height={MH} className="mg-canvas" aria-label="Greenhouse plant" />
      <div className="grid w-full max-w-2xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <Slider id="gh-water" label="Water (cups per day)" value={water} set={setWater} min={0} max={10} unit="" disabled={growing} />
        <Slider id="gh-light" label="Light (hours per day)" value={light} set={setLight} min={0} max={24} unit="h" disabled={growing} />
        <Slider id="gh-temp" label="Temperature" value={temp} set={setTemp} min={0} max={40} unit="°C" disabled={growing} />
        <Slider id="gh-days" label="Growing time" value={days} set={setDays} min={1} max={12} unit=" days" disabled={growing} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button className="px-btn text-xs" disabled={growing} onClick={grow}>GROW PLANT</button>
        <button className="px-btn ghost text-[10px]" disabled={growing} onClick={askNova}>{hintLevel >= 3 ? 'NOVA: REPEAT HINT 3' : `ASK NOVA FOR HELP (${hintLevel + 1}/3)`}</button>
        {tries.length > 0 && (
          <div className="text-lg text-lilac" aria-live="polite">
            Notebook: {tries.map((t, i) => <span key={i} className={`mr-2 ${t.ok ? 'text-[#7dffb0]' : ''}`}>[water {t.w}, {t.l}h, {t.t}°, {t.d}d {t.ok ? '✓' : '✗'}]</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
