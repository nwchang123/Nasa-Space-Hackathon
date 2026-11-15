import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Triangle, Vector3 } from 'three';
import { ContactShadowMesh } from '../src/scene/contactShadowMesh';
import { collectGroundContacts, CONTACT_OFFSET_M, gridHeight, INGENUITY_SINK_M,
  registerGroundContacts, SHADOW_BIAS, SHADOW_NORMAL_BIAS_M, siteShadowFrustum, terrainLandingFrame,
  type GroundContact } from '../src/scene/grounding';
import { buildParachute, ingenuityFromGltf, MODEL_REGISTRY, normalizeModel } from '../src/scene/models';
import { SITE_PRESETS, siteLayout } from '../src/scene/sites';
import { buildGround } from '../src/scene/terrain';
import { ROVER_PATH, sojournerPath } from '../src/scene/signatures/logic';
import { loadGlb } from './glb-fixture';

describe('physical landing datum', () => {
  it('grounds real vertices rather than empty corners of a transformed mesh AABB', () => {
    const geometry = new BoxGeometry(2, .1, .2);
    geometry.rotateZ(.8); // local box now contains empty corners
    const mesh = new Mesh(geometry, new MeshBasicMaterial());mesh.rotation.z=-.7;
    const approximate = new Box3().setFromObject(mesh), exact = new Box3().setFromObject(mesh,true);
    expect(exact.min.y-approximate.min.y).toBeGreaterThan(.01);
    const grounded=normalizeModel(mesh);
    expect(new Box3().setFromObject(grounded,true).min.y).toBeCloseTo(0,8);
  });

  it('lands all four real Ingenuity toes 1–1.5 cm into the sand, retaining the rotor rig', async () => {
    const {scene}=await loadGlb('ingenuity.glb'),rig=ingenuityFromGltf(scene,true);
    const contacts:GroundContact[]=[];collectGroundContacts(rig.root,contacts);
    expect(contacts).toHaveLength(4);
    const landed=new Group();landed.position.y=-INGENUITY_SINK_M;landed.add(rig.root);landed.updateMatrixWorld(true);
    for(const c of contacts){
      const toe=c.point.clone().applyMatrix4(c.object.matrixWorld);
      expect(toe.y).toBeLessThanOrEqual(-.01);expect(toe.y).toBeGreaterThanOrEqual(-.015);
    }
    const upper=rig.root.getObjectByName('rotors_01')!,q=upper.quaternion.clone();
    rig.setRotor(1.2);expect(upper.quaternion.angleTo(q)).toBeCloseTo(1.2,5);
    expect(rig.brokenTip?.parent).toBeDefined();rig.dispose();
  });

  it('keeps all four toes in the soil after flying to an inclined landing point',async()=>{
    const{scene}=await loadGlb('ingenuity.glb'),rig=ingenuityFromGltf(scene,true);
    const feet:GroundContact[]=[];collectGroundContacts(rig.root,feet);
    const terrain=(x:number,z:number)=>.07*x-.045*z+.1,stance={height:0,rotation:new Quaternion()};
    for(const yaw of [0,.7,2.3]){
      terrainLandingFrame(rig.root,terrain,8,-3,yaw,stance);
      rig.root.position.set(8,stance.height-INGENUITY_SINK_M,-3);
      rig.root.quaternion.copy(stance.rotation).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw));
      rig.root.updateMatrixWorld(true);
      for(const c of feet){const p=c.point.clone().applyMatrix4(c.object.matrixWorld),gap=p.y-terrain(p.x,p.z);
        expect(gap).toBeLessThanOrEqual(-.01);expect(gap).toBeGreaterThan(-.0155);}
    }
    rig.dispose();
  });
});

describe('shadow precision', () => {
  it('keeps depth bias below 6 mm at every site and fits the full EDL clearing', () => {
    for(const preset of Object.values(SITE_PRESETS)){
      const s=siteShadowFrustum(preset);
      expect(s.near).toBeGreaterThanOrEqual(40);expect(s.far).toBeLessThanOrEqual(120);
      expect(Math.abs(SHADOW_BIAS)*(s.far-s.near)+SHADOW_NORMAL_BIAS_M).toBeLessThan(.006);
      expect(s.radius).toBeGreaterThanOrEqual(preset.clear);
      expect(s.radius).toBeGreaterThan(Math.hypot(preset.ingenuity.right,preset.ingenuity.toward));
    }
    expect(SITE_PRESETS['mars2020-edl'].clear).toBeGreaterThanOrEqual(18);
    expect(SITE_PRESETS['pathfinder-sojourner'].clear).toBeGreaterThanOrEqual(3.6);
  });
});

describe('contacts on the rendered terrain', () => {
  beforeAll(()=>vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({
    createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{},
  })})}));
  afterAll(()=>vi.unstubAllGlobals());
  for(const [id,file,count] of [
    ['viking-1','viking-lander.glb',3],['viking-2','viking-lander.glb',3],
    ['opportunity','mer.glb',6],['phoenix','phoenix.glb',3],['insight','insight.glb',3],
  ] as const)it(`${id}: every pad or wheel meets soil, including the Viking 2 high side`,async()=>{
    const p=SITE_PRESETS[id],lay=siteLayout(p),ground=buildGround(p,lay);
    const{scene}=await loadGlb(file),entry=MODEL_REGISTRY[id];
    const body=normalizeModel(scene,entry.size);registerGroundContacts(body);
    const posed=new Group(),machine=new Group();posed.position.y=-entry.pose!.sink;posed.rotation.set(...entry.pose!.tilt);
    machine.rotation.y=lay.machineYaw;machine.add(posed);posed.add(body);machine.updateMatrixWorld(true);
    const contacts:GroundContact[]=[];collectGroundContacts(body,contacts);expect(contacts).toHaveLength(count);
    ground.ground.updateMatrixWorld(true);
    for(const c of contacts){
      const foot=c.point.clone().applyMatrix4(c.object.matrixWorld);
      const soil=ground.heightAt(foot.x,foot.z);
      expect(foot.y-soil).toBeLessThan(.001);expect(foot.y-soil).toBeGreaterThan(-.04);
      const ray=new Raycaster(new Vector3(foot.x,2,foot.z),new Vector3(0,-1,0));
      const hits=ray.intersectObject(ground.ground);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeCloseTo(soil,6);
    }
    ground.dispose();
  });

  it('keeps the entire unchanged canopy above flat terrain and lets it cast a shadow',()=>{
    const p=SITE_PRESETS['mars2020-edl'],lay=siteLayout(p),ground=buildGround(p,lay),rig=buildParachute();
    const canopy=rig.getObjectByName('parachute') as Mesh;rig.rotation.y=lay.machineYaw;rig.updateMatrixWorld(true);
    expect(canopy.castShadow).toBe(true);
    const pos=canopy.geometry.attributes.position,v=new Vector3();
    let lowest=Infinity;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(canopy.matrixWorld);
      expect(ground.heightAt(v.x,v.z)).toBeCloseTo(0,7);
      const gap=v.y-ground.heightAt(v.x,v.z);expect(gap).toBeGreaterThanOrEqual(.0039);lowest=Math.min(lowest,gap);
    }
    expect(lowest).toBeLessThan(.006);ground.dispose();
  });

  it('retains APXS contact with the actual rock after the 12 mm site sink',async()=>{
    const p=SITE_PRESETS['pathfinder-sojourner'],ground=buildGround(p,siteLayout(p));
    const{scene}=await loadGlb('pathfinder.glb'),root=normalizeModel(scene),posed=new Group();
    posed.position.y=-MODEL_REGISTRY['pathfinder-sojourner'].pose!.sink;posed.add(root);
    const rover=root.getObjectByName('sojourner')!,dir=new Vector3(.866,0,.5),side=new Vector3(.5,0,-.866);
    const foot=new Vector3(1.256,.045,1.121),end=sojournerPath(1);
    rover.position.copy(foot).addScaledVector(dir,end.s).addScaledVector(side,end.lat).setY(0);
    rover.rotation.set(0,Math.atan2(-dir.z,dir.x),0);posed.updateMatrixWorld(true);
    const tip=rover.getObjectByName('sojourner-apxs-tip')!.getWorldPosition(new Vector3());
    const geometry=(ground.rocks.children[0] as Mesh).geometry.clone();geometry.computeBoundingSphere();
    const k=.24/geometry.boundingSphere!.radius,at=foot.clone().addScaledVector(dir,ROVER_PATH.rockS).addScaledVector(side,ROVER_PATH.rockSide);
    geometry.scale(k*1.15,k*.8,k);geometry.rotateY(.7);geometry.translate(at.x,-.05,at.z);
    const pos=geometry.attributes.position,ix=geometry.index!,tri=new Triangle(),closest=new Vector3();let gap=Infinity;
    for(let i=0;i<ix.count;i+=3){
      tri.set(new Vector3().fromBufferAttribute(pos,ix.getX(i)),new Vector3().fromBufferAttribute(pos,ix.getX(i+1)),new Vector3().fromBufferAttribute(pos,ix.getX(i+2)));
      tri.closestPointToPoint(tip,closest);gap=Math.min(gap,tip.distanceTo(closest));
    }
    expect(gap).toBeLessThan(.012);geometry.dispose();ground.dispose();
  });
});

describe('surface queries and contact batch',()=>{
  it('uses the actual two triangle planes instead of a bilinear approximation',()=>{
    const axis=[0,1],h=new Float32Array([0,0,0,1]);
    expect(gridHeight(axis,axis,h,.4,.2)).toBe(0);
    expect(gridHeight(axis,axis,h,.75,.75)).toBe(.5);
    expect(gridHeight(axis,axis,h,1,1)).toBe(1);
  });

  it('drapes every soft-shadow vertex 3 mm above terrain, follows motion and disappears in flight',()=>{
    const object=new Group();object.position.set(1,-.012,2);
    const contacts:GroundContact[]=[{object,point:new Vector3(),radiusX:.2,radiusZ:.25}];
    const mesh=new ContactShadowMesh(),terrain=(x:number,z:number)=>.03*Math.sin(x*2)*Math.sin(z*3);
    mesh.update(contacts,new Matrix4(),terrain,.5);
    expect(mesh.visible).toBe(true);expect(mesh.material.opacity).toBeCloseTo(.16);
    const pos=mesh.geometry.attributes.position;
    for(let i=0;i<65;i++)expect(pos.getY(i)-terrain(pos.getX(i),pos.getZ(i))).toBeCloseTo(CONTACT_OFFSET_M,6);
    expect(mesh.material.depthWrite).toBe(false);expect(mesh.material.premultipliedAlpha).toBe(true);
    expect(mesh.castShadow).toBe(false);expect(mesh.userData.contacts[0].x).toBe(1);
    object.position.x=2;mesh.update(contacts,new Matrix4(),terrain,1);expect(mesh.userData.contacts[0].x).toBe(2);
    object.position.y=.3;mesh.update(contacts,new Matrix4(),terrain,1);
    expect(mesh.visible).toBe(false);expect(mesh.geometry.drawRange.count).toBe(0);mesh.dispose();
  });

  it('keeps six Sojourner contacts on the animated node after a ramp/drive move',async()=>{
    const{scene}=await loadGlb('pathfinder.glb'),body=normalizeModel(scene);registerGroundContacts(body);
    const all:GroundContact[]=[];collectGroundContacts(body,all);
    const rover=body.getObjectByName('sojourner')!,wheelContacts=all.filter(c=>c.object===rover);
    expect(wheelContacts).toHaveLength(6);
    const mesh=new ContactShadowMesh();rover.position.set(1,0,2);rover.rotation.y=.4;
    mesh.update(wheelContacts,new Matrix4(),()=>0,1);const x=mesh.userData.contacts[0].x;
    rover.position.x+=.7;mesh.update(wheelContacts,new Matrix4(),()=>0,1);
    expect(mesh.userData.contacts[0].x-x).toBeCloseTo(.7,7);mesh.dispose();
  });

  it('fits every backshell/debris and low canopy-fold contact in the single batch',async()=>{
    const{scene}=await loadGlb('backshell.glb'),root=normalizeModel(scene),canopy=buildParachute();
    registerGroundContacts(root);root.updateMatrixWorld(true);canopy.updateMatrixWorld(true);
    const contacts:GroundContact[]=[];collectGroundContacts(root,contacts);collectGroundContacts(canopy,contacts);
    const eligible=contacts.filter(c=>c.point.clone().applyMatrix4(c.object.matrixWorld).y<.18).length;
    expect(eligible).toBeGreaterThan(48);
    const mesh=new ContactShadowMesh();mesh.update(contacts,new Matrix4(),()=>0,1);
    expect(mesh.userData.contacts).toHaveLength(eligible);mesh.dispose();
  });
});
