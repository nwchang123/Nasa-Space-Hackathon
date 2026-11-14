// Playwright CLI run-code function. Freeze only Date.now in this test page for comparable shots;
// real requestAnimationFrame, rendering, shader compilation and signature motion keep running.
async (page) => {
  const label = await page.evaluate(() => window.__transitionQaLabel || 'before');
  const out = `output/playwright/transitions/${label}`;
  const report = { label, viewport: await page.viewportSize(), frames: [], errors: [] };
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const frames = async (count = 12) => page.evaluate(count => new Promise(resolve => {
    let n = 0;
    const tick = () => ++n >= count ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
  const advance = async ms => {
    await page.evaluate(ms => { window.__qaTime += ms; }, ms);
    await frames();
  };
  const snapshot = async name => {
    await frames();
    const data = await page.evaluate(async () => {
      const { groups, live } = await import('/src/scene/registry.ts');
      let scene = groups.globe;
      const state = scene?.__r3f?.root.getState();
      while (scene?.parent) scene = scene.parent;
      const camera = state.camera;
      const ground = scene.getObjectByName('ground');
      const machine = scene.getObjectByName('machine');
      let dome = null;
      scene.traverse(o => { if (o.material?.uniforms?.zenith) dome = o; });
      const projectedBounds = object => {
        if (!object) return null;
        object.updateWorldMatrix(true, true);
        const xs = [], ys = [];
        const v = camera.position.clone();
        object.traverse(o => {
          if (!o.isMesh) return;
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera);
            xs.push(v.x); ys.push(v.y);
          }
        });
        return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
      };
      const local = camera.position.clone();
      if (live.site.valid) local.applyMatrix4(live.site.matrix.clone().invert());
      return {
        shot: { ...live.shot }, camera: { near: camera.near, far: camera.far, ratio: camera.far/camera.near, local: local.toArray() },
        ground: ground ? { visible: ground.visible, opacity: ground.material.opacity,
          transparent: ground.material.transparent, depthWrite: ground.material.depthWrite,
          alphaHash: ground.material.alphaHash,
          program: ground.material.customProgramCacheKey() } : null,
        dome: dome ? { opacity: dome.material.uniforms.opacity.value, visible: dome.visible } : null,
        fog: { near: scene.fog.near, far: scene.fog.far },
        canopy: projectedBounds(machine?.getObjectByName('parachute')),
        shell: projectedBounds(machine?.getObjectByName('backshell')),
      };
    });
    await page.screenshot({ path: `${out}/${name}.png` });
    report.frames.push({ name, ...data });
  };
  await page.waitForFunction(async () => {
    const { groups } = await import('/src/scene/registry.ts');
    return !!groups.globe?.__r3f?.root;
  });
  await frames(45);
  await page.evaluate(async () => {
    window.__qaTime = Date.UTC(2026, 10, 14, 12);
    Date.now = () => window.__qaTime;
    const { useApp } = await import('/src/store.ts');
    useApp.getState().reset();
    useApp.setState({ nowMs: window.__qaTime });
  });
  await frames(20);
  await page.getByRole('button', { name: 'Begin Flight 73', exact: true }).click();
  await frames();
  await page.evaluate(async () => (await import('/src/store.ts')).useApp.getState().setSiteHour(12));
  let elapsed = 0;
  for (const blend of [.3, .45, .6, .8]) {
    const k = blend < .5 ? Math.sqrt(blend/2) : 1-Math.sqrt((1-blend)/2);
    const target = 2800*k;
    await advance(target-elapsed); elapsed = target;
    await snapshot(`dive-${Math.round(blend*100)}`);
  }
  await advance(4000-elapsed);
  await snapshot('home-settled');
  // Exercise the zero-duration jump that previously showed a destination HUD over the old site.
  await page.evaluate(async () => {
    const { useApp } = await import('/src/store.ts');
    useApp.getState().flyTo(2, 0, 'ingenuity');
    useApp.getState().arrive();
  });
  await frames();
  await snapshot('jump-instant');
  await advance(450); await snapshot('jump-leaving');
  await advance(550); await snapshot('jump-handoff');
  await advance(1200); await snapshot('jump-dive');
  await advance(3000);
  await page.evaluate(async () => (await import('/src/store.ts')).useApp.getState().setSiteHour(12));
  await frames(30); await snapshot('pathfinder');
  await page.getByRole('button', { name: /Scout cam C/ }).click();
  await frames(20); await snapshot('pathfinder-scout');
  await page.getByRole('button', { name: /Scout cam C/ }).click();
  const visit = async (leg, from) => {
    await page.evaluate(async ({ leg, from }) => {
      const { useApp } = await import('/src/store.ts');
      useApp.getState().flyTo(leg, 0, from); useApp.getState().arrive();
    }, { leg, from });
    await frames(); await advance(1000); await advance(3500);
    await page.evaluate(async () => (await import('/src/store.ts')).useApp.getState().setSiteHour(12));
    await frames(30);
  };
  await visit(3, 'pathfinder-sojourner');
  await snapshot('spirit');
  await visit(7, 'spirit');
  await snapshot('backshell-wide');
  const slider = page.locator('.sig input[type="range"]').first();
  await slider.focus(); await slider.press('End');
  await frames(100); await snapshot('backshell-decode');
  await page.evaluate(async () => (await import('/src/store.ts')).useApp.getState().setPhase('report'));
  await frames(); await advance(1000); await advance(3600); await snapshot('flight-log');
  await page.evaluate(report => { window.__transitionQaReport = report; }, report);
  return { label, screenshots: report.frames.length, errors: report.errors };
}
