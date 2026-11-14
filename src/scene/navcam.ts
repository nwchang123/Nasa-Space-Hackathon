// Ingenuity's navigation-camera view (store.camMode 'navcam'), as the CameraRig last framed it.
// The CameraRig writes this every frame; the HUD's NavcamOverlay reads it on its own animation
// frame. Plain numbers, never rendered by React.

export const navcam = {
  /** How far the view has turned to the navcam, 0 (chase) .. 1 (looking straight down). */
  k: 0,
  /** Ground point under Ingenuity, degrees (planetocentric latitude, east longitude). */
  lat: 0,
  lon: 0,
  /** Heading along the great circle toward the next stop, degrees clockwise from north. */
  headingDeg: 0,
  /** Distance left on this hop, km. */
  kmToGo: 0,
  /** Name of the stop being flown to. */
  to: '',
};
