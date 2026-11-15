/**
 * NOVA's step-by-step guidance: for the first unfinished objective of the day, what to do
 * and where to go. Used when the player talks to NOVA and when they seem stuck.
 */
import type { GameState, RoomId } from '../store/types';
import { dayDef } from './days';
import { SAMPLE_ORDER, SAMPLES, sampleCollected, samplesAnalyzed } from './geology';
import { GEAR } from './upgrades';

/** A place in the world: a base room + x inside it, or a tile on the surface. */
export type Spot = { scene: 'base'; room: RoomId; x: number } | { scene: 'explore'; tile: number };

export interface Guide { text: string; spot?: Spot }

const base = (room: RoomId, x: number): Spot => ({ scene: 'base', room, x });
const out = (tile: number): Spot => ({ scene: 'explore', tile });

const GEAR_SPOT: Record<string, { spot: Spot; how: string }> = {
  spacesuit: { spot: base('airlock', 42), how: 'Take the spacesuit from the suit locker in the Airlock (press E).' },
  o2tank: { spot: base('life', 200), how: 'Take an oxygen tank from the rack in Life Support (press E).' },
  battery: { spot: base('power', 222), how: 'Charge the expedition battery at the Battery Charger in the Power Room (press E).' },
  radio: { spot: base('workshop', 124), how: 'Pick up the radio from the shelf in the Workshop (press E).' },
  scanner: { spot: base('command', 89), how: 'Take the research scanner from the research desk in the Command Center (press E).' },
};

const SAMPLE_SPOT: Record<string, { spot: Spot; how: string }> = {
  soil: { spot: out(50), how: 'dig at the yellow flag on the Frost Flats (press E)' },
  sediment: { spot: out(28), how: 'scan the striped rocks next to the solar panels (HOLD E until the bar fills)' },
  basalt: { spot: out(40), how: 'collect the dark rock inside the Rock Overhang (HOLD E)' },
  hematite: { spot: out(76), how: 'pick up the grey pebbles on the floor of Pebble Canyon (press E)' },
};

function gearGuide(s: GameState): Guide | null {
  const miss = GEAR.find((k) => !(s.inventory[k] ?? 0));
  return miss ? { text: GEAR_SPOT[miss].how, spot: GEAR_SPOT[miss].spot } : null;
}

const outsideGuide = (s: GameState, then: Guide): Guide => {
  if (s.scene === 'explore') return then;
  return gearGuide(s) ?? { text: `Go outside first: open the outer hatch in the Airlock (press E). Then ${then.text.charAt(0).toLowerCase()}${then.text.slice(1)}`, spot: base('airlock', 120) };
};

/** Guidance for one objective of the current day. */
function objectiveGuide(s: GameState, day: number, id: string): Guide {
  switch (`${day}:${id}`) {
    case '1:cc': return { text: 'Check the CENTRAL COMPUTER in the Command Center (press E).', spot: base('command', 130) };
    case '1:energy': return { text: 'Look at the ENERGY RESERVES screen in the Command Center (press E).', spot: base('command', 177) };
    case '1:nova': return { text: 'Talk to me! Walk up to me and press E, or click on me.' };
    case '1:accept': return { text: 'Open the MISSION BOARD in the Command Center (press E), find "Repair the Oxygen Leak" and press ACCEPT MISSION.', spot: base('command', 50) };
    case '2:oxy': return { text: 'Repair the OXYGEN GENERATOR in Life Support: press E and play the repair game.', spot: base('life', 69) };
    case '2:grid': return { text: 'Use the POWER DISTRIBUTION console in the Power Room (press E) and turn the cable pieces until power reaches BOTH rooms.', spot: base('power', 120) };
    case '2:check': {
      if (!s.flags['chk:air']) return { text: 'System check 1 of 3: inspect the VENTILATION fan in Life Support (press E) and answer my question.', spot: base('life', 140) };
      if (!s.flags['chk:power']) return { text: 'System check 2 of 3: inspect the BATTERIES in the Power Room (press E) and answer my question.', spot: base('power', 40) };
      return { text: 'System check 3 of 3: read the WEATHER TERMINAL in the Airlock (press E), close it, and answer my question.', spot: base('airlock', 228) };
    }
    case '2:tank': return s.minigames.oxygen.solved.length
      ? { text: 'Take a spare oxygen tank from the rack in Life Support (press E).', spot: base('life', 200) }
      : { text: 'The oxygen tank rack only works after the Oxygen Generator is repaired.', spot: base('life', 69) };
    case '3:circuit': return { text: 'Fix the CIRCUIT PANEL in the Power Room: press E and connect the battery to the lamps.', spot: base('power', 180) };
    case '3:lights': return { text: 'Use the UPGRADE BASE terminal in the Workshop (press E) and buy Greenhouse Lights for 15 energy.', spot: base('workshop', 173) };
    case '4:gear': return gearGuide(s) ?? { text: 'Your gear is complete!' };
    case '4:solar': return outsideGuide(s, { text: 'Walk right to the SOLAR ARRAY outside and press E to clean the panels.', spot: out(20) });
    case '4:sample': return outsideGuide(s, { text: 'Collect a sample: dig at the yellow flag on the Frost Flats (press E), or HOLD E at the striped rocks.', spot: out(28) });
    case '5:plan': return { text: 'Use the STORM POWER PLAN console in the Power Room (press E), choose what stays on, then CONFIRM PLAN.', spot: base('power', 120) };
    case '5:seal': return { text: 'Seal the OUTER HATCH in the Airlock (press E).', spot: base('airlock', 120) };
    case '6:grow': return { text: 'Grow a plant at the HYDROPONIC PLANTER in the Greenhouse. If you get stuck, press ASK NOVA FOR HELP in the game.', spot: base('greenhouse', 70) };
    case '6:water': return { text: 'Open WATER RECOVERY in the Greenhouse (press E) and choose a water plan.', spot: base('greenhouse', 210) };
    case '6:drone': return outsideGuide(s, { text: 'Walk to the SCOUT DRONE pad outside, just past the solar panels, and press E to launch it.', spot: out(25) });
    case '7:tanks': {
      if (s.carrying === 'water') return { text: 'Carry the water to an empty WATER SLOT in the Radiation Shelter (press E).', spot: base('shelter', 46 + 52 * Math.min(2, Number(s.flags.tanksPlaced ?? 0))) };
      const tanks: [string, RoomId, number][] = [['tw', 'workshop', 138], ['tl', 'life', 166], ['tg', 'greenhouse', 166]];
      const t = tanks.find(([id]) => !s.flags[`tank:${id}`]);
      return t ? { text: `Pick up the water container in the ${t[1] === 'life' ? 'Life Support room' : t[1] === 'workshop' ? 'Workshop' : 'Greenhouse'} (press E).`, spot: base(t[1], t[2]) } : { text: 'Place the water you are carrying in the Shelter.', spot: base('shelter', 98) };
    }
    case '7:shield': return { text: 'Power the SHIELD PANEL in the Radiation Shelter (press E).', spot: base('shelter', 204) };
    case '7:cover': return { text: 'Press E at TAKE COVER in the Radiation Shelter.', spot: base('shelter', 204) };
    case '8:rocks': {
      if (!s.upgrades['lab-power']) return { text: 'The Science Lab needs power: press E at its locked door (left of the Airlock) and power it, or buy Science Lab Power at the Workshop.', spot: base('airlock', 8) };
      const carried = SAMPLE_ORDER.filter((id) => (s.inventory[id] ?? 0) > 0 && !s.analyzed.includes(id));
      if (carried.length) return { text: `You are carrying ${SAMPLES[carried[0]].name}. Scan it in the ROCK ANALYZER in the Science Lab (press E).`, spot: base('lab', 60) };
      const need = SAMPLE_ORDER.find((id) => !sampleCollected(s, id));
      if (need && samplesAnalyzed(s) < 3) return outsideGuide(s, { text: `Find another sample outside: ${SAMPLE_SPOT[need].how}.`, spot: SAMPLE_SPOT[need].spot });
      return { text: 'Analyze your samples in the ROCK ANALYZER in the Science Lab.', spot: base('lab', 60) };
    }
    case '9:comm': return { text: 'Walk to the far right of the base and press E at the locked Comm Room door to power it (20 energy).', spot: base('comm', 8) };
    case '9:antenna': return { text: 'Tune the RADIO CONSOLE in the Comm Room (press E) and lock on to Earth.', spot: base('comm', 57) };
    case '10:tx': return { text: 'Power the TRANSMITTER in the Comm Room (press E). It needs 40 energy.', spot: base('comm', 127) };
    case '10:send': return { text: 'Press E at the TRANSMITTER in the Comm Room and send the home signal!', spot: base('comm', 127) };
    default: return { text: 'Check the Mission Board in the Command Center for what to do next.', spot: base('command', 50) };
  }
}

/** What NOVA suggests right now, or null when today's work is done. */
export function nextGuide(s: GameState): Guide | null {
  const def = dayDef(s.day);
  const o = def.objectives.find((x) => !x.done(s));
  if (!o) return null;
  return objectiveGuide(s, s.day, o.id);
}
