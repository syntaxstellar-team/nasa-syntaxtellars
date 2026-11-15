import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { loadSettings, saveSettings, Settings } from '../game/settings';
import { audio } from '../game/audio';
import { sprites } from '../game/art/sprites';
import type { Mood } from '../store/types';

export function click(): void {
  audio.unlock();
  audio.play('click');
}

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return <img src={sprites().iconUrl[name]} alt="" width={size} height={size} className={`pixelated inline-block ${className}`} />;
}

export function NovaFace({ mood = 'happy', size = 64 }: { mood?: Mood; size?: number }) {
  return <img src={sprites().novaPortrait[mood]} alt={`NOVA looks ${mood}`} width={size} height={size} className="pixelated shrink-0" />;
}

export function Modal({ children, onClose, wide, title, label }: { children: ReactNode; onClose?: () => void; wide?: boolean; title?: string; label?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={label ?? title} onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`px-panel fadein flex max-h-[94%] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        {title && (
          <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--line)] px-5 py-3">
            <h2 className="font-pixel text-sm leading-6 text-sun sm:text-base">{title}</h2>
            {onClose && <button className="px-btn px-3 py-2 text-[10px]" onClick={() => { click(); onClose(); }} aria-label="Close">✕</button>}
          </header>
        )}
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, color, label }: { value: number; max?: number; color: string; label: string }) {
  const k = Math.max(0, Math.min(1, value / max));
  return (
    <div className="px-bar" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <div style={{ width: `${k * 100}%`, background: color }} />
    </div>
  );
}

export function SettingsPanel({ onClose, onControls }: { onClose: () => void; onControls: () => void }) {
  const [s, setS] = useState<Settings>(loadSettings());
  const [fs, setFs] = useState<boolean>(!!document.fullscreenElement);
  const [fsError, setFsError] = useState('');
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const set = (patch: Partial<Settings>) => {
    const n = { ...s, ...patch };
    setS(n);
    saveSettings(n);
  };
  const toggleFs = async () => {
    click();
    setFsError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFsError('Fullscreen is not available in this window.');
    }
  };
  const Toggle = ({ on, onClick, id }: { on: boolean; onClick: () => void; id: string }) => (
    <button id={id} className={`px-btn min-w-20 px-3 py-2 text-[10px] ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => { click(); onClick(); }}>{on ? 'ON' : 'OFF'}</button>
  );
  return (
    <Modal onClose={onClose} title="SETTINGS">
      <div className="flex flex-col gap-5 text-2xl">
        <label className="block" htmlFor="set-music">
          <div className="mb-2 flex justify-between"><span>Music volume</span><span className="text-cyan">{Math.round(s.music * 100)}%</span></div>
          <input id="set-music" className="px-range w-full" type="range" min={0} max={100} value={Math.round(s.music * 100)} onChange={(e) => set({ music: Number(e.target.value) / 100 })} />
        </label>
        <label className="block" htmlFor="set-sfx">
          <div className="mb-2 flex justify-between"><span>Sound effects volume</span><span className="text-cyan">{Math.round(s.sfx * 100)}%</span></div>
          <input id="set-sfx" className="px-range w-full" type="range" min={0} max={100} value={Math.round(s.sfx * 100)} onChange={(e) => set({ sfx: Number(e.target.value) / 100 })} onPointerUp={() => audio.play('pickup')} />
        </label>
        <div className="flex items-center justify-between gap-3"><label htmlFor="set-mute">Sound</label><Toggle id="set-mute" on={!s.muted} onClick={() => set({ muted: !s.muted })} /></div>
        <div className="flex items-center justify-between gap-3"><label htmlFor="set-read">Read NOVA's words aloud</label><Toggle id="set-read" on={s.readAloud} onClick={() => set({ readAloud: !s.readAloud })} /></div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="set-touch">Touch buttons</label>
          <select id="set-touch" className="px-select" value={s.touch} onChange={(e) => set({ touch: e.target.value as Settings['touch'] })}>
            <option value="auto">Auto</option><option value="on">Always</option><option value="off">Never</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-3"><label htmlFor="set-fs">Fullscreen</label><Toggle id="set-fs" on={fs} onClick={toggleFs} /></div>
        {fsError && <p className="text-xl text-alert">{fsError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="px-btn flex-1 text-[10px]" onClick={() => { click(); onControls(); }}>CONTROLS</button>
          <button className="px-btn flex-1 text-[10px]" onClick={() => { click(); onClose(); }}>DONE</button>
        </div>
      </div>
    </Modal>
  );
}

const CONTROLS: [string, string][] = [
  ['A / D  or  ← →', 'Walk left and right'],
  ['W / SPACE  or  ↑', 'Jump (outside)'],
  ['E', 'Use, talk, pick up (hold E to scan)'],
  ['CLICK / TAP', 'Use the thing you point at, or press buttons'],
  ['ESC', 'Pause'],
];

export function ControlsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="CONTROLS">
      <table className="w-full text-2xl">
        <tbody>
          {CONTROLS.map(([k, v]) => (
            <tr key={k} className="border-b border-[var(--line)]">
              <td className="py-2 pr-4 align-top"><span className="kbd">{k}</span></td>
              <td className="py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xl text-lilac">On a phone or tablet, use the arrow and E buttons at the bottom of the screen.</p>
      <button className="px-btn mt-5 w-full text-[10px]" onClick={() => { click(); onClose(); }}>BACK</button>
    </Modal>
  );
}
