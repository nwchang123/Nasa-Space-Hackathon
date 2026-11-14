// Tabletop AR on Android: a WebXR immersive-ar session with hit-test (a reticle on the table),
// DOM overlay (the hangar's controls stay on screen) and light estimation (the room's light on
// the models). One session at a time; the scene reads this runtime every XR frame.

import { Matrix4, Vector3, type WebGLRenderer } from 'three';
import { facingYaw, isHorizontalHit } from './arSupport';
import { useHangar } from './hangarStore';

/** WebXR light estimation (not in @types/webxr yet): just what is used here. */
export type XrLightProbe = EventTarget;
export interface XrLightEstimate {
  sphericalHarmonicsCoefficients: Float32Array;
  primaryLightDirection: DOMPointReadOnly;
  primaryLightIntensity: DOMPointReadOnly;
}

export interface XrRuntime {
  session: XRSession;
  hitSource: XRHitTestSource | null;
  probe: XrLightProbe | null;
  /** The latest horizontal surface under the screen centre (reference space), or null. */
  hit: Matrix4 | null;
  /** Where the phone is, every frame (reference space). */
  viewer: Vector3;
  /** Where the models stand and which way they face, once placed. */
  anchor: { position: Vector3; yaw: number } | null;
}

const hitMatrix = new Matrix4();
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
        const hitSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
        runtime = { session, hitSource, probe: null, hit: null, viewer: new Vector3(), anchor: null };
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

/**
 * Called every XR frame: keep the nearest horizontal surface below the eyes under the screen
 * centre (a table or the floor, never a wall or a shelf overhead) and the viewer's position.
 */
export function updateHit(frame: XRFrame, refSpace: XRReferenceSpace | null, viewer: Vector3): Matrix4 | null {
  const r = runtime;
  if (!r) return null;
  r.viewer.copy(viewer);
  r.hit = null;
  if (!r.hitSource || !refSpace) return null;
  for (const result of frame.getHitTestResults(r.hitSource)) {
    const pose = result.getPose(refSpace);
    if (!pose) continue;
    const m = pose.transform.matrix;
    if (!isHorizontalHit(m) || m[13] > viewer.y - 0.12) continue;
    r.hit = hitMatrix.fromArray(m);
    break;
  }
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
