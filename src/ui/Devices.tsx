import { useEffect, useState } from 'react';
import {
  useGame, useUi, openModal, markScienceSeen, getState, analyzeSample, recordTransmission, say, update, withScience,
} from '../store/gameStore';
import type { Modal as ModalT } from '../store/gameStore';
import { SCIENCE, ScienceId } from '../data/scienceInfo';
import { SAMPLES, SAMPLE_ORDER, SampleId, ANALYZER_NOTE, LIFE_NOTE, DRONE_TARGET } from '../data/geology';
import { doseNow, solClock, DOSE_RATES } from '../data/radiation';
import { ABOUT_TEXT } from '../data/science';
import { audio } from '../game/audio';
import { getWorld } from './worldRef';
import { Modal, Icon, NovaFace, Bar, click } from './Panels';
import type { GameState } from '../store/types';

const SIM = <span className="chip sim">SIMULATED</span>;

/** Small button that opens a device's NOVA science card and comes back to the device afterwards. */
export function ScienceButton({ id, back }: { id: ScienceId; back: ModalT }) {
  return <button className="px-btn px-3 py-2 text-[9px]" onClick={() => openModal({ kind: 'info', id, back })}>SCIENCE INFO</button>;
}

// ----------------------------------------------------------------------------
// NOVA science card
// ----------------------------------------------------------------------------
export function ScienceInfo({ id, next, back }: { id: ScienceId; next?: (() => void) | null; back?: ModalT | null }) {
  const c = SCIENCE[id];
  const done = () => {
    click();
    markScienceSeen(id);
    if (next) { openModal(null); next(); } else openModal(back ?? null);
  };
  return (
    <Modal onClose={done} title="NOVA SCIENCE INFO">
      <div className="mb-3 flex items-start gap-3">
        <NovaFace mood="curious" size={56} />
        <div className="min-w-0">
          <div className="font-pixel text-[9px] text-cyan">{c.device}</div>
          <h3 className="font-pixel mt-1 text-sm leading-6 text-sun">{c.title}</h3>
        </div>
      </div>
      <section className="sci-block real">
        <div className="sci-label">REAL SCIENCE</div>
        <ul className="list-disc pl-5 text-xl leading-6">{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
      <section className="sci-block nasa">
        <div className="sci-label">INSPIRED BY NASA</div>
        <p className="text-xl leading-6">{c.inspired}</p>
      </section>
      <section className="sci-block game">
        <div className="sci-label">IN THIS GAME</div>
        <p className="text-xl leading-6">{c.game}</p>
      </section>
      <button autoFocus className="px-btn mt-4 w-full text-xs" onClick={done}>{next ? 'CONTINUE' : 'BACK'}</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// MEDA-inspired weather terminal (Airlock)
// ----------------------------------------------------------------------------
interface Weather { high: number; low: number; pa: number; wind: number; gust: number; dust: 'LOW' | 'MODERATE' | 'HIGH' | 'DUST STORM'; advisory: string }
/** Simulated values in the range MEDA has reported for Jezero Crater; not real measurements. */
const WEATHER: Weather[] = [
  { high: -24, low: -81, pa: 728, wind: 4, gust: 9, dust: 'LOW', advisory: 'Skies clearing after last night\'s storm. Repairs inside today.' },
  { high: -22, low: -80, pa: 730, wind: 5, gust: 10, dust: 'LOW', advisory: 'Calm and cold. Stay inside and fix the air supply.' },
  { high: -25, low: -82, pa: 726, wind: 6, gust: 12, dust: 'MODERATE', advisory: 'Dust is rising far to the west.' },
  { high: -23, low: -79, pa: 724, wind: 7, gust: 14, dust: 'MODERATE', advisory: 'Good day for a short walk outside. Expect dust on the panels.' },
  { high: -38, low: -70, pa: 745, wind: 15, gust: 24, dust: 'DUST STORM', advisory: 'DUST STORM. Dust blocks the Sun: colder days, milder nights. Stay inside.' },
  { high: -27, low: -78, pa: 738, wind: 8, gust: 15, dust: 'HIGH', advisory: 'The storm is fading. Dust is settling out of the sky.' },
  { high: -24, low: -80, pa: 733, wind: 5, gust: 11, dust: 'LOW', advisory: 'Weather is calm, but a solar particle event means everyone stays inside.' },
  { high: -21, low: -79, pa: 729, wind: 4, gust: 9, dust: 'LOW', advisory: 'Clear and calm. A great day for geology outside.' },
  { high: -23, low: -81, pa: 727, wind: 6, gust: 12, dust: 'LOW', advisory: 'Light breeze. Good conditions for antenna work.' },
  { high: -20, low: -78, pa: 725, wind: 5, gust: 10, dust: 'LOW', advisory: 'Clear skies for sending our signal home.' },
];

export function weatherFor(s: GameState): Weather & { now: number } {
  const w = WEATHER[Math.max(0, Math.min(9, s.day - 1))];
  const c = solClock(s.missionHours);
  // coldest just before sunrise, warmest early afternoon
  const k = (1 - Math.cos(((c.hh + c.mm / 60 - 5) / 24) * 2 * Math.PI)) / 2;
  return { ...w, now: Math.round(w.low + (w.high - w.low) * Math.min(1, k * 1.15)) };
}

/** Closing the terminal on Day 2 starts NOVA's weather question of the System Check. */
function closeWeather(): void {
  openModal(null);
  const s = getState();
  if (s.day === 2 && !s.flags['chk:weather']) getWorld()?.base.systemQuiz('weather');
}

export function WeatherTerminal() {
  const s = useGame();
  useUi();
  const w = weatherFor(s);
  const c = solClock(s.missionHours);
  useEffect(() => { if (!s.flags.weatherViewed) update((st) => { st.flags.weatherViewed = true; }); }, [s.flags.weatherViewed]);
  const rows: [string, string, string][] = [
    ['AIR TEMPERATURE NOW', `${w.now} °C`, 'Water freezes at 0 °C.'],
    ['TODAY HIGH / LOW', `${w.high} °C / ${w.low} °C`, 'Thin air holds little heat, so nights get very cold.'],
    ['AIR PRESSURE', `${w.pa} Pa`, 'Sea level on Earth is about 101,325 Pa.'],
    ['WIND', `${w.wind} m/s · gusts ${w.gust} m/s`, 'Thin air pushes much more gently than wind on Earth.'],
    ['DUST ACTIVITY', w.dust, 'Dust blocks sunlight from the solar panels.'],
  ];
  return (
    <Modal onClose={closeWeather} title="ARES-7 WEATHER TERMINAL" wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-pixel text-[9px] text-cyan">{c.text} · ARES-7 SITE</span>
        <span className="chip sim">SIMULATED MARS WEATHER — NOT LIVE DATA</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v, why]) => (
          <li key={k} className="px-slot p-3">
            <div className="font-pixel text-[8px] text-lilac">{k}</div>
            <div className={`font-pixel mt-1 text-base ${k === 'DUST ACTIVITY' && (w.dust === 'DUST STORM' || w.dust === 'HIGH') ? 'text-alert' : 'text-sun'}`}>{v}</div>
            <div className="text-lg leading-5 text-[var(--muted)]">{why}</div>
          </li>
        ))}
        <li className="px-slot p-3">
          <div className="font-pixel text-[8px] text-lilac">ADVISORY</div>
          <p className="mt-1 text-xl leading-6">{w.advisory}</p>
        </li>
      </ul>
      <p className="mt-3 text-xl leading-6 text-lilac">These readings are made up for the game. They are in the range NASA’s MEDA weather station has measured on Mars, but they are not real measurements.</p>
      <div className="mt-3 flex flex-wrap gap-2"><ScienceButton id="weather" back={{ kind: 'weather' }} /></div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// ISS-inspired water recovery system (Greenhouse water tank)
// ----------------------------------------------------------------------------
export function WaterSystem() {
  const s = useGame();
  const steps = [
    { name: 'USED WATER', text: 'Moisture from the air (breath and sweat), wash water and urine are collected.' },
    { name: 'PROCESSING', text: 'Urine is distilled; a hot reactor breaks down tiny leftover chemicals.' },
    { name: 'FILTRATION', text: 'Filter beds remove particles and dissolved impurities. Sensors check the quality.' },
    { name: 'RECOVERED WATER', text: 'Clean water goes back to the crew to drink, wash and water plants.' },
  ];
  const plan = s.decisions.water;
  return (
    <Modal onClose={() => openModal(null)} title="WATER RECOVERY SYSTEM" wide>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-2xl">
        <span className="flex items-center gap-2"><Icon name="water" /> Tank <span className="w-32"><Bar value={s.water} color="#3a8dff" label="Water" /></span> {Math.round(s.water)}%</span>
        <span className="text-xl text-lilac">Recycler: <b className={s.upgrades['water-recycler'] ? 'text-[#7dffb0]' : 'text-[var(--muted)]'}>{s.upgrades['water-recycler'] ? 'RUNNING (+8 water / day)' : 'NOT BUILT'}</b></span>
      </div>
      <ol className="wrs-flow" aria-label="How water is recycled">
        {steps.map((st, i) => (
          <li key={st.name} className={`px-slot p-3 ${s.upgrades['water-recycler'] ? 'on' : ''}`}>
            <div className="font-pixel text-[8px] text-cyan">{i + 1}. {st.name}</div>
            <p className="mt-1 text-lg leading-5">{st.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xl leading-6">On the International Space Station, the whole water system recovers about <b className="text-sun">98%</b> of the water (NASA, 2023). That is the result of all its parts working together — not one single machine.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!plan && s.day >= 6 && <button className="px-btn px-3 py-2 text-[9px]" onClick={() => { openModal(null); getWorld()?.base.waterTank(); }}>CHOOSE A WATER PLAN</button>}
        {!plan && s.day < 6 && <span className="text-xl text-lilac">The tank is fine for now. We will plan for more water on Day 6.</span>}
        {plan && <span className="text-xl text-lilac">Your plan: {plan === 'recycler' ? 'recycle our water.' : 'we drilled the frost patch.'}</span>}
        <ScienceButton id="water" back={{ kind: 'water' }} />
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// PIXL/SHERLOC-inspired Rock Analyzer (Science Lab)
// ----------------------------------------------------------------------------
export function RockAnalyzer() {
  const s = useGame();
  const carried = SAMPLE_ORDER.filter((id) => (s.inventory[id] ?? 0) > 0 && !s.analyzed.includes(id));
  const [sel, setSel] = useState<SampleId | null>(carried[0] ?? (s.analyzed[s.analyzed.length - 1] as SampleId) ?? null);
  const [scan, setScan] = useState(-1);
  useEffect(() => {
    if (scan < 0 || scan >= 1) return;
    const t = setTimeout(() => {
      const n = Math.min(1, scan + 0.05);
      setScan(n);
      if (Math.floor(n * 20) % 4 === 0) audio.play('mine');
      if (n >= 1 && sel) {
        analyzeSample(sel);
        const first = s.analyzed.length === 0;
        if (first) say('Our first result! Physical samples stay here on Mars in the sample cache. We can send the data to Earth once the antenna works.', 'celebrating');
      }
    }, 90);
    return () => clearTimeout(t);
  }, [scan, sel, s.analyzed.length]);
  const def = sel ? SAMPLES[sel] : null;
  const done = sel ? s.analyzed.includes(sel) : false;
  const ready = sel && !done && (s.inventory[sel] ?? 0) > 0;
  return (
    <Modal onClose={() => openModal(null)} title="ROCK ANALYZER" wide>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-col gap-2 md:w-56">
          <div className="font-pixel text-[8px] text-lilac">SAMPLES</div>
          {SAMPLE_ORDER.map((id) => {
            const have = (s.inventory[id] ?? 0) > 0;
            const an = s.analyzed.includes(id);
            return (
              <button key={id} disabled={!have && !an} className={`px-slot flex items-center gap-2 p-2 text-left text-xl ${sel === id ? 'sel' : ''} ${!have && !an ? 'opacity-50' : ''}`} onClick={() => { click(); setSel(id); setScan(-1); }}>
                <Icon name={id} size={26} />
                <span className="min-w-0 flex-1 leading-5">{have || an ? SAMPLES[id].name : '??? not collected'}<br /><span className="text-lg text-[var(--muted)]">{an ? 'analyzed ✓' : have ? 'ready to scan' : SAMPLES[id].where}</span></span>
              </button>
            );
          })}
        </div>
        <article className="px-slot min-w-0 flex-1 p-4">
          {!def && <p className="text-2xl text-[var(--muted)]">Collect a rock or soil sample outside, then bring it here.</p>}
          {def && (
            <>
              <div className="analyzer-screen" aria-hidden="true">
                <div className="beam" style={{ left: `${(scan < 0 ? (done ? 1 : 0) : scan) * 100}%`, opacity: scan >= 0 && scan < 1 ? 1 : 0 }} />
                <div className="rock"><Icon name={def.id} size={64} /></div>
                {scan >= 0 && scan < 1 && <div className="font-pixel absolute bottom-2 left-2 text-[8px] text-cyan">X-RAY + UV SCAN... {Math.round(scan * 100)}%</div>}
              </div>
              <h3 className="font-pixel mt-3 text-sm text-sun">{def.name}</h3>
              <p className="text-xl leading-6">{def.look}</p>
              {ready && scan < 0 && <button autoFocus className="px-btn mt-3 text-xs" onClick={() => { click(); setScan(0); }}>SCAN SAMPLE</button>}
              {done && (
                <div className="mt-2 flex flex-col gap-2 text-xl leading-6">
                  <p><b className="text-cyan">Rock type:</b> {def.rockType}</p>
                  <p><b className="text-cyan">Minerals detected:</b> {def.minerals.join(', ')}</p>
                  <div>
                    <div className="mb-1 flex items-center gap-2"><b className="text-cyan">Relative amounts</b> {SIM}</div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {def.bars.map((b) => <li key={b.label} className="flex items-center gap-2"><span className="w-24">{b.label}</span><span className="flex-1"><Bar value={b.level} max={5} color="#c48cff" label={`${b.label} (simulated)`} /></span></li>)}
                    </ul>
                  </div>
                  <p><b className="text-[#7dffb0]">What it means:</b> {def.meaning}</p>
                  <p><b className="text-[#7dffb0]">Real mission:</b> {def.realMission}</p>
                  <p className="text-lg text-lilac">{ANALYZER_NOTE}</p>
                  <p className="text-lg text-lilac">{LIFE_NOTE}</p>
                  <p className="font-pixel text-[8px] text-[#7dffb0]">✓ SAVED TO RESEARCH JOURNAL · SAMPLE STORED IN LAB CACHE</p>
                </div>
              )}
            </>
          )}
        </article>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><ScienceButton id="analyzer" back={{ kind: 'analyzer' }} /></div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Personal suit radiation monitor
// ----------------------------------------------------------------------------
export function Dosimeter() {
  const s = useGame();
  const u = useUi();
  const outside = !!u.live?.outside;
  const r = doseNow(s, outside);
  const c = solClock(s.missionHours);
  const statusText: Record<string, string> = {
    OUTDOORS: 'Outside on the surface. Dose rate based on the average NASA\'s Curiosity rover measured.',
    'INSIDE BASE': 'Inside ARES-7. The walls block part of the radiation.',
    'SOLAR EVENT': 'A solar particle event is passing. Get to the water-walled shelter!',
    SHELTERED: 'Safe in the shelter. Water walls soak up many of the particles.',
  };
  return (
    <Modal onClose={() => openModal(null)} title="SUIT RADIATION MONITOR">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="font-pixel text-[9px] text-cyan">{c.text}</span>{SIM}</div>
      <ul className="flex flex-col gap-2">
        <li className="px-slot p-3"><div className="font-pixel text-[8px] text-lilac">DOSE RATE</div><div className="font-pixel mt-1 text-base text-sun">{r.rate.toFixed(2)} mSv/day</div></li>
        <li className="px-slot p-3"><div className="font-pixel text-[8px] text-lilac">ACCUMULATED DOSE (THIS MISSION)</div><div className="font-pixel mt-1 text-base text-sun">{s.radDose.toFixed(2)} mSv</div></li>
        <li className="px-slot p-3"><div className="font-pixel text-[8px] text-lilac">RADIATION STATUS</div><div className={`font-pixel mt-1 text-sm ${r.status === 'SOLAR EVENT' ? 'text-alert' : 'text-[#7dffb0]'}`}>{r.status}</div><p className="text-lg leading-5 text-[var(--muted)]">{statusText[r.status]}</p></li>
      </ul>
      <p className="mt-3 text-xl leading-6 text-lilac">All values are simulated. The outdoor rate ({DOSE_RATES.outdoor.toFixed(2)} mSv/day) is based on the average reported from Curiosity’s RAD instrument; the other values are made up for the game. The dose adds up with mission time — 1 real second is about 2 minutes of base time.</p>
      <div className="mt-3 flex flex-wrap gap-2"><ScienceButton id="radiation" back={{ kind: 'dosimeter' }} /></div>
    </Modal>
  );
}

export function openDosimeter(): void {
  withScience('radiation', () => openModal({ kind: 'dosimeter' }));
}

// ----------------------------------------------------------------------------
// Earth data link (Comm Room)
// ----------------------------------------------------------------------------
/** Simulated Earth–Mars distance: roughly the average separation of the two planets (~225 million km). */
export const SIM_DISTANCE_KM = 225_000_000;
export const LIGHT_KM_S = 299_792.458;
export const signalDelaySeconds = (distanceKm: number) => distanceKm / LIGHT_KM_S;
export const fmtDelay = (sec: number) => `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`;

interface Report { id: string; title: string; findings: string[] }

export function researchReports(s: GameState): Report[] {
  const out: Report[] = [];
  for (const id of SAMPLE_ORDER) if (s.analyzed.includes(id)) {
    const d = SAMPLES[id];
    out.push({ id: `sample:${id}`, title: `Rock analysis: ${d.name}`, findings: [`Rock type: ${d.rockType}`, `Minerals: ${d.minerals.join(', ')}`, d.meaning, 'Values in this report are simulated.'] });
  }
  if (s.photos.includes(DRONE_TARGET.id)) out.push({ id: `photo:${DRONE_TARGET.id}`, title: `Drone survey: ${DRONE_TARGET.name}`, findings: ['Aerial image from Wind Ridge.', DRONE_TARGET.text] });
  if (s.flags.weatherViewed) out.push({ id: 'weather-log', title: 'Weather log', findings: ['Daily temperature, pressure, wind and dust readings from the ARES-7 terminal (simulated).'] });
  if (s.minigames.greenhouse.solved.length) out.push({ id: 'greenhouse', title: 'Greenhouse experiment', findings: ['Plants grew when water, light and temperature were all in the right range.', `Plant levels completed: ${s.minigames.greenhouse.solved.length}`] });
  return out;
}

export function DataLink() {
  const s = useGame();
  const reports = researchReports(s);
  const sent = (id: string) => s.transmitted.find((t) => t.id === id);
  const [sel, setSel] = useState<string | null>(reports.find((r) => !sent(r.id))?.id ?? reports[0]?.id ?? null);
  const [prog, setProg] = useState(-1);
  const delay = signalDelaySeconds(SIM_DISTANCE_KM);
  const rep = reports.find((r) => r.id === sel) ?? null;
  const tx = rep ? sent(rep.id) : undefined;
  useEffect(() => {
    if (prog < 0 || prog >= 1) return;
    const t = setTimeout(() => {
      const n = Math.min(1, prog + 0.04);
      setProg(n);
      if (n >= 1 && rep) {
        const first = s.transmitted.length === 0;
        if (recordTransmission(rep.id, delay)) {
          audio.play('complete');
          if (first) {
            say(`Our signal is on its way! Even at the speed of light, it needs about ${fmtDelay(delay)} to reach Earth.`, 'celebrating');
            say('We send digital data only. The rock samples themselves stay here on Mars, safely stored in the Lab.', 'thinking');
          }
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [prog, rep, delay, s.transmitted.length]);
  const now = s.missionHours;
  const arrival = tx ? tx.at + tx.delay / 3600 : now + delay / 3600;
  const status = tx ? (now >= arrival ? 'RECEIVED BY EARTH' : 'IN TRANSIT — TRAVELLING TO EARTH') : prog >= 0 && prog < 1 ? 'TRANSMITTING...' : 'READY TO SEND';
  return (
    <Modal onClose={() => openModal(null)} title="EARTH DATA LINK" wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="font-pixel text-[9px] text-cyan">{solClock(now).text}</span><span className="chip sim">SIMULATED DISTANCE · NOT LIVE</span></div>
      {!reports.length ? <p className="text-2xl text-[var(--muted)]">No finished research yet. Analyze rock samples, fly the drone or log the weather — then send your results home.</p> : (
        <div className="flex flex-col gap-4 md:flex-row">
          <ul className="flex flex-col gap-2 md:w-60">
            <li className="font-pixel text-[8px] text-lilac">RESEARCH REPORTS</li>
            {reports.map((r) => (
              <li key={r.id}><button className={`px-slot w-full p-2 text-left text-xl leading-5 ${sel === r.id ? 'sel' : ''}`} onClick={() => { click(); setSel(r.id); setProg(-1); }}>{r.title}<br /><span className={`text-lg ${sent(r.id) ? 'text-[#7dffb0]' : 'text-[var(--muted)]'}`}>{sent(r.id) ? 'sent ✓' : 'not sent'}</span></button></li>
            ))}
          </ul>
          {rep && (
            <article className="px-slot min-w-0 flex-1 p-4 text-xl leading-6">
              <div className="font-pixel text-[8px] text-lilac">RESEARCH REPORT</div>
              <h3 className="font-pixel mt-1 text-sm text-sun">{rep.title}</h3>
              <ul className="mt-2 list-disc pl-5">{rep.findings.map((f) => <li key={f}>{f}</li>)}</ul>
              <dl className="link-grid mt-3">
                <dt>DISTANCE TO EARTH</dt><dd>{(SIM_DISTANCE_KM / 1e6).toFixed(0)} million km <span className="text-lg text-lilac">(simulated average)</span></dd>
                <dt>ESTIMATED ONE-WAY SIGNAL DELAY</dt><dd>{fmtDelay(delay)} <span className="text-lg text-lilac">(signal travel time at the speed of light)</span></dd>
                <dt>ESTIMATED SIGNAL ARRIVAL</dt><dd>{solClock(arrival).text} base time</dd>
                <dt>TRANSMISSION STATUS</dt><dd className={tx ? 'text-[#7dffb0]' : 'text-sun'}>{status}</dd>
              </dl>
              <div className="signal-path mt-3" aria-hidden="true">
                <span className="font-pixel text-[8px]">MARS</span>
                <div className="track"><div className="pulse" style={{ left: `${(tx ? 1 : Math.max(0, prog)) * 100}%`, opacity: prog >= 0 || tx ? 1 : 0 }} /></div>
                <span className="font-pixel text-[8px]">EARTH</span>
              </div>
              {!tx && <button autoFocus className="px-btn mt-3 text-xs" disabled={prog >= 0} onClick={() => { click(); audio.play('transmit'); setProg(0); }}>TRANSMIT RESEARCH DATA</button>}
              {tx && <p className="mt-2 text-lg text-lilac">Already sent on Sol {tx.sol}. Each report is sent once.</p>}
            </article>
          )}
        </div>
      )}
      <p className="mt-3 text-lg leading-5 text-lilac">Delay = distance ÷ speed of light ({LIGHT_KM_S.toLocaleString('en-US')} km/s). The real delay changes from about 3 to 22 minutes as the planets move.</p>
      <div className="mt-3 flex flex-wrap gap-2"><ScienceButton id="comm" back={{ kind: 'datalink' }} /></div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// About the game (first launch + main menu)
// ----------------------------------------------------------------------------
export function AboutContent() {
  return (
    <div className="flex flex-col gap-3 text-2xl leading-7">
      {ABOUT_TEXT.map((p) => <p key={p}>{p}</p>)}
    </div>
  );
}

export function AboutScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="about-screen" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="px-panel fadein flex max-h-[94%] w-full max-w-xl flex-col overflow-y-auto p-6">
        <h1 id="about-title" className="font-pixel text-base leading-8 text-sun sm:text-lg">LOST SIGNAL</h1>
        <div className="font-pixel mb-4 text-[10px] text-cyan">A MARS SCIENTIFIC ADVENTURE</div>
        <AboutContent />
        <button autoFocus className="px-btn mt-6 text-xs" onClick={() => { click(); onContinue(); }}>CONTINUE</button>
      </div>
    </div>
  );
}
