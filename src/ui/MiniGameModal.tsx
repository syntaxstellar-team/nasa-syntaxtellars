import { useState } from 'react';
import type { ReactElement } from 'react';
import type { MGId, Mood } from '../store/types';
import { MINIGAMES } from '../data/minigames';
import {
  useGame, openModal, startMinigame, winMinigame, previewMinigameReward, collectMinigameReward, MGResult, say, update, gainEnergy, logEvent, getState,
} from '../store/gameStore';
import { Modal, NovaFace, Icon, click } from './Panels';
import { MG_SCIENCE } from '../data/scienceInfo';
import { ScienceButton } from './Devices';
import CircuitGame, { DISTRIBUTION_LEVEL } from '../minigames/CircuitGame';
import OxygenGame from '../minigames/OxygenGame';
import SolarGame from '../minigames/SolarGame';
import GreenhouseGame from '../minigames/GreenhouseGame';
import AntennaGame from '../minigames/AntennaGame';
import type { MiniGameProps } from '../minigames/common';

const GAMES: Record<MGId, (p: MiniGameProps) => ReactElement> = {
  circuit: CircuitGame, oxygen: OxygenGame, solar: SolarGame, greenhouse: GreenhouseGame, antenna: AntennaGame,
};

function RewardLine({ r }: { r: { energy: number; research: number; practice?: boolean; firstWin?: boolean } }) {
  if (!r.energy && !r.research) return <span className="text-lilac">Main reward already collected — great practice!</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {r.energy > 0 && <span className="inline-flex items-center gap-1 text-sun"><Icon name="energy" /> +{r.energy} Energy</span>}
      {r.research > 0 && <span className="inline-flex items-center gap-1 text-[#d8b8ff]"><Icon name="research" /> +{r.research} Research</span>}
      {r.practice && <span className="text-lilac">(practice bonus, once per day)</span>}
    </span>
  );
}

/** "Start Mini-Game" card shown when you use a machine. */
export function Launcher({ id }: { id: MGId }) {
  const s = useGame();
  const meta = MINIGAMES[id];
  const g = s.minigames[id];
  const [level, setLevel] = useState(() => Math.min(meta.levels.length, (g.solved.length ? Math.max(...g.solved) + 1 : 1)));
  const preview = previewMinigameReward(id, level);
  return (
    <Modal onClose={() => openModal(null)} title={meta.title.toUpperCase()} wide>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <NovaFace mood={g.solved.length ? 'happy' : 'worried'} size={56} />
          <p className="text-2xl leading-7">{meta.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xl">
          <span className="chip">Topic: {meta.topic}</span>
          <span className="chip">Station: {meta.station}</span>
        </div>
        <div>
          <h3 className="font-pixel mb-2 text-[10px] text-lilac">CHOOSE A LEVEL</h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Level">
            {meta.levels.map((name, i) => (
              <button key={i} role="radio" aria-checked={level === i + 1} className={`px-btn px-3 py-2 text-[9px] ${level === i + 1 ? 'on' : ''}`} onClick={() => { click(); setLevel(i + 1); }}>
                {i + 1}. {name.toUpperCase()} {g.solved.includes(i + 1) ? '✓' : ''}
              </button>
            ))}
          </div>
        </div>
        <ul className="list-none space-y-1 text-xl text-[var(--muted)]">{meta.how.map((h) => <li key={h}>{h}</li>)}</ul>
        <div className="text-2xl">Reward: <RewardLine r={preview} /></div>
        <div className="flex flex-wrap gap-3">
          <button autoFocus className="px-btn text-xs" onClick={() => { click(); startMinigame(id, level); }}>START MINI-GAME</button>
          {MG_SCIENCE[id] && <ScienceButton id={MG_SCIENCE[id]!} back={{ kind: 'launcher', id }} />}
          <button className="px-btn ghost text-xs" onClick={() => { click(); openModal(null); }}>EXIT</button>
        </div>
      </div>
    </Modal>
  );
}

/** The running mini-game, with Retry / Exit and the success screen. */
export function MiniGameModal({ id, level }: { id: MGId; level: number }) {
  const meta = MINIGAMES[id];
  const Game = GAMES[id];
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState<{ text: string; mood: Mood }>({ text: meta.how[0], mood: 'happy' });
  const [won, setWon] = useState(false);
  const [collected, setCollected] = useState<MGResult | null>(null);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState<MGResult | null>(null);

  const onWin = () => {
    setPreview(previewMinigameReward(id, level));
    winMinigame(id, level);
    setWon(true);
  };
  const retry = () => { click(); setWon(false); setCollected(null); setAttempt((a) => a + 1); setHint({ text: meta.how[0], mood: 'happy' }); };
  const exit = () => {
    click();
    let r = collected;
    // never lose a reward: collect it automatically when leaving a won game
    if (won && !r && preview && (preview.energy > 0 || preview.research > 0)) r = collectMinigameReward(id, level);
    openModal(null);
    if (r?.firstWin) say(`We did it! ${meta.science}`, 'celebrating');
  };
  const collect = () => {
    const r = collectMinigameReward(id, level);
    setCollected(r);
  };
  const next = level < meta.levels.length ? level + 1 : null;

  return (
    <div className="modal-scrim mg-scrim" role="dialog" aria-modal="true" aria-label={meta.title}>
      <div className="px-panel fadein flex h-full max-h-[100%] w-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--line)] px-4 py-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="font-pixel truncate text-xs text-sun sm:text-sm">{meta.title.toUpperCase()}</h2>
            <span className="text-xl text-lilac">Level {level}: {meta.levels[level - 1]}</span>
          </div>
          <div className="flex gap-2">
            <button className="px-btn px-3 py-2 text-[9px]" onClick={retry}>↺ RETRY</button>
            <button className="px-btn ghost px-3 py-2 text-[9px]" onClick={exit}>EXIT MINI-GAME</button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex min-h-[56px] items-center gap-3" aria-live="polite">
            <NovaFace mood={hint.mood} size={48} />
            <p className="text-2xl leading-6">{hint.text}</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <Game key={attempt} level={level} onWin={onWin} hint={(text, mood = 'happy') => setHint({ text, mood })} />
            {won && (
              <div className="win-panel fadein">
                <div className="px-panel mx-auto flex w-full max-w-xl flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <NovaFace mood="celebrating" size={64} />
                    <div>
                      <div className="font-pixel text-base text-[#7dffb0]">SUCCESS!</div>
                      <div className="text-xl text-lilac">{meta.topic}</div>
                    </div>
                  </div>
                  <p className="text-2xl leading-7"><b className="text-cyan">Why it works: </b>{meta.science}</p>
                  {more ? <p className="text-xl leading-6 text-[var(--muted)]">{meta.extra}</p> : (
                    <button className="self-start text-xl text-cyan underline underline-offset-4" onClick={() => setMore(true)}>Want to know more?</button>
                  )}
                  <div className="text-2xl">{collected ? <>Collected: <RewardLine r={collected} /></> : preview && <>Reward: <RewardLine r={preview} /></>}</div>
                  <div className="flex flex-wrap gap-3">
                    {!collected && preview && (preview.energy > 0 || preview.research > 0) ? (
                      <button autoFocus className="px-btn text-xs" onClick={collect}>COLLECT REWARD</button>
                    ) : null}
                    {next && <button className="px-btn text-xs" onClick={() => { click(); startMinigame(id, next); }}>PLAY LEVEL {next}</button>}
                    <button className="px-btn ghost text-xs" onClick={retry}>PLAY AGAIN</button>
                    <button className="px-btn ghost text-xs" onClick={exit}>BACK TO BASE</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Day 2 "Power Distribution Emergency": the circuit game with its own two-branch layout.
 * Winning sets flags.powerGrid (a Day 2 objective). It does not mark the main circuit as repaired.
 */
export function PowerGridModal() {
  const s = useGame();
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState<{ text: string; mood: Mood }>({ text: 'Tap a cable piece to turn it. Connect the battery to BOTH rooms: Life Support (top) and Command (bottom).', mood: 'thinking' });
  const done = !!s.flags.powerGrid;
  const onWin = () => {
    if (getState().flags.powerGrid) return;
    update((st) => { st.flags.powerGrid = true; logEvent('repair', 'Rerouted power to Life Support and the Command Center', st); });
    gainEnergy(5, 'Power emergency fixed');
  };
  const close = () => {
    click();
    openModal(null);
    if (done) {
      say('Power is flowing to both rooms again! The rest of the base still needs the big circuit repair — that is our job tomorrow.', 'celebrating');
    }
  };
  return (
    <div className="modal-scrim mg-scrim" role="dialog" aria-modal="true" aria-label="Power Distribution Emergency">
      <div className="px-panel fadein flex h-full max-h-[100%] w-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--line)] px-4 py-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="font-pixel truncate text-xs text-sun sm:text-sm">POWER DISTRIBUTION EMERGENCY</h2>
            <span className="text-xl text-lilac">Reroute power</span>
          </div>
          <div className="flex gap-2">
            {!done && <button className="px-btn px-3 py-2 text-[9px]" onClick={() => { click(); setAttempt((a) => a + 1); }}>↺ RETRY</button>}
            <button className="px-btn ghost px-3 py-2 text-[9px]" onClick={close}>{done ? 'BACK TO BASE' : 'EXIT'}</button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex min-h-[56px] items-center gap-3" aria-live="polite">
            <NovaFace mood={hint.mood} size={48} />
            <p className="text-2xl leading-6">{hint.text}</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <CircuitGame key={attempt} level={DISTRIBUTION_LEVEL} onWin={onWin} hint={(text, mood = 'happy') => setHint({ text, mood })} />
            {done && (
              <div className="win-panel fadein">
                <div className="px-panel mx-auto flex w-full max-w-xl flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <NovaFace mood="celebrating" size={64} />
                    <div>
                      <div className="font-pixel text-base text-[#7dffb0]">POWER RESTORED!</div>
                      <div className="text-xl text-lilac">Power distribution</div>
                    </div>
                  </div>
                  <p className="text-2xl leading-7"><b className="text-cyan">Why it works: </b>Electricity flows from the battery along branches to each room. When one branch breaks, engineers send power along another path — a detour for electricity. Rooms that keep people alive, like Life Support, always get power first.</p>
                  <div className="flex items-center gap-2 text-2xl text-sun"><Icon name="energy" /> +5 Energy</div>
                  <button autoFocus className="px-btn text-xs" onClick={close}>BACK TO BASE</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
