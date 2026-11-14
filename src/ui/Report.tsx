import { useMemo, useState } from 'react';
import { MACHINES, MACHINE_BY_ID } from '../data/machines';
import { LEGS } from '../flight/route';
import { useApp } from '../store';
import type { MachineId } from '../types';
import { formatDate, formatKm, yearsBetween } from './callPlan';
import { renderPostcard } from './postcard';

const POSTCARD_KEY = 'still-here-postcards';
const MAX_MESSAGE = 240;

function savePostcard(entry: { id: string; message: string; from: string; at: string }) {
  try {
    const list = JSON.parse(localStorage.getItem(POSTCARD_KEY) ?? '[]') as unknown[];
    localStorage.setItem(POSTCARD_KEY, JSON.stringify([...list, entry].slice(-20)));
  } catch {
    /* storage unavailable: the download still works */
  }
}

/** The flight log: every stop with its leg, plus a postcard to one machine. */
export function Report() {
  const visited = useApp(s => s.visited);
  const flownKm = useApp(s => s.flownKm);
  const startFlight = useApp(s => s.startFlight);
  const reset = useApp(s => s.reset);
  const years = useMemo(
    () => MACHINES.filter(m => !m.noRadio).reduce((sum, m) => sum + yearsBetween(m.arrived, m.lastContact), 0),
    [],
  );
  const radioCount = MACHINES.filter(m => !m.noRadio).length;

  const [target, setTarget] = useState<MachineId>(MACHINES[0].id);
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const send = async () => {
    const machine = MACHINE_BY_ID[target];
    try {
      const blob = await renderPostcard(machine, message.trim(), from.trim());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postcard-to-${machine.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      savePostcard({ id: target, message: message.trim(), from: from.trim(), at: new Date().toISOString() });
      setStatus(`Postcard to ${machine.shortName} saved as an image.`);
    } catch {
      setStatus('Sorry, this browser could not draw the postcard.');
    }
  };

  return (
    <section className="report" aria-labelledby="report-heading">
      <p className="kicker">Flight log · {new Date().toISOString().slice(0, 10)}</p>
      <h2 id="report-heading">Flight 73, logged.</h2>

      <div className="report-stats">
        <div>
          <strong className="tabular">{formatKm(flownKm)}</strong>
          <span>flown in imagination</span>
        </div>
        <div>
          <strong className="tabular">{Object.keys(visited).length}</strong>
          <span>stops visited</span>
        </div>
        <div>
          <strong className="tabular">{Math.round(years)}</strong>
          <span>years of work by {radioCount} machines</span>
        </div>
      </div>

      <p className="report-line">
        Their missions are over. All of them are still there, exactly where their work ended, and what they found is still being
        used by the missions that came after.
      </p>

      <ol className="report-list">
        {LEGS.map(leg => {
          const m = MACHINE_BY_ID[leg.to];
          return (
            <li key={leg.to} className={visited[leg.to] ? 'silent' : 'uncalled'}>
              <span className="glyph" aria-hidden="true" />
              <span className="r-name">{m.shortName}</span>
              <span className="r-state tabular">{formatKm(leg.distanceKm)}</span>
              <span className="r-date tabular">
                {m.site} · {m.lastContactLabel ?? 'last signal'} {formatDate(m.lastContact)}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="postcard-box">
        <h3>Write a postcard</h3>
        <p className="dim">Pick one machine and tell it something. The card is drawn in your browser and saved as an image; nothing is uploaded.</p>
        <label>
          <span>To</span>
          <select value={target} onChange={e => setTarget(e.target.value as MachineId)}>
            {MACHINES.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Message</span>
          <textarea value={message} maxLength={MAX_MESSAGE} rows={4} onChange={e => setMessage(e.target.value)} placeholder="Thank you for…" />
          <small className="tabular dim">
            {message.length}/{MAX_MESSAGE}
          </small>
        </label>
        <label>
          <span>From (optional)</span>
          <input value={from} maxLength={40} onChange={e => setFrom(e.target.value)} placeholder="A first name or a class" />
        </label>
        <button type="button" className="primary" onClick={send}>
          Save postcard image
        </button>
        <p aria-live="polite" className="dim">
          {status}
        </p>
      </div>

      <div className="report-actions">
        <button type="button" className="ghost" onClick={startFlight}>
          Fly it again
        </button>
        <button type="button" className="ghost" onClick={reset}>
          Back to the start
        </button>
      </div>
    </section>
  );
}
