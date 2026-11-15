// The AR hangar: the nine machines of Flight 73 as tabletop figures (or at 1:1), one at a time or
// all nine in a row. Android Chrome places them on a real table with WebXR; iPhone and iPad open
// them in AR Quick Look; anywhere else there is a 3D sandbox and a QR code to carry it to a phone.
// Lazy-loaded: none of this is fetched until the hangar opens.

import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefCallback } from 'react';
import type { WebGLRenderer } from 'three';
import { MACHINE_BY_ID } from '../data/machines';
import { MODEL_REGISTRY } from '../scene/models';
import { HANGAR_HASH, useApp } from '../store';
import { MACHINE_IDS } from '../types';
import { AMBIENT_LEVEL } from '../ui/ambientScore';
import { setAmbience, setChargeLoop, setRotorLoop, setWind } from '../ui/sound';
import { stopSpeaking } from '../ui/voice';
import { arOverride, browserProbe, detectArMode, linkHint, pageLink, type ArMode } from './arSupport';
import type { Arrangement } from './build';
import { useHangar } from './hangarStore';
import { HangarScene } from './HangarScene';
import { formatLength, HANGAR_PICKS, scaleLabel, TABLE_ROW_M, type HangarPick } from './layout';
import { QrCode } from './QrCode';
import { exportPlan, exportUsdz, quickLookHref, UsdzCache } from './usdz';
import { endTabletopAr, startTabletopAr } from './xr';
import './hangar.css';

// ---------------------------------------------------------------- words

function pickLabel(p: HangarPick): string {
  return p === 'row' ? 'All nine' : MACHINE_BY_ID[p].shortName;
}

/** The arrangement for what is selected now, or null while it is still being built. */
function useCurrent(): Arrangement | null {
  const arr = useHangar(s => s.arrangement);
  const pick = useHangar(s => s.pick);
  const scale = useHangar(s => s.scale);
  return arr && arr.pick === pick && arr.scaleMode === scale ? arr : null;
}

function Caption() {
  const pick = useHangar(s => s.pick);
  const scale = useHangar(s => s.scale);
  const current = useCurrent();
  const layout = current?.layout;
  const machine = pick === 'row' ? null : MACHINE_BY_ID[pick];
  const kicker = machine ? `${MACHINE_IDS.indexOf(machine.id) + 1} · ${machine.kind}` : 'Route order · true relative sizes';
  const name = machine ? machine.name : 'All nine, in a row';
  let dims = '';
  let shown = '';
  if (layout) {
    const [w, h, d] = layout.realSize;
    dims = machine
      ? `${formatLength(w)} wide · ${formatLength(d)} deep · ${formatLength(h)} tall`
      : `${formatLength(w)} end to end at real size`;
    shown =
      scale === 'real'
        ? 'At real size, 1:1'
        : machine
          ? `On the table at ${scaleLabel(layout.scale)}: ${formatLength(Math.max(...layout.size))} long`
          : `On the table at ${scaleLabel(layout.scale)}: ${formatLength(TABLE_ROW_M)} across`;
  }
  const kind = machine ? (MODEL_REGISTRY[machine.id].illustrative ? 'Illustrative model' : 'NASA 3D model') : null;
  const fallback = current && current.key.split(':')[2]?.includes('p');
  return (
    <section className="hangar-panel hangar-info" aria-live="polite">
      <p className="kicker">{kicker}</p>
      <h2>{name}</h2>
      <p className="hangar-dims tabular">{layout ? dims : 'Loading the 3D models…'}</p>
      <p className="hangar-shown">
        {shown}
        {kind && <span className="dim"> · {kind}</span>}
      </p>
      {fallback && <p className="hangar-note">A 3D file did not load; a simplified stand-in is shown.</p>}
      <ScaleToggle />
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange(v: T): void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** `compact`: the short labels the AR dock has room for. */
function ScaleToggle({ compact = false }: { compact?: boolean }) {
  const scale = useHangar(s => s.scale);
  const setScale = useHangar(s => s.setScale);
  return (
    <Segmented
      label="Scale"
      value={scale}
      options={[
        ['table', compact ? 'Table' : 'Table scale'],
        ['real', compact ? '1:1' : '1:1 real'],
      ]}
      onChange={setScale}
    />
  );
}

function Picks() {
  const pick = useHangar(s => s.pick);
  const setPick = useHangar(s => s.setPick);
  return (
    <nav className="hangar-picks" aria-label="Choose a machine, or all nine">
      <ol>
        {HANGAR_PICKS.map((p, i) => (
          <li key={p}>
            <button type="button" className="pick" aria-pressed={pick === p} onClick={() => setPick(p)} data-pick={p}>
              <span className="pick-num" aria-hidden="true">
                {p === 'row' ? '1–9' : i + 1}
              </span>
              <span className="pick-name">{pickLabel(p)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------- AR, per device

/** Apple's AR Quick Look link has to hold a single image; this one is the button. */
const QUICK_LOOK_BADGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="264" height="46" viewBox="0 0 264 46">` +
    `<rect x="0.5" y="0.5" width="263" height="45" rx="2" fill="#2b2111" stroke="#f2a93b"/>` +
    `<g fill="none" stroke="#f2a93b" stroke-width="1.6" stroke-linejoin="round"><path d="M25 12l9 5v11l-9 5-9-5V17z M16 17l9 5 9-5 M25 22v11"/></g>` +
    `<text x="46" y="28" font-family="ui-monospace,Menlo,monospace" font-size="12" letter-spacing="1.6" fill="#f2a93b">VIEW ON YOUR TABLE</text>` +
    `</svg>`,
)}`;

/**
 * The USDZ for what is shown, exported in the background as soon as it is ready, so the link's
 * href is a finished Blob URL before the tap (an export at tap time would lose Safari's user
 * activation and Quick Look would not open).
 */
function useQuickLook(enabled: boolean, current: Arrangement | null) {
  const cache = useRef<UsdzCache | null>(null);
  const [ready, setReady] = useState<{ key: string; href: string; bytes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !current) return;
    const c = (cache.current ??= new UsdzCache());
    const have = c.ready(current.key);
    if (have) {
      setReady({ key: have.key, href: quickLookHref(have.url, current.scaleMode), bytes: have.bytes });
      return;
    }
    let cancelled = false;
    const { setExporting } = useHangar.getState();
    // A short pause, so stepping through the models does not export every one on the way. While
    // it writes, the sandbox draws only when moved: the exporter yields between its textures, and
    // every frame drawn in between would hold it up.
    const t = window.setTimeout(() => {
      setExporting(true);
      c.prepare(current.key, () => exportUsdz(current.root, exportPlan(current.ids.length > 1, current.scaleMode)))
        .then(entry => {
          if (cancelled || !entry) return;
          setReady({ key: entry.key, href: quickLookHref(entry.url, current.scaleMode), bytes: entry.bytes });
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError('The AR file could not be prepared on this device.');
        })
        .finally(() => {
          if (!cancelled) setExporting(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setExporting(false);
    };
  }, [enabled, current]);

  useEffect(
    () => () => {
      cache.current?.dispose();
      cache.current = null;
    },
    [],
  );

  return { ready: ready && current && ready.key === current.key ? ready : null, error };
}

function QuickLookPanel() {
  const current = useCurrent();
  const { ready, error } = useQuickLook(true, current);
  return (
    <>
      <p className="kicker">On your table</p>
      {ready ? (
        <a className="ql-link" rel="ar" href={ready.href} download="still-here-hangar.usdz" data-bytes={ready.bytes}>
          <img src={QUICK_LOOK_BADGE} width={264} height={46} alt="View on your table in AR" />
        </a>
      ) : (
        <button type="button" className="primary" disabled>
          {error ?? 'Preparing the AR file…'}
        </button>
      )}
      <p className="fine">iPhone and iPad · AR Quick Look. Point the camera at a table and the models land on it. Walk round them.</p>
    </>
  );
}

function WebXrPanel({ onStart }: { onStart(): void }) {
  const current = useCurrent();
  const note = useHangar(s => s.xrNote);
  return (
    <>
      <p className="kicker">On your table</p>
      <button type="button" className="primary" onClick={onStart} disabled={!current}>
        View on your table <span aria-hidden="true">→</span>
      </button>
      <p className="fine">Android · WebXR. Aim at a table until the ring lies flat on it, then tap to place. Walk round it.</p>
      {note && <p className="hangar-note">{note}</p>}
    </>
  );
}

function PhonePanel() {
  const link = useMemo(() => pageLink(window.location), []);
  return (
    <>
      <p className="kicker">See it on your table</p>
      <div className="phone-row">
        <QrCode text={link.url} size={152} />
        <div>
          <p className="fine">{linkHint(link.kind)}</p>
          <p className="fine dim">
            AR needs HTTPS: on a plain-HTTP LAN address (http://192.168…) phones block the camera and WebXR.
          </p>
        </div>
      </div>
      <p className="hangar-url tabular" title={link.url}>
        {link.url}
      </p>
    </>
  );
}

function ArPanel({ mode, onStart }: { mode: ArMode | null; onStart(): void }) {
  return (
    <aside className="hangar-panel hangar-ar" data-mode={mode ?? 'checking'}>
      {mode === null && <p className="fine">Checking this device for AR…</p>}
      {mode === 'webxr' && <WebXrPanel onStart={onStart} />}
      {mode === 'quicklook' && <QuickLookPanel />}
      {mode === 'none' && <PhonePanel />}
    </aside>
  );
}

// ---------------------------------------------------------------- inside AR (the DOM overlay)

/** Taps on the overlay's controls must not also place the models (WebXR's beforexrselect). */
const keepTapsOnControls: RefCallback<HTMLElement> = el => {
  if (!el) return;
  el.addEventListener('beforexrselect', e => e.preventDefault());
};

/**
 * What the phone is doing right now, one word for the status line. Scanning has three faces:
 * looking, looking for a while (time for tips), and a surface under the ring (tap to place).
 */
type XrStatus = 'starting' | 'loading' | 'searching' | 'slow' | 'found' | 'placed';

const XR_STATUS: Record<XrStatus, { tag: string; text: string }> = {
  starting: { tag: 'Camera', text: 'Starting the camera…' },
  loading: { tag: 'Loading', text: 'Loading the models…' },
  searching: { tag: 'Looking for a surface', text: 'Aim at a table or the floor and sweep the phone slowly from side to side.' },
  slow: { tag: 'Still looking', text: 'The camera needs a surface with some texture to hold on to.' },
  found: { tag: 'Surface found', text: 'Tap anywhere to place it.' },
  placed: { tag: 'Placed', text: 'Walk all the way round it. Re-place to move it.' },
};

const XR_TIPS = [
  'Sweep the phone side to side, not just a tilt.',
  'Plain white or glossy tops are hard: add a book or a placemat.',
  'Or try the floor, with more light.',
];

function useXrStatus(): XrStatus | null {
  const xr = useHangar(s => s.xr);
  const surface = useHangar(s => s.xrSurface);
  const slow = useHangar(s => s.xrSlow);
  const current = useCurrent();
  if (xr === 'off') return null;
  if (xr === 'starting') return 'starting';
  if (!current) return 'loading';
  if (xr === 'placed') return 'placed';
  if (surface === 'found') return 'found';
  return slow ? 'slow' : 'searching';
}

function XrStatusLine({ status }: { status: XrStatus }) {
  const pick = useHangar(s => s.pick);
  const { tag } = XR_STATUS[status];
  const text =
    status === 'found' ? `Tap anywhere to place ${pick === 'row' ? 'all nine' : pickLabel(pick)}.` : XR_STATUS[status].text;
  const working = status === 'starting' || status === 'loading' || status === 'searching' || status === 'slow';
  return (
    <div className="xr-status" data-status={status} role="status">
      {/* Keyed, so each new state fades in rather than swapping under the reader's eye. */}
      <div key={status} className="xr-status-body">
        <p className="xr-status-tag">
          <span className="xr-dot" aria-hidden="true" />
          {tag}
        </p>
        <p className="xr-status-text">{text}</p>
        {status === 'slow' && (
          <ol className="xr-tips">
            {XR_TIPS.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
      </div>
      {working && <span className="xr-scan" aria-hidden="true" />}
    </div>
  );
}

function XrControls() {
  const xr = useHangar(s => s.xr);
  const pick = useHangar(s => s.pick);
  const step = useHangar(s => s.step);
  const toggleRow = useHangar(s => s.toggleRow);
  const replace = useHangar(s => s.replace);
  const current = useCurrent();
  const status = useXrStatus();
  if (!status) return null;
  const n = pick === 'row' ? null : MACHINE_IDS.indexOf(pick) + 1;
  return (
    <div className="xr-ui" data-status={status}>
      <div className="xr-top" ref={keepTapsOnControls}>
        <button type="button" className="xr-exit" onClick={endTabletopAr}>
          <span className="xr-exit-x" aria-hidden="true" />
          Exit AR
        </button>
      </div>

      <div className="xr-foot">
        <XrStatusLine status={status} />
        <div className="xr-dock" ref={keepTapsOnControls}>
          <div className="xr-actions">
            <button type="button" className="xr-btn" aria-pressed={pick === 'row'} onClick={toggleRow}>
              All nine
            </button>
            <ScaleToggle compact />
            <button type="button" className="xr-btn" data-ready={xr === 'placed' || undefined} onClick={replace} disabled={xr !== 'placed'}>
              Re-place
            </button>
          </div>
          <div className="xr-pick">
            <button type="button" className="xr-step" aria-label="Previous machine" onClick={() => step(-1)}>
              <span aria-hidden="true">‹</span>
            </button>
            <p className="xr-name">
              <span className="xr-name-main">{pickLabel(pick)}</span>
              <span className="xr-name-sub tabular">
                {n ? `${n} of 9` : 'Route order'}
                {current && ` · ${scaleLabel(current.layout.scale)}`}
              </span>
            </p>
            <button type="button" className="xr-step" aria-label="Next machine" onClick={() => step(1)}>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the page

export default function Hangar() {
  const closeHangar = useApp(s => s.closeHangar);
  const from = useApp(s => s.hangarFrom);
  const xr = useHangar(s => s.xr);
  const light = useHangar(s => s.light);
  const setLight = useHangar(s => s.setLight);
  const exporting = useHangar(s => s.exporting);
  const [mode, setMode] = useState<ArMode | null>(null);
  const gl = useRef<WebGLRenderer | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    detectArMode(browserProbe(), arOverride(window.location.search)).then(m => {
      if (live) setMode(m);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // The globe's scene pauses behind the hangar; its sound loops would hang on their last level,
    // and Ingenuity's voiceover (timed from the paused scene) must not talk over the hangar. Only
    // the ambient pad stays, quieter (it starts here too, once the visitor has clicked).
    setRotorLoop(0);
    setWind(0);
    setChargeLoop(0);
    const hush = () => {
      stopSpeaking();
      setAmbience(AMBIENT_LEVEL.hangar);
    };
    hush();
    const hushing = window.setInterval(hush, 400);
    back.current?.focus({ preventScroll: true });
    // The address is the hangar's deep link while it is open (copy it, or scan the QR code).
    const { pathname, search } = window.location;
    if (window.location.hash !== HANGAR_HASH) history.replaceState(history.state, '', pathname + search + HANGAR_HASH);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useHangar.getState().xr === 'off') useApp.getState().closeHangar();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(hushing);
      window.removeEventListener('keydown', onKey);
      endTabletopAr();
      useHangar.getState().setXr('off', null);
      if (window.location.hash === HANGAR_HASH) history.replaceState(history.state, '', pathname + search);
    };
  }, []);

  const startAr = () => {
    if (gl.current) void startTabletopAr(gl.current, overlay.current);
  };

  return (
    <div className="hangar" data-xr={xr} data-light={light}>
      <div className="hangar-canvas" role="img" aria-label="3D preview: drag to turn, scroll or pinch to zoom">
        <Canvas
          shadows="percentage"
          frameloop={exporting && xr === 'off' ? 'demand' : 'always'}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 40, near: 0.01, far: 100, position: [0.3, 0.22, 0.55] }}
          onCreated={state => {
            gl.current = state.gl;
          }}
        >
          <HangarScene />
        </Canvas>
      </div>

      {xr === 'off' && (
        <div className="hangar-ui">
          <header className="hangar-panel hangar-top">
            <button ref={back} type="button" className="icon-btn hangar-back" onClick={closeHangar}>
              <span aria-hidden="true">←</span> {from === 'flight' ? 'Back to Flight 73' : from === 'report' ? 'Back to the log' : 'Back'}
            </button>
            <h1 className="hangar-title">
              <span className="beacon" aria-hidden="true" />
              AR hangar
              <span className="hangar-sub"> Nine machines, one table</span>
            </h1>
            <Segmented
              label="Lighting"
              value={light}
              options={[
                ['day', 'Day'],
                ['night', 'Night'],
              ]}
              onChange={setLight}
            />
          </header>
          <ArPanel mode={mode} onStart={startAr} />
          <Caption />
          <Picks />
        </div>
      )}

      {/* The WebXR DOM overlay: shown over the camera while AR runs (outside it, it stays empty). */}
      <div ref={overlay} className="hangar-xr">
        <XrControls />
      </div>
    </div>
  );
}
