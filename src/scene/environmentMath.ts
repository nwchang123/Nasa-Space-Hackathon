/** PMREM work is bounded even while the local-time scrubber sends an event every frame. */
export const ENVIRONMENT_FACE_SIZE = 64;
export const ENVIRONMENT_BAKE_GAP_MS = 1500;
export const ENVIRONMENT_BLEND_S = 1.25;
export function environmentNeedsBake(change: number, elapsedMs: number, blend: number): boolean {
  return change > 0.025 && elapsedMs >= ENVIRONMENT_BAKE_GAP_MS && blend >= 1;
}
