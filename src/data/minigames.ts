import type { MGId, RoomId } from '../store/types';

export interface MiniGameMeta {
  id: MGId;
  title: string;
  topic: string;
  room: RoomId | 'outside';
  station: string;
  intro: string;
  how: string[];
  levels: string[];
  reward: { energy: number; research?: number };
  science: string;
  extra: string;
  practice: number;
}

export const MINIGAMES: Record<MGId, MiniGameMeta> = {
  circuit: {
    id: 'circuit',
    title: 'Power Circuit',
    topic: 'Electricity & engineering',
    room: 'power',
    station: 'Circuit Panel',
    intro: 'The storm shook the cables loose. Connect the battery to the base so power can flow again.',
    how: ['Tap a cable piece to turn it.', 'Make one unbroken path from the battery to every lamp.', 'Press ACTIVATE when you think it is ready.'],
    levels: ['Simple connection', 'Rocks in the way', 'Two lamps at once'],
    reward: { energy: 25 },
    science: 'Electricity needs a complete circuit to flow. Engineers design electrical systems to deliver power safely.',
    extra: 'A circuit is a loop. If there is a gap anywhere, the electricity stops — that is exactly how a light switch works: it opens a gap on purpose.',
    practice: 3,
  },
  oxygen: {
    id: 'oxygen',
    title: 'Oxygen System Repair',
    topic: 'Life support',
    room: 'life',
    station: 'Oxygen Generator',
    intro: 'Air is hissing out of a cracked pipe! Find the leaks, replace the broken pipes and switch the fan back on.',
    how: ['1. Tap the hissing spots to seal the leaks.', '2. Drag the right pipe piece into each gap.', '3. Hold PUMP to keep the pressure needle in the green zone.'],
    levels: ['Small leak', 'Big network'],
    reward: { energy: 20 },
    science: 'Space habitats need life-support systems to help astronauts maintain breathable air.',
    extra: 'On the International Space Station, a machine uses electricity to split water into hydrogen and oxygen, so the crew always has fresh air to breathe.',
    practice: 3,
  },
  solar: {
    id: 'solar',
    title: 'Solar Panel Alignment',
    topic: 'Solar power',
    room: 'outside',
    station: 'Solar Array',
    intro: 'Red dust covers the solar panels. Wipe them clean, then turn them to face the Sun.',
    how: ['1. Rub the dust off every panel (hold and drag).', '2. Tilt each panel toward the Sun with the arrow buttons.', '3. Keep the power meter above the target line.'],
    levels: ['Sun stands still', 'Follow the moving Sun'],
    reward: { energy: 30 },
    science: 'Solar panels convert sunlight into electricity. Dust and the angle of sunlight can affect how much energy they produce.',
    extra: 'Real Mars landers have been slowed down by dust. NASA\'s InSight lander finished its mission in 2022 after dust kept piling up on its solar panels.',
    practice: 3,
  },
  greenhouse: {
    id: 'greenhouse',
    title: 'Greenhouse Challenge',
    topic: 'Plant biology',
    room: 'greenhouse',
    station: 'Hydroponic Planter',
    intro: 'Our plants are not growing well. Experiment with water, light and warmth to find what they need.',
    how: ['Set water, light and temperature with the sliders.', 'Choose how many days to grow, then press GROW.', 'Look at the plant: its leaves tell you what to change.'],
    levels: ['Space lettuce', 'Moon potatoes'],
    reward: { energy: 15, research: 1 },
    science: 'Plants need suitable conditions to grow. Scientists study how to produce food using limited water, light and energy in space habitats.',
    extra: 'Astronauts on the International Space Station have grown lettuce, radishes and chili peppers in small plant chambers that use red and blue LED lights.',
    practice: 3,
  },
  antenna: {
    id: 'antenna',
    title: 'Antenna Signal',
    topic: 'Radio communication',
    room: 'comm',
    station: 'Radio Console',
    intro: 'The antenna is fixed, but the radio is lost in static. Find Earth\'s frequency and hold the signal steady.',
    how: ['1. Turn the dial until the signal bars are full.', '2. Keep the needle inside the LOCK zone while the static pushes it around.', '3. Press TRANSMIT.'],
    levels: ['Calm static', 'Strong interference'],
    reward: { energy: 35 },
    science: 'Spacecraft communicate with Earth using radio signals. Because space is enormous, messages can take time to arrive.',
    extra: 'Radio waves travel at the speed of light, but a message between Mars and Earth still takes between about 3 and 22 minutes, depending on where the two planets are in their orbits.',
    practice: 3,
  },
};

export const MG_ORDER: MGId[] = ['circuit', 'oxygen', 'solar', 'greenhouse', 'antenna'];
