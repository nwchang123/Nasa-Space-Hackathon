// Run with: npx @playwright/cli -s=model-upgrade run-code --filename scripts/model-upgrade/browser-qa.js
async (page) => {
  const out = 'output/playwright/model-upgrade';
  const report = { viewport: await page.viewportSize(), stations: [], errors: [], issues: [] };
  const onError = error => report.errors.push(String(error));
  page.on('pageerror', onError);
  const check = (ok, message) => { if (!ok) report.issues.push(message); };
  const frames = async (n = 12) => page.evaluate(n => new Promise(resolve => {
    let count = 0;
    const tick = () => ++count >= n ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), n);
  const range = async (name, value) => {
    const slider = page.getByRole('slider', { name, exact: true });
    if (Number(await slider.inputValue()) === value) {
      await slider.focus();
      await slider.press(value === Number(await slider.getAttribute('max')) ? 'ArrowLeft' : 'ArrowRight');
    }
    await slider.evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await page.waitForTimeout(2400);
    await frames();
  };
  const metrics = async () => page.evaluate(async () => {
    const { groups, live } = await import('/src/scene/registry.ts');
    const { useApp } = await import('/src/store.ts');
    let scene = groups.globe;
    while (scene?.parent) scene = scene.parent;
    const machine = scene?.getObjectByName('machine');
    const position = name => {
      const node = machine?.getObjectByName(name);
      return node ? machine.worldToLocal(node.getWorldPosition(node.position.clone())).toArray() : null;
    };
    const chute = machine?.getObjectByName('parachute');
    const overlays = [];
    scene?.traverse(o => { if (o.isMesh && o.material?.uniforms?.uDone) overlays.push(o); });
    const arm = machine?.getObjectByName('phoenix-arm');
    const rock = scene?.getObjectByName('barnacle-bill');
    const apxs = machine?.getObjectByName('sojourner-apxs-tip');
    let apxsRockGap = null;
    if (rock && apxs) {
      const tip = machine.worldToLocal(apxs.getWorldPosition(apxs.position.clone()));
      const vertices = rock.geometry.attributes.position;
      let gap = Infinity;
      for (let i = 0; i < vertices.count; i++) {
        const v = machine.worldToLocal(rock.localToWorld(tip.clone().fromBufferAttribute(vertices, i)));
        gap = Math.min(gap, tip.distanceTo(v));
      }
      apxsRockGap = gap;
    }
    const trenches = [];
    scene?.traverse(o => {
      if (o.isMesh && o.geometry.attributes.position?.count === 145 && o.geometry.attributes.color?.itemSize === 4) {
        const p = o.geometry.attributes.position;
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
        trenches.push({ min, max, visible: o.visible, drawCount: o.geometry.drawRange.count });
      }
    });
    const targets = Object.fromEntries([...live.targets].map(([k, p]) => [k, p.toArray()]));
    const modelNames = [];
    machine?.traverse(o => { if (o.name) modelNames.push(o.name); });
    return {
      site: live.shot.siteId, settled: live.shot.blend, sig: useApp.getState().sig,
      orbit: { ...live.siteOrbit }, heading: live.camHeadingDeg,
      flyer: { ...live.flyer }, focus: useApp.getState().focus, targets,
      modelNames, machinePosition: machine?.position.toArray(),
      rover: position('sojourner'), apxs: position('sojourner-apxs-tip'),
      shoulder: position('phoenix-arm'), scoop: position('phoenix-scoop'),
      armQuaternion: arm?.quaternion.toArray(),
      apxsRockGap, trenches,
      chuteVertices: chute?.geometry.attributes.position.count,
      decodeSharesPosition: overlays.some(o => o.geometry.attributes.position === chute?.geometry.attributes.position),
      decoded: overlays[0]?.material.uniforms.uDone.value,
    };
  });
  const sites = [
    { id: 'pathfinder-sojourner', route: 'Stop 3, Mars Pathfinder', title: 'Pathfinder', marker: 'sojourner-apxs-tip', label: 'Roll Sojourner down the ramp', key: 'roll', values: [0, .12, .25, .62, 1] },
    { id: 'spirit', route: 'Stop 4, Spirit', title: 'Spirit', marker: 'mer-right-front-contact', label: 'Drag my jammed wheel', key: 'drag', values: [0, .5, 1] },
    { id: 'opportunity', route: 'Stop 5, Opportunity', title: 'Opportunity', marker: 'mer-right-front-contact', label: 'Bring in the 2018 dust storm', key: 'storm', values: [1, 6, 10.8, 11] },
    { id: 'phoenix', route: 'Stop 6, Phoenix', title: 'Phoenix', marker: 'phoenix-static-05', label: 'Scoop the ice', key: 'scoop', values: [0, .12, .32, .5, .72, 1] },
    { id: 'mars2020-edl', route: 'Stop 8, Perseverance', title: 'Backshell', marker: 'backshell-finish-02', label: 'Decode my parachute', key: 'decode', values: [0, .22, .45, .67, .9, 1] },
  ];
  try {
    await page.bringToFront();
    const begin = page.getByRole('button', { name: 'Begin Flight 73', exact: true });
    if (await begin.isVisible()) await begin.click();
    for (const site of sites) {
      const initial = await metrics();
      if (initial.site !== site.id) await page.getByRole('button', { name: new RegExp(site.route) }).click();
      await page.waitForFunction(async ({ id, marker }) => {
        const { groups, live } = await import('/src/scene/registry.ts');
        let scene = groups.globe;
        while (scene?.parent) scene = scene.parent;
        return live.shot.siteId === id && live.shot.blend > .995 && !!scene?.getObjectByName(marker);
      }, { id: site.id, marker: site.marker }, { timeout: 45000 });
      await range(`Local solar time at ${site.title}`, 12);
      await page.getByRole('button', { name: 'Reset wide view', exact: true }).click();
      await page.waitForTimeout(1000);
      const entry = { id: site.id, initial: await metrics(), samples: [], orbit: [], follow: null };
      report.stations.push(entry);
      await page.screenshot({ path: `${out}/${site.id}-wide.png` });
      // Exercise an entire revolution through the real bearing control, not an internal camera hook.
      const heading = page.getByRole('slider', { name: 'Camera heading', exact: true });
      await heading.focus();
      for (let i = 0; i < 9; i++) {
        await heading.press('PageUp');
        await page.waitForTimeout(550);
        await frames(8);
        entry.orbit.push(await metrics());
        if (i === 3) await page.screenshot({ path: `${out}/${site.id}-reverse.png` });
      }
      const turn = Math.abs(entry.orbit.at(-1).orbit.az - entry.initial.orbit.az);
      check(turn > 6.2, `${site.id}: bearing control did not complete a revolution (${turn})`);
      await page.getByRole('button', { name: 'Reset wide view', exact: true }).click();
      // Read the actual label from the page; prose labels can change independently of the key.
      const inputs = page.locator('.sig input[type="range"]');
      check(await inputs.count() === 1, `${site.id}: missing or ambiguous signature slider`);
      const label = await inputs.first().getAttribute('aria-label');
      for (const value of site.values) {
        await range(label, value);
        const sample = await metrics();
        entry.samples.push({ value, ...sample });
        check(Math.abs(sample.sig[site.key] - value) < .001, `${site.id}: UI slider did not update ${site.key} to ${value}`);
      }
      await page.screenshot({ path: `${out}/${site.id}-signature.png` });
      if (site.id === 'pathfinder-sojourner') {
        const p = entry.samples[0].rover;
        check(p && Math.hypot(p[0]-.39, p[1]-.135, p[2]-.629) < .005, 'Pathfinder: rover misses ramp top');
        check(entry.samples.at(-1).rover[0] > 3.7, 'Pathfinder: Sojourner did not reach Barnacle Bill');
        check(entry.samples.at(-1).apxsRockGap < .025, 'Pathfinder: APXS does not contact Barnacle Bill');
      }
      if (site.id === 'spirit') check(Math.abs(Math.hypot(...entry.samples.at(-1).machinePosition) - .7) < .01, 'Spirit: reverse distance changed');
      if (site.id === 'phoenix') {
        const p = entry.samples[0].shoulder;
        check(p && Math.hypot(p[0]+.3, p[1]-1.06, p[2]-.6) < .002, 'Phoenix: shoulder was shifted by normalization');
        check(entry.samples.some(s => s.scoop[1] < .025), 'Phoenix: scoop never reaches the trench');
      }
      if (site.id === 'mars2020-edl') {
        const end = entry.samples.at(-1);
        check(end.chuteVertices === 2231 && end.decodeSharesPosition && end.decoded === 4, 'EDL: decode geometry or final ring changed');
      }
      await page.getByRole('button', { name: 'Reset wide view', exact: true }).click();
      await page.waitForTimeout(2500);
      const hotspot = page.getByRole('button', { name: '01 Why I came', exact: true });
      // HTML callouts follow the moving 3D camera, so activate through their real keyboard path
      // rather than waiting for Playwright's pixel-stability heuristic to stop seeing movement.
      await hotspot.focus();
      await hotspot.press('Enter');
      await page.waitForTimeout(3000);
      await frames();
      entry.follow = await metrics();
      check(entry.follow.focus?.kind === 'hotspot', `${site.id}: hotspot close-up is not selected`);
      check(entry.follow.flyer.site === site.id && entry.follow.flyer.alt > .05, `${site.id}: local companion did not take flight`);
      await page.screenshot({ path: `${out}/${site.id}-follow.png` });
      await page.getByRole('button', { name: 'Reset wide view', exact: true }).click();
    }
  } catch (error) {
    report.issues.push(String(error));
    await page.screenshot({ path: `${out}/failure.png` });
  } finally {
    page.off('pageerror', onError);
    await page.evaluate(r => { window.__modelUpgradeReport = r; }, report);
  }
  return { stations: report.stations.map(s => s.id), issues: report.issues, errors: report.errors, report: `${out}/report.json` };
}
