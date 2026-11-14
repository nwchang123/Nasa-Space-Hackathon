// Live handles the camera rig needs: the world groups and deep-space marker positions.

import type { Group, Vector3 } from 'three';
import type { World } from '../types';

export const groups: Record<World, Group | null> = { moon: null, mars: null, deep: null };

/** Deep-space marker positions in the deep group's local space, updated by DeepSpace. */
export const deepLocal = new Map<string, Vector3>();
