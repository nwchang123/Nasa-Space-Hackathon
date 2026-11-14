// The stop's signature action controls (src/data/signatures.ts). Values go to the store's `sig`
// by def.key; the scene effects read them there every frame, so the 3D follows the hand: sliders
// show a live readout, and a hold control charges while pressed (pointer, touch, or Space/Enter
// while focused) and fires on release.

import { useEffect, useRef } from 'react';
import { SIGNATURES, type SignatureDef } from '../../data/signatures';
import { holdCharge, holdRunMs } from '../../scene/signatures/logic';
import { useApp } from '../../store';
import type { MachineId } from '../../types';
import { useNow } from '../useClock';
import './sigcontrols.css';

export function SignatureControls({ stop }: { stop: MachineId }) {
  const defs = SIGNATURES[stop] ?? [];
  const sig = useApp(s => s.sig);
  const now = useNow(200, defs.length > 0);
  if (defs.length === 0) return null;
  return (
    <div className="sig" role="group" aria-label="Try it here">
      {defs.map(def => (
        <SigControl key={def.key} def={def} value={sig[def.key]} sig={sig} now={now} />
      ))}
    </div>
  );
}

function SigControl({ def, value, sig, now }: { def: SignatureDef; value: number | undefined; sig: Record<string, number>; now: number }) {
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
  } else if (def.kind === 'hold') {
    control = <HoldControl def={def} charge={value} holding={sig[`${def.key}:hold`] === 1} fireAt={sig[`${def.key}:fire`]} now={now} />;
  } else {
    const min = def.min ?? 0;
    const max = def.max ?? 1;
    const v = value ?? def.initial ?? min;
    // A 0..1 slider gets a live percentage; ranged ones (the storm's tau) have their own readout.
    const pct = min === 0 && max === 1 ? `${Math.round(v * 100)} %` : null;
    control = (
      <label className="sig-slider">
        <span className="sig-slider-head">
          <span className="sig-icon" aria-hidden="true">
            {def.icon}
          </span>
          <span className="sig-label">{def.label}</span>
          {pct && (
            <span className="sigx-pct" aria-hidden="true">
              {pct}
            </span>
          )}
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

const isHoldKey = (k: string) => k === ' ' || k === 'Enter';

/**
 * Press and hold to charge, release to fire (kind 'hold'). While held: sig[`${key}:hold`] = 1 and
 * sig[key] rises 0→1 over chargeMs, every frame. On release: sig[key] keeps the charge,
 * sig[`${key}:hold`] = 0 and sig[`${key}:fire`] = Date.now(). Locked while the fired effect runs.
 */
function HoldControl({
  def,
  charge,
  holding,
  fireAt,
  now,
}: {
  def: SignatureDef;
  charge: number | undefined;
  holding: boolean;
  fireAt: number | undefined;
  now: number;
}) {
  const setSig = useApp(s => s.setSig);
  const run = useRef<{ start: number; raf: number } | null>(null);
  const chargeMs = def.chargeMs ?? 2500;
  const runMs = holdRunMs(def.durationMs ?? 0, charge ?? 0);
  const running = !holding && fireAt !== undefined && now - fireAt < runMs;
  const k = running && fireAt !== undefined ? Math.min(1, (now - fireAt) / runMs) : 0;

  const start = () => {
    if (run.current || running) return;
    const t0 = performance.now();
    setSig(def.key, 0);
    setSig(`${def.key}:hold`, 1);
    const tick = () => {
      const r = run.current;
      if (!r) return;
      setSig(def.key, holdCharge(r.start, performance.now(), chargeMs));
      r.raf = requestAnimationFrame(tick);
    };
    run.current = { start: t0, raf: requestAnimationFrame(tick) };
  };
  const release = () => {
    const r = run.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    run.current = null;
    setSig(def.key, holdCharge(r.start, performance.now(), chargeMs));
    setSig(`${def.key}:hold`, 0);
    setSig(`${def.key}:fire`, Date.now());
  };
  // Leaving the stop mid-hold: stop charging (the store clears `sig` on the stage change).
  useEffect(
    () => () => {
      if (run.current) cancelAnimationFrame(run.current.raf);
      run.current = null;
    },
    [],
  );

  const pct = Math.round((charge ?? 0) * 100);
  const label = holding ? 'Charging… release to fire' : running ? `Pulsing · strength ${pct} %` : def.label;
  return (
    <button
      type="button"
      className={`sig-btn sigx-hold${holding ? ' holding' : ''}${running ? ' running' : ''}`}
      aria-label={def.label}
      aria-pressed={holding}
      aria-disabled={running}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable: release still comes from pointerup on the button */
        }
        start();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => {
        if (!isHoldKey(e.key)) return;
        // Keep Space/Enter from reaching the scene's own key handlers (fly, boost).
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) start();
      }}
      onKeyUp={e => {
        if (!isHoldKey(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        release();
      }}
      onBlur={release}
    >
      <span className="sigx-fill" style={{ width: `${(holding ? (charge ?? 0) : running ? 1 - k : 0) * 100}%` }} aria-hidden="true" />
      <span className="sig-icon" aria-hidden="true">
        {def.icon}
      </span>
      <span className="sig-label">{label}</span>
      {(holding || running) && (
        <span className="sigx-pct" aria-hidden="true">
          {pct} %
        </span>
      )}
    </button>
  );
}
