// A local, low-resolution Mars IBL. PMREM is rebuilt at most once per 1.5 s; a single cheap
// texture blend keeps reflections continuous between bakes, without changing material programs.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BackSide, Color, Mesh, NoBlending, OrthographicCamera, PlaneGeometry, PMREMGenerator,
  Quaternion, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, Vector4,
  type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { live } from './registry';
import { skyLook, type SkyLook } from './sites';
import { ENVIRONMENT_BLEND_S, ENVIRONMENT_FACE_SIZE, environmentNeedsBake } from './environmentMath';

const DAY = skyLook(28), NIGHT = skyLook(-18);
const names = ['sky', 'horizon', 'ground', 'glow'] as const;

class MarsIbl {
  private generator: PMREMGenerator;
  private sky = new Scene();
  private blendScene = new Scene();
  private camera = new OrthographicCamera(-1,1,1,-1,0,2);
  private skyGeometry = new SphereGeometry(10,24,12);
  private quadGeometry = new PlaneGeometry(2,2);
  private skyMaterial = new ShaderMaterial({side:BackSide,depthWrite:false,toneMapped:false,
    uniforms:{sky:{value:new Color()},horizon:{value:new Color()},ground:{value:new Color()},
      glow:{value:new Color()},sun:{value:new Vector3(.4,.7,.3)}},
    vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vDir; uniform vec3 sky,horizon,ground,glow,sun;
      void main(){vec3 d=normalize(vDir);vec3 c=mix(horizon,sky,pow(max(d.y,0.),.5));
      c=mix(ground,c,smoothstep(-.16,.06,d.y));
      c+=.10*horizon*exp(-d.y*d.y*70.);
      c+=glow*pow(max(dot(d,normalize(sun)),0.),18.);gl_FragColor=vec4(c,1.);}`});
  private blendMaterial = new ShaderMaterial({depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
    uniforms:{a:{value:null},b:{value:null},k:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'varying vec2 vUv;uniform sampler2D a,b;uniform float k;void main(){gl_FragColor=mix(texture2D(a,vUv),texture2D(b,vUv),k);}'});
  private a: WebGLRenderTarget | null = null;
  private b: WebGLRenderTarget | null = null;
  private output: WebGLRenderTarget | null = null;
  private baked: number[] = [];
  private lastBake = -Infinity;
  private elapsed = 0;
  private rotation = new Quaternion();
  private viewport = new Vector4();
  private scissor = new Vector4();
  private previous;
  readonly stats = {bakes:0,blend:1,faceSize:ENVIRONMENT_FACE_SIZE};

  constructor(private renderer: WebGLRenderer, private scene: Scene) {
    this.previous={texture:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone()};
    this.generator=new PMREMGenerator(renderer);
    this.sky.add(new Mesh(this.skyGeometry,this.skyMaterial));
    this.blendScene.add(new Mesh(this.quadGeometry,this.blendMaterial));
    this.camera.position.z=1;
    scene.userData.marsEnvironment=this.stats;
  }

  update(look: SkyLook, sun: Vector3, rotation: Quaternion, dt: number) {
    this.elapsed+=dt*1000;
    let bakedThisFrame=false;
    const colors=[new Color().setRGB(...look.zenith,SRGBColorSpace).lerp(new Color().setRGB(...look.ambientSky,SRGBColorSpace),look.nightKey*.4),
      new Color().setRGB(...look.horizon,SRGBColorSpace).lerp(new Color().setRGB(...look.ambientSky,SRGBColorSpace),look.nightKey*.22),
      new Color().setRGB(...look.ambientGround,SRGBColorSpace).multiplyScalar(.8),
      new Color().setRGB(...look.glow,SRGBColorSpace).multiplyScalar(.45*look.sunUp)];
    const palette=[...colors.flatMap(c=>c.toArray()),...sun.toArray()];
    const change=this.baked.length?Math.max(...palette.map((x,i)=>Math.abs(x-this.baked[i]))):Infinity;
    if(!this.output||environmentNeedsBake(change,this.elapsed-this.lastBake,this.stats.blend)) {
      names.forEach((name,i)=>(this.skyMaterial.uniforms[name].value as Color).copy(colors[i]));
      (this.skyMaterial.uniforms.sun.value as Vector3).copy(sun);
      const next=this.generator.fromScene(this.sky,.04,.1,20,{size:ENVIRONMENT_FACE_SIZE});
      if(!this.output) {
        this.a=next;this.b=next;this.output=next.clone();this.output.depthBuffer=false;
        this.output.viewport.set(0,0,this.output.width,this.output.height);
        this.output.scissor.set(0,0,this.output.width,this.output.height);this.output.scissorTest=false;
        this.stats.blend=1;
        this.scene.environment=this.output.texture;
      } else {
        if(this.a!==this.b)this.a?.dispose();
        this.a=this.b;this.b=next;this.stats.blend=0;
      }
      this.blendMaterial.uniforms.a.value=this.a!.texture;
      this.blendMaterial.uniforms.b.value=this.b!.texture;
      this.lastBake=this.elapsed;this.baked=palette;this.stats.bakes++;
      bakedThisFrame=true;
    }
    const was=this.stats.blend;
    this.stats.blend=Math.min(1,was+dt/ENVIRONMENT_BLEND_S);
    if(this.output&&(was<1||bakedThisFrame)) {
      this.blendMaterial.uniforms.k.value=this.stats.blend*this.stats.blend*(3-2*this.stats.blend);
      const rt=this.renderer.getRenderTarget(),xr=this.renderer.xr.enabled,scissorTest=this.renderer.getScissorTest();
      this.renderer.getViewport(this.viewport);this.renderer.getScissor(this.scissor);
      this.renderer.xr.enabled=false;this.renderer.setScissorTest(false);
      this.renderer.setRenderTarget(this.output);this.renderer.setViewport(0,0,this.output.width,this.output.height);
      this.renderer.render(this.blendScene,this.camera);
      this.renderer.setRenderTarget(rt);this.renderer.setViewport(this.viewport);this.renderer.setScissor(this.scissor);
      this.renderer.setScissorTest(scissorTest);this.renderer.xr.enabled=xr;
    }
    const target=.55-.33*look.nightKey;
    this.scene.environmentIntensity+=(target-this.scene.environmentIntensity)*(1-Math.exp(-dt*2.2));
    this.rotation.slerp(rotation,1-Math.exp(-dt*3));
    this.scene.environmentRotation.setFromQuaternion(this.rotation);
  }

  dispose() {
    if(this.scene.environment===this.output?.texture) {
      this.scene.environment=this.previous.texture;this.scene.environmentIntensity=this.previous.intensity;
      this.scene.environmentRotation.copy(this.previous.rotation);
    }
    if(this.scene.userData.marsEnvironment===this.stats)delete this.scene.userData.marsEnvironment;
    if(this.a!==this.b)this.a?.dispose();this.b?.dispose();this.output?.dispose();
    this.generator.dispose();this.skyMaterial.dispose();this.blendMaterial.dispose();this.skyGeometry.dispose();this.quadGeometry.dispose();
  }
}

export function MarsEnvironment({light}:{light?:'day'|'night'}) {
  const {gl,scene}=useThree();const env=useRef<MarsIbl|null>(null);
  const sun=useRef(new Vector3()),rotation=useRef(new Quaternion()),inverse=useRef(new Quaternion());
  useEffect(()=>{const e=new MarsIbl(gl,scene);env.current=e;return()=>{env.current=null;e.dispose();};},[gl,scene]);
  useFrame((_,delta)=>{
    const atSite=light===undefined&&live.site.valid&&live.shot.blend>.25;
    const look=light?(light==='night'?NIGHT:DAY):(atSite?live.siteLook:null)??DAY;
    if(atSite)rotation.current.copy(live.site.quat);else rotation.current.identity();
    inverse.current.copy(rotation.current).invert();
    if(light)sun.current.set(.55,1,.7).normalize();
    else sun.current.copy(atSite?live.siteSun:live.sun).applyQuaternion(inverse.current).normalize();
    env.current?.update(look,sun.current,rotation.current,Math.min(delta,.1));
  },-.1);
  return null;
}
