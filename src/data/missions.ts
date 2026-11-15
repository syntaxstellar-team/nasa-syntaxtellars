import type { GameState, MGId } from '../store/types';
import { sampleCollected, samplesAnalyzed } from './geology';

export type MissionCategory = 'main' | 'nova' | 'explore';

export interface MissionDef {
  id: string;
  category: MissionCategory;
  day: number;
  title: string;
  desc: string;
  objective: string;
  reward: { energy?: number; research?: number };
  /** Reward is the linked mini-game's one-time reward (paid by the mini-game or, if missed, by the board). */
  minigame?: MGId;
  target: number;
  progress: (s: GameState) => number;
}

const f = (s: GameState, k: string) => Number(s.flags[k] ?? 0);
/** With no level given, any solved level counts (the story only needs the repair done). */
const solved = (s: GameState, id: MGId, level?: number) => (level ? s.minigames[id].solved.includes(level) : s.minigames[id].solved.length > 0);
const b = (v: unknown) => (v ? 1 : 0);

export const MISSIONS: MissionDef[] = [
  // ---------------- main story ----------------
  {
    id: 'm-inspect', category: 'main', day: 1,
    title: 'Check the Base', desc: 'The storm hit hard. Find out what still works.',
    objective: 'Look at the central computer, check the energy reserves and talk to NOVA.',
    reward: { energy: 10 }, target: 3,
    progress: (s) => b(s.flags.ccComputer) + b(s.flags.energyChecked) + b(s.flags.talkedNova),
  },
  {
    id: 'm-oxygen', category: 'main', day: 1,
    title: 'Repair the Oxygen Leak', desc: 'Air is escaping from a pipe in the Life Support room.',
    objective: 'Win the Oxygen System Repair game at the Oxygen Generator.',
    reward: { energy: 20 }, minigame: 'oxygen', target: 1,
    progress: (s) => b(solved(s, 'oxygen')),
  },
  {
    id: 'm-power', category: 'main', day: 3,
    title: 'Restore the Power System', desc: 'Broken cables cut power to half the base.',
    objective: 'Win the Power Circuit game at the Circuit Panel in the Power Room.',
    reward: { energy: 25 }, minigame: 'circuit', target: 1,
    progress: (s) => b(solved(s, 'circuit')),
  },
  {
    id: 'm-solar', category: 'main', day: 4,
    title: 'Clean the Solar Panels', desc: 'Our panels are buried in dust. No sunlight, no power.',
    objective: 'Get ready at the Airlock, go outside and win the Solar Panel game.',
    reward: { energy: 30 }, minigame: 'solar', target: 1,
    progress: (s) => b(solved(s, 'solar')),
  },
  {
    id: 'm-storm', category: 'main', day: 5,
    title: 'Prepare for the Dust Storm', desc: 'A giant storm is coming. No sunlight for a whole day.',
    objective: 'Choose a storm power plan in the Power Room and seal the Airlock.',
    reward: { research: 1 }, target: 2,
    progress: (s) => b(s.flags.stormPlan) + b(s.flags.airlockSealed),
  },
  {
    id: 'm-greenhouse', category: 'main', day: 6,
    title: 'Grow Food', desc: 'Our food is running low. The greenhouse needs a scientist.',
    objective: 'Win the Greenhouse Challenge at the Hydroponic Planter.',
    reward: { energy: 15, research: 1 }, minigame: 'greenhouse', target: 1,
    progress: (s) => b(solved(s, 'greenhouse')),
  },
  {
    id: 'm-water', category: 'main', day: 6,
    title: 'Find a Water Source', desc: 'The water tank is low. How should we get more?',
    objective: 'Make a water decision at the Water Tank in the Greenhouse.',
    reward: { research: 1 }, target: 1,
    progress: (s) => b(s.decisions.water),
  },
  {
    id: 'm-radiation', category: 'main', day: 7,
    title: 'Build a Radiation Shelter', desc: 'A storm of particles from the Sun is on its way.',
    objective: 'Carry 3 water containers to the Shelter, power the shield, then take cover.',
    reward: { energy: 10 }, target: 5,
    progress: (s) => Math.min(3, f(s, 'tanksPlaced')) + b(s.upgrades['shelter-shield']) + b(s.flags.shelterDone),
  },
  {
    id: 'm-geology', category: 'main', day: 8,
    title: 'Read the Rocks', desc: 'Rocks remember what Mars was like long ago. Let\'s find out what they say.',
    objective: 'Collect rock samples outside and analyze 3 of them in the Rock Analyzer (Science Lab).',
    reward: { energy: 15 }, target: 3,
    progress: (s) => samplesAnalyzed(s),
  },
  {
    id: 'm-antenna', category: 'main', day: 9,
    title: 'Restore Communication', desc: 'Time to talk to Earth again!',
    objective: 'Power the Comm Room, then win the Antenna Signal game.',
    reward: { energy: 35 }, minigame: 'antenna', target: 1,
    progress: (s) => b(solved(s, 'antenna')),
  },
  {
    id: 'm-home', category: 'main', day: 10,
    title: 'Send the Home Signal', desc: 'Tell Mission Control that ARES-7 is safe.',
    objective: 'Power the big transmitter and send the final message from the Comm Room.',
    reward: {}, target: 2,
    progress: (s) => b(s.upgrades.transmitter) + b(s.flags.finalSignal),
  },
  // ---------------- NOVA's tasks ----------------
  {
    id: 'n-cables', category: 'nova', day: 1,
    title: 'Fix Three Loose Cables', desc: 'Sparking cables are a fire risk.',
    objective: 'Find 3 sparking cables around the base and press E to fix them.',
    reward: { energy: 10 }, target: 3,
    progress: (s) => f(s, 'cablesFixed'),
  },
  {
    id: 'n-lights', category: 'nova', day: 3,
    title: 'Restore Greenhouse Lighting', desc: 'Plants cannot grow in the dark.',
    objective: 'Spend energy on the Greenhouse Lights upgrade.',
    reward: { energy: 5, research: 1 }, target: 1,
    progress: (s) => b(s.upgrades['greenhouse-lights']),
  },
  {
    id: 'n-circuit3', category: 'nova', day: 3,
    title: 'Expert Electrician', desc: 'Think you can power two lamps at once?',
    objective: 'Finish level 3 of Power Circuit.',
    reward: { energy: 10 }, target: 1,
    progress: (s) => b(solved(s, 'circuit', 3)),
  },
  {
    id: 'n-solar2', category: 'nova', day: 4,
    title: 'Follow the Sun', desc: 'The Sun moves across the sky. Can the panels keep up?',
    objective: 'Finish level 2 of Solar Panel Alignment.',
    reward: { energy: 10 }, target: 1,
    progress: (s) => b(solved(s, 'solar', 2)),
  },
  {
    id: 'n-analyze', category: 'nova', day: 6,
    title: 'Analyze a Sample', desc: 'What is Mars soil made of?',
    objective: 'Bring any rock or soil sample to the Rock Analyzer in the Science Lab.',
    reward: { energy: 5, research: 1 }, target: 1,
    progress: (s) => Math.min(1, samplesAnalyzed(s)),
  },
  {
    id: 'n-plant', category: 'nova', day: 10,
    title: 'Food for the Next Crew', desc: 'Potatoes are trickier than lettuce. Leave a harvest for the next expedition!',
    objective: 'Finish level 2 of the Greenhouse Challenge.',
    reward: { energy: 10, research: 1 }, target: 1,
    progress: (s) => b(solved(s, 'greenhouse', 2)),
  },
  {
    id: 'n-syscheck', category: 'nova', day: 2,
    title: 'Full System Check', desc: 'Engineers inspect every system after a storm — even the ones that seem fine.',
    objective: 'Inspect the Ventilation, the Batteries and the Weather Terminal, and answer NOVA\'s question at each.',
    reward: { energy: 10, research: 1 }, target: 3,
    progress: (s) => b(s.flags['chk:air']) + b(s.flags['chk:power']) + b(s.flags['chk:weather']),
  },
  {
    id: 'n-transmit', category: 'nova', day: 9,
    title: 'Send Science Home', desc: 'Scientists on Earth are waiting for our results.',
    objective: 'Send a research report from the Data Link terminal in the Comm Room.',
    reward: { energy: 10, research: 1 }, target: 1,
    progress: (s) => Math.min(1, s.transmitted.length),
  },
  {
    id: 'n-signal', category: 'nova', day: 9,
    title: 'Master the Signal Puzzle', desc: 'Can you lock on through strong interference?',
    objective: 'Finish level 2 of Antenna Signal.',
    reward: { energy: 10 }, target: 1,
    progress: (s) => b(solved(s, 'antenna', 2)),
  },
  // ---------------- exploration ----------------
  {
    id: 'x-basalt', category: 'explore', day: 4,
    title: 'Find Volcanic Rock', desc: 'There is dark rock under the Rock Overhang past the solar panels.',
    objective: 'Collect a basalt sample in the Rock Overhang (hold E).',
    reward: { energy: 5, research: 1 }, target: 1,
    progress: (s) => b(sampleCollected(s, 'basalt')),
  },
  {
    id: 'x-rocks', category: 'explore', day: 4,
    title: 'Investigate Unusual Rocks', desc: 'Striped rocks stand near the base. What made the stripes?',
    objective: 'Scan the striped rocks outside (hold E) to study their layers.',
    reward: { research: 1 }, target: 1,
    progress: (s) => b(s.flags.rocksScanned),
  },
  {
    id: 'x-soil', category: 'explore', day: 4,
    title: 'Collect a Soil Sample', desc: 'Scientists learn a lot from a handful of dirt.',
    objective: 'Dig up a soil sample at the marked flag outside.',
    reward: { energy: 8 }, target: 1,
    progress: (s) => b(s.flags.soilCollected),
  },
  {
    id: 'x-hematite', category: 'explore', day: 8,
    title: 'Hunt for Hematite', desc: 'Tiny grey pebbles lie on the floor of Pebble Canyon.',
    objective: 'Collect hematite spherules in Pebble Canyon.',
    reward: { research: 1 }, target: 1,
    progress: (s) => b(sampleCollected(s, 'hematite')),
  },
  {
    id: 'x-drone', category: 'explore', day: 6,
    title: 'Scout with the Drone', desc: 'The high ridge is hard to study on foot. Send the scout drone!',
    objective: 'Launch the scout drone from its pad outside and photograph the rocks on Wind Ridge.',
    reward: { energy: 10, research: 1 }, target: 1,
    progress: (s) => b(s.photos.length),
  },
  {
    id: 'x-location', category: 'explore', day: 8,
    title: 'Find a New Research Location', desc: 'NOVA\'s map shows a rock arch far to the east.',
    objective: 'Reach the Rock Arch and place a research beacon.',
    reward: { energy: 10, research: 1 }, target: 1,
    progress: (s) => b(s.flags.beaconPlaced),
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export const CATEGORY_LABEL: Record<MissionCategory, string> = {
  main: 'Main Missions',
  nova: "NOVA's Tasks",
  explore: 'Exploration',
};
