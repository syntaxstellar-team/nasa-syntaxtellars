import { useState } from 'react';
import type { ReactNode } from 'react';
import type { EngReport, FinalReport } from '../store/types';
import { Icon, NovaFace, click } from './Panels';

const ENDING_NAME: Record<string, string> = {
  success: 'Successful Mission', survival: 'Survival First', ecological: 'Damaged Research Sites', failed: 'Mission Failed',
};

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="eng-sec">
      <h4 className="font-pixel text-[9px] text-cyan">{n}. {title}</h4>
      <div className="mt-1 text-xl leading-6">{children}</div>
    </section>
  );
}

/** One day of NOVA's Engineering Journal: the five sections, built from what really happened. */
export function EngReportView({ r }: { r: EngReport }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Section n={1} title="DECISIONS MADE">
        <ul className="eng-list">{r.decisions.map((d) => <li key={d}>{d}</li>)}</ul>
      </Section>
      <Section n={2} title="RESOURCE USAGE">
        <table className="w-full tabular-nums">
          <thead><tr className="text-lg text-lilac"><th className="text-left font-normal">Supply</th><th className="text-right font-normal">Used</th><th className="text-right font-normal">Made</th><th className="text-right font-normal">Day start → end</th></tr></thead>
          <tbody>
            {(['energy', 'oxygen', 'water'] as const).map((k) => (
              <tr key={k} className="border-t border-[var(--line)]">
                <td className="py-1">
                  <button className="flex items-center gap-2 text-left" aria-expanded={open === k} onClick={() => { click(); setOpen(open === k ? null : k); }}>
                    <Icon name={k} size={14} />{k[0].toUpperCase() + k.slice(1)} <span className="text-lg text-lilac">{open === k ? '▾' : '▸'}</span>
                  </button>
                </td>
                <td className={`text-right ${r.usage[k].used ? 'text-alert' : 'text-[var(--muted)]'}`}>{r.usage[k].used ? `−${r.usage[k].used}` : '0'}</td>
                <td className={`text-right ${r.usage[k].made ? 'text-[#7dffb0]' : 'text-[var(--muted)]'}`}>{r.usage[k].made ? `+${r.usage[k].made}` : '0'}</td>
                <td className="text-right">{Math.round(r.before[k])} → {Math.round(r.after[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open && (
          <ul className="eng-list mt-1 text-lg">
            {r.usage[open as 'energy'].items.length ? r.usage[open as 'energy'].items.map((i, k) => <li key={k}>{i.label}: <b className={i.delta < 0 ? 'text-alert' : 'text-[#7dffb0]'}>{fmt(i.delta)}</b></li>) : <li>No change recorded.</li>}
          </ul>
        )}
      </Section>
      <Section n={3} title="SYSTEMS AT RISK">
        <ul className="eng-list">{r.risks.map((x) => <li key={x} className={x.startsWith('No systems') ? 'text-[#7dffb0]' : ''}>{x}</li>)}</ul>
      </Section>
      <Section n={4} title="NOVA'S ANALYSIS">
        <div className="flex items-start gap-3"><NovaFace mood="thinking" size={40} /><div className="flex flex-col gap-1">{r.analysis.map((a) => <p key={a}>{a}</p>)}</div></div>
      </Section>
      <Section n={5} title="ENGINEERING LESSON">
        <p className="text-sun">★ {r.lesson}</p>
      </Section>
    </div>
  );
}

export function FinalReportView({ f }: { f: FinalReport }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <span className="chip">OUTCOME: {ENDING_NAME[f.ending] ?? f.ending}</span>
        <span className="chip">DAYS LOGGED: {f.days}</span>
        <span className="chip">CREW HEALTH: {f.crew}</span>
        <span className="chip">RESEARCH: {f.research}</span>
        <span className="chip">SITE PROTECTION: {f.site}%</span>
      </div>
      <Section n={1} title="EXPEDITION SUMMARY"><ul className="eng-list">{f.summary.map((x) => <li key={x}>{x}</li>)}</ul></Section>
      <Section n={2} title="SYSTEMS REPAIRED"><p>{f.repairs.length ? f.repairs.join(', ') : 'None'}</p></Section>
      <Section n={3} title="SCIENCE RESULTS"><p>{f.science.length ? f.science.join(' · ') : 'No research recorded.'}</p></Section>
      <Section n={4} title="KEY DECISIONS"><ul className="eng-list">{f.decisions.length ? f.decisions.map((x) => <li key={x}>{x}</li>) : <li>No big decisions recorded.</li>}</ul></Section>
      <Section n={5} title="MOST COMMON RISK"><p>{f.topRisk ?? 'None — every system held.'}</p></Section>
      <Section n={6} title="LESSONS FOR THE NEXT EXPEDITION"><ul className="flex flex-col gap-1">{f.lessons.map((x) => <li key={x} className="text-sun">★ {x}</li>)}</ul></Section>
    </div>
  );
}

/** Day picker + report, used by the Research Journal and the ending screen. */
export function EngArchive({ reports, final }: { reports: EngReport[]; final: FinalReport | null }) {
  const sorted = [...reports].sort((a, b) => a.day - b.day);
  const [sel, setSel] = useState<number | 'final'>(final ? 'final' : sorted[sorted.length - 1]?.day ?? 0);
  if (!sorted.length && !final) return <p className="text-2xl text-[var(--muted)]">NOVA writes an engineering report at the end of every day. Finish Day 1 to see the first one.</p>;
  const r = sorted.find((x) => x.day === sel);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Engineering reports">
        {sorted.map((x) => <button key={x.day} role="tab" aria-selected={sel === x.day} className={`px-btn px-3 py-2 text-[9px] ${sel === x.day ? 'on' : ''}`} onClick={() => { click(); setSel(x.day); }}>DAY {x.day}</button>)}
        {final && <button role="tab" aria-selected={sel === 'final'} className={`px-btn px-3 py-2 text-[9px] ${sel === 'final' ? 'on' : ''}`} onClick={() => { click(); setSel('final'); }}>FINAL REPORT</button>}
      </div>
      {sel === 'final' && final ? <FinalReportView f={final} /> : r ? (
        <>
          <h3 className="font-pixel text-sm text-sun">DAY {r.day}: {r.title.toUpperCase()}</h3>
          <EngReportView r={r} />
        </>
      ) : null}
    </div>
  );
}
