// Live, per-frame values shared between scene components. The Director writes them first every
// frame (useFrame priority DIRECTOR_PRIORITY); everyone else reads them. Never rendered by React.

import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import type { Shot } from './choreo';
import { HOME_YAW } from './layout';
import type { SkyLook } from './sites';

/** useFrame priorities: the Director runs first, then the camera, then OrbitControls (−1), then the rest (0). */
export const DIRECTOR_PRIORITY = -5;
export const CAMERA_PRIORITY = -2;

/** The globe group (it turns on the title screen, after the epilogue's rise and in the flight log). */
export const groups: { globe: Group | null } = { globe: null };

export const live = {
  /** The shot on screen this frame (with reduced motion: only after the dip to black). */
  shot: { siteId: null, blend: 0, arc: null, globeShot: 'title', hover: 0, rotor: 0, ingenuity: true } as Shot,
  /** Full-screen fade, 0 (clear) .. 1 (black). Starts black so the first frame fades in. */
  black: 1,
  /** Globe yaw, radians (Jezero toward the camera at first). */
  yaw: HOME_YAW,
  /** Sky and light at the diorama in use, for the real "now" (written by the Diorama). */
  siteLook: null as SkyLook | null,
  /** Unit vector toward the Sun in world space (the real Sun for "now"). */
  sun: new Vector3(1, 0, 0),
  /** The diorama in use: diorama-local metres → world (includes SITE_SCALE). */
  site: {
    valid: false,
    matrix: new Matrix4(),
    point: new Vector3(),
    up: new Vector3(0, 1, 0),
    quat: new Quaternion(),
  },
  /** Ingenuity on its flight arc, world space. */
  arc: {
    valid: false,
    pos: new Vector3(),
    quat: new Quaternion(),
    up: new Vector3(0, 1, 0),
    forward: new Vector3(0, 0, -1),
    /** Height above the surface, fraction of the radius. */
    alt: 0,
  },
  /** Ingenuity sitting at home on the globe (the globe end of the opening dive and the final rise). */
  rest: {
    pos: new Vector3(),
    quat: new Quaternion(),
  },
};
