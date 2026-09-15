#!/usr/bin/env node
/* =====================================================================
 * smoke/smoke.mjs — headless smoke test for the single-file demo.
 *
 * Dev tooling only (not part of the product). Serves the project root
 * over a local HTTP server and drives index.html in headless Chrome:
 *
 *   M0 checks:
 *   - page boots to LOADER with the START button visible
 *   - START click -> RUNNING, loop alive, FPS > 0
 *   - double-click START does not double-init (single loop, no errors)
 *   - window resize updates renderer size + camera aspect
 *   - page reload (refresh) returns to a fresh, unstuck LOADER and
 *     START works again
 *
 *   M1 checks:
 *   - systems registry boots in fixed order
 *     (INPUT, CAMERA, KIT, WORLD, ENTITY, TRAFFIC, HUD)
 *   - no gamepad: loop stays clean, camera holds still, nothing throws
 *   - fake gamepad: left-stick forward moves the camera
 *   - keyboard: W moves forward, Space rises, Shift sprints (no throw)
 *   - wheel zoom changes FOV
 *   - V switches GROUND <-> CINE (blend lerps to target)
 *   - middle-mouse orbit moves the camera around a fixed target, then
 *     releases back into a controllable pose
 *   - shake API: impulse raises energy, energy decays to zero
 *
 *   M2 checks:
 *   - KIT registered: material library, canvas textures (LED/QWEN/
 *     UNSLOTH/glow), lighting rig (hemi + moon + 2 reserved point lights)
 *   - gate: test wall/tower (city hidden) renders at < 10 draw calls
 *   - LED canvas textures actually redraw (frame counter advances)
 *   - rendered pixels visibly change over time (animation on GPU)
 *
 *   M3 checks:
 *   - WORLD registered in the fixed system order
 *   - mulberry32 PRNG matches a known vector; per-block seeds differ
 *   - 5×5 chunk set built around the player (25 chunks, rings 1/8/16),
 *     thousands of instances, keep-set spans well beyond the fog view
 *   - chunk regeneration is byte-identical (deterministic seeds ⇒ no
 *     visible duplication / shimmer)
 *   - draw calls stay flat (within budget) after flying far out, and
 *     the old keep-set is unbuilt behind while new chunks build ahead
 *
 *   M4 checks:
 *   - near-ring (rings 0–1) chunks carry the detail pass: LED facades on
 *     multiple building sides, spinning fans, animated pulses, signs,
 *     dishes; the silhouette ring stays zero-detail (clean far layer)
 *   - detail instance matrices are byte-identical across chunk regen
 *   - fans rotate and pulses animate; per-mesh culling bounds are
 *     instance-aware (contain every instance they describe)
 *   - total draw calls stay inside budget with the detail pass on
 *
 *   M5 checks:
 *   - ENTITY registered in the fixed order after WORLD; named rig parts
 *     (pedestal, spine, torso, head, jaw, coreEye, ringA..C, armL/R,
 *     shoulderL/R, antenna1..4) exist as transform roots (M9-ready)
 *   - thousands of compute-node voxels on ONE InstancedMesh with
 *     per-instance color
 *   - dormant behaviour: slow breathing scale on the core, idle ring
 *     spin, dim coreEye pulse, static node matrices (no per-frame
 *     upload), minimal steam drip (32 pooled puffs, 4 vents)
 *   - draw calls stay inside budget with the creature in the scene
 *   - street/mid/far silhouette screenshots (shots/m5-*.png)
 *
 *   M6.1 checks (generic object pool):
 *   - POOL exposed on window.SIM; make() pre-allocates the full capacity
 *     up front (factory called exactly capacity times, once)
 *   - 10k acquire/release cycles: every acquired item is a reference
 *     captured before the cycle starts (zero `new` after init) and the
 *     JS heap stays flat across the run (no GC churn)
 *   - exhaustion returns null (cap hit, no throw, no alloc); release is
 *     idempotent (double release counted, never corrupts the stack);
 *     pool stats stay balanced (free returns to capacity)
 *
 *   M6.2 checks (maintenance drones):
 *   - TRAFFIC registered after ENTITY; one shared InstancedMesh (one draw
 *     call) for the whole fleet; state lives in the M6.1 pool
 *     ('traffic-drone', fixed capacity = HIGH tier cap)
 *   - fleet grows to the tier cap; every live drone is a pre-created pool
 *     item (zero `new` after init); JS heap stays flat with the fleet
 *     alive (no allocation per frame)
 *   - drones dock at spawn and patrol between towers (positions change,
 *     docked/patrol states both observed)
 *   - tier cap: TIER.set('low') trims the fleet to the LOW cap (excess
 *     released back to the pool); TIER.set('high') regrows it to the
 *     HIGH cap; draw calls stay inside budget with the fleet at cap
 *   - street-level screenshot with drones in the air (shots/m62-*.png)
 *
 *   M6.3 checks (sky vehicles with light trails):
 *   - vehicle pool ('traffic-vehicle', M6.1, fixed capacity = HIGH tier
 *     cap); fleet grows to the cap; every live vehicle is a pre-created
 *     pool item (zero `new` after init); JS heap flat (no per-frame alloc)
 *   - vehicles run along avenue lines at the 3 configured altitudes;
 *     all 3 altitudes occupied at once; trails = 2 additive segments
 *     per vehicle (bright head + dim tail) at the analytic positions
 *     behind the hull on the shared additive material
 *   - count never exceeds the tier cap; TIER.set('low') trims to the
 *     LOW cap (excess released to the pool); TIER.set('high') regrows
 *   - draw calls inside budget with the fleet at cap
 *   - one screenshot per altitude with the streak in frame
 *     (shots/m63-vehicles-alt{0,1,2}.png)
 *
 *   M6.4 checks (steam vents + sparks):
 *   - steam pool ('traffic-steam') + spark pool ('traffic-spark')
 *     registered with tier caps; steam field saturates the cap
 *     (fixed pool is the gate); every live puff/spark is a pre-created
 *     pool item (zero `new` after init)
 *   - analytic source match (seeded replay): every live puff sits above
 *     a cooling-tower vent, every spark above a substation
 *   - steam visibly rises (upward drift) and fades; sparks age out
 *     (brief life); no allocation per frame (heap flat)
 *   - tier cap: TIER.set('low') trims both emitters (excess released
 *     to the pools); TIER.set('high') regrows; counts never exceed caps
 *   - idle-cheap stats: 1 steam + 1 spark draw call, additive blending,
 *     Points drawRange tracks the live count
 *   - street-level screenshot showing steam + sparks at their source
 *     buildings (shots/m64-steam-sparks-street.png)
 *
 *   M6.5 checks (adaptive caps by FPS tier — integrated switch):
 *   - all four M6 fleets saturated at the HIGH caps first (drone 16,
 *     vehicle 12, steam 48, spark stream alive)
 *   - LOW caps are visibly lower than HIGH caps in config (each ≤ 1/2)
 *   - TIER.set('low') trims ALL four fleets to their LOW caps in one
 *     switch; excess items land back in the pools (inUse === live
 *     count for all four pools)
 *   - LOW caps hold while the emitters cycle (sampled)
 *   - no frame spike on switch: rAF delta windows around the LOW and
 *     HIGH switches stay within 2× the baseline max frame (100 ms floor)
 *   - TIER.set('high') restores all four fleets (regrows on spawn ticks)
 *   - heap flat across the whole LOW→HIGH switch (no allocation), draw
 *     calls inside budget at the restored HIGH caps
 *
 * Usage:
 *   cd smoke && npm install        # once (playwright-core)
 *   node smoke.mjs [url]          # url defaults to a local server on :8377
 * ===================================================================== */
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');

let failures = 0;
function check(name, cond, extra = '') {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${mark}] ${name}${extra ? ' — ' + extra : ''}`);
}

/* ------------------------------------------------------------------ *
 * Local static server (index.html + whatever else lives in the root)
 * ------------------------------------------------------------------ */
function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
      let p = path.normalize(path.join(rootDir, decodeURIComponent(url.pathname)));
      if (!p.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        p = path.join(p, 'index.html');
      }
      if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(p);
      const types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(p));
    });
    srv.on('error', reject);
    srv.listen(8377, '127.0.0.1', () => resolve(srv));
  });
}

/* ------------------------------------------------------------------ *
 * Browser
 * ------------------------------------------------------------------ */
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .find(p => fs.existsSync(p));

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader', // software WebGL in headless
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

let srv;
let url = process.argv[2];
if (!url) {
  srv = await startServer();
  url = 'http://127.0.0.1:8377/index.html';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function simState() {
  return page.evaluate(() => ({
    state: window.SIM && window.SIM.BOOT ? window.SIM.BOOT.state : 'NO_SIM',
    frames: window.SIM ? window.SIM.BOOT.frames : -1,
  }));
}

try {
  console.log(`smoke: ${url}\n`);

  /* ---- 1. Initial load: LOADER + START button ---- */
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.SIM && window.SIM.BOOT && window.SIM.BOOT.state === 'LOADER',
    { timeout: 20000 },
  );
  {
    const s = await simState();
    check('boots to LOADER without being stuck', s.state === 'LOADER', `state=${s.state}`);
  }
  const btnVisible = await page.locator('#startBtn').isVisible();
  check('START button visible', btnVisible);

  /* ---- 2. START click -> RUNNING, live loop ---- */
  await page.locator('#startBtn').click();
  // double-click safety: click again while RUNNING
  await page.locator('#startBtn').click({ force: true }).catch(() => {});
  await page.waitForFunction(() => window.SIM && window.SIM.BOOT.state === 'RUNNING', { timeout: 5000 });
  {
    const s = await simState();
    check('START leads to RUNNING', s.state === 'RUNNING');
  }
  await sleep(1500);
  {
    const a = await simState();
    await sleep(120); // let at least one rAF elapse between samples
    const b = await simState();
    check('render loop is live (frames advancing)', b.frames > a.frames && a.frames > 0,
      `frames ${a.frames} -> ${b.frames}`);
    const fps = await page.evaluate(() => window.SIM.HUD.fps);
    check('FPS counter reporting > 0', Number.isFinite(fps) && fps > 0, `fps=${Math.round(fps)}`);
  }

  /* ---- 3. Renderer sanity ---- */
  {
    const info = await page.evaluate(() => ({
      w: window.SIM.renderer.domElement.width,
      h: window.SIM.renderer.domElement.height,
      pr: window.devicePixelRatio,
      webgl: !!window.SIM.renderer.getContext(),
    }));
    check('WebGL context alive', info.webgl);
    check('canvas sized to viewport (x dpr)',
      info.w >= 1280 && info.h >= 800, `canvas=${info.w}x${info.h}`);
  }

  /* ---- 4. Resize ---- */
  await page.setViewportSize({ width: 900, height: 600 });
  await sleep(400);
  {
    const info = await page.evaluate(() => ({
      w: window.SIM.renderer.domElement.width,
      h: window.SIM.renderer.domElement.height,
      aspect: window.SIM.camera.aspect,
    }));
    const expectW = Math.round(900 * (await page.evaluate(() => Math.min(window.devicePixelRatio || 1, 2))));
    check('resize updates renderer size', Math.abs(info.w - expectW) <= 2,
      `canvas=${info.w}x${info.h}, want ~${expectW}x${Math.round(600 * 1)}`);
    check('resize updates camera aspect', Math.abs(info.aspect - 900 / 600) < 0.01, `aspect=${info.aspect}`);
    await sleep(600);
    const s = await simState();
    check('loop still live after resize', s.frames > 0, `state=${s.state}`);
  }

  /* ---- 5. Refresh: never a stuck state; re-entry safe ---- */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(
    () => window.SIM && window.SIM.BOOT.state === 'LOADER',
    { timeout: 20000 },
  );
  {
    const s = await simState();
    check('refresh returns to fresh LOADER (not stuck)', s.state === 'LOADER', `state=${s.state}`);
    check('frames reset after refresh', s.frames === 0, `frames=${s.frames}`);
    const btnVisible = await page.locator('#startBtn').isVisible();
    check('START button available after refresh', btnVisible);
  }
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => window.SIM && window.SIM.BOOT.state === 'RUNNING', { timeout: 5000 });
  await sleep(800);
  {
    const s = await simState();
    check('re-entry after refresh reaches live loop', s.state === 'RUNNING' && s.frames > 0,
      `state=${s.state}, frames=${s.frames}`);
  }

  /* ------------------------------------------------------------------
   * M1 — core loop, input, camera foundations
   * ------------------------------------------------------------------ */

  async function cam() {
    return page.evaluate(() => ({
      mode: window.SIM.CAMERA.mode,
      blend: window.SIM.CAMERA.blend,
      blendTarget: window.SIM.CAMERA.blendTarget,
      x: window.SIM.camera.position.x,
      y: window.SIM.camera.position.y,
      z: window.SIM.camera.position.z,
      fov: window.SIM.camera.fov,
      energy: window.SIM.CAMERA.shakeEnergy,
      pad: window.SIM.INPUT.pad.connected,
      pos: window.SIM.CAMERA.pos.z,
    }));
  }

  /* ---- 6a. Fixed-order systems registry (M5 adds ENTITY after WORLD) ---- */
  {
    const names = await page.evaluate(() => window.SIM.systems.map(s => s.name));
    check('systems registered in fixed order',
      JSON.stringify(names) === JSON.stringify(
        ['INPUT', 'CAMERA', 'KIT', 'WORLD', 'ENTITY', 'TRAFFIC', 'HUD']),
      names.join(', '));
  }

  /* ---- 6b. No gamepad: clean, camera holds still ---- */
  {
    const hadPad = await page.evaluate(() =>
      Array.from(navigator.getGamepads || []).some(p => p && p.connected));
    if (!hadPad) {
      const a = await cam();
      await sleep(500);
      const b = await cam();
      check('no gamepad: nothing throws, camera holds still',
        b.x === a.x && b.y === a.y && b.z === a.z && b.pos === a.pos,
        `dx=${b.x - a.x}, dy=${b.y - a.y}, dz=${b.z - a.z}`);
    } else {
      check('no gamepad: nothing throws, camera holds still', true, 'real pad present, skipped');
    }
  }

  /* ---- 6c. Fake gamepad: left stick moves the camera ---- */
  await page.evaluate(() => {
    const pad = {
      id: 'smoke-fake-pad',
      timestamp: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: new Array(17).fill(null).map(() => ({ pressed: false, touched: false, value: 0 })),
    };
    window.__smokePad = pad;
    navigator.getGamepads = () => [pad];
  });
  {
    const a = await cam();
    await page.evaluate(() => { window.__smokePad.axes[1] = -1; }); // stick up = forward
    await sleep(500);
    await page.evaluate(() => { window.__smokePad.axes[1] = 0; });
    const b = await cam();
    check('gamepad: reported connected', b.pad === true);
    check('gamepad: left stick forward moves camera',
      b.z < a.z - 1 && b.y === a.y, `dz=${(b.z - a.z).toFixed(2)}, dy=${(b.y - a.y).toFixed(3)}`);
  }
  await sleep(400); // let velocity settle before keyboard checks

  /* ---- 6d. Keyboard: W forward, Space rises, no throw ---- */
  {
    const a = await cam();
    await page.keyboard.down('w');
    await sleep(350);
    await page.keyboard.up('w');
    const b = await cam();
    check('keyboard: W moves forward', b.z < a.z - 0.5 && Math.abs(b.y - a.y) < 0.2,
      `dz=${(b.z - a.z).toFixed(2)}, dy=${(b.y - a.y).toFixed(3)}`);

    const c = await cam();
    await page.keyboard.down(' ');
    await sleep(300);
    await page.keyboard.up(' ');
    const d = await cam();
    check('keyboard: Space rises in ground mode', d.y > c.y + 0.4,
      `dy=${(d.y - c.y).toFixed(2)}`);
    await sleep(400);
  }

  /* ---- 6e. Wheel zoom: FOV follows the wheel ---- */
  {
    const a = await cam();
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -240); // scroll up = zoom in
    await sleep(200);
    const b = await cam();
    check('wheel zoom changes FOV', b.fov < a.fov - 1, `fov ${a.fov.toFixed(1)} -> ${b.fov.toFixed(1)}`);
  }

  /* ---- 6f. V toggles GROUND <-> CINE with smooth blend ---- */
  {
    const a = await cam();
    await page.keyboard.press('v');
    await sleep(800); // blend converges (modeBlendTime ~0.55 s)
    const b = await cam();
    check('V switches to CINE free-fly', b.mode === 'CINE' && b.blend === 1,
      `mode=${b.mode}, blend=${b.blend}`);
    // free-fly: W moves along the look direction (includes vertical)
    const c2 = await cam();
    await page.keyboard.down('w');
    await sleep(350);
    await page.keyboard.up('w');
    const d2 = await cam();
    check('cine: W flies along view axis', d2.z < c2.z - 0.5, `dz=${(d2.z - c2.z).toFixed(2)}`);
    await page.keyboard.press('v');
    await sleep(800);
    const e = await cam();
    check('V switches back to GROUND (blend lerps)', e.mode === 'GROUND' && e.blend === 0,
      `mode=${e.mode}, blend=${e.blend}, start=${a.mode}`);
  }

  /* ---- 6g. Middle-mouse orbit (CDP: real middle-button input) ---- */
  {
    const cdp = await page.context().newCDPSession(page);
    const mid = (type, x, y, extra = {}) =>
      cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
    const a = await cam();
    await mid('mouseMoved', 640, 400);
    // NOTE: CDP `buttons` enum has no 'middle' — omit it; `button` drives it
    await mid('mousePressed', 640, 400, { button: 'middle' });
    await sleep(150);
    for (let i = 1; i <= 5; i++) {
      await mid('mouseMoved', 640 + i * 20, 400 + i * 6);
    }
    await sleep(250);
    const b = await cam();
    const orbiting = await page.evaluate(() => !!window.SIM.CAMERA.orbit);
    check('middle-mouse: orbit owns the camera', orbiting &&
      (Math.abs(b.x - a.x) > 0.3 || Math.abs(b.z - a.z) > 0.3),
      `dx=${(b.x - a.x).toFixed(2)}, dz=${(b.z - a.z).toFixed(2)}`);
    await mid('mouseReleased', 740, 430, { button: 'middle' });
    await mid('mouseMoved', 740, 430); // sync post-release pointer state
    await sleep(250);
    const c = await cam();
    const released = await page.evaluate(() => window.SIM.CAMERA.orbit === null);
    check('middle-mouse: orbit releases back to controllable pose',
      released && c.mode === 'GROUND', `released=${released}, mode=${c.mode}`);
  }

  /* ---- 6h. Shake API ---- */
  {
    await page.evaluate(() => window.SIM.CAMERA.shake(0.8));
    await sleep(50);
    const a = await cam();
    await sleep(1200); // decay (shakeDecay 2.4 /s)
    const b = await cam();
    check('shake: impulse then decays to zero',
      a.energy > 0 && b.energy === 0, `t+0.05=${a.energy.toFixed(2)}, t+1.25=${b.energy}`);
  }

  /* ------------------------------------------------------------------
   * M2 — procedural voxel material kit
   * ------------------------------------------------------------------ */
  {
    const kit = await page.evaluate(() => ({
      hasKit: !!window.SIM.KIT,
      rig: !!(window.SIM.KIT && window.SIM.KIT.testRig),
      mats: window.SIM.KIT ? Object.keys(window.SIM.KIT.MATS).length : 0,
      builders: window.SIM.KIT ?
        [window.SIM.KIT.InstancedBox, window.SIM.KIT.InstancedCylinder,
         window.SIM.KIT.mergeGeometries, window.SIM.KIT.makeCanvasTexture]
          .every(f => typeof f === 'function') : false,
      texA: window.SIM.KIT && window.SIM.KIT.tex ? window.SIM.KIT.tex.ledA.frame : -1,
      signs: window.SIM.KIT ?
        ['ledA', 'ledB', 'signQwen', 'signUnsloth', 'glow']
          .every(k => !!(window.SIM.KIT.tex && window.SIM.KIT.tex[k])) : false,
      lights: window.SIM.KIT ?
        !!window.SIM.KIT.hemi && !!window.SIM.KIT.moon &&
        window.SIM.KIT.heroLights.length === 2 : false,
    }));
    check('KIT registered with material library + textures + lighting rig',
      kit.hasKit && kit.rig && kit.mats >= 5 && kit.builders && kit.signs && kit.lights,
      `mats=${kit.mats}`);

    // The M2 gate measures the KIT test wall/tower alone: hide the M3
    // city + M5 creature + M6 TRAFFIC meshes (drones/vehicles/trails/
    // steam/sparks) for a frame or two, read the draw-call count, show
    // it again.
    await page.evaluate(() => {
      window.SIM.WORLD.root.visible = false;
      window.SIM.ENTITY.root.visible = false;
      const T = window.SIM.TRAFFIC;
      for (const m of [T.mesh, T.vmesh, T.tmesh, T.smesh, T.spoints])
        if (m) m.visible = false;
    });
    await sleep(250);
    const c1 = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      window.SIM.WORLD.root.visible = true;
      window.SIM.ENTITY.root.visible = true;
      const T = window.SIM.TRAFFIC;
      for (const m of [T.mesh, T.vmesh, T.tmesh, T.smesh, T.spoints])
        if (m) m.visible = true;
    });
    check('M2 gate: test wall/tower (city + creature hidden) renders at < 10 draw calls',
      Number.isInteger(c1) && c1 >= 1 && c1 < 10,
      `calls=${c1}`);

    const f0 = kit.texA;
    await sleep(450);
    const f1 = await page.evaluate(() => window.SIM.KIT.tex.ledA.frame);
    check('LED faces animate (canvas textures redrawn)', f1 > f0,
      `frames ${f0} -> ${f1}`);

    const shot1 = await page.screenshot();
    await sleep(400);
    const shot2 = await page.screenshot();
    check('rendered frame visibly changes over time (animated kit)',
      !shot1.equals(shot2));
  }

  /* ------------------------------------------------------------------
   * M3 — chunked city generation (far layer)
   * ------------------------------------------------------------------ */

  /* ---- 7a. Seeded PRNG: known vector + per-block seeds differ ---- */
  {
    const prng = await page.evaluate(() => {
      const r = window.SIM.WORLD.mulberry(12345);
      return [r(), r(), r()];
    });
    check('WORLD mulberry32 matches the known PRNG vector',
      Math.abs(prng[0] - 0.9797282677609473) < 1e-9 &&
      Math.abs(prng[1] - 0.3067522644996643) < 1e-9 &&
      Math.abs(prng[2] - 0.484205421525985) < 1e-9,
      prng.map(v => v.toFixed(4)).join(', '));
    const seeds = await page.evaluate(() => {
      const w = window.SIM.WORLD;
      return [w._seedFor(3, 4), w._seedFor(3, 5), w._seedFor(4, 3)];
    });
    check('per-block seeds are distinct (no duplicated neighbours)',
      new Set(seeds).size === seeds.length, seeds.join(', '));
  }

  /* ---- 7b. City built around the player: 5×5 chunks, 3 LOD rings ---- */
  await sleep(400);
  let st = await page.evaluate(() => ({
    chunks: window.SIM.WORLD.stats.chunks,
    instances: window.SIM.WORLD.stats.instances,
    ring: window.SIM.WORLD.stats.ring.slice(),
    meters: window.SIM.WORLD.stats.meters,
    player: window.SIM.WORLD.playerKey,
  }));
  check('WORLD built a 5×5 chunk keep-set around the player',
    st.chunks === 25,
    `chunks=${st.chunks}, player=${st.player}`);
  check('LOD ring distribution is 1 dense / 8 mid / 16 silhouette',
    st.ring[0] === 1 && st.ring[1] === 8 && st.ring[2] === 16,
    `ring=${st.ring.join('/')}`);
  check('city extends far beyond initial view (keep-set >> fog view)',
    st.meters >= 1900 && st.instances > 2500,
    `meters=${st.meters}, instances=${st.instances}`);

  /* ---- 7c. Deterministic regeneration (no duplication / shimmer) ---- */
  {
    const snap = async () => page.evaluate(() => {
      const c = window.SIM.WORLD.chunks.get('1,1');
      return {
        n: c.boxA.count,
        m: Array.from(c.boxA.mesh.instanceMatrix.array),
      };
    });
    const before = await snap();
    await page.evaluate(() => window.SIM.WORLD.regen('1,1'));
    const after = await snap();
    check('chunk regeneration is byte-identical (seeded, no duplication)',
      before.n > 100 && before.n === after.n &&
      before.m.length === after.m.length &&
      before.m.every((v, i) => v === after.m[i]),
      `instances=${before.n}`);
  }

  /* ---- 7d. Draw calls flat + unbuild-behind as you fly far out ----
   * The M5 creature is hidden for this measurement: it is one static hero
   * object whose frustum culling is pose-dependent (tall ⇒ head/antennas
   * clip out at street range), not part of the city LOD flatness signal. */
  {
    await page.evaluate(() => { window.SIM.ENTITY.root.visible = false; });
    await sleep(120);                           // let one frame render w/o it
    const cNear = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      window.SIM.CAMERA.pos.set(0, 4, 1600);   // fly ~4 city radii out
    });
    await sleep(700);                           // sync: retire old, build new
    const cFar = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => { window.SIM.ENTITY.root.visible = true; });
    check('draw calls stay flat (and within budget) when flying far out',
      cFar < 150 && cFar <= cNear + 8,
      `near=${cNear}, far=${cFar}`);
    const unbuild = await page.evaluate(() => {
      const w = window.SIM.WORLD;
      return {
        player: w.playerKey,
        oldGone: !w.chunks.has('0,0'),
        ahead: w.chunks.has('0,4'),
        chunks: w.stats.chunks,
      };
    });
    check('old keep-set unbuilt behind, new chunks built ahead',
      unbuild.player === '0,4' && unbuild.oldGone && unbuild.ahead &&
      unbuild.chunks === 25,
      `player=${unbuild.player}, oldGone=${unbuild.oldGone}, ahead=${unbuild.ahead}`);
    // fly back so later checks run from the city centre
    await page.evaluate(() => { window.SIM.CAMERA.pos.set(0, 4, 18); });
    await sleep(400);
  }

  /* ---- 8. M4 — near-layer detail pass (recognizable buildings up close) ---- */
  {
    /* 8a. five pooled detail meshes per chunk; near rings full, far ring zero.
     * Settle first: 7d just flew back, the keep-set must be fully rebuilt
     * (mid-`_fill` chunk state is transient). */
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => ({
        p: window.SIM.WORLD.playerKey,
        c: window.SIM.WORLD.stats.chunks,
      }));
      if (s.p === '0,0' && s.c === 25) break;
      await sleep(100);
    }
    const detail = await page.evaluate(() => {
      const w = window.SIM.WORLD;
      const rows = [];
      for (const [k, ch] of w.chunks) {
        rows.push({
          k, ring: ch.ring,
          fan: ch.fan.count, dish: ch.dish.count, pulse: ch.pulse.count,
          sign: ch.sign.count, led: ch.ledWin.count,
        });
      }
      const sum = rows.reduce((a, r) => {
        for (const m of ['fan', 'dish', 'pulse', 'sign', 'led']) a[m] += r[m];
        return a;
      }, { fan: 0, dish: 0, pulse: 0, sign: 0, led: 0 });
      return { rows, sum };
    });
    const near = detail.rows.filter(r => r.ring < 2);
    const far = detail.rows.filter(r => r.ring === 2);
    check('M4: near-ring chunks carry the detail pass (LED facades + motion)',
      near.length === 9 &&
      near.every(r => r.led >= 40 && r.fan + r.pulse > 0),
      `near=${near.length}, led total=${detail.sum.led}`);
    check('M4: silhouette ring keeps zero detail (clean far layer)',
      far.length === 16 &&
      far.every(r => r.fan === 0 && r.dish === 0 && r.pulse === 0 &&
        r.sign === 0 && r.led === 0),
      `far=${far.length}`);
    check('M4: detail totals within per-chunk budgets (city-wide)',
      detail.sum.fan >= 100 && detail.sum.pulse >= 200 &&
      detail.sum.led >= 400 && detail.sum.sign >= 8 &&
      detail.sum.sign <= 72 && detail.sum.dish >= 4,
      `fan=${detail.sum.fan}, pulse=${detail.sum.pulse}, led=${detail.sum.led}, ` +
      `sign=${detail.sum.sign}, dish=${detail.sum.dish}`);

    /* 8b. LED facades face multiple sides — no one-wall city */
    const ledFaces = await page.evaluate(() => {
      const w = window.SIM.WORLD;
      const dirs = new Set();
      for (const ch of w.chunks.values()) {
        const a = ch.ledWin.mesh.instanceMatrix.array;
        for (let i = 0; i < ch.ledWin.count; i++) {
          const nx = a[i * 16 + 8], nz = a[i * 16 + 10];
          if (Math.abs(nz) > Math.abs(nx)) dirs.add(nz > 0 ? 'z+' : 'z-');
          else dirs.add(nx > 0 ? 'x+' : 'x-');
        }
      }
      return [...dirs];
    });
    check('M4: LED facades cover multiple building sides',
      ledFaces.length >= 3, ledFaces.join(','));

    /* 8c. per-mesh culling bounds are instance-aware (contain instances) */
    const bounds = await page.evaluate(() => {
      const w = window.SIM.WORLD;
      const ch = w.chunks.get('0,0');
      if (!ch) return 'missing chunk 0,0';
      const names = ['boxA', 'boxG', 'cyl', 'fan', 'dish', 'pulse', 'sign', 'ledWin'];
      for (let n = 0; n < names.length; n++) {
        const b = ch[names[n]];
        if (!b.count) continue;
        const bs = b.mesh.boundingSphere;
        if (!bs) return `no sphere: ${names[n]}`;
        const a = b.mesh.instanceMatrix.array;
        const sample = [...new Set([0, 1, 2, b.count - 1])].filter(
          i => i >= 0 && i < b.count);
        for (const i of sample) {
          const o = i * 16;
          const dx = a[o + 12] - bs.center.x;
          const dy = a[o + 13] - bs.center.y;
          const dz = a[o + 14] - bs.center.z;
          if (Math.hypot(dx, dy, dz) > bs.radius)
            return `outside: ${names[n]} i=${i} ` +
              `d=${Math.hypot(dx, dy, dz).toFixed(1)} r=${bs.radius.toFixed(1)}`;
        }
      }
      return 'ok';
    });
    check('M4: per-mesh culling bounds contain their instances',
      bounds === 'ok', `bounds=${bounds}`);

    /* 8d. detail matrices are deterministic across chunk regeneration */
    const ledSnap = async () => page.evaluate(() => {
      const c = window.SIM.WORLD.chunks.get('1,1');
      return {
        led: Array.from(c.ledWin.mesh.instanceMatrix.array),
        sign: Array.from(c.sign.mesh.instanceMatrix.array),
      };
    });
    const ledBefore = await ledSnap();
    await page.evaluate(() => window.SIM.WORLD.regen('1,1'));
    const ledAfter = await ledSnap();
    check('M4: detail matrices byte-identical across chunk regeneration',
      ledBefore.led.length > 16 &&
      ledBefore.led.every((v, i) => v === ledAfter.led[i]) &&
      ledBefore.sign.length === ledAfter.sign.length &&
      ledBefore.sign.every((v, i) => v === ledAfter.sign[i]),
      `led instances=${ledBefore.led.length / 16}`);

    /* 8e. fans rotate, pulses animate — the near layer is alive */
    const anim = async () => page.evaluate(() => {
      const ch = window.SIM.WORLD.chunks.get('0,0');
      return {
        fan: ch.fan.count ? ch.fan.mesh.instanceMatrix.array.slice(0, 64) : null,
        pulse: ch.pulse.mesh.instanceMatrix.array.slice(0, 64),
      };
    });
    const anim0 = await anim();
    await sleep(300);
    const anim1 = await anim();
    check('M4: fans rotate and pulses animate (near layer alive)',
      anim0.fan !== null &&
      anim0.fan.some((v, i) => v !== anim1.fan[i]) &&
      anim0.pulse.some((v, i) => v !== anim1.pulse[i]),
      `fans=${anim0.fan ? 'yes' : 'no'}`);

    /* 8f. draw-call budget with the detail pass on */
    const calls = await page.evaluate(
      () => window.SIM.renderer.info.render.calls);
    check('M4: draw calls inside budget with detail on (< 150)',
      calls < 150, `calls=${calls}`);
  }

  /* ------------------------------------------------------------------
   * M5 — ENTITY: the Qwen machine-creature (dormant)
   * ------------------------------------------------------------------ */
  {
    /* 9a. named rig parts with transform roots (M9-ready) */
    const parts = await page.evaluate(() => {
      const P = window.SIM.ENTITY.parts;
      const want = ['pedestal', 'spine', 'torso', 'head', 'jaw', 'coreEye',
        'ringA', 'ringB', 'ringC', 'armL', 'armR', 'shoulderL', 'shoulderR',
        'antenna1', 'antenna2', 'antenna3', 'antenna4'];
      return {
        state: window.SIM.ENTITY.state,
        missing: want.filter(n => !P[n]),
      };
    });
    check('M5: named rig parts present as transform roots (M9-ready)',
      parts.state === 'DORMANT' && parts.missing.length === 0,
      `state=${parts.state}, missing=${parts.missing.join(',') || 'none'}`);

    /* 9b. thousands of compute-node voxels: ONE InstancedMesh, per-instance color */
    const nInfo = await page.evaluate(() => {
      const n = window.SIM.ENTITY.nodes;
      return {
        isInstanced: n.isInstancedMesh,
        count: n.count,
        hasColor: !!n.instanceColor,
      };
    });
    check('M5: compute nodes = one InstancedMesh w/ per-instance color (thousands)',
      nInfo.isInstanced && nInfo.hasColor && nInfo.count >= 2000,
      `nodes=${nInfo.count}`);

    /* 9c. dormant behaviour: breathing + idle rings + dim eye pulse +
     *     static node matrices + minimal steam drip */
    const dorm = () => page.evaluate(() => ({
      s: window.SIM.ENTITY.core.scale.x,
      rz: window.SIM.ENTITY.parts.ringA.children[0].rotation.z,
      rzB: window.SIM.ENTITY.parts.ringB.children[0].rotation.z,
      eye: window.SIM.ENTITY.parts.coreEye.material.color.getHex(),
      nm: Array.from(window.SIM.ENTITY.nodes.instanceMatrix.array.slice(0, 128)),
      steam: Array.from(
        window.SIM.ENTITY._steam.geometry.attributes.position.array.slice(0, 12)),
    }));
    const d0 = await dorm();
    await sleep(1200);
    const d1 = await dorm();
    check('M5: dormant breathing scale on the core (slow, small)',
      Math.abs(d1.s - d0.s) > 1e-4 && d1.s > 0.98 && d1.s < 1.05,
      `scale ${d0.s.toFixed(4)} -> ${d1.s.toFixed(4)}`);
    check('M5: tensor rings spin at idle speed (A vs B counter-rotating)',
      d1.rz !== d0.rz && d1.rzB !== d0.rzB,
      `A ${((d1.rz - d0.rz) * 60 / Math.PI).toFixed(1)}/min, B ${((d1.rzB - d0.rzB) * 60 / Math.PI).toFixed(1)}/min`);
    check('M5: coreEye dim pulse animates (faint heartbeat of the core)',
      d1.eye !== d0.eye, `0x${d0.eye.toString(16)} -> 0x${d1.eye.toString(16)}`);
    check('M5: compute-node matrices static while dormant (no per-frame upload)',
      d1.nm.every((v, i) => v === d0.nm[i]));
    check('M5: steam drip animates (32 pooled puffs, 4 vents, minimal)',
      d1.steam.some((v, i) => v !== d0.steam[i]));

    /* 9d. draw-call budget with the creature in the scene */
    const calls = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    check('M5: draw calls inside budget with the creature (< 150)',
      calls < 150, `calls=${calls}`);

    /* 9e. street / mid / far silhouette screenshots (visual gate) */
    const shot = async (name, x, y, z, yaw, pitch) => {
      await page.evaluate(([x, y, z, yaw, pitch]) => {
        const S = window.SIM;
        S.CAMERA.pos.set(x, y, z);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = yaw;
        S.CAMERA.pitch = pitch;
      }, [x, y, z, yaw, pitch]);
      await sleep(450);
      await page.screenshot({ path: `${here}/shots/${name}.png` });
    };
    // street (dwarfed-up view of the giant) + full silhouette at ~90 m,
    // mid ~180 m, far ~250 m (fog limit: beyond that the void takes over)
    await shot('m5-street-close', 45, 1.7, 10, 1.35, 0.55);
    await shot('m5-street-full', 72, 1.7, 55, 0.92, 0.30);
    await shot('m5-mid', 120, 50, 120, 0.785, -0.14);
    await shot('m5-far', 170, 90, 170, 0.785, -0.26);
    check('M5: street/mid/far silhouette screenshots written (see shots/m5-*.png)',
      ['m5-street-close.png', 'm5-street-full.png', 'm5-mid.png', 'm5-far.png']
        .every(f => fs.existsSync(`${here}/shots/${f}`)));
    // reset to the spawn pose for the remaining checks
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(0, 4, 18);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = 0;
      S.CAMERA.pitch = 0;
    });
    await sleep(250);
  }

  /* ------------------------------------------------------------------
   * M6.1 — generic object-pool foundation
   * ------------------------------------------------------------------ */
  {
    const m61 = await page.evaluate(() => {
      const P = window.SIM.POOL;
      const out = { ok: false };
      if (!P || typeof P.make !== 'function') return out;

      const CAP = 64;
      let factoryCalls = 0;
      const pool = P.make('m61-test', CAP, i => {
        factoryCalls++;
        return { v: i };
      });
      out.ok = true;
      out.factoryCalls = factoryCalls;
      out.initFree = pool.top;

      // Identity set: every item the pool will EVER hand out was created
      // by make() — anything else would prove a `new` after init.
      const initial = new Set(pool.stack);
      const acquired = new Set();

      // 10k acquire/release cycles in one synchronous block; the heap
      // samples bracket only that block, so the delta measures churn
      // from the pool itself (GC may still reclaim other garbage, so
      // only growth is a failure).
      const mem = () => performance.memory ? performance.memory.usedJSHeapSize : -1;
      const heapBefore = mem();
      let nulls = 0;
      for (let c = 0; c < 10000; c++) {
        const items = [];
        const burst = 1 + (c % 7);            // bursty 1..7 live items
        for (let i = 0; i < burst; i++) {
          const it = pool.acquire();
          if (it === null) { nulls++; break; }
          it.v = c;                           // re-init on acquire, in place
          acquired.add(it);
          items.push(it);
        }
        for (let i = items.length - 1; i >= 0; i--) pool.release(items[i]);
      }
      const heapAfter = mem();
      out.nulls = nulls;
      out.heapDelta = heapAfter - heapBefore;
      out.heapBefore = heapBefore; // must be > 0 (perf.memory present)
      out.zeroNew = [...acquired].every(it => initial.has(it));
      out.acquiredKinds = acquired.size;
      out.freeBackToFull = pool.top === CAP;
      out.balanced = pool.acquires === pool.releases && pool.exhausted === 0;
      out.stats = { acquires: pool.acquires, releases: pool.releases,
        peak: pool.peak, exhausted: pool.exhausted };

      // Exhaustion: drain the pool — the (CAP+1)th acquire must be null
      const drained = [];
      while (true) {
        const it = pool.acquire();
        if (it === null) break;
        drained.push(it);
      }
      out.drainFull = drained.length === CAP;
      out.drainNull = pool.exhausted === 1;
      for (let i = drained.length - 1; i >= 0; i--) pool.release(drained[i]);

      // Double release: idempotent, counted, stack never duplicated
      const a0 = pool.acquires, r0 = pool.releases;
      const it0 = pool.acquire();
      pool.release(it0);
      pool.release(it0);          // second release must be a no-op
      pool.release({ __free: false });  // foreign object — also no-op
      out.doubleReleaseSafe =
        pool.badReleases === 2 && pool.top === CAP &&
        pool.acquires === a0 + 1 && pool.releases === r0 + 1;

      // Pool registry: smoke pool registered, aggregate stats sane.
      // inUse must equal the sum over ALL registered pools — M6.2's
      // drone pool is legitimately in flight while this runs.
      out.inList = P.list.some(p => p === pool);
      const agg = P.stats();
      out.aggSane =
        agg.pools === P.list.length &&
        agg.capacity === P.list.reduce((a, p) => a + p.capacity, 0) &&
        agg.inUse === P.list.reduce((a, p) => a + (p.capacity - p.top), 0) &&
        pool.top === CAP && agg.peak >= CAP;
      out.agg = agg;
      return out;
    });

    check('M6.1: POOL.make pre-allocates the full capacity once at init',
      m61.ok && m61.factoryCalls === 64 && m61.initFree === 64,
      `factory calls=${m61.factoryCalls}, free=${m61.initFree}`);
    check('M6.1: 10k acquire/release cycles — zero `new` after init',
      m61.zeroNew === true && m61.nulls === 0,
      `distinct items handed out=${m61.acquiredKinds}, nulls=${m61.nulls}`);
    check('M6.1: 10k cycles — JS heap flat (no GC churn)',
      m61.heapBefore > 0 &&
      Number.isFinite(m61.heapDelta) && m61.heapDelta <= 64 * 1024,
      `before=${Math.round(m61.heapBefore / 1024)}KB, ` +
      `delta=${m61.heapDelta} bytes`);
    check('M6.1: stats balanced, pool returns to full after the run',
      m61.freeBackToFull && m61.balanced,
      JSON.stringify(m61.stats));
    check('M6.1: exhaustion returns null (cap hit, no throw, no alloc)',
      m61.drainFull && m61.drainNull,
      `drained=${m61.drainFull}, exhausted=${m61.drainNull}`);
    check('M6.1: release is idempotent (double/foreign releases are no-ops)',
      m61.doubleReleaseSafe,
      `badReleases guarded`);
    check('M6.1: pools register in POOL.list with sane aggregate stats',
      m61.inList && m61.aggSane, `agg=${JSON.stringify(m61.agg)}`);
  }

  /* ------------------------------------------------------------------
   * M6.2 — maintenance drones (TRAFFIC)
   * ------------------------------------------------------------------ */
  {
    const cap = await page.evaluate(() => {
      const S = window.SIM;
      return (S.TRAFFIC && S.CFG.traffic.drone.tiers[S.TIER.active()]) || 0;
    });
    check('M6.2: TRAFFIC registered with a drone pool (M6.1) + tier cap',
      cap > 0,
      `tier=${await page.evaluate(() => window.SIM.TIER.active())}, cap=${cap}`);

    /* fleet grows to the tier cap — spawns are gated by the fixed pool */
    await page.waitForFunction(c => {
      const S = window.SIM;
      return S.TRAFFIC && S.TRAFFIC.count === c;
    }, cap, { timeout: 120000 });
    const a0 = await page.evaluate(async () => {
      const S = window.SIM;
      const T = S.TRAFFIC;
      const pool = S.POOL.list.find(p => p.name === 'traffic-drone');
      const live = T._live.slice(0, T.count);
      /* keep the item refs alive for the movement sample below */
      window.__m62 = {
        snaps: live.map(it => ({ ref: it, x: it.px, y: it.py, z: it.pz })),
      };
      /* min of 3 spaced samples — GC noise, not per-frame alloc, is the
       * thing under test (the pool pre-allocates; nothing here may grow) */
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      const heapBefore = await heapMin();
      return {
        count: T.count,
        heapBefore,
        poolCap: pool ? pool.capacity : -1,
        inUse: pool ? pool.capacity - pool.top : -1,
        /* identity proof of "zero `new` after init": every live item
         * carries the back-ref the pool's factory stamped at make() */
        zeroNew: !!pool && live.every(it =>
          it.__pool === pool && it.__free === false),
        docked: live.filter(it => it.state === 0).length,
        airborne: live.filter(it => it.state > 0).length,
        wpRouted: live.filter(it => it.wpCount > 0).length,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M6.2: fleet grows to the tier cap (one InstancedMesh, M6.1 pool)',
      a0.count === cap && a0.poolCap === cap && a0.inUse === a0.count,
      `count=${a0.count}, poolCap=${a0.poolCap}, inUse=${a0.inUse}`);
    check('M6.2: every live drone is a pre-created pool item (zero `new` after init)',
      a0.zeroNew === true, `live=${a0.count}`);
    check('M6.2: drones dock at towers and patrol between them',
      a0.docked > 0 && a0.airborne > 0 && a0.wpRouted > 0,
      `docked=${a0.docked}, airborne=${a0.airborne}, routed=${a0.wpRouted}`);

    /* patrol movement + no per-frame allocation across a live-fleet window */
    await sleep(2500);
    const a1 = await page.evaluate(async () => {
      const T = window.SIM.TRAFFIC;
      let moved = 0, releasedGone = 0;
      const liveSet = T._live.slice(0, T.count);
      for (const s of window.__m62.snaps) {
        if (!liveSet.includes(s.ref)) { releasedGone++; continue; }
        const dx = s.ref.px - s.x, dy = s.ref.py - s.y, dz = s.ref.pz - s.z;
        if (dx * dx + dy * dy + dz * dz > 0.25) moved++;
      }
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      return {
        moved,
        releasedGone,
        dockedNow: liveSet.filter(it => it.state === 0).length,
        inFlightNow: liveSet.filter(it => it.state > 0).length,
        heap: await heapMin(),
      };
    });
    check('M6.2: drones visibly fly — positions change / state cycles',
      a1.moved > 0 || (a1.dockedNow > 0 && a1.inFlightNow > 0),
      `moved=${a1.moved}, docked=${a1.dockedNow}, inFlight=${a1.inFlightNow},` +
      ` released=${a1.releasedGone}`);
    check('M6.2: no allocation per frame (heap flat with the fleet alive)',
      a0.heapBefore > 0 && a1.heap > 0 && a1.heap - a0.heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(a0.heapBefore / 1024)}KB, after=${Math.round(a1.heap / 1024)}KB`);

    /* tier cap: LOW trims the fleet, HIGH regrows it */
    const lowCap = await page.evaluate(() => window.SIM.CFG.traffic.drone.tiers.low);
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(c => window.SIM.TRAFFIC.count <= c, lowCap,
      { timeout: 5000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM;
      const pool = S.POOL.list.find(p => p.name === 'traffic-drone');
      return { count: S.TRAFFIC.count, inUse: pool.capacity - pool.top };
    });
    check('M6.2: LOW tier trims the fleet to its cap (excess released to the pool)',
      tLow.count <= lowCap && tLow.inUse === tLow.count,
      `count=${tLow.count}, cap=${lowCap}, pool inUse=${tLow.inUse}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(c => window.SIM.TRAFFIC.count === c, cap,
      { timeout: 120000 });
    check('M6.2: HIGH tier restores the full fleet (regrows on spawn ticks)',
      (await page.evaluate(() => window.SIM.TRAFFIC.count)) === cap,
      `count restored to ${cap}`);

    /* draw-call budget with the fleet at cap */
    const calls = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    check('M6.2: draw calls inside budget with the fleet at cap',
      calls > 0 && calls < 150, `calls=${calls}`);

    /* visual gate: street-level screenshot that actually SHOWS the drone.
     * The dense core would otherwise hide the target tower, so pick the
     * first candidate (docked drones first, then nearest) whose line of
     * sight from the street pose (30 m out on the same bearing as the
     * drone) is provably clear against the instanced building boxes. */
    const d = await page.evaluate(() => {
      const S = window.SIM, T = S.TRAFFIC;
      const cands = [];
      for (let i = 0; i < T.count; i++) {
        const it = T._live[i];
        const dist = Math.hypot(it.px, it.pz);
        if (dist < 24 || dist > 220) continue;
        if (it.py < 10 || it.py > 55) continue;
        cands.push({ px: it.px, py: it.py, pz: it.pz, docked: it.state === 0 });
      }
      cands.sort((a, b) =>
        (b.docked - a.docked) ||
        (Math.hypot(a.px, a.pz) - Math.hypot(b.px, b.pz)));
      /* instanced building boxes: unit-base geometry, so the full box is
       * scale·center read straight from the instance matrix (planning-
       * time only — small allocations are fine here) */
      const boxes = [];
      for (const ch of S.WORLD.chunks.values()) {
        if (!ch.group || !ch.group.visible) continue;
        for (const b of [ch.boxA, ch.boxG, ch.cyl, ch.ledWin])
          if (b && b.count > 0) boxes.push(b);
      }
      const inv = T._m.clone();
      const la = T._p.clone();
      function segHits(arr, o, ax, ay, az, bx, by, bz) {
        inv.fromArray(arr, o);
        inv.invert();
        const p = la.set(ax, ay, az).applyMatrix4(inv);
        const px = p.x, py = p.y, pz = p.z;
        const q = la.set(bx, by, bz).applyMatrix4(inv);
        const pp = [px, py, pz], qq = [q.x, q.y, q.z];
        let t0 = 0, t1 = 1;
        for (let k = 0; k < 3; k++) {
          const dK = qq[k] - pp[k];
          if (Math.abs(dK) < 1e-9) {
            if (pp[k] < -0.5 || pp[k] > 0.5) return false;
          } else {
            let te = (-0.5 - pp[k]) / dK, tx = (0.5 - pp[k]) / dK;
            if (te > tx) { const tm = te; te = tx; tx = tm; }
            if (t0 < te) t0 = te;
            if (t1 > tx) t1 = tx;
            if (t0 > t1) return false;
          }
        }
        return true;
      }
      function occluded(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const l2 = dx * dx + dy * dy + dz * dz;
        for (const b of boxes) {
          const arr = b.mesh.instanceMatrix.array;
          for (let i = 0; i < b.count; i++) {
            const o = i * 16;
            const cx = arr[o + 12], cy = arr[o + 13], cz = arr[o + 14];
            const sx = Math.abs(arr[o]) + Math.abs(arr[o + 1]) + Math.abs(arr[o + 2]);
            const sy = Math.abs(arr[o + 4]) + Math.abs(arr[o + 5]) + Math.abs(arr[o + 6]);
            const sz = Math.abs(arr[o + 8]) + Math.abs(arr[o + 9]) + Math.abs(arr[o + 10]);
            const tt = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2;
            if (tt < 0 || tt > 1) continue;
            const px = ax + dx * tt, py = ay + dy * tt, pz = az + dz * tt;
            const ex = Math.max(sx, sy, sz) * 0.5 + 1;
            const ex2 = cx - px, ey = cy - py, ez = cz - pz;
            if (ex2 * ex2 + ey * ey + ez * ez > ex * ex) continue;
            if (segHits(arr, o, ax, ay, az, bx, by, bz)) return true;
          }
        }
        return false;
      }
      for (const c of cands) {
        const dist = Math.hypot(c.px, c.pz);
        /* street point 30 m further out on the same bearing */
        const x = c.px - (c.px / dist) * 30;
        const z = c.pz - (c.pz / dist) * 30;
        if (occluded(x, 1.7, z, c.px, c.py, c.pz)) continue;
        const dx = c.px - x, dz = c.pz - z;
        return { px: c.px, py: c.py, pz: c.pz, x, z,
          yaw: Math.atan2(-dx, -dz),
          pitch: Math.atan2(c.py - 1.7, Math.hypot(dx, dz)) };
      }
      return null;
    });
    let shotOk = false;
    if (d) {
      await page.evaluate(({ x, z, yaw, pitch }) => {
        const S = window.SIM;
        S.CAMERA.pos.set(x, 1.7, z);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = yaw;
        S.CAMERA.pitch = pitch;
      }, d);
      await sleep(450);
      await page.screenshot({ path: `${here}/shots/m62-drones-street.png` });
      shotOk = fs.existsSync(`${here}/shots/m62-drones-street.png`);
      /* reset to the spawn pose for the remaining checks */
      await page.evaluate(() => {
        const S = window.SIM;
        S.CAMERA.pos.set(0, 4, 18);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = 0;
        S.CAMERA.pitch = 0;
      });
      await sleep(250);
    }
    check('M6.2: street-level screenshot with drones written (shots/m62-drones-street.png)',
      shotOk, `target drone=${d ? `(${d.px.toFixed(0)}, ${d.py.toFixed(0)}, ${d.pz.toFixed(0)})` : 'none in frame'}`);
  }

  /* ------------------------------------------------------------------
   * M6.3 — sky vehicles with light trails (TRAFFIC)
   * ------------------------------------------------------------------ */
  {
    const vcap = await page.evaluate(() => {
      const S = window.SIM;
      return (S.TRAFFIC && S.TRAFFIC.vmesh &&
        S.CFG.traffic.vehicle.tiers[S.TIER.active()]) || 0;
    });
    check('M6.3: sky vehicles registered with a pool (M6.1) + tier cap',
      vcap > 0,
      `tier=${await page.evaluate(() => window.SIM.TIER.active())}, cap=${vcap}`);

    /* fleet grows to the tier cap — spawns are gated by the fixed pool */
    await page.waitForFunction(c => {
      const S = window.SIM;
      return S.TRAFFIC && S.TRAFFIC.vcount === c;
    }, vcap, { timeout: 120000 });

    /* all 3 ring-road altitudes occupied at once (random lane picks ⇒
     * wait for the simultaneous state; each vehicle flies ~18 s, so
     * this resolves quickly) */
    const alts = await page.evaluate(() => window.SIM.CFG.traffic.vehicle.altitudes);
    await page.waitForFunction(n => {
      const S = window.SIM;
      const seen = new Set();
      for (let i = 0; i < S.TRAFFIC.vcount; i++) seen.add(S.TRAFFIC._vLive[i].alt);
      return seen.size === n;
    }, 3, { timeout: 60000 });

    const b0 = await page.evaluate(async () => {
      const S = window.SIM;
      const T = S.TRAFFIC;
      const v = S.CFG.traffic.vehicle;
      const pool = S.POOL.list.find(p => p.name === 'traffic-vehicle');
      const live = T._vLive.slice(0, T.vcount);
      window.__m63 = {
        snaps: live.map(it => ({ ref: it, x: it.px, y: it.py, z: it.pz })),
      };
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      const heapBefore = await heapMin();
      /* analytic trail check: both streak segments sit behind the hull
       * on the avenue line, half-length L/2, at the hull altitude —
       * read from the instance matrices themselves (both meshes are
       * written in the same update() tick, so they are consistent)
       * with the hull position taken from the hull matrix. */
      const varr = T.vmesh.instanceMatrix.array;
      const tarr = T.tmesh.instanceMatrix.array;
      let trailOk = true;
      for (let i = 0; i < T.vcount; i++) {
        const it = T._vLive[i];
        const L = it.trailLen, W = v.trailW;
        const vx = varr[i * 16 + 12], vy = varr[i * 16 + 13], vz = varr[i * 16 + 14];
        const hx = vx - (it.axis === 0 ? 0 : it.dir * L * 0.25);
        const hz = vz - (it.axis === 0 ? it.dir * L * 0.25 : 0);
        const tx = vx - (it.axis === 0 ? 0 : it.dir * L * 0.75);
        const tz = vz - (it.axis === 0 ? it.dir * L * 0.75 : 0);
        /* head streak = slot i*2, tail streak = slot i*2+1 */
        const ho = i * 2 * 16, to = ho + 16;
        const len = it.axis === 0 ? tarr[ho + 10] : tarr[ho];
        const wid = it.axis === 0 ? tarr[ho] : tarr[ho + 10];
        const ok =
          Math.abs(len - L / 2) < 1e-3 && Math.abs(wid - W) < 1e-3 &&
          Math.abs(tarr[ho + 12] - hx) < 1e-3 &&
          Math.abs(tarr[ho + 13] - vy) < 1e-3 &&
          Math.abs(tarr[ho + 14] - hz) < 1e-3 &&
          Math.abs(tarr[to + 12] - tx) < 1e-3 &&
          Math.abs(tarr[to + 13] - vy) < 1e-3 &&
          Math.abs(tarr[to + 14] - tz) < 1e-3;
        if (!ok) { trailOk = false; break; }
      }
      return {
        count: T.vcount,
        heapBefore,
        poolCap: pool ? pool.capacity : -1,
        inUse: pool ? pool.capacity - pool.top : -1,
        zeroNew: !!pool && live.every(it =>
          it.__pool === pool && it.__free === false),
        altOccupied: [...new Set(live.map(it => it.alt))].length,
        tmeshCount: T.tmesh.count,
        trailOk,
        additive: T.tmesh.material.blending === 2, /* THREE.AdditiveBlending */
        calls: S.renderer.info.render.calls,
      };
    });
    check('M6.3: fleet grows to the tier cap (one hull + one trail InstancedMesh)',
      b0.count === vcap && b0.poolCap === vcap && b0.inUse === b0.count &&
      b0.tmeshCount === b0.count * 2,
      `count=${b0.count}, poolCap=${b0.poolCap}, inUse=${b0.inUse}, trails=${b0.tmeshCount}`);
    check('M6.3: every live vehicle is a pre-created pool item (zero `new` after init)',
      b0.zeroNew === true, `live=${b0.count}`);
    check('M6.3: all 3 ring-road altitudes occupied at once',
      b0.altOccupied === 3,
      `altitudes=${JSON.stringify(alts)}`);
    check('M6.3: light trails = fading additive streaks behind each hull',
      b0.trailOk && b0.additive === true,
      'head 0..L/2 + tail L/2..L behind hull, shared additive material');

    /* movement + no per-frame allocation across a live-fleet window */
    await sleep(2500);
    const b1 = await page.evaluate(async () => {
      const T = window.SIM.TRAFFIC;
      let moved = 0, releasedGone = 0;
      const liveSet = T._vLive.slice(0, T.vcount);
      for (const s of window.__m63.snaps) {
        if (!liveSet.includes(s.ref)) { releasedGone++; continue; }
        const dx = s.ref.px - s.x, dy = s.ref.py - s.y, dz = s.ref.pz - s.z;
        if (dx * dx + dy * dy + dz * dz > 1) moved++;
      }
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      return { moved, releasedGone, heap: await heapMin() };
    });
    check('M6.3: vehicles visibly fly along the ring roads',
      b1.moved > 0, `moved=${b1.moved}, released=${b1.releasedGone}`);
    check('M6.3: no allocation per frame (heap flat with the fleet alive)',
      b0.heapBefore > 0 && b1.heap > 0 && b1.heap - b0.heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(b0.heapBefore / 1024)}KB, after=${Math.round(b1.heap / 1024)}KB`);

    /* count never exceeds the tier cap (sampled while the fleet cycles) */
    const capHold = await page.evaluate(async () => {
      const S = window.SIM;
      const cap = S.CFG.traffic.vehicle.tiers[S.TIER.active()];
      for (let i = 0; i < 10; i++) {
        if (S.TRAFFIC.vcount > cap) return false;
        await new Promise(r => setTimeout(r, 150));
      }
      return true;
    });
    check('M6.3: count never exceeds the tier cap', capHold === true,
      `cap=${await page.evaluate(() => window.SIM.CFG.traffic.vehicle.tiers.high)}`);

    /* tier cap: LOW trims the fleet, HIGH regrows it */
    const lowCap = await page.evaluate(() => window.SIM.CFG.traffic.vehicle.tiers.low);
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(c => window.SIM.TRAFFIC.vcount <= c, lowCap,
      { timeout: 5000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM;
      const pool = S.POOL.list.find(p => p.name === 'traffic-vehicle');
      return { count: S.TRAFFIC.vcount, inUse: pool.capacity - pool.top };
    });
    check('M6.3: LOW tier trims the fleet to its cap (excess released to the pool)',
      tLow.count <= lowCap && tLow.inUse === tLow.count,
      `count=${tLow.count}, cap=${lowCap}, pool inUse=${tLow.inUse}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(c => window.SIM.TRAFFIC.vcount === c, vcap,
      { timeout: 120000 });
    check('M6.3: HIGH tier restores the full fleet (regrows on spawn ticks)',
      (await page.evaluate(() => window.SIM.TRAFFIC.vcount)) === vcap,
      `count restored to ${vcap}`);

    /* draw-call budget with the fleet at cap */
    const calls = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    check('M6.3: draw calls inside budget with the fleet at cap',
      calls > 0 && calls < 150, `calls=${calls}`);

    /* visual gate: one screenshot per altitude with the streak in
     * frame. The camera stands 150 m further out on the plaza→vehicle
     * bearing and aims at the streak midpoint; analytic line-of-sight
     * against the instanced building boxes (same test as M6.2) rejects
     * occluded candidates. */
    const shotOk = [false, false, false];
    for (let a = 0; a < 3; a++) {
      /* retry until a vehicle at this altitude is inside the 60–260 m
       * ring with a clear line of sight (the fleet keeps cycling) */
      let d = null;
      for (let tries = 0; tries < 40 && !d; tries++) {
        d = await page.evaluate((alt) => {
        const S = window.SIM, T = S.TRAFFIC;
        const cands = [];
        for (let i = 0; i < T.vcount; i++) {
          const it = T._vLive[i];
          if (it.alt !== alt) continue;
          const dist = Math.hypot(it.px, it.pz);
          if (dist < 60 || dist > 260) continue;
          cands.push({ px: it.px, py: it.py, pz: it.pz,
            dir: it.dir, axis: it.axis, len: it.trailLen });
        }
        cands.sort((A, B) => (Math.hypot(A.px, A.pz) - Math.hypot(B.px, B.pz)));
        const boxes = [];
        for (const ch of S.WORLD.chunks.values()) {
          if (!ch.group || !ch.group.visible) continue;
          for (const b of [ch.boxA, ch.boxG, ch.cyl, ch.ledWin])
            if (b && b.count > 0) boxes.push(b);
        }
        /* scratch clones of the app's own matrices (THREE is module-
         * scoped, not on window — same trick as the M6.2 section) */
        const inv = T._vm.clone();
        const la = T._vp.clone();
        function segHits(arr, o, ax, ay, az, bx, by, bz) {
          inv.fromArray(arr, o);
          inv.invert();
          const p = la.set(ax, ay, az).applyMatrix4(inv);
          const px = p.x, py = p.y, pz = p.z;
          const q = la.set(bx, by, bz).applyMatrix4(inv);
          const pp = [px, py, pz], qq = [q.x, q.y, q.z];
          let t0 = 0, t1 = 1;
          for (let k = 0; k < 3; k++) {
            const dK = qq[k] - pp[k];
            if (Math.abs(dK) < 1e-9) {
              if (pp[k] < -0.5 || pp[k] > 0.5) return false;
            } else {
              let te = (-0.5 - pp[k]) / dK, tx = (0.5 - pp[k]) / dK;
              if (te > tx) { const tm = te; te = tx; tx = tm; }
              if (t0 < te) t0 = te;
              if (t1 > tx) t1 = tx;
              if (t0 > t1) return false;
            }
          }
          return true;
        }
        function occluded(ax, ay, az, bx, by, bz) {
          const dx = bx - ax, dy = by - ay, dz = bz - az;
          const l2 = dx * dx + dy * dy + dz * dz;
          for (const b of boxes) {
            const arr = b.mesh.instanceMatrix.array;
            for (let i = 0; i < b.count; i++) {
              const o = i * 16;
              const cx = arr[o + 12], cy = arr[o + 13], cz = arr[o + 14];
              const sx = Math.abs(arr[o]) + Math.abs(arr[o + 1]) + Math.abs(arr[o + 2]);
              const sy = Math.abs(arr[o + 4]) + Math.abs(arr[o + 5]) + Math.abs(arr[o + 6]);
              const sz = Math.abs(arr[o + 8]) + Math.abs(arr[o + 9]) + Math.abs(arr[o + 10]);
              const tt = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2;
              if (tt < 0 || tt > 1) continue;
              const px = ax + dx * tt, py = ay + dy * tt, pz = az + dz * tt;
              const ex = Math.max(sx, sy, sz) * 0.5 + 1;
              const ex2 = cx - px, ey = cy - py, ez = cz - pz;
              if (ex2 * ex2 + ey * ey + ez * ez > ex * ex) continue;
              if (segHits(arr, o, ax, ay, az, bx, by, bz)) return true;
            }
          }
          return false;
        }
        for (const c of cands) {
          const dist = Math.hypot(c.px, c.pz);
          const ux = c.px / dist, uz = c.pz / dist;
          /* side-on view: the streak runs along the avenue line while the
           * camera sits on the radial bearing, so the streak's apparent
           * length is sin(angle); reject near end-on candidates (blob,
           * not a readable trail) */
          if (Math.abs(c.axis === 0 ? uz : ux) > 0.5) continue;
          const camX = c.px + ux * 150, camZ = c.pz + uz * 150;
          const midX = c.px - (c.axis === 0 ? 0 : c.dir * c.len * 0.5);
          const midZ = c.pz - (c.axis === 0 ? c.dir * c.len * 0.5 : 0);
          if (occluded(camX, 2, camZ, c.px, c.py, c.pz)) continue;
          if (occluded(camX, 2, camZ, midX, c.py, midZ)) continue;
          const dx = midX - camX, dy = c.py - 2, dz = midZ - camZ;
          return { px: c.px, py: c.py, pz: c.pz, x: camX, z: camZ,
            yaw: Math.atan2(-dx, -dz),
            pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
        }
        return null;
        }, alts[a]);
        if (!d) await sleep(500);
      }
      if (d) {
        await page.evaluate(({ x, z, yaw, pitch }) => {
          const S = window.SIM;
          S.CAMERA.pos.set(x, 2, z);
          S.CAMERA.vel.set(0, 0, 0);
          S.CAMERA.yaw = yaw;
          S.CAMERA.pitch = pitch;
        }, d);
        await sleep(300);
        await page.screenshot({ path: `${here}/shots/m63-vehicles-alt${a}.png` });
        shotOk[a] = fs.existsSync(`${here}/shots/m63-vehicles-alt${a}.png`);
        /* reset to the spawn pose for the remaining checks */
        await page.evaluate(() => {
          const S = window.SIM;
          S.CAMERA.pos.set(0, 4, 18);
          S.CAMERA.vel.set(0, 0, 0);
          S.CAMERA.yaw = 0;
          S.CAMERA.pitch = 0;
        });
        await sleep(250);
      }
    }
    check('M6.3: streak screenshots at all 3 altitudes (shots/m63-vehicles-alt{0,1,2}.png)',
      shotOk.every(Boolean),
      `alt0=${shotOk[0]}, alt1=${shotOk[1]}, alt2=${shotOk[2]}`);
  }

  /* ------------------------------------------------------------------
   * M6.4 — steam vents (cooling towers) + sparks (substations)
   * ------------------------------------------------------------------ */
  {
    /* reset to the spawn pose: the analytic vent/sub replay below must
     * use the same player-relative chunk rings the emitters used at
     * spawn time */
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(0, 4, 18);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = 0;
      S.CAMERA.pitch = 0;
    });

    const caps = await page.evaluate(() => {
      const S = window.SIM;
      const T = S.TRAFFIC;
      const sPool = S.POOL.list.find(p => p.name === 'traffic-steam');
      const pPool = S.POOL.list.find(p => p.name === 'traffic-spark');
      return {
        sCap: (T.smesh && sPool) ? sPool.capacity : 0,
        pCap: (T.spoints && pPool) ? pPool.capacity : 0,
        sTier: S.CFG.traffic.steam.tiers[S.TIER.active()],
        pTier: S.CFG.traffic.spark.tiers[S.TIER.active()],
      };
    });
    check('M6.4: steam + spark emitters registered with pools (M6.1) + tier caps',
      caps.sCap > 0 && caps.pCap > 0 &&
      caps.sCap === caps.sTier && caps.pCap === caps.pTier,
      `steam=${caps.sCap}, spark=${caps.pCap},`
      + ` tier=${await page.evaluate(() => window.SIM.TIER.active())}`);

    /* steam field saturates the cap (spawn rate × life > cap ⇒ the
     * fixed pool is the gate); sparks hover at a small steady state */
    await page.waitForFunction(c => window.SIM.TRAFFIC.scount === c,
      caps.sCap, { timeout: 120000 });
    await page.waitForFunction(c => window.SIM.TRAFFIC.pcount >= c, 3,
      { timeout: 30000 });

    const s0 = await page.evaluate(async () => {
      const S = window.SIM;
      const T = S.TRAFFIC;
      const sPool = S.POOL.list.find(p => p.name === 'traffic-steam');
      const pPool = S.POOL.list.find(p => p.name === 'traffic-spark');
      const sLive = T._sLive.slice(0, T.scount);
      const pLive = T._pLive.slice(0, T.pcount);
      /* keep the item refs alive for the drift/age samples below */
      window.__m64 = {
        sSnaps: sLive.map(it => ({ ref: it, y: it.py, age: it.age })),
        pSnaps: pLive.map(it => ({ ref: it, age: it.age })),
      };
      /* analytic source match: replay the seeded block seeds (the same
       * path the emitters' _findSource uses) and prove every live puff
       * sits above a cooling-tower vent and every spark above a
       * substation */
      const B = S.WORLD.BLOCK, K = S.WORLD.CHUNK;
      function ringFor(bx, bz) {
        const pcx = Math.floor(Math.floor(S.CAMERA.pos.x / B) / K);
        const pcz = Math.floor(Math.floor(S.CAMERA.pos.z / B) / K);
        return Math.max(
          Math.abs(Math.floor(bx / K) - pcx),
          Math.abs(Math.floor(bz / K) - pcz));
      }
      const cool = [], subs = [];
      for (let bx = -10; bx <= 10; bx++) {
        for (let bz = -10; bz <= 10; bz++) {
          const c = S.WORLD.buildingAt(bx, bz, ringFor(bx, bz), ['cool'], 0);
          if (c) cool.push({ x: c.x, z: c.z, hTop: c.hTop });
          const s = S.WORLD.buildingAt(bx, bz, ringFor(bx, bz), ['sub'], 0);
          if (s) subs.push({ x: s.x, z: s.z, hTop: s.hTop });
        }
      }
      let steamOk = true, sparkOk = true;
      for (const it of sLive) {
        const v = cool.find(v =>
          Math.abs(v.x - it.sx) < 2 && Math.abs(v.z - it.sz) < 2);
        if (!v || it.py < it.sy - 0.5 || it.age >= it.life || it.vy <= 0) {
          steamOk = false; break;
        }
      }
      for (const it of pLive) {
        const s = subs.find(s =>
          Math.abs(s.x - it.sx) < 2 && Math.abs(s.z - it.sz) < 2);
        if (!s || it.age >= it.life) { sparkOk = false; break; }
      }
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      /* all sync stats first (the heap sample below awaits — the page
       * keeps running during it, so nothing sampled after it may be
       * compared against these) */
      const stats = {
        scount: T.scount, pcount: T.pcount,
        sPoolCap: sPool ? sPool.capacity : -1,
        sInUse: sPool ? sPool.capacity - sPool.top : -1,
        pPoolCap: pPool ? pPool.capacity : -1,
        pInUse: pPool ? pPool.capacity - pPool.top : -1,
        sZeroNew: !!sPool && sLive.every(it =>
          it.__pool === sPool && it.__free === false),
        pZeroNew: !!pPool && pLive.every(it =>
          it.__pool === pPool && it.__free === false),
        steamOk, sparkOk,
        nCool: cool.length, nSub: subs.length,
        drawRange: T.spoints.geometry.drawRange.count,
        smeshCount: T.smesh.count,
        sAdditive: T.smesh.material.blending === 2,
        pAdditive: T.spoints.material.blending === 2,
        calls: S.renderer.info.render.calls,
      };
      stats.heapBefore = await heapMin();
      return stats;
    });
    check('M6.4: steam field saturates the cap (pool = gate, one InstancedMesh)',
      s0.scount >= s0.sPoolCap - 2 && s0.sInUse === s0.scount &&
      s0.smeshCount === s0.scount,
      `scount=${s0.scount}, pool=${s0.sPoolCap}, inUse=${s0.sInUse}`);
    check('M6.4: every live puff/spark is a pre-created pool item (zero `new` after init)',
      s0.sZeroNew && s0.pZeroNew,
      `puffs=${s0.scount}, sparks=${s0.pcount}`);
    check('M6.4: steam rises from cooling-tower vents (seeded replay match)',
      s0.steamOk, `vents=${s0.nCool}`);
    check('M6.4: sparks live at substations (seeded replay match, brief life)',
      s0.sparkOk, `subs=${s0.nSub}`);

    /* upward drift + no per-frame allocation across a live window */
    await sleep(2500);
    const s1 = await page.evaluate(async () => {
      const T = window.SIM.TRAFFIC;
      let rose = 0;
      const sSet = T._sLive.slice(0, T.scount);
      for (const sn of window.__m64.sSnaps) {
        if (!sSet.includes(sn.ref)) continue;
        if (sn.ref.py - sn.y > 0.3) rose++;
      }
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      return {
        rose, nS: window.__m64.sSnaps.length,
        heap: await heapMin(),
        pcount: T.pcount, drawRange: T.spoints.geometry.drawRange.count,
      };
    });
    check('M6.4: steam visibly rises (upward drift) while alive',
      s1.rose > 0, `rose=${s1.rose}/${s1.nS}`);
    check('M6.4: no allocation per frame (heap flat with both emitters alive)',
      s0.heapBefore > 0 && s1.heap > 0 &&
      s1.heap - s0.heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(s0.heapBefore / 1024)}KB,`
      + ` after=${Math.round(s1.heap / 1024)}KB`);
    check('M6.4: idle-cheap stats — additive, Points drawRange tracks live count',
      s1.drawRange === s1.pcount && s0.sAdditive && s0.pAdditive,
      `calls=${s0.calls}, drawRange=${s1.drawRange}`);

    /* sparks age out (brief life) — short window, sparks die fast */
    const pA = await page.evaluate(() => {
      const T = window.SIM.TRAFFIC;
      return T._pLive.slice(0, T.pcount)
        .map(it => ({ ref: it, age: it.age }));
    });
    await sleep(500);
    const pB = await page.evaluate(snaps => {
      const T = window.SIM.TRAFFIC;
      const live = T._pLive.slice(0, T.pcount);
      const liveSet = new Set(live);
      let aged = 0, still = 0, fresh = 0;
      for (const sn of snaps) {
        if (!liveSet.has(sn.ref)) continue;
        still++;
        if (sn.ref.age > sn.age) aged++;
      }
      for (const it of live) if (!snaps.some(sn => sn.ref === it)) fresh++;
      return { aged, still, fresh, live: live.length };
    }, pA);
    check('M6.4: sparks are a continuous brief-life stream (bursts keep respawning)',
      pB.live > 0 && pB.fresh > 0,
      `live=${pB.live}, fresh=${pB.fresh}, stillAged=${pB.aged}/${pB.still}`);

    /* counts never exceed the tier caps (sampled while emitters cycle) */
    const capHold = await page.evaluate(async () => {
      const S = window.SIM;
      const sc = S.CFG.traffic.steam.tiers[S.TIER.active()];
      const pc = S.CFG.traffic.spark.tiers[S.TIER.active()];
      for (let i = 0; i < 10; i++) {
        if (S.TRAFFIC.scount > sc || S.TRAFFIC.pcount > pc) return false;
        await new Promise(r => setTimeout(r, 150));
      }
      return true;
    });
    check('M6.4: counts never exceed the tier caps', capHold === true,
      `steam=${caps.sCap}, spark=${caps.pCap}`);

    /* tier cap: LOW trims both emitters, HIGH regrows them */
    const lowS = await page.evaluate(() => window.SIM.CFG.traffic.steam.tiers.low);
    const lowP = await page.evaluate(() => window.SIM.CFG.traffic.spark.tiers.low);
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(({ s, p }) =>
      window.SIM.TRAFFIC.scount <= s && window.SIM.TRAFFIC.pcount <= p,
      { s: lowS, p: lowP }, { timeout: 5000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM;
      const sPool = S.POOL.list.find(pp => pp.name === 'traffic-steam');
      const pPool = S.POOL.list.find(pp => pp.name === 'traffic-spark');
      return {
        scount: S.TRAFFIC.scount, pcount: S.TRAFFIC.pcount,
        sInUse: sPool.capacity - sPool.top,
        pInUse: pPool.capacity - pPool.top,
      };
    });
    check('M6.4: LOW tier trims both emitters (excess released to the pools)',
      tLow.scount <= lowS && tLow.pcount <= lowP &&
      tLow.sInUse === tLow.scount && tLow.pInUse === tLow.pcount,
      `steam=${tLow.scount}/${lowS}, spark=${tLow.pcount}/${lowP}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(c => window.SIM.TRAFFIC.scount === c,
      caps.sCap, { timeout: 120000 });
    await page.waitForFunction(c => window.SIM.TRAFFIC.pcount >= c, 3,
      { timeout: 30000 });
    check('M6.4: HIGH tier restores the full steam field (regrows on spawn ticks)',
      (await page.evaluate(() => window.SIM.TRAFFIC.scount)) >= caps.sCap - 2,
      `scount restored near ${caps.sCap}`);

    /* draw-call budget with both emitters alive */
    const calls = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    check('M6.4: draw calls inside budget with both emitters alive',
      calls > 0 && calls < 150, `calls=${calls}`);

    /* visual gate: street-level screenshot that actually SHOWS steam +
     * sparks at their source buildings. Pick a live puff above a
     * resolvable cooling-tower vent (50–170 m out, mid-life, risen
     * clear of the tower cap) whose substation neighbour (≤ 70 m)
     * carries a live spark; camera 70 m out on the radial bearing,
     * aim at the puff; analytic line-of-sight against the instanced
     * building boxes rejects occluded candidates. */
    let d = null;
    for (let tries = 0; tries < 40 && !d; tries++) {
      d = await page.evaluate(() => {
        const S = window.SIM, T = S.TRAFFIC;
        const B = S.WORLD.BLOCK, K = S.WORLD.CHUNK;
        function ringFor(bx, bz) {
          const pcx = Math.floor(Math.floor(S.CAMERA.pos.x / B) / K);
          const pcz = Math.floor(Math.floor(S.CAMERA.pos.z / B) / K);
          return Math.max(
            Math.abs(Math.floor(bx / K) - pcx),
            Math.abs(Math.floor(bz / K) - pcz));
        }
        const cool = [], subs = [];
        for (let bx = -10; bx <= 10; bx++) {
          for (let bz = -10; bz <= 10; bz++) {
            const c = S.WORLD.buildingAt(bx, bz, ringFor(bx, bz), ['cool'], 0);
            if (c) cool.push(c);
            const s = S.WORLD.buildingAt(bx, bz, ringFor(bx, bz), ['sub'], 0);
            if (s) subs.push(s);
          }
        }
        const near = (list, x, z, m) =>
          list.find(v => Math.abs(v.x - x) < m && Math.abs(v.z - z) < m);
        const puffs = [];
        for (let i = 0; i < T.scount; i++) {
          const it = T._sLive[i];
          const u = it.age / it.life;
          if (u < 0.25 || u > 0.75) continue;
          const v = near(cool, it.sx, it.sz, 2);
          if (!v) continue;
          const dist = Math.hypot(v.x, v.z);
          if (dist < 50 || dist > 170) continue;
          if (it.py < v.hTop + 3.5 || it.py > 34) continue;
          puffs.push({ it, v });
        }
        const sparks = [];
        for (let i = 0; i < T.pcount; i++) {
          const it = T._pLive[i];
          if (it.life - it.age < 0.45) continue;
          const s = near(subs, it.sx, it.sz, 2);
          if (!s) continue;
          sparks.push({ it, s });
        }
        const boxes = [];
        for (const ch of S.WORLD.chunks.values()) {
          if (!ch.group || !ch.group.visible) continue;
          for (const b of [ch.boxA, ch.boxG, ch.cyl, ch.ledWin])
            if (b && b.count > 0) boxes.push(b);
        }
        const inv = T._sm.clone();
        const la = T._sp.clone();
        function segHits(arr, o, ax, ay, az, bx, by, bz) {
          inv.fromArray(arr, o);
          inv.invert();
          const p = la.set(ax, ay, az).applyMatrix4(inv);
          const px = p.x, py = p.y, pz = p.z;
          const q = la.set(bx, by, bz).applyMatrix4(inv);
          const pp = [px, py, pz], qq = [q.x, q.y, q.z];
          let t0 = 0, t1 = 1;
          for (let k = 0; k < 3; k++) {
            const dK = qq[k] - pp[k];
            if (Math.abs(dK) < 1e-9) {
              if (pp[k] < -0.5 || pp[k] > 0.5) return false;
            } else {
              let te = (-0.5 - pp[k]) / dK, tx = (0.5 - pp[k]) / dK;
              if (te > tx) { const tm = te; te = tx; tx = tm; }
              if (t0 < te) t0 = te;
              if (t1 > tx) t1 = tx;
              if (t0 > t1) return false;
            }
          }
          return true;
        }
        function occluded(ax, ay, az, bx, by, bz) {
          const dx = bx - ax, dy = by - ay, dz = bz - az;
          const l2 = dx * dx + dy * dy + dz * dz;
          for (const b of boxes) {
            const arr = b.mesh.instanceMatrix.array;
            for (let i = 0; i < b.count; i++) {
              const o = i * 16;
              const cx = arr[o + 12], cy = arr[o + 13], cz = arr[o + 14];
              const sx = Math.abs(arr[o]) + Math.abs(arr[o + 1]) + Math.abs(arr[o + 2]);
              const sy = Math.abs(arr[o + 4]) + Math.abs(arr[o + 5]) + Math.abs(arr[o + 6]);
              const sz = Math.abs(arr[o + 8]) + Math.abs(arr[o + 9]) + Math.abs(arr[o + 10]);
              const tt = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2;
              if (tt < 0 || tt > 1) continue;
              const px = ax + dx * tt, py = ay + dy * tt, pz = az + dz * tt;
              const ex = Math.max(sx, sy, sz) * 0.5 + 1;
              const ex2 = cx - px, ey = cy - py, ez = cz - pz;
              if (ex2 * ex2 + ey * ey + ez * ez > ex * ex) continue;
              if (segHits(arr, o, ax, ay, az, bx, by, bz)) return true;
            }
          }
          return false;
        }
        for (const { it, v } of puffs) {
          for (const { it: sk, s } of sparks) {
            if (Math.hypot(s.x - v.x, s.z - v.z) > 70) continue;
            const dist = Math.hypot(v.x, v.z);
            const ux = v.x / dist, uz = v.z / dist;
            const camX = v.x + ux * 70, camZ = v.z + uz * 70;
            /* sub must sit close to the vent bearing (in-frame) and at
             * a similar elevation (both inside the vertical FOV) */
            const a1 = Math.atan2(v.x - camX, v.z - camZ);
            const a2 = Math.atan2(s.x - camX, s.z - camZ);
            if (Math.abs(a1 - a2) > 0.35) continue;
            const e1 = Math.atan2(it.py - 2,
              Math.hypot(it.px - camX, it.pz - camZ));
            const e2 = Math.atan2(s.hTop - 2,
              Math.hypot(s.x - camX, s.z - camZ));
            if (Math.abs(e1 - e2) > 0.4) continue;
            if (occluded(camX, 2, camZ, it.px, it.py, it.pz)) continue;
            if (occluded(camX, 2, camZ, s.x, s.hTop, s.z)) continue;
            const dx = it.px - camX, dy = it.py - 2, dz = it.pz - camZ;
            return {
              x: camX, z: camZ,
              yaw: Math.atan2(-dx, -dz),
              pitch: Math.atan2(dy, Math.hypot(dx, dz)),
              puff: [it.px, it.py, it.pz],
              sub: [s.x, s.hTop, s.z],
            };
          }
        }
        return null;
      });
      if (!d) await sleep(500);
    }
    let shotOk = false;
    if (d) {
      await page.evaluate(({ x, z, yaw, pitch }) => {
        const S = window.SIM;
        S.CAMERA.pos.set(x, 2, z);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = yaw;
        S.CAMERA.pitch = pitch;
      }, d);
      await sleep(450);
      await page.screenshot({ path: `${here}/shots/m64-steam-sparks-street.png` });
      shotOk = fs.existsSync(`${here}/shots/m64-steam-sparks-street.png`);
      /* reset to the spawn pose for the remaining checks */
      await page.evaluate(() => {
        const S = window.SIM;
        S.CAMERA.pos.set(0, 4, 18);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = 0;
        S.CAMERA.pitch = 0;
      });
      await sleep(250);
    }
    check('M6.4: street screenshot with steam + sparks at source buildings (shots/m64-steam-sparks-street.png)',
      shotOk,
      d ? `puff=(${d.puff.map(v => v.toFixed(0)).join(',')}),`
        + ` sub=(${d.sub.map(v => v.toFixed(0)).join(',')})`
        : 'no resolvable vent+sub pair in frame');
  }

  /* ------------------------------------------------------------------ *
   * M6.5 — adaptive caps by FPS tier (integrated tier switch)
   *
   *  TRAFFIC reads CFG.traffic.*.tiers[TIER.name] every frame for all
   *  four fleets, so one TIER switch scales every M6 pool at once.
   *  Verify the whole switch end-to-end: LOW halves every cap (live
   *  counts + pools), HIGH restores all four, and the switch itself
   *  costs no frame time (rAF delta probe) and no allocation (heap).
   * ------------------------------------------------------------------ */
  {
    /* frame-time probe: rAF delta sampler spanning both tier switches;
     * windows are snapshotted + cleared between phases, so each window
     * holds only the frames around that switch */
    await page.evaluate(() => {
      window.__m65 = { deltas: [], on: true };
      let last = performance.now();
      const tick = () => {
        const w = window.__m65;
        if (!w || !w.on) return;
        const now = performance.now();
        w.deltas.push(now - last);
        last = now;
        if (w.deltas.length > 1500)
          w.deltas.splice(0, w.deltas.length - 1500);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    /* baseline: all four M6 fleets saturated at the HIGH caps */
    await page.waitForFunction(() => {
      const T = window.SIM.TRAFFIC;
      return T.count === 16 && T.vcount === 12 &&
        T.scount === 48 && T.pcount >= 3;
    }, { timeout: 120000 });
    const capsHi = await page.evaluate(() => {
      const t = window.SIM.CFG.traffic;
      return {
        drone: t.drone.tiers.high, vehicle: t.vehicle.tiers.high,
        steam: t.steam.tiers.high, spark: t.spark.tiers.high,
      };
    });
    await sleep(1000);
    const snapWin = () => page.evaluate(() => {
      const d = window.__m65.deltas;
      window.__m65.deltas = [];
      let max = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > max) max = d[i];
      return { n: d.length, max };
    });
    const base = await snapWin();
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();

    /* LOW caps must be visibly lower than HIGH caps (halved in config) */
    const capsLo = await page.evaluate(() => {
      const t = window.SIM.CFG.traffic;
      return {
        drone: t.drone.tiers.low, vehicle: t.vehicle.tiers.low,
        steam: t.steam.tiers.low, spark: t.spark.tiers.low,
      };
    });
    check('M6.5: LOW caps are visibly lower than HIGH caps (each ≤ 1/2)',
      capsLo.drone <= capsHi.drone / 2 &&
      capsLo.vehicle <= capsHi.vehicle / 2 &&
      capsLo.steam <= capsHi.steam / 2 &&
      capsLo.spark <= capsHi.spark / 2,
      `drone ${capsHi.drone}->${capsLo.drone},` +
      ` vehicle ${capsHi.vehicle}->${capsLo.vehicle},` +
      ` steam ${capsHi.steam}->${capsLo.steam},` +
      ` spark ${capsHi.spark}->${capsLo.spark}`);

    /* one switch scales ALL four fleets at once */
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(o => {
      const T = window.SIM.TRAFFIC;
      return T.count <= o.drone && T.vcount <= o.vehicle &&
        T.scount <= o.steam && T.pcount <= o.spark;
    }, { ...capsLo }, { timeout: 15000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM, T = S.TRAFFIC;
      const inUse = n => {
        const p = S.POOL.list.find(pp => pp.name === n);
        return p.capacity - p.top;
      };
      return {
        count: T.count, vcount: T.vcount, scount: T.scount,
        pcount: T.pcount,
        droneInUse: inUse('traffic-drone'),
        vehInUse: inUse('traffic-vehicle'),
        steamInUse: inUse('traffic-steam'),
        sparkInUse: inUse('traffic-spark'),
      };
    });
    check('M6.5: LOW tier trims ALL four fleets to their LOW caps',
      tLow.count <= capsLo.drone && tLow.vcount <= capsLo.vehicle &&
      tLow.scount <= capsLo.steam && tLow.pcount <= capsLo.spark,
      `drone=${tLow.count}/${capsLo.drone},` +
      ` vehicle=${tLow.vcount}/${capsLo.vehicle},` +
      ` steam=${tLow.scount}/${capsLo.steam},` +
      ` spark=${tLow.pcount}/${capsLo.spark}`);
    check('M6.5: excess items land back in the pools (inUse === live, all 4)',
      tLow.droneInUse === tLow.count &&
      tLow.vehInUse === tLow.vcount &&
      tLow.steamInUse === tLow.scount &&
      tLow.sparkInUse === tLow.pcount,
      `inUse drone=${tLow.droneInUse}, veh=${tLow.vehInUse},` +
      ` steam=${tLow.steamInUse}, spark=${tLow.sparkInUse}`);
    const lowWin = await snapWin();

    /* LOW caps hold while the emitters cycle */
    const capHold = await page.evaluate(async () => {
      const S = window.SIM;
      const t = S.CFG.traffic;
      for (let i = 0; i < 10; i++) {
        if (S.TRAFFIC.count > t.drone.tiers.low ||
            S.TRAFFIC.vcount > t.vehicle.tiers.low ||
            S.TRAFFIC.scount > t.steam.tiers.low ||
            S.TRAFFIC.pcount > t.spark.tiers.low) return false;
        await new Promise(r => setTimeout(r, 150));
      }
      return true;
    });
    check('M6.5: LOW caps hold while the emitters cycle', capHold === true);

    /* back to HIGH: every fleet regrows to its HIGH cap */
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(o => {
      const T = window.SIM.TRAFFIC;
      return T.count === o.drone && T.vcount === o.vehicle &&
        T.scount === o.steam && T.pcount >= 3;
    }, { drone: capsHi.drone, vehicle: capsHi.vehicle, steam: capsHi.steam },
      { timeout: 120000 });
    const tHi = await page.evaluate(() => {
      const T = window.SIM.TRAFFIC;
      return { count: T.count, vcount: T.vcount, scount: T.scount,
        pcount: T.pcount };
    });
    const hiWin = await snapWin();
    check('M6.5: HIGH tier restores all four fleets (regrows on spawn ticks)',
      tHi.count === capsHi.drone && tHi.vcount === capsHi.vehicle &&
      tHi.scount === capsHi.steam && tHi.pcount >= 3,
      `drone=${tHi.count}/${capsHi.drone},` +
      ` vehicle=${tHi.vcount}/${capsHi.vehicle},` +
      ` steam=${tHi.scount}/${capsHi.steam}, spark=${tHi.pcount}`);

    /* no frame spike: switch windows stay within 2× the baseline max
     * frame (100 ms floor — headless rAF jitter tolerance) */
    const bound = Math.max(100, base.max * 2);
    check('M6.5: no frame spike on tier switch (both switches vs baseline)',
      base.n > 0 && lowWin.n > 0 && hiWin.n > 0 &&
      lowWin.max <= bound && hiWin.max <= bound,
      `baseline max=${base.max.toFixed(1)}ms,` +
      ` LOW switch max=${lowWin.max.toFixed(1)}ms,` +
      ` HIGH switch max=${hiWin.max.toFixed(1)}ms,` +
      ` bound=${bound.toFixed(1)}ms`);

    /* the whole switch allocates nothing */
    const heapAfter = await heapMin();
    check('M6.5: tier switch allocates nothing (heap flat across LOW→HIGH)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);

    /* draw-call budget at the restored HIGH caps */
    const calls = await page.evaluate(() =>
      window.SIM.renderer.info.render.calls);
    check('M6.5: draw calls inside budget with all four fleets at HIGH cap',
      calls > 0 && calls < 150, `calls=${calls}`);

    /* stop the frame probe (leave the object; the pending rAF sees
     * on=false and exits — deleting it would throw in the callback) */
    await page.evaluate(() => { window.__m65.on = false; });
  }

  /* ---- 10. No errors anywhere ---- */
  check('zero uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero console.error', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  if (srv) await new Promise(r => srv.close(r));
}

console.log(`\nsmoke: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
