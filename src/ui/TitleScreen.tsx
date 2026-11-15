import { memo, useEffect, useRef } from 'react';
import { marsLocalSolarTime, signalPath } from '../astro';
import { FICTION_NOTE } from '../data/flight';
import { MACHINES, MACHINE_BY_ID } from '../data/machines';
import { HOME, LEGS, TOTAL_KM } from '../flight/route';
import { HangarButton } from '../hangar/HangarEntry';
import { titleColumns } from '../scene/layout';
import { live } from '../scene/registry';
import { pickTitleStop, useTitleFocus } from '../scene/TitleGlobeInput';
import { useApp } from '../store';
import { formatDuration, formatKm, formatSolarTime } from './callPlan';
import { MachineGlyph } from './machineGlyphs';
import { prefersReducedMotion, useUtcClock } from './useClock';
import './title-stops.css';

/** Ingenuity's real total over its 72 flights (docs/FACT_CHECK.md). */
const REAL_FLOWN_KM = '17.0 km';

const home = MACHINE_BY_ID.ingenuity;
const homeCoords = `${Math.abs(home.lat).toFixed(1)}°${home.lat >= 0 ? 'N' : 'S'} ${Math.abs(home.lon).toFixed(1)}°${home.lon >= 0 ? 'E' : 'W'}`;
/** 'Valinor Hills, Jezero crater' → 'Valinor Hills'. */
const homeSite = home.site.split(',')[0];

/** Graduations round the reticle's outer ring: every 5°, longer every 30°. */
const RETICLE_TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180;
  const r0 = 496;
  const r1 = i % 6 === 0 ? 466 : 484;
  const f = (n: number) => n.toFixed(1);
  return `M${f(r0 * Math.cos(a))} ${f(r0 * Math.sin(a))}L${f(r1 * Math.cos(a))} ${f(r1 * Math.sin(a))}`;
}).join('');

/** A faint observatory reticle behind the title column; drawn once, never re-rendered. */
const Reticle = memo(function Reticle() {
  return (
    <svg className="title-reticle" viewBox="-500 -500 1000 1000" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle r="496" vectorEffect="non-scaling-stroke" />
        <circle r="380" vectorEffect="non-scaling-stroke" />
        <circle r="250" strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
        <circle r="120" vectorEffect="non-scaling-stroke" />
        <ellipse rx="496" ry="150" transform="rotate(-18)" vectorEffect="non-scaling-stroke" />
        <ellipse rx="430" ry="96" transform="rotate(24)" strokeDasharray="3 9" vectorEffect="non-scaling-stroke" />
        <path d="M-500 0H-140M140 0H500M0 -500V-140M0 140V500M-10 0H10M0 -10V10" vectorEffect="non-scaling-stroke" />
        <path d={RETICLE_TICKS} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
});

/**
 * The nine stops, in the order they landed, as a quiet column of glyphs between the title and Mars:
 * the year, the machine, its short name; home (Ingenuity) in amber. Hovering one lights its marker
 * on the globe, as the top bar's route does in flight; picking one turns Mars to it
 * (src/scene/TitleGlobeInput.tsx), and it stays marked until Mars is turned again.
 */
function TitleStops() {
  const hover = useApp(s => s.hover);
  const lit = useApp(s => s.hoverId);
  const picked = useTitleFocus(s => s.id);
  // Leaving the title mid-hover must not leave a marker lit.
  useEffect(() => () => useApp.getState().hover(null), []);
  // Moving off a stop hands its marker back to the picked one, if any.
  const unhover = () => hover(useTitleFocus.getState().id);
  return (
    <div className="title-stops-pos">
      <ol className="title-stops reveal" style={{ animationDelay: '0.95s' }} aria-label="The nine stops of Flight 73, in the order they landed. Pick one to turn Mars to it.">
        {MACHINES.map(m => (
          <li
            key={m.id}
            className={[m.id === HOME ? 'ts-home' : '', m.id === lit || m.id === picked ? 'ts-lit' : ''].filter(Boolean).join(' ') || undefined}
          >
            <button
              type="button"
              className="ts-stop"
              title={`${m.name}: turn Mars to ${m.site.split(',')[0]}`}
              aria-pressed={m.id === picked}
              onClick={() => pickTitleStop(m.id)}
              onMouseEnter={() => hover(m.id)}
              onMouseLeave={unhover}
              onFocus={() => hover(m.id)}
              onBlur={unhover}
            >
              <span className="ts-year tabular">{m.arrived.slice(0, 4)}</span>
              <MachineGlyph id={m.id} />
              <span className="ts-name">{m.shortName}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** `leaving`: "Begin Flight 73" was pressed; the title fades out (App keeps it up a moment). */
export function TitleScreen({ leaving = false }: { leaving?: boolean }) {
  const startFlight = useApp(s => s.startFlight);
  const screen = useRef<HTMLElement>(null);
  // Ticks every second, which also keeps the light time and Jezero's solar clock current.
  const utc = useUtcClock().slice(0, 8);
  const now = new Date();
  const roundTrip = signalPath('ingenuity', 'mars', now).roundTripS;
  const jezero = formatSolarTime(marsLocalSolarTime(now, home.lon));

  // The reticle and the frame's registration marks drift a few pixels against the cursor, so the
  // overlay feels coupled to the globe. Mouse only, and never with reduced motion.
  useEffect(() => {
    const el = screen.current;
    if (!el || prefersReducedMotion() || !window.matchMedia?.('(pointer: fine)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty('--px', x.toFixed(3));
      el.style.setProperty('--py', y.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Mars sits as near the middle as the text and the column of stops leave room for
  // (layout.ts titleColumns): measure where the text ends, then place Mars (the CameraRig reads
  // live.titleAnchorX), the stops and the drag hint under Mars.
  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const range = document.createRange();
    const textRight = () => {
      let right = 0;
      // The words themselves, not their block boxes (the heading and the lede's lines span the column's width).
      const rail = el.querySelector('.title-rail');
      if (rail) {
        const words = document.createTreeWalker(rail, NodeFilter.SHOW_TEXT);
        while (words.nextNode()) {
          if (!words.currentNode.textContent?.trim()) continue;
          range.selectNodeContents(words.currentNode);
          right = Math.max(right, range.getBoundingClientRect().right);
        }
      }
      for (const n of el.querySelectorAll('.title-brief .title-actions')) right = Math.max(right, n.getBoundingClientRect().right);
      return right;
    };
    const place = () => {
      const w = window.innerWidth;
      const stops = el.querySelector('.title-stops');
      const { anchorX, stopsX } = titleColumns(w, window.innerHeight, textRight(), stops?.getBoundingClientRect().width ?? 0);
      live.titleAnchorX = anchorX;
      el.style.setProperty('--mars-x', `${(anchorX * w).toFixed(1)}px`);
      el.style.setProperty('--stops-x', `${stopsX.toFixed(1)}px`);
    };
    place();
    let alive = true;
    // The serif title changes width once its font arrives.
    document.fonts?.ready.then(() => alive && place());
    window.addEventListener('resize', place);
    return () => {
      alive = false;
      window.removeEventListener('resize', place);
    };
  }, []);

  return (
    <section
      ref={screen}
      className={`title-screen${leaving ? ' title-leaving' : ''}`}
      aria-labelledby="title-heading"
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
    >
      <div className="title-frame" aria-hidden="true" />
      <div className="title-marks" aria-hidden="true">
        <span className="tf-mark tf-tl" />
        <span className="tf-mark tf-tr" />
        <span className="tf-mark tf-bl" />
        <span className="tf-mark tf-br" />
        <span className="tf-tick tf-t" />
        <span className="tf-tick tf-b" />
        <span className="tf-tick tf-l" />
        <span className="tf-tick tf-r" />
      </div>
      <Reticle />

      <header className="title-bar title-bar-top reveal" style={{ animationDelay: '0.1s' }}>
        <span className="tb-loc">
          <span aria-hidden="true">[ </span>
          {homeSite}, Jezero <span aria-hidden="true">·</span> {homeCoords}
          <span aria-hidden="true"> ]</span>
        </span>
        <span
          className="tb-astro tabular"
          title="Solar time at Jezero right now (Mars24), and the light time from Earth to Mars and back"
        >
          Solar {jezero} <span aria-hidden="true">·</span> Light {roundTrip === null ? '—' : formatDuration(roundTrip)}
        </span>
        <span className="tb-utc tabular">UTC {utc}</span>
      </header>

      {/* margin-top: auto keeps the brief low; on short viewports the layer scrolls instead of clipping. */}
      <div className="title-brief">
        {/* No eyebrow over the title: the place is in the top bar, Flight 73 in the lede and the button. */}
        <div className="title-rail">
          <h1 id="title-heading" className="reveal" style={{ animationDelay: '0.3s' }}>
            Still&nbsp;Here
          </h1>
          <p className="lede reveal" style={{ animationDelay: '0.55s' }}>
            <span>Ingenuity flew 72 times on Mars.</span> <span>This is the flight it never got to make.</span>
          </p>
        </div>
        <div className="title-actions reveal" style={{ animationDelay: '0.8s' }}>
          <button type="button" className="primary title-begin" onClick={startFlight}>
            Begin Flight 73
          </button>
          <HangarButton place="title" />
        </div>
      </div>

      <TitleStops />

      <footer className="title-bar title-bar-foot reveal" style={{ animationDelay: '1.15s' }}>
        <p className="fine">{FICTION_NOTE} Some 3D models are simplified or illustrative.</p>
        <p className="title-scale tabular" title={`Ingenuity's 72 real flights covered ${REAL_FLOWN_KM}.`}>
          <span aria-hidden="true">[ </span>
          {formatKm(TOTAL_KM)} <span aria-hidden="true">·</span> {LEGS.length} stops <span aria-hidden="true">·</span>{' '}
          {REAL_FLOWN_KM} real
          <span aria-hidden="true"> ]</span>
        </p>
      </footer>

      {/* Mars can be turned (src/scene/TitleGlobeInput.tsx): a quiet hint under it, gone after the first drag. */}
      <p className="title-drag-hint" aria-hidden="true">
        <span className="tdh-fine">[ Drag Mars to orbit · dbl-click reset ]</span>
        <span className="tdh-touch">[ Swipe Mars to orbit · double-tap reset ]</span>
      </p>
    </section>
  );
}
