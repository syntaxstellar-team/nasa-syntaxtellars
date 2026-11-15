import { useState } from 'react';
import {
  useGame, openModal, acceptMission, claimMission, missionStatus, missionDone, buyUpgrade, update, toast, beginDay, continueToNextDay, say, logEvent, trackUsage,
} from '../store/gameStore';
import type { GameState } from '../store/types';
import { MISSIONS, CATEGORY_LABEL, MissionCategory, MissionDef } from '../data/missions';
import { UPGRADES, ITEMS, GEAR } from '../data/upgrades';
import { FICTION_NOTE } from '../data/science';
import { SCIENCE, ScienceId } from '../data/scienceInfo';
import { SAMPLES, SAMPLE_ORDER, SampleId, DRONE_TARGET, ANALYZER_NOTE, sampleCollected } from '../data/geology';
import { solClock } from '../data/radiation';
import { researchReports, fmtDelay, AboutContent } from './Devices';
import { EngArchive, EngReportView } from './EngJournal';
import { MINIGAMES } from '../data/minigames';
import { dayDef } from '../data/days';
import { audio } from '../game/audio';
import { Modal, Icon, NovaFace, Bar, click } from './Panels';
import { getWorld } from './worldRef';

// ----------------------------------------------------------------------------
// Mission board
// ----------------------------------------------------------------------------
const STATUS_LABEL: Record<string, string> = { upcoming: 'LATER', available: 'NEW', active: 'ACTIVE', complete: 'COMPLETE!', claimed: 'DONE' };

function MissionCard({ m, s }: { m: MissionDef; s: GameState }) {
  const st = missionStatus(m, s);
  const prog = Math.min(m.target, m.progress(s));
  const reward = m.minigame ? { energy: MINIGAMES[m.minigame].reward.energy, research: MINIGAMES[m.minigame].reward.research ?? 0 } : { energy: m.reward.energy ?? 0, research: m.reward.research ?? 0 };
  return (
    <li className={`mission ${st}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-2xl leading-6 text-[var(--fg)]">{m.title}</h4>
        <span className={`status ${st}`}>{st === 'upcoming' ? (missionDone(m, s) ? `DONE EARLY · DAY ${m.day}` : `DAY ${m.day}`) : STATUS_LABEL[st]}</span>
      </div>
      {st !== 'upcoming' || missionDone(m, s) ? (
        <>
          <p className="text-xl leading-5 text-[var(--muted)]">{m.desc}</p>
          <p className="text-xl leading-5"><b className="text-cyan">Objective:</b> {m.objective}</p>
          <div className="flex flex-wrap items-center gap-3 text-xl">
            <span className="flex items-center gap-2"><b className="text-cyan">Progress</b> <span className="w-24"><Bar value={prog} max={m.target} color="#3dff8a" label="Progress" /></span> {prog}/{m.target}</span>
            <span className="flex items-center gap-2"><b className="text-cyan">Reward</b>
              {reward.energy > 0 && <span className="flex items-center gap-1 text-sun"><Icon name="energy" size={14} />+{reward.energy}</span>}
              {reward.research > 0 && <span className="flex items-center gap-1 text-[#d8b8ff]"><Icon name="research" size={14} />+{reward.research}</span>}
              {!reward.energy && !reward.research && <span className="text-lilac">The ending!</span>}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {st === 'available' && <button className="px-btn px-3 py-2 text-[9px]" onClick={() => acceptMission(m.id)}>ACCEPT MISSION</button>}
            {st === 'complete' && (reward.energy || reward.research) ? <button className="px-btn px-3 py-2 text-[9px]" onClick={() => claimMission(m.id)}>COLLECT REWARD</button> : null}
          </div>
        </>
      ) : <p className="text-xl text-[var(--muted)]">This mission unlocks on Day {m.day}.</p>}
    </li>
  );
}

export function MissionBoard() {
  const s = useGame();
  const [tab, setTab] = useState<MissionCategory>('main');
  const list = MISSIONS.filter((m) => m.category === tab).sort((a, b) => {
    const order = { complete: 0, active: 1, available: 2, upcoming: 3, claimed: 4 };
    return order[missionStatus(a, s)] - order[missionStatus(b, s)] || a.day - b.day;
  });
  const counts = (c: MissionCategory) => MISSIONS.filter((m) => m.category === c && ['available', 'complete'].includes(missionStatus(m, s))).length;
  return (
    <Modal onClose={() => openModal(null)} title="MISSION BOARD" wide>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(Object.keys(CATEGORY_LABEL) as MissionCategory[]).map((c) => (
          <button key={c} role="tab" aria-selected={tab === c} className={`px-btn px-3 py-2 text-[9px] ${tab === c ? 'on' : ''}`} onClick={() => { click(); setTab(c); }}>
            {CATEGORY_LABEL[c].toUpperCase()} {counts(c) > 0 && <span className="badge">{counts(c)}</span>}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-3">{list.map((m) => <MissionCard key={m.id} m={m} s={s} />)}</ul>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Research journal
// ----------------------------------------------------------------------------
type JTab = 'samples' | 'drone' | 'notes' | 'sent' | 'eng';

export function Journal() {
  const s = useGame();
  const [tab, setTab] = useState<JTab>('samples');
  const [sel, setSel] = useState<SampleId>((SAMPLE_ORDER.find((id) => s.analyzed.includes(id)) ?? 'soil') as SampleId);
  const d = SAMPLES[sel];
  const analyzed = s.analyzed.includes(sel);
  const notes = [
    { name: 'Striped rocks', done: !!s.flags.rocksScanned, text: 'Layers of sand and mud that settled long ago.' },
    { name: 'Frost patch', done: !!s.flags.firstOutside, text: s.flags.iceDrilled ? 'Water ice under the dust — we drilled it for water.' : 'Water ice hiding just under the dust.' },
    { name: 'Rock Arch', done: !!s.flags.beaconPlaced, text: 'A new research site, marked with our beacon.' },
    { name: 'Mars weather', done: !!s.flags.weatherViewed, text: 'Thin, cold carbon-dioxide air (simulated readings).' },
  ];
  const reports = researchReports(s);
  const tabs: [JTab, string][] = [['samples', 'ROCK SAMPLES'], ['drone', 'DRONE IMAGES'], ['notes', 'FIELD NOTES'], ['sent', 'SENT TO EARTH'], ['eng', 'ENGINEERING']];
  return (
    <Modal onClose={() => openModal(null)} title="RESEARCH JOURNAL" wide>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-2xl">
        <span className="flex items-center gap-2"><Icon name="research" /> Research points: <b className="text-[#d8b8ff]">{s.research}</b></span>
        <span className="flex items-center gap-2"><Icon name="eco" /> Site protection <span className="w-28"><Bar value={s.ecosystem} color={s.ecosystem < 50 ? '#ff4d6d' : '#4fd08a'} label="Site protection" /></span> {s.ecosystem}%</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={`px-btn px-3 py-2 text-[9px] ${tab === id ? 'on' : ''}`} onClick={() => { click(); setTab(id); }}>{label}</button>)}
      </div>
      {tab === 'samples' && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex gap-2 md:w-52 md:flex-col" role="tablist" aria-label="Samples">
            {SAMPLE_ORDER.map((id) => (
              <button key={id} role="tab" aria-selected={sel === id} className={`px-slot flex flex-1 items-center gap-2 p-2 text-left text-xl ${sel === id ? 'sel' : ''}`} onClick={() => { click(); setSel(id); }}>
                <Icon name={id} size={30} className={s.analyzed.includes(id) || sampleCollected(s, id) ? '' : 'silhouette'} />
                <span className="hidden leading-5 sm:inline">{s.analyzed.includes(id) || sampleCollected(s, id) ? SAMPLES[id].name : '???'}</span>
              </button>
            ))}
          </div>
          <article className="px-slot min-w-0 flex-1 p-4 text-xl leading-6">
            <div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="font-pixel text-sm text-sun">{analyzed || sampleCollected(s, sel) ? d.name : '??? NOT FOUND'}</h3><span className="chip">MARS GEOLOGY</span></div>
            {analyzed ? (
              <>
                <p><b className="text-cyan">Found:</b> {d.where}.</p>
                <p><b className="text-cyan">Rock type:</b> {d.rockType}</p>
                <p><b className="text-cyan">Minerals:</b> {d.minerals.join(', ')}</p>
                <p className="mt-2 border-t border-[var(--line)] pt-2"><b className="text-[#7dffb0]">What it means:</b> {d.meaning}</p>
                <p><b className="text-[#7dffb0]">Real mission:</b> {d.realMission}</p>
                <p className="text-lg text-lilac">{ANALYZER_NOTE}</p>
                {sel === 'hematite' && s.decisions.canyon && <p className="mt-1 text-lilac">Your choice: {s.decisions.canyon === 'loose' ? 'picked up loose spherules and kept the site unspoiled.' : 'cut a block from the canyon wall.'}</p>}
              </>
            ) : sampleCollected(s, sel) ? <p className="text-[var(--muted)]">Collected! Take it to the Rock Analyzer in the Science Lab.</p> : <p className="text-[var(--muted)]">Where to look: {d.where}.</p>}
          </article>
        </div>
      )}
      {tab === 'drone' && (
        s.photos.includes(DRONE_TARGET.id) ? (
          <article className="px-slot flex flex-col items-start gap-4 p-4 sm:flex-row">
            <div className="drone-photo" aria-label="Pixel drone image of wind-carved rocks" role="img"><span /><span /><span /></div>
            <div className="min-w-0 flex-1 text-xl leading-6"><h3 className="font-pixel text-sm text-sun">{DRONE_TARGET.name}</h3><p>{DRONE_TARGET.text}</p><p className="text-lg text-lilac">Taken by the ARES-7 scout drone (fictional) over Wind Ridge.</p></div>
          </article>
        ) : <p className="text-2xl text-[var(--muted)]">No drone images yet. From Day 6, launch the scout drone from its pad outside and photograph the rocks on Wind Ridge.</p>
      )}
      {tab === 'notes' && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {notes.map((x) => <li key={x.name} className="px-slot p-2 text-xl"><b className={x.done ? 'text-[#7dffb0]' : 'text-[var(--muted)]'}>{x.done ? '✓ ' : '? '}{x.name}</b><div className="text-[var(--muted)]">{x.done ? x.text : 'Not studied yet'}</div></li>)}
        </ul>
      )}
      {tab === 'eng' && <EngArchive reports={s.engReports} final={s.finalReport} />}
      {tab === 'sent' && (
        s.transmitted.length ? (
          <ul className="flex flex-col gap-2">
            {s.transmitted.map((t) => (
              <li key={t.id} className="px-slot p-2 text-xl leading-6">
                <b>{reports.find((r) => r.id === t.id)?.title ?? t.id}</b>
                <div className="text-[var(--muted)]">Sent {solClock(t.at).text} · signal travel time {fmtDelay(t.delay)} · {s.missionHours >= t.at + t.delay / 3600 ? 'received by Earth' : 'in transit'}</div>
              </li>
            ))}
          </ul>
        ) : <p className="text-2xl text-[var(--muted)]">Nothing sent yet. The Data Link in the Comm Room can send finished research to Earth.</p>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Inventory
// ----------------------------------------------------------------------------
export function Inventory() {
  const s = useGame();
  const items = Object.entries(ITEMS).filter(([id]) => (s.inventory[id] ?? 0) > 0 || (id === 'water' && s.carrying === 'water'));
  const iconFor: Record<string, string> = { water: 'water_container' };
  return (
    <Modal onClose={() => openModal(null)} title="INVENTORY">
      {items.length === 0 ? <p className="text-2xl text-[var(--muted)]">Nothing yet. Look around the base and press E on things!</p> : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map(([id, it]) => (
            <li key={id} className="px-slot flex items-start gap-3 p-3">
              <Icon name={iconFor[id] ?? id} size={36} />
              <div className="min-w-0 text-xl leading-5"><b className="text-2xl">{it.name}</b><div className="text-[var(--muted)]">{it.desc}</div></div>
            </li>
          ))}
        </ul>
      )}
      <h3 className="font-pixel mb-2 mt-5 text-[10px] text-lilac">EXPEDITION GEAR</h3>
      <p className="text-xl text-[var(--muted)]">{GEAR.filter((g) => s.inventory[g]).length} of {GEAR.length} collected. Check the Airlock checklist to see where the rest are.</p>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Upgrade Base
// ----------------------------------------------------------------------------
export function Upgrades() {
  const s = useGame();
  return (
    <Modal onClose={() => openModal(null)} title="UPGRADE BASE" wide>
      <p className="mb-4 flex items-center gap-2 text-2xl"><Icon name="energy" /> You have <b className="text-sun">{s.energy}</b> energy. Spend it to switch machines back on.</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {UPGRADES.filter((u) => u.inList).map((u) => {
          const have = !!s.upgrades[u.id];
          const lock = u.locked(s);
          const short = s.energy < u.cost;
          return (
            <li key={u.id} className={`px-slot flex flex-col gap-2 p-3 ${have ? 'opacity-80' : ''}`}>
              <div className="flex items-start justify-between gap-2"><b className="text-2xl leading-6">{u.title}</b><span className="flex shrink-0 items-center gap-1 text-xl text-sun"><Icon name="energy" size={14} />{u.cost}</span></div>
              <p className="text-xl leading-5 text-[var(--muted)]">{u.desc}</p>
              {have ? <span className="status claimed self-start">ACTIVE</span> : lock ? <span className="text-xl text-lilac">🔒 {lock}</span> : (
                <button className="px-btn self-start px-3 py-2 text-[9px]" disabled={short} onClick={() => { if (buyUpgrade(u.id)) toast(`${u.title} is on!`); }}>
                  {short ? `NEED ${u.cost - s.energy} MORE` : `UPGRADE (${u.cost})`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Expedition checklist (Airlock)
// ----------------------------------------------------------------------------
export function Checklist() {
  const s = useGame();
  const all = GEAR.every((g) => (s.inventory[g] ?? 0) > 0);
  const day = dayDef(s.day);
  const blocked = !day.outside ? (s.day < 4 ? 'Your first trip outside is on Day 4.' : 'It is not safe to go outside today.') : null;
  return (
    <Modal onClose={() => openModal(null)} title="EXPEDITION CHECKLIST">
      <ul className="flex flex-col gap-2">
        {GEAR.map((g) => {
          const ok = (s.inventory[g] ?? 0) > 0;
          return (
            <li key={g} className="px-slot flex items-center gap-3 p-2">
              <Icon name={g} size={30} />
              <div className="min-w-0 flex-1 text-xl leading-5"><b className="text-2xl">{ITEMS[g].name}</b><div className="text-[var(--muted)]">{ok ? ITEMS[g].desc : `Find it: ${ITEMS[g].where}`}</div></div>
              <span className={`font-pixel text-[10px] ${ok ? 'text-[#7dffb0]' : 'text-alert'}`}>{ok ? '✓ READY' : 'MISSING'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xl text-lilac">{blocked ?? (all ? 'All set! Your suit holds air for about two minutes. Come back to the airlock to refill.' : 'You can\'t go outside safely until every item is ready.')}</p>
      <button className="px-btn mt-3 w-full text-xs" disabled={!all || !!blocked} onClick={() => { openModal(null); getWorld()?.goOutside(); }}>GO OUTSIDE</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Storm power plan (Day 5)
// ----------------------------------------------------------------------------
export function StormPlan() {
  const s = useGame();
  const [heat, setHeat] = useState(true);
  const [freezer, setFreezer] = useState(false);
  const cost = 10 + (heat ? 8 : 0) + (freezer ? 6 : 0);
  const done = !!s.flags.stormPlan;
  const rows = [
    { id: 'life', name: 'Life Support', cost: 10, why: 'Makes air for the crew. Always on!', on: true, fixed: true, set: () => {} },
    { id: 'heat', name: 'Greenhouse Heaters', cost: 8, why: 'Keeps the plants from freezing. Protects our food.', on: heat, fixed: false, set: () => setHeat(!heat) },
    { id: 'freeze', name: 'Lab Sample Freezer', cost: 6, why: 'Keeps samples safe for research (+1 research).', on: freezer, fixed: false, set: () => setFreezer(!freezer) },
  ];
  const confirm = () => {
    const lifeOn = s.energy >= 10;
    const spend = Math.min(s.energy, cost);
    update((st) => {
      st.energy -= spend;
      trackUsage('energy', -spend, 'Storm power plan', st);
      logEvent('decision', `Storm plan: life support ${lifeOn ? 'on' : 'OFF'}, heaters ${heat ? 'on' : 'off'}, sample freezer ${freezer ? 'on' : 'off'} (−${spend} energy)`, st);
      st.flags.stormPlan = true;
      st.flags.stormLife = lifeOn;
      st.flags.stormHeaters = heat && st.energy >= 0;
      st.flags.stormFreezer = freezer;
    });
    audio.play('power');
    openModal(null);
    say(lifeOn ? 'Power plan set! Life support comes first, always.' : 'We did not have enough energy for life support! The air will get thin tonight.', lifeOn ? 'happy' : 'worried');
  };
  return (
    <Modal onClose={() => openModal(null)} title="STORM POWER PLAN">
      {done ? <p className="text-2xl">The plan is set. Now we wait out the storm!</p> : (
        <>
          <div className="mb-3 flex items-start gap-3"><NovaFace mood="thinking" size={56} /><p className="text-2xl leading-7">No sunlight today, so every bit of energy counts. Choose which systems stay on.</p></div>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="px-slot flex items-center gap-3 p-2">
                <div className="min-w-0 flex-1 text-xl leading-5"><b className="text-2xl">{r.name}</b><div className="text-[var(--muted)]">{r.why}</div></div>
                <span className="flex items-center gap-1 text-xl text-sun"><Icon name="energy" size={14} />{r.cost}</span>
                <button className={`px-btn min-w-16 px-3 py-2 text-[9px] ${r.on ? 'on' : ''}`} aria-pressed={r.on} disabled={r.fixed} onClick={() => { click(); r.set(); }}>{r.on ? 'ON' : 'OFF'}</button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-2xl">Plan uses <b className={cost > s.energy ? 'text-alert' : 'text-sun'}>{cost}</b> of your <b className="text-sun">{s.energy}</b> energy.</p>
          {cost > s.energy && <p className="text-xl text-alert">That is more than we have! Switch something off.</p>}
          <button className="px-btn mt-3 w-full text-xs" disabled={cost > s.energy && s.energy >= 10} onClick={confirm}>CONFIRM PLAN</button>
        </>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Resource overview
// ----------------------------------------------------------------------------
export function Resources() {
  const s = useGame();
  const rows = [
    { icon: 'energy', name: 'Energy', v: s.energy, max: 150, color: '#ffd43b', text: 'Earned by repairs, mini-games and solar panels. Spent by machines and upgrades.' },
    { icon: 'oxygen', name: 'Oxygen', v: s.oxygen, max: 100, color: '#43d9ff', text: 'Made by the oxygen generator, if it is fixed and has power.' },
    { icon: 'water', name: 'Water', v: s.water, max: 100, color: '#3a8dff', text: 'The crew uses some every day. A recycler can clean used water.' },
    { icon: 'food', name: 'Food', v: s.food, max: 100, color: '#5ccf5c', text: 'The greenhouse grows food once it has light and healthy plants.' },
    { icon: 'crew', name: 'Crew health', v: s.crew, max: 100, color: '#ff5a7a', text: 'Stays high when oxygen, water and food are all above 40.' },
  ];
  return (
    <Modal onClose={() => openModal(null)} title="BASE RESOURCES">
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.name} className="flex items-start gap-3">
            <Icon name={r.icon} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-2xl"><b>{r.name}</b><span className="tabular-nums">{Math.round(r.v)}</span></div>
              <Bar value={r.v} max={r.max} color={r.color} label={r.name} />
              <p className="mt-1 text-xl leading-5 text-[var(--muted)]">{r.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xl text-lilac">Every night the base uses about 8 energy for life support{s.upgrades['greenhouse-lights'] ? ' and 5 for the greenhouse lamps' : ''}.{s.minigames.solar.solved.length ? ` The solar panels add 15 each day (except in storms). Dust on the panels: ${Math.round(s.dust)}% (simulated) — above 50% it costs 5 energy a day.` : ''}</p>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Science notes (no external links: references are kept in docs/SCIENCE_NOTES.md)
// ----------------------------------------------------------------------------
export function Science({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<ScienceId | 'about' | null>(null);
  return (
    <Modal onClose={onClose} title="SCIENCE NOTES" wide>
      <ul className="mb-5 grid gap-2 md:grid-cols-3">
        {FICTION_NOTE.map((n) => (
          <li key={n.label} className="px-slot p-3 text-xl leading-5"><b className="font-pixel text-[9px] text-sun">{n.label.toUpperCase()}</b><p className="mt-2">{n.text}</p></li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2">
        {(Object.keys(SCIENCE) as ScienceId[]).map((id) => {
          const c = SCIENCE[id];
          const isOpen = open === id;
          return (
            <li key={id} className="px-slot p-3 text-xl leading-6">
              <button className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" aria-expanded={isOpen} onClick={() => { click(); setOpen(isOpen ? null : id); }}>
                <b className="text-2xl">{c.title}</b><span className="chip">{c.device}</span>
              </button>
              {isOpen && (
                <div className="mt-2">
                  <ul className="list-disc pl-5">{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                  <p className="mt-1 text-cyan">{c.inspired}</p>
                  <p className="text-[#ffe08a]">{c.game}</p>
                </div>
              )}
            </li>
          );
        })}
        <li className="px-slot p-3 text-xl leading-6">
          <button className="w-full text-left" aria-expanded={open === 'about'} onClick={() => { click(); setOpen(open === 'about' ? null : 'about'); }}><b className="text-2xl">About the game</b></button>
          {open === 'about' && <div className="mt-2"><AboutContent /></div>}
        </li>
      </ul>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Mission briefing (start of each day) and Mission Report (end of each day)
// ----------------------------------------------------------------------------
export function Briefing() {
  const s = useGame();
  const d = dayDef(s.day);
  const prevWarn = s.report && s.report.day === s.day - 1 ? s.report.warnings : [];
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Mission briefing">
      <div className="px-panel pop flex max-h-[94%] w-full max-w-xl flex-col overflow-y-auto p-5">
        <div className="font-pixel text-[10px] text-lilac">DAY {s.day} OF 10</div>
        <h2 className="font-pixel mt-1 text-lg leading-8 text-sun sm:text-xl">{d.title.toUpperCase()}</h2>
        <div className="font-pixel mb-3 text-[9px] text-cyan">{d.mission}</div>
        <div className="flex flex-col gap-2">
          {(typeof d.briefing === 'function' ? d.briefing(s) : d.briefing).map((b, i) => (
            <div key={i} className="flex items-start gap-3"><NovaFace mood={b.mood} size={48} /><p className="text-2xl leading-7">{b.text}</p></div>
          ))}
        </div>
        <h3 className="font-pixel mb-2 mt-4 text-[9px] text-lilac">OBJECTIVES</h3>
        <ul className="flex flex-col gap-1 text-2xl">{d.objectives.map((o) => <li key={o.id}>□ {o.text}</li>)}</ul>
        {prevWarn.length > 0 && <div className="warn mt-3">{prevWarn.map((w) => <p key={w}>⚠ {w}</p>)}</div>}
        <button autoFocus className="px-btn mt-5 text-xs" onClick={() => beginDay()}>BEGIN DAY {s.day}</button>
      </div>
    </div>
  );
}

const LABEL: Record<string, string> = { energy: 'Energy', oxygen: 'Oxygen', water: 'Water', food: 'Food', crew: 'Crew', research: 'Research', eco: 'Site protection' };

export function Report() {
  const s = useGame();
  const r = s.report;
  const [page, setPage] = useState<'mission' | 'eng'>('mission');
  if (!r) return null;
  const eng = s.engReports.find((e) => e.day === r.day);
  if (page === 'eng' && eng) {
    return (
      <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="NOVA engineering journal">
        <div className="px-panel pop flex max-h-[94%] w-full max-w-2xl flex-col overflow-y-auto p-5">
          <div className="flex items-center gap-3">
            <NovaFace mood="thinking" size={48} />
            <div>
              <div className="font-pixel text-[10px] text-lilac">NOVA ENGINEERING JOURNAL</div>
              <h2 className="font-pixel mt-1 text-base leading-7 text-sun">DAY {eng.day}: {eng.title.toUpperCase()}</h2>
            </div>
          </div>
          <p className="mb-2 mt-1 text-lg text-lilac">Saved to your Research Journal (Engineering tab).</p>
          <EngReportView r={eng} />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="px-btn ghost text-[10px]" onClick={() => { click(); setPage('mission'); }}>◂ MISSION REPORT</button>
            <button autoFocus className="px-btn flex-1 text-xs" onClick={() => { click(); continueToNextDay(); }}>{r.day >= 10 ? 'CONTINUE' : `CONTINUE TO DAY ${r.day + 1}`}</button>
          </div>
        </div>
      </div>
    );
  }
  const keys: ('energy' | 'oxygen' | 'water' | 'food' | 'crew')[] = ['energy', 'oxygen', 'water', 'food', 'crew'];
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Mission report">
      <div className="px-panel pop flex max-h-[94%] w-full max-w-2xl flex-col overflow-y-auto p-5">
        <div className="font-pixel text-[10px] text-lilac">MISSION REPORT</div>
        <h2 className="font-pixel mt-1 text-base leading-7 text-sun">DAY {r.day}: {r.title.toUpperCase()}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="font-pixel mb-2 text-[9px] text-cyan">COMPLETED</h3>
            <ul className="text-xl leading-6">{r.completed.length ? r.completed.map((c) => <li key={c}>✓ {c}</li>) : <li className="text-[var(--muted)]">—</li>}</ul>
            {r.discoveries.length > 0 && <><h3 className="font-pixel mb-2 mt-3 text-[9px] text-cyan">DISCOVERIES</h3><ul className="text-xl">{r.discoveries.map((c) => <li key={c}>★ {c}</li>)}</ul></>}
          </section>
          <section>
            <h3 className="font-pixel mb-2 text-[9px] text-cyan">OVERNIGHT</h3>
            <ul className="text-xl leading-6">
              {r.lines.map((l, i) => (
                <li key={i} className="flex items-center gap-2"><Icon name={l.icon} size={14} /><span className="min-w-0 flex-1">{l.label}</span><b className={l.delta >= 0 ? 'text-[#7dffb0]' : 'text-alert'}>{l.delta > 0 ? '+' : ''}{l.delta}</b></li>
              ))}
            </ul>
          </section>
        </div>
        <table className="mt-4 w-full text-xl tabular-nums">
          <thead><tr className="text-lilac"><th className="text-left font-normal">Supply</th><th className="text-right font-normal">Before</th><th className="text-right font-normal">Now</th></tr></thead>
          <tbody>{keys.map((k) => <tr key={k} className="border-t border-[var(--line)]"><td className="flex items-center gap-2 py-1"><Icon name={k} size={14} />{LABEL[k]}</td><td className="text-right">{Math.round(r.before[k])}</td><td className={`text-right ${r.after[k] < 25 ? 'text-alert' : ''}`}>{Math.round(r.after[k])}</td></tr>)}</tbody>
        </table>
        {r.warnings.length > 0 && <div className="warn mt-3">{r.warnings.map((w) => <p key={w}>⚠ {w}</p>)}</div>}
        {eng ? (
          <button autoFocus className="px-btn mt-5 text-xs" onClick={() => { click(); setPage('eng'); }}>NOVA'S ENGINEERING REPORT ▸</button>
        ) : (
          <button autoFocus className="px-btn mt-5 text-xs" onClick={() => { click(); continueToNextDay(); }}>
            {r.day >= 10 ? 'CONTINUE' : `CONTINUE TO DAY ${r.day + 1}`}
          </button>
        )}
      </div>
    </div>
  );
}
