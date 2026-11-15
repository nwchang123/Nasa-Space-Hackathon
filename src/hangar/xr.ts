// Tabletop AR on Android: a WebXR immersive-ar session with hit-test (a reticle on the table),
// DOM overlay (the hangar's controls stay on screen) and light estimation (the room's light on
// the models). One session at a time; the scene reads this runtime every XR frame.

import { Matrix4, Quaternion, Vector3, type WebGLRenderer } from 'three';
import { BELOW_EYES_M, facingYaw, HIT_HOLD_MS, isHorizontalHit, pickSurface, SLOW_SCAN_MS, type SurfaceKind } from './arSupport';
import { useHangar } from './hangarStore';
import type { V3 } from './layout';

/** WebXR light estimation (not in @types/webxr yet): just what is used here. */
export type XrLightProbe = EventTarget;
export interface XrLightEstimate {
  sphericalHarmonicsCoefficients: Float32Array;
  primaryLightDirection: DOMPointReadOnly;
  primaryLightIntensity: DOMPointReadOnly;
}

export interface XrRuntime {
  session: XRSession;
  /** Hits on the planes the phone has detected (table tops, the floor). */
  hitSource: XRHitTestSource | null;
  /** Hits on feature points, where the browser offers them: a first footing before any plane. */
  pointSource: XRHitTestSource | null;
  probe: XrLightProbe | null;
  /** The reticle: on the surface under the screen centre, turned to face the viewer (reference space), or null. */
  hit: Matrix4 | null;
  /** What the reticle stands on. */
  hitKind: SurfaceKind | null;
  /** Where the phone is and which way it looks, every frame (reference space). */
  viewer: Vector3;
  viewerQuat: Quaternion;
  forward: Vector3;
  /** Where the models stand and which way they face, once placed. */
  anchor: { position: Vector3; yaw: number } | null;
  /** The last point on a detected plane, to carry its level past the small patch found so far. */
  lastPlane: V3 | null;
  /** When the reticle last had a surface, and when the current search began (ms). */
  lastHitAt: number;
  searchSince: number;
}

const hitMatrix = new Matrix4();
const hitQuat = new Quaternion();
const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const tmpPos = new Vector3();
const prevPos = new Vector3();
let runtime: XrRuntime | null = null;

export const xrRuntime = (): XrRuntime | null => runtime;

/** The session features: hit-test is required; the overlay and light estimate are welcome. */
export function arSessionInit(overlay: Element | null): XRSessionInit {
  return {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'light-estimation'],
    ...(overlay ? { domOverlay: { root: overlay } } : {}),
  };
}

function describe(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'AR needs the camera: allow it and try again.';
  if (name === 'NotSupportedError') return 'This browser cannot start tabletop AR here.';
  if (name === 'SecurityError') return 'AR needs a secure (HTTPS) page.';
  return 'AR could not start on this phone.';
}

async function hitSourceFor(session: XRSession, space: XRSpace, type: XRHitTestTrackableType): Promise<XRHitTestSource | null> {
  try {
    return (await session.requestHitTestSource?.({ space, entityTypes: [type] })) ?? null;
  } catch {
    return null; // this browser does not hit-test that kind of thing
  }
}

/**
 * Start tabletop AR. Call it straight from the tap: requestSession is the first thing it does,
 * so the browser sees the tap's user activation.
 */
export function startTabletopAr(gl: WebGLRenderer, overlay: Element | null): Promise<void> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  const store = useHangar.getState();
  if (store.xr !== 'off') return Promise.resolve();
  if (!xr) {
    store.setXr('off', 'WebXR is not available here.');
    return Promise.resolve();
  }
  const request = xr.requestSession('immersive-ar', arSessionInit(overlay));
  store.setXr('starting', null);

  return request
    .then(async session => {
      const onEnd = () => {
        if (runtime?.session === session) {
          runtime.hitSource?.cancel();
          runtime.pointSource?.cancel();
          runtime = null;
        }
        useHangar.getState().setXr('off');
      };
      session.addEventListener('end', onEnd);
      try {
        gl.xr.enabled = true;
        gl.xr.setReferenceSpaceType('local');
        await gl.xr.setSession(session);
        const viewerSpace = await session.requestReferenceSpace('viewer');
        const [hitSource, pointSource] = await Promise.all([
          hitSourceFor(session, viewerSpace, 'plane'),
          hitSourceFor(session, viewerSpace, 'point'),
        ]);
        runtime = {
          session,
          hitSource,
          pointSource,
          probe: null,
          hit: null,
          hitKind: null,
          viewer: new Vector3(),
          viewerQuat: new Quaternion(),
          forward: new Vector3(0, 0, -1),
          anchor: null,
          lastPlane: null,
          lastHitAt: -Infinity,
          searchSince: performance.now(),
        };
        session.addEventListener('select', placeAtHit);
        requestProbe(session).then(probe => {
          if (runtime && runtime.session === session) runtime.probe = probe;
        });
        useHangar.getState().setXr('scanning');
      } catch (err) {
        session.removeEventListener('end', onEnd);
        runtime = null;
        await session.end().catch(() => undefined);
        throw err;
      }
    })
    .catch(err => {
      useHangar.getState().setXr('off', describe(err));
    });
}

/** End the session (the system back gesture ends it too). */
export function endTabletopAr(): void {
  runtime?.session.end().catch(() => undefined);
}

async function requestProbe(session: XRSession): Promise<XrLightProbe | null> {
  const s = session as XRSession & {
    requestLightProbe?: (o?: { reflectionFormat?: string }) => Promise<XrLightProbe>;
    preferredReflectionFormat?: string;
  };
  if (!s.requestLightProbe) return null;
  try {
    return await s.requestLightProbe({ reflectionFormat: s.preferredReflectionFormat });
  } catch {
    return null; // light-estimation was not granted
  }
}

/** The nearest level, upward-facing hit at least BELOW_EYES_M under the phone, or null. */
function nearestLevel(
  frame: XRFrame,
  source: XRHitTestSource | null,
  refSpace: XRReferenceSpace,
  eyeY: number,
  maxTiltDeg: number,
): V3 | null {
  if (!source) return null;
  for (const result of frame.getHitTestResults(source)) {
    const m = result.getPose(refSpace)?.transform.matrix;
    if (!m || !isHorizontalHit(m, maxTiltDeg) || m[13] > eyeY - BELOW_EYES_M) continue;
    return [m[12], m[13], m[14]];
  }
  return null;
}

/**
 * Called every XR frame: find the surface under the screen centre (a table or the floor, never a
 * wall or a shelf overhead) and stand the reticle on it, turned the way the models will face. A
 * plane the phone has detected comes first; its level carries on a little past the patch found so
 * far; before any plane, a feature point under a downward look will do. A hit lost for a moment
 * keeps the reticle where it was. Also tells the overlay whether a surface is found.
 */
export function updateHit(frame: XRFrame, refSpace: XRReferenceSpace | null, now: number): Matrix4 | null {
  const r = runtime;
  if (!r || !refSpace) return null;
  const view = frame.getViewerPose(refSpace);
  if (view) {
    const m = view.transform.matrix;
    r.viewer.set(m[12], m[13], m[14]);
    const q = view.transform.orientation;
    r.viewerQuat.set(q.x, q.y, q.z, q.w);
    r.forward.set(-m[8], -m[9], -m[10]).normalize();
  }
  if (useHangar.getState().xr !== 'scanning') {
    r.searchSince = now;
    r.hit = null;
    r.hitKind = null;
    return null;
  }

  const eye: V3 = [r.viewer.x, r.viewer.y, r.viewer.z];
  const plane = nearestLevel(frame, r.hitSource, refSpace, eye[1], 12);
  if (plane) r.lastPlane = plane;
  // Feature points carry a rough normal at best: only walls are ruled out here.
  const point = plane ? null : nearestLevel(frame, r.pointSource, refSpace, eye[1], 35);
  const surface = view ? pickSurface(plane, point, r.lastPlane, eye, [r.forward.x, r.forward.y, r.forward.z]) : null;

  if (surface) {
    tmpPos.set(...surface.at);
    // Points jitter: ease the reticle toward them; planes and their level are steady already.
    if (surface.kind === 'point' && r.hit && r.hitKind === 'point') {
      prevPos.setFromMatrixPosition(r.hit);
      if (prevPos.distanceTo(tmpPos) < 0.25) tmpPos.lerpVectors(prevPos, tmpPos, 0.3);
    }
    hitQuat.setFromAxisAngle(UP, facingYaw([tmpPos.x, tmpPos.y, tmpPos.z], eye));
    r.hit = hitMatrix.compose(tmpPos, hitQuat, ONE);
    r.hitKind = surface.kind;
    r.lastHitAt = now;
    r.searchSince = now;
  } else if (now - r.lastHitAt > HIT_HOLD_MS) {
    r.hit = null;
    r.hitKind = null;
  }

  const found = !!r.hit;
  useHangar.getState().setXrSurface(found ? 'found' : 'searching', !found && now - r.searchSince > SLOW_SCAN_MS);
  return r.hit;
}

/** The room's light this frame, if light estimation runs. */
export function lightEstimate(frame: XRFrame): XrLightEstimate | null {
  const probe = runtime?.probe;
  if (!probe) return null;
  const f = frame as XRFrame & { getLightEstimate?: (p: XrLightProbe) => XrLightEstimate | null };
  return f.getLightEstimate?.(probe) ?? null;
}

/** A tap on the screen (the session's select): stand the models on the surface under the reticle. */
export function placeAtHit(): boolean {
  const r = runtime;
  if (!r || !r.hit || useHangar.getState().xr !== 'scanning') return false;
  const p = new Vector3().setFromMatrixPosition(r.hit);
  r.anchor = { position: p, yaw: facingYaw([p.x, p.y, p.z], [r.viewer.x, r.viewer.y, r.viewer.z]) };
  useHangar.getState().setXr('placed');
  return true;
}
