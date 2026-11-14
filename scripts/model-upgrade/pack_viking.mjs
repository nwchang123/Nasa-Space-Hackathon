// Run through npm exec so the CLI's pinned dependencies are available without changing the app:
// npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_viking.mjs
// Meshopt's direct writer keeps FLOAT32 positions and the original 3-node graph. The CLI's
// meshopt transform also quantizes positions, which would add decode nodes/change local frames.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = resolve(root, 'assets-raw/viking-material-upgrade');
const cliPackage = process.env.PATH.split(delimiter)
  .map(p => resolve(p, '../@gltf-transform/cli/package.json')).find(existsSync);
if (!cliPackage) throw new Error('Run this script with npx --package=@gltf-transform/cli@4.5.1 node ...');
const dependency = createRequire(cliPackage);
const load = name => import(pathToFileURL(dependency.resolve(name)).href);
const { NodeIO, PropertyType } = await load('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } = await load('@gltf-transform/extensions');
const { quantize, reorder, prune } = await load('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = await load('meshoptimizer');
const { default: sharp } = await load('sharp');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function geometry(doc) {
  const result = {};
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const triangles = [];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), indices = prim.getIndices();
      const count = indices ? indices.getCount() : pos.getCount();
      for (let i=0;i<count;i+=3) {
        const verts = [0,1,2].map(j => pos.getElement(indices ? indices.getScalar(i+j) : i+j, []));
        const cmp = (a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
        let first = 0; for (let j=1;j<3;j++) if(cmp(verts[j],verts[first])<0) first=j;
        triangles.push([...verts[first], ...verts[(first+1)%3], ...verts[(first+2)%3]]);
      }
    }
    triangles.sort((a,b) => { for(let i=0;i<9;i++) if(a[i]!==b[i]) return a[i]-b[i]; return 0; });
    const bytes = Buffer.alloc(triangles.length*36);
    triangles.forEach((t,i)=>t.forEach((v,j)=>bytes.writeFloatLE(v===0?0:v,i*36+j*4)));
    result[node.getName()] = { triangles: triangles.length, trianglePositionSha256: hash(bytes) };
  }
  return result;
}

function graph(doc) {
  return doc.getRoot().listNodes().map(n=>({name:n.getName(), children:n.listChildren().map(c=>c.getName()),
    translation:n.getTranslation(), rotation:n.getRotation(), scale:n.getScale()})).sort((a,b)=>a.name.localeCompare(b.name));
}

const contract = JSON.parse(readFileSync(resolve(root,'scripts/model-upgrade/viking-contract.json')));
const source = await io.read(resolve(root,'assets-raw/viking-lander.glb'));
if(hash(readFileSync(resolve(root,'assets-raw/viking-lander.glb')))!==contract.sourceSha256) throw new Error('NASA source changed');
if(JSON.stringify(geometry(source))!==JSON.stringify(contract.meshes)) throw new Error('Source geometry contract mismatch');
const doc = await io.read(resolve(work,'viking-textures.glb'));
if(JSON.stringify(geometry(doc))!==JSON.stringify(contract.meshes)) throw new Error('Blender/texture pipeline changed NASA triangles');
if(JSON.stringify(graph(source))!==JSON.stringify(graph(doc))) throw new Error('NASA node graph or local transforms changed');
await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}), quantize({
  pattern:/^(NORMAL|TANGENT|TEXCOORD_\d+)$/, quantizeNormal:12, quantizeTexcoord:16, cleanup:false,
}), prune({propertyTypes:[PropertyType.ACCESSOR]}));
// Quantized normals/tangents require this declaration even with FLOAT32 positions.
doc.createExtension(KHRMeshQuantization).setRequired(true);
if(JSON.stringify(geometry(doc))!==JSON.stringify(contract.meshes)) throw new Error('Attribute packing changed positions');
if(JSON.stringify(graph(source))!==JSON.stringify(graph(doc))) throw new Error('Attribute packing changed local frames');
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
  method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
});
const output = resolve(work,'viking-lander-final.glb');
await io.write(output,doc);
const final = await io.read(output);
if(JSON.stringify(geometry(final))!==JSON.stringify(contract.meshes)) throw new Error('Meshopt changed float32 geometry');
if(JSON.stringify(graph(source))!==JSON.stringify(graph(final))) throw new Error('Meshopt changed node graph');
const textures=[];
for(const t of final.getRoot().listTextures()) {
  const bytes=t.getImage(), meta=await sharp(bytes).metadata();
  if(t.getMimeType()!=='image/webp'||Math.max(meta.width,meta.height)>1024) throw new Error(`Invalid texture ${t.getName()}`);
  textures.push({name:t.getName(),mime:t.getMimeType(),size:[meta.width,meta.height],bytes:bytes.length});
}
for(const m of final.getRoot().listMaterials()) {
  if(!m.getBaseColorTexture()||!m.getNormalTexture()||!m.getMetallicRoughnessTexture()) throw new Error(`Missing PBR maps for ${m.getName()}`);
}
const bytes=readFileSync(output);
const report={file:'public/models/viking-lander.glb',bytes:bytes.length,sha256:hash(bytes),
  source:'assets-raw/viking-lander.glb',sourceSha256:contract.sourceSha256,
  pipeline:{blender:'5.3.0',gltfTransform:'4.5.1',compression:'EXT_meshopt_compression',
    positions:'lossless FLOAT32; no position quantization/decode nodes',normalTangentBits:12,uvBits:16,
    maxTextureSize:1024,dataTextureSize:512,
    flatten:false,join:false,instance:false,palette:false,simplify:false},
  triangles:99526,nodes:graph(final),meshes:geometry(final),materials:final.getRoot().listMaterials().map(m=>m.getName()),textures,
  bake:JSON.parse(readFileSync(resolve(work,'bake-report.json'))),
  note:'NASA geometry retained. PBR finish, panel microrelief, wear and directional Mars dust are illustrative.'};
writeFileSync(resolve(root,'docs/viking-materials.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,bytes:bytes.length,nodes:report.nodes.length,triangles:report.triangles,
  textures:textures.length,geometry:'exact float32 triangle positions and winding preserved'},null,2));
