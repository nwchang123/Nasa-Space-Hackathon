async(page)=>{
  const frames=async(n=90)=>page.evaluate(n=>new Promise(resolve=>{let i=0;const f=()=>++i>=n?resolve():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
  const report={errors:[],shots:[],environmentChecks:{}};
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  const env=()=>page.evaluate(async()=>{
    const h=(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState();
    const r=h.arrangement.root.__r3f.root.getState();
    return{...r.scene.userData.marsEnvironment,environment:!!r.scene.environment,
      textures:r.gl.info.memory.textures,intensity:r.scene.environmentIntensity,calls:r.gl.info.render.calls};
  });
  await frames(150);report.environmentChecks.idleStart=await env();
  await frames(180);report.environmentChecks.idleEnd=await env();
  if(report.environmentChecks.idleStart.bakes!==report.environmentChecks.idleEnd.bakes)throw Error('Idle IBL rebaked');
  for(const id of ['insight','spirit','opportunity','phoenix','viking-1','ingenuity']){
    await page.evaluate(async id=>{
      const h=(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState();h.setLight('day');h.setPick(id);
    },id);
    await page.waitForFunction(async id=>{
      const h=(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState();return h.arrangement?.ids.length===1&&h.arrangement.ids[0]===id;
    },id);await frames(150);
    await page.screenshot({path:`output/playwright/global-refine/after/detail-${id}.png`});
    report.shots.push({id,...await env()});
    if(id==='insight'){
      await page.evaluate(async()=>(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState().setLight('night'));
      await frames(180);await page.screenshot({path:'output/playwright/global-refine/after/detail-insight-night.png'});
      report.shots.push({id:'insight-night',...await env()});
    }
  }
  report.environmentChecks.beforeRapid=await env();
  for(let i=0;i<8;i++){
    await page.evaluate(async i=>(await window.__qaModule('/src/hangar/hangarStore.ts')).useHangar.getState().setLight(i%2?'day':'night'),i);
    await frames(4);
  }
  report.environmentChecks.afterRapid=await env();
  if(report.environmentChecks.afterRapid.bakes-report.environmentChecks.beforeRapid.bakes>2)throw Error('IBL rebaked too frequently');
  await frames(180);report.environmentChecks.settled=await env();
  await page.evaluate(r=>{window.__globalDetailReport=r;},report);
  return report;
}
