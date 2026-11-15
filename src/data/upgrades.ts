import type { GameState } from '../store/types';

export interface UpgradeDef {
  id: string;
  title: string;
  desc: string;
  cost: number;
  /** Returns null when it can be bought, or a short reason when it can't yet. */
  locked: (s: GameState) => string | null;
  /** Shown in the Upgrade Base list (some are only bought at their machine). */
  inList: boolean;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'workshop-lights', title: 'Workshop Lights', desc: 'Turn the lights back on in the Workshop.', cost: 10, locked: () => null, inList: true },
  {
    id: 'greenhouse-lights', title: 'Greenhouse Lights', desc: 'Grow lamps for the plants. Opens the Greenhouse.', cost: 15,
    locked: (s) => (s.minigames.circuit.solved.length ? null : 'Fix the Power Circuit first'), inList: true,
  },
  {
    id: 'battery-charge', title: 'Charge Expedition Battery', desc: 'A full battery for trips outside.', cost: 10,
    locked: (s) => (s.minigames.circuit.solved.length ? null : 'Fix the Power Circuit first'), inList: true,
  },
  {
    id: 'lab-power', title: 'Science Lab Power', desc: 'Opens the Science Lab and its Rock Analyzer.', cost: 10,
    locked: (s) => (s.day >= 6 ? null : 'Available from Day 6'), inList: true,
  },
  {
    id: 'solar-tracker', title: 'Solar Tracker', desc: 'Panels follow the Sun by themselves: +10 energy every day.', cost: 25,
    locked: (s) => (s.minigames.solar.solved.length ? null : 'Repair the solar panels first'), inList: true,
  },
  {
    id: 'water-recycler', title: 'Water Recycler', desc: 'Cleans used water so we can drink it again: +8 water every day.', cost: 20,
    locked: (s) => (s.day >= 6 ? null : 'Available from Day 6'), inList: true,
  },
  {
    id: 'shelter-shield', title: 'Shelter Shield', desc: 'Powers the Radiation Shelter.', cost: 15,
    locked: (s) => (s.day < 7 ? 'Available on Day 7' : Number(s.flags.tanksPlaced ?? 0) < 3 ? 'Place 3 water containers first' : null), inList: true,
  },
  {
    id: 'comm-power', title: 'Comm Room Power', desc: 'Opens the Comm Room and its radio.', cost: 20,
    locked: (s) => (s.day >= 9 ? null : 'Available on Day 9'), inList: true,
  },
  {
    id: 'transmitter', title: 'Big Transmitter', desc: 'Strong enough to reach Earth.', cost: 40,
    locked: (s) => (s.day < 10 ? 'Available on Day 10' : s.minigames.antenna.solved.length ? null : 'Fix the antenna first'), inList: true,
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const ITEMS: Record<string, { name: string; desc: string; where: string }> = {
  spacesuit: { name: 'Spacesuit', desc: 'Keeps you warm and pressurized outside.', where: 'Suit locker in the Airlock' },
  o2tank: { name: 'Oxygen Supply', desc: 'Air for your suit. Refills every time you come back inside.', where: 'Tank rack in Life Support (after the oxygen repair)' },
  battery: { name: 'Battery', desc: 'Powers your suit lamp and scanner.', where: 'Charger in the Power Room (costs 10 energy)' },
  radio: { name: 'Communication Device', desc: 'Lets NOVA talk to you outside.', where: 'Shelf in the Workshop' },
  scanner: { name: 'Research Scanner', desc: 'Hold E near something interesting to study it.', where: 'Research desk in the Command Center' },
  soil: { name: 'Regolith Sample', desc: 'Red Mars soil. Analyze it in the Science Lab\'s Rock Analyzer.', where: 'Yellow flag on the Frost Flats' },
  sediment: { name: 'Layered Rock Sample', desc: 'A chip of striped sedimentary rock. Analyze it in the Science Lab.', where: 'Striped rocks near the Solar Field' },
  basalt: { name: 'Basalt Sample', desc: 'Dark volcanic rock. Analyze it in the Science Lab.', where: 'Rock Overhang past the solar panels' },
  hematite: { name: 'Hematite Spherules', desc: 'Tiny grey iron-mineral balls. Analyze them in the Science Lab.', where: 'Floor of Pebble Canyon' },
  beacon: { name: 'Research Beacon', desc: 'Marks a new research site.', where: 'Workshop' },
  water: { name: 'Water Container', desc: 'Heavy! Water blocks radiation well.', where: 'Around the base on Day 7' },
};

export const GEAR = ['spacesuit', 'o2tank', 'battery', 'radio', 'scanner'];
