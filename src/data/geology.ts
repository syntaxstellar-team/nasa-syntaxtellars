import type { GameState } from '../store/types';

/**
 * Rock and soil samples the player can collect on Mars.
 * The general geology (what kinds of rock and minerals exist on Mars) is real.
 * The "amount" bars shown by the ARES-7 Rock Analyzer are SIMULATED for the game:
 * they show rough relative levels, not real measurements of any real rock.
 */
export type SampleId = 'soil' | 'sediment' | 'basalt' | 'hematite';

export interface SampleDef {
  id: SampleId;
  name: string;
  where: string;
  look: string;
  rockType: string;
  minerals: string[];
  /** Simulated relative levels 1..5 shown by the analyzer. */
  bars: { label: string; level: number }[];
  /** What the result means, in kid-friendly words (real geology). */
  meaning: string;
  realMission: string;
}

export const SAMPLES: Record<SampleId, SampleDef> = {
  soil: {
    id: 'soil',
    name: 'Regolith (Mars Soil)',
    where: 'Dig at the yellow flag on the Frost Flats',
    look: 'Fine red dust mixed with dark sand grains.',
    rockType: 'Regolith — loose dust, sand and broken rock',
    minerals: ['Iron oxides (rust)', 'Basalt sand: pyroxene and olivine', 'Salts such as sulfates'],
    bars: [{ label: 'Iron', level: 4 }, { label: 'Silicon', level: 4 }, { label: 'Magnesium', level: 2 }, { label: 'Sulfur', level: 2 }],
    meaning: 'Mars soil is made of rock broken down over a very long time. A thin coating of iron oxide — a kind of rust — is what makes Mars look red.',
    realMission: 'Rovers like Curiosity and Perseverance have studied Martian soil up close with instruments on their robotic arms.',
  },
  sediment: {
    id: 'sediment',
    name: 'Layered Sedimentary Rock',
    where: 'The striped rocks near the Solar Field',
    look: 'Thin stripes of fine mud and sand, stacked like pages.',
    rockType: 'Sedimentary rock (mudstone and sandstone layers)',
    minerals: ['Clay minerals', 'Sulfate salts', 'Fine sand grains'],
    bars: [{ label: 'Silicon', level: 4 }, { label: 'Aluminium', level: 3 }, { label: 'Iron', level: 3 }, { label: 'Sulfur', level: 2 }],
    meaning: 'Each layer settled out of wind or water, one on top of another. Clay minerals usually form when rock and water spend a long time together.',
    realMission: 'NASA\'s Curiosity rover studied layered mudstones in Gale Crater that formed in an ancient lake.',
  },
  basalt: {
    id: 'basalt',
    name: 'Basalt',
    where: 'The dark rock inside the Rock Overhang',
    look: 'Dark grey rock dotted with tiny holes left by gas bubbles.',
    rockType: 'Igneous rock (cooled lava)',
    minerals: ['Pyroxene', 'Olivine', 'Feldspar'],
    bars: [{ label: 'Silicon', level: 4 }, { label: 'Iron', level: 4 }, { label: 'Magnesium', level: 3 }, { label: 'Calcium', level: 2 }],
    meaning: 'Basalt forms when lava cools and hardens. Much of the surface of Mars is volcanic rock like this, and Mars has the largest volcano in the Solar System: Olympus Mons.',
    realMission: 'Perseverance found volcanic rocks rich in olivine on the floor of Jezero Crater.',
  },
  hematite: {
    id: 'hematite',
    name: 'Hematite Spherules',
    where: 'Small grey pebbles on the floor of Pebble Canyon',
    look: 'Tiny round grey balls, smaller than a pea.',
    rockType: 'Concretions (mineral balls that grew inside rock)',
    minerals: ['Hematite (an iron oxide)'],
    bars: [{ label: 'Iron', level: 5 }, { label: 'Silicon', level: 1 }, { label: 'Sulfur', level: 1 }, { label: 'Magnesium', level: 1 }],
    meaning: 'Spheres like these can grow when water seeps slowly through rock. They are a clue that water once moved underground here.',
    realMission: 'NASA\'s Opportunity rover found many hematite spheres at Meridiani Planum. Scientists nicknamed them "blueberries".',
  },
};

export const SAMPLE_ORDER: SampleId[] = ['soil', 'sediment', 'basalt', 'hematite'];

/** Shown on every analysis so nobody mistakes the game's numbers for real data. */
export const ANALYZER_NOTE = 'SIMULATED RESULT — the bar levels are made up for the game, based on the kinds of minerals found on Mars.';
export const LIFE_NOTE = 'Rocks keep clues about water and past environments. This scan cannot tell whether life ever existed on Mars — no one has found life there.';

/** Flag that marks a collected sample (soil keeps its original flag for old saves). */
export const sampleFlag = (id: SampleId) => (id === 'soil' ? 'soilCollected' : `got:${id}`);
export const sampleCollected = (s: GameState, id: SampleId) => !!s.flags[sampleFlag(id)];
export const samplesCollected = (s: GameState) => SAMPLE_ORDER.filter((id) => sampleCollected(s, id)).length;
export const samplesAnalyzed = (s: GameState) => SAMPLE_ORDER.filter((id) => s.analyzed.includes(id)).length;

/** The scout drone's survey target on Wind Ridge. */
export const DRONE_TARGET = {
  id: 'ventifacts',
  name: 'Wind-Carved Rocks',
  text: 'Rocks with grooves and pits scraped out by blowing sand over a very long time. Geologists call them ventifacts. Rovers have photographed wind-shaped rocks like these on Mars.',
};
