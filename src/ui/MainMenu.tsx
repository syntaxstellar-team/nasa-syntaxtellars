import { useEffect, useRef, useState } from 'react';
import { MenuScene } from '../game/MenuScene';
import { hasSave, readSave } from '../store/gameStore';
import { audio } from '../game/audio';
import { Modal, SettingsPanel, ControlsPanel, click } from './Panels';
import { Science } from './Screens';
import { AboutContent } from './Devices';

type Dialog = null | 'overwrite' | 'settings' | 'controls' | 'science' | 'about';

export function MainMenu({ onNewGame, onContinue }: { onNewGame: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [save] = useState(() => (hasSave() ? readSave() : null));

  useEffect(() => {
    const scene = new MenuScene(ref.current!);
    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);
    audio.setMusic('menu');
    return () => { scene.destroy(); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05030f]">
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <canvas ref={ref} aria-label="The planet Mars turning in space" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <nav className="menu-nav" aria-label="Main menu">
        {save ? (
          <>
            <button autoFocus className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); onContinue(); }}>CONTINUE</button>
            <div className="-mt-2 text-center text-xl text-lilac">Day {save.day} of 10 · saved {new Date(save.savedAt).toLocaleDateString()}</div>
            <button className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('overwrite'); }}>NEW GAME</button>
          </>
        ) : (
          <button autoFocus className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); onNewGame(); }}>START GAME</button>
        )}
        <button className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('settings'); }}>SETTINGS</button>
        <button className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('science'); }}>SCIENCE NOTES</button>
        <button className="px-btn w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('about'); }}>ABOUT THE GAME</button>
      </nav>
      <div className="font-pixel absolute bottom-3 left-3 text-[8px] text-white/40">A science adventure for explorers aged 7–12</div>
      <div className="font-pixel absolute bottom-3 right-3 text-[8px] text-white/40">Mars is real · ARES-7 and NOVA are fictional</div>

      {dialog === 'overwrite' && (
        <Modal onClose={() => setDialog(null)} title="START A NEW GAME?">
          <p className="mb-6 text-2xl">Your saved game on Day {save?.day} will be erased. Are you sure?</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="px-btn danger flex-1 text-xs" onClick={() => { click(); onNewGame(); }}>YES, NEW GAME</button>
            <button autoFocus className="px-btn flex-1 text-xs" onClick={() => { click(); setDialog(null); }}>KEEP MY SAVE</button>
          </div>
        </Modal>
      )}
      {dialog === 'settings' && <SettingsPanel onClose={() => setDialog(null)} onControls={() => setDialog('controls')} />}
      {dialog === 'controls' && <ControlsPanel onClose={() => setDialog('settings')} />}
      {dialog === 'science' && <Science onClose={() => setDialog(null)} />}
      {dialog === 'about' && (
        <Modal onClose={() => setDialog(null)} title="ABOUT THE GAME">
          <div className="font-pixel mb-3 text-[10px] text-cyan">LOST SIGNAL — A MARS SCIENTIFIC ADVENTURE</div>
          <AboutContent />
          <button autoFocus className="px-btn mt-5 w-full text-xs" onClick={() => { click(); setDialog(null); }}>CLOSE</button>
        </Modal>
      )}
    </div>
  );
}
