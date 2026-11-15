import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, Vector3 } from 'three';
import { ENVIRONMENT_BLEND_S, environmentNeedsBake } from '../src/scene/environmentMath';
import { applyMissionFinish, cloneLitMaterials } from '../src/scene/missionFinish';

describe('bounded Mars environment updates', () => {
  it('waits for both the bake interval and the preceding reflection blend', () => {
    expect(environmentNeedsBake(1,1499,1)).toBe(false);
    expect(environmentNeedsBake(1,1500,.99)).toBe(false);
    expect(environmentNeedsBake(.024,15000,1)).toBe(false);
    expect(environmentNeedsBake(.1,1500,1)).toBe(true);
    let last=0, blend=1, bakes=1;
    for(let ms=16;ms<=6000;ms+=16){
      blend=Math.min(1,blend+.016/ENVIRONMENT_BLEND_S);
      if(environmentNeedsBake(.2,ms-last,blend)){bakes++;last=ms;blend=0;}
    }
    expect(bakes).toBeLessThanOrEqual(4);
  });
});

describe('instance-owned mission finishes', () => {
  it('shares one clone within an instance, isolates twins, and skips phantom blur materials', () => {
    const source=new MeshStandardMaterial({metalness:.8,roughness:.3});
    const geo=new BoxGeometry(), root=new Group();
    const a=new Mesh(geo,source), b=new Mesh(geo,source), blur=new Mesh(geo,new MeshBasicMaterial());
    root.add(a,b,blur);
    const twin=root.clone(true), skipped=blur.material;
    const owned=cloneLitMaterials(root,new Set([blur]));
    cloneLitMaterials(twin);
    expect(owned).toHaveLength(1);
    expect(a.material).toBe(b.material);
    expect(a.material).not.toBe(source);
    expect(a.material).not.toBe((twin.children[0] as Mesh).material);
    expect(a.geometry).toBe(geo);
    expect(source.envMapIntensity).toBe(1);
    expect(blur.material).toBe(skipped);
    expect((a.material as MeshStandardMaterial).envMapIntensity).toBe(.65);
  });

  it('chains shader/render hooks and tracks the contact marker in a moving metre frame', () => {
    const root=new Group(), parent=new Group();parent.add(root);
    const material=new MeshStandardMaterial();material.name='MER solar panel';
    const mesh=new Mesh(new BoxGeometry(),material), marker=new Group();
    marker.name='mer-right-front-contact';marker.position.set(-.6,0,.7);root.add(mesh,marker);
    const compile=vi.fn(), render=vi.fn();material.onBeforeCompile=compile;mesh.onBeforeRender=render;
    applyMissionFinish(root,'spirit');
    const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader as never,{} as never);
    expect(compile).toHaveBeenCalledOnce();
    const u=shader.uniforms as Record<string,{value:any}>;
    expect(u.uMissionContact.value.distanceTo(new Vector3(-.6,0,.7))).toBeLessThan(1e-8);
    parent.position.set(10,20,30);parent.scale.setScalar(.001);parent.updateMatrixWorld(true);
    mesh.onBeforeRender({} as never,{} as never,{} as never,mesh.geometry,material,{} as never);
    expect(render).toHaveBeenCalledOnce();
    expect(new Vector3().setFromMatrixPosition(root.matrixWorld).applyMatrix4(u.uMissionFrame.value).length()).toBeLessThan(1e-8);
    expect(shader.fragmentShader).toContain('missionDust');
    expect(material.customProgramCacheKey()).toContain('mission-finish:spirit');
  });

  it('uses separate shader programs for the twins and keeps the shared source unchanged', () => {
    const source=new MeshStandardMaterial();source.name='MER solar panel';
    const roots=['spirit','opportunity','ingenuity'].map(kind=>{
      const root=new Group();root.add(new Mesh(new BoxGeometry(),source));cloneLitMaterials(root);
      applyMissionFinish(root,kind as 'spirit'|'opportunity'|'ingenuity');return root;
    });
    const keys=roots.map(root=>(root.children[0] as Mesh).material as MeshStandardMaterial).map(m=>m.customProgramCacheKey());
    expect(new Set(keys).size).toBe(3);
    expect(source.onBeforeCompile.toString()).not.toContain('missionDust');
    expect(source.userData).toEqual({});
  });
});

describe('seven delivered PBR assets', () => {
  const names=['mer','pathfinder','phoenix','backshell','insight','ingenuity','viking-lander'];
  const docs=names.map(name=>{
    const bytes=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url));
    return{name,bytes:bytes.length,json:JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())};
  });
  it('keeps a global size budget, static triangle targets and MER draw-call reduction', () => {
    expect(docs.reduce((s,d)=>s+d.bytes,0)).toBeLessThan(9_400_000);
    for(const name of ['insight','phoenix']){
      const j=docs.find(d=>d.name===name)!.json;
      const tris=j.meshes.flatMap((m:any)=>m.primitives).reduce((s:number,p:any)=>s+j.accessors[p.indices].count/3,0);
      expect(tris).toBeGreaterThanOrEqual(45_000);expect(tris).toBeLessThanOrEqual(65_000);
    }
    const mer=docs.find(d=>d.name==='mer')!.json;
    expect(mer.meshes.reduce((s:number,m:any)=>s+m.primitives.length,0)).toBeLessThanOrEqual(30);
    for(const n of ['HGAA_arm','arm_base','arm_joint1','arm_joint2','arm_mount','arm_turret','arm_wrist',
      'mast','mast_base','mast_cam','mast_neck','mast_top'])
      expect(mer.nodes.some((node:any)=>node.name===n)).toBe(true);
  });
  for(const {name,json} of docs)it(`${name} has normal/MR maps and portable tangent space on every primitive`,()=>{
    for(const mat of json.materials){
      expect(mat.normalTexture).toBeDefined();expect(mat.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(mat.extensions?.KHR_materials_unlit).toBeUndefined();
    }
    for(const mesh of json.meshes)for(const p of mesh.primitives){
      expect(p.attributes.TEXCOORD_0).toBeDefined();expect(p.attributes.TANGENT).toBeDefined();
    }
  });
  it('culls closed hardware while retaining foil and the thin open shell',()=>{
    const j=docs.find(d=>d.name==='backshell')!.json;
    expect(j.materials.find((m:any)=>m.name==='Satin titanium').doubleSided??false).toBe(false);
    expect(j.materials.find((m:any)=>m.name==='Weathered backshell thermal coating').doubleSided).toBe(true);
    expect(j.nodes.some((n:any)=>n.name==='parachute')).toBe(false);
  });
});
