import { useEffect, useRef, useState } from 'react';
import { MainMenu } from './ui/MainMenu';
import { GameScreen } from './ui/GameScreen';
import { IntroScene, CAPTIONS, INTRO_LENGTH } from './game/IntroScene';
import { VIEW_W, VIEW_H } from './game/constants';
import { audio } from './game/audio';
import { applySettings, speak, stopSpeaking } from './game/settings';
import { newGame, continueGame } from './store/gameStore';
import { NovaFace, click } from './ui/Panels';
import { AboutScreen } from './ui/Devices';

/** The About screen is shown once, before the main menu, the very first time the game opens. */
const ABOUT_KEY = 'lostsignal_about_seen_v1';
function aboutSeen(): boolean {
  try { return localStorage.getItem(ABOUT_KEY) === '1'; } catch { return false; }
}
function markAboutSeen(): void {
  try { localStorage.setItem(ABOUT_KEY, '1'); } catch { /* storage unavailable: show it again next time */ }
}

type Screen = 'about' | 'menu' | 'intro' | 'game';

function IntroView({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<IntroScene | null>(null);
  const [cap, setCap] = useState(-1);
  const capRef = useRef(-1);
  useEffect(() => {
    const fit = () => {
      const c = ref.current!;
      const k = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
      c.style.width = `${Math.floor(VIEW_W * k)}px`;
      c.style.height = `${Math.floor(VIEW_H * k)}px`;
    };
    const s = new IntroScene(ref.current!, onDone, (t) => {
      const i = CAPTIONS.findIndex((c) => t >= c.t && t < c.end);
      if (i !== capRef.current) {
        capRef.current = i;
        setCap(i);
        if (i >= 0) speak(CAPTIONS[i].text);
      }
    });
    scene.current = s;
    fit();
    window.addEventListener('resize', fit);
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape') s.skip(); };
    window.addEventListener('keydown', key);
    return () => { s.destroy(); stopSpeaking(); window.removeEventListener('resize', fit); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const c = cap >= 0 ? CAPTIONS[cap] : null;
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <canvas ref={ref} aria-label="Story introduction" />
      {c && (
        <div className="caption fadein" key={cap} aria-live="polite">
          {c.speaker === 'NOVA' && <NovaFace mood="happy" size={56} />}
          <div>
            {c.speaker && <div className="font-pixel mb-1 text-[10px] text-cyan">{c.speaker}</div>}
            <p className="text-2xl leading-7 sm:text-3xl sm:leading-8">{c.text}</p>
          </div>
        </div>
      )}
      <button className="px-btn skip text-[10px]" onClick={() => { click(); scene.current?.skip(); }}>SKIP INTRO ▸</button>
      <span className="sr-only">Introduction is {INTRO_LENGTH} seconds long.</span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (aboutSeen() ? 'menu' : 'about'));
  const [run, setRun] = useState(0);

  // Browsers only allow sound after the first click or key press.
  useEffect(() => {
    const unlock = () => { audio.unlock(); applySettings(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => { if (screen === 'menu') audio.setMusic('menu'); }, [screen]);

  const startNew = () => { newGame(); setScreen('intro'); };
  return (
    <div className="relative h-full w-full">
      {screen === 'about' && <AboutScreen onContinue={() => { markAboutSeen(); setScreen('menu'); }} />}
      {screen === 'menu' && <MainMenu onNewGame={startNew} onContinue={() => { if (continueGame()) { setRun((r) => r + 1); setScreen('game'); } }} />}
      {screen === 'intro' && <IntroView onDone={() => { setRun((r) => r + 1); setScreen('game'); }} />}
      {screen === 'game' && <GameScreen key={run} onMenu={() => setScreen('menu')} onNewGame={startNew} />}
    </div>
  );
}
