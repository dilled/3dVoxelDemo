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
 *   - systems registry boots in fixed order (INPUT, CAMERA, KIT, HUD)
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

  /* ---- 6a. Fixed-order systems registry ---- */
  {
    const names = await page.evaluate(() => window.SIM.systems.map(s => s.name));
    check('systems registered in fixed order',
      JSON.stringify(names) === JSON.stringify(['INPUT', 'CAMERA', 'KIT', 'WORLD', 'HUD']),
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
    // city for a frame or two, read the draw-call count, show it again.
    await page.evaluate(() => { window.SIM.WORLD.root.visible = false; });
    await sleep(250);
    const c1 = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => { window.SIM.WORLD.root.visible = true; });
    check('M2 gate: test wall/tower (city hidden) renders at < 10 draw calls',
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

  /* ---- 7d. Draw calls flat + unbuild-behind as you fly far out ---- */
  {
    const cNear = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      window.SIM.CAMERA.pos.set(0, 4, 1600);   // fly ~4 city radii out
    });
    await sleep(700);                           // sync: retire old, build new
    const cFar = await page.evaluate(() => window.SIM.renderer.info.render.calls);
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

  /* ---- 9. No errors anywhere ---- */
  check('zero uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero console.error', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  if (srv) await new Promise(r => srv.close(r));
}

console.log(`\nsmoke: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
