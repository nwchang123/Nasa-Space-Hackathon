// One low-cost draw for all contact patches. Vertex alpha feathers each patch and custom
// blending multiplies the existing ground colour, so contacts never glow on the night side.
import { AddEquation, BufferGeometry, CustomBlending, DstColorFactor, DynamicDrawUsage,
  Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, OneFactor, OneMinusSrcAlphaFactor,
  Vector3, ZeroFactor } from 'three';
import { CONTACT_OFFSET_M, type GroundContact } from './grounding';
import { smoothstep } from './layout';

const SECTORS = 16, RINGS = [0.28, 0.58, 0.82, 1], ALPHA = [0.8, 0.4, 0.1, 0];
const VERTICES = 1 + RINGS.length * SECTORS;
const MAX_CONTACTS = 96; // All 48 canopy folds plus the backshell and scattered debris.

export class ContactShadowMesh extends Mesh<BufferGeometry, MeshBasicMaterial> {
  private frame = new Matrix4();
  private centre = new Vector3();

  constructor() {
    const geometry = new BufferGeometry(), indices: number[] = [];
    for (let patch = 0; patch < MAX_CONTACTS; patch++) {
      const base = patch * VERTICES;
      for (let sector = 0; sector < SECTORS; sector++) {
        const next = (sector + 1) % SECTORS;
        indices.push(base, base + 1 + next, base + 1 + sector);
        for (let ring = 0; ring < RINGS.length - 1; ring++) {
          const a = base + 1 + ring * SECTORS + sector, b = base + 1 + ring * SECTORS + next;
          const c = a + SECTORS, d = b + SECTORS;
          indices.push(a, b, c, b, d, c);
        }
      }
    }
    geometry.setIndex(indices);
    geometry.setAttribute('position', new Float32BufferAttribute(MAX_CONTACTS * VERTICES * 3, 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('color', new Float32BufferAttribute(MAX_CONTACTS * VERTICES * 4, 4).setUsage(DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    super(geometry, new MeshBasicMaterial({ color: '#704c35', vertexColors: true, transparent: true,
      depthWrite: false, toneMapped: false, premultipliedAlpha: true, blending: CustomBlending,
      blendEquation: AddEquation, blendSrc: DstColorFactor, blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    this.name = 'ground-contact-shadows';
    this.frustumCulled = false;
    this.renderOrder = 1;
    this.userData.contacts = [];
  }

  update(contacts: readonly GroundContact[], inverseSite: Matrix4, heightAt: (x: number, z: number) => number, fade: number) {
    const positions = this.geometry.getAttribute('position'), colors = this.geometry.getAttribute('color');
    const stats = this.userData.contacts as Array<{ x: number; z: number; gap: number }>;
    let used = 0;
    for (const contact of contacts) {
      if (used === MAX_CONTACTS) break;
      contact.object.updateWorldMatrix(true, false);
      this.frame.multiplyMatrices(inverseSite, contact.object.matrixWorld);
      const centre = this.centre.copy(contact.point).applyMatrix4(this.frame);
      const gap = centre.y - heightAt(centre.x, centre.z);
      const strength = 1 - smoothstep(0.025, 0.18, gap);
      if (strength < 0.001) continue;
      const e = this.frame.elements, base = used * VERTICES;
      const vertex = (i: number, x: number, z: number, alpha: number) => {
        positions.setXYZ(base + i, x, heightAt(x, z) + CONTACT_OFFSET_M, z);
        colors.setXYZW(base + i, 1, 1, 1, alpha * strength);
      };
      vertex(0, centre.x, centre.z, 1);
      for (let ring = 0; ring < RINGS.length; ring++) for (let sector = 0; sector < SECTORS; sector++) {
        const a = sector / SECTORS * Math.PI * 2;
        const x = Math.cos(a) * contact.radiusX * RINGS[ring], z = Math.sin(a) * contact.radiusZ * RINGS[ring];
        vertex(1 + ring * SECTORS + sector, centre.x + e[0] * x + e[8] * z,
          centre.z + e[2] * x + e[10] * z, ALPHA[ring]);
      }
      const stat = stats[used] ?? (stats[used] = { x: 0, z: 0, gap: 0 });
      stat.x = centre.x; stat.z = centre.z; stat.gap = gap;
      used++;
    }
    stats.length = used;
    this.visible = used > 0 && fade > 0.001;
    this.material.opacity = fade * 0.32;
    this.geometry.setDrawRange(0, used * SECTORS * (1 + (RINGS.length - 1) * 2) * 3);
    positions.needsUpdate = colors.needsUpdate = true;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
