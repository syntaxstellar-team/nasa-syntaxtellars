import { useEffect, useRef, useState } from 'react';
import {
  useGame, useUi, openModal, advanceDialogue, choose, claimMission, dayComplete, nextDay, ui, emitUi,
} from '../store/gameStore';
import { dayDef } from '../data/days';
import { doseNow } from '../data/radiation';
import { openDosimeter } from './Devices';
import { MISSION_BY_ID } from '../data/missions';
import { Icon, NovaFace, Bar, click } from './Panels';
import { virtualKey } from '../game/input';
import { touchEnabled, onSettings } from '../game/settings';

/** Heads-up display: day, energy, resources, current objectives and quick buttons. */
export function Hud() {
  const s = useGame();
  const u = useUi();
  const def = dayDef(s.day);
  const [collapsed, setCollapsed] = useState(true);
  const done = dayComplete(s);
  const prevEnergy = useRef(s.energy);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (s.energy !== prevEnergy.current) { setPulse(true); const t = setTimeout(() => setPulse(false), 500); prevEnergy.current = s.energy; return () => clearTimeout(t); }
  }, [s.energy]);
  if (s.phase !== 'play') return null;
  const outside = u.live?.outside;
  const lowEnergy = s.energy < 15;

  return (
    <div className="hud pointer-events-none absolute inset-0 z-10">
      {/* top-left: day + resources */}
      <div className="hud-left pointer-events-auto">
        <div className="hud-card">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-pixel text-[10px] text-sun">DAY {s.day}/10</span>
            <span className="truncate text-lg text-lilac">{def.title}</span>
          </div>
          <button className={`energy ${pulse ? 'pulse' : ''} ${lowEnergy ? 'low' : ''}`} onClick={() => openModal({ kind: 'resources' })} aria-label={`Energy ${s.energy}. Open resource overview`}>
            <Icon name="energy" size={22} />
            <span className="font-pixel text-[11px]">ENERGY</span>
            <span className="font-pixel ml-auto text-sm tabular-nums">{s.energy}</span>
            {u.energyFx.map((f) => <span key={f.id} className={`energy-fx ${f.amount < 0 ? 'neg' : ''}`}>{f.amount > 0 ? '+' : ''}{f.amount}</span>)}
          </button>
          <div className="res-grid">
            <Icon name="oxygen" size={15} /><Bar value={s.oxygen} color="#43d9ff" label="Oxygen" /><span className="tabular-nums">{Math.round(s.oxygen)}</span>
            <Icon name="water" size={15} /><Bar value={s.water} color="#3a8dff" label="Water" /><span className="tabular-nums">{Math.round(s.water)}</span>
            <Icon name="food" size={15} /><Bar value={s.food} color="#5ccf5c" label="Food" /><span className="tabular-nums">{Math.round(s.food)}</span>
            <Icon name="crew" size={15} /><Bar value={s.crew} color="#ff5a7a" label="Crew health" /><span className="tabular-nums">{Math.round(s.crew)}</span>
          </div>
        </div>
        {/* mission tracker */}
        <div className="hud-card mt-2">
          <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
            <span className="font-pixel text-[8px] leading-4 text-cyan">{def.mission}</span>
            <span className="text-lg text-lilac">{collapsed ? '▸' : '▾'}</span>
          </button>
          {(() => {
            const objs = def.objectives.map((o) => ({ o, ok: o.done(s) }));
            const doneN = objs.filter((x) => x.ok).length;
            const shown = collapsed ? objs.filter((x) => !x.ok).slice(0, 1) : objs;
            return (
              <ul className="mt-1 flex flex-col gap-0.5 text-lg leading-5">
                {shown.map(({ o, ok }) => (
                  <li key={o.id} className={`flex gap-2 ${ok ? 'text-[#7dffb0]' : ''}`}><span aria-hidden>{ok ? '■' : '□'}</span><span className={ok ? 'line-through opacity-70' : ''}>{o.text}</span></li>
                ))}
                {collapsed && <li className="text-base text-lilac">{doneN}/{objs.length} done{doneN === objs.length ? ' — great job!' : ''}</li>}
                {!collapsed && s.accepted.filter((id) => MISSION_BY_ID[id]?.category !== 'main' && !s.claimed.includes(id)).slice(0, 2).map((id) => {
                  const m = MISSION_BY_ID[id];
                  return <li key={id} className="flex gap-2 text-[#f0c8ff]"><span aria-hidden>◆</span><span>{m.title} ({Math.min(m.target, m.progress(s))}/{m.target})</span></li>;
                })}
              </ul>
            );
          })()}
        </div>
      </div>

      {/* top centre: area + suit oxygen */}
      <div className="hud-center">
        {u.live && <div className="area-tag">{u.live.area}</div>}
        {outside && (
          <div className={`suit ${s.suitO2 < 25 ? 'low' : ''}`}>
            <span className="font-pixel text-[8px]">SUIT O2</span>
            <Bar value={s.suitO2} color={s.suitO2 < 25 ? '#ff4d6d' : '#43d9ff'} label="Suit oxygen" />
          </div>
        )}
        {(() => {
          const r = doseNow(s, !!outside);
          return (
            <button className={`rad-chip pointer-events-auto ${r.status === 'SOLAR EVENT' ? 'warn' : ''}`} onClick={openDosimeter} aria-label={`Suit radiation monitor: ${r.rate.toFixed(2)} millisieverts per day, simulated. Open details`}>
              <Icon name="rad" size={13} />
              <span className="font-pixel text-[7px]">RAD</span>
              <span className="tabular-nums">{r.rate.toFixed(2)} mSv/day</span>
              <span className="font-pixel text-[6px] opacity-70">SIM</span>
            </button>
          );
        })()}
      </div>

      {/* top-right: buttons */}
      <nav className="hud-right pointer-events-auto" aria-label="Game menus">
        <button className="hud-btn" onClick={() => openModal({ kind: 'board' })}><span className="font-pixel text-[8px]">MISSIONS</span></button>
        <button className="hud-btn" onClick={() => openModal({ kind: 'journal' })}><Icon name="research" size={16} /><span className="font-pixel text-[8px]">JOURNAL</span></button>
        <button className="hud-btn" onClick={() => openModal({ kind: 'inventory' })}><span className="font-pixel text-[8px]">ITEMS</span></button>
        <button className="hud-btn" onClick={() => openModal({ kind: 'pause' })} aria-label="Pause"><span className="font-pixel text-[10px]">II</span></button>
      </nav>

      {/* bottom-right: next day */}
      {done && !u.dialogue.length && !u.cinematic && (
        <button className="next-day pointer-events-auto px-btn text-[10px]" onClick={() => { click(); nextDay(); }}>NEXT DAY ▸</button>
      )}

      {/* toasts and notices */}
      <div className="toasts" aria-live="polite">
        {u.toasts.map((t) => <div key={t.id} className="toast fadein">{t.text}</div>)}
      </div>
      {u.notice && <Notice title={u.notice.title} sub={u.notice.sub} />}
      {Date.now() - u.lastSaved < 1500 && <div className="saved">SAVED ✓</div>}
    </div>
  );
}

function Notice({ title, sub }: { title: string; sub?: string }) {
  useEffect(() => {
    const t = setTimeout(() => { ui.notice = null; emitUi(); }, 3200);
    return () => clearTimeout(t);
  }, [title]);
  return (
    <div className="notice fadein" role="status">
      <div className="font-pixel text-sm text-sun sm:text-base">{title}</div>
      {sub && <div className="text-2xl text-lilac">{sub}</div>}
    </div>
  );
}

/** NOVA's dialogue box, with choices when a decision is needed. */
export function DialogueBox() {
  const u = useUi();
  const line = u.dialogue[0];
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); }, [line]);
  useEffect(() => {
    if (!line || shown >= line.text.length) return;
    const t = setTimeout(() => setShown((n) => Math.min(line.text.length, n + 2)), 16);
    return () => clearTimeout(t);
  }, [line, shown]);
  useEffect(() => {
    if (!line || line.choices) return;
    const h = (e: KeyboardEvent) => {
      if (ui.modal) return;
      if (['Space', 'Enter', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (shown < line.text.length) setShown(line.text.length);
        else advanceDialogue();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [line, shown]);
  if (!line || u.modal) return null;
  const full = shown >= line.text.length;
  const isNova = line.speaker === 'NOVA';
  return (
    <div className="dialogue fadein" role="dialog" aria-label={`${line.speaker} says`}>
      {isNova ? <NovaFace mood={line.mood} size={72} /> : <div className="speaker-badge font-pixel text-[9px]">{line.speaker.slice(0, 2)}</div>}
      <div className="min-w-0 flex-1">
        <div className="font-pixel mb-1 text-[10px] text-cyan">{line.speaker}</div>
        <p className="text-2xl leading-7" aria-live="polite">{line.text.slice(0, shown)}<span className="opacity-0">{line.text.slice(shown)}</span></p>
        {line.choices && full && (
          <div className="mt-2 flex flex-col gap-2">
            {line.choices.map((c, i) => (
              <button key={i} autoFocus={i === 0} className={`choice ${c.disabled ? 'disabled' : ''}`} onClick={() => choose(c)} aria-disabled={c.disabled}>
                <span>{c.label}</span>
                {c.note && <span className="text-lg text-lilac">{c.note}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {!line.choices && (
        <button className="px-btn self-end px-3 py-2 text-[9px]" onClick={() => { if (!full) setShown(line.text.length); else advanceDialogue(); }}>
          {full ? 'NEXT ▸' : 'SKIP ▸'}
        </button>
      )}
    </div>
  );
}

/** Popup when a mission is completed. */
export function RewardPopup() {
  const u = useUi();
  const r = u.rewards[0];
  if (!r || u.modal || u.dialogue.length) return null;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Mission complete">
      <div className="px-panel pop flex w-full max-w-md flex-col items-center gap-3 p-6 text-center">
        <NovaFace mood="celebrating" size={80} />
        <div className="font-pixel text-sm text-[#7dffb0]">{r.title.toUpperCase()}</div>
        <div className="text-3xl">{r.text}</div>
        <div className="flex flex-wrap justify-center gap-4 text-2xl">
          {r.energy > 0 && <span className="flex items-center gap-1 text-sun"><Icon name="energy" size={22} /> +{r.energy}</span>}
          {r.research > 0 && <span className="flex items-center gap-1 text-[#d8b8ff]"><Icon name="research" size={22} /> +{r.research} research</span>}
        </div>
        <button autoFocus className="px-btn text-xs" onClick={() => { if (r.missionId) claimMission(r.missionId); }}>COLLECT REWARD</button>
      </div>
    </div>
  );
}

/** On-screen buttons for touch devices. */
export function TouchControls() {
  const [on, setOn] = useState(touchEnabled());
  useEffect(() => onSettings(() => setOn(touchEnabled())), []);
  const u = useUi();
  const s = useGame();
  if (!on || u.modal || s.phase !== 'play') return null;
  const hold = (code: string) => ({
    onPointerDown: (e: { preventDefault: () => void }) => { e.preventDefault(); virtualKey(code, true); },
    onPointerUp: () => virtualKey(code, false),
    onPointerLeave: () => virtualKey(code, false),
    onPointerCancel: () => virtualKey(code, false),
  });
  return (
    <div className="touch pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between">
      <div className="pointer-events-auto flex gap-2">
        <button className="tbtn" aria-label="Walk left" {...hold('ArrowLeft')}>◀</button>
        <button className="tbtn" aria-label="Walk right" {...hold('ArrowRight')}>▶</button>
      </div>
      <div className="pointer-events-auto flex gap-2">
        <button className="tbtn" aria-label="Jump" {...hold('Space')}>▲</button>
        <button className="tbtn act" aria-label="Use" {...hold('KeyE')}>E</button>
      </div>
    </div>
  );
}
