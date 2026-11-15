# LOST SIGNAL — A Mars Scientific Adventure

*Survive the storm. Read the rocks. Send your science home.*

A 2D pixel-art science adventure for explorers aged 7–12, made for the NASA Space Apps Challenge 2026. A dust storm has damaged the fictional ARES-7 research base on Mars. With NOVA, a friendly robot, you repair the base over ten mission days (sols), play five science mini-games to earn energy, explore the Martian surface, study real kinds of Mars rock, and send your research and a final signal home to Earth.

Mars is real and the science is based on real space research. ARES-7, the astronaut, NOVA and the story are fictional, and environmental readings are simulated for gameplay. This is an independent educational project, not an official NASA game.

## Run it

Requires Node.js 18 or newer.

```bash
npm install          # installs React, Vite, Tailwind CSS and TypeScript
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
npm run standalone   # optional: one self-contained file in dist-standalone/index.html
```

`package-lock.json` is created by your first `npm install`; commit it to the repository.

### Publish to GitHub and Vercel

1. Create a new, empty GitHub repository.
2. In this folder: `git init`, `git add .`, `git commit -m "LOST SIGNAL"`, then add the remote and push.
3. In Vercel choose **Add New → Project**, import the repository. Vercel detects **Vite** automatically:
   build command `npm run build`, output directory `dist`, install command `npm install`. No environment variables are needed.

## Controls

| Key | Action |
|---|---|
| A / D or ← → | Walk (and fly the scout drone) |
| W / Space / ↑ | Jump (Mars gravity: higher, slower jumps). Climb with the drone |
| S / ↓ | Sink with the drone |
| E | Use, talk, pick up. Hold E to scan or collect rock samples |
| Click / tap | Use the thing you point at; all buttons |
| Esc | Pause |

On touch screens, on-screen ◀ ▶ ▲ E buttons appear automatically (Settings → Touch buttons can force them on or off).

## What's in the game

- **About screen** on the very first launch (stored in LocalStorage), reopened from **ABOUT THE GAME** in the main menu.
- **Opening cinematic** (~64 s + an in-game wake-up scene): journey to Mars, landing, meeting NOVA, the dust storm. Has a Skip Intro button.
- **The base**: nine side-view rooms (Science Lab, Airlock, Workshop, Command Center, Power Room, Life Support, Greenhouse, Radiation Shelter, Comm Room).
- **Mars gravity everywhere**: one gravity constant, 3.71 m/s² scaled to the game world (≈38% of the Earth-tuned value), used by the player inside and outside and by dust particles.
- **NOVA Science Info cards**: the first time you use a science device, NOVA shows a card that separates REAL SCIENCE, INSPIRED BY NASA and IN THIS GAME (fictional/simulated). Afterwards the device opens directly; every device has a SCIENCE INFO button. Seen cards are saved.
- **Devices**
  - Weather terminal (Airlock) — simulated temperature, pressure (Pa), wind (m/s), dust activity and advisory per sol; inspired by MEDA on Perseverance. Labelled "SIMULATED MARS WEATHER — NOT LIVE DATA".
  - Water Recovery System (Greenhouse) — used water → processing → filtration → recovered water; ISS ECLSS / WRS background (98% is the whole ISS system's recovery). The existing water decision and values are unchanged.
  - Greenhouse planter — "ASK NOVA FOR HELP" gives 3 progressive hints; hint 3 reads the plant's real ranges from the game's plant data. Veggie / Advanced Plant Habitat background.
  - Solar array — dust slowly builds up (simulated). Above 50% it costs 5 energy a day; brush it off outside or replay the mini-game.
  - Rock Analyzer (Science Lab) — scan collected samples; simulated relative element levels and real mineral types; PIXL/SHERLOC background. Results go to the Research Journal; physical samples stay in the Lab cache on Mars.
  - Scout drone (pad outside, from Day 6) — fly to Wind Ridge, photograph wind-carved rocks, the drone flies home; Ingenuity background (it carried cameras, not rock instruments).
  - Suit radiation monitor (HUD chip) — dose rate (mSv/day), accumulated dose (mSv) from the simulated mission clock, and status. The outdoor rate uses the average reported from Curiosity's RAD; other values are simulated, with no invented safety thresholds.
  - Earth Data Link (Comm Room) — choose a finished research report, review it, TRANSMIT RESEARCH DATA. Shows simulated distance (225 million km), one-way signal delay (distance ÷ 299,792.458 km/s ≈ 12 min 31 s), estimated arrival and status. Each report is sent once.
- **Five mini-games** (Power Circuit, Oxygen System Repair, Solar Panel Alignment, Greenhouse Challenge, Antenna Signal), unchanged.
- **Geology** instead of wildlife: regolith (soil), layered sedimentary rock, basalt and hematite spherules. Exploration areas: Solar Field, Rock Overhang, Frost Flats, Pebble Canyon, Wind Ridge, Dune Plains, Rock Arch.
- **Ten days** with decisions (water source, how to sample the canyon, storm power plan) and **four endings**: Successful Mission, Survival First, Damaged Research Sites, Mission Failed.
- **NOVA guidance**: talking to NOVA gives the exact next step with directions ("Life Support — 2 rooms to your right") and a bobbing guide arrow. If no objective progress is made for 60 s of play, NOVA offers that hint by herself (then every 90 s). Tapping E on a hold-to-scan object three times triggers a "hold E" tip. From Day 2 on, each day's missions are added to the Mission Board automatically, so nothing is blocked by a missed ACCEPT (Day 1 still teaches accepting a mission). Logic: `src/data/guide.ts`.
- **Day 2 — System Check**: besides the oxygen repair (already done if you fixed it on Day 1), NOVA asks one question at the Ventilation, the Batteries and the Weather Terminal (only a correct answer ticks it off), and you take a spare oxygen tank. NOVA task "Full System Check" rewards it.
- **Day 2 — Power Distribution Emergency**: NOVA reports a power fault; at the POWER DISTRIBUTION console in the Power Room you reroute power to Life Support and the Command Center (a two-branch board of the circuit game). Required to finish Day 2; it does not count as the Day 3 main circuit repair.
- **Rock research hints**: near the research rocks NOVA reminds you to accept the rock mission if it is not on your list, explains how, and once active says to HOLD E at the rocks. Each hint is shown once.
- **Rock Arch**: a natural reddish-brown pixel-art rock arch marks the Day 8 research site.
- **Day 6 — three different jobs**: grow one healthy plant, choose a water plan, and test-fly the scout drone. The second plant (potatoes) moved to an optional Day 10 task.
- **NOVA Engineering Journal**: after the Mission Report each night, NOVA shows a short engineering report — Decisions Made, Resource Usage (energy, oxygen, water used and made, with causes), Systems at Risk, NOVA's Analysis and an Engineering Lesson. It is built only from logged gameplay events, the day-start resource snapshot and the overnight upkeep (`src/data/engineering.ts`). Reports are saved and listed in Journal → ENGINEERING. After Day 10 (or a failed mission) a Final Mission Report sums up the expedition on the ending screen.
- **Science Notes** screen (no links): what is real, NASA-inspired or simulated, plus every science card.
- **Saving**: automatic, to LocalStorage. Saves from earlier versions still load.

## Code layout

```
src/
  App.tsx                 screens: about (first launch) → menu → intro → game
  store/                  one shared game state (types + store with autosave, missions, rewards, day cycle)
  data/                   days, missions, geology, science cards, radiation clock, mini-game text, upgrades/items
  game/                   canvas engine: World, BaseScene, ExploreScene (incl. scout drone), IntroScene, MenuScene,
                          pixel art (art/), audio synth, bitmap font, physics (Mars gravity constants)
  minigames/              the five mini-games (React + canvas)
  ui/                     HUD, dialogue, screens, Devices.tsx (science cards, weather, water, analyzer,
                          dosimeter, data link, about), mini-game shell, ending
docs/SCIENCE_NOTES.md     developer references for every scientific statement (not shown in the game)
```

All pixel art is drawn in code and all sound is synthesized with Web Audio, so there are no asset files.

## Notes

- `window.__aurelia`, `window.__world` and `window.__mg` are read-only debugging handles (the save keys keep their old names so existing saves still load).
- The game never shows external links or citations; see `docs/SCIENCE_NOTES.md`.
