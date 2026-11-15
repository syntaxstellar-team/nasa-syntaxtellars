/**
 * NOVA Engineering Journal.
 * Every report is built only from what actually happened: the day's event log (recorded as the
 * player acts), the resource snapshot taken when the day began, and the overnight upkeep lines
 * of the Mission Report. Nothing is random. Analysis and lessons are fixed rules that react to
 * those facts; when nothing went wrong the lesson falls back to the day's engineering topic.
 */
import type { DayLog, DayReport, EngReport, FinalReport, GameState, Resources } from '../store/types';
import { MINIGAMES } from './minigames';
import { dayDef } from './days';

type Res = 'energy' | 'oxygen' | 'water';
const RES: Res[] = ['energy', 'oxygen', 'water'];

export const resourcesOf = (s: Resources): Resources => ({
  energy: s.energy, oxygen: s.oxygen, water: s.water, food: s.food, crew: s.crew, ecosystem: s.ecosystem, research: s.research,
});

export function freshDayLog(s: GameState): DayLog {
  return { day: s.day, start: resourcesOf(s), events: [], usage: [] };
}

/** Engineering topic of each day, used as the lesson when nothing went wrong. */
const DAY_LESSON: Record<number, string> = {
  1: 'Inspect before you repair. Knowing exactly what is broken tells engineers what to fix first.',
  2: 'Fix life-critical systems first. People can manage for days without many things — but only minutes without air.',
  3: 'Systems depend on each other: the greenhouse, lab and charger all need the power circuit. Repair the "root" system first.',
  4: 'Maintenance matters. Even a good machine slowly loses performance — dust on solar panels is a real example on Mars.',
  5: 'Every plan is a trade-off. With limited energy, engineers decide what must stay on and what can wait.',
  6: 'Closed loops save supplies. Recycling water costs energy once, but gives back a little every day.',
  7: 'Shielding works by putting mass — like water — between people and radiation.',
  8: 'Good science is careful: collect what you need and leave the rest of the site untouched for others.',
  9: 'Test, then trust. Engineers check a system works before they depend on it — like locking the antenna signal before sending.',
  10: 'Communication closes the loop: data only helps once it reaches the people who can use it.',
};

function usageFrom(log: DayLog, night: DayReport | null): EngReport['usage'] {
  const out = {} as EngReport['usage'];
  for (const r of RES) {
    const items: { label: string; delta: number }[] = [];
    // merge daytime items with the same label (e.g. several suit refills)
    for (const u of log.usage.filter((x) => x.res === r)) {
      const k = items.find((i) => i.label === u.label);
      if (k) k.delta += u.delta; else items.push({ label: u.label, delta: u.delta });
    }
    for (const l of night?.lines ?? []) if (l.icon === r) items.push({ label: `Overnight: ${l.label.toLowerCase()}`, delta: l.delta });
    const used = -items.filter((i) => i.delta < 0).reduce((a, i) => a + i.delta, 0);
    const made = items.filter((i) => i.delta > 0).reduce((a, i) => a + i.delta, 0);
    out[r] = { used, made, items };
  }
  return out;
}

const has = (log: DayLog, text: string) => log.events.some((e) => e.text.includes(text));

/** Build the engineering report for the day that is ending. `night` is null on Day 10 (no night follows). */
export function buildEngReport(s: GameState, night: DayReport | null): EngReport {
  const log = s.dayLog;
  const day = s.day;
  const before = log.start;
  const after: Resources = night ? night.after : resourcesOf(s);
  const usage = usageFrom(log, night);

  // 1. Decisions made: what the player did, in order, plus today's finished objectives
  const decisions: string[] = [];
  const counts = new Map<string, number>();
  for (const e of log.events.filter((x) => x.kind !== 'risk')) counts.set(e.text, (counts.get(e.text) ?? 0) + 1);
  for (const [text, n] of counts) decisions.push(n > 1 ? `${text} (×${n})` : text);
  for (const o of dayDef(day).objectives) if (o.done(s) && !decisions.some((d) => d.toLowerCase() === o.text.toLowerCase())) decisions.push(`Objective done: ${o.text}`);
  if (!decisions.length) decisions.push('No actions were recorded today.');

  // 2./3. Systems at risk (facts at the end of the day)
  const risks: string[] = [];
  const lifeOff = !!night?.warnings.some((w) => w.includes('life support switched off'));
  const storm = !!dayDef(day).storm;
  if (lifeOff) risks.push('Life support: ran out of power during the night');
  if (!s.minigames.oxygen.solved.length) risks.push('Oxygen generator: still leaking air');
  else if (storm && !s.flags.stormLife) risks.push('Oxygen generator: no power during the storm');
  if (!s.minigames.circuit.solved.length && day >= 2) risks.push('Power circuit: broken — half the base is dark');
  if (storm) risks.push('Solar array: no sunlight during the dust storm');
  else if (s.minigames.solar.solved.length && s.dust >= 50) risks.push(`Solar array: dust covers ${Math.round(s.dust)}% (simulated) and blocks sunlight`);
  else if (!s.minigames.solar.solved.length && day >= 4) risks.push('Solar array: not repaired yet');
  for (const t of new Set(log.events.filter((x) => x.kind === 'risk').map((x) => x.text))) risks.push(t);
  if (day === 7) risks.push(s.flags.shelterDone ? 'Radiation: solar particle event — crew sheltered behind water walls' : 'Radiation: solar particle event — crew not sheltered');
  if (after.ecosystem < before.ecosystem) risks.push(`Research sites: disturbed (site protection −${before.ecosystem - after.ecosystem}%)`);
  const low: [keyof Resources, string][] = [['oxygen', 'Oxygen supply'], ['water', 'Water supply'], ['food', 'Food supply']];
  for (const [k, name] of low) if (after[k] < 25) risks.push(`${name}: low (${Math.round(after[k])})`);
  if (after.energy < 15) risks.push(`Energy reserve: low (${Math.round(after.energy)})`);
  if (!s.minigames.antenna.solved.length) risks.push('Earth communication: still offline');
  if (!risks.length) risks.push('No systems at risk tonight. Every system held.');

  // 4. NOVA's analysis: why things worked or failed
  const analysis: string[] = [];
  const add = (cond: boolean, text: string) => { if (cond && analysis.length < 3) analysis.push(text); };
  add(lifeOff, 'Life support ran out of power because there was not enough energy left for the night. Spacecraft always keep a reserve for exactly this reason.');
  add(storm && s.flags.stormPlan === true && !s.flags.stormLife, 'The storm plan could not power life support, so the air got thin overnight.');
  add(has(log, 'Repaired: Oxygen'), 'Repairing the oxygen leak first was the right priority: air is the one supply the crew cannot do without, even for a few minutes.');
  add(has(log, 'Repaired: Power Circuit'), 'Reconnecting the circuit sent power back to the rooms. Energy only helps when it can reach the machines.');
  add(has(log, 'Repaired: Solar Panel'), 'Clean panels facing the Sun now turn sunlight into energy every day (except during storms).');
  add(storm && !!s.flags.stormPlan && !!s.flags.stormHeaters, 'Keeping the greenhouse heaters on cost energy, but it protected the plants from the cold storm night.');
  add(storm && !!s.flags.stormPlan && !s.flags.stormHeaters, 'Switching the heaters off saved energy, but the cold cost food — a real engineering trade-off.');
  add(has(log, 'Water plan: build the recycler'), 'The recycler cost energy once, but it adds water every day. The space station uses the same idea.');
  add(has(log, 'Water plan: drill the frost'), 'Drilling gave lots of water quickly, but it disturbed an untouched research site.');
  add(has(log, 'Canyon sample: picked up loose'), 'Picking up loose spherules gave us a sample and left the canyon wall untouched for future scientists.');
  add(has(log, 'Canyon sample: cut a block'), 'Cutting the canyon wall earned extra research, but it damaged layers that took a very long time to form.');
  add(day === 7 && !!s.flags.shelterDone, 'The water walls put mass between the crew and the particles, so the shelter lowered the dose.');
  const analyzedToday = log.events.filter((e) => e.text.startsWith('Analyzed')).length;
  add(analyzedToday > 0, `Analyzing ${analyzedToday} sample${analyzedToday > 1 ? 's' : ''} turned rocks into data we can share with Earth.`);
  add(!!night?.lines.some((l) => l.label.startsWith('Dust on the panels')), 'Dust on the panels blocked some sunlight and cost energy tonight.');
  const netEnergy = after.energy - before.energy;
  add(netEnergy > 0, `Energy budget: +${netEnergy} today. Repairs, rewards and the Sun earned more than we spent.`);
  add(netEnergy < 0 && !lifeOff, `Energy budget: ${netEnergy} today. We spent more than we earned — fine when it buys something lasting, as long as a reserve remains.`);
  if (!analysis.length) analysis.push('A steady day: nothing changed much, and every system held.');

  // 5. Engineering lesson: the most important thing to improve, or the day's topic
  const lifeNeed = 8 + (s.upgrades['greenhouse-lights'] ? 5 : 0);
  const rules: [boolean, string][] = [
    [lifeOff, `Before ending the day, keep at least ${lifeNeed} energy for the night's life support.`],
    [after.oxygen < 25, 'Keep the oxygen generator repaired and powered — air always comes first.'],
    [after.water < 25, 'Plan for water early: a recycler gives back a little every day.'],
    [after.food < 25, 'Light the greenhouse and grow healthy plants to keep food from running out.'],
    [log.events.some((e) => e.text.includes('Suit oxygen ran out')), 'Watch the suit oxygen bar outside and head back to the airlock at about half.'],
    [after.ecosystem < before.ecosystem, 'Look for ways to collect what you need without destroying the site.'],
    [!storm && s.minigames.solar.solved.length > 0 && s.dust >= 50, 'Brush the solar panels when the dust reaches 50% to keep full power.'],
    [after.energy < 15, 'Earn energy with mini-games and NOVA tasks before buying more upgrades.'],
  ];
  const lesson = rules.find(([c]) => c)?.[1] ?? DAY_LESSON[day] ?? DAY_LESSON[1];

  return { day, title: dayDef(day).title, decisions, usage, risks: risks.slice(0, 5), analysis, lesson, before, after };
}

/** Summary of the whole expedition, built from the saved daily reports. */
export function buildFinalReport(s: GameState): FinalReport {
  const reps = s.engReports;
  const totals = {} as FinalReport['totals'];
  for (const r of RES) totals[r] = { used: reps.reduce((a, x) => a + x.usage[r].used, 0), made: reps.reduce((a, x) => a + x.usage[r].made, 0) };
  const repairs = (Object.keys(MINIGAMES) as (keyof typeof MINIGAMES)[]).filter((k) => s.minigames[k].solved.length).map((k) => MINIGAMES[k].title);
  const science: string[] = [];
  if (s.analyzed.length) science.push(`${s.analyzed.length} rock sample${s.analyzed.length > 1 ? 's' : ''} analyzed`);
  if (s.photos.length) science.push(`${s.photos.length} drone image${s.photos.length > 1 ? 's' : ''}`);
  if (s.transmitted.length) science.push(`${s.transmitted.length} research report${s.transmitted.length > 1 ? 's' : ''} sent to Earth`);
  if (s.flags.beaconPlaced) science.push('New research site marked with a beacon');
  const decisions: string[] = [];
  if (s.flags.stormPlan) decisions.push(`Storm plan: heaters ${s.flags.stormHeaters ? 'on' : 'off'}, sample freezer ${s.flags.stormFreezer ? 'on' : 'off'}`);
  if (s.decisions.water) decisions.push(s.decisions.water === 'recycler' ? 'Water: built the recycler' : 'Water: drilled the frost patch');
  if (s.decisions.canyon) decisions.push(s.decisions.canyon === 'loose' ? 'Canyon: collected loose spherules' : 'Canyon: cut a block from the wall');
  const riskCount = new Map<string, number>();
  let riskDays = 0;
  for (const r of reps) {
    const real = r.risks.filter((x) => !x.startsWith('No systems at risk') && !x.startsWith('Earth communication'));
    if (real.length) riskDays++;
    for (const x of real) { const k = x.split(':')[0]; riskCount.set(k, (riskCount.get(k) ?? 0) + 1); }
  }
  const topRisk = [...riskCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const summary: string[] = [];
  summary.push(`${reps.length} day${reps.length === 1 ? '' : 's'} on Mars. ${repairs.length} of 5 systems repaired.`);
  summary.push(`Energy: ${totals.energy.made} made, ${totals.energy.used} used. Oxygen: ${totals.oxygen.made} made, ${totals.oxygen.used} used. Water: ${totals.water.made} made, ${totals.water.used} used.`);
  summary.push(riskDays ? `Systems were at risk on ${riskDays} day${riskDays > 1 ? 's' : ''}.` : 'No system was ever seriously at risk.');
  // the lessons that came from real problems (not the day-topic fallbacks)
  const topic = new Set(Object.values(DAY_LESSON));
  const lessons = [...new Set(reps.map((r) => r.lesson).filter((l) => !topic.has(l)))].slice(0, 3);
  if (!lessons.length) lessons.push('You kept every system safe. Keep using the same habits: life support first, a reserve of energy, and careful science.');
  return {
    ending: s.ending ?? 'survival', days: reps.length, totals, repairs, science, decisions, riskDays,
    topRisk: topRisk ? `${topRisk[0]} (${topRisk[1]} day${topRisk[1] > 1 ? 's' : ''})` : null,
    crew: Math.round(s.crew), research: s.research, site: s.ecosystem, summary, lessons,
  };
}
