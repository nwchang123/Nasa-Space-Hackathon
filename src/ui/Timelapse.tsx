import { useEffect, useMemo, useRef, useState } from 'react';
import { MACHINES } from '../data/machines';
import { dateToYear } from '../geo';
import { useApp } from '../store';
import { TIMELAPSE_SECONDS, TIMELAPSE_START, buildTimeline, countsAt } from './timeline';

/** Opening sequence: 1966 → today, machines light up on arrival and go dark at their last signal. */
export function Timelapse() {
  const setTimelapseYear = useApp(s => s.setTimelapseYear);
  const setPhase = useApp(s => s.setPhase);
  const setView = useApp(s => s.setView);
  const events = useMemo(() => buildTimeline(MACHINES), []);
  const endYear = useMemo(() => dateToYear(new Date()), []);
  const [year, setYear] = useState(TIMELAPSE_START);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    setView('overview');
    const start = performance.now();
    let lastPush = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / (TIMELAPSE_SECONDS * 1000));
      // Ease out at the very end so "now" lands gently.
      const eased = k < 0.92 ? k : 0.92 + (1 - (1 - (k - 0.92) / 0.08) ** 2) * 0.08;
      const y = TIMELAPSE_START + (endYear - TIMELAPSE_START) * eased;
      if (t - lastPush > 33 || k === 1) {
        setTimelapseYear(y);
        setYear(y);
        lastPush = t;
      }
      if (k < 1) raf.current = requestAnimationFrame(step);
      else setDone(true);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [endYear, setTimelapseYear, setView]);

  const finish = () => {
    cancelAnimationFrame(raf.current);
    setTimelapseYear(null);
    setPhase('rollcall');
  };

  const past = events.filter(e => e.year <= year);
  const recent = past.slice(-5).reverse();
  const { left, working } = countsAt(MACHINES, year);

  return (
    <section className="timelapse" aria-label="Sixty years of machines left behind">
      <div className="tl-year tabular" aria-live="off">
        {Math.floor(year)}
      </div>
      <div className="tl-counts">
        <span>
          <strong className="tabular">{left}</strong> left behind
        </span>
        <span>
          <strong className="tabular amber">{working}</strong> still talking
        </span>
      </div>
      <ol className="tl-ticker">
        {recent.map((e, i) => (
          <li key={e.machine.id + e.type} className={e.type} style={{ opacity: 1 - i * 0.19 }}>
            <span className="tabular">{e.iso.slice(0, 4)}</span> {e.text}
          </li>
        ))}
      </ol>
      {done ? (
        <div className="tl-end reveal">
          <p>
            {left} machines left behind. None of them answers the radio any more.
            <br />
            Tonight, you will call them all.
          </p>
          <button type="button" className="primary" onClick={finish}>
            Open the roll call <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <button type="button" className="ghost tl-skip" onClick={finish}>
          Skip
        </button>
      )}
    </section>
  );
}
