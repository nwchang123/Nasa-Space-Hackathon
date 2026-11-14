import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { normalizeModel } from '../src/scene/models';
import { rightFrontFoot } from '../src/scene/signatures/common';
import { loadGlb } from './glb-fixture';

const contract = JSON.parse(readFileSync(new URL('../scripts/model-upgrade/viking-contract.json', import.meta.url), 'utf8'));

/** Canonical directed triangles: independent of UV seam splits and index/vertex ordering. */
function triangleHash(node: Group) {
  const triangles: number[][] = [];
  node.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const pos = o.geometry.getAttribute('position'), ix = o.geometry.index!;
    for (let i=0;i<ix.count;i+=3) {
      const verts = [0,1,2].map(j => {
        const k=ix.getX(i+j); return [pos.getX(k),pos.getY(k),pos.getZ(k)];
      });
      const cmp = (a:number[],b:number[]) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
      let first=0; for(let j=1;j<3;j++) if(cmp(verts[j],verts[first])<0) first=j;
      triangles.push([...verts[first],...verts[(first+1)%3],...verts[(first+2)%3]]);
    }
  });
  triangles.sort((a,b)=>{for(let i=0;i<9;i++) if(a[i]!==b[i]) return a[i]-b[i]; return 0;});
  const bytes=Buffer.alloc(triangles.length*36);
  triangles.forEach((t,i)=>t.forEach((v,j)=>bytes.writeFloatLE(v===0?0:v,i*36+j*4)));
  return {triangles:triangles.length,trianglePositionSha256:createHash('sha256').update(bytes).digest('hex')};
}

function webpDimensions(image: Buffer): [number,number] {
  expect(image.toString('ascii',0,4)).toBe('RIFF');
  expect(image.toString('ascii',8,12)).toBe('WEBP');
  for(let i=12;i+8<image.length;) {
    const chunk=image.toString('ascii',i,i+4), n=image.readUInt32LE(i+4), p=i+8;
    if(chunk==='VP8X') return [1+image.readUIntLE(p+4,3),1+image.readUIntLE(p+7,3)];
    if(chunk==='VP8L') { const bits=image.readUInt32LE(p+1);return [1+(bits&0x3fff),1+((bits>>>14)&0x3fff)]; }
    if(chunk==='VP8 ') return [image.readUInt16LE(p+6)&0x3fff,image.readUInt16LE(p+8)&0x3fff];
    i=p+n+(n%2);
  }
  throw new Error('WebP image has no size header');
}

describe('Viking material upgrade preserves the NASA hardware and camera', () => {
  it('retains all original directed float32 triangles and the three-node hierarchy', async () => {
    const {scene,json}=await loadGlb('viking-lander.glb');
    expect(json.nodes.map((n:any)=>n.name).sort()).toEqual(contract.nodes);
    expect(json.meshes).toHaveLength(2);
    const root=scene.getObjectByName('viking_car')!;
    expect(root.children.map(n=>n.name)).toEqual(['polySurfa1','polySurfa2']);
    expect(root.quaternion.x).toBe(1);
    expect(root.quaternion.w).toBeCloseTo(4.371138828673793e-8,14);
    for(const name of ['polySurfa1','polySurfa2']) {
      const node=scene.getObjectByName(name)! as Group;
      expect(node.position.length()).toBe(0);
      expect(node.scale.toArray()).toEqual([1,1,1]);
      expect(triangleHash(node)).toEqual(contract.meshes[name]);
    }
  });

  it('ships all nine source materials with embedded colour, normal and roughness/metallic WebP maps', async () => {
    const {json,bytes}=await loadGlb('viking-lander.glb');
    expect(bytes.length).toBeLessThan(4_500_000);
    expect(json.extensionsRequired).toEqual(expect.arrayContaining(['EXT_meshopt_compression','EXT_texture_webp','KHR_mesh_quantization']));
    expect(json.materials.map((m:any)=>m.name).sort()).toEqual([
      'blinn4SG','blinn11SG','blinn8SG','initialShadingGr','blinn6SG','blinn9SG','blinn2SG','blinn10SG','blinn12SG',
    ].sort());
    for(const mat of json.materials) {
      expect(mat.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(mat.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(mat.normalTexture.scale).toBeGreaterThan(0);
    }
    for(const mesh of json.meshes) for(const prim of mesh.primitives) {
      expect(json.accessors[prim.attributes.POSITION].componentType).toBe(5126);
      expect(prim.attributes.TEXCOORD_0).toBeDefined();
      expect(prim.attributes.TANGENT).toBeDefined();
    }
    const binary=bytes.subarray(28+bytes.readUInt32LE(12));
    expect(json.images).toHaveLength(27);
    for(const img of json.images) {
      expect(img.mimeType).toBe('image/webp'); expect(img.uri).toBeUndefined();
      const view=json.bufferViews[img.bufferView], offset=view.byteOffset??0;
      const dims=webpDimensions(binary.subarray(offset,offset+view.byteLength));
      expect(Math.max(...dims)).toBeLessThanOrEqual(1024);
      expect(Math.min(...dims)).toBeGreaterThanOrEqual(512);
    }
  });

  it('keeps the metre framing and right-front foot used by the first-photo camera', async () => {
    const {scene}=await loadGlb('viking-lander.glb');
    const machine=new Group();machine.add(normalizeModel(scene,{height:2}));
    const b=new Box3().setFromObject(machine);
    expect(b.min.y).toBeCloseTo(0,10);expect(b.max.y).toBeCloseTo(2,10);
    expect(b.min.x).toBeCloseTo(-1.33156916400698,8);
    expect(b.max.z).toBeCloseTo(1.2166578954472926,8);
    // UV seams affect vertex sampling weights slightly; keep the source-derived camera anchor
    // within 5 mm while the actual triangle positions and winding remain exactly unchanged.
    const foot=rightFrontFoot(machine)!;
    expect(foot.distanceTo(new Vector3(-1.1296966139156615,0,.773608208738861))).toBeLessThan(.005);
  });
});
