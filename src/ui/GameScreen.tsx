import { useEffect, useRef, useState } from 'react';
import { World } from '../game/World';
import { VIEW_W, VIEW_H } from '../game/constants';
import { useGame, useUi, openModal, saveNow, ui, getState } from '../store/gameStore';
import { setWorld } from './worldRef';
import { Hud, DialogueBox, RewardPopup, TouchControls } from './Hud';
import { MissionBoard, Journal, Inventory, Upgrades, Checklist, StormPlan, Resources, Science, Briefing, Report } from './Screens';
import { Launcher, MiniGameModal, PowerGridModal } from './MiniGameModal';
import { ScienceInfo, WeatherTerminal, WaterSystem, RockAnalyzer, Dosimeter, DataLink } from './Devices';
import { Modal, SettingsPanel, ControlsPanel, click } from './Panels';
import { Ending } from './Ending';

/** Size the game canvas to fill the screen, keeping its 16:9 shape. */
function fit(canvas: HTMLCanvasElement): void {
  const p = canvas.parentElement!;
  const w = p.clientWidth, h = p.clientHeight;
  const k = Math.min(w / VIEW_W, h / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * k)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * k)}px`;
}

export function GameScreen({ onMenu, onNewGame }: { onMenu: () => void; onNewGame: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useGame();
  const u = useUi();
  const [controls, setControls] = useState(false);

  useEffect(() => {
    const w = new World(ref.current!);
    setWorld(w);
    const r = () => fit(ref.current!);
    r();
    window.addEventListener('resize', r);
    const esc = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !ui.modal && !ui.dialogue.length && getState().phase === 'play') { e.preventDefault(); openModal({ kind: 'pause' }); }
    };
    window.addEventListener('keydown', esc);
    const hide = () => { if (document.hidden) saveNow(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      w.destroy();
      setWorld(null);
      window.removeEventListener('resize', r);
      window.removeEventListener('keydown', esc);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  const m = u.modal;
  const close = () => openModal(null);
  const showBriefing = s.phase === 'briefing' && (s.day > 1 || !!s.flags.woke) && !u.cinematic && !u.dialogue.length;

  return (
    <div className="game-root">
      <div className="stage"><canvas ref={ref} aria-label="The ARES-7 research outpost" /></div>
      <div className="rotate-tip" aria-hidden="true">Turn your device sideways for a bigger view</div>
      <Hud />
      <TouchControls />
      <DialogueBox />
      <RewardPopup />
      {showBriefing && <Briefing />}
      {s.phase === 'report' && <Report />}
      {m?.kind === 'board' && <MissionBoard />}
      {m?.kind === 'journal' && <Journal />}
      {m?.kind === 'inventory' && <Inventory />}
      {m?.kind === 'upgrades' && <Upgrades />}
      {m?.kind === 'checklist' && <Checklist />}
      {m?.kind === 'stormplan' && <StormPlan />}
      {m?.kind === 'resources' && <Resources />}
      {m?.kind === 'science' && <Science onClose={() => openModal({ kind: 'pause' })} />}
      {m?.kind === 'info' && <ScienceInfo key={m.id} id={m.id} next={m.next} back={m.back} />}
      {m?.kind === 'weather' && <WeatherTerminal />}
      {m?.kind === 'water' && <WaterSystem />}
      {m?.kind === 'analyzer' && <RockAnalyzer />}
      {m?.kind === 'dosimeter' && <Dosimeter />}
      {m?.kind === 'datalink' && <DataLink />}
      {m?.kind === 'powergrid' && <PowerGridModal />}
      {m?.kind === 'launcher' && <Launcher key={m.id} id={m.id} />}
      {m?.kind === 'minigame' && <MiniGameModal key={`${m.id}-${m.level}`} id={m.id} level={m.level} />}
      {m?.kind === 'settings' && !controls && <SettingsPanel onClose={() => openModal({ kind: 'pause' })} onControls={() => setControls(true)} />}
      {m?.kind === 'settings' && controls && <ControlsPanel onClose={() => setControls(false)} />}
      {s.phase === 'ending' && <Ending onMenu={onMenu} onNewGame={onNewGame} />}
      {m?.kind === 'pause' && s.phase !== 'ending' && (
        <Modal onClose={close} title="PAUSED">
          <div className="flex flex-col gap-3">
            <button autoFocus className="px-btn text-xs" onClick={() => { click(); close(); }}>RESUME</button>
            <button className="px-btn text-xs" onClick={() => openModal({ kind: 'settings' })}>SETTINGS</button>
            <button className="px-btn text-xs" onClick={() => openModal({ kind: 'science' })}>SCIENCE NOTES</button>
            <button className="px-btn danger text-xs" onClick={() => { click(); saveNow(); onMenu(); }}>SAVE & MAIN MENU</button>
          </div>
          <p className="mt-4 text-xl text-lilac">The game saves by itself whenever something changes.</p>
        </Modal>
      )}
    </div>
  );
}
