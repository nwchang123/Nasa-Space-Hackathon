import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import { Matrix4, type Group } from 'three';
import type { MachineId } from '../types';
import { ContactShadowMesh } from './contactShadowMesh';
import { collectGroundContacts, type GroundContact } from './grounding';
import { live } from './registry';
import type { Ground } from './terrain';

export function GroundContacts({ stop, ground, machine, fade }: {
  stop: MachineId; ground: Ground; machine: RefObject<Group | null>; fade: RefObject<number>;
}) {
  const mesh = useMemo(() => new ContactShadowMesh(), []);
  const contacts = useMemo<GroundContact[]>(() => [], []), inverse = useMemo(() => new Matrix4(), []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  useFrame(() => {
    if (live.shot.siteId !== stop || !live.site.valid) { mesh.visible = false; return; }
    contacts.length = 0;
    if (machine.current) collectGroundContacts(machine.current, contacts);
    if (live.landedIngenuity) collectGroundContacts(live.landedIngenuity, contacts);
    inverse.copy(live.site.matrix).invert();
    mesh.update(contacts, inverse, ground.heightAt, fade.current);
  });
  return <primitive object={mesh} />;
}
