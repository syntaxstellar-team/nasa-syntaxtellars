/**
 * NOVA Science Info cards. Each card separates three kinds of information:
 *  - facts:    real science / real NASA missions (checked against NASA material, see docs/SCIENCE_NOTES.md)
 *  - inspired: which real NASA technology the ARES-7 machine is modelled on
 *  - game:     what is fictional or simulated in the game
 * No links or citations are shown in the game; developer references live in docs/SCIENCE_NOTES.md.
 */
export type ScienceId =
  | 'weather' | 'water' | 'greenhouse' | 'solar' | 'analyzer' | 'drone' | 'comm' | 'radiation' | 'gravity' | 'oxygen';

export interface ScienceCard {
  id: ScienceId;
  device: string;
  title: string;
  facts: string[];
  inspired: string;
  game: string;
}

export const SCIENCE: Record<ScienceId, ScienceCard> = {
  weather: {
    id: 'weather',
    device: 'WEATHER TERMINAL',
    title: 'Weather on Mars',
    facts: [
      'The air on Mars is very thin and is made mostly of carbon dioxide.',
      'Air pressure on Mars is less than 1% of the air pressure at sea level on Earth. Scientists measure it in pascals (Pa).',
      'Mars is cold: on most days the temperature stays far below freezing, and nights are even colder.',
      'Wind can lift fine dust into the sky. Sometimes dust storms grow big enough to cover huge parts of the planet.',
    ],
    inspired: 'NASA\'s Perseverance rover carries a weather station called MEDA. It measures air and ground temperature, wind, air pressure, humidity, dust and sunlight.',
    game: 'Our terminal shows SIMULATED weather made for the game. It is not live data from Mars.',
  },
  water: {
    id: 'water',
    device: 'WATER RECOVERY SYSTEM',
    title: 'Recycling Every Drop',
    facts: [
      'Water is heavy, so sending it from Earth is very expensive. Space crews recycle as much as they can.',
      'On the International Space Station, the life support system collects used water — including moisture from the air (breath and sweat) and urine — and cleans it.',
      'The water is filtered, treated in a hot reactor that breaks down tiny leftover chemicals, checked by sensors and made safe to drink again.',
      'In 2023 NASA reported that the station recovers about 98% of its water. That number describes the whole recycling system working together, not one single machine.',
    ],
    inspired: 'Inspired by the Water Recovery System that is part of the space station\'s life support (ECLSS).',
    game: 'The ARES-7 recycler is fictional. Its +8 water each day is a game value.',
  },
  greenhouse: {
    id: 'greenhouse',
    device: 'HYDROPONIC PLANTER',
    title: 'Growing Plants in Space',
    facts: [
      'Plants need water, light, the right temperature, nutrients and air to grow.',
      'Astronauts on the International Space Station grew lettuce and other crops in a plant chamber called Veggie, lit by LED lights.',
      'Another chamber, the Advanced Plant Habitat, is closed and automatic. Its many sensors let scientists on Earth control light, water, temperature and humidity.',
    ],
    inspired: 'Inspired by NASA\'s Veggie and Advanced Plant Habitat experiments.',
    game: 'The ARES-7 greenhouse, its plants and their growing numbers are made up for the game. A real Mars greenhouse would need to be sealed, heated and lit.',
  },
  solar: {
    id: 'solar',
    device: 'SOLAR ARRAY',
    title: 'Sunlight and Dust',
    facts: [
      'Solar panels turn sunlight into electricity.',
      'Mars is farther from the Sun than Earth, so sunlight there is weaker.',
      'Dust slowly settles on solar panels and blocks sunlight. Dust reduced the power of NASA\'s Spirit and Opportunity rovers and of the InSight lander, which ended its mission in 2022.',
      'Sometimes gusts of wind blew dust off the rovers\' panels and their power went back up.',
    ],
    inspired: 'Based on the real experience of NASA\'s solar-powered Mars missions.',
    game: 'The dust level shown on our panels and its effect on energy are simulated for the game.',
  },
  analyzer: {
    id: 'analyzer',
    device: 'ROCK ANALYZER',
    title: 'Reading the Rocks',
    facts: [
      'Rocks are made of minerals, and minerals are made of chemical elements like iron, silicon and magnesium.',
      'Geologists study rocks to learn how they formed — from lava, from layers of mud, or with the help of water.',
      'NASA\'s Perseverance rover collects rock cores in sealed tubes. The rover itself cannot tell whether life ever existed; samples would need study in labs on Earth.',
    ],
    inspired: 'Inspired by two instruments on Perseverance\'s arm: PIXL uses X-rays to map the chemical elements in a rock, and SHERLOC uses an ultraviolet laser to identify minerals and organic molecules.',
    game: 'The ARES-7 Rock Analyzer is fictional and every reading it shows is SIMULATED. Physical samples stay on Mars in the Lab.',
  },
  drone: {
    id: 'drone',
    device: 'SCOUT DRONE',
    title: 'Flying on Mars',
    facts: [
      'NASA\'s Ingenuity helicopter made the first powered, controlled flight on another planet on April 19, 2021.',
      'Because Martian air is so thin, Ingenuity needed big, light rotor blades spinning very fast to lift off.',
      'Ingenuity was planned as a short technology test but flew 72 times, scouting the way for the Perseverance rover. Its mission ended in January 2024.',
    ],
    inspired: 'Our scout drone is inspired by Ingenuity. Ingenuity carried cameras for navigation and scouting — it did not carry instruments for analyzing rocks.',
    game: 'The ARES-7 scout drone, its battery and its flight are fictional.',
  },
  comm: {
    id: 'comm',
    device: 'EARTH DATA LINK',
    title: 'Talking to Earth',
    facts: [
      'Radio signals travel at the speed of light: about 299,792 kilometres every second.',
      'Mars and Earth move around the Sun, so the distance between them keeps changing. A message takes from about 3 to about 22 minutes to travel one way.',
      'NASA talks to faraway spacecraft through the Deep Space Network: giant radio antennas in California, Spain and Australia.',
    ],
    inspired: 'Inspired by how real Mars missions send their data home through the Deep Space Network on Earth.',
    game: 'The ARES-7 antenna is the base\'s own fictional radio, not part of the Deep Space Network. The distance used for the delay is a simulated value.',
  },
  radiation: {
    id: 'radiation',
    device: 'SUIT RADIATION MONITOR',
    title: 'Radiation on Mars',
    facts: [
      'Mars has a thin atmosphere and no global magnetic field like Earth\'s, so more radiation from space reaches the ground.',
      'Radiation dose is measured in millisieverts (mSv).',
      'NASA\'s Curiosity rover carries an instrument called RAD that measures radiation on the surface of Mars. RAD is a rover instrument — not something an astronaut wears.',
      'Astronauts carry personal dosimeters that keep track of the radiation they receive.',
    ],
    inspired: 'The outdoor dose rate in the game is based on the average surface value reported from Curiosity\'s RAD measurements.',
    game: 'The ARES-7 suit monitor and all its readings are SIMULATED. Indoor and event values are made up for the game.',
  },
  gravity: {
    id: 'gravity',
    device: 'MARS GRAVITY',
    title: 'Lighter Steps',
    facts: [
      'Gravity on the surface of Mars is about 3.71 m/s². On Earth it is about 9.81 m/s².',
      'That means Mars has only about 38% of Earth\'s surface gravity.',
      'Objects fall more slowly, and you can stay in the air longer when you jump.',
    ],
    inspired: 'Uses NASA\'s published value for Martian surface gravity.',
    game: 'In the game everything — you, dust and falling things — uses Mars gravity, both inside the base and outside.',
  },
  oxygen: {
    id: 'oxygen',
    device: 'OXYGEN GENERATOR',
    title: 'Making Air to Breathe',
    facts: [
      'People need a steady supply of oxygen, and the carbon dioxide they breathe out has to be removed.',
      'On the International Space Station, a machine splits water into hydrogen and oxygen using electricity.',
    ],
    inspired: 'Inspired by the life support systems of the International Space Station.',
    game: 'The ARES-7 oxygen generator and its repair puzzle are fictional.',
  },
};

/** Which card belongs to each mini-game station. */
export const MG_SCIENCE: Partial<Record<string, ScienceId>> = {
  solar: 'solar', greenhouse: 'greenhouse', antenna: 'comm', oxygen: 'oxygen',
};
