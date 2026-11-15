// The top bar's glyphs: thin 16px line drawings in the console's own hand (1.25px strokes,
// currentColor, so amber/bone states come from CSS). Decorative only: every button that wears one
// carries its own aria-label, and its words show in the bar's tooltip (data-tip, styles.css).

import type { ReactNode } from 'react';

function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`hud-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Distance flown: a dashed hop between two stops. */
export function RouteGlyph() {
  return (
    <Glyph>
      <circle cx="3.2" cy="12.3" r="1.5" />
      <circle cx="12.8" cy="3.7" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4.6 11.4C7 9.4 5.6 6.6 8 5.4c1.4-.7 2.4-.9 3.4-1.2" strokeDasharray="1.4 1.8" />
    </Glyph>
  );
}

/** The AR hangar: the same isometric box as the hangar's own "View on your table" badge. */
export function HangarGlyph() {
  return (
    <Glyph>
      <path d="M8 1.9l5.3 3v6.2L8 14.1l-5.3-3V4.9z" />
      <path d="M2.7 4.9L8 8l5.3-3.1M8 8v6.1" />
    </Glyph>
  );
}

export function SoundGlyph({ muted }: { muted: boolean }) {
  return (
    <Glyph>
      <path d="M2.4 6.1h2.4L8.3 3.2v9.6L4.8 9.9H2.4z" />
      {muted ? (
        <path d="M10.9 6.2l3.6 3.6M14.5 6.2l-3.6 3.6" />
      ) : (
        <>
          <path d="M10.6 5.9a3 3 0 0 1 0 4.2" />
          <path d="M12.5 4a5.6 5.6 0 0 1 0 8" />
        </>
      )}
    </Glyph>
  );
}

/** Resume: a solid play mark. */
export function PlayGlyph() {
  return (
    <Glyph>
      <path d="M5 3.4v9.2L12.6 8z" fill="currentColor" />
    </Glyph>
  );
}

/**
 * The auto tour's switch, drawn as one: a small track whose knob sits right (and wears a play mark)
 * while the tour runs, right with a pause mark while the visitor has taken over, and left when off.
 */
export function TourSwitchGlyph({ on, paused }: { on: boolean; paused: boolean }) {
  return (
    <svg
      className="hud-glyph tour-glyph"
      viewBox="0 0 26 16"
      width="26"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="2.6" width="24" height="10.8" rx="5.4" />
      <g className="tour-knob" style={{ transform: `translateX(${on ? 10 : 0}px)` }}>
        <circle cx="8" cy="8" r="3.7" fill="currentColor" stroke="none" />
        {on && !paused && <path d="M7 6.2v3.6L9.8 8z" className="tour-knob-mark" stroke="none" />}
        {on && paused && <path d="M7 6.3v3.4M9 6.3v3.4" className="tour-knob-mark-line" strokeWidth="1.1" />}
      </g>
    </svg>
  );
}

/** Chase cam: Ingenuity with the camera's orbit round it. */
export function ChaseGlyph() {
  return (
    <Glyph>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <ellipse cx="8" cy="8" rx="6.4" ry="2.2" transform="rotate(-35 8 8)" />
      <circle cx="13.2" cy="4.3" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Navcam: a viewfinder looking straight down. */
export function NavcamGlyph() {
  return (
    <Glyph>
      <path d="M2.2 5.2V2.2h3M10.8 2.2h3v3M13.8 10.8v3h-3M5.2 13.8h-3v-3" />
      <circle cx="8" cy="8" r="2" />
    </Glyph>
  );
}
