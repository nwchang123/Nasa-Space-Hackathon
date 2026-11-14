// Playwright CLI run-code function. Same view, solar hour and story clock before/after.
async (page) => {
  const label = await page.evaluate(() => window.__vikingQaLabel || 'before');
  const out = `output/playwright/viking-materials/${label}`;
  const report = { label, viewport: page.viewportSize(), errors: [], shots: [] };
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const frames = async (n = 20) => page.evaluate(n => new Promise(resolve => {
    let i = 0; const tick = () => ++i >= n ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick);
  }), n);
  const advance = async ms => { await page.evaluate(ms => window.__vikingTime += ms, ms); await frames(); };
  const hour = async h => {
    await page.evaluate(async h => (await import('/src/store.ts')).useApp.getState().setSiteHour(h), h);
    await frames(40);
  };
  const snapshot = async name => {
    const data = await page.evaluate(async () => {
      const { groups, live } = await import('/src/scene/registry.ts');
      const { useApp } = await import('/src/store.ts');
      const root = groups.globe.__r3f.root.getState(), s = useApp.getState();
      const machine = root.scene.getObjectByName('machine');
      const materials = new Map();
      machine?.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.set(m.uuid, { name: m.name, map: !!m.map, normal: !!m.normalMap, roughnessMap: !!m.roughnessMap,
          metallic: m.metalness, roughness: m.roughness });
      } });
      const ground = root.scene.getObjectByName('ground');
      const properties = root.gl.properties.get(ground.material);
      const program = properties.currentProgram;
      const context = root.gl.getContext();
      const frostLocation = program ? context.getUniformLocation(program.program, 'uFrost') : null;
      const frost = frostLocation ? context.getUniform(program.program, frostLocation) : null;
      const canvas = document.querySelector('.sig-photo canvas');
      let scan = null;
      if (canvas) {
        const px = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let min=255, max=0, mean=0; for(let i=0;i<px.length;i+=4){ min=Math.min(min,px[i]);max=Math.max(max,px[i]);mean+=px[i]; }
        scan={width:canvas.width,height:canvas.height,min,max,mean:mean/(px.length/4)};
      }
      const lights=[]; root.scene.traverse(o=>{ if(o.isDirectionalLight) lights.push(o.intensity); });
      return { site: live.shot.siteId, blend: live.shot.blend, hour: s.siteHour, sig: s.sig,
        materials:[...materials.values()], nightKey: live.siteLook?.nightKey, directionalLights: lights,
        groundProgram: ground.material.customProgramCacheKey(), frost, scan,
        camera:{near:root.camera.near,far:root.camera.far}, box:{min:live.machine.box.min.toArray(),max:live.machine.box.max.toArray()} };
    });
    await page.screenshot({ path: `${out}/${name}.png` }); report.shots.push({name,...data});
  };
  await page.waitForFunction(async () => !!(await import('/src/scene/registry.ts')).groups.globe?.__r3f?.root);
  await page.evaluate(async () => {
    window.__vikingTime=Date.UTC(2026,10,15,0); Date.now=()=>window.__vikingTime;
    const {useApp}=await import('/src/store.ts'); useApp.getState().reset(); useApp.setState({nowMs:window.__vikingTime});
  });
  await frames(); await page.getByRole('button',{name:'Begin Flight 73',exact:true}).click();
  await frames(); await advance(3500);
  const visit=async (leg,from)=>{
    await page.evaluate(async ({leg,from})=>{ const {useApp}=await import('/src/store.ts');
      useApp.getState().flyTo(leg,0,from); useApp.getState().arrive(); },{leg,from});
    await frames(); await advance(1000); await advance(4500);
    await page.waitForFunction(async()=>{
      const {groups,live}=await import('/src/scene/registry.ts');
      return live.shot.blend>.999&&!!groups.globe.__r3f.root.getState().scene.getObjectByName('viking_car');
    }); await frames(55);
  };
  await visit(0,'ingenuity'); await hour(12); await snapshot('viking1-day');
  await hour(2); await snapshot('viking1-night');
  await hour(12);
  const scan=page.getByRole('slider',{name:'Scan the first photo, strip by strip (1976)',exact:true});
  await scan.focus(); await scan.press('End'); await frames(65); await snapshot('viking1-scan-complete');
  await scan.press('Home'); await frames(45); await snapshot('viking1-scan-reset');
  await visit(1,'viking-1'); await hour(12); await snapshot('viking2-day-frost-off');
  const frost=page.getByRole('button',{name:/Utopia winter frost/});
  await frost.click(); await frames(220); await snapshot('viking2-day-frost-on');
  await hour(2); await snapshot('viking2-night-frost-on');
  await frost.click(); await frames(220); await snapshot('viking2-night-frost-off');
  await page.evaluate(report=>{window.__vikingQaReport=report;},report);
  return { label, screenshots: report.shots.length, errors: report.errors,
    scans:report.shots.filter(s=>s.scan).map(s=>({name:s.name,...s.scan})),
    nightLights:report.shots.filter(s=>s.hour===2).map(s=>({name:s.name,lights:s.directionalLights})) };
}
