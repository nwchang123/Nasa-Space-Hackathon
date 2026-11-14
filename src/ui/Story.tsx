import type { Machine } from '../types';

const BEATS: { key: keyof Machine['story']; label: string }[] = [
  { key: 'why', label: 'Why I came' },
  { key: 'found', label: 'What I found' },
  { key: 'lastDay', label: 'My last day' },
  { key: 'stillHere', label: 'Still here' },
];

/** The machine's four first-person beats, revealed one after another. */
export function Story({ machine, instant }: { machine: Machine; instant: boolean }) {
  return (
    <div className={`story${instant ? ' instant' : ''}`} key={machine.id}>
      {BEATS.map((b, i) => (
        <section key={b.key} className="beat" style={{ animationDelay: instant ? '0s' : `${0.25 + i * 1.1}s` }}>
          <h4>{b.label}</h4>
          <p>{machine.story[b.key]}</p>
        </section>
      ))}
      <footer className="sources" style={{ animationDelay: instant ? '0s' : '4.8s' }}>
        <span>Sources</span>
        {machine.sources.map(s => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        ))}
      </footer>
    </div>
  );
}
