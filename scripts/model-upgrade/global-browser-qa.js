async(page)=>{
  const label=await page.evaluate(()=>window.__globalQaLabel||'before');
  await page.evaluate(()=>{window.__qaModule=async path=>{
    const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>new URL(n).pathname===path);
    urls.sort((a,b)=>Number(new URL(b).searchParams.get('t')||0)-Number(new URL(a).searchParams.get('t')||0));
    return import(urls[0]||path);
  };});
  const out=`output/playwright/global-refine/${label}`, report={label,viewport:page.viewportSize(),errors:[],shots:[]};
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  const frames=async(n=20)=>page.evaluate(n=>new Promise(resolve=>{let i=0;const f=()=>++i>=n?resolve():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
  const advance=async ms=>{await page.evaluate(ms=>window.__globalTime+=ms,ms);await frames();};
  const metrics=()=>page.evaluate(async()=>{
    const{groups,live}=await import('/src/scene/registry.ts');const{useApp}=await window.__qaModule('/src/store.ts');
    const{useHangar}=await window.__qaModule('/src/hangar/hangarStore.ts');const s=useApp.getState(),h=useHangar.getState();
    const state=s.phase==='hangar'?h.arrangement?.root.__r3f?.root.getState():groups.globe?.__r3f?.root.getState();
    if(!state)return{phase:s.phase,loading:true};
    const scene=state.scene, machine=scene.getObjectByName('machine');let meshes=0;const weather=[];
    (s.phase==='hangar'?h.arrangement.root:machine||scene).traverse(o=>{if(o.isMesh)meshes++;if(o.userData?.missionFinish)weather.push(o.userData.missionFinish);});
    return {phase:s.phase,site:live.shot.siteId,blend:live.shot.blend,sig:s.sig,meshes,
      calls:state.gl.info.render.calls,triangles:state.gl.info.render.triangles,
      environment:!!scene.environment,environmentIntensity:scene.environmentIntensity,
      ibl:scene.userData.marsEnvironment||null,weather,
      wheelNames:machine?['right','left'].flatMap(side=>['front','middle','rear'].map(end=>`wheel-${side}-${end}`)).filter(n=>!!machine.getObjectByName(n)):[],
      shoulder:machine?.getObjectByName('phoenix-arm')?.position.toArray(),
      canopy:machine?.getObjectByName('parachute')?.geometry.attributes.position.count,
      hangarPick:h.pick,hangarLight:h.light};
  });
  const snap=async name=>{await frames();report.shots.push({name,...await metrics()});await page.screenshot({path:`${out}/${name}.png`});};
  const hour=async h=>{await page.evaluate(async h=>(await window.__qaModule('/src/store.ts')).useApp.getState().setSiteHour(h),h);await frames(180);};
  await page.waitForFunction(async()=>!!(await import('/src/scene/registry.ts')).groups.globe?.__r3f?.root);
  await page.evaluate(async()=>{window.__globalTime=Date.UTC(2026,10,15,0);Date.now=()=>window.__globalTime;const{useApp}=await window.__qaModule('/src/store.ts');useApp.getState().reset();useApp.setState({nowMs:window.__globalTime});});
  await frames();await page.getByRole('button',{name:'Begin Flight 73',exact:true}).click();await frames();await advance(3500);
  let from='ingenuity';
  const ids=['viking-1','viking-2','pathfinder-sojourner','spirit','opportunity','phoenix','insight','mars2020-edl','ingenuity'];
  for(let leg=0;leg<ids.length;leg++){
    const id=ids[leg];await page.evaluate(async({leg,from})=>{const{useApp}=await window.__qaModule('/src/store.ts');useApp.getState().flyTo(leg,0,from);useApp.getState().arrive();},{leg,from});
    await frames();await advance(1000);await advance(4500);
    await page.waitForFunction(async id=>{const{live}=await import('/src/scene/registry.ts');return live.shot.siteId===id&&live.shot.blend>.999;},id);
    await hour(12);await snap(`${id}-day`);
    if(id==='viking-1'||id==='insight'){await hour(2);await snap(`${id}-night`);await hour(12);}
    if(['viking-1','pathfinder-sojourner','spirit','phoenix','mars2020-edl'].includes(id)){
      const slider=page.locator('.sig input[type="range"]').first();await slider.focus();await slider.press('End');await frames(120);await snap(`${id}-action`);
    }
    if(id==='viking-2'){await page.getByRole('button',{name:/Utopia winter frost/}).click();await frames(220);await snap('viking-2-frost');}
    if(id==='opportunity'){const slider=page.locator('.sig input[type="range"]').first();await slider.focus();await slider.press('End');await frames(180);await snap('opportunity-storm');}
    if(id==='insight'){
      const quake=page.locator('.sig button').first();await quake.focus();await page.keyboard.down('Space');await advance(1800);await page.keyboard.up('Space');
      await advance(600);await frames(60);await snap('insight-quake');
    }
    from=id;
  }
  await page.evaluate(async()=>(await window.__qaModule('/src/store.ts')).useApp.getState().openHangar());
  await page.waitForFunction(async()=>!!(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState().arrangement);
  await page.evaluate(async()=>(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState().setPick('row'));
  await frames(180);await page.waitForFunction(async()=>{const h=(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState();return h.arrangement?.ids.length===9;});
  await frames(90);await snap('hangar-row-day');
  await page.evaluate(async()=>(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState().setLight('night'));await frames(180);await snap('hangar-row-night');
  await page.evaluate(report=>{window.__globalQaReport=report;},report);
  return {label,shots:report.shots.length,errors:report.errors};
}
