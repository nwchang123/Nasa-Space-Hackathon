import { useMemo, useState } from 'react';
import { MACHINES, MACHINE_BY_ID } from '../data/machines';
import { useApp } from '../store';
import { formatDate, yearsBetween } from './callPlan';
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

export function Report() {
  const called = useApp(s => s.called);
  const setPhase = useApp(s => s.setPhase);
  const setView = useApp(s => s.setView);
  const reset = useApp(s => s.reset);
  const ids = MACHINES.map(m => m.id).filter(id => called[id]);
  const echoes = ids.filter(id => called[id] === 'echo');
  const years = useMemo(() => ids.reduce((sum, id) => sum + yearsBetween(MACHINE_BY_ID[id].arrived, MACHINE_BY_ID[id].lastContact), 0), [ids]);
  const reflectorsTotal = MACHINES.filter(m => m.reflector).length;
  const complete = ids.length === MACHINES.length;

  const [target, setTarget] = useState(ids[0] ?? MACHINES[0].id);
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
      <p className="kicker">Shift report · {new Date().toISOString().slice(0, 10)}</p>
      <h2 id="report-heading">{complete ? 'Roll call complete.' : 'Shift ended.'}</h2>

      <div className="report-stats">
        <div>
          <strong className="tabular">{ids.length}</strong>
          <span>machines called</span>
        </div>
        <div>
          <strong className="tabular green">{echoes.length}</strong>
          <span>answered</span>
        </div>
        <div>
          <strong className="tabular">{years < 10 ? years.toFixed(1) : Math.round(years)}</strong>
          <span>years of work between them</span>
        </div>
      </div>

      {echoes.length > 0 ? (
        <p className="report-line">
          {echoes.length === reflectorsTotal ? 'All three' : `${echoes.length} of ${reflectorsTotal}`} Apollo reflectors returned your
          laser. They have no power and no moving parts, and observatories still aim at them to measure the Moon&rsquo;s distance.
          Abandoned does not mean finished.
        </p>
      ) : (
        <p className="report-line">
          Nothing answered tonight. But three machines on this list still would. Go back to the Moon and try the laser.
        </p>
      )}

      <ol className="report-list">
        {MACHINES.map(m => (
          <li key={m.id} className={called[m.id] ?? 'uncalled'}>
            <span className="glyph" aria-hidden="true" />
            <span className="r-name">{m.shortName}</span>
            <span className="r-state">{called[m.id] === 'echo' ? 'answered' : called[m.id] === 'silent' ? 'silent' : 'not called'}</span>
            <span className="r-date tabular">last signal {formatDate(m.lastContact)}</span>
          </li>
        ))}
      </ol>

      <div className="postcard-box">
        <h3>Write a postcard</h3>
        <p className="dim">Pick one machine and tell it something. The card is drawn in your browser and saved as an image; nothing is uploaded.</p>
        <label>
          <span>To</span>
          <select value={target} onChange={e => setTarget(e.target.value)}>
            {(ids.length ? ids : MACHINES.map(m => m.id)).map(id => (
              <option key={id} value={id}>
                {MACHINE_BY_ID[id].name}
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
        {!complete && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setView(echoes.length === 0 ? 'moon' : 'overview');
              setPhase('rollcall');
            }}
          >
            Back to the roll call
          </button>
        )}
        <button type="button" className="ghost" onClick={reset}>
          Start a new shift
        </button>
      </div>
    </section>
  );
}
