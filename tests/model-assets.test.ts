import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Box3, Color, Euler, Group, Mesh, Raycaster, Triangle, Vector3 } from 'three';
import { buildParachute, MODEL_REGISTRY, normalizeModel, PHOENIX_SHOULDER } from '../src/scene/models';
import { rightFrontFoot } from '../src/scene/signatures/common';
import { ROVER_PATH, sojournerPath } from '../src/scene/signatures/logic';
import { HOTSPOTS } from '../src/scene/sites';
import { rockGeometry } from '../src/scene/terrain';
import type { MachineId } from '../src/types';
import { loadGlb } from './glb-fixture';

const hash = (arr: ArrayBufferView) => createHash('sha256').update(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)).digest('hex');

describe('shipped Blender assets and animation contracts', () => {
  for (const file of ['mer.glb', 'pathfinder.glb', 'phoenix.glb', 'backshell.glb']) {
    it(`${file} is locally loadable, meshopt compressed, grounded and textured with WebP`, async () => {
      const { scene, json, bytes } = await loadGlb(file);
      expect(bytes.length).toBeLessThan(3_000_000);
      expect(json.extensionsRequired).toContain('EXT_meshopt_compression');
      expect(json.extensionsUsed).not.toContain('KHR_draco_mesh_compression');
      expect(json.images.length).toBeGreaterThan(0);
      expect(json.images.every((i: any) => i.mimeType === 'image/webp' && i.uri === undefined)).toBe(true);
      const b = new Box3().setFromObject(normalizeModel(scene));
      expect(Math.abs(b.min.y)).toBeLessThan(0.0001);
      expect(b.max.y).toBeGreaterThan(1.1);
    });
  }

  it('Spirit locates the actual right-front wheel through its sunken/tilted pose', async () => {
    const { scene } = await loadGlb('mer.glb');
    const machine = new Group();
    const posed = new Group();
    const pose = MODEL_REGISTRY.spirit.pose!;
    posed.position.y = -pose.sink;
    posed.rotation.fromArray(pose.tilt);
    posed.add(normalizeModel(scene));
    machine.add(posed);
    const p = rightFrontFoot(machine)!;
    const wheel = scene.getObjectByName('wheel-right-front')!;
    machine.updateWorldMatrix(true, true);
    const wheelBox = new Box3().setFromObject(wheel);
    expect(p.x).toBeGreaterThan(wheelBox.min.x - .025);
    expect(p.x).toBeLessThan(wheelBox.max.x + .025);
    expect(p.z).toBeGreaterThan(wheelBox.min.z);
    expect(p.z).toBeLessThan(wheelBox.max.z);
    expect(p.x).toBeLessThan(-.3);
    expect(p.z).toBeGreaterThan(.4);
    for (const name of ['right', 'left']) for (const end of ['front', 'middle', 'rear']) {
      expect(scene.getObjectByName(`wheel-${name}-${end}`)).toBeDefined();
    }
  });

  it('Sojourner retains an independent metre-frame pivot and its APXS reaches the rock', async () => {
    const { scene } = await loadGlb('pathfinder.glb');
    const root = normalizeModel(scene);
    const rover = scene.getObjectByName('sojourner')!;
    expect(rover.position.distanceTo(new Vector3(-2.6, 0, .5))).toBeLessThan(.0001);
    expect(rover.scale.distanceTo(new Vector3(1, 1, 1))).toBeLessThan(1e-6);
    const top = new Vector3(.39, .135, .629);
    const foot = new Vector3(1.256, .045, 1.121);
    const dir = new Vector3(.866, 0, .5);
    const side = new Vector3(.5, 0, -.866);
    // Both ramp endpoints must lie on the authored ramp/traction rungs, within their thickness.
    const staticMeshes: Mesh[] = [];
    scene.traverse(o => {
      if (!(o instanceof Mesh) || rover.getObjectById(o.id)) return;
      staticMeshes.push(o);
    });
    root.updateMatrixWorld(true);
    for (let i = 0; i <= 10; i++) {
      const p = top.clone().lerp(foot, i / 10);
      const ray = new Raycaster(p.clone().add(new Vector3(0, .1, 0)), new Vector3(0, -1, 0), 0, .2);
      const hits = ray.intersectObjects(staticMeshes, false);
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.abs(hits[0].point.y - p.y)).toBeLessThan(.02);
    }
    const end = sojournerPath(1);
    rover.position.copy(foot).addScaledVector(dir, end.s).addScaledVector(side, end.lat).setY(0);
    rover.rotation.copy(new Euler(0, Math.atan2(-dir.z, dir.x), 0));
    root.updateMatrixWorld(true);
    const tip = root.worldToLocal(rover.getObjectByName('sojourner-apxs-tip')!.getWorldPosition(new Vector3()));
    const rock = foot.clone().addScaledVector(dir, ROVER_PATH.rockS).addScaledVector(side, ROVER_PATH.rockSide).setY(0);
    const along = tip.clone().sub(rock).dot(dir);
    expect(along).toBeGreaterThan(.03);
    expect(along).toBeLessThan(.15);
    expect(tip.y).toBeLessThan(.12);
    expect(tip.y).toBeGreaterThan(.025);
    const geometry = rockGeometry(3334, 10, new Color('#443f3a'), new Color('#9e6545'));
    geometry.computeBoundingSphere();
    const k = .24 / geometry.boundingSphere!.radius;
    geometry.scale(k * 1.15, k * .8, k);
    geometry.rotateY(.7);
    geometry.translate(rock.x, -.05, rock.z);
    const vertices = geometry.attributes.position, indices = geometry.index!;
    const triangle = new Triangle(), closest = new Vector3();
    let gap = Infinity;
    for (let i = 0; i < indices.count; i += 3) {
      triangle.set(...[0, 1, 2].map(j => new Vector3().fromBufferAttribute(vertices, indices.getX(i + j))) as [Vector3, Vector3, Vector3]);
      triangle.closestPointToPoint(tip, closest);
      gap = Math.min(gap, tip.distanceTo(closest));
    }
    expect(gap).toBeLessThan(.012);
  });

  it('Phoenix pivots at PHOENIX_SHOULDER and its scoop follows TIP into the trench', async () => {
    const { scene, json } = await loadGlb('phoenix.glb');
    const root = normalizeModel(scene);
    const arm = scene.getObjectByName('phoenix-arm')!;
    const shoulder = root.worldToLocal(arm.getWorldPosition(new Vector3()));
    expect(shoulder.distanceTo(new Vector3(...PHOENIX_SHOULDER))).toBeLessThan(.001);
    expect(arm.quaternion.angleTo(new Group().quaternion)).toBeLessThan(.001);
    const marker = arm.getObjectByName('phoenix-scoop')!;
    const tip = new Vector3(-.2, -1, 1.35);
    expect(arm.worldToLocal(marker.getWorldPosition(new Vector3())).distanceTo(tip)).toBeLessThan(.001);
    const axis = new Vector3(.988, 0, .152).normalize();
    arm.quaternion.setFromAxisAngle(axis, .04);
    root.updateMatrixWorld(true);
    const actual = root.worldToLocal(marker.getWorldPosition(new Vector3()));
    const expected = tip.clone().applyAxisAngle(axis, .04).add(new Vector3(...PHOENIX_SHOULDER));
    expect(actual.distanceTo(expected)).toBeLessThan(.001);
    expect(Math.abs(actual.y)).toBeLessThan(.015);
    expect(json.nodes.some((n: any) => /^(SEIS|HP3|arm_01|cable_02)$/.test(n.name))).toBe(false);
  });

  it('retains every original canopy position, colour and index for ring decoding', async () => {
    const contract = JSON.parse(readFileSync(new URL('../scripts/model-upgrade/contracts.json', import.meta.url), 'utf8')).parachute;
    const rig = buildParachute();
    const chute = rig.getObjectByName('parachute') as Mesh;
    expect(chute.geometry.attributes.position.count).toBe(contract.vertices);
    expect(hash(chute.geometry.attributes.position.array)).toBe(contract.positionSha256);
    expect(hash(chute.geometry.attributes.color.array)).toBe(contract.colorSha256);
    expect(hash(chute.geometry.index!.array)).toBe(contract.indexSha256);
    const { scene } = await loadGlb('backshell.glb');
    expect(scene.getObjectByName('parachute')).toBeUndefined();
  });

  for (const [id, file] of Object.entries({
    'pathfinder-sojourner': 'pathfinder.glb', spirit: 'mer.glb', opportunity: 'mer.glb',
    phoenix: 'phoenix.glb', 'mars2020-edl': 'backshell.glb',
  })) {
    it(`${id}: all four story anchors lie on the new surfaces`, async () => {
      const { scene } = await loadGlb(file);
      const machine = new Group(), posed = new Group();
      const pose = MODEL_REGISTRY[id as MachineId].pose;
      if (pose) {
        posed.position.y = -pose.sink;
        posed.rotation.fromArray(pose.tilt);
      }
      posed.add(normalizeModel(scene));
      machine.add(posed);
      if (id === 'mars2020-edl') machine.add(buildParachute());
      machine.updateMatrixWorld(true);
      for (const spot of HOTSPOTS[id as MachineId]) {
        if (!('m' in spot)) throw new Error('Authored surfaces require metre anchors');
        const point = new Vector3(...spot.m), nearest = new Vector3();
        const tri = new Triangle(), a = new Vector3(), b = new Vector3(), c = new Vector3();
        let distance = Infinity;
        machine.traverse(o => {
          if (!(o instanceof Mesh)) return;
          const pos = o.geometry.attributes.position, indices = o.geometry.index;
          for (let i = 0; i < (indices?.count ?? pos.count); i += 3) {
            a.fromBufferAttribute(pos, indices ? indices.getX(i) : i).applyMatrix4(o.matrixWorld);
            b.fromBufferAttribute(pos, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(o.matrixWorld);
            c.fromBufferAttribute(pos, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(o.matrixWorld);
            tri.set(a, b, c).closestPointToPoint(point, nearest);
            const d = nearest.distanceTo(point);
            if (Number.isFinite(d)) distance = Math.min(distance, d);
          }
        });
        expect(distance).toBeLessThan(.015);
      }
    });
  }
});
