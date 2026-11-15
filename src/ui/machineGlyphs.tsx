// One small line drawing per kind of machine on the route, in the HUD's own hand (16px grid,
// 1.2px strokes, currentColor): the Viking landers, Pathfinder on its opened petals, the twin MER
// rovers, Phoenix and InSight on their round solar arrays (InSight with its seismometer's dome on
// the ground), the backshell under its parachute, and Ingenuity. Decorative: whoever shows one names
// the machine in text or an aria-label.

import type { ReactNode } from 'react';
import type { MachineId } from '../types';

function Shape({ children }: { children: ReactNode }) {
  return (
    <svg
      className="machine-glyph"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const viking = (
  <Shape>
    <path d="M4.6 6.8h6.8l1.3 2.3-1.3 2.3H4.6L3.3 9.1z" />
    <path d="M4.9 11.4l-1.8 2.8M11.1 11.4l1.8 2.8M8 11.4v2.8M2.2 14.2h1.8M12 14.2h1.8M7.1 14.2h1.8" />
    <path d="M10 6.8V4.4M8.3 3.2a1.9 1.9 0 0 0 3.4 1.6" />
  </Shape>
);

/** Pathfinder: its petals opened flat, the camera on its mast, and little Sojourner beside it. */
const pathfinder = (
  <Shape>
    <path d="M1.4 13.2h13.2" />
    <path d="M4.4 13.2l1.4-2.2h4.4l1.4 2.2" />
    <path d="M8 11V5.8" />
    <path d="M6.7 4.2h2.6v1.6H6.7z" />
    <path d="M12 13.2v-1.5h2.4v1.5" />
  </Shape>
);

const rover = (
  <Shape>
    <path d="M2.4 8.2h11.2" />
    <path d="M5 8.2v2.2h6V8.2" />
    <path d="M10.4 8.2V4.2M9.2 4.2h2.4" />
    <circle cx="3.9" cy="12.6" r="1.3" />
    <circle cx="8" cy="12.6" r="1.3" />
    <circle cx="12.1" cy="12.6" r="1.3" />
    <path d="M5 10.4l-.8.9M11 10.4l.8.9" />
  </Shape>
);

/** The round-array lander shared by Phoenix and InSight; `extra` is what sets each apart. */
function roundArrays(extra: ReactNode) {
  return (
    <Shape>
      <ellipse cx="3.3" cy="7.4" rx="2.5" ry="1.15" />
      <ellipse cx="12.7" cy="7.4" rx="2.5" ry="1.15" />
      <path d="M5.8 7.4h4.4M6.1 7.4v2.9h3.8V7.4" />
      <path d="M6.6 10.3l-1.3 3.5M9.4 10.3l1.3 3.5" />
      {extra}
    </Shape>
  );
}
/** Phoenix: its robotic arm raised, scoop at the end. */
const phoenix = roundArrays(<path d="M9.4 7.4l1.5-4.3 2.6 1.3-.5 1.2" />);
/** InSight: the seismometer's dome set down on the ground beside it. */
const insight = roundArrays(<path d="M11.4 14.2a2 2 0 0 1 4 0z" />);

const parachute = (
  <Shape>
    <path d="M2.4 6.6a5.6 4.4 0 0 1 11.2 0z" />
    <path d="M2.8 6.6l4.2 4.6M13.2 6.6l-4.2 4.6M8 6.6v4.6" />
    <path d="M6.6 11.2h2.8l1.5 3H5.1z" />
  </Shape>
);

/** Ingenuity: two rotor discs on the mast, the box of a body, four splayed legs (two drawn). */
const helicopter = (
  <Shape>
    <ellipse cx="8" cy="3.4" rx="6.4" ry="0.85" />
    <ellipse cx="8" cy="5.5" rx="6.4" ry="0.85" />
    <path d="M8 2.6v5" />
    <path d="M5.7 7.6h4.6v2.9H5.7z" />
    <path d="M6 10.5l-2.7 3.6M10 10.5l2.7 3.6" />
  </Shape>
);

const GLYPHS: Record<MachineId, ReactNode> = {
  'viking-1': viking,
  'viking-2': viking,
  'pathfinder-sojourner': pathfinder,
  spirit: rover,
  opportunity: rover,
  phoenix,
  insight,
  'mars2020-edl': parachute,
  ingenuity: helicopter,
};

export function MachineGlyph({ id }: { id: MachineId }) {
  return GLYPHS[id];
}
