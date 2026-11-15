# Science notes for developers

The game itself shows no links or citations. This file records where each scientific statement comes from, and what is simulated. Keep it updated when in-game text changes.

## Classification used in the game

| Label in game | Meaning |
|---|---|
| REAL SCIENCE | Established facts about Mars, space or the technology |
| INSPIRED BY NASA | The real NASA mission or instrument an ARES-7 machine is modelled on |
| IN THIS GAME / SIMULATED | Fictional equipment, story, and every reading the game generates |

ARES-7, the astronaut, NOVA, the story, the rock analyzer, the scout drone, the suit monitor, the base antenna and all resource numbers are fictional. No reading is live NASA data.

## Topic table

| Topic | Real basis | Game element | Simulated |
|---|---|---|---|
| Mars gravity | 3.71 m/s² (Earth 9.81), ≈38% — NASA Mars Fact Sheet (NSSDC) | `src/game/physics.ts` `GRAVITY = 3.71 × (900 / 9.81)` px/s²; jump speed tuned for play | Pixel scale and jump speed |
| Atmosphere | Mostly CO₂, surface pressure < 1% of Earth's — NASA Mars Fact Sheet | Weather card, first EVA dialogue | — |
| Weather | MEDA on Perseverance: air/ground temperature, wind, pressure, humidity, dust, radiation/sunlight (NASA Mars 2020 MEDA page; early reports ~718 Pa, highs ≈ −22 °C, lows ≈ −83 °C, gusts ≈ 10 m/s) | Weather terminal, `src/ui/Devices.tsx` `WEATHER` | All per-sol values (chosen inside the reported ranges) |
| Dust storms | Dust lowers daytime highs and raises night lows; global storms occur | Day 5 storm, storm weather row | Storm timing and values |
| Water recovery | ISS ECLSS Water Recovery System; ~98% total recovery reported by NASA in 2023 after the Brine Processor Assembly was added (previously ~93–94%); filters, catalytic reactor, sensors | Water Recovery panel + card | ARES-7 recycler, +8 water/day |
| Plant growth | Veggie (LED light bank, lettuce etc.), Advanced Plant Habitat (enclosed, many sensors, controlled from the ground) | Greenhouse card, NOVA hints | Plant names and ranges (game data) |
| Solar dust | Dust reduced power of Spirit, Opportunity and InSight (InSight ended Dec 2022); wind "cleaning events" restored power on Spirit/Opportunity | Solar card, dust meter | Dust %, −5 energy above 50% |
| Rock analysis | PIXL (X-ray lithochemistry: element maps) and SHERLOC (UV laser, Raman: minerals and organics) on Perseverance's arm — NASA/JPL "Signs of Life on Mars? NASA's Perseverance Rover Begins the Hunt" (2021) | Rock Analyzer | All bar levels; "minerals detected" are typical minerals for each rock type |
| Samples | Basalt and olivine-rich igneous rock in Jezero; layered lake mudstones at Gale (Curiosity); hematite "blueberries" at Meridiani (Opportunity); iron oxide colours the surface | `src/data/geology.ts` | — |
| Ice | Phoenix found water ice just under the soil in the northern plains (2008) | Frost patch dialogue | Location in game |
| Flight | Ingenuity: first powered, controlled flight on another planet, 19 April 2021; 72 flights; last flight 18 Jan 2024, mission ended 25 Jan 2024; tech demo turned scout; navigation/scouting cameras only | Scout drone + card | Drone, battery (50 s), target |
| Radiation | Curiosity RAD measured ≈0.64 mSv/day on the surface (Hassler et al., *Science* 343, 2014; NASA NTRS 20180007641). RAD is a rover instrument, not a personal dosimeter | Suit radiation monitor, `src/data/radiation.ts` | Indoor 0.40, solar event 1.5, shelter 0.30 mSv/day; mission clock (1 real s = 2 base min). No safety thresholds are shown |
| Communication | Speed of light 299,792.458 km/s; one-way Earth–Mars delay ≈3–22 min; Deep Space Network (Goldstone, Madrid, Canberra) | Data Link, Antenna mini-game text | Distance fixed at 225 million km (≈ average Earth–Mars distance, ~140 million miles, NASA); delay = 225e6 / 299792.458 ≈ 750.5 s ≈ 12 min 31 s |
| Oxygen | ISS Oxygen Generation Assembly splits water by electrolysis | Oxygen card | ARES-7 generator and puzzle |

## Not included on purpose

- MOXIE or any MOXIE-based gameplay.
- Growing plants in Martian regolith.
- Mars mapping or a new map system.
- Any Martian animal or claim of life on Mars.

## References (developer use only)

- NASA NSSDC, *Mars Fact Sheet* — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- NASA/JPL, *Signs of Life on Mars? NASA's Perseverance Rover Begins the Hunt* (PIXL, SHERLOC) — https://www.jpl.nasa.gov/news/signs-of-life-on-mars-nasas-perseverance-rover-begins-the-hunt
- Hassler, D. M. et al. (2014), *Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover*, Science 343 — NASA NTRS: https://ntrs.nasa.gov/citations/20180007641
- NASA Mars 2020 mission pages: MEDA instrument; Ingenuity Mars Helicopter mission summary.
- NASA (2023), ISS ECLSS achieves 98% water recovery (Brine Processor Assembly).
- NASA, Veggie and Advanced Plant Habitat fact sheets.
- NASA, InSight mission end (December 2022); Spirit/Opportunity solar array cleaning events.
- NASA Space Communications and Navigation, Deep Space Network overview.
