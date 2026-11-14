// The stop's signature action controls (src/data/signatures.ts). Values go to the store's `sig`
// by def.key; the scene effects read them there.

import { SIGNATURES, type SignatureDef } from '../../data/signatures';
import { useApp } from '../../store';
import type { MachineId } from '../../types';
import { useNow } from '../useClock';

export function SignatureControls({ stop }: { stop: MachineId }) {
  const defs = SIGNATURES[stop] ?? [];
  const sig = useApp(s => s.sig);
  const now = useNow(200, defs.length > 0);
  if (defs.length === 0) return null;
  return (
    <div className="sig" role="group" aria-label="Try it here">
      {defs.map(def => (
        <SigControl key={def.key} def={def} value={sig[def.key]} now={now} />
      ))}
    </div>
  );
}

function SigControl({ def, value, now }: { def: SignatureDef; value: number | undefined; now: number }) {
  const setSig = useApp(s => s.setSig);
  const used = value !== undefined;
  const readout = def.readout?.(value, now) ?? null;
  const note = [readout, used ? def.caption : null].filter(Boolean).join(' · ');

  let control;
  if (def.kind === 'button') {
    const ms = def.durationMs ?? 0;
    const k = used && ms > 0 ? (now - value) / ms : 1;
    const running = used && k < 1;
    control = (
      <button type="button" className={`sig-btn${running ? ' running' : ''}`} disabled={running} onClick={() => setSig(def.key, Date.now())}>
        <span className="sig-icon" aria-hidden="true">
          {def.icon}
        </span>
        <span className="sig-label">{def.label}</span>
        {running && <span className="sig-progress" style={{ width: `${Math.min(1, k) * 100}%` }} aria-hidden="true" />}
      </button>
    );
  } else if (def.kind === 'toggle') {
    const on = value === 1;
    control = (
      <button type="button" className={`sig-btn toggle${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setSig(def.key, on ? 0 : 1)}>
        <span className="sig-icon" aria-hidden="true">
          {def.icon}
        </span>
        <span className="sig-label">{def.label}</span>
        <span className="sig-state">{on ? 'On' : 'Off'}</span>
      </button>
    );
  } else {
    const min = def.min ?? 0;
    const max = def.max ?? 1;
    const v = value ?? def.initial ?? min;
    control = (
      <label className="sig-slider">
        <span className="sig-slider-head">
          <span className="sig-icon" aria-hidden="true">
            {def.icon}
          </span>
          <span className="sig-label">{def.label}</span>
        </span>
        <input
          type="range"
          aria-label={def.label}
          min={min}
          max={max}
          step={def.step ?? (max - min) / 100}
          value={v}
          onChange={e => setSig(def.key, Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <div className="sig-item">
      {control}
      {note && (
        <p className="sig-note" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
