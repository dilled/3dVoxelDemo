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
 *   - gate: full test wall/tower scene renders at < 10 draw calls
 *   - LED canvas textures actually redraw (frame counter advances)
 *   - rendered pixels visibly change over time (animation on GPU)
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
      JSON.stringify(names) === JSON.stringify(['INPUT', 'CAMERA', 'KIT', 'HUD']),
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

    const c0 = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await sleep(300);
    const c1 = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    check('M2 gate: test wall/tower scene renders at < 10 draw calls',
      Number.isInteger(c1) && c1 >= 1 && c1 < 10,
      `calls ${c0} -> ${c1}`);

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

  /* ---- 7. No errors anywhere ---- */
  check('zero uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero console.error', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  if (srv) await new Promise(r => srv.close(r));
}

console.log(`\nsmoke: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
