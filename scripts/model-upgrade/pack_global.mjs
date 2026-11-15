// Pinned CLI dependencies, local images only:
// npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_global.mjs
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,delimiter,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),WORK=resolve(ROOT,'assets-raw/global-refine');
const cli=process.env.PATH.split(delimiter).map(p=>resolve(p,'../@gltf-transform/cli/package.json')).find(existsSync);
if(!cli)throw Error('Run with npx --package=@gltf-transform/cli@4.5.1 node ...');
const dep=createRequire(cli),load=n=>import(pathToFileURL(dep.resolve(n)).href);
const{NodeIO,PropertyType}=await load('@gltf-transform/core');
const{ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP,KHRMeshQuantization}=await load('@gltf-transform/extensions');
const{meshopt,reorder,quantize,prune,dedup,unweldPrimitive,weldPrimitive}=await load('@gltf-transform/functions');
const{default:mikktspace}=await load('mikktspace');
const{MeshoptEncoder,MeshoptDecoder}=await load('meshoptimizer');
const{default:sharp}=await load('sharp');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(resolve(WORK,'final'),{recursive:true});

function geometry(doc){
  const result={};
  for(const node of doc.getRoot().listNodes()){
    const mesh=node.getMesh();if(!mesh)continue;const triangles=[];
    for(const p of mesh.listPrimitives()){
      const a=p.getAttribute('POSITION'),ix=p.getIndices();
      for(let i=0;i<(ix?ix.getCount():a.getCount());i+=3){
        const v=[0,1,2].map(j=>a.getElement(ix?ix.getScalar(i+j):i+j,[]));
        const cmp=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];let f=0;
        for(let j=1;j<3;j++)if(cmp(v[j],v[f])<0)f=j;
        triangles.push([...v[f],...v[(f+1)%3],...v[(f+2)%3]]);
      }
    }
    triangles.sort((a,b)=>{for(let i=0;i<9;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;});
    const b=Buffer.alloc(triangles.length*36);triangles.forEach((t,i)=>t.forEach((v,j)=>b.writeFloatLE(v===0?0:v,i*36+j*4)));
    result[node.getName()]={triangles:triangles.length,trianglePositionSha256:hash(b)};
  }return result;
}
const graph=d=>d.getRoot().listNodes().map(n=>({name:n.getName(),children:n.listChildren().map(c=>c.getName()),
  translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale()})).sort((a,b)=>a.name.localeCompare(b.name));
const names=process.argv.slice(2).length?process.argv.slice(2):['mer','pathfinder','phoenix','backshell','insight','ingenuity','viking-lander'];
const reportPath=resolve(WORK,'packing-report.json');
const results=existsSync(reportPath)?JSON.parse(readFileSync(reportPath)):{};
for(const name of names){
  const viking=name==='viking-lander';
  const retained=['pathfinder','backshell','ingenuity'].includes(name);
  const input=viking?resolve(ROOT,'assets-raw/viking-material-upgrade/viking-materials-raw.glb'):
    retained?resolve(WORK,'originals',`${name}.glb`):resolve(WORK,`${name}-raw.glb`);
  const baseline=JSON.parse(readFileSync(resolve(ROOT,'scripts/model-upgrade/global-baseline.json')));
  if(retained&&hash(readFileSync(input))!==baseline[name].sha256)throw Error(`${name}: pinned input hash changed`);
  const doc=await io.read(input),root=doc.getRoot(),beforeGraph=graph(doc);
  if(retained){
    for(const m of root.listMaterials()){
      const prefix=name==='ingenuity'?'ingenuity-hardware':name+'-'+m.getName();
      if(!m.getNormalTexture())m.setNormalTexture(doc.createTexture(prefix+'-normal')
        .setImage(readFileSync(resolve(WORK,'textures',prefix+'-micro-normal.png'))).setMimeType('image/png')).setNormalScale(.4);
      if(!m.getMetallicRoughnessTexture())m.setMetallicRoughnessTexture(doc.createTexture(prefix+'-MR')
        .setImage(readFileSync(resolve(WORK,'textures',prefix+'-surface-MR.png'))).setMimeType('image/png')).setMetallicFactor(1).setRoughnessFactor(1);
      const thin=/foil|MLI|fabric|Vectran|stitched/i.test(m.getName())||
        (name==='backshell'&&/Weathered|laminate/i.test(m.getName()));
      m.setDoubleSided(thin);
    }
  }
  if(name==='ingenuity'){
    const normal=doc.createTexture('terminal-hardware-normal').setImage(readFileSync(resolve(WORK,'textures/ingenuity-hardware-micro-normal.png'))).setMimeType('image/png');
    const mr=doc.createTexture('terminal-hardware-MR').setImage(readFileSync(resolve(WORK,'textures/ingenuity-hardware-surface-MR.png'))).setMimeType('image/png');
    for(const m of root.listMaterials()){
      m.setExtension('KHR_materials_unlit',null);
      if(!m.getNormalTexture())m.setNormalTexture(normal).setNormalScale(.35);
      if(!m.getMetallicRoughnessTexture())m.setMetallicRoughnessTexture(mr).setMetallicFactor(1).setRoughnessFactor(1);
      m.setDoubleSided(/blades|PaletteMaterial002/.test(m.getName()));
    }
  }
  if(viking){
    for(const m of root.listMaterials())m.setDoubleSided(['blinn4SG','blinn2SG','blinn10SG'].includes(m.getName()));
    const contract=JSON.parse(readFileSync(resolve(ROOT,'scripts/model-upgrade/viking-contract.json')));
    if(JSON.stringify(geometry(doc))!==JSON.stringify(contract.meshes))throw Error('Viking source triangles changed');
  }
  // Old exports omitted UVs on untextured hardware. Add a projection for the new data maps,
  // keeping the existing positions/indices and every animated parent frame intact.
  if(!viking)for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
    if(p.getAttribute('TEXCOORD_0'))continue;
    const pos=p.getAttribute('POSITION'),lo=pos.getMin([]),hi=pos.getMax([]);
    const axes=[0,1,2].sort((a,b)=>(hi[b]-lo[b])-(hi[a]-lo[a])).slice(0,2),uv=new Float32Array(pos.getCount()*2);
    for(let i=0;i<pos.getCount();i++){const v=pos.getElement(i,[]);axes.forEach((a,j)=>uv[i*2+j]=(v[a]-lo[a])/Math.max(1e-8,hi[a]-lo[a]));}
    p.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(root.listBuffers()[0]));
  }
  // Only the newly normal-mapped primitives need MikkTSpace. Unweld/re-weld these
  // primitives with bitwise comparisons; positions and directed triangles stay exact.
  const missingTangents=root.listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>
    p.getMaterial()?.getNormalTexture()&&!p.getAttribute('TANGENT'));
  const floats=a=>{const out=new Float32Array(a.getCount()*a.getElementSize());
    for(let i=0;i<a.getCount();i++)out.set(a.getElement(i,[]),i*a.getElementSize());return out;};
  for(const p of missingTangents){
    unweldPrimitive(p);
    const array=mikktspace.generateTangents(floats(p.getAttribute('POSITION')),
      floats(p.getAttribute('NORMAL')),floats(p.getAttribute('TEXCOORD_0')));
    for(let i=3;i<array.length;i+=4)array[i]*=-1;
    p.setAttribute('TANGENT',doc.createAccessor().setType('VEC4').setArray(array).setBuffer(root.listBuffers()[0]));
    weldPrimitive(p);
  }
  if(retained&&missingTangents.length)await doc.transform(quantize({pattern:/^TANGENT$/,
    quantizeNormal:12,cleanup:false}));
  const images=[];
  for(const t of root.listTextures()){
    const color=root.listMaterials().some(m=>m.getBaseColorTexture()===t||m.getEmissiveTexture()===t);
    const normal=root.listMaterials().some(m=>m.getNormalTexture()===t);
    const small=viking&&/^(blinn2SG|blinn6SG|blinn9SG|blinn10SG|blinn12SG)/.test(t.getName());
    const limit=color?(small||(name==='insight'&&/AO_/.test(t.getName()))?512:1024):512;
    const bytes=await sharp(t.getImage()).resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true})
      .webp({quality:normal?94:82,effort:6}).toBuffer();
    t.setImage(bytes).setMimeType('image/webp');
    const meta=await sharp(bytes).metadata();
    images.push({name:t.getName(),mime:'image/webp',size:[meta.width,meta.height],bytes:bytes.length});
  }
  doc.createExtension(EXTTextureWebP).setRequired(true);
  if(viking){
    await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}),quantize({pattern:/^(NORMAL|TANGENT|TEXCOORD_\d+)$/,
      quantizeNormal:12,quantizeTexcoord:16,cleanup:false}),prune({propertyTypes:[PropertyType.ACCESSOR]}));
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  }else if(retained){
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
    await doc.transform(prune({propertyTypes:[PropertyType.ACCESSOR,PropertyType.TEXTURE]}));
  }else{
    await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
  }
  if(!viking)await doc.transform(dedup({propertyTypes:[PropertyType.TEXTURE]}));
  const out=resolve(WORK,'final',`${name}.glb`);await io.write(out,doc);
  const final=await io.read(out),bytes=readFileSync(out);
  if(viking){
    const contract=JSON.parse(readFileSync(resolve(ROOT,'scripts/model-upgrade/viking-contract.json')));
    if(JSON.stringify(geometry(final))!==JSON.stringify(contract.meshes)||JSON.stringify(graph(final))!==JSON.stringify(beforeGraph))throw Error('Viking geometry/node contract changed');
    if(final.getRoot().listTextures().length!==27||images.some(t=>Math.min(...t.size)<512))throw Error('Viking 27 WebP contract changed');
    const previous=JSON.parse(readFileSync(resolve(ROOT,'docs/viking-materials.json')));
    Object.assign(previous,{bytes:bytes.length,sha256:hash(bytes),textures:images,nodes:graph(final),meshes:geometry(final)});
    previous.pipeline.dataTextureEncoding='WebP quality 94 normals / 82 roughness-metallic; small accessories 512';
    previous.bake=JSON.parse(readFileSync(resolve(ROOT,'assets-raw/viking-material-upgrade/bake-report.json')));
    writeFileSync(resolve(ROOT,'docs/viking-materials.json'),JSON.stringify(previous,null,2)+'\n');
  }
  for(const m of final.getRoot().listMaterials())if(!m.getNormalTexture()||!m.getMetallicRoughnessTexture())throw Error(`${name}: missing PBR data maps on ${m.getName()}`);
  const finalImages=await Promise.all(final.getRoot().listTextures().map(async t=>{
    const meta=await sharp(t.getImage()).metadata();return{name:t.getName(),mime:t.getMimeType(),size:[meta.width,meta.height],bytes:t.getImage().length};}));
  results[name]={bytes:bytes.length,sha256:hash(bytes),triangles:root.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),
    nodes:final.getRoot().listNodes().length,primitives:final.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().length,0),textures:finalImages};
  console.log('PACKED',name,bytes.length,'bytes',results[name].triangles,'triangles',results[name].primitives,'primitives');
}
writeFileSync(reportPath,JSON.stringify(results,null,2)+'\n');
