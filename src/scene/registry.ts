// Live, per-frame values shared between scene components. The Director writes them first every
// frame (useFrame priority DIRECTOR_PRIORITY); everyone else reads them. Never rendered by React.

import { Box3, Matrix4, Quaternion, Vector3, type Group, type Object3D } from 'three';
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
  /** The end of Ingenuity's broken blade (an empty inside its rig, turning with the rotor), or null. */
  brokenTip: null as Object3D | null,
  /**
   * Visitor's orbit around the machine at a site, applied by the CameraRig on top of the site pose:
   * az (radians, about the site's up), el (radians, added pitch), zoom (× distance). Written by the
   * site orbit input; 0/0/1 = the composed shot. Reset when the site changes.
   */
  siteOrbit: { az: 0, el: 0, zoom: 1 },
  /**
   * Where the site orbit is heading (same units as siteOrbit): pointer drags and the wheel write it,
   * and so may a HUD control (a bearing bar). The site orbit input eases siteOrbit toward it, and
   * resets it to 0/0/1 on "Reset wide view", on leaving the stage and when the site changes.
   */
  siteOrbitGoal: { az: 0, el: 0, zoom: 1 },
  /** Compass heading the camera faces at a site, degrees (0 = north, 90 = east); NaN elsewhere. Written by the CameraRig. */
  camHeadingDeg: NaN,
  /**
   * The Sun as the diorama shows it, world space: the real Sun now, or the hour picked on the sun
   * scrubber. Written by the Diorama (valid only while a diorama is in use); Lights uses it there.
   */
  siteSun: new Vector3(0, 1, 0),
  /**
   * Things the site camera can look at close up, world space, by key: 'hs:0'..'hs:3' and 'hs:call'
   * (written by the Hotspots every frame while shown), 'sig:<key>' (by a signature effect's
   * SigFocus). Stale keys are harmless: the camera only reads the focused one.
   */
  targets: new Map<string, Vector3>(),
  /**
   * The machine at the site in use, measured by the Hotspots: its bounding box in the machine's own
   * frame (the diorama turned by `yaw` about +Y), for the close-up distance and for keeping the
   * free-flying Ingenuity out of it. Invalid at home (no machine) and until the model is measured.
   */
  machine: { site: null as string | null, valid: false, box: new Box3(), yaw: 0 },
  /**
   * Ingenuity flown by the visitor at a site (src/scene/SiteFlight.tsx), diorama-local metres.
   * `site` is the diorama this belongs to (null = not in use: Ingenuity sits on its landing spot).
   * x/z: where it is; alt: height above the ground; vx/vz: velocity (for the tilt); rotor 0..1.
   * `ground` is the ground height under it (relative to its landing spot); `yaw` its heading about
   * +Y. `follow` 0..1: how much the camera should follow it (the CameraRig eases toward it).
   */
  flyer: { site: null as string | null, x: 0, z: 0, alt: 0, ground: 0, vx: 0, vz: 0, rotor: 0, yaw: 0, follow: 0 },
  /** Ingenuity scanning a part close up: k 0..1 (beam and searchlight on it), the part, world space. */
  scan: { k: 0, point: new Vector3() },
  /** The story hotspot inside the scout camera's viewfinder right now ('0'..'3'), or null. */
  scoutTarget: null as string | null,
  /** Ingenuity's position this frame, world space (written by Ingenuity; the searchlight reads it). */
  flyerWorld: new Vector3(),
};
