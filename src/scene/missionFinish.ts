// Instance-owned materials: reflected Mars light and small mission-specific patina. Cached
// GLTF materials, geometry, articulated nodes and the golden phantom are never modified.
import { Color, Matrix4, MeshStandardMaterial, Vector3, type Material, type Mesh,
  type MeshBasicMaterial, type Object3D } from 'three';

export function cloneLitMaterials(root: Object3D, skip: ReadonlySet<Object3D> = new Set()): Material[] {
  const copies=new Map<Material,MeshStandardMaterial>();
  const copy=(source:Material)=>{
    let mat=copies.get(source);if(mat)return mat;
    if((source as MeshStandardMaterial).isMeshStandardMaterial)mat=(source as MeshStandardMaterial).clone();
    else {
      const basic=source as MeshBasicMaterial;
      mat=new MeshStandardMaterial({map:basic.map??null,color:basic.color??new Color(1,1,1),
        transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,
        side:source.side,vertexColors:source.vertexColors,roughness:.75,metalness:.15});
      mat.name=source.name;
    }
    mat.envMapIntensity=.65;copies.set(source,mat);return mat;
  };
  root.traverse(o=>{const mesh=o as Mesh;if(!mesh.isMesh||skip.has(mesh))return;
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
    mesh.castShadow=mesh.receiveShadow=true;
  });
  return [...copies.values()];
}

export type MissionFinish = 'spirit'|'opportunity'|'ingenuity';
export function applyMissionFinish(root:Object3D,kind:MissionFinish) {
  const frame={value:new Matrix4()}, contact={value:new Vector3(-.5,0,.6)};
  root.updateWorldMatrix(true,true);
  const marker=root.getObjectByName('mer-right-front-contact');
  if(marker)root.worldToLocal(marker.getWorldPosition(contact.value));
  const changed=new Set<Material>();
  root.userData.missionFinish=kind;
  root.traverse(o=>{
    const mesh=o as Mesh;if(!mesh.isMesh)return;
    const oldRender=mesh.onBeforeRender;
    mesh.onBeforeRender=function(...args){
      frame.value.copy(root.matrixWorld).invert();oldRender.apply(this,args);
    };
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
      const mat=material as MeshStandardMaterial;
      if(!mat.isMeshStandardMaterial||changed.has(mat))continue;
      changed.add(mat);
      const prev=mat.onBeforeCompile, key=mat.customProgramCacheKey.bind(mat);
      const panel=/panel/i.test(mat.name);
      mat.onBeforeCompile=(shader,renderer)=>{
        prev.call(mat,shader,renderer);
        shader.uniforms.uMissionFrame=frame;shader.uniforms.uMissionContact=contact;
        shader.vertexShader=shader.vertexShader.replace('#include <common>',
          '#include <common>\nuniform mat4 uMissionFrame; varying vec3 vMissionP; varying float vMissionUp;')
          .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
            vMissionP=(uMissionFrame*modelMatrix*vec4(transformed,1.)).xyz;
            vMissionUp=normalize(mat3(uMissionFrame)*mat3(modelMatrix)*objectNormal).y;`);
        const dust=kind==='opportunity'
          ? `(${panel?'.35':'.13'})*smoothstep(-.1,.8,vMissionUp)`
          : kind==='spirit'
            ? '.28*(1.-smoothstep(.18,.62,length(vMissionP.xz-uMissionContact.xz)))*(1.-smoothstep(.12,.5,vMissionP.y))'
            : '.10*smoothstep(.0,.8,vMissionUp)+.09*(1.-smoothstep(.04,.22,vMissionP.y))';
        const color=kind==='spirit'?'vec3(.62,.56,.43)':kind==='opportunity'?'vec3(.30,.105,.045)':'vec3(.32,.19,.09)';
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
          '#include <common>\nuniform vec3 uMissionContact; varying vec3 vMissionP; varying float vMissionUp;')
          .replace('#include <color_fragment>',`#include <color_fragment>
            float missionGrain=.8+.2*sin(vMissionP.x*39.+sin(vMissionP.z*53.))*sin(vMissionP.z*31.);
            float missionDust=clamp((${dust})*missionGrain,0.,.45);
            diffuseColor.rgb=mix(diffuseColor.rgb,${color},missionDust);`)
          .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=min(.96,roughnessFactor+missionDust*.2);')
          .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.-missionDust*.65;');
      };
      mat.customProgramCacheKey=()=>`${key()}|mission-finish:${kind}`;mat.needsUpdate=true;
    }
  });
}
