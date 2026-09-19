#!/usr/bin/env node
/* =====================================================================
 * smoke/smoke.mjs — headless smoke test for the single-file demo.
 *
 * Dev tooling only (not part of the product). Serves the project root
 * over a local HTTP server and drives index.html in headless Chrome:
 *
 *   M0 checks:
 *   - page boots to the intro cinematic (M12: LOADER → INTRO →
 *     RUNNING) with the START button visible (skip affordance)
 *   - START click -> RUNNING (skips the intro; loop alive, FPS > 0)
 *   - double-click START does not double-init (single loop, no errors)
 *   - window resize updates renderer size + camera aspect
 *   - page reload (refresh) returns to a fresh, unstuck intro and
 *     START works again
 *
 *   M12.3 checks:
 *   - intro skippable/cancellable at any moment (START/click/keypress)
 *     → 0.5 s white fade to the street camera; the play state (RUNNING)
 *     is live at the fade midpoint (the intro never blocks play)
 *   - START hidden until 2 s into the intro (pure fn of t), visible
 *     after — boundary checked at the seek(1.9)/seek(2.1) edge
 *   - finish / early-skip (click, corridor) / late-interrupt
 *     (keypress, beat 5) — all three paths end in a controllable
 *     street-level camera with every beat FX off
 *
 *   M13.1 checks:
 *   - EVENTS registered in the fixed system order (after HUD)
 *   - scheduler clock advances in the page loop (update wired)
 *   - forced-seed 120 s drive (1200 × 0.1 s, page loop frozen):
 *     one-at-a-time (no overlaps), min/max gap respected, per-event
 *     cooldowns held, weighted picking (weight 2 fires more than 1),
 *     gated event never fires while ineligible
 *   - priority: a prio-2 event preempts the running lower-priority
 *     event (victim interrupted, C starts exactly at victim's end),
 *     fires once, gap resumes
 *   - determinism: same seed + same steps ⇒ identical firing order
 *
 *   M1 checks:
 *   - systems registry boots in fixed order
 *     (INPUT, CAMERA, KIT, WORLD, ENTITY, TRAFFIC, PARTS, HUD)
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
 *   M6.4 checks (steam vents + sparks — moved to PARTS in M7.1):
 *   - steam pool ('parts-steam') + spark pool ('parts-spark')
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
 *     vehicle 12, steam 48 (now on PARTS), spark stream alive)
 *
 *   M7.1 checks (pooled particle system — one system, one budget):
 *   - PARTS registered with 5 pools ('parts-steam' / 'parts-spark' /
 *     'parts-pulse' / 'parts-light' / 'parts-rain', fixed capacity =
 *     HIGH tier cap); CFG.parts.tiers = exact sum of the per-type tier
 *     caps at every tier (the one shared budget)
 *   - idle cost ~0: pulse/light/rain 0 live with 0 drawRange/count and
 *     0 pool inUse (0 draw calls for the event types)
 *   - one dev trigger key (P) rains ALL five particle types: every type
 *     observed live, every live item a pre-created pool item (zero `new`
 *     after init), rain streaks visibly fall, counts never exceed the
 *     tier caps (sampled), heap flat across the rain window
 *   - rain screenshot with the streaks in frame
 *     (shots/m71-particles-rain.png)
 *   - rain resolves clean: after the trigger duration pulse/light/rain
 *     return to 0 live (no leftover state), drawRange back to 0
 *   - LOW tier caps the trigger rain (rcount ≤ LOW rain cap), HIGH
 *     restores; draw calls inside budget with the rain at cap
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
 *   M7.2 checks (FX.pulse — expanding instanced ring + light ramp):
 *   - FX registered (fixed order …PARTS, FX, HUD); pool 'fx-pulse'
 *     capacity = HIGH tier cap; idle = 0 live, ring count 0, all
 *     pooled lights hidden, 0 pool inUse
 *   - idle cost zero: draw calls identical with the FX ring hidden vs
 *     shown while 0 live (0 instances ⇒ 0 draw calls added)
 *   - manual key R fires a visible pulse: every live pulse a
 *     pre-created pool item (zero `new` after init), pooled light on
 *   - ring visibly expands (instance scale grows, reaches the
 *     requested radius); light intensity ramps up then decays to 0
 *   - pulse resolves clean: back to 0 live, ring count 0, lights
 *     hidden, intensity 0 (no leftover state)
 *   - explicit API FX.pulse(origin, radius, color) honours its args
 *     (radius + color on the pool item)
 *   - tier cap: LOW trims 6 fired pulses to the LOW cap, HIGH restores
 *   - heap flat across the pulse sequence; draw calls inside budget
 *   - screenshot with the ring in frame (shots/m72-pulse-ring.png)
 *
 *   M7.3 checks (animated electrical arcs — regenerated line segments):
 *   - FX arcs registered: pool 'fx-arc' (capacity = HIGH tier cap), ONE
 *     LineSegments with pre-allocated position+color buffers, idle 0
 *     live / drawRange 0 / 0 pool inUse
 *   - idle = zero added draw calls (shared LineSegments hidden at 0
 *     live — three r160 does not skip drawRange-0 objects)
 *   - manual key T sparks BOTH anchor types: substation→substation
 *     (endpoints on two distinct live substations) + creature→ring road
 *     (antenna tip → a ring-road lane point at a vehicle altitude);
 *     exactly +1 draw call (the one LineSegments); every live arc a
 *     pre-created pool item (zero `new` after init)
 *   - regeneration: position buffer stable between ticks and re-jittered
 *     exactly every N frames (N = CFG.fx.arcs.regenFrames); regen is
 *     frame-cheap (rAF delta window with arcs alive stays within 2× the
 *     baseline max frame, 100 ms floor)
 *   - tier cap: LOW trims 8 fired arcs to the LOW cap; HIGH holds the
 *     full cap (8 live, no trim); draw calls inside budget
 *   - arcs resolve clean (0 live, drawRange 0, pool drained); heap flat
 *   - screenshot with both anchor types in frame (shots/m73-arcs.png)
 *
 *   M7.4 checks (screen-space flash — additive overlay plane):
 *   - FX flash registered: one additive plane in a separate overlay
 *     scene (not the main scene), hidden at 0 flash; renderer.info
 *     autoReset off (per-frame manual reset ⇒ calls accumulate over
 *     main + overlay renders)
 *   - idle = zero added draw calls (overlay not rendered at 0 flash,
 *     stable calls)
 *   - manual key B flashes: plane visible, exactly +1 draw call (the
 *     one overlay plane); material color = tint × level (additive
 *     amount)
 *   - flash decays monotonically to exactly 0, overlay hidden, calls
 *     back to the idle count
 *   - FX.flash(intensity, color) semantics: clamps to 0..max, re-
 *     trigger never accumulates, color honoured + default reset
 *   - heap flat; screenshot shows the full-screen flash (mean
 *     luminance well above the idle pose, shots/m74-flash.png)
 *
 *   M7.5 checks (camera shake — impulse decay consumed by CAMERA):
 *   - registered: CFG.input shake tunables (amp/decay/cap/impulse),
 *     CAMERA.shake API, energy 0, Key N trigger idle
 *   - idle cost zero: 0 energy ⇒ _applyShake is a no-op (no objects,
 *     no materials, no draw calls — structurally free)
 *   - manual Key N: energy rises, camera position offset from the pose,
 *     bounded by shakeAmp × energy, offset changes frame to frame
 *   - decays cleanly to still: energy monotone to exactly 0, camera
 *     returns exactly to the pose
 *   - never accumulates: 10 rapid re-triggers hold at the energy cap;
 *     shake(10) clamps to the cap; negative is a no-op; heap flat
 *
 *   M8.1 checks (night sky — gradient dome + stars + aurora band):
 *   - ATMOS registered (fixed order …FX, ATMOS, HUD): dome BackSide
 *     fog-off gradient sphere, additive fog-off stars Points, additive
 *     fog-off aurora band — all pinned to the camera
 *   - camera follow: dome/stars track the camera, aurora rides above
 *     it at the configured altitude
 *   - exactly +3 draw calls vs hidden (total < 150); star tier cap via
 *     drawRange (TIER low/high); aurora spin animates; heap flat
 *   - three camera distances (street / orbit / far-fly): on/off
 *     screenshot pairs — sky region brighter with ATMOS (dome),
 *     more bright star pixels (stars), more greenish pixels
 *     (aurora band); shots saved as m81-sky-*.png
 *
 *   M8.2 checks (fog depth tune + zone-tinted haze):
 *   - fog depth tuned: FogExp2 factor analytic — street range clear,
 *     500 m hazed but structures still readable (fog on/off screenshot
 *     pair at 500 m: city-region mean + edge detail survive the haze)
 *   - zone tint: fog color smoothstep-lerps cyan (core) → warm
 *     (outer avenues) across the M3 zone boundaries (220/520 m from
 *     the plaza) — analytic at core/mid/outer poses, mid-zone color is
 *     the lerp midpoint; dome horizon tint syncs (cool → warm)
 *   - zone tint visible flying across zones: city-region warmth
 *     (mean R − mean B) measurably higher in the outer zone than in
 *     the core zone (shots/m82-fog-{core,outer}.png)
 *   - no allocation per frame (heap flat)
 *   (M12.1: the intro cinematic auto-plays on every fresh load —
 *   LOADER → INTRO → RUNNING; the START click is the skip affordance;
 *   see the M12.1 section below for the corridor beat + runner checks)
 *
 *   M8.3 checks (volumetric-ish light shafts — spires + creature core):
 *   - registered: additive fog-off cone meshes in ATMOS.shaftGroup
 *     (tiers.high spire slots + 1 creature core shaft), hidden at boot
 *   - absent far away: at a pose with zero fiber spires in the shaft
 *     radius every shaft is hidden and the draw-call delta vs the
 *     group hidden is exactly 0 (no permanent draw calls)
 *   - visible near a spire: at a street pose with a fiber spire
 *     30–45 m out (readable silhouette, not a wall)
 *     ≥ 1 shaft is visible, every visible anchor replays through
 *     WORLD.buildingAt as a real fiber spire, draw-call delta equals
 *     the visible count, and an on/off screenshot pair shows the
 *     shaft adding light in a strip around the spire
 *     (shots/m83-shafts-near.png)
 *   - tier cap: TIER low trims spire shafts to the low cap, HIGH
 *     restores
 *   - awakening seam: ENTITY.state = 'AWAKE' at the far pose forces
 *     the creature core shaft on (+1 draw call), restoring 'DORMANT'
 *     hides it again
 *   - no allocation per frame (heap flat)
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
    // heap-flat checks force a GC before each sample (window.gc) so
    // they measure live-object growth, not garbage-reclaim timing
    '--expose-gc',
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

  /* ---- 1. Initial load: the intro cinematic auto-plays (M12) ---- */
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.SIM && window.SIM.BOOT && window.SIM.BOOT.state === 'INTRO',
    { timeout: 20000 },
  );
  {
    const s = await simState();
    check('boots to the intro cinematic without being stuck', s.state === 'INTRO', `state=${s.state}`);
  }
  const btnVisible = await page.locator('#startBtn').isVisible();
  check('START button visible (skip affordance)', btnVisible);

  /* ---- 2. START click -> RUNNING, live loop ---- */
  await page.locator('#startBtn').click();
  // double-click safety: click again while RUNNING
  await page.locator('#startBtn').click({ force: true }).catch(() => {});
  await page.waitForFunction(() => window.SIM && window.SIM.BOOT.state === 'RUNNING', { timeout: 5000 });
  {
    const s = await simState();
    check('START leads to RUNNING', s.state === 'RUNNING');
    const introCancelled = await page.evaluate(() => !window.SIM.INTRO.playing);
    check('START skips the intro (timeline cancelled)', introCancelled);
  }
  /* M8.4: suppress the auto lightning timer for the whole suite — a
   * live event would add 2 draw calls + hemi/flash bumps into the
   * earlier sections' measurements. The M8.4 section verifies the
   * timer explicitly (and re-suppresses after the refresh below).
   * M9.6: park the one-shot auto-awaken the same way — a live auto
   * at 30 s would inject a full sequence into the earlier sections.
   * The M9.6 section verifies it explicitly. */
  await page.evaluate(() => {
    window.SIM.ATMOS._ltTimer = 1e9;
    window.SIM.ENTITY._autoAt = Infinity;
  });
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
    () => window.SIM && window.SIM.BOOT.state === 'INTRO',
    { timeout: 20000 },
  );
  {
    const s = await simState();
    check('refresh returns to a fresh intro (not stuck)', s.state === 'INTRO', `state=${s.state}`);
    /* M12: the intro loop is already running, so frames restarted at a
     * small count (> 0, far below any long-running value). */
    check('frames restarted after refresh', s.frames >= 1 && s.frames < 240, `frames=${s.frames}`);
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
  /* M8.4: suppress the auto lightning timer for the preceding sections
   * (the refresh above re-seeded it) — a live event would add 2 draw
   * calls + a hemi/flash bump into the other sections' measurements.
   * The M8.4 section verifies the timer explicitly. M9.6: park the
   * one-shot auto-awaken again (the refresh above re-armed it). */
  await page.evaluate(() => {
    window.SIM.ATMOS._ltTimer = 1e9;
    window.SIM.ENTITY._autoAt = Infinity;
  });

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

  /* ---- 6a. Fixed-order systems registry (M5 adds ENTITY after WORLD,
   * M7.1 adds PARTS after TRAFFIC, M7.2 adds FX after PARTS, M8.1
   * adds ATMOS after FX, M11.2 adds AUDIO after ATMOS, M13.1 adds
   * EVENTS after HUD) ---- */
  {
    const names = await page.evaluate(() => window.SIM.systems.map(s => s.name));
    check('systems registered in fixed order',
      JSON.stringify(names) === JSON.stringify(
        ['INPUT', 'CAMERA', 'INTRO', 'KIT', 'WORLD', 'ENTITY', 'TRAFFIC',
         'PARTS', 'FX', 'ATMOS', 'AUDIO', 'HUD', 'EVENTS']),
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
    // city + M5 creature + M6 TRAFFIC meshes (drones/vehicles/trails) +
    // M7.1 PARTS particle meshes + M7.2 FX pulse ring + M8.1 ATMOS
    // night sky for a frame or two, read the draw-call count, show it
    // again.
    await page.evaluate(() => {
      window.SIM.WORLD.root.visible = false;
      window.SIM.ENTITY.root.visible = false;
      const T = window.SIM.TRAFFIC;
      const P = window.SIM.PARTS;
      for (const m of [T.mesh, T.vmesh, T.tmesh,
        P.smesh, P.spoints, P.mpoints, P.lpoints, P.rmesh,
        window.SIM.FX.ring, window.SIM.FX.arcs,
        window.SIM.ATMOS.root])
        if (m) m.visible = false;
    });
    await sleep(250);
    const c1 = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      window.SIM.WORLD.root.visible = true;
      window.SIM.ENTITY.root.visible = true;
      const T = window.SIM.TRAFFIC;
      const P = window.SIM.PARTS;
      for (const m of [T.mesh, T.vmesh, T.tmesh,
        P.smesh, P.spoints, P.mpoints, P.lpoints, P.rmesh,
        window.SIM.FX.ring, window.SIM.FX.arcs,
        window.SIM.ATMOS.root])
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
    /* settle before the heap window: right after the growth the page
     * still carries one-time first-flight warm-up growth (~2–2.5 MB on
     * this environment, observed on the committed baseline too — see
     * the M8.3 commit note on M6.x environmental flakes). The check
     * targets steady-state per-frame allocation, so let the warm-up
     * land before heapBefore. */
    await sleep(4000);
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
          if (window.gc) window.gc();
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
    /* dock/patrol is a slow cycle (dock 3–9 s vs. minutes of patrol):
     * a single instant can catch the whole fleet airborne, so confirm
     * both states over a short window, not one sample */
    const dockSeen = await page.evaluate(async () => {
      const T = window.SIM.TRAFFIC;
      const seen = { docked: 0, airborne: 0 };
      for (let i = 0; i < 20; i++) {
        const live = T._live.slice(0, T.count);
        if (live.some(it => it.state === 0)) seen.docked++;
        if (live.some(it => it.state > 0)) seen.airborne++;
        await new Promise(r => setTimeout(r, 250));
      }
      return seen;
    });
    check('M6.2: drones dock at towers and patrol between them',
      (a0.docked > 0 || dockSeen.docked > 0) &&
      (a0.airborne > 0 || dockSeen.airborne > 0) && a0.wpRouted > 0,
      `docked=${a0.docked} (seen ${dockSeen.docked}/20), ` +
      `airborne=${a0.airborne} (seen ${dockSeen.airborne}/20), routed=${a0.wpRouted}`);

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
          if (window.gc) window.gc();
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

    /* fleet grows to the tier cap — spawns are gated by the fixed
     * pool. Wait for the at-cap state to be STABLE: a vehicle is
     * released (back to the pool) the moment it flies past the hold
     * radius around the camera, so a transient at-cap sample can
     * read one vehicle short. Require no live vehicle within a few
     * metres of the release boundary. */
    await page.waitForFunction(c => {
      const S = window.SIM, T = S.TRAFFIC;
      if (!T || T.vcount !== c) return false;
      const v = S.CFG.traffic.vehicle;
      const P = S.CAMERA.pos;
      const rel = v.radius * v.releaseFactor - 3;
      for (let i = 0; i < c; i++) {
        const it = T._vLive[i];
        const dx = it.px - P.x, dz = it.pz - P.z;
        if (dx * dx + dz * dz > rel * rel) return false;
      }
      return true;
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
          if (window.gc) window.gc();
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
          if (window.gc) window.gc();
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
   * (emitters moved to PARTS in M7.1 — same checks, new home)
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
      const P = S.PARTS;
      const sPool = S.POOL.list.find(p => p.name === 'parts-steam');
      const pPool = S.POOL.list.find(p => p.name === 'parts-spark');
      return {
        sCap: (P.smesh && sPool) ? sPool.capacity : 0,
        pCap: (P.spoints && pPool) ? pPool.capacity : 0,
        sTier: S.CFG.parts.steam.tiers[S.TIER.active()],
        pTier: S.CFG.parts.spark.tiers[S.TIER.active()],
      };
    });
    check('M6.4: steam + spark emitters registered with pools (M6.1) + tier caps',
      caps.sCap > 0 && caps.pCap > 0 &&
      caps.sCap === caps.sTier && caps.pCap === caps.pTier,
      `steam=${caps.sCap}, spark=${caps.pCap},`
      + ` tier=${await page.evaluate(() => window.SIM.TIER.active())}`);

    /* steam field saturates the cap (spawn rate × life > cap ⇒ the
     * fixed pool is the gate); sparks hover at a small steady state */
    await page.waitForFunction(c => window.SIM.PARTS.scount === c,
      caps.sCap, { timeout: 120000 });
    await page.waitForFunction(c => window.SIM.PARTS.pcount >= c, 3,
      { timeout: 30000 });

    const s0 = await page.evaluate(async () => {
      const S = window.SIM;
      const P = S.PARTS;
      const sPool = S.POOL.list.find(p => p.name === 'parts-steam');
      const pPool = S.POOL.list.find(p => p.name === 'parts-spark');
      const sLive = P._sLive.slice(0, P.scount);
      const pLive = P._pLive.slice(0, P.pcount);
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
          if (window.gc) window.gc();
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      /* all sync stats first (the heap sample below awaits — the page
       * keeps running during it, so nothing sampled after it may be
       * compared against these) */
      const stats = {
        scount: P.scount, pcount: P.pcount,
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
        drawRange: P.spoints.geometry.drawRange.count,
        smeshCount: P.smesh.count,
        sAdditive: P.smesh.material.blending === 2,
        pAdditive: P.spoints.material.blending === 2,
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
      const P = window.SIM.PARTS;
      let rose = 0;
      const sSet = P._sLive.slice(0, P.scount);
      for (const sn of window.__m64.sSnaps) {
        if (!sSet.includes(sn.ref)) continue;
        if (sn.ref.py - sn.y > 0.3) rose++;
      }
      async function heapMin() {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (window.gc) window.gc();
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 400));
        }
        return m === Infinity ? -1 : m;
      }
      return {
        rose, nS: window.__m64.sSnaps.length,
        heap: await heapMin(),
        pcount: P.pcount, drawRange: P.spoints.geometry.drawRange.count,
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
      const P = window.SIM.PARTS;
      return P._pLive.slice(0, P.pcount)
        .map(it => ({ ref: it, age: it.age }));
    });
    await sleep(500);
    const pB = await page.evaluate(snaps => {
      const P = window.SIM.PARTS;
      const live = P._pLive.slice(0, P.pcount);
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
      const sc = S.CFG.parts.steam.tiers[S.TIER.active()];
      const pc = S.CFG.parts.spark.tiers[S.TIER.active()];
      for (let i = 0; i < 10; i++) {
        if (S.PARTS.scount > sc || S.PARTS.pcount > pc) return false;
        await new Promise(r => setTimeout(r, 150));
      }
      return true;
    });
    check('M6.4: counts never exceed the tier caps', capHold === true,
      `steam=${caps.sCap}, spark=${caps.pCap}`);

    /* tier cap: LOW trims both emitters, HIGH regrows them */
    const lowS = await page.evaluate(() => window.SIM.CFG.parts.steam.tiers.low);
    const lowP = await page.evaluate(() => window.SIM.CFG.parts.spark.tiers.low);
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(({ s, p }) =>
      window.SIM.PARTS.scount <= s && window.SIM.PARTS.pcount <= p,
      { s: lowS, p: lowP }, { timeout: 5000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM;
      const sPool = S.POOL.list.find(pp => pp.name === 'parts-steam');
      const pPool = S.POOL.list.find(pp => pp.name === 'parts-spark');
      return {
        scount: S.PARTS.scount, pcount: S.PARTS.pcount,
        sInUse: sPool.capacity - sPool.top,
        pInUse: pPool.capacity - pPool.top,
      };
    });
    check('M6.4: LOW tier trims both emitters (excess released to the pools)',
      tLow.scount <= lowS && tLow.pcount <= lowP &&
      tLow.sInUse === tLow.scount && tLow.pInUse === tLow.pcount,
      `steam=${tLow.scount}/${lowS}, spark=${tLow.pcount}/${lowP}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(c => window.SIM.PARTS.scount === c,
      caps.sCap, { timeout: 120000 });
    await page.waitForFunction(c => window.SIM.PARTS.pcount >= c, 3,
      { timeout: 30000 });
    check('M6.4: HIGH tier restores the full steam field (regrows on spawn ticks)',
      (await page.evaluate(() => window.SIM.PARTS.scount)) >= caps.sCap - 2,
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
        const S = window.SIM, T = S.PARTS;
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
   *  TRAFFIC (drone/vehicle) + PARTS (steam/spark) read their
   *  CFG.*.tiers[TIER.name] every frame, so one TIER switch scales
   *  every M6 pool at once.
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
      const T = window.SIM.TRAFFIC, P = window.SIM.PARTS;
      return T.count === 16 && T.vcount === 12 &&
        P.scount === 48 && P.pcount >= 3;
    }, { timeout: 120000 });
    const capsHi = await page.evaluate(() => {
      const t = window.SIM.CFG.traffic, p = window.SIM.CFG.parts;
      return {
        drone: t.drone.tiers.high, vehicle: t.vehicle.tiers.high,
        steam: p.steam.tiers.high, spark: p.spark.tiers.high,
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
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();

    /* LOW caps must be visibly lower than HIGH caps (halved in config) */
    const capsLo = await page.evaluate(() => {
      const t = window.SIM.CFG.traffic, p = window.SIM.CFG.parts;
      return {
        drone: t.drone.tiers.low, vehicle: t.vehicle.tiers.low,
        steam: p.steam.tiers.low, spark: p.spark.tiers.low,
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
      const T = window.SIM.TRAFFIC, P = window.SIM.PARTS;
      return T.count <= o.drone && T.vcount <= o.vehicle &&
        P.scount <= o.steam && P.pcount <= o.spark;
    }, { ...capsLo }, { timeout: 15000 });
    const tLow = await page.evaluate(() => {
      const S = window.SIM, T = S.TRAFFIC, P = S.PARTS;
      const inUse = n => {
        const p = S.POOL.list.find(pp => pp.name === n);
        return p.capacity - p.top;
      };
      return {
        count: T.count, vcount: T.vcount, scount: P.scount,
        pcount: P.pcount,
        droneInUse: inUse('traffic-drone'),
        vehInUse: inUse('traffic-vehicle'),
        steamInUse: inUse('parts-steam'),
        sparkInUse: inUse('parts-spark'),
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
      const t = S.CFG.traffic, p = S.CFG.parts;
      for (let i = 0; i < 10; i++) {
        if (S.TRAFFIC.count > t.drone.tiers.low ||
            S.TRAFFIC.vcount > t.vehicle.tiers.low ||
            S.PARTS.scount > p.steam.tiers.low ||
            S.PARTS.pcount > p.spark.tiers.low) return false;
        await new Promise(r => setTimeout(r, 150));
      }
      return true;
    });
    check('M6.5: LOW caps hold while the emitters cycle', capHold === true);

    /* back to HIGH: every fleet regrows to its HIGH cap */
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(o => {
      const T = window.SIM.TRAFFIC, P = window.SIM.PARTS;
      return T.count === o.drone && T.vcount === o.vehicle &&
        P.scount === o.steam && P.pcount >= 3;
    }, { drone: capsHi.drone, vehicle: capsHi.vehicle, steam: capsHi.steam },
      { timeout: 120000 });
    const tHi = await page.evaluate(() => {
      const T = window.SIM.TRAFFIC, P = window.SIM.PARTS;
      return { count: T.count, vcount: T.vcount, scount: P.scount,
        pcount: P.pcount };
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

  /* ------------------------------------------------------------------ *
   * M7.1 — pooled particle system (one system, one budget)
   *
   *  PARTS owns EVERY particle in the demo: steam, sparks, pulse motes,
   *  lightning motes, awakening rain — five M6.1 pools, one shared
   *  budget (CFG.parts.tiers = the exact sum of the per-type tier caps).
   *  The dev trigger (Key P) rains ALL five types; the event types
   *  (pulse/light/rain) cost nothing while idle (0 live ⇒ 0 draw calls).
   * ------------------------------------------------------------------ */
  {
    /* 5 pools, fixed capacity = HIGH tier cap; one budget = the exact
     * sum of the per-type tier caps at EVERY tier */
    const reg = await page.evaluate(() => {
      const S = window.SIM;
      const pools = {};
      for (const n of ['parts-steam', 'parts-spark', 'parts-pulse',
        'parts-light', 'parts-rain'])
        pools[n] = (S.POOL.list.find(p => p.name === n) ||
          { capacity: -1 }).capacity;
      const sum = tier =>
        S.CFG.parts.steam.tiers[tier] + S.CFG.parts.spark.tiers[tier] +
        S.CFG.parts.pulse.tiers[tier] + S.CFG.parts.light.tiers[tier] +
        S.CFG.parts.rain.tiers[tier];
      return {
        pools,
        budget: { high: S.CFG.parts.tiers.high,
          med: S.CFG.parts.tiers.med, low: S.CFG.parts.tiers.low },
        sum: { high: sum('high'), med: sum('med'), low: sum('low') },
        hi: {
          steam: S.CFG.parts.steam.tiers.high,
          spark: S.CFG.parts.spark.tiers.high,
          pulse: S.CFG.parts.pulse.tiers.high,
          light: S.CFG.parts.light.tiers.high,
          rain: S.CFG.parts.rain.tiers.high,
        },
      };
    });
    check('M7.1: PARTS registered with 5 pools (capacity = HIGH tier cap)',
      reg.pools['parts-steam'] === reg.hi.steam &&
      reg.pools['parts-spark'] === reg.hi.spark &&
      reg.pools['parts-pulse'] === reg.hi.pulse &&
      reg.pools['parts-light'] === reg.hi.light &&
      reg.pools['parts-rain'] === reg.hi.rain,
      `steam=${reg.pools['parts-steam']}, spark=${reg.pools['parts-spark']},`
      + ` pulse=${reg.pools['parts-pulse']}, light=${reg.pools['parts-light']},`
      + ` rain=${reg.pools['parts-rain']}`);
    check('M7.1: one budget — CFG.parts.tiers = exact sum of per-type tier caps (all tiers)',
      reg.budget.high === reg.sum.high && reg.budget.med === reg.sum.med &&
      reg.budget.low === reg.sum.low,
      `high=${reg.budget.high}/${reg.sum.high},`
      + ` med=${reg.budget.med}/${reg.sum.med},`
      + ` low=${reg.budget.low}/${reg.sum.low}`);

    /* idle cost ~0: the event types (pulse/light/rain) are 0 live with
     * 0 drawRange/count and 0 pool inUse (0 draw calls for them), while
     * the ambient types (steam/spark) keep running */
    const idle = await page.evaluate(() => {
      const S = window.SIM, P = S.PARTS;
      const inUse = n => {
        const p = S.POOL.list.find(pp => pp.name === n);
        return p.capacity - p.top;
      };
      return {
        mcount: P.mcount, lcount: P.lcount, rcount: P.rcount,
        mDraw: P.mpoints.geometry.drawRange.count,
        lDraw: P.lpoints.geometry.drawRange.count,
        rCount: P.rmesh.count,
        mInUse: inUse('parts-pulse'), lInUse: inUse('parts-light'),
        rInUse: inUse('parts-rain'),
        ambient: P.scount > 0 && P.pcount > 0,
      };
    });
    check('M7.1: idle cost ~0 — event types 0 live, 0 drawRange/count, 0 pool inUse (ambient keeps running)',
      idle.mcount === 0 && idle.lcount === 0 && idle.rcount === 0 &&
      idle.mDraw === 0 && idle.lDraw === 0 && idle.rCount === 0 &&
      idle.mInUse === 0 && idle.lInUse === 0 && idle.rInUse === 0 &&
      idle.ambient,
      `m=${idle.mcount}/${idle.mDraw}, l=${idle.lcount}/${idle.lDraw},`
      + ` r=${idle.rcount}/${idle.rCount}`);

    /* one dev trigger key (P) rains ALL five particle types */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();
    await page.keyboard.press('p');
    await page.waitForFunction(() => {
      const P = window.SIM.PARTS;
      return P.scount > 0 && P.pcount > 0 && P.mcount > 0 &&
        P.lcount > 0 && P.rcount > 0;
    }, { timeout: 15000 });
    const rain0 = await page.evaluate(() => {
      const S = window.SIM, P = S.PARTS;
      const inUse = n => {
        const p = S.POOL.list.find(pp => pp.name === n);
        return p.capacity - p.top;
      };
      window.__m71 = P._rLive.slice(0, P.rcount)
        .map(it => ({ ref: it, y: it.py }));
      return {
        scount: P.scount, pcount: P.pcount, mcount: P.mcount,
        lcount: P.lcount, rcount: P.rcount,
        zeroNew: [
          ['parts-steam', P._sLive.slice(0, P.scount)],
          ['parts-spark', P._pLive.slice(0, P.pcount)],
          ['parts-pulse', P._mLive.slice(0, P.mcount)],
          ['parts-light', P._lLive.slice(0, P.lcount)],
          ['parts-rain', P._rLive.slice(0, P.rcount)],
        ].every(([n, live]) =>
          live.length > 0 && live.every(it =>
            it.__pool && it.__pool.name === n && it.__free === false)),
        inUse: {
          s: inUse('parts-steam'), p: inUse('parts-spark'),
          m: inUse('parts-pulse'), l: inUse('parts-light'),
          r: inUse('parts-rain'),
        },
        /* keep the item refs in the page (evaluate args are serialized
         * copies — the drift sample below needs live identity) */
        calls: S.renderer.info.render.calls,
      };
    });
    check('M7.1: trigger key P rains ALL five particle types',
      rain0.scount > 0 && rain0.pcount > 0 && rain0.mcount > 0 &&
      rain0.lcount > 0 && rain0.rcount > 0,
      `steam=${rain0.scount}, spark=${rain0.pcount},`
      + ` pulse=${rain0.mcount}, light=${rain0.lcount},`
      + ` rain=${rain0.rcount}`);
    check('M7.1: every live particle is a pre-created pool item (zero `new` after init)',
      rain0.zeroNew &&
      rain0.inUse.s === rain0.scount && rain0.inUse.p === rain0.pcount &&
      rain0.inUse.m === rain0.mcount && rain0.inUse.l === rain0.lcount &&
      rain0.inUse.r === rain0.rcount,
      `inUse s=${rain0.inUse.s}, p=${rain0.inUse.p}, m=${rain0.inUse.m},`
      + ` l=${rain0.inUse.l}, r=${rain0.inUse.r}`);

    /* rain streaks visibly fall; sampled counts never exceed the tier
     * caps; heap flat across the live-rain window */
    await sleep(600);
    const rain1 = await page.evaluate(async () => {
      const S = window.SIM, P = S.PARTS;
      let fell = 0, still = 0;
      const live = new Set(P._rLive.slice(0, P.rcount));
      for (const sn of window.__m71) {
        if (!live.has(sn.ref)) continue;
        still++;
        if (sn.ref.py - sn.y < -0.5) fell++;
      }
      const t = S.TIER.active();
      let capsOk = true;
      for (let i = 0; i < 10; i++) {
        if (P.scount > S.CFG.parts.steam.tiers[t] ||
            P.pcount > S.CFG.parts.spark.tiers[t] ||
            P.mcount > S.CFG.parts.pulse.tiers[t] ||
            P.lcount > S.CFG.parts.light.tiers[t] ||
            P.rcount > S.CFG.parts.rain.tiers[t]) { capsOk = false; break; }
        await new Promise(r => setTimeout(r, 100));
      }
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return {
        fell, still, capsOk, rcount: P.rcount,
        heap: m === Infinity ? -1 : m,
      };
    });
    check('M7.1: rain streaks visibly fall (downward drift) while alive',
      rain1.fell > 0,
      `fell=${rain1.fell}/${rain1.still}`);
    check('M7.1: counts never exceed the tier caps (sampled while raining)',
      rain1.capsOk === true,
      `rain=${rain1.rcount}/${reg.hi.rain}`);
    check('M7.1: no allocation per frame (heap flat across the rain window)',
      heapBefore > 0 && rain1.heap > 0 &&
      rain1.heap - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,`
      + ` after=${Math.round(rain1.heap / 1024)}KB`);
    check('M7.1: draw calls inside budget with the rain at cap',
      rain0.calls > 0 && rain0.calls < 150, `calls=${rain0.calls}`);

    /* visual gate: rain streaks in frame — camera tilted up, the
     * streaks spawn 70–100 m above the player and fall through it */
    let rshot = 0;
    for (let tries = 0; tries < 10 && rshot === 0; tries++) {
      rshot = await page.evaluate(() => {
        const S = window.SIM, P = S.PARTS;
        if (P.rcount === 0) return 0;
        S.CAMERA.pos.set(0, 4, 18);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = 0;
        S.CAMERA.pitch = 0.55;
        return P.rcount;
      });
      if (!rshot) await sleep(250);
    }
    await sleep(450);
    await page.screenshot({ path: `${here}/shots/m71-particles-rain.png` });
    const shotOk = fs.existsSync(`${here}/shots/m71-particles-rain.png`);
    check('M7.1: rain screenshot with the streaks in frame (shots/m71-particles-rain.png)',
      shotOk && rshot > 0,
      `rcount=${rshot}`);

    /* LOW tier caps the trigger rain; HIGH restores it */
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.keyboard.press('p');
    await page.waitForFunction(() => {
      const P = window.SIM.PARTS;
      return P.rcount > 0 && P.mcount > 0 && P.lcount > 0;
    }, { timeout: 15000 });
    const low = await page.evaluate(() => {
      const S = window.SIM, P = S.PARTS;
      const t = S.CFG.parts;
      return {
        rcount: P.rcount, rCap: t.rain.tiers.low,
        mcount: P.mcount, mCap: t.pulse.tiers.low,
        lcount: P.lcount, lCap: t.light.tiers.low,
      };
    });
    check('M7.1: LOW tier caps the trigger rain (event types ≤ LOW caps)',
      low.rcount <= low.rCap && low.mcount <= low.mCap &&
      low.lcount <= low.lCap,
      `rain=${low.rcount}/${low.rCap}, pulse=${low.mcount}/${low.mCap},`
      + ` light=${low.lcount}/${low.lCap}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.keyboard.press('p');
    await page.waitForFunction(c => window.SIM.PARTS.rcount > c, low.rCap,
      { timeout: 30000 });
    check('M7.1: HIGH tier restores the full rain (regrows past the LOW cap)',
      (await page.evaluate(() => window.SIM.PARTS.rcount)) > low.rCap,
      `rcount > ${low.rCap}`);

    /* rain resolves clean: after the trigger duration the event types
     * return to 0 live with drawRange/count back to 0 (no leftover
     * state) — the ambient emitters keep running */
    await page.waitForFunction(() => {
      const P = window.SIM.PARTS;
      return P.mcount === 0 && P.lcount === 0 && P.rcount === 0;
    }, { timeout: 30000 });
    const resolved = await page.evaluate(() => {
      const S = window.SIM, P = S.PARTS;
      return {
        mDraw: P.mpoints.geometry.drawRange.count,
        lDraw: P.lpoints.geometry.drawRange.count,
        rCount: P.rmesh.count,
        ambient: P.scount > 0 && P.pcount > 0,
      };
    });
    check('M7.1: rain resolves clean — event types back to 0 live (no leftover state)',
      resolved.mDraw === 0 && resolved.lDraw === 0 && resolved.rCount === 0 &&
      resolved.ambient,
      `ambient steam/spark still alive=${resolved.ambient}`);
  }

  /* ------------------------------------------------------------------
   * M7.2 — FX.pulse: expanding instanced ring + light-intensity ramp
   *
   *  One shared InstancedMesh (per-instance color = tint × fade on the
   *  shared MATS.pulseGlow) + one pooled PointLight per live pulse.
   *  State lives in the M6.1 pool 'fx-pulse' (capacity = HIGH tier
   *  cap ⇒ zero `new` after init). 0 live ⇒ ring count 0 (three r160
   *  skips count-0 InstancedMesh ⇒ 0 draw calls added) + lights hidden.
   *  Dev trigger: Key R fires a pulse ahead of the player.
   * ------------------------------------------------------------------ */
  {
    /* registered + pre-allocated: pool, shared ring, pooled lights */
    const reg = await page.evaluate(() => {
      const S = window.SIM;
      const p = S.POOL.list.find(pp => pp.name === 'fx-pulse');
      return {
        hasFX: !!S.FX,
        cap: p ? p.capacity : -1,
        hi: S.CFG.fx.pulse.tiers.high,
        lo: S.CFG.fx.pulse.tiers.low,
        ringCount: S.FX.ring.count,
        ringType: S.FX.ring.geometry.type,
        sharedMat: S.FX.ring.material === S.KIT.MATS.pulseGlow,
        inScene: S.scene.children.includes(S.FX.ring),
        lights: S.FX._lights.length,
        lightsHidden: S.FX._lights.every(L => L.visible === false),
        inUse: p ? p.capacity - p.top : -1,
      };
    });
    check('M7.2: FX registered with fx-pulse pool (capacity = HIGH tier cap), shared ring material, idle 0 live / lights hidden',
      reg.hasFX && reg.cap === reg.hi && reg.lo < reg.hi &&
      reg.ringType === 'RingGeometry' && reg.sharedMat && reg.inScene &&
      reg.ringCount === 0 && reg.lights === reg.hi && reg.lightsHidden &&
      reg.inUse === 0,
      `cap=${reg.cap}, lights=${reg.lights}, ring=${reg.ringCount},` +
      ` inUse=${reg.inUse}`);

    /* idle cost zero: with the one variable ambient (steam) hidden the
     * call count is stable, and hiding vs showing the ring at 0 live
     * changes nothing (count-0 InstancedMesh adds 0 draw calls) */
    const parity = await page.evaluate(async () => {
      const S = window.SIM;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const sample = async n => {
        const a = [];
        await sleep(150);                 // let the visibility change render
        for (let i = 0; i < n; i++) {
          a.push(S.renderer.info.render.calls);
          await sleep(120);
        }
        return a;
      };
      const P = S.PARTS;
      P.smesh.visible = false;              // only ambient with a variable call
      const ringOn = await sample(4);
      S.FX.ring.visible = false;
      const noRing = await sample(4);
      S.FX.ring.visible = true;
      const ring0 = await sample(4);
      P.smesh.visible = true;
      return { ringOn, noRing, ring0 };
    });
    const stable = a => a.every(v => v === a[0]);
    check('M7.2: idle = zero added draw calls (ring hidden vs shown at 0 live: identical calls)',
      stable(parity.ringOn) && stable(parity.noRing) && stable(parity.ring0) &&
      parity.ringOn[0] === parity.noRing[0] && parity.noRing[0] === parity.ring0[0],
      `ringOn=${parity.ringOn.join()}, noRing=${parity.noRing.join()},` +
      ` ring0=${parity.ring0.join()}`);

    /* manual key R fires a visible pulse: +1 draw call (the ring),
     * pooled light on, every live pulse a pre-created pool item */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();
    const base = parity.ring0[0];
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.SIM.FX.count === 1,
      { timeout: 5000 });
    const p0 = await page.evaluate(async () => {
      const S = window.SIM, F = S.FX;
      const P = S.PARTS;
      P.smesh.visible = false;
      await new Promise(r => setTimeout(r, 120));
      const calls = S.renderer.info.render.calls;
      P.smesh.visible = true;
      const it = F._live[0];
      window.__m72 = { ref: it, R: it.R, scale: F._s.x };
      return {
        count: F.count,
        zeroNew: F._live.slice(0, F.count).every(it2 =>
          it2.__pool && it2.__pool.name === 'fx-pulse' &&
          it2.__free === false),
        inUse: S.POOL.list.find(pp => pp.name === 'fx-pulse')
          .capacity - S.POOL.list.find(pp => pp.name === 'fx-pulse').top,
        lightOn: F._lights[0].visible === true && F._lights[0].intensity > 0,
        lightPos: F._lights[0].position.y,
        scale: F._s.x,                     // scratch holds live[0]'s scale
        calls,
      };
    });
    check('M7.2: key R fires a pulse — ring live + pooled light on, exactly +1 draw call (the ring)',
      p0.count === 1 && p0.lightOn && p0.calls === base + 1,
      `count=${p0.count}, lightOn=${p0.lightOn},` +
      ` calls=${p0.calls} (idle=${base})`);
    check('M7.2: every live pulse is a pre-created pool item (zero `new` after init)',
      p0.zeroNew && p0.inUse === p0.count,
      `inUse=${p0.inUse}`);

    /* ring visibly expands toward the requested radius (ease-out);
     * light intensity ramps up (sin² peak) while alive */
    await sleep(350);
    const p1 = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const it = F._live[0];
      const u = it.age / it.life;
      const e = 1 - Math.pow(1 - u, 3);
      const want = 2 + (it.R - 2) * e;
      const L = F._lights[0];
      const wantLight =
        S.CFG.fx.pulse.light.intensity *
        Math.pow(Math.sin(u * Math.PI), 2);
      const prev = window.__m72.scale;
      window.__m72.scale = F._s.x;
      return {
        scale: F._s.x, prev, want,
        light: L.intensity, wantLight,
        count: F.count,
      };
    });
    check('M7.2: ring visibly expands (instance scale grows, tracks the eased radius)',
      p1.count === 1 && p1.scale > p1.prev &&
      Math.abs(p1.scale - p1.want) < 0.25,
      `scale ${p1.prev.toFixed(1)} -> ${p1.scale.toFixed(1)}` +
      ` (want ${p1.want.toFixed(1)})`);
    check('M7.2: light intensity ramps (tracks the sin² peak while alive)',
      Math.abs(p1.light - p1.wantLight) < 200 && p1.light > 0,
      `light=${p1.light.toFixed(0)} (want ${p1.wantLight.toFixed(0)})`);

    /* pulse resolves clean: 0 live, ring count 0, lights hidden + off,
     * pool drained (no leftover state) */
    await page.waitForFunction(() => window.SIM.FX.count === 0,
      { timeout: 10000 });
    const resolved = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const p = S.POOL.list.find(pp => pp.name === 'fx-pulse');
      return {
        count: F.count, ring: F.ring.count,
        lightsOff: F._lights.every(L =>
          L.visible === false && L.intensity === 0),
        inUse: p.capacity - p.top,
      };
    });
    check('M7.2: pulse resolves clean — 0 live, ring count 0, lights hidden + intensity 0',
      resolved.count === 0 && resolved.ring === 0 &&
      resolved.lightsOff && resolved.inUse === 0,
      `ring=${resolved.ring}, inUse=${resolved.inUse}`);

    /* explicit API FX.pulse(origin, radius, color) honours its args:
     * radius lands on the pool item, color is converted (sRGB →
     * working space, same pipeline as a THREE.Color) */
    const api = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const a = F.pulse({ x: 12, y: 0.5, z: -30 }, 80, 0xff8844);
      const b = F.pulse({ x: -12, y: 0.5, z: -30 }, 0, null);
      return {
        aR: a.R, aC: [a.cR, a.cG, a.cB],
        bR: b.R, bC: [b.cR, b.cG, b.cB],
        count: F.count,
      };
    });
    /* sRGB → working (linear) via the three r160 exact sRGB EOTF:
     * 0xff8844 ⇒ r=1, g≈0.24616, b≈0.05774; default 0x66e0ff ⇒
     * r≈0.13287, g≈0.74539, b=1 */
    const near = (v, w, e) => Math.abs(v - w) < e;
    check('M7.2: FX.pulse(origin, radius, color) honours radius + color (and defaults)',
      api.aR === 80 &&
      near(api.aC[0], 1, 1e-3) && near(api.aC[1], 0.24616, 1e-3) &&
      near(api.aC[2], 0.05774, 1e-3) &&
      api.bR === 40 &&   /* default = CFG.fx.pulse.radius */
      near(api.bC[0], 0.13287, 1e-3) && near(api.bC[1], 0.74539, 1e-3) &&
      near(api.bC[2], 1, 1e-3),
      `R=${api.aR}/${api.bR}, a=[${api.aC.map(v => v.toFixed(4)).join(',')}]` +
      ` b=[${api.bC.map(v => v.toFixed(4)).join(',')}]`);

    /* tier cap: 6 fired pulses trim to the LOW cap, HIGH restores */
    await page.waitForFunction(() => window.SIM.FX.count === 0,
      { timeout: 10000 });
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.evaluate(() => {
      const F = window.SIM.FX;
      for (let i = 0; i < 6; i++)
        F.pulse({ x: i * 5, y: 0.5, z: -40 - i }, 40, null);
    });
    await page.waitForFunction(() => window.SIM.FX.count === 2,
      { timeout: 5000 });
    const low = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const p = S.POOL.list.find(pp => pp.name === 'fx-pulse');
      return { count: F.count, inUse: p.capacity - p.top };
    });
    check('M7.2: LOW tier trims 6 fired pulses to the LOW cap (excess released)',
      low.count === 2 && low.inUse === 2,
      `count=${low.count}, inUse=${low.inUse}`);
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(() => window.SIM.FX.count === 0,
      { timeout: 10000 });
    await page.evaluate(() => {
      const F = window.SIM.FX;
      for (let i = 0; i < 6; i++)
        F.pulse({ x: i * 5, y: 0.5, z: -40 - i }, 40, null);
    });
    await page.waitForFunction(() => window.SIM.FX.count === 6,
      { timeout: 5000 });
    const cap = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      return { count: F.count, calls: S.renderer.info.render.calls };
    });
    check('M7.2: HIGH tier restores the full pulse cap; draw calls inside budget',
      cap.count === 6 && cap.calls > 0 && cap.calls < 150,
      `count=${cap.count}, calls=${cap.calls}`);

    /* heap flat across the whole pulse sequence */
    const heapAfter = await heapMin();
    check('M7.2: no allocation per pulse (heap flat across the sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);

    /* visual gate: the expanding ring + the light-intensity ramp in
     * frame — straight-down from the GROUND camera's max height (y is
     * clamped to 40), a 20 m pulse under the camera at peak brightness
     * (u≈0.5 ⇒ sin-fade ≈ 1, light at its sin² peak) */
    await page.waitForFunction(() => window.SIM.FX.count === 0,
      { timeout: 10000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(0, 40, 18);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = 0;
      S.CAMERA.pitch = -1.35;
      S.FX.pulse({ x: 0, y: 0.5, z: 18 }, 20, null);
    });
    await sleep(800);
    /* read the state BEFORE the screenshot: at u ≥ 0.5 the light is at
     * its sin² peak (5000), and the screenshot (≈0.1–0.5 s later) still
     * catches the ring at full size / near-peak brightness */
    const shotSt = await page.evaluate(() => ({
      count: window.SIM.FX.count,
      scale: window.SIM.FX._s.x,
      light: window.SIM.FX._lights[0].intensity,
    }));
    await page.screenshot({ path: `${here}/shots/m72-pulse-ring.png` });
    check('M7.2: pulse screenshot with the ring + light peak in frame (shots/m72-pulse-ring.png)',
      fs.existsSync(`${here}/shots/m72-pulse-ring.png`) &&
      shotSt.count === 1 && shotSt.scale > 10 && shotSt.light > 4000,
      `count=${shotSt.count}, scale=${shotSt.scale.toFixed(1)},` +
      ` light=${shotSt.light.toFixed(0)}`);
    await page.waitForFunction(() => window.SIM.FX.count === 0,
      { timeout: 10000 });
  }

  /* ------------------------------------------------------------------
   * M7.3 — animated electrical arcs: line segments regenerated every
   *        N frames between anchor points
   *
   *  One shared LineSegments (pre-allocated position + color buffers,
   *  additive vertex colors — the color IS the light). State lives in
   *  the M6.1 pool 'fx-arc' (capacity = HIGH tier cap ⇒ zero `new`
   *  after init). 0 live ⇒ drawRange 0 ⇒ 0 draw calls added. Bolt =
   *  main 12-segment jittered polyline + 3 forks; the whole slot is
   *  re-jittered every CFG.fx.arcs.regenFrames frames. Dev trigger:
   *  Key T sparks substation→substation + creature→ring road.
   * ------------------------------------------------------------------ */
  {
    /* registered + pre-allocated: pool, one LineSegments, buffers */
    const reg = await page.evaluate(() => {
      const S = window.SIM;
      const p = S.POOL.list.find(pp => pp.name === 'fx-arc');
      const g = S.FX.arcs.geometry;
      return {
        hasArcs: !!S.FX.arcs,
        cap: p ? p.capacity : -1,
        hi: S.CFG.fx.arcs.tiers.high,
        lo: S.CFG.fx.arcs.tiers.low,
        type: S.FX.arcs.type,
        inScene: S.scene.children.includes(S.FX.arcs),
        posLen: g.attributes.position.array.length,
        colLen: g.attributes.color.array.length,
        verts: S.FX._arcVerts,
        drawRange: g.drawRange.count,
        arcCount: S.FX.arcCount,
        inUse: p ? p.capacity - p.top : -1,
        additive: S.FX._arcMat.blending === 2, // THREE.AdditiveBlending
        vertexColors: S.FX._arcMat.vertexColors === true,
      };
    });
    check('M7.3: FX arcs registered — fx-arc pool (capacity = HIGH tier cap), one LineSegments with pre-allocated buffers, idle 0 live / drawRange 0',
      reg.hasArcs && reg.cap === reg.hi && reg.lo < reg.hi &&
      reg.type === 'LineSegments' && reg.inScene &&
      reg.posLen === reg.cap * reg.verts * 3 && reg.colLen === reg.posLen &&
      reg.drawRange === 0 && reg.arcCount === 0 && reg.inUse === 0 &&
      reg.additive && reg.vertexColors,
      `cap=${reg.cap}, verts=${reg.verts}, drawRange=${reg.drawRange}`);

    /* idle cost zero: at 0 live the shared LineSegments is hidden ⇒
     * 0 draw calls added (three r160 does not skip drawRange-0
     * objects), and the call count is stable */
    const parity = await page.evaluate(async () => {
      const S = window.SIM;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const sample = async n => {
        const a = [];
        await sleep(150);
        for (let i = 0; i < n; i++) {
          a.push(S.renderer.info.render.calls);
          await sleep(120);
        }
        return a;
      };
      const P = S.PARTS;
      P.smesh.visible = false;            // ambient with variable calls
      P.spoints.visible = false;
      const zero = await sample(4);
      const hidden = S.FX.arcs.visible === false;
      P.smesh.visible = true;
      P.spoints.visible = true;
      return { zero, hidden };
    });
    const stable = a => a.every(v => v === a[0]);
    check('M7.3: idle = zero added draw calls (arcs hidden at 0 live, stable calls)',
      stable(parity.zero) && parity.hidden,
      `zero=${parity.zero.join()}, hidden=${parity.hidden}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const maxDelta = n => page.evaluate(async n2 => {
      let last = performance.now(), m = 0;
      for (let i = 0; i < n2; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now();
        if (now - last > m) m = now - last;
        last = now;
      }
      return m;
    }, n);

    const heapBefore = await heapMin();
    const base = parity.zero[0];
    const baseDelta = await maxDelta(40);

    /* manual key T sparks BOTH anchor types: substation→substation
     * (two distinct live substations) + creature→ring road (antenna
     * tip → ring-road lane point at a vehicle altitude); exactly +1
     * draw call (the one shared LineSegments) */
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.SIM.FX.arcCount === 2,
      { timeout: 5000 });
    const a0 = await page.evaluate(async () => {
      const S = window.SIM, F = S.FX;
      const P = S.PARTS;
      P.smesh.visible = false;
      P.spoints.visible = false;
      await new Promise(r => setTimeout(r, 120));
      const calls = S.renderer.info.render.calls;
      P.smesh.visible = true;
      P.spoints.visible = true;
      const s = F._arcLive[0], c = F._arcLive[1];
      const list = P._subList;
      const onSub = (x, y, z) => list.some(e =>
        e.x === x && e.z === z && Math.abs(e.hTop + 0.5 - y) < 0.6);
      const e1 = onSub(s.ax, s.ay, s.az), e2 = onSub(s.bx, s.by, s.bz);
      const m1 = list.filter(e => e.x === s.ax && e.z === s.az);
      const m2 = list.filter(e => e.x === s.bx && e.z === s.bz);
      const distinct = m1.length === 1 && m2.length === 1 &&
        !(m1[0].x === m2[0].x && m1[0].z === m2[0].z);
      /* creature→ring: A at the antenna tip (root at origin ⇒ local
       * is world), B on the ring-road lane at a vehicle altitude */
      const g = S.ENTITY.parts.antenna1.position;
      const aOk = Math.abs(c.ax - g.x) < 0.1 &&
        Math.abs(c.ay - (g.y + 12.4)) < 0.1 && Math.abs(c.az - g.z) < 0.1;
      const alts = S.CFG.traffic.vehicle.altitudes;
      const bOk = Math.abs(c.bx) === S.CFG.fx.arcs.ringLane &&
        alts.includes(c.by) && Math.abs(c.bz) <= S.CFG.fx.arcs.ringZ + 1;
      const pp = S.POOL.list.find(q => q.name === 'fx-arc');
      return {
        count: F.arcCount, calls,
        zeroNew: F._arcLive.slice(0, F.arcCount).every(it =>
          it.__pool && it.__pool.name === 'fx-arc' && it.__free === false),
        inUse: pp.capacity - pp.top,
        subEnds: e1 && e2, distinct, aOk, bOk,
      };
    });
    check('M7.3: key T sparks BOTH anchor types — substation↔substation (two distinct live substations) + creature→ring road (antenna tip → ring-road lane)',
      a0.count === 2 && a0.subEnds && a0.distinct && a0.aOk && a0.bOk,
      `count=${a0.count}, sub=${a0.subEnds}/${a0.distinct},` +
      ` aOk=${a0.aOk}, bOk=${a0.bOk}`);
    check('M7.3: key T adds exactly +1 draw call (the one shared LineSegments)',
      a0.calls === base + 1,
      `calls=${a0.calls} (idle=${base})`);
    check('M7.3: every live arc is a pre-created pool item (zero `new` after init)',
      a0.zeroNew && a0.inUse === a0.count, `inUse=${a0.inUse}`);

    /* regeneration: position buffer stable between ticks and re-
     * jittered exactly every N frames (1 change per N-frame cycle) */
    const regen = await page.evaluate(async () => {
      const S = window.SIM, F = S.FX;
      const N = S.CFG.fx.arcs.regenFrames;
      const p = F.arcs.geometry.attributes.position.array;
      const hash = () => {
        let h = 0;
        for (let i = 0; i < p.length; i += 31)
          h = (h * 31 + Math.round(p[i] * 1000) +
            Math.round(p[i + 1] * 1000)) | 0;
        return h;
      };
      const rows = [];
      for (let i = 0; i < 12; i++) {
        await new Promise(r => requestAnimationFrame(r));
        rows.push({ tick: F._arcTick, h: hash() });
      }
      let changes = 0;
      for (let i = 1; i < rows.length; i++)
        if (rows[i].h !== rows[i - 1].h) changes++;
      const zeros = rows.filter(r => r.tick === 0).length;
      return { changes, zeros, N, arcCount: F.arcCount };
    });
    check('M7.3: bolts regenerate exactly every N frames (stable between ticks, 1 change per N-frame cycle)',
      regen.arcCount === 2 &&
      regen.zeros === 12 / regen.N && regen.changes === 12 / regen.N,
      `N=${regen.N}, zeros=${regen.zeros}, changes=${regen.changes}`);

    /* regen is frame-cheap: rAF delta window with the 2 live bolts
     * re-jittering every N frames stays within 2× the baseline max
     * frame (100 ms floor — headless rAF jitter tolerance) */
    const liveDelta = await maxDelta(60);
    check('M7.3: regeneration is frame-cheap (rAF deltas with live arcs within 2× baseline, 100 ms floor)',
      liveDelta <= Math.max(2 * baseDelta, 100),
      `live=${liveDelta.toFixed(1)}ms, base=${baseDelta.toFixed(1)}ms`);

    /* tier cap: 8 fired arcs trim to the LOW cap, HIGH restores */
    await page.waitForFunction(() => window.SIM.FX.arcCount === 0,
      { timeout: 10000 });
    await page.evaluate(() => {
      const F = window.SIM.FX;
      for (let i = 0; i < 8; i++)
        F.arc({ x: i * 5, y: 10, z: -40 - i },
              { x: i * 5 + 3, y: 14, z: -46 - i }, null);
    });
    await page.waitForFunction(() => window.SIM.FX.arcCount === 8,
      { timeout: 5000 });
    await page.evaluate(() => window.SIM.TIER.set('low'));
    await page.waitForFunction(() => window.SIM.FX.arcCount === 3,
      { timeout: 5000 });
    const low = await page.evaluate(() => {
      const S = window.SIM;
      const p = S.POOL.list.find(pp => pp.name === 'fx-arc');
      return { count: S.FX.arcCount, inUse: p.capacity - p.top };
    });
    check('M7.3: LOW tier trims 8 fired arcs to the LOW cap (excess released)',
      low.count === 3 && low.inUse === 3,
      `count=${low.count}, inUse=${low.inUse}`);
    /* HIGH tier holds the full cap: fire 5 more while the 3 survivors
     * are still alive ⇒ all 8 stay live (no trim at the HIGH cap) */
    await page.evaluate(() => window.SIM.TIER.set('high'));
    await page.waitForFunction(() => window.SIM.FX.arcCount === 3,
      { timeout: 5000 });
    await page.evaluate(() => {
      const F = window.SIM.FX;
      for (let i = 0; i < 5; i++)
        F.arc({ x: 40 + i * 5, y: 10, z: -40 - i },
              { x: 43 + i * 5, y: 14, z: -46 - i }, null);
    });
    await page.waitForFunction(() => window.SIM.FX.arcCount === 8,
      { timeout: 5000 });
    const cap = await page.evaluate(() => {
      const S = window.SIM;
      return { count: S.FX.arcCount, calls: S.renderer.info.render.calls };
    });
    check('M7.3: HIGH tier holds the full arc cap (8 live, no trim); draw calls inside budget',
      cap.count === 8 && cap.calls > 0 && cap.calls < 150,
      `count=${cap.count}, calls=${cap.calls}`);

    /* arcs resolve clean: 0 live, drawRange 0, pool drained */
    await page.waitForFunction(() => window.SIM.FX.arcCount === 0,
      { timeout: 10000 });
    const resolved = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const p = S.POOL.list.find(pp => pp.name === 'fx-arc');
      return {
        count: F.arcCount,
        drawRange: F.arcs.geometry.drawRange.count,
        inUse: p.capacity - p.top,
      };
    });
    check('M7.3: arcs resolve clean — 0 live, drawRange 0, pool drained',
      resolved.count === 0 && resolved.drawRange === 0 && resolved.inUse === 0,
      `drawRange=${resolved.drawRange}, inUse=${resolved.inUse}`);

    /* heap flat across the whole arc sequence */
    const heapAfter = await heapMin();
    check('M7.3: no allocation per regen (heap flat across the arc sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);

    /* visual gate: both anchor types in frame — street-level view
     * from the NE corner: the substation↔substation bolt across the
     * right half + the creature→ring-road bolt over the city. The
     * pose is empirical (city layout is seeded ⇒ stable): all four
     * live arc endpoints project inside 900×600, and the check below
     * asserts that projection, so a pose that misses fails the gate */
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(-180, 40, 180);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.fov = 60;                  // reset wheel zoom ⇒ deterministic pose
      S.CAMERA.yaw = 2.22;               // NE corner, over the plaza
      S.CAMERA.pitch = -0.35;
    });
    await sleep(4500);                   // let PARTS._subList refresh
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.SIM.FX.arcCount === 2,
      { timeout: 5000 });
    await sleep(550);                    // u≈0.25 ⇒ sin-fade ≈ 0.7
    await page.screenshot({ path: `${here}/shots/m73-arcs.png` });
    const shotSt = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const g = S.ENTITY.parts.antenna1.position;
      const c = F._arcLive[1];
      const v = F._arcVa;
      const proj = p => {
        v.set(p.x, p.y, p.z).project(S.camera);
        return [(v.x + 1) * 450, (1 - v.y) * 300];
      };
      const pts = [];
      for (let i = 0; i < F.arcCount; i++) {
        const a = F._arcLive[i];
        pts.push(proj({ x: a.ax, y: a.ay, z: a.az }),
                 proj({ x: a.bx, y: a.by, z: a.bz }));
      }
      return {
        count: F.arcCount,
        fade: Math.sin((F._arcLive[0].age / F._arcLive[0].life) * Math.PI),
        aOk: Math.abs(c.ax - g.x) < 0.1 &&
          Math.abs(c.ay - (g.y + 12.4)) < 0.1,
        drawRange: F.arcs.geometry.drawRange.count,
        inFrame: pts.every(p => p[0] >= 0 && p[0] <= 900 &&
                          p[1] >= 0 && p[1] <= 600),
      };
    });
    check('M7.3: screenshot with both anchor types in frame (shots/m73-arcs.png)',
      fs.existsSync(`${here}/shots/m73-arcs.png`) &&
      shotSt.count === 2 && shotSt.fade > 0.5 && shotSt.aOk &&
      shotSt.inFrame &&
      shotSt.drawRange === 2 * shotSt.count * 21,
      `count=${shotSt.count}, fade=${shotSt.fade.toFixed(2)},` +
      ` inFrame=${shotSt.inFrame}`);
    await page.waitForFunction(() => window.SIM.FX.arcCount === 0,
      { timeout: 10000 });
  }

  /* ------------------------------------------------------------------
   * M7.4 — screen-space flash: additive overlay plane driven by
   *        FX.flash(intensity)
   *
   *  One additive plane (2×2 NDC, toneMapped-off MeshBasicMaterial) in
   *  a tiny overlay scene + ortho NDC camera, rendered after the main
   *  scene ONLY while the level is > 0 ⇒ 0 flash = 0 draw calls
   *  added. Level clamps to 0..CFG.fx.flash.max, re-trigger = max
   *  (never accumulates), exponential decay (τ = CFG.fx.flash.decay)
   *  with a snap to 0. Dev trigger: Key B. renderer.info is reset
   *  once per frame (autoReset off) so the reported call count
   *  accumulates over the main + overlay renders.
   * ------------------------------------------------------------------ */
  {
    const reg = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      const m = F._flashMat;
      return {
        hasPlane: !!F._flashPlane,
        inOverlay: F._flashScene.children.includes(F._flashPlane) &&
          !S.scene.children.includes(F._flashPlane),
        additive: m.blending === 2,        // THREE.AdditiveBlending
        transparent: m.transparent === true,
        noDepth: m.depthTest === false && m.depthWrite === false,
        noTone: m.toneMapped === false,
        autoResetOff: S.renderer.info.autoReset === false,
        max: S.CFG.fx.flash.max,
        decay: S.CFG.fx.flash.decay,
        level: F._flash,
        visible: F._flashPlane.visible,
      };
    });
    check('M7.4: FX flash registered — one additive plane in a separate overlay scene, hidden at 0 flash (per-frame info reset)',
      reg.hasPlane && reg.inOverlay && reg.additive && reg.transparent &&
      reg.noDepth && reg.noTone && reg.autoResetOff &&
      reg.max === 1 && reg.decay > 0 && reg.level === 0 && !reg.visible,
      `max=${reg.max}, decay=${reg.decay}, level=${reg.level}`);

    /* idle cost zero: 0 flash ⇒ the overlay is never rendered ⇒ the
     * per-frame call count is stable (ambient variable meshes hidden) */
    const parity = await page.evaluate(async () => {
      const S = window.SIM;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const sample = async n => {
        const a = [];
        for (let i = 0; i < n; i++) {
          a.push(S.renderer.info.render.calls);
          await sleep(120);
        }
        return a;
      };
      const P = S.PARTS;
      P.smesh.visible = false;
      P.spoints.visible = false;
      await sleep(150);   // let the hide land in a rendered frame
      const zero = await sample(4);
      P.smesh.visible = true;
      P.spoints.visible = true;
      return { zero, hidden: S.FX._flashPlane.visible === false };
    });
    const stable = a => a.every(v => v === a[0]);
    const base = parity.zero[0];
    check('M7.4: idle = zero added draw calls (overlay not rendered at 0 flash, stable calls)',
      stable(parity.zero) && parity.hidden,
      `zero=${parity.zero.join()}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();

    /* manual key B flashes the screen: level > 0, plane visible,
     * exactly +1 draw call (the one overlay plane); material color =
     * tint × level (a uniform positive scalar on the tint) */
    await page.keyboard.press('b');
    await page.waitForFunction(() => window.SIM.FX._flash > 0,
      { timeout: 5000 });
    const f0 = await page.evaluate(async () => {
      const S = window.SIM, F = S.FX;
      const P = S.PARTS;
      P.smesh.visible = false;
      P.spoints.visible = false;
      await new Promise(r => setTimeout(r, 120));
      const calls = S.renderer.info.render.calls;
      P.smesh.visible = true;
      P.spoints.visible = true;
      const c = F._flashMat.color, t = F._flashTint;
      const kr = c.r / t.r, kg = c.g / t.g, kb = c.b / t.b;
      return {
        level: F._flash,
        visible: F._flashPlane.visible,
        calls,
        colorOk: Math.min(kr, kg, kb) > 0.05 &&
          Math.max(kr, kg, kb) - Math.min(kr, kg, kb) < 0.05,
      };
    });
    check('M7.4: key B flashes the screen — plane visible, exactly +1 draw call (the one overlay plane)',
      f0.level > 0 && f0.visible && f0.calls === base + 1,
      `level=${f0.level.toFixed(2)}, calls=${f0.calls} (idle=${base})`);
    check('M7.4: overlay material color = tint × level (the additive amount)',
      f0.colorOk, `level=${f0.level.toFixed(2)}`);

    /* decay: monotonically decreasing, resolves to exactly 0, the
     * overlay is hidden again and the call count is back to idle */
    const decay = await page.evaluate(async () => {
      const S = window.SIM, F = S.FX;
      const rows = [];
      for (let i = 0; i < 8; i++) {
        await new Promise(r => requestAnimationFrame(r));
        rows.push(F._flash);
      }
      return rows;
    });
    const monotone = decay.every((v, i) => i === 0 || v <= decay[i - 1]);
    const strict = decay.slice(0, -1).some((v, i) => decay[i + 1] < v);
    await page.waitForFunction(() => window.SIM.FX._flash === 0,
      { timeout: 5000 });
    const resolved = await page.evaluate(async () => {
      const S = window.SIM;
      const P = S.PARTS;
      P.smesh.visible = false;
      P.spoints.visible = false;
      await new Promise(r => setTimeout(r, 120));
      const calls = S.renderer.info.render.calls;
      P.smesh.visible = true;
      P.spoints.visible = true;
      return { calls, visible: S.FX._flashPlane.visible, level: S.FX._flash };
    });
    check('M7.4: flash decays to zero (monotone, resolves clean — overlay hidden, calls back to idle)',
      monotone && strict && resolved.level === 0 &&
      resolved.visible === false && resolved.calls === base,
      `calls=${resolved.calls} (idle=${base})`);

    /* API semantics: intensity clamps to 0..max, a re-trigger never
     * accumulates, color is honoured (hex) and reset (default) */
    const api = await page.evaluate(() => {
      const S = window.SIM, F = S.FX;
      F._flash = 0;
      const half = F.flash(0.5);
      const clamped = F.flash(2);           // clamps to max 1
      const neg = F.flash(-1);              // clamps to 0 ⇒ no-op
      F._flash = 0;
      F.flash(0.8); F.flash(0.8);           // re-trigger ⇒ max, not sum
      const re = F._flash;
      F.flash(0.5, 0xff0000);
      const red = F._flashTint.r > 0.9 &&
        F._flashTint.g < 0.1 && F._flashTint.b < 0.1;
      F.flash(0.5);                         // no color ⇒ default tint
      const ref = new F._flashTint.constructor();
      ref.setHex(S.CFG.fx.flash.color);
      const def = Math.abs(F._flashTint.r - ref.r) < 1e-6 &&
        Math.abs(F._flashTint.g - ref.g) < 1e-6 &&
        Math.abs(F._flashTint.b - ref.b) < 1e-6;
      F._flash = 0; F._flashPlane.visible = false;
      return { half, clamped, neg, re, red, def };
    });
    check('M7.4: FX.flash(intensity, color) semantics — clamps to 0..max, re-trigger never accumulates, color honoured + default reset',
      api.half === 0.5 && api.clamped === 1 && api.neg === 1 &&
      api.re === 0.8 && api.red && api.def,
      `half=${api.half}, clamped=${api.clamped}, neg=${api.neg},` +
      ` re=${api.re}`);

    /* heap flat across the whole flash sequence */
    const heapAfter = await heapMin();
    check('M7.4: no allocation per flash (heap flat across the flash sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);

    /* visual gate: full-screen flash — deterministic pose (seeded
     * city + fixed camera, same pose as M7.3). Mean luminance of the
     * flash shot must sit well above the idle shot at the same pose
     * (both decoded in-page via dataURL → 2D canvas) */
    const lum = b64 => page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4)
        s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return s / (d.length / 4);
    }, b64);

    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(-180, 40, 180);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.fov = 60;                  // reset wheel zoom ⇒ deterministic pose
      S.CAMERA.yaw = 2.22;
      S.CAMERA.pitch = -0.35;
    });
    await sleep(800);
    const idleLum = await lum((await page.screenshot()).toString('base64'));
    await page.evaluate(() => window.SIM.FX.flash(1));
    await sleep(120);
    await page.evaluate(() => window.SIM.FX.flash(1));   // re-raise for the grab
    /* read the level before the grab: the flash decays (τ 0.3 s) and
     * a headless screenshot can take >100 ms, so a post-shot read
     * races the decay (known M7.4 timing flake) */
    const lvl = await page.evaluate(() => window.SIM.FX._flash);
    const flashShot = await page.screenshot(
      { path: `${here}/shots/m74-flash.png` });
    const flashLum = await lum(flashShot.toString('base64'));
    check('M7.4: screenshot shows the full-screen flash (shots/m74-flash.png) — mean luminance well above the idle pose',
      fs.existsSync(`${here}/shots/m74-flash.png`) &&
      lvl > 0.3 && flashLum > idleLum + 25,
      `lvl=${lvl.toFixed(2)}, idle=${idleLum.toFixed(1)},` +
      ` flash=${flashLum.toFixed(1)}`);
    await page.waitForFunction(() => window.SIM.FX._flash === 0,
      { timeout: 5000 });
  }

  /* ------------------------------------------------------------------
   * M7.5 — camera shake: impulse decay consumed by CAMERA
   *
   *  One energy scalar on CAMERA (no pool, no mesh, no material):
   *  shake(intensity) adds energy clamped to CFG.input.shakeCap ⇒
   *  repeated triggers accumulate up to the cap and then hold (never
   *  run away). Every frame _applyShake adds a FRESH transient offset
   *  to camera.position (never written into CAMERA.pos — nothing
   *  accumulates into the pose) and _decayShake drains the energy to
   *  exactly 0 (linear, −dt × CFG.input.shakeDecay). Dev trigger:
   *  Key N. No objects allocated, nothing rendered ⇒ idle cost is
   *  structurally zero (0 energy ⇒ _applyShake early-returns).
   * ------------------------------------------------------------------ */
  {
    const reg = await page.evaluate(() => {
      const S = window.SIM;
      return {
        amp: S.CFG.input.shakeAmp,
        decay: S.CFG.input.shakeDecay,
        cap: S.CFG.input.shakeCap,
        impulse: S.CFG.input.shakeImpulse,
        hasApi: typeof S.CAMERA.shake === 'function',
        energy: S.CAMERA.shakeEnergy,
        trigger: S.INPUT.shakeTrigger,
      };
    });
    check('M7.5: camera shake registered — CFG.input tunables, CAMERA.shake API, energy 0, Key N trigger idle',
      reg.hasApi && reg.amp > 0 && reg.decay > 0 && reg.cap > 0 &&
      reg.impulse > 0 && reg.energy === 0 && reg.trigger === false,
      `amp=${reg.amp}, decay=${reg.decay}, cap=${reg.cap},` +
      ` impulse=${reg.impulse}`);

    /* idle cost zero: 0 energy ⇒ _applyShake early-returns ⇒ the
     * camera position is untouched (nothing to allocate, nothing to
     * render — the shake adds no objects at all) */
    const idle = await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.shakeEnergy = 0;
      const p = S.camera.position.clone();
      S.CAMERA._applyShake(0.123);
      S.CAMERA._applyShake(987.654);
      return { untouched: S.camera.position.equals(p) };
    });
    check('M7.5: idle cost zero — 0 energy ⇒ _applyShake is a no-op (no objects, no materials, no draw calls)',
      idle.untouched);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();

    /* deterministic still pose: fixed pos, zero velocity, no input ⇒
     * any offset from CAMERA.pos is the shake alone */
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(-180, 40, 180);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.fov = 60;                  // reset wheel zoom ⇒ deterministic pose
      S.CAMERA.yaw = 2.22;
      S.CAMERA.pitch = -0.35;
    });
    await sleep(400);

    /* manual Key N shakes: energy rises, the camera position is
     * offset from the pose, bounded by shakeAmp × energy, and the
     * offset changes frame to frame (the camera actually shakes —
     * fresh transient offset each frame, never written into the pose) */
    await page.keyboard.press('n');
    await page.waitForFunction(() => window.SIM.CAMERA.shakeEnergy > 0,
      { timeout: 5000 });
    const s0 = await page.evaluate(async () => {
      const S = window.SIM, C = S.CAMERA;
      const e = C.shakeEnergy;
      const bounds = [];
      const mags = [];
      for (let i = 0; i < 4; i++) {
        const o = S.camera.position.clone().sub(C.pos).length();
        mags.push(o);
        /* frame-consistent bound: the offset comes from the last
         * rendered frame (energy ≥ e — it only decays) ⇒ it is
         * bounded by amp × the energy at sampling start */
        bounds.push(o <= S.CFG.input.shakeAmp * e + 1e-6);
        await new Promise(r => requestAnimationFrame(r));
      }
      const lo = Math.min(...mags), hi = Math.max(...mags);
      return { e, mags, bounded: bounds.every(Boolean),
        varying: lo > 1e-4 && hi - lo > 1e-3 };
    });
    check('M7.5: key N shakes the camera — offset from the pose, bounded by shakeAmp × energy, varies frame to frame',
      s0.e > 0 && s0.bounded && s0.varying,
      `e=${s0.e.toFixed(2)}, mags=${s0.mags.map(v => v.toFixed(3)).join(',')}`);

    /* clean decay: energy monotone to exactly 0, then the camera
     * returns EXACTLY to the pose (0 energy ⇒ _applyShake skipped ⇒
     * position = pose, no residual offset) */
    const decay = await page.evaluate(async () => {
      const S = window.SIM;
      const rows = [];
      for (let i = 0; i < 10; i++) {
        await new Promise(r => requestAnimationFrame(r));
        rows.push(S.CAMERA.shakeEnergy);
      }
      return rows;
    });
    const monotone = decay.every(
      (v, i) => i === 0 || v <= decay[i - 1] + 1e-9);
    const strict = decay.slice(0, -1).some(
      (v, i) => decay[i + 1] < v - 1e-9);
    await page.waitForFunction(() => window.SIM.CAMERA.shakeEnergy === 0,
      { timeout: 5000 });
    const still = await page.evaluate(() => {
      const S = window.SIM, C = S.CAMERA;
      return { energy: C.shakeEnergy,
        off: S.camera.position.clone().sub(C.pos).length() };
    });
    check('M7.5: shake decays cleanly to still — energy monotone to exactly 0, camera back exactly on the pose',
      monotone && strict && still.energy === 0 && still.off === 0,
      `energy=${still.energy}, off=${still.off}`);

    /* never accumulates: rapid re-triggers accumulate up to the cap
     * and then hold — energy never exceeds CFG.input.shakeCap */
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('n');
      await sleep(60);
    }
    const rep = await page.evaluate(() => ({
      energy: window.SIM.CAMERA.shakeEnergy,
      cap: window.SIM.CFG.input.shakeCap,
    }));
    check('M7.5: never accumulates — 10 rapid re-triggers hold at the energy cap',
      rep.energy > 0 && rep.energy <= rep.cap + 1e-9 &&
      rep.energy >= rep.cap * 0.8,
      `energy=${rep.energy.toFixed(2)}, cap=${rep.cap}`);
    await page.waitForFunction(() => window.SIM.CAMERA.shakeEnergy === 0,
      { timeout: 5000 });

    /* API semantics: a huge impulse clamps to the cap (not sum),
     * negative intensity is a no-op */
    const api = await page.evaluate(() => {
      const S = window.SIM, C = S.CAMERA;
      C.shakeEnergy = 0;
      C.shake(10);
      const clamped = C.shakeEnergy;
      C.shakeEnergy = 0;
      C.shake(-1);
      const neg = C.shakeEnergy;
      return { clamped, neg, cap: S.CFG.input.shakeCap };
    });
    check('M7.5: shake(intensity) semantics — huge impulse clamps to the cap, negative is a no-op',
      api.clamped === api.cap && api.neg === 0,
      `clamped=${api.clamped}, neg=${api.neg}`);

    /* heap flat across the whole shake sequence */
    const heapAfter = await heapMin();
    check('M7.5: no allocation per shake (heap flat across the shake sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);
  }

  /* ------------------------------------------------------------------
   * M8.1 — night sky: gradient dome + stars + faint aurora band
   *
   *  ATMOS owns exactly three fog-off meshes — a BackSide gradient
   *  sphere (2400 m), a seeded additive Points star field (tier cap
   *  via drawRange), and a faint additive aurora band (open-ended
   *  cylinder at fixed altitude, slow spin). Everything is pinned to
   *  the camera every frame ⇒ the dome is correct from street,
   *  orbit, and far-fly. 3 draw calls total, zero per-frame
   *  allocation.
   * ------------------------------------------------------------------ */
  {
    const reg = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const domeM = A.dome.material, starsM = A.stars.material,
        aurM = A.aurora.material;
      return {
        inSystems: S.systems.map(x => x.name).includes('ATMOS'),
        children: A.root.children.length,
        shaftGroup: !!A.shaftGroup && A.root.children.includes(A.shaftGroup),
        dome: A.dome.geometry.type === 'SphereGeometry' &&
          domeM.side === 1 && domeM.fog === false &&   // 1 = BackSide
          domeM.depthWrite === false && domeM.map !== null,
        stars: A.stars.geometry.type === 'BufferGeometry' &&
          starsM.blending === 2 && starsM.fog === false &&
          starsM.vertexColors === true && starsM.map !== null &&
          starsM.sizeAttenuation === false,
        starCount: A.stars.geometry.attributes.position.count,
        drawRange: A.stars.geometry.drawRange.count,
        aurora: A.aurora.geometry.type === 'CylinderGeometry' &&
          aurM.blending === 2 && aurM.fog === false &&
          aurM.side === 1 && aurM.transparent === true &&   // 1 = BackSide
          aurM.opacity > 0 && aurM.opacity <= 0.6,
        radius: S.CFG.atmos.dome.radius,
        far: S.camera.far,
      };
    });
    check('M8.1: ATMOS registered — gradient dome (BackSide, fog-off), additive stars, faint additive aurora band',
      reg.inSystems && reg.children === 5 && reg.dome && reg.stars &&
      reg.aurora && reg.shaftGroup && reg.radius < reg.far,
      `stars=${reg.starCount}, drawRange=${reg.drawRange}`);

    /* camera follow: move the camera to a fixed pose — the dome and
     * stars must track it exactly, the aurora rides above it at the
     * configured altitude */
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(300, 30, -400);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.fov = 60;
      S.CAMERA.yaw = 1.1;
      S.CAMERA.pitch = -0.2;
    });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(
      () => requestAnimationFrame(r))));
    const follow = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS, cam = S.camera.position;
      return {
        dome: A.dome.position.distanceTo(cam) < 1e-6,
        stars: A.stars.position.distanceTo(cam) < 1e-6,
        auroraXZ: Math.abs(A.aurora.position.x - cam.x) < 1e-6 &&
          Math.abs(A.aurora.position.z - cam.z) < 1e-6,
        auroraY: Math.abs(A.aurora.position.y - S.CFG.atmos.aurora.altitude) < 1e-6,
      };
    });
    check('M8.1: dome + stars track the camera, aurora rides above it at the configured altitude',
      follow.dome && follow.stars && follow.auroraXZ && follow.auroraY);

    /* exactly +3 draw calls vs hidden; total inside budget */
    /* other systems add transient draw calls (drones, arcs) — sample
     * the min over several frames per state and retry until the delta
     * is clean */
    const calls = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const minCalls = async n => {
        let m = Infinity;
        for (let i = 0; i < n; i++) {
          await new Promise(r => setTimeout(r, 100));
          m = Math.min(m, S.renderer.info.render.calls);
        }
        return m;
      };
      let hidden, shown, tries = 0;
      do {
        A.root.visible = false;
        hidden = await minCalls(6);
        A.root.visible = true;
        shown = await minCalls(6);
        tries++;
      } while (shown - hidden !== 3 && tries < 3);
      return { hidden, shown };
    });
    check('M8.1: exactly +3 draw calls (dome + stars + aurora), total inside budget (< 150)',
      calls.shown === calls.hidden + 3 && calls.shown < 150,
      `hidden=${calls.hidden}, shown=${calls.shown}`);

    /* star tier cap: drawRange only (no allocation) */
    const tier = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const cap = k => S.CFG.atmos.stars.tiers[k];
      S.TIER.set('low');
      await new Promise(r => setTimeout(r, 150));
      const low = A.stars.geometry.drawRange.count;
      S.TIER.set('high');
      await new Promise(r => setTimeout(r, 150));
      const high = A.stars.geometry.drawRange.count;
      return { low, high, wantLow: cap('low'), wantHigh: cap('high'),
        count: A.stars.geometry.attributes.position.count };
    });
    check('M8.1: star tier cap via drawRange (low/high), full set pre-allocated',
      tier.low === tier.wantLow && tier.high === tier.wantHigh &&
      tier.count === tier.wantHigh,
      `low=${tier.low}, high=${tier.high}`);

    /* aurora spin animates (slow drift, deterministic t × spin) */
    const spin = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const a = A.aurora.rotation.y;
      await new Promise(r => setTimeout(r, 250));
      return { a, b: A.aurora.rotation.y };
    });
    check('M8.1: aurora band animates (slow spin)',
      spin.b > spin.a && spin.b - spin.a > 1e-4,
      `Δ=${(spin.b - spin.a).toFixed(5)}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    /* visual gate: three camera distances. Each pose gets an
     * ATMOS-on/off screenshot pair (decoded in-page via dataURL → 2D
     * canvas); the top 55 % of the frame is the sky region. On must
     * beat off on: mean luminance (dome gradient), bright pixel
     * count (stars), greenish pixel count (aurora band). The
     * on-shot is saved as the milestone screenshot. */
    /* sky region = top 55 % of the frame, x >= 25 % (the top-left
     * corner holds the FPS HUD text — excluded). Decoded in-page via
     * dataURL → 2D canvas. */
    const skyStats = b64 => page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const x0 = Math.floor(c.width * 0.25);
      const h = Math.floor(c.height * 0.55);
      const d = ctx.getImageData(x0, 0, c.width - x0, h).data;
      let sum = 0, bright = 0, green = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += l;
        if (l > 120) bright++;
        if (g > b + 8 && g > r + 8 && g > 25) green++;
      }
      const n = d.length / 4;
      return { mean: sum / n, bright, green };
    }, b64);

    /* all three poses look ~14° up: the horizon-glow band (dome),
     * the low star band, and the ~11° aurora band are all in the
     * top 55 % region (the sky region) — where the void background
     * (ATMOS hidden) is near-black */
    const poses = [
      { name: 'street', mode: 'GROUND', pos: [-180, 4, 180],
        yaw: 2.22, pitch: -0.25, aurora: true },
      { name: 'orbit', mode: 'CINE', pos: [0, 60, 260],
        yaw: 0, pitch: -0.25, aurora: true },
      { name: 'far', mode: 'CINE', pos: [700, 140, 700],
        yaw: 0.785, pitch: -0.3, aurora: true },
    ];
    for (const pose of poses) {
      await page.evaluate(({ mode, pos, yaw, pitch }) => {
        const S = window.SIM, C = S.CAMERA;
        C.setMode(mode);
        C.pos.set(pos[0], pos[1], pos[2]);
        C.vel.set(0, 0, 0);
        C.fov = 60;                     // reset wheel zoom ⇒ deterministic pose
        C.yaw = yaw;
        C.pitch = pitch;
      }, pose);
      await sleep(400);
      /* 2-pair averaged (the scene animates: drones, sky vehicles,
       * aurora spin) — same pattern as the M8.2/M8.3 luminance gates */
      let offMean = 0, onMean = 0, offBright = 0, onBright = 0,
        offGreen = 0, onGreen = 0;
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
          window.SIM.ATMOS.root.visible = false;
        });
        await sleep(150);
        const offB64 = (await page.screenshot()).toString('base64');
        await page.evaluate(() => {
          window.SIM.ATMOS.root.visible = true;
        });
        await sleep(150);
        const onShot = await page.screenshot(
          { path: `${here}/shots/m81-sky-${pose.name}.png` });
        const offS = await skyStats(offB64);
        const onS = await skyStats(onShot.toString('base64'));
        offMean += offS.mean; onMean += onS.mean;
        offBright += offS.bright; onBright += onS.bright;
        offGreen += offS.green; onGreen += onS.green;
      }
      const off = {
        mean: offMean / 2, bright: offBright / 2, green: offGreen / 2,
      };
      const on = {
        mean: onMean / 2, bright: onBright / 2, green: onGreen / 2,
      };
      check(`M8.1: ${pose.name} sky renders (shots/m81-sky-${pose.name}.png) — dome brighter than the void background`,
        fs.existsSync(`${here}/shots/m81-sky-${pose.name}.png`) &&
        on.mean > off.mean + 2,
        `mean ${off.mean.toFixed(1)} → ${on.mean.toFixed(1)}`);
      check(`M8.1: ${pose.name} sky shows stars (bright sky pixels)`,
        on.bright > off.bright + 40 && on.bright > 0,
        `bright ${off.bright} → ${on.bright}`);
      if (pose.aurora) {
        check(`M8.1: ${pose.name} view shows the faint aurora band (greenish sky pixels)`,
          on.green > off.green + 30 && on.green > 0,
          `green ${off.green} → ${on.green}`);
      }
    }

    /* back to a neutral pose for the tail checks */
    await page.evaluate(() => {
      const S = window.SIM, C = S.CAMERA;
      C.setMode('GROUND');
      C.pos.set(-180, 40, 180);
      C.vel.set(0, 0, 0);
      C.fov = 60;
      C.yaw = 2.22;
      C.pitch = -0.35;
    });

    /* heap flat across pure animation frames (the camera teleports
     * and screenshots above are harness costs, not ATMOS) */
    const heapBefore = await heapMin();
    await sleep(600);
    const heapAfter = await heapMin();
    check('M8.1: no allocation per frame (heap flat across the sky sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);
  }

  /* ------------------------------------------------------------------
   * M8.2 — fog depth tune + zone-tinted haze (cyan core / warm avenues)
   *
   *  The scene FogExp2 density is tuned so depth stays readable at
   *  500 m, and the fog color smoothstep-lerps (pre-allocated
   *  colors, zero per-frame allocation) from a cyan haze in the core
   *  to a warm haze in the outer avenues as the camera crosses the
   *  M3 zone boundaries (220 / 520 m from the plaza). The dome
   *  horizon tint syncs with the haze.
   * ------------------------------------------------------------------ */
  {
    /* depth tune: analytic FogExp2 factor bounds (three.js FogExp2:
     * factor(d) = 1 − exp(−(ρ·d)²)) */
    const fogTune = await page.evaluate(() => {
      const S = window.SIM;
      const f = d => 1 - Math.exp(-Math.pow(S.scene.fog.density * d, 2));
      return { density: S.scene.fog.density, f100: f(100), f500: f(500) };
    });
    check('M8.2: fog depth tuned — street range clear, 500 m hazed but readable',
      fogTune.density < 0.004 && fogTune.f100 <= 0.15 &&
      fogTune.f500 >= 0.70 && fogTune.f500 <= 0.92,
      `ρ=${fogTune.density}, f(100)=${(fogTune.f100 * 100).toFixed(1)}%,` +
      ` f(500)=${(fogTune.f500 * 100).toFixed(1)}%`);

    /* zone lerp: analytic fog color at core / mid / outer poses
     * (camera XZ distance from the plaza: 150 / 370 / 700 m ⇒
     *  k = 0 / 0.5 / 1 on the 220–520 m smoothstep) */
    const zoneLerp = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const fogAt = async (x, y, z) => {
        const C = S.CAMERA;
        C.setMode('CINE');
        C.pos.set(x, y, z); C.vel.set(0, 0, 0);
        C.fov = 60; C.yaw = 0; C.pitch = -0.12;
        await new Promise(r => setTimeout(r, 150));
        const f = S.scene.fog.color, m = A.dome.material.color;
        return { r: f.r, g: f.g, b: f.b, domeR: m.r, domeG: m.g, domeB: m.b };
      };
      const core = await fogAt(0, 60, 150);     // d = 150 < 220 ⇒ k = 0
      const mid = await fogAt(0, 60, 370);      // d = 370 ⇒ k = 0.5
      const outer = await fogAt(0, 60, 700);    // d = 700 > 520 ⇒ k = 1
      return { core, mid, outer };
    });
    check('M8.2: fog color lerps cyan (core) → warm (outer avenues) across zones',
      zoneLerp.core.b > zoneLerp.core.r &&
      zoneLerp.outer.r > zoneLerp.outer.b &&
      zoneLerp.core.r < zoneLerp.mid.r && zoneLerp.mid.r < zoneLerp.outer.r &&
      zoneLerp.core.b > zoneLerp.mid.b && zoneLerp.mid.b > zoneLerp.outer.b,
      `core=(${zoneLerp.core.r.toFixed(4)},${zoneLerp.core.g.toFixed(4)},${zoneLerp.core.b.toFixed(4)},` +
      ` outer=(${zoneLerp.outer.r.toFixed(4)},${zoneLerp.outer.g.toFixed(4)},${zoneLerp.outer.b.toFixed(4)})`);
    check('M8.2: mid-zone fog color is the lerp midpoint (smoothstep k = 0.5)',
      Math.abs(zoneLerp.mid.r - (zoneLerp.core.r + zoneLerp.outer.r) / 2) < 0.002 &&
      Math.abs(zoneLerp.mid.g - (zoneLerp.core.g + zoneLerp.outer.g) / 2) < 0.002 &&
      Math.abs(zoneLerp.mid.b - (zoneLerp.core.b + zoneLerp.outer.b) / 2) < 0.002,
      `mid=(${zoneLerp.mid.r.toFixed(4)},${zoneLerp.mid.g.toFixed(4)},${zoneLerp.mid.b.toFixed(4)})`);
    check('M8.2: dome horizon tint syncs with the haze (cool in the core, warm outside)',
      zoneLerp.core.domeB > zoneLerp.core.domeR &&
      zoneLerp.outer.domeR > zoneLerp.outer.domeB,
      `core dome=(${zoneLerp.core.domeR.toFixed(3)},${zoneLerp.core.domeG.toFixed(3)},${zoneLerp.core.domeB.toFixed(3)},` +
      ` outer dome=(${zoneLerp.outer.domeR.toFixed(3)},${zoneLerp.outer.domeG.toFixed(3)},${zoneLerp.outer.domeB.toFixed(3)})`);

    /* city-region pixel stats: bottom 55 % of the frame (the city,
     * below the horizon) — mean luminance, horizontal edge detail
     * (structure survives ⇒ readable), and warmth (mean R − mean B)
     * for the zone-tint check. Decoded in-page via dataURL → 2D
     * canvas. */
    const cityStats = b64 => page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const y0 = Math.floor(c.height * 0.45);
      const h = c.height - y0;
      const d = ctx.getImageData(0, y0, c.width, h).data;
      const prev = new Float32Array(c.width);
      let sum = 0, rSum = 0, bSum = 0, edges = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          sum += l; rSum += d[i]; bSum += d[i + 2];
          if (x > 0 && Math.abs(l - prev[x - 1]) > 10) edges++;
          prev[x] = l;
        }
      }
      const n = c.width * h;
      return { mean: sum / n, warmth: (rSum - bSum) / n, edges };
    }, b64);

    /* visual gate 1 — depth readable at 500 m: deterministic pose
     * 520 m from the plaza looking back at the city; fog-on vs
     * fog-off screenshot pair. The city region must keep a solid
     * share of its mean luminance AND its edge detail through the
     * haze (swallowed city ⇒ flat haze ⇒ detail collapses). The
     * on-shot is saved as the milestone screenshot. */
    await page.evaluate(() => {
      const S = window.SIM, C = S.CAMERA;
      C.setMode('CINE');
      C.pos.set(0, 80, 520); C.vel.set(0, 0, 0);
      C.fov = 60; C.yaw = 0; C.pitch = -0.15;
    });
    await sleep(450);
    const depthOnShot = await page.screenshot(
      { path: `${here}/shots/m82-fog-500m.png` });
    /* fog-off reference via density 0 (NOT scene.fog = null — ATMOS
     * reads scene.fog.color every frame, and a null fog would throw
     * and disable the subsystem for the rest of the session) */
    await page.evaluate(() => {
      const S = window.SIM;
      S._fogDensityBackup = S.scene.fog.density;
      S.scene.fog.density = 0;
    });
    await sleep(150);
    const depthOffB64 = (await page.screenshot()).toString('base64');
    await page.evaluate(() => {
      const S = window.SIM;
      S.scene.fog.density = S._fogDensityBackup;
    });
    await sleep(150);
    /* a subsystem that throws gets permanently disabled (update =
     * null) — the fog-off reference above must not have triggered it */
    const intact = await page.evaluate(() =>
      window.SIM.systems.every(s => s.update !== null));
    check('M8.2: fog-off reference leaves every subsystem intact (no runtime error)',
      intact);
    const depthOn = await cityStats(depthOnShot.toString('base64'));
    const depthOff = await cityStats(depthOffB64);
    check('M8.2: depth readable at 500 m (shots/m82-fog-500m.png) — city survives the haze',
      fs.existsSync(`${here}/shots/m82-fog-500m.png`) &&
      depthOn.mean >= 0.5 * depthOff.mean &&
      depthOn.edges >= 0.25 * depthOff.edges,
      `mean ${depthOff.mean.toFixed(1)} → ${depthOn.mean.toFixed(1)},` +
      ` edges ${depthOff.edges} → ${depthOn.edges}`);

    /* visual gate 2 — zone tint visible flying across zones: same
     * look (CINE, yaw 0, pitch −0.12, fov 60) from inside the core
     * zone (d = 150 m) and the outer zone (d = 700 m); the city
     * region must be measurably warmer (mean R − mean B) in the
     * outer zone. Both shots saved. */
    const zoneShot = async (name, x, y, z) => {
      await page.evaluate(([x, y, z]) => {
        const S = window.SIM, C = S.CAMERA;
        C.setMode('CINE');
        C.pos.set(x, y, z); C.vel.set(0, 0, 0);
        C.fov = 60; C.yaw = 0; C.pitch = -0.12;
      }, [x, y, z]);
      await sleep(450);
      const shot = await page.screenshot({ path: `${here}/shots/${name}.png` });
      return cityStats(shot.toString('base64'));
    };
    const tintCore = await zoneShot('m82-fog-core', 0, 60, 150);
    const tintOuter = await zoneShot('m82-fog-outer', 0, 60, 700);
    check('M8.2: zone tint visible flying across zones (shots/m82-fog-{core,outer}.png) — outer haze warmer than core',
      fs.existsSync(`${here}/shots/m82-fog-core.png`) &&
      fs.existsSync(`${here}/shots/m82-fog-outer.png`) &&
      tintOuter.warmth - tintCore.warmth >= 3,
      `warmth core=${tintCore.warmth.toFixed(2)},` +
      ` outer=${tintOuter.warmth.toFixed(2)}`);

    /* back to a neutral pose for the tail checks */
    await page.evaluate(() => {
      const S = window.SIM, C = S.CAMERA;
      C.setMode('GROUND');
      C.pos.set(-180, 40, 180);
      C.vel.set(0, 0, 0);
      C.fov = 60;
      C.yaw = 2.22;
      C.pitch = -0.35;
    });

    /* heap flat across pure animation frames (the camera teleports
     * and screenshots above are harness costs, not ATMOS) */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();
    await sleep(600);
    const heapAfter = await heapMin();
    check('M8.2: no allocation per frame (heap flat across the fog sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);
  }

  /* ------------------------------------------------------------------
   * M8.3 — volumetric-ish light shafts (key spires + creature core)
   *
   *  ATMOS.shaftGroup holds tiers.high additive spire cones + one
   *  creature core cone. A shaft is only visible when its source is
   *  near (spire radius / core radius) or, for the core, during
   *  awakening (ENTITY.state !== 'DORMANT' — M9 seam). Hidden shafts
   *  cost 0 draw calls ⇒ far away the group is free.
   * ------------------------------------------------------------------ */
  {
    const reg = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const m = s => s.mesh.material;
      return {
        group: !!A.shaftGroup && !!A.shaftGroup.name,
        spires: A.shafts.length,
        capHigh: S.CFG.atmos.shaft.tiers.high,
        allAdditive: A.shafts.every(s =>
          m(s).blending === 2 && m(s).fog === false &&
          m(s).depthWrite === false && m(s).transparent === true &&
          m(s).map !== null && s.mesh.geometry.type === 'CylinderGeometry'),
        core: !!A.coreShaft &&
          A.coreShaft.mesh.geometry.type === 'CylinderGeometry' &&
          m(A.coreShaft).blending === 2 && m(A.coreShaft).fog === false,
        preAlloc: Array.isArray(A._best) && A._best.length ===
          S.CFG.atmos.shaft.tiers.high,
      };
    });
    check('M8.3: light shafts registered — additive fog-off cones in ATMOS.shaftGroup (spire slots + creature core), scan scratch pre-allocated',
      reg.group && reg.spires === reg.capHigh && reg.allAdditive &&
      reg.core && reg.preAlloc,
      `spireShafts=${reg.spires} (cap high=${reg.capHigh}), coreShaft=${reg.core ? 1 : 0}`);

    /* shared helpers */
    /* draw-call measurement: per-pair (group on → off) deltas, median of
     * n pairs — robust against transient one-frame dips from other
     * systems (vehicles, drones); abs = median of the on-samples */
    const medDelta = async n => page.evaluate(async (n) => {
      const S = window.SIM, A = S.ATMOS;
      const d = [], abs = [];
      for (let i = 0; i < n; i++) {
        A.shaftGroup.visible = true;
        await new Promise(r => setTimeout(r, 110));
        const a = S.renderer.info.render.calls;
        abs.push(a);
        A.shaftGroup.visible = false;
        await new Promise(r => setTimeout(r, 110));
        const b = S.renderer.info.render.calls;
        d.push(a - b);
      }
      A.shaftGroup.visible = true;
      d.sort((x, y) => x - y);
      abs.sort((x, y) => x - y);
      return { delta: d[n >> 1], abs: abs[n >> 1] };
    }, n);
    const setPose = (mode, x, y, z, yaw, pitch) => page.evaluate(
      ({ mode, x, y, z, yaw, pitch }) => {
        const C = window.SIM.CAMERA;
        C.setMode(mode);
        C.pos.set(x, y, z);
        C.vel.set(0, 0, 0);
        C.fov = 60;                     // reset wheel zoom ⇒ deterministic
        C.yaw = yaw;
        C.pitch = pitch;
      }, { mode, x, y, z, yaw, pitch });

    /* far pose: a deterministic pose with ZERO fiber spires in the
     * shaft radius. The city always regenerates around the camera, so
     * "far" = a 130 m disc the seeded city happens to leave spire-
     * free — searched on a golden-angle spiral (deterministic, the
     * first zero is stable across runs). */
    const farPose = await page.evaluate(() => {
      const S = window.SIM, W = S.WORLD;
      const R = S.CFG.atmos.shaft.radius, B = W.BLOCK, K = W.CHUNK;
      const cands = [];
      for (let i = 0; i < 2000; i++) {
        const d = 200 + 1400 * Math.sqrt((i + 0.5) / 2000);
        const az = i * 2.399963;
        cands.push([Math.cos(az) * d, 80, Math.sin(az) * d]);
      }
      const count = (px, pz) => {
        const pcx = Math.floor(px / B), pcz = Math.floor(pz / B);
        const pcx2 = Math.floor(pcx / K), pcz2 = Math.floor(pcz / K);
        const n = Math.ceil(R / B);
        let c = 0;
        for (let bx = pcx - n; bx <= pcx + n; bx++)
          for (let bz = pcz - n; bz <= pcz + n; bz++) {
            const ring = Math.max(
              Math.abs(Math.floor(bx / K) - pcx2),
              Math.abs(Math.floor(bz / K) - pcz2));
            if (W.buildingAt(bx, bz, ring, ['fiber'], 0)) c++;
          }
        return c;
      };
      for (const [x, y, z] of cands) if (count(x, z) === 0)
        return { x, y, z };
      return null;
    });
    check('M8.3: far pose exists (a deterministic pose with no spire in the shaft radius)',
      farPose !== null);

    /* near pose: a street-level deterministic candidate with a fiber
     * spire ≤ 45 m away (prefer a tall spire for the visual gate) */
    const nearPose = await page.evaluate(() => {
      const S = window.SIM, W = S.WORLD;
      const B = W.BLOCK, K = W.CHUNK, R = 45;
      const cands = [];
      for (const d of [180, 280, 380])
        for (let a = 0; a < 16; a++) {
          const az = a * Math.PI / 8;
          cands.push([Math.cos(az) * d, 4, Math.sin(az) * d]);
        }
      const scan = (px, pz) => {
        const pcx = Math.floor(px / B), pcz = Math.floor(pz / B);
        const pcx2 = Math.floor(pcx / K), pcz2 = Math.floor(pcz / K);
        const n = Math.ceil(R / B);
        let best = null, total = 0;
        for (let bx = pcx - n; bx <= pcx + n; bx++)
          for (let bz = pcz - n; bz <= pcz + n; bz++) {
            const ring = Math.max(
              Math.abs(Math.floor(bx / K) - pcx2),
              Math.abs(Math.floor(bz / K) - pcz2));
            const c = W.buildingAt(bx, bz, ring, ['fiber'], 0);
            if (!c) continue;
            total++;
            const dx = c.x - px, dz = c.z - pz;
            const d2 = dx * dx + dz * dz;
            /* 30–45 m: near enough for the shaft to read, far enough
             * that the spire + cone are a silhouette, not a wall */
            if (d2 > R * R || d2 < 900) continue;
            if (!best || d2 < best.d2)
              best = { x: c.x, z: c.z, tip: c.hTop, d2 };
          }
        return { best, total };
      };
      let fallback = null;
      for (const [x, y, z] of cands) {
        const { best, total } = scan(x, z);
        if (!best) continue;
        if (!fallback) fallback = { x, y, z, spire: best, total };
        if (best.tip >= 25)
          return { x, y, z, spire: best, total };
      }
      return fallback;
    });
    check('M8.3: near pose exists (a street pose with a fiber spire 30–45 m out)',
      nearPose !== null,
      nearPose ?
        `spire tip=${nearPose.spire.tip.toFixed(1)} m,` +
        ` d=${Math.sqrt(nearPose.spire.d2).toFixed(1)} m,` +
        ` spiresIn45m=${nearPose.total}` : '');

    if (!farPose || !nearPose) {
      /* the two pose checks above already recorded the failure — the
       * remaining M8.3 checks need both poses */
      console.log('  [SKIP] M8.3: remaining checks skipped (pose missing)');
    } else {
      const sp = nearPose.spire;
      /* aim the far pose at the plaza — the AWAKE seam's core shaft
       * (at the plaza) must be in frame to be drawn */
      const farYaw = Math.atan2(farPose.x, farPose.z);

      /* absent far away: every shaft hidden, 0 draw-call delta vs the
       * group hidden (no permanent draw calls) */
      await setPose('CINE', farPose.x, farPose.y, farPose.z, farYaw, -0.1);
      await page.evaluate(() => window.SIM.ATMOS._refreshShafts());
      await sleep(3400);   // forced scan + full opacity ease-out (τ ≈ 2.9 s)
      const farState = await page.evaluate(() => {
        const S = window.SIM, A = S.ATMOS;
        return {
          spireVisible: A.shafts.filter(s => s.mesh.visible).length,
          coreVisible: A.coreShaft.mesh.visible,
        };
      });
      const farCalls = await medDelta(7);
      check('M8.3: absent far away — every shaft hidden, 0 permanent draw calls',
        farState.spireVisible === 0 && farState.coreVisible === false &&
        farCalls.delta === 0 && farCalls.abs < 150,
        `shown=${farCalls.abs}, delta=${farCalls.delta}`);
      await page.screenshot({ path: `${here}/shots/m83-shafts-far.png` });

      /* stand near the spire looking at its tip */
      const nd = Math.sqrt(sp.d2);
      const yaw = Math.atan2(-(sp.x - nearPose.x), -(sp.z - nearPose.z));
      /* positive pitch = look up (CAMERA._camDir convention) */
      const pitch = Math.min(
        1.2, Math.max(0.1, Math.atan2(sp.tip - nearPose.y, nd) * 0.85));
      await setPose('GROUND', nearPose.x, nearPose.y, nearPose.z, yaw, pitch);
      await page.evaluate(() => window.SIM.ATMOS._refreshShafts());
      await sleep(3000);   // forced scan + opacity ease-in settle
      const nearState = await page.evaluate(() => {
        const S = window.SIM, A = S.ATMOS;
        const vis = A.shafts.filter(s => s.mesh.visible);
        /* frustum-culled cones are not drawn — count only the visible
         * shafts whose tip projects inside NDC (scratch vector, no
         * allocation) */
        /* exact renderer culling: the 6 frustum planes of P×V vs the
         * cone bounding sphere — the same test WebGLRenderer runs
         * (a cone is drawn even when its tip projects off-frame) */
        const P = S.camera.projectionMatrix.elements;
        const V = S.camera.matrixWorldInverse.elements;
        const M = new Array(16);
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 4; c++) {
            let acc = 0;
            for (let k = 0; k < 4; k++) acc += P[r + 4 * k] * V[k + 4 * c];
            M[r + 4 * c] = acc;
          }
        /* same extraction as Frustum.setFromProjectionMatrix:
         * plane i = row3 ± rowi, normalised (constant from the w part) */
        const row = i => [M[i], M[i + 4], M[i + 8], M[i + 12]];
        const r3 = row(3);
        const planes = [];
        for (const i of [0, 1, 2])
          for (const sgn of [1, -1]) {
            const ri = row(i);
            const nx = r3[0] + sgn * ri[0], ny = r3[1] + sgn * ri[1],
                  nz = r3[2] + sgn * ri[2];
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const nw = r3[3] + sgn * ri[3];
            planes.push([nx / len, ny / len, nz / len, nw / len]);
          }
        const L = S.CFG.atmos.shaft.len,
              RB = S.CFG.atmos.shaft.rBottom;
        const bRadius = Math.sqrt((L / 2) * (L / 2) + RB * RB);
        let inFrame = 0;
        for (const s of vis) {
          const p = s.mesh.position;
          let out = false;
          for (const pl of planes)
            if (pl[0] * p.x + pl[1] * p.y + pl[2] * p.z + pl[3] < -bRadius) {
              out = true;
              break;
            }
          if (!out) inFrame++;
        }
        return {
          visible: vis.length,
          inFrame,
          coreVisible: A.coreShaft.mesh.visible,
          anchors: vis.map(s => ({ x: s.x, z: s.z, tip: s.tip })),
          cap: S.CFG.atmos.shaft.tiers.high,
        };
      });
      /* every visible anchor must replay through the seeded path as a
       * real fiber spire (the same buildingAt replay the system uses) */
      const anchorsReal = await page.evaluate(anchors => {
        const S = window.SIM, W = S.WORLD;
        const B = W.BLOCK, K = W.CHUNK;
        const pcx2 = Math.floor(Math.floor(S.CAMERA.pos.x / B) / K);
        const pcz2 = Math.floor(Math.floor(S.CAMERA.pos.z / B) / K);
        return anchors.every(a => {
          const bx = Math.floor(a.x / B), bz = Math.floor(a.z / B);
          const ring = Math.max(
            Math.abs(Math.floor(bx / K) - pcx2),
            Math.abs(Math.floor(bz / K) - pcz2));
          const c = W.buildingAt(bx, bz, ring, ['fiber'], 0);
          return c && c.x === a.x && c.z === a.z && c.hTop === a.tip;
        });
      }, nearState.anchors);
      const nearCalls = await medDelta(7);
      check('M8.3: visible near a spire — ≥ 1 shaft, anchors are real seeded fiber spires, +N draw calls (N = in-frame)',
        nearState.visible >= 1 && nearState.visible <= nearState.cap &&
        anchorsReal && nearState.inFrame >= 1 &&
        nearCalls.delta === nearState.inFrame &&
        nearCalls.abs < 150,
        `visible=${nearState.visible} (cap ${nearState.cap}),` +
        ` inFrame=${nearState.inFrame}, shown=${nearCalls.abs},` +
        ` delta=${nearCalls.delta}`);

      /* tier cap: LOW trims spire shafts to the low cap, HIGH restores
       * the full nearest-N (the scan keeps the nearest N, so the
       * surviving shaft is always the nearest spire) */
      const tierCap = await page.evaluate(async () => {
        const S = window.SIM, A = S.ATMOS;
        const vis = () => A.shafts.filter(s => s.mesh.visible).length;
        /* actual candidate count at the shaft radius (the 45 m search
         * radius above is smaller than the 130 m shaft radius) */
        const W = S.WORLD, R = S.CFG.atmos.shaft.radius,
          B = W.BLOCK, K = W.CHUNK;
        const pcx = Math.floor(S.CAMERA.pos.x / B),
          pcz = Math.floor(S.CAMERA.pos.z / B);
        const pcx2 = Math.floor(pcx / K), pcz2 = Math.floor(pcz / K);
        const n = Math.ceil(R / B);
        let total = 0;
        for (let bx = pcx - n; bx <= pcx + n; bx++)
          for (let bz = pcz - n; bz <= pcz + n; bz++) {
            const ring = Math.max(
              Math.abs(Math.floor(bx / K) - pcx2),
              Math.abs(Math.floor(bz / K) - pcz2));
            const c = W.buildingAt(bx, bz, ring, ['fiber'], 0);
            if (!c) continue;
            const dx = c.x - S.CAMERA.pos.x, dz = c.z - S.CAMERA.pos.z;
            if (dx * dx + dz * dz <= R * R) total++;
          }
        S.TIER.set('low');
        await new Promise(r => setTimeout(r, 3200));
        const low = vis();
        const lowCap = S.CFG.atmos.shaft.tiers.low;
        S.TIER.set('high');
        await new Promise(r => setTimeout(r, 3200));
        const high = vis();
        const highCap = S.CFG.atmos.shaft.tiers.high;
        return { low, lowCap, high, highCap, total };
      });
      check('M8.3: tier cap — LOW trims spire shafts to the low cap, HIGH restores',
        tierCap.low === Math.min(tierCap.total, tierCap.lowCap) &&
        tierCap.high === Math.min(tierCap.total, tierCap.highCap),
        `low=${tierCap.low} (cap ${tierCap.lowCap}),` +
        ` high=${tierCap.high} (cap ${tierCap.highCap}),` +
        ` spiresInRadius=${tierCap.total}`);

      /* visual gate: on/off screenshot pair — the shaft adds light in
       * a vertical strip around the spire (tip projected in-page) */
      const proj = await page.evaluate(({ x, z, tip }) => {
        const S = window.SIM;
        const v = S.ATMOS._corePos.set(x, tip, z);   // scratch, no alloc
        v.project(S.camera);
        return { nx: v.x, ny: v.y };
      }, { x: sp.x, z: sp.z, tip: sp.tip });
      const stripStats = b64 => page.evaluate(async ({ b64, proj }) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = 'data:image/png;base64,' + b64;
        });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        /* vertical strip centred on the projected spire: x ± 8 % of
         * the frame (the light column), top 75 % (the cone hangs
         * below the tip) */
        const cx = Math.round((proj.nx * 0.5 + 0.5) * c.width);
        const x0 = Math.max(0, Math.round(cx - c.width * 0.08));
        const x1 = Math.min(c.width, Math.round(cx + c.width * 0.08));
        const h = Math.floor(c.height * 0.75);
        const d = ctx.getImageData(x0, 0, x1 - x0, h).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        }
        return sum / (d.length / 4);
      }, { b64, proj });
      /* 2 on/off pairs, averaged — the scene animates (stars, LEDs,
       * particles) so a single pair is noisier than the faint shaft */
      let offSum = 0, onSum = 0;
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
          window.SIM.ATMOS.shaftGroup.visible = false;
        });
        await sleep(150);
        offSum += await stripStats(
          (await page.screenshot()).toString('base64'));
        await page.evaluate(() => {
          window.SIM.ATMOS.shaftGroup.visible = true;
        });
        await sleep(150);
        const nearShot = await page.screenshot(
          { path: `${here}/shots/m83-shafts-near.png` });
        onSum += await stripStats(nearShot.toString('base64'));
      }
      const offStrip = offSum / 2, onStrip = onSum / 2;
      check('M8.3: shaft visible standing near a spire (shots/m83-shafts-near.png) — the cone adds light in the strip',
        fs.existsSync(`${here}/shots/m83-shafts-near.png`) &&
        onStrip > offStrip + 0.5,
        `strip mean ${offStrip.toFixed(2)} → ${onStrip.toFixed(2)}`);

      /* awakening seam (M9): at the far pose, ENTITY.state = 'AWAKE'
       * forces the creature core shaft on even with no spire nearby;
       * restoring 'DORMANT' hides it again */
      await setPose('CINE', farPose.x, farPose.y, farPose.z, farYaw, -0.1);
      await page.evaluate(() => window.SIM.ATMOS._refreshShafts());
      await sleep(3400);   // forced scan + fade the near-pose shafts out
      const awake = await page.evaluate(async () => {
        const S = window.SIM, A = S.ATMOS;
        /* per-pair (group on → off) delta, median of n pairs */
        const medDelta = async n => {
          const d = [];
          for (let i = 0; i < n; i++) {
            A.shaftGroup.visible = true;
            await new Promise(r => setTimeout(r, 110));
            const a = S.renderer.info.render.calls;
            A.shaftGroup.visible = false;
            await new Promise(r => setTimeout(r, 110));
            const b = S.renderer.info.render.calls;
            d.push(a - b);
          }
          A.shaftGroup.visible = true;
          d.sort((x, y) => x - y);
          return d[n >> 1];
        };
        /* M9.2: enter via the state machine (a raw state write would
         * self-transition out on the next frame — stateT is stale);
         * hold AWAKE with a huge picked duration for the 3.2 s window */
        S.ENTITY._awakeDur = 1e9;
        S.ENTITY._enterState('AWAKE', performance.now() / 1000);
        await new Promise(r => setTimeout(r, 3200));
        const coreOn = A.coreShaft.mesh.visible;
        const spireOn = A.shafts.filter(s => s.mesh.visible).length;
        const coreDelta = await medDelta(7);
        S.ENTITY._enterState('DORMANT', performance.now() / 1000);
        await new Promise(r => setTimeout(r, 3200));
        const allHidden =
          A.shafts.every(s => !s.mesh.visible) && !A.coreShaft.mesh.visible;
        const restoredDelta = await medDelta(7);
        return {
          coreOn, spireOn, coreDelta,
          allHidden, restoredDelta,
        };
      });
      check('M8.3: awakening seam — AWAKE forces the core shaft on (+1 draw call) far away, DORMANT hides it',
        awake.coreOn && awake.spireOn === 0 && awake.coreDelta === 1 &&
        awake.allHidden && awake.restoredDelta === 0,
        `coreOn=${awake.coreOn}, coreDelta=${awake.coreDelta},` +
        ` restoredDelta=${awake.restoredDelta}`);

      /* back to a neutral pose for the tail checks */
      await setPose('GROUND', -180, 40, 180, 2.22, -0.35);
    }

    /* heap flat across pure animation frames (the camera teleports
     * and screenshots above are harness costs, not ATMOS) */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();
    await sleep(600);
    const heapAfter = await heapMin();
    check('M8.3: no allocation per frame (heap flat across the shaft sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);
  }


  /* ------------------------------------------------------------------
   * M8.4 — distant lightning events (random far point + hemi bump +
   * flash + EM discharge ring across the city)
   *
   *  ATMOS owns the event: fog-off point-flash sprite + fog-off EM
   *  discharge ring (ATMOS.ltGroup), plus the M7.4 FX.flash screen
   *  flash, a brief KIT.hemi intensity bump, and PARTS lightning
   *  motes around the strike point. Auto on a seeded timer, manual
   *  Key L. Idle cost = 0 draw calls.
   * ------------------------------------------------------------------ */
  {
    const reg = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const LG = S.CFG.atmos.lightning;
      const rm = A.emRing.material;
      const fm = A.ltFlash.material;
      return {
        cfg: !!LG && LG.every[0] > 0 && LG.every[1] > LG.every[0] &&
          LG.dist[0] > 0 && LG.dist[1] <= 2400 &&
          LG.ring.radius > 0 && LG.ring.life > 0 && LG.motes > 0,
        group: !!A.ltGroup && A.ltGroup.name === 'ATMOS-lightning' &&
          A.ltGroup.parent === A.root && A.ltGroup.children.length === 2,
        ring: A.emRing.geometry.type === 'RingGeometry' &&
          rm.blending === 2 && rm.fog === false && rm.depthWrite === false &&
          rm.transparent === true && A.emRing.frustumCulled === false,
        flash: A.ltFlash.isSprite === true && fm.blending === 2 &&
          fm.fog === false && fm.depthWrite === false &&
          fm.toneMapped === false && fm.map !== null,
        idle: !A.emRing.visible && !A.ltFlash.visible &&
          !A._lt.active && A._hemiBoost === 0,
        hemiBase: S.KIT.hemi.intensity === S.CFG.lights.hemiIntensity,
        flashIdle: S.FX._flash === 0,
        motesIdle: S.PARTS.lcount === 0,
        timer: A._ltTimer > 1e8,   // suppressed for the preceding sections
        fired: A.ltFired === 0,
      };
    });
    check('M8.4: lightning registered — fog-off additive point flash + EM ring in ATMOS.ltGroup, idle hidden, hemi at base',
      reg.cfg && reg.group && reg.ring && reg.flash && reg.idle &&
      reg.hemiBase && reg.flashIdle && reg.motesIdle && reg.timer &&
      reg.fired,
      `fired=${reg.fired}`);

    /* manual Key L: the event fires — every effect channel alive */
    await page.keyboard.press('l');
    await sleep(120);
    const ev = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const LG = S.CFG.atmos.lightning;
      const lt = A._lt;
      return {
        active: lt.active,
        fired: A.ltFired,
        ringVis: A.emRing.visible,
        flashVis: A.ltFlash.visible,
        ringPos: {
          x: A.emRing.position.x, y: A.emRing.position.y,
          z: A.emRing.position.z,
        },
        ringScale: A.emRing.scale.x,
        flashPos: {
          x: A.ltFlash.position.x, y: A.ltFlash.position.y,
          z: A.ltFlash.position.z,
        },
        flashOp: A.ltFlash.material.opacity,
        hemi: S.KIT.hemi.intensity,
        hemiBase: S.CFG.lights.hemiIntensity,
        flash: S.FX._flash,
        motes: S.PARTS.lcount,
        dist: Math.hypot(lt.x, lt.z),
        alt: lt.alt,
        x: lt.x, z: lt.z,
        distCfg: LG.dist, altCfg: LG.altitude,
        motesCfg: LG.motes,
        ringY: LG.ring.y,
      };
    });
    check('M8.4: manual Key L fires the event — far point in range, ring + flash + hemi + screen flash + motes all alive',
      ev.active && ev.fired === 1 && ev.ringVis && ev.flashVis &&
      ev.dist >= ev.distCfg[0] && ev.dist <= ev.distCfg[1] &&
      ev.alt >= ev.altCfg[0] && ev.alt <= ev.altCfg[1] &&
      ev.ringPos.x === ev.x && ev.ringPos.z === ev.z &&
      ev.ringPos.y === ev.ringY &&
      ev.flashPos.x === ev.x && ev.flashPos.z === ev.z &&
      ev.flashPos.y === ev.alt &&
      ev.ringScale > 2 && ev.ringScale < 950 && ev.flashOp > 0 &&
      ev.hemi > ev.hemiBase && ev.flash > 0 && ev.motes === ev.motesCfg,
      `dist=${ev.dist.toFixed(0)}m alt=${ev.alt.toFixed(0)}m,` +
      ` hemi=${ev.hemi.toFixed(2)} (base ${ev.hemiBase}),` +
      ` flash=${ev.flash.toFixed(2)}, motes=${ev.motes},` +
      ` ringR=${ev.ringScale.toFixed(0)}m`);

    /* point flash billboard: exactly +1 draw call when shown. This
     * must run while the event's own 0.5 s flash window is still
     * alive, so aim the camera at the strike point first (the sprite
     * may be behind the current pose). */
    const flashDelta = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const C = S.CAMERA;
      const lt = A._lt;
      C.yaw = Math.atan2(-(lt.x - C.pos.x), -(lt.z - C.pos.z));
      C.pitch = Math.atan2(
        lt.alt - C.pos.y,
        Math.hypot(lt.x - C.pos.x, lt.z - C.pos.z));
      const F = A.ltFlash;
      await new Promise(r => setTimeout(r, 100));
      const a = S.renderer.info.render.calls;
      F.visible = false;
      await new Promise(r => setTimeout(r, 100));
      const b = S.renderer.info.render.calls;
      F.visible = true;
      const f2 = S.FX._flash;
      return { d: a - b, f2 };
    });
    check('M8.4: point flash billboard — exactly +1 draw call when shown',
      flashDelta.d === 1, `delta=${flashDelta.d}`);
    check('M8.4: screen flash decays',
      ev.flash > flashDelta.f2 && flashDelta.f2 > 0,
      `flash ${ev.flash.toFixed(3)} → ${flashDelta.f2.toFixed(3)}`);

    /* EM ring: exactly +1 draw call while alive (median of 3 on/off
     * pairs), and it expands (scale grows toward the configured radius)
     */
    const ringDelta = await page.evaluate(async () => {
      const S = window.SIM, A = S.ATMOS;
      const d = [];
      for (let i = 0; i < 3; i++) {
        A.emRing.visible = true;
        await new Promise(r => setTimeout(r, 110));
        const a = S.renderer.info.render.calls;
        A.emRing.visible = false;
        await new Promise(r => setTimeout(r, 110));
        const b = S.renderer.info.render.calls;
        d.push(a - b);
      }
      A.emRing.visible = true;
      d.sort((x, y) => x - y);
      return d[1];
    });
    const g1 = await page.evaluate(() => window.SIM.ATMOS.emRing.scale.x);
    await sleep(400);
    const g2 = await page.evaluate(() => window.SIM.ATMOS.emRing.scale.x);
    check('M8.4: EM discharge ring — exactly +1 draw call while alive, expanding',
      ringDelta === 1 && g2 > g1 && g2 < 950,
      `delta=${ringDelta}, R ${g1.toFixed(0)} → ${g2.toFixed(0)} m`);

    /* hemi bump is brief: decays back to exactly the base rig value;
     * the event resolves clean (ring + sprite hidden, no active state) */
    const decay = await page.evaluate(async () => {
      const S = window.SIM;
      const h1 = S.KIT.hemi.intensity;
      await new Promise(r => setTimeout(r, 400));
      const h2 = S.KIT.hemi.intensity;
      await new Promise(r => setTimeout(r, 1400));
      const base = S.CFG.lights.hemiIntensity;
      const h3 = S.KIT.hemi.intensity;
      const f3 = S.FX._flash;
      await new Promise(r => setTimeout(r, 1400));
      const A = S.ATMOS;
      return {
        h1, h2, h3, base, f3,
        active: A._lt.active,
        ringVis: A.emRing.visible,
        flashVis: A.ltFlash.visible,
      };
    });
    check('M8.4: brief hemi bump decays to base; event resolves clean',
      decay.h1 > decay.h2 && decay.h2 >= decay.base &&
      decay.h3 === decay.base && decay.f3 === 0 &&
      !decay.active && !decay.ringVis && !decay.flashVis,
      `hemi ${decay.h1.toFixed(3)} → ${decay.h2.toFixed(3)} →` +
      ` ${decay.h3.toFixed(3)} (base ${decay.base})`);

    /* auto timer: a small countdown fires exactly one event and
     * re-seeds the interval into the configured range */
    const firedBefore = await page.evaluate(() => window.SIM.ATMOS.ltFired);
    await page.evaluate(() => { window.SIM.ATMOS._ltTimer = 0.2; });
    await sleep(700);
    const timer = await page.evaluate(() => {
      const A = window.SIM.ATMOS;
      const LG = window.SIM.CFG.atmos.lightning;
      return {
        fired: A.ltFired,
        active: A._lt.active,
        timer: A._ltTimer,
        every: LG.every,
      };
    });
    check('M8.4: auto timer fires the event and re-seeds the interval',
      timer.fired === firedBefore + 1 && timer.active &&
      timer.timer >= timer.every[0] && timer.timer <= timer.every[1],
      `fired=${timer.fired}, next in ${timer.timer.toFixed(1)} s` +
      ` (range ${timer.every[0]}–${timer.every[1]} s)`);

    /* motes resolve too (they outlive the ring: max life ≈ 7.4 s) */
    const motesGone = await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 8000));
      return window.SIM.PARTS.lcount;
    });
    check('M8.4: lightning motes age out (0 live after the events)',
      motesGone === 0, `live=${motesGone}`);

    /* visual gate: pose above the strike point — 300 m out / 300 m up,
     * looking down at 45° — the wide EM band crosses the frame. Fire at
     * the same point, freeze the event time (_ltFrozen), on/off
     * screenshot pair; the strip is centered on the projected far edge
     * of the annulus (computed in-page). 2 pairs averaged (the scene
     * animates: stars, LEDs, particles). */
    const pose = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const lt = A._lt;
      const L = Math.hypot(lt.x, lt.z);
      /* plaza-side camera: 300 m horizontal, 300 m up */
      const px = lt.x - lt.x / L * 300;
      const pz = lt.z - lt.z / L * 300;
      const C = S.CAMERA;
      C.setMode('CINE');
      C.vel.set(0, 0, 0);
      C.fov = 60;
      C.yaw = Math.atan2(-(lt.x - px), -(lt.z - pz));
      C.pitch = -0.7854;
      return { x: lt.x, z: lt.z, alt: lt.alt, px, pz };
    });
    /* the GROUND→CINE mode blend takes 0.55 s and the ground clamp
     * (pos.y ≤ 40 m) is still active while blend < 1 — set the
     * altitude only after the blend settles, else pos.y sticks at an
     * intermediate value and the whole annulus misses the frame */
    await sleep(800);
    await page.evaluate(({ px, pz }) => {
      window.SIM.CAMERA.pos.set(px, 300, pz);
    }, { px: pose.px, pz: pose.pz });
    await sleep(200);   // pose → camera copy settle
    await page.evaluate(({ x, z, alt }) =>
      window.SIM.ATMOS._fireLightning(x, z, alt), pose);
    /* wait until the ring's far arc is in the frame, then freeze the
     * event time for a stable pair */
    await page.waitForFunction(
      () => window.SIM.ATMOS.emRing.scale.x >= 700,
      { timeout: 8000 });
    await page.evaluate(() => {
      window.SIM.ATMOS._ltFrozen = true;
    });
    const stripCenter = await page.evaluate(() => {
      const S = window.SIM, A = S.ATMOS;
      const R = A.emRing.scale.x;
      const lt = A._lt;
      const L = Math.hypot(lt.x, lt.z);
      /* far edge of the annulus mid-radius (0.6–1.0 ⇒ 0.8 R) — the
       * edge AWAY from the camera: the camera is plaza-side, so the
       * far edge is strike + (strike−origin) direction · 0.8 R */
      const p = S.project(
        lt.x + lt.x / L * 0.8 * R, 0.6, lt.z + lt.z / L * 0.8 * R);
      return {
        row: (1 - p.y) / 2 * window.innerHeight,
        ok: p.y > -1 && p.y < 1,
      };
    });
    const stripStats = b64 => page.evaluate(async ({ b64, row }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      /* strip: ±5 % of the frame height around the projected far edge,
       * full width — the EM band crosses here */
      const hh = Math.floor(c.height * 0.1);
      const y0 = Math.max(0, Math.min(
        c.height - hh, Math.round(row) - hh / 2));
      const d = ctx.getImageData(0, y0, c.width, hh).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      return sum / (d.length / 4);
    }, { b64, row: stripCenter.row });
    let offSum = 0, onSum = 0;
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        window.SIM.ATMOS.ltGroup.visible = false;
      });
      await sleep(150);
      offSum += await stripStats(
        (await page.screenshot()).toString('base64'));
      await page.evaluate(() => {
        window.SIM.ATMOS.ltGroup.visible = true;
      });
      await sleep(150);
      const shot = await page.screenshot(
        { path: `${here}/shots/m84-lightning.png` });
      onSum += await stripStats(shot.toString('base64'));
    }
    const offStrip = offSum / 2, onStrip = onSum / 2;
    check('M8.4: event visible from inside the city (shots/m84-lightning.png) — the EM band adds light across the frame',
      fs.existsSync(`${here}/shots/m84-lightning.png`) &&
      onStrip > offStrip + 0.5,
      `strip mean ${offStrip.toFixed(2)} → ${onStrip.toFixed(2)}`);
    /* unfreeze and let this event resolve */
    await page.evaluate(() => {
      window.SIM.ATMOS._ltFrozen = false;
    });
    await sleep(2500);

    /* let this event resolve before the tail checks */
    await sleep(3000);
    /* heap flat across pure animation frames (the screenshots above
     * are harness costs, not ATMOS allocations) */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const heapBefore = await heapMin();
    await sleep(600);
    const heapAfter = await heapMin();
    check('M8.4: no allocation per frame (heap flat across the lightning sequence)',
      heapBefore > 0 && heapAfter > 0 &&
      heapAfter - heapBefore <= 2 * 1024 * 1024,
      `before=${Math.round(heapBefore / 1024)}KB,` +
      ` after=${Math.round(heapAfter / 1024)}KB`);
  }

  /* ------------------------------------------------------------------
   * M9.1 — idle/dormant animation: tensor-ring spin (M5), antenna
   * sway, breathing core (M5), periodic "dream" LED wave across the
   * node grid
   *
   *  Shader-less instance-color animation: per-node color =
   *  hue × (base brightness + glow × Gaussian front envelope); the
   *  dormant base colors are restored byte-exact when the front
   *  exits. Antenna sway = small deterministic tilt on each mast
   *  group. All per-node data pre-allocated at init ⇒ heap flat.
   * ------------------------------------------------------------------ */
  {
    /* wait for any in-flight auto-timer wave to resolve AND its
     * deadline to be re-armed in the future — a deadline landing in
     * the poll gap would read active=false + nextAt<=now (the frame
     * before the wave starts) and flake the idle assertion below */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E && E._dream && !E._dream.active &&
        E._dream.nextAt > performance.now() / 1000;
    }, { timeout: 20000 });

    /* 1. registered: config + pre-allocated per-node data, wave idle,
     *    node grid dim (dormant stays dim) */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, C = S.CFG.entity;
      const n = E.nodeCount;
      const a = E.nodes.instanceColor.array;
      let maxc = 0;
      for (let i = 0; i < a.length; i++) maxc = Math.max(maxc, a[i]);
      return {
        cfg: !!C && C.antennaSway.amp > 0 && C.antennaSway.speed > 0 &&
          C.dream.every[1] > C.dream.every[0] > 0 && C.dream.speed > 0 &&
          C.dream.width > 0 && C.dream.glow > 0 && C.dream.first > 0,
        data: E._nodeBase.length === n * 3 &&
          E._nodeHue.length >= n * 3 && E._nodeBright.length >= n &&
          E._nodeDist.length === n && E._nodePos.length >= n * 3 &&
          E._nodeBase.length <= a.length,
        idle: !E._dream.active &&
          E._dream.nextAt > performance.now() / 1000 &&
          E._dream.maxR > 0,
        dim: maxc < 0.1,
        n,
      };
    });
    check('M9.1: dormant animation registered — dream wave data pre-allocated, wave idle, node grid dim',
      reg.cfg && reg.data && reg.idle && reg.dim,
      `nodes=${reg.n}, cfg=${reg.cfg}, data=${reg.data},` +
      ` idle=${reg.idle}, dim=${reg.dim}`);
    /* diagnostic sub-values (always logged on failure above) */
    console.log('  M9.1 reg detail:', JSON.stringify(reg));

    /* 2. antenna sway: mast groups tilt within ±amp, mast children
     *    stay put, slow (still-ish) */
    const ant = () => page.evaluate(() => {
      const P = window.SIM.ENTITY.parts;
      const out = [];
      for (let i = 1; i <= 4; i++) {
        const g = P['antenna' + i];
        out.push({
          rx: g.rotation.x, rz: g.rotation.z,
          mx: g.children[0].position.x,
          my: g.children[0].position.y,
          mz: g.children[0].position.z,
        });
      }
      return out;
    });
    const a0 = await ant();
    await sleep(1200);
    const a1 = await ant();
    const amp = await page.evaluate(() =>
      window.SIM.CFG.entity.antennaSway.amp);
    check('M9.1: antennas sway within ±amp (slow, still-ish)',
      a1.every((v, i) =>
        Math.abs(v.rx) <= amp + 1e-6 && Math.abs(v.rz) <= amp + 1e-6 &&
        v.mx === a0[i].mx && v.my === a0[i].my && v.mz === a0[i].mz) &&
      a1.some((v, i) => v.rx !== a0[i].rx || v.rz !== a0[i].rz),
      `ant1 rx ${a0[0].rx.toFixed(4)} -> ${a1[0].rx.toFixed(4)}`);

    /* 3. timer: force the next wave ~0.2 s out — it fires on the
     *    timer and the front grows at the configured speed. The arm is
     *    idempotent: only pull the deadline in when it is currently
     *    further out than now+0.2 s — rewriting it on every poll would
     *    chase its own tail (the frame after a poll is only ~one frame
     *    later, never 0.2 s) and the wave could never start. An
     *    auto-timer wave that is already running is fine — its own
     *    re-seeded interval is what check 5 verifies. */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      const n = performance.now() / 1000;
      if (!E._dream.active && E._dream.nextAt > n + 0.2)
        E._dream.nextAt = n + 0.2;
      return E._dream.active;
    }, { timeout: 8000 });
    /* wait until the front is well inside the grid (r ≥ 3σ) so both
     * test nodes exist: A just behind the front, B ahead of it.
     * Self-arming: if the wave resolved before the first poll (a slow
     * page can stall past the ~4 s wave), the next poll pulls the
     * deadline back in and arms a fresh one instead of waiting for
     * the 14–26 s auto timer. */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      const D = window.SIM.CFG.entity.dream;
      const n = performance.now() / 1000;
      if (!E._dream.active && E._dream.nextAt > n + 0.2)
        E._dream.nextAt = n + 0.2;
      return E._dream.active &&
        (performance.now() / 1000 - E._dream.t0) * D.speed >= 15;
    }, { timeout: 8000 });
    const w1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const D = S.CFG.entity.dream;
      const t = performance.now() / 1000;
      const r = (t - E._dream.t0) * D.speed;
      const sig = D.width;
      const dist = E._nodeDist;
      const ic = E.nodes.instanceColor.array;
      const base = E._nodeBase;
      const n = E.nodeCount;
      /* node A: just behind the front (lit); node B: ahead of it
       * (still dim — the Gaussian tail there is negligible) */
      let iA = -1, iB = -1;
      for (let i = 0; i < n; i++) {
        if (iA < 0 && dist[i] > r - 2 * sig && dist[i] < r - sig) iA = i;
        if (iB < 0 && dist[i] > r + 3 * sig && dist[i] < r + 4 * sig)
          iB = i;
      }
      const lit = i => {
        const i3 = i * 3;
        return Math.max(ic[i3] - base[i3], ic[i3 + 1] - base[i3 + 1],
          ic[i3 + 2] - base[i3 + 2]);
      };
      return {
        r, maxR: E._dream.maxR, t0: E._dream.t0, t,
        iA, iB,
        litA: iA >= 0 ? lit(iA) : -1,
        litB: iB >= 0 ? lit(iB) : 1,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.1: dream wave fires on its timer — front node lit, ahead node still dim',
      w1.iA >= 0 && w1.iB >= 0 && w1.litA > 0.02 && w1.litB < 0.01 &&
      w1.r > 0 && w1.r < w1.maxR,
      `r=${w1.r.toFixed(1)} m (maxR ${w1.maxR.toFixed(0)} m),` +
      ` nodeA +${w1.litA.toFixed(3)}, nodeB +${w1.litB.toFixed(4)}`);

    /* 4. the sweep travels: ~1.5 s later the front has passed node B
     *    (now lit) and left node A behind (dim again) */
    await sleep(1500);
    const w2 = await page.evaluate(({ iA, iB }) => {
      const E = window.SIM.ENTITY;
      const D = window.SIM.CFG.entity.dream;
      const ic = E.nodes.instanceColor.array;
      const base = E._nodeBase;
      const lit = i => {
        const i3 = i * 3;
        return Math.max(ic[i3] - base[i3], ic[i3 + 1] - base[i3 + 1],
          ic[i3 + 2] - base[i3 + 2]);
      };
      return {
        iA, iB,
        litB: iB >= 0 ? lit(iB) : -1,
        litA: iA >= 0 ? lit(iA) : 1,
        active: E._dream.active,
        r: (performance.now() / 1000 - E._dream.t0) * D.speed,
        maxR: E._dream.maxR,
        calls: window.SIM.renderer.info.render.calls,
      };
    }, { iA: w1.iA, iB: w1.iB });
    check('M9.1: dream wave sweeps the node grid (B lit after, A dim again)',
      w2.iB >= 0 && w2.litB > 0.02 && w2.litA < 0.01 && w2.active,
      `nodeB +${w2.litB.toFixed(3)}, nodeA +${w2.litA.toFixed(4)},` +
      ` r=${w2.r.toFixed(1)} maxR=${w2.maxR} active=${w2.active}`);
    console.log('  M9.1 sweep detail:', JSON.stringify(w2));

    /* 5. the wave resolves: base colors restored byte-exact, interval
     *    re-seeded into the configured range, no leftover state */
    await page.waitForFunction(
      () => !window.SIM.ENTITY._dream.active,
      { timeout: 15000 });
    const res = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const D = S.CFG.entity.dream;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      return {
        same,
        gap: E._dream.nextAt - E._dream.t0,
        every: D.every,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.1: wave resolves clean — instance colors byte-exact at base, interval re-seeded',
      res.same && res.gap >= res.every[0] && res.gap <= res.every[1] &&
      res.calls === w1.calls,
      `next in ${res.gap.toFixed(1)} s (range ${res.every[0]}–${res.every[1]} s),` +
      ` draw calls unchanged (${res.calls})`);

    /* 6. idle = no per-frame upload: with the next wave parked far out,
     *    instance colors + matrices are byte-static across frames */
    await page.evaluate(() => {
      window.SIM.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
    });
    const idle = await page.evaluate(async () => {
      const S = window.SIM, E = S.ENTITY;
      const h = () => {
        const a = E.nodes.instanceColor.array;
        const m = E.nodes.instanceMatrix.array;
        let x = 0;
        for (let i = 0; i < a.length; i++) x = (x * 31 + a[i]) | 0;
        for (let i = 0; i < 256; i++) x = (x * 31 + m[i]) | 0;
        return x;
      };
      const h0 = h();
      await new Promise(r => setTimeout(r, 1200));
      return { h1: h(), h0 };
    });
    check('M9.1: dormant idle is still-ish — no per-frame instance upload between waves',
      idle.h0 === idle.h1);

    /* 7. heap flat across a whole wave sequence (all arrays are
     *    pre-allocated at init) */
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();
    await page.evaluate(() => {
      window.SIM.ENTITY._dream.nextAt = performance.now() / 1000 + 0.2;
    });
    await page.waitForFunction(
      () => !window.SIM.ENTITY._dream.active,
      { timeout: 15000 });
    const ha = await heapMin();
    check('M9.1: no allocation per frame (heap flat across the dream wave)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

    /* 8. visual gate: street pose at ~90 m (the M5 street-full pose),
     *    fire the wave, freeze it mid-sweep (_dreamFrozen), on/off
     *    screenshot pair around the projected creature core (0, 44, 0).
     *    2 pairs averaged (the scene animates: stars, LEDs, particles).
     *    shots/m91-dream-wave.png */
    await page.evaluate(() => {
      const C = window.SIM.CAMERA;
      C.pos.set(72, 1.7, 55);
      C.vel.set(0, 0, 0);
      C.yaw = 0.92;
      C.pitch = 0.30;
      window.SIM.ENTITY._dream.nextAt = performance.now() / 1000 + 0.15;
    });
    /* wait until the front is mid-creature (r ≥ 18 m), then freeze
     * (self-arming, as above) */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      const D = window.SIM.CFG.entity.dream;
      const n = performance.now() / 1000;
      if (!E._dream.active && E._dream.nextAt > n + 0.2)
        E._dream.nextAt = n + 0.2;
      return E._dream.active &&
        (performance.now() / 1000 - E._dream.t0) * D.speed >= 18;
    }, { timeout: 15000 });
    await page.evaluate(() => {
      window.SIM.ENTITY._dreamFrozen = true;
    });
    /* capture the exact frozen wave colors — the off-shot restores the
     * dormant base, the on-shot restores these (byte-exact pair) */
    const waveCol = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return Array.from(
        E.nodes.instanceColor.array.subarray(0, E.nodeCount * 3));
    });
    const coreXY = await page.evaluate(() => {
      const p = window.SIM.project(0, 44, 0);
      return {
        x: (p.x + 1) / 2 * window.innerWidth,
        y: (1 - p.y) / 2 * window.innerHeight,
        ok: p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1,
      };
    });
    const regionStats = b64 => page.evaluate(async ({ b64, cx, cy }) => {
      const img = new Image();
      await new Promise((res2, rej) => {
        img.onload = res2; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      /* region: ±12 % of the frame around the projected creature core
       * (0, 44, 0) — the node grid lives here */
      const hw = Math.floor(c.width * 0.24) / 2;
      const hh = Math.floor(c.height * 0.24) / 2;
      const x0 = Math.max(0, Math.round(cx - hw));
      const y0 = Math.max(0, Math.round(cy - hh));
      const x1 = Math.min(c.width, Math.round(cx + hw));
      const y1 = Math.min(c.height, Math.round(cy + hh));
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    }, { b64, cx: coreXY.x, cy: coreXY.y });
    let offSum = 0, onSum = 0;
    for (let i = 0; i < 2; i++) {
      /* off: temporarily restore the dormant base colors */
      await page.evaluate(() => {
        const E = window.SIM.ENTITY;
        E.nodes.instanceColor.array.set(E._nodeBase);
        E.nodes.instanceColor.needsUpdate = true;
      });
      await sleep(150);
      offSum += await regionStats(
        (await page.screenshot()).toString('base64'));
      /* on: restore the frozen wave colors */
      await page.evaluate(wc => {
        const E = window.SIM.ENTITY;
        E.nodes.instanceColor.array.set(wc);
        E.nodes.instanceColor.needsUpdate = true;
      }, waveCol);
      await sleep(150);
      const shot = await page.screenshot(
        { path: `${here}/shots/m91-dream-wave.png` });
      onSum += await regionStats(shot.toString('base64'));
    }
    const offReg = offSum / 2, onReg = onSum / 2;
    check('M9.1: dream wave visible on screen (shots/m91-dream-wave.png) — the sweep adds light across the node grid',
      fs.existsSync(`${here}/shots/m91-dream-wave.png`) && coreXY.ok &&
      onReg > offReg + 0.5,
      `region mean ${offReg.toFixed(2)} → ${onReg.toFixed(2)}`);
    /* unfreeze and let the wave finish */
    await page.evaluate(() => {
      window.SIM.ENTITY._dreamFrozen = false;
    });
    await page.waitForFunction(
      () => !window.SIM.ENTITY._dream.active,
      { timeout: 15000 });
    /* reset to the spawn pose for the remaining checks */
    await page.evaluate(() => {
      const C = window.SIM.CAMERA;
      C.pos.set(0, 4, 18);
      C.vel.set(0, 0, 0);
      C.yaw = 0;
      C.pitch = 0;
    });
    await sleep(250);
  }

  /* ------------------------------------------------------------------
   * M9.2 — wake state machine: DORMANT → STIR (2 s: head lift, jaw,
   *   rings speed up) → AWAKE (10–20 s) → DECAY → DORMANT, with
   *   per-state hooks
   *
   *  Transitions are forced by fast-forwarding ENTITY.stateT past
   *  each state's duration — the machine itself makes every
   *  transition (no teleport API). The per-state hooks record their
   *  firing order; a fake system on S.systems verifies the ground-rule
   *  onAwaken() hook fires exactly once per sequence start.
   * ------------------------------------------------------------------ */
  {
    const W = await page.evaluate(() => window.SIM.CFG.entity.wake);
    const spinA = await page.evaluate(() => window.SIM.ENTITY.ringSpin[0]);

    /* park the dream wave: M9.1 left its re-seeded deadline 14–26 s
     * out — a wave could fire mid-section (it only starts in DORMANT,
     * but it would still move instance colors / hero light). Also park
     * the lightning auto-timer: an M8.4 event would add a flash draw
     * call mid-section and break the draw-call comparisons below. */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E && E._dream && !E._dream.active;
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });

    /* 1. registered: config sane, machine idle at DORMANT, hooks API */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, W = S.CFG.entity.wake;
      return {
        cfg: W.stir > 0 && W.awake[1] > W.awake[0] > 0 && W.decay > 0 &&
          W.ringBoost > 1 && W.headLift > 0 && W.jawOpen > 0 &&
          W.headRise > 0,
        dormant: E.state === 'DORMANT' && E._wakeCount === 0 &&
          E._ringAng.length === 3 && E.stateT >= 0,
        hooks: typeof E.hook === 'function' &&
          Array.isArray(E._wakeHooks.DORMANT) &&
          Array.isArray(E._wakeHooks.STIR) &&
          Array.isArray(E._wakeHooks.AWAKE) &&
          Array.isArray(E._wakeHooks.DECAY),
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.2: wake state machine registered — config sane, DORMANT idle, per-state hooks',
      reg.cfg && reg.dormant && reg.hooks,
      `calls=${reg.calls}, dormant=${reg.dormant}, hooks=${reg.hooks}`);

    /* 2. register per-state hooks + a fake onAwaken system, then
     *    trigger: wake() ⇒ STIR, onAwaken fired once, STIR hook fired */
    await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      window.__m92 = { order: [], onAwaken: 0 };
      for (const st of ['DORMANT', 'STIR', 'AWAKE', 'DECAY'])
        E.hook(st, s => window.__m92.order.push(s));
      S.systems.push({
        name: '__m92smoke',
        onAwaken() { window.__m92.onAwaken++; },
      });
      E.wake();
    });
    const st1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        state: E.state,
        count: E._wakeCount,
        onAwaken: window.__m92.onAwaken,
        order: window.__m92.order.slice(),
        rx: E.parts.head.rotation.x,
        hy: E.parts.head.position.y,
        jaw: E.parts.jaw.rotation.x,
      };
    });
    check('M9.2: wake() triggers DORMANT → STIR (onAwaken + STIR hook fired)',
      st1.state === 'STIR' && st1.count === 1 && st1.onAwaken === 1 &&
      JSON.stringify(st1.order) === JSON.stringify(['STIR']),
      `state=${st1.state}, onAwaken=${st1.onAwaken}, order=${st1.order}`);

    /* 3. STIR animates toward the full pose: head tilts up + rises,
     *    jaw drops, rings already spinning faster than the idle speed */
    const stir = () => page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        rx: E.parts.head.rotation.x,
        hy: E.parts.head.position.y,
        jaw: E.parts.jaw.rotation.x,
        ang: E._ringAng[0],
        t: performance.now() / 1000,
      };
    });
    const s0 = await stir();
    await sleep(500);
    const s1 = await stir();
    const vA = (s1.ang - s0.ang) / (s1.t - s0.t);
    check('M9.2: STIR — head lifts, jaw drops, rings speed up (2 s)',
      s1.rx < s0.rx && s1.rx >= -W.headLift - 1e-6 &&
      s1.hy > s0.hy && s1.hy <= 43.6 + W.headRise + 1e-6 &&
      s1.jaw > s0.jaw && s1.jaw <= W.jawOpen + 1e-6 &&
      vA > spinA,
      `head ${s0.rx.toFixed(4)} → ${s1.rx.toFixed(4)} rad (want ≥ ${-W.headLift}),` +
      ` jaw ${s0.jaw.toFixed(4)} → ${s1.jaw.toFixed(4)} rad,` +
      ` ringA ${vA.toFixed(4)} rad/s > idle ${spinA}`);

    /* 4. force STIR → AWAKE (fast-forward stateT past the 2 s STIR):
     *    the machine makes the transition and picks the seeded
     *    AWAKE hold into [10, 20] s */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'AWAKE', { timeout: 5000 });
    const st2 = await page.evaluate(() => ({
      dur: window.SIM.ENTITY._awakeDur,
      order: window.__m92.order.slice(),
    }));
    check('M9.2: STIR → AWAKE on the 2 s timer (hold seeded into 10–20 s)',
      st2.dur >= W.awake[0] && st2.dur <= W.awake[1] &&
      JSON.stringify(st2.order) === JSON.stringify(['STIR', 'AWAKE']),
      `awake hold ${st2.dur.toFixed(1)} s (want ${W.awake[0]}–${W.awake[1]} s),` +
      ` order=${st2.order}`);

    /* 5. AWAKE holds the full pose exactly: head lifted, jaw open,
     *    rings at the boost speed, hero light lifted; a re-trigger
     *    mid-sequence is a safe no-op (no double trigger) */
    const awake = () => page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        rx: E.parts.head.rotation.x,
        hy: E.parts.head.position.y,
        jaw: E.parts.jaw.rotation.x,
        ang: E._ringAng[0],
        t: performance.now() / 1000,
        state: E.state,
        count: E._wakeCount,
        hero: E._hero.intensity,
      };
    });
    const a0 = await awake();
    await page.evaluate(() => window.SIM.ENTITY.wake());
    const a1 = await awake();
    await sleep(300);
    const a2 = await awake();
    const dAng = a2.ang - a1.ang, dT = a2.t - a1.t;
    /* M9.3: beat 1 builds the core-eye flare on top of this baseline
     * (+ CFG.entity.beats.flare.hero × wakeP = 1 in AWAKE). */
    const flareHero = await page.evaluate(
      () => window.SIM.CFG.entity.beats.flare.hero);
    check('M9.2: AWAKE holds the full pose (rings at boost), re-trigger mid-sequence is a no-op',
      a1.state === 'AWAKE' && a1.count === 1 &&
      Math.abs(a1.rx + W.headLift) < 1e-4 &&
      Math.abs(a1.hy - (43.6 + W.headRise)) < 1e-4 &&
      Math.abs(a1.jaw - W.jawOpen) < 1e-4 &&
      a1.hero >= 0.9 + 1.5 + flareHero - 1e-6 &&
      a1.hero <= 1.2 + 1.5 + flareHero + 1e-6 &&
      Math.abs(dAng - spinA * W.ringBoost * dT) < 0.02,
      `hero ${a1.hero.toFixed(2)}, ringA Δang ${dAng.toFixed(3)} vs` +
      ` ${(spinA * W.ringBoost * dT).toFixed(3)} expected, count=${a1.count}`);

    /* 6. force AWAKE → DECAY (fast-forward past the picked hold):
     *    DECAY hook fires, order still exact */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    const st3 = await page.evaluate(() => ({
      state: window.SIM.ENTITY.state,
      order: window.__m92.order.slice(),
    }));
    check('M9.2: AWAKE → DECAY on the hold timer (DECAY hook fired)',
      st3.state === 'DECAY' &&
      JSON.stringify(st3.order) ===
      JSON.stringify(['STIR', 'AWAKE', 'DECAY']),
      `order=${st3.order}`);

    /* 7. force DECAY → DORMANT (fast-forward the 3 s decay): the pose
     *    restores EXACTLY, node colors byte-exact, hooks in order,
     *    draw calls back to the pre-trigger count (+1 for the M9.5
     *    final pulse ring, live at DORMANT entry) */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    /* M9.3: beat 1's flash fires at the STIR→AWAKE peak — wait for it
     * to fully decay (the flash plane is +1 draw call while live) */
    await page.waitForFunction(
      () => window.SIM.FX._flash === 0, { timeout: 5000 });
    const d1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      return {
        order: window.__m92.order.slice(),
        rx: E.parts.head.rotation.x,
        jaw: E.parts.jaw.rotation.x,
        hy: E.parts.head.position.y,
        same,
        count: E._wakeCount,
        calls: S.renderer.info.render.calls,
        hero: E._hero.intensity,
      };
    });
    check('M9.2: DECAY → DORMANT clean — pose restored exactly, no leftover state',
      d1.rx === 0 && d1.jaw === 0 && d1.hy === 43.6 && d1.same &&
      d1.count === 1 && d1.calls === reg.calls + 1 &&
      d1.hero >= 0.9 - 1e-6 && d1.hero <= 1.2 + 1e-6 &&
      JSON.stringify(d1.order) ===
      JSON.stringify(['STIR', 'AWAKE', 'DECAY', 'DORMANT']),
      `hero ${d1.hero.toFixed(2)}, calls ${d1.calls} (want ${reg.calls + 1} — +1 M9.5 final pulse ring),` +
      ` order=${d1.order}`);

    /* 8. safe immediate re-trigger: wake() right back into STIR,
     *    then force the whole cycle through again — it resolves clean
     *    a second time (re-trigger-safe state machine) */
    await page.evaluate(() => {
      window.SIM.ENTITY.wake();
    });
    const r1 = await page.evaluate(() => ({
      state: window.SIM.ENTITY.state,
      count: window.SIM.ENTITY._wakeCount,
      onAwaken: window.__m92.onAwaken,
    }));
    check('M9.2: immediate re-trigger works (STIR again, onAwaken again)',
      r1.state === 'STIR' && r1.count === 2 && r1.onAwaken === 2,
      `count=${r1.count}, onAwaken=${r1.onAwaken}`);
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'AWAKE', { timeout: 5000 });
    const r2 = await page.evaluate(() => ({
      dur: window.SIM.ENTITY._awakeDur,
    }));
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    await page.waitForFunction(
      () => window.SIM.FX._flash === 0, { timeout: 5000 });
    const r3 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      return {
        same,
        rx: E.parts.head.rotation.x,
        jaw: E.parts.jaw.rotation.x,
        hy: E.parts.head.position.y,
        count: E._wakeCount,
        calls: S.renderer.info.render.calls,
        order: window.__m92.order.slice(),
      };
    });
    check('M9.2: second full cycle resolves back to DORMANT clean (re-trigger safe)',
      r3.rx === 0 && r3.jaw === 0 && r3.hy === 43.6 && r3.same &&
      r3.count === 2 && r3.calls === reg.calls + 1 &&
      r2.dur >= W.awake[0] && r2.dur <= W.awake[1] &&
      JSON.stringify(r3.order.slice(4)) ===
      JSON.stringify(['STIR', 'AWAKE', 'DECAY', 'DORMANT']),
      `calls ${r3.calls} (want ${reg.calls + 1} — +1 M9.5 final pulse ring), order=${r3.order}`);

    /* cleanup: pop the fake system, park the dream wave again */
    await page.evaluate(() => {
      const S = window.SIM;
      const sys = S.systems[S.systems.length - 1];
      if (sys && sys.name === '__m92smoke') S.systems.pop();
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
    });
  }

  /* ------------------------------------------------------------------
   * M9.3 — Awakening beats 1–3 (creature-level power)
   *
   *  Beat 1: core-eye flare — emissive ramp toward the flare color +
   *    hero-light boost through STIR; FX.flash fires at the
   *    STIR→AWAKE peak. Beat 2: node voxels ignite in radial waves
   *    from head level (front radius grows from the AWAKE entry; the
   *    lit level holds). Beat 3: tensor rings tilt + arms lift — the
   *    surge level ramps in `delay` s after AWAKE entry, fired with
   *    a camera-shake impulse. Everything restores EXACTLY at DORMANT
   *    entry.
   *
   *  Triggered via ENTITY.wake() (M9.6 wires the manual key to it);
   *  transitions are forced by fast-forwarding stateT as in M9.2.
   *  Beat start timestamps (ENTITY._beatAt) + wrapped FX.flash /
   *  CAMERA.shake verify the sequence + correct timing.
   * ------------------------------------------------------------------ */
  {
    const B = await page.evaluate(() => window.SIM.CFG.entity.beats);
    const W = await page.evaluate(() => window.SIM.CFG.entity.wake);
    const spinA = await page.evaluate(
      () => window.SIM.ENTITY.ringSpin[0]);

    /* M9.5: wait out M9.2's final pulses (5 s life each) — a live
     * pulse adds its ring draw call + pooled light to this section's
     * draw-call baselines and the dormant reference pair below */
    await page.waitForFunction(
      () => window.SIM.FX.count === 0, { timeout: 12000 });

    /* park the dream wave (as in M9.2) + the lightning auto-timer, and
     * wait out M9.2's last beat-1 flash before the draw-call baseline */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E && E._dream && !E._dream.active;
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });
    await page.waitForFunction(
      () => window.SIM.FX._flash === 0, { timeout: 5000 });

    /* 1. registered: config sane, beats idle at DORMANT */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, B = S.CFG.entity.beats;
      const qSame = i => {
        const q = E.parts[['ringA', 'ringB', 'ringC'][i]].quaternion;
        const b = E._ringBaseQ[i];
        return q.x === b.x && q.y === b.y && q.z === b.z && q.w === b.w;
      };
      return {
        cfg: B.flare.eye > 0 && B.flare.hero > 0 && B.flare.flash > 0 &&
          B.ignite.speed > 0 && B.ignite.width > 0 &&
          B.ignite.bright > 0.1 && B.ignite.front > 0 &&
          B.surge.delay > 0 && B.surge.ramp > 0 &&
          B.surge.ringTilt > 0 && B.surge.armLift > 0 &&
          B.surge.shake > 0,
        idle: !E._ignited && E._surgeP === 0 && !E._surgeFired &&
          E._beatAt.flare === 0 && E._beatAt.ignite === 0 &&
          E._beatAt.surge === 0 &&
          E.parts.armL.rotation.z === 0 && E.parts.armR.rotation.z === 0 &&
          qSame(0) && qSame(1) && qSame(2),
        hero: E._hero.intensity,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.3: awakening beats registered — config sane, beats idle at DORMANT',
      reg.cfg && reg.idle,
      `hero=${reg.hero.toFixed(2)}, calls=${reg.calls}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* street pose (the M9.1 pose) + dormant reference pair — the
     * on-shot below is the same pose mid-beats */
    await page.evaluate(() => {
      const C = window.SIM.CAMERA;
      C.pos.set(72, 1.7, 55);
      C.vel.set(0, 0, 0);
      C.yaw = 0.92;
      C.pitch = 0.30;
    });
    /* the pose is applied by the next camera frame — project() reads
     * the live camera, so a same-evaluate project would use the stale
     * spawn pose and clamp the region off-frame */
    await sleep(250);
    const coreXY = await page.evaluate(() => {
      const p = window.SIM.project(0, 44, 0);
      return {
        x: (p.x + 1) / 2 * window.innerWidth,
        y: (1 - p.y) / 2 * window.innerHeight,
        ok: p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1,
      };
    });
    /* visible-object baseline at the street pose — the resolve check
     * below samples the same pose. (Draw-call counts in this pose
     * drift ±2 over time — frustum/keep-set churn at render level —
     * so the gate is the visible-object SET; calls are logged for
     * reference.) */
    const visStreet = await page.evaluate(() => {
      const S = window.SIM;
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return { calls: S.renderer.info.render.calls, vis };
    });
    const regionStats = b64 => page.evaluate(async ({ b64, cx, cy }) => {
      const img = new Image();
      await new Promise((res2, rej) => {
        img.onload = res2; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      /* region: ±12 % of the frame around the projected creature core
       * (0, 44, 0) — the node grid lives here */
      const hw = Math.floor(c.width * 0.24) / 2;
      const hh = Math.floor(c.height * 0.24) / 2;
      const x0 = Math.max(0, Math.round(cx - hw));
      const y0 = Math.max(0, Math.round(cy - hh));
      const x1 = Math.min(c.width, Math.round(cx + hw));
      const y1 = Math.min(c.height, Math.round(cy + hh));
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    }, { b64, cx: coreXY.x, cy: coreXY.y });
    let offSum = 0;
    for (let i = 0; i < 2; i++) {
      await sleep(150);
      offSum += await regionStats(
        (await page.screenshot()).toString('base64'));
    }
    const offReg = offSum / 2;

    /* 2. beat 1 — core-eye flare ramps with wakeP during STIR: hero
     *    light up + eye color moves toward the flare color. FX.flash
     *    + CAMERA.shake are wrapped so the beat calls are recorded
     *    exactly (restored at cleanup). */
    const eyeHero = () => page.evaluate(() => {
      const E = window.SIM.ENTITY;
      const c = E.parts.coreEye.material.color;
      const f = E._flareCol;
      return {
        state: E.state,
        hero: E._hero.intensity,
        d: Math.hypot(c.r - f.r, c.g - f.g, c.b - f.b),
        flare: E._beatAt.flare,
      };
    });
    const e0 = await eyeHero();
    await page.evaluate(() => {
      const S = window.SIM;
      S.__m93 = { flash: 0, shake: 0 };
      S.__m93f0 = S.FX.flash;
      S.__m93s0 = S.CAMERA.shake;
      S.FX.flash = (i, c) => {
        S.__m93.flash = Math.max(S.__m93.flash, i);
        return S.__m93f0(i, c);
      };
      S.CAMERA.shake = i => {
        S.__m93.shake += i;
        return S.__m93s0(i);
      };
      window.SIM.ENTITY.wake();
    });
    /* 400 ms in: wakeP ≈ 0.10 ⇒ hero +≈0.7 and the eye color already
     * measurably closer to the flare color (150 ms leaves wakeP ≈ 0.02,
     * inside the k-oscillation noise) */
    await sleep(400);
    const e1 = await eyeHero();
    await sleep(600);
    const e2 = await eyeHero();
    check('M9.3: beat 1 — core eye flares during STIR (emissive ramp, hero light up)',
      e1.state === 'STIR' && e1.flare > 0 &&
      e1.hero > e0.hero + 0.05 && e2.hero > e1.hero &&
      e2.d < e1.d && e1.d < e0.d - 0.01,
      `hero ${e0.hero.toFixed(2)} → ${e1.hero.toFixed(2)} → ${e2.hero.toFixed(2)},` +
      ` eye→flare ${e0.d.toFixed(3)} → ${e1.d.toFixed(3)} → ${e2.d.toFixed(3)}`);

    /* 3. force STIR → AWAKE: beat 1 peak fires the flash, beat 2's
     *    ignite wave starts — head-level node lit, far node still dim
     *    (the front is mid-creature: r in [8, 30] m) */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(() => {
      const S = window.SIM;
      const E = S.ENTITY;
      if (E.state !== 'AWAKE') return false;
      const r = (performance.now() / 1000 - E._awakeT0) *
        S.CFG.entity.beats.ignite.speed;
      return r >= 8 && r <= 30;
    }, { timeout: 8000 });
    const aw1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const B = S.CFG.entity.beats;
      const n = performance.now() / 1000;
      const r = (n - E._awakeT0) * B.ignite.speed;
      const dist = E._nodeDist;
      const ic = E.nodes.instanceColor.array;
      const nN = E.nodeCount;
      let iA = -1, iB = -1;
      for (let i = 0; i < nN; i++) {
        if (iA < 0 && dist[i] < 12) iA = i;
        if (iB < 0 && dist[i] > E._dream.maxR - 2) iB = i;
      }
      const bright = i => {
        const i3 = i * 3;
        return Math.max(ic[i3], ic[i3 + 1], ic[i3 + 2]);
      };
      return {
        r, iA, iB,
        litA: iA >= 0 ? bright(iA) : -1,
        litB: iB >= 0 ? bright(iB) : 1,
        flash: S.__m93.flash,
        ignite: E._beatAt.ignite,
        flare: E._beatAt.flare,
      };
    });
    check('M9.3: beat 1 peak — flash fires at STIR→AWAKE; beat 2 wave starts (front node lit, far node dim)',
      aw1.iA >= 0 && aw1.iB >= 0 &&
      aw1.litA > 0.15 && aw1.litB < 0.12 &&
      aw1.flash === B.flare.flash &&
      aw1.ignite > 0 && aw1.ignite >= aw1.flare,
      `r=${aw1.r.toFixed(1)} m, nodeA ${aw1.litA.toFixed(2)},` +
      ` nodeB ${aw1.litB.toFixed(3)}, flash=${aw1.flash}`);

    /* 4. beat 2 travels: ~1.6 s later the front has crossed the whole
     *    grid — every node lit at the configured brightness */
    await sleep(1600);
    const aw2 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const B = S.CFG.entity.beats;
      const n = performance.now() / 1000;
      const r = (n - E._awakeT0) * B.ignite.speed;
      const ic = E.nodes.instanceColor.array;
      const nN = E.nodeCount;
      let minc = Infinity;
      for (let i = 0; i < nN; i++) {
        const i3 = i * 3;
        minc = Math.min(minc,
          Math.max(ic[i3], ic[i3 + 1], ic[i3 + 2]));
      }
      return { r, minc, state: E.state };
    });
    check('M9.3: beat 2 — ignite wave reaches the whole grid (every node lit)',
      aw2.state === 'AWAKE' && aw2.r >= 53 &&
      aw2.minc >= B.ignite.bright - 0.02,
      `r=${aw2.r.toFixed(1)} m, min node brightness ${aw2.minc.toFixed(2)}` +
      ` (want ≥ ${(B.ignite.bright - 0.02).toFixed(2)})`);

    /* 5. beat 3 — the surge lands `delay` s after AWAKE entry: rings
     *    tilted off their base quaternions, arms lifted, shake fired
     *    exactly once at the configured impulse */
    await page.waitForFunction(
      () => window.SIM.ENTITY._surgeP >= 1, { timeout: 8000 });
    const s1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const B = S.CFG.entity.beats;
      const qAng = i => {
        const q = E.parts[['ringA', 'ringB', 'ringC'][i]].quaternion;
        const b = E._ringBaseQ[i];
        const d = Math.abs(
          q.x * b.x + q.y * b.y + q.z * b.z + q.w * b.w);
        return 2 * Math.acos(Math.min(1, d));
      };
      return {
        surgeP: E._surgeP,
        fired: E._surgeFired,
        surgeAt: E._beatAt.surge,
        igniteAt: E._beatAt.ignite,
        armL: E.parts.armL.rotation.z,
        armR: E.parts.armR.rotation.z,
        qA: qAng(0), qB: qAng(1), qC: qAng(2),
        shake: S.__m93.shake,
      };
    });
    check('M9.3: beat 3 — rings tilt + arms reposition, shake impulse fired (delay after AWAKE)',
      s1.surgeP === 1 && s1.fired &&
      s1.shake === B.surge.shake &&
      s1.surgeAt > 0 &&
      s1.surgeAt - s1.igniteAt >= B.surge.delay - 0.05 &&
      s1.surgeAt - s1.igniteAt <= B.surge.delay + 0.3 &&
      Math.abs(s1.armL + B.surge.armLift) < 1e-4 &&
      Math.abs(s1.armR - B.surge.armLift) < 1e-4 &&
      s1.qA > 0.05 && s1.qB > 0.05 && s1.qC > 0.05,
      `surgeAt−igniteAt=${(s1.surgeAt - s1.igniteAt).toFixed(2)} s` +
      ` (want ${B.surge.delay}), arms ${s1.armL.toFixed(3)}/` +
      `${s1.armR.toFixed(3)} rad, tilt ${s1.qA.toFixed(3)}/` +
      `${s1.qB.toFixed(3)}/${s1.qC.toFixed(3)} rad, shake=${s1.shake}`);

    /* 6. AWAKE holds the beats: surge pinned at 1, tilt stable
     *    frame to frame, rings still at the boost speed, and the beat
     *    timestamps are in order (flare < ignite < surge) */
    const hold1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      const q = E.parts.ringA.quaternion;
      const b = E._ringBaseQ[0];
      const d = Math.abs(
        q.x * b.x + q.y * b.y + q.z * b.z + q.w * b.w);
      return {
        surgeP: E._surgeP,
        qA: 2 * Math.acos(Math.min(1, d)),
        ang: E._ringAng[0],
        t: performance.now() / 1000,
        order: [E._beatAt.flare, E._beatAt.ignite, E._beatAt.surge],
      };
    });
    await sleep(300);
    const hold2 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      const q = E.parts.ringA.quaternion;
      const b = E._ringBaseQ[0];
      const d = Math.abs(
        q.x * b.x + q.y * b.y + q.z * b.z + q.w * b.w);
      return {
        surgeP: E._surgeP,
        qA: 2 * Math.acos(Math.min(1, d)),
        ang: E._ringAng[0],
        t: performance.now() / 1000,
      };
    });
    const dAng = hold2.ang - hold1.ang, dT = hold2.t - hold1.t;
    check('M9.3: AWAKE holds the beats (surge pinned, tilt stable, rings at boost, beat order)',
      hold1.surgeP === 1 && hold2.surgeP === 1 &&
      Math.abs(hold2.qA - hold1.qA) < 1e-6 &&
      Math.abs(dAng - spinA * W.ringBoost * dT) < 0.02 &&
      hold1.order[0] < hold1.order[1] && hold1.order[1] < hold1.order[2],
      `ringA Δang ${dAng.toFixed(3)} vs` +
      ` ${(spinA * W.ringBoost * dT).toFixed(3)} expected,` +
      ` order ${hold1.order.map(v => v.toFixed(1)).join(' < ')}`);

    /* 7. heap flat across the whole beat sequence (all per-node data
     *    + tilt scratch pre-allocated at init) — sampled BEFORE the
     *    screenshot pair (page-side canvas decodes are harness cost,
     *    not sim allocations) */
    const ha = await heapMin();
    check('M9.3: no allocation per frame (heap flat across the full beat sequence)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

    /* 8. visual gate: same street pose — the dormant reference pair
     *    vs the beats-on pair (shake decayed ⇒ stable camera). The lit
     *    node grid + flared eye + boosted hero light raise the region
     *    mean. shots/m93-awakening-beats.png */
    await page.waitForFunction(
      () => window.SIM.CAMERA.shakeEnergy === 0, { timeout: 8000 });
    let onSum = 0;
    for (let i = 0; i < 2; i++) {
      await sleep(150);
      onSum += await regionStats(
        (await page.screenshot(
          { path: `${here}/shots/m93-awakening-beats.png` }))
          .toString('base64'));
    }
    const onReg = onSum / 2;
    check('M9.3: beats visible on screen (shots/m93-awakening-beats.png) — lit grid + flared eye raise the region',
      fs.existsSync(`${here}/shots/m93-awakening-beats.png`) && coreXY.ok &&
      onReg > offReg + 1.0,
      `region mean ${offReg.toFixed(2)} → ${onReg.toFixed(2)}`);

    /* 9. force AWAKE → DECAY → DORMANT: everything restores EXACTLY —
     *    arms 0, ring quaternions byte-exact at base, node colors
     *    byte-exact, flash decayed, draw calls back to baseline */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    /* stay in the street pose — same pose as the visStreet baseline
     * (the keep-set / frustum is pose-dependent) */
    const d1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      const qSame = i => {
        const q = E.parts[['ringA', 'ringB', 'ringC'][i]].quaternion;
        const b = E._ringBaseQ[i];
        return q.x === b.x && q.y === b.y && q.z === b.z &&
          q.w === b.w;
      };
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return {
        same,
        armL: E.parts.armL.rotation.z,
        armR: E.parts.armR.rotation.z,
        q: qSame(0) && qSame(1) && qSame(2),
        ignited: E._ignited,
        surgeP: E._surgeP,
        flash: S.FX._flash,
        hero: E._hero.intensity,
        calls: S.renderer.info.render.calls,
        vis,
      };
    });
    const visA = new Set(d1.vis), visB = new Set(visStreet.vis);
    const visOnlyD1 = d1.vis.filter(v => !visB.has(v));
    const visOnlyBase = visStreet.vis.filter(v => !visA.has(v));
    const visSame = JSON.stringify(d1.vis) ===
      JSON.stringify(visStreet.vis);
    check('M9.3: beats resolve clean at DORMANT — pose + colors byte-exact, no leftover state',
      d1.same && d1.armL === 0 && d1.armR === 0 && d1.q &&
      !d1.ignited && d1.surgeP === 0 && d1.flash === 0 &&
      d1.hero >= 0.9 - 1e-6 && d1.hero <= 1.2 + 1e-6 && visSame,
      `hero=${d1.hero.toFixed(2)}, calls=${d1.calls}` +
      ` (baseline ${visStreet.calls}), visSet=${visSame ? 'identical' : `DIFFERS` +
      ` (onlyAtD1=[${visOnlyD1.slice(0, 6)}])` +
      ` (onlyAtBase=[${visOnlyBase.slice(0, 6)}])`}`);

    /* 10. re-trigger re-arms the beats: STIR again, shake re-armed,
     *    and a second forced cycle resolves clean again (the surge
     *    does NOT re-fire — the forced AWAKE never reaches its delay) */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    const r1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        state: E.state,
        surgeFired: E._surgeFired,
        flare: E._beatAt.flare,
        count: E._wakeCount,
      };
    });
    check('M9.3: re-trigger re-arms the beats (STIR again, shake re-armed)',
      r1.state === 'STIR' && !r1.surgeFired && r1.flare > 0 &&
      r1.count === 4,   // 2 cycles in M9.2 + 1 in this section + this one
      `count=${r1.count}, surgeFired=${r1.surgeFired}`);
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'AWAKE', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    const r2 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      return {
        same,
        armL: E.parts.armL.rotation.z,
        armR: E.parts.armR.rotation.z,
        ignited: E._ignited,
        surgeP: E._surgeP,
        shake: S.__m93.shake,
      };
    });
    check('M9.3: second full cycle resolves clean (re-trigger safe)',
      r2.same && r2.armL === 0 && r2.armR === 0 && !r2.ignited &&
      r2.surgeP === 0 && r2.shake === B.surge.shake,
      `shake total=${r2.shake} (want ${B.surge.shake} — one surge)`);

    /* cleanup: restore the wrapped APIs, park the dream wave,
     * reset the spawn pose */
    await page.evaluate(() => {
      const S = window.SIM;
      S.FX.flash = S.__m93f0;
      S.CAMERA.shake = S.__m93s0;
      delete S.__m93;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      const C = S.CAMERA;
      C.pos.set(0, 4, 18);
      C.vel.set(0, 0, 0);
      C.yaw = 0;
      C.pitch = 0;
    });
    await sleep(250);
  }

  /* ------------------------------------------------------------------
   * M9.4 — Awakening beats 4–5 (city-level cascade)
   *
   *  Beat 4 (u = 2.2 s into AWAKE): the plaza energy-pulse ring
   *    (FX.pulse, 660 m, 4 s) + the city holo-sign / LED-facade wave —
   *    per-instance color ramps scheduled by distance from the plaza,
   *    so the wave travels ring by ring (front 165 m/s, width 26 m,
   *    1.2 s lit hold, 1.6 s release, peak ×2.4; 1.0 = idle, restored
   *    EXACTLY). Beat 5 (u = 3.2 s): the traffic cascade — staggered
   *    substation bolts, steam burst, drones scatter / re-route to
   *    hover at the creature, sky vehicles take eased avoidance
   *    offsets off their lanes.
   *
   *  Triggered via ENTITY.wake() (M9.6 wires the manual key to it);
   *  transitions forced by fast-forwarding stateT as in M9.2/M9.3.
   *  DORMANT entry tears the whole cascade down: wave colors restored
   *  byte-exact, the plaza pulse dropped even mid-life, live bolts
   *  dropped, drone roles cleared, vehicle offsets eased out.
   * ------------------------------------------------------------------ */
  {
    const B = await page.evaluate(
      () => window.SIM.CFG.entity.beats.cascade);

    /* M9.5: wait out M9.3's final pulses (5 s life each) — the
     * registered check below asserts FX.count === 0 */
    await page.waitForFunction(
      () => window.SIM.FX.count === 0, { timeout: 12000 });

    /* park the dream wave + lightning auto-timer (as in M9.2/M9.3) */
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E && E._dream && !E._dream.active;
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });
    await page.waitForFunction(
      () => window.SIM.FX._flash === 0, { timeout: 5000 });

    /* 1. registered: config sane, cascade idle at DORMANT */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, T = S.TRAFFIC, W = S.WORLD;
      const B = S.CFG.entity.beats.cascade;
      let colors = true;
      for (const ch of W.chunks.values()) {
        for (const b of [ch.sign, ch.ledWin]) {
          if (b.count === 0 || !b.mesh.instanceColor) continue;
          const a = b.mesh.instanceColor.array;
          for (let i = 0; i < b.count * 3; i++)
            if (a[i] !== 1) { colors = false; break; }
        }
      }
      return {
        cfg: B.pulse.delay > 0 && B.pulse.radius > 100 &&
          B.pulse.life > 0 &&
          B.wave.speed > 0 && B.wave.width > 0 && B.wave.hold > 0 &&
          B.wave.release > 0 && B.wave.bright > 1 &&
          B.traffic.delay > B.pulse.delay && B.traffic.arcs > 0 &&
          B.traffic.arcStagger > 0 && B.traffic.steam > 0 &&
          B.traffic.scatter > 0 && B.traffic.escort > 0 &&
          B.traffic.avoidDur > 0 && B.traffic.avoidRamp > 0,
        idle: !E._cascadeFired && !E._trafficFired &&
          E._pulseIt === null &&
          E._beatAt.cascade === 0 && E._beatAt.traffic === 0 &&
          !W._waveActive && colors &&
          T._arcQ === 0 && T._arcNext === 0 &&
          S.FX.arcCount === 0 && S.FX.count === 0,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.4: city cascade registered — config sane, cascade idle at DORMANT',
      reg.cfg && reg.idle, `calls=${reg.calls}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* street pose (same as M9.1/M9.3) + visible-object baseline — the
     * teardown check below samples this same pose at DORMANT */
    await page.evaluate(() => {
      const C = window.SIM.CAMERA;
      C.pos.set(72, 1.7, 55);
      C.vel.set(0, 0, 0);
      C.yaw = 0.92;
      C.pitch = 0.30;
    });
    await sleep(250);
    const visBase = await page.evaluate(() => {
      const S = window.SIM;
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return { calls: S.renderer.info.render.calls, vis };
    });

    /* 2. wake() → STIR → force AWAKE; wait for beat 4 (u ≥ 2.2 s):
     *    the plaza pulse ring is live + the city wave is armed */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E.state === 'AWAKE' && E._cascadeFired;
    }, { timeout: 8000 });
    const b4 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, F = S.FX;
      let pit = null;
      for (let i = 0; i < F.count; i++)
        if (F._live[i].R === S.CFG.entity.beats.cascade.pulse.radius)
          pit = F._live[i];
      return {
        state: E.state,
        pulse: !!pit,
        origin: pit ? pit.ox === 0 && pit.oy === 0.4 && pit.oz === 0
          : false,
        owned: pit ? E._pulseIt === pit : false,
        wave: S.WORLD._waveActive,
        cascadeAt: E._beatAt.cascade,
        igniteAt: E._beatAt.ignite,
      };
    });
    check('M9.4: beat 4 — plaza pulse ring live + city wave armed (u ≥ 2.2 s)',
      b4.state === 'AWAKE' && b4.pulse && b4.origin && b4.owned &&
      b4.wave && b4.cascadeAt > 0 &&
      Math.abs(b4.cascadeAt - b4.igniteAt - 2.2) < 0.1,
      `Δbeat=${(b4.cascadeAt - b4.igniteAt).toFixed(2)} s (want 2.2)`);

    /* 3. the wave travels ring by ring: pick two scheduled rings —
     *    A = first instance ≥ 60 m from the plaza, B = first instance
     *    ≥ 100 m beyond A. The two front-pass moments are sampled
     *    INSIDE their waits (predicate side-effect): A lit while B
     *    is still ahead-dim (exactly 1.0), then B lit while A still
     *    holds (front travelled A → B at the speed). */
    const rings = await page.evaluate(() => {
      const W = window.SIM.WORLD;
      let dA = -1, dB = -1;
      for (const ch of W.chunks.values()) {
        if (!ch.group.visible) continue;
        for (const b of [ch.ledWin, ch.sign]) {
          for (let i = 0; i < b.count; i++) {
            const d = b.pars[i].d;
            if (dA < 0 && d >= 60) dA = d;
            if (dA >= 0 && dB < 0 && d >= dA + 100) dB = d;
          }
        }
        if (dB >= 0) break;
      }
      return { dA, dB };
    });
    const ringPass = tag => page.waitForFunction(
      ({ dA, dB, width, tag }) => {
        const W = window.SIM.WORLD;
        const wv = window.SIM.CFG.entity.beats.cascade.wave;
        if (!W._waveActive) return false;
        const r = (performance.now() / 1000 - W._waveT0) * wv.speed;
        if (r < (tag === 'g1' ? dA : dB) + width) return false;
        let a = -1, b = -1, aheadDim = true, aheadN = 0;
        for (const ch of W.chunks.values()) {
          if (!ch.group.visible) continue;
          for (const bb of [ch.ledWin, ch.sign]) {
            const arr = bb.mesh.instanceColor.array;
            for (let i = 0; i < bb.count; i++) {
              const p = bb.pars[i];
              const v = arr[i * 3];
              if (a < 0 && Math.abs(p.d - dA) < 0.5) a = v;
              if (b < 0 && dB > 0 && Math.abs(p.d - dB) < 0.5) b = v;
              if (v <= 1.01 && p.d > r + width) {
                if (v !== 1) aheadDim = false;
                aheadN++;
              }
            }
          }
        }
        window['__m94' + tag] = { a, b, r, aheadDim, aheadN };
        return true;
      },
      { dA: rings.dA, dB: rings.dB, width: B.wave.width, tag },
      { timeout: 15000 });
    const ringWait1 = ringPass('g1');
    const ringWait2 = ringPass('g2');
    const beat5Wait = page.waitForFunction(() => {
      const S = window.SIM, T = S.TRAFFIC;
      if (!S.ENTITY._trafficFired) return false;
      /* snapshot every live vehicle's avoidT at the fire moment —
       * all of them must have received the full avoidance */
      if (!window.__m94av0)
        window.__m94av0 =
          T._vLive.slice(0, T.vcount).map(it => it.avoidT);
      return true;
    }, { timeout: 20000 });
    await ringWait1;
    await ringWait2;
    const g1 = await page.evaluate(() => window.__m94g1);
    const g2 = await page.evaluate(() => window.__m94g2);
    check('M9.4: beat 4 — the wave lights the city ring by ring (A lit ⇒ B lit, ahead dim)',
      rings.dA > 0 && rings.dB > 0 && g1 && g2 &&
      g1.a > 1.5 && g1.b === 1 && g1.aheadDim && g1.aheadN > 0 &&
      g2.a > 1.5 && g2.b > 1.5 &&
      /* each wait fires within one rAF poll of its threshold — the
       * front moves 165 m/s, so g1's recorded r can overshoot its
       * threshold by up to a poll interval; 10 m covers two slow
       * (30 fps) frames while still proving the front travelled A→B */
      g2.r > g1.r + (rings.dB - rings.dA) - 10,
      `ringA d=${rings.dA.toFixed(0)} m: ${g1 && g1.a.toFixed(2)} → ${g2 && g2.a.toFixed(2)},`
      + ` ringB d=${rings.dB.toFixed(0)} m: ${g1 && g1.b.toFixed(2)} → ${g2 && g2.b.toFixed(2)},`
      + ` front r ${g1 && g1.r.toFixed(0)} → ${g2 && g2.r.toFixed(0)} m`);

    /* 4. beat 5 (u ≥ 3.2 s): the traffic cascade fires —
     *    __m94av0 (snapshotted at the fire moment) must show every
     *    live vehicle receiving the full avoidance */
    const steamBefore = await page.evaluate(
      () => window.SIM.PARTS.scount);
    await beat5Wait;
    const b5 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, T = S.TRAFFIC;
      let nScatter = 0, nEscort = 0;
      for (let i = 0; i < T.count; i++) {
        if (T._live[i].state === 3) nScatter++;
        if (T._live[i].state === 4) nEscort++;
      }
      let avoidN = 0;
      for (let i = 0; i < T.vcount; i++)
        if (T._vLive[i].avoidT > 0) avoidN++;
      let bolts = 0;
      for (let i = 0; i < 3; i++)
        if (T._arcIt[i]) bolts++;
      /* tag the cascaded drones so the later scan can verify
       * per-drone monotonicity (the mean over a shrinking set is
       * not monotonic — completers drop out) */
      for (let i = 0; i < T.count; i++) {
        const it = T._live[i];
        if (it.state === 3)
          it._m94d0 = Math.hypot(it.px, it.pz);
        if (it.state === 4)
          it._m94t0 = Math.hypot(it.px - it.rx, it.py - it.ry,
            it.pz - it.rz);
      }
      return {
        nScatter, nEscort, drones: T.count,
        avoidN, vehicles: T.vcount,
        av0: window.__m94av0 ? window.__m94av0.length : -1,
        av0Full: window.__m94av0
          ? window.__m94av0.every(t => t > 3.9)
          : false,
        arcQ: T._arcQ, bolts,
        steam: S.PARTS.scount,
        trafficAt: E._beatAt.traffic,
        igniteAt: E._beatAt.ignite,
      };
    });
    check('M9.4: beat 5 — traffic cascade fires (scatter + escort roles, vehicle offsets, bolts queued)',
      b5.nScatter >= 1 && b5.nEscort >= 1 &&
      b5.av0 > 0 && b5.av0Full &&
      b5.avoidN >= 1 && b5.avoidN <= b5.vehicles &&
      b5.bolts >= 1 && b5.steam >= steamBefore - 2 && b5.steam <= 48 &&
      Math.abs(b5.trafficAt - b5.igniteAt - 3.2) < 0.1,
      `scatter=${b5.nScatter}, escort=${b5.nEscort} (of ${b5.drones}),`
      + ` at-fire vehicles=${b5.av0} (all full),`
      + ` live avoiding=${b5.avoidN}/${b5.vehicles}, bolts=${b5.bolts},`
      + ` steam ${steamBefore} → ${b5.steam},`
      + ` Δbeat=${(b5.trafficAt - b5.igniteAt).toFixed(2)} s (want 3.2)`);

    /* 5. substation bolts fire (first within a frame, second at
     *    +arcStagger) */
    await sleep(300);
    const a1 = await page.evaluate(() => window.SIM.FX.arcCount);
    await sleep(300);
    const a2 = await page.evaluate(() => window.SIM.FX.arcCount);
    check('M9.4: beat 5 — substation bolts fire (live arcs observed)',
      a1 >= 1 && a2 >= 1, `arcCount ${a1} → ${a2}`);

    /* 6. drones: per-drone monotonicity — every scatter drone is at
     *    least as far out as when tagged (radial outward paths), some
     *    have moved ≥ 1 m; every escort is no farther from its hover
     *    target than when tagged (straight approach), some closed
     *    ≥ 1 m. (The mean over the shrinking in-flight set is not
     *    monotonic — completers drop out.) */
    const droneScan = () => page.evaluate(() => {
      const T = window.SIM.TRAFFIC;
      let n3 = 0, moved = 0, mono3 = true, n4 = 0, mono4 = true, close = 0;
      for (let i = 0; i < T.count; i++) {
        const it = T._live[i];
        if (it.state === 3 && it._m94d0 !== undefined) {
          n3++;
          const d = Math.hypot(it.px, it.pz);
          if (d < it._m94d0 - 0.01) mono3 = false;
          if (d > it._m94d0 + 1) moved++;
        }
        if (it.state === 4 && it._m94t0 !== undefined) {
          n4++;
          const d = Math.hypot(it.px - it.rx, it.py - it.ry, it.pz - it.rz);
          if (d > it._m94t0 + 0.01) mono4 = false;
          if (it._m94t0 - d > 1) close++;
        }
      }
      return { n3, moved, mono3, n4, mono4, close };
    });
    const s1 = await droneScan();
    await sleep(600);
    const s2 = await droneScan();
    check('M9.4: beat 5 — drones scatter outward, escorts fly to the hover ring',
      s1.n3 > 0 && s1.n4 > 0 &&
      s2.mono3 && s2.n3 > 0 && s2.moved >= 1 &&
      s2.mono4 && s2.n4 > 0 && s2.close >= 1,
      `scatter tagged=${s1.n3} (mono=${s2.mono3 ? 'ok' : 'BROKEN'}, moved=${s2.moved}),`
      + ` escort tagged=${s1.n4} (mono=${s2.mono4 ? 'ok' : 'BROKEN'}, closed=${s2.close})`);

    /* 7. vehicle avoidance: per-vehicle invariant — a vehicle still
     *    avoiding (av > 0) renders its eased offset (lateral ≈ ox·av
     *    within one lane step, altitude exact); a vehicle at rest
     *    (av = 0 — incl. ones respawned after the fire) renders
     *    exactly on its lane. No fire-moment tag needed. */
    const v1 = await page.evaluate(() => {
      const T = window.SIM.TRAFFIC;
      let ok = true, avoiding = 0, maxAv = 0;
      for (let i = 0; i < T.vcount; i++) {
        const it = T._vLive[i];
        T.vmesh.getMatrixAt(i, T._vm);   /* fills T._vm (no return) */
        const e = T._vm.elements;
        /* the matrix was composed last frame — one lane step (~0.7 m
         * at 26–44 m/s) of slack on the lateral axis; altitude is
         * analytic (py never moves) ⇒ exact */
        const lat = it.axis === 0 ? e[12] - it.px : e[14] - it.pz;
        if (it.av > 0) {
          avoiding++;
          maxAv = Math.max(maxAv, it.av);
          if (it.av < 1) ok = false;
          if (Math.abs(Math.abs(lat) - Math.abs(it.ox)) > 1.0)
            ok = false;
          if (Math.abs(e[13] - (it.py + it.oalt * it.av)) > 0.01)
            ok = false;
        } else if (Math.abs(lat) > 1.0 || e[13] - it.py !== 0)
          ok = false;
      }
      return { ok, n: T.vcount, avoiding, maxAv };
    });
    check('M9.4: beat 5 — vehicles take avoidance offsets (ramped, rendered off-lane)',
      v1.ok && v1.n > 0 && v1.avoiding >= 1 && v1.maxAv === 1,
      `vehicles=${v1.n}, avoiding=${v1.avoiding},`
      + ` av=${v1.maxAv.toFixed(2)}`);

    /* 8. heap flat across the cascade (window ends here — before the
     *     teardown / re-trigger, as in M9.3; the visual gate's
     *     screenshot decodes below are harness cost, sampled after)
     *    */
    const ha = await heapMin();
    check('M9.4: no allocation per frame (heap flat across the full cascade)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

    /* 9. visual gate: same street pose — off = wave colors restored
     *    to 1.0, on = the wave in flight. The wavefront is pinned to
     *    400 m for the pair (near + mid city fully lit, independent
     *    of the section clock), then _waveT0 is restored. The region
     *    is anchored on a LIT instance that projects into the frame
     *    (the LED facade / holo sign the front lit — the wave lights
     *    the city at street level, not the sky region above the
     *    creature); 12 nearest-to-camera candidates are scored and
     *    the best region wins, so occluded candidates (Δ ≈ 0) can
     *    never hide a visible one.
     *    shots/m94-city-cascade.png */
    const t0save = await page.evaluate(() => {
      const W = window.SIM.WORLD;
      const save = W._waveT0;
      W._waveT0 = performance.now() / 1000 - 400 /
        window.SIM.CFG.entity.beats.cascade.wave.speed;
      return save;
    });
    await page.evaluate(
      () => { window.SIM.WORLD._waveActive = true; });
    await sleep(150);
    const cands = await page.evaluate(() => {
      const S = window.SIM, W = S.WORLD, C = S.CAMERA.pos;
      const out = [];
      for (const ch of W.chunks.values()) {
        if (!ch.group.visible) continue;
        for (const b of [ch.sign, ch.ledWin]) {
          const arr = b.mesh.instanceColor.array;
          for (let i = 0; i < b.count; i++) {
            if (arr[i * 3] <= 1.5) continue;
            const p = b.pars[i];
            /* the LED facade mesh sits `off` along the face normal
             * from the building center — anchor on the facade itself
             * (signs are already at their own position) */
            const ax = p.fx !== undefined ? p.fx : p.x,
              az = p.fz !== undefined ? p.fz : p.z;
            /* project() does not reject behind-camera points (a
             * perspective divide mirrors them into a valid NDC) —
             * the camera-space z does */
            const me = S.camera.matrixWorldInverse.elements;
            const cz = me[2] * ax + me[6] * p.y + me[10] * az + me[14];
            if (cz >= 0) continue;
            const pr = S.project(ax, p.y, az);
            if (pr.x < -0.6 || pr.x > 0.6 || pr.y < -0.6 || pr.y > 0.6)
              continue;
            /* nearest to the camera = largest on screen = the
             * strongest signal for the region mean */
            const dx = ax - C.x, dy = p.y - C.y, dz = az - C.z;
            out.push({
              d: dx * dx + dy * dy + dz * dz,
              x: (pr.x + 1) / 2 * window.innerWidth,
              y: (1 - pr.y) / 2 * window.innerHeight,
            });
          }
        }
      }
      out.sort((a, b2) => a.d - b2.d);
      return out.slice(0, 20);
    });
    if (cands.length === 0)
      throw new Error(
        'M9.4 visual gate: no lit LED/sign instance projects into the frame');
    /* freeze the LED/sign canvas textures so the off/on pair compares the
     * wave against a CONSTANT facade texture (the 15 Hz LED flicker/scanline
     * and 8 Hz sign flicker otherwise animate between the two shots and
     * confound the brightness delta). Restored right after the pair. */
    await page.evaluate(() => {
      const K = window.SIM.KIT;
      const fixedT = window.SIM.WORLD._simU ? window.SIM.WORLD._simU() : 0;
      window.__m94unfreeze = [];
      for (const key of ['ledA', 'ledB', 'signQwen', 'signUnsloth']) {
        const T = K.tex[key];
        if (!T) continue;
        const orig = T.redraw;
        orig.call(T, fixedT);
        T.redraw = u => orig.call(T, fixedT);
        window.__m94unfreeze.push(() => { T.redraw = orig; });
      }
    });
    /* off pair: wave off (every color restored to exactly 1.0) */
    const offB64 = [];
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const W = window.SIM.WORLD;
        W._waveActive = false;
        W._waveRestore();
      });
      await sleep(150);
      offB64.push((await page.screenshot()).toString('base64'));
    }
    /* on pair: the wave in flight (front pinned to 400 m) */
    const onB64 = [];
    for (let i = 0; i < 2; i++) {
      await page.evaluate(
        () => { window.SIM.WORLD._waveActive = true; });
      await sleep(150);
      onB64.push((await page.screenshot(
        { path: `${here}/shots/m94-city-cascade.png` }))
        .toString('base64'));
    }
    await page.evaluate(t0 => {
      window.SIM.WORLD._waveT0 = t0;
    }, t0save);
    /* restore the animated LED/sign textures now that the pair is captured */
    await page.evaluate(() => {
      (window.__m94unfreeze || []).forEach(f => f());
      window.__m94unfreeze = null;
    });
    /* the anchored lit facades light a small region each (±8 % of the half-res
     * frame); the SUM over all candidates is used (not the best) so that
     * occluded candidates (Δ ≈ 0) and per-facade LED-cell flicker average out
     * — the city as a whole must measurably brighten when the wave is on */
    const vreg = await page.evaluate(async ({ cands, offB64, onB64 }) => {
      const decode = b64 => new Promise(res2 => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          /* half-res decode — the region mean is resolution-invariant
           * and keeps the transient canvas buffer small */
          c.width = Math.floor(img.width / 2);
          c.height = Math.floor(img.height / 2);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          res2(ctx);
        };
        img.src = 'data:image/png;base64,' + b64;
      });
      const mean = (ctx, cx, cy) => {
        const hw = Math.floor(ctx.canvas.width * 0.08) / 2;
        const hh = Math.floor(ctx.canvas.height * 0.08) / 2;
        const x0 = Math.max(0, Math.round(cx - hw));
        const y0 = Math.max(0, Math.round(cy - hh));
        const x1 = Math.min(ctx.canvas.width, Math.round(cx + hw));
        const y1 = Math.min(ctx.canvas.height, Math.round(cy + hh));
        const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4)
          sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        return sum / (d.length / 4);
      };
      const offCtx = [await decode(offB64[0]), await decode(offB64[1])];
      const onCtx = [await decode(onB64[0]), await decode(onB64[1])];
      let sum = 0, best = 0, bestC = -1;
      for (let k = 0; k < cands.length; k++) {
        const cx = cands[k].x / 2, cy = cands[k].y / 2;
        const on = (mean(onCtx[0], cx, cy) + mean(onCtx[1], cx, cy)) / 2;
        const off = (mean(offCtx[0], cx, cy) + mean(offCtx[1], cx, cy)) / 2;
        const d = on - off;
        sum += d;
        if (d > best) { best = d; bestC = k; }
      }
      return { sum, best, bestC, n: cands.length };
    }, { cands, offB64, onB64 });
    check('M9.4: cascade visible on screen (shots/m94-city-cascade.png) — wave lights the city region',
      fs.existsSync(`${here}/shots/m94-city-cascade.png`) && vreg.sum > 0.25,
      `${vreg.n} candidates: Σ region Δ ${vreg.sum.toFixed(2)} (best cand ${vreg.bestC} Δ ${vreg.best.toFixed(2)})`);

    /* 10. force AWAKE → DECAY → DORMANT: the cascade tears down —
     *    colors byte-exact, the plaza pulse dropped mid-life, live
     *    bolts dropped, drone roles cleared, offsets easing out */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    const d1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, T = S.TRAFFIC, W = S.WORLD;
      let colors = true;
      for (const ch of W.chunks.values()) {
        for (const b of [ch.sign, ch.ledWin]) {
          if (b.count === 0 || !b.mesh.instanceColor) continue;
          const a = b.mesh.instanceColor.array;
          for (let i = 0; i < b.count * 3; i++)
            if (a[i] !== 1) { colors = false; break; }
        }
      }
      let roles = 0;
      for (let i = 0; i < T.count; i++)
        if (T._live[i].state === 3 || T._live[i].state === 4) roles++;
      let maxAv = 0;
      for (let i = 0; i < T.vcount; i++)
        maxAv = Math.max(maxAv, T._vLive[i].av);
      /* M9.5: the sole live pulse at DORMANT entry must be the beat-7
       * final pulse (the cascade plaza pulse was dropped mid-life) */
      let fin = 0, finOk = false;
      for (let i = 0; i < S.FX.count; i++) {
        const it = S.FX._live[i];
        if (it.R === S.CFG.entity.beats.finalPulse.radius) {
          fin++;
          finOk = it.ox === 0 && it.oy === 0.4 && it.oz === 0;
        }
      }
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return {
        colors, wave: W._waveActive, roles, maxAv,
        fx: S.FX.count, arcs: S.FX.arcCount, arcQ: T._arcQ,
        fin, finOk,
        pulseIt: E._pulseIt,
        hero: E._hero.intensity,
        calls: S.renderer.info.render.calls,
        vis,
      };
    });
    const visSame = JSON.stringify(d1.vis) ===
      JSON.stringify(visBase.vis);
    check('M9.4: cascade tears down at DORMANT — colors byte-exact, pulse/bolts dropped, roles cleared, visible set back to baseline',
      d1.colors && !d1.wave && d1.roles === 0 && d1.fx === 1 &&
      d1.fin === 1 && d1.finOk &&
      d1.arcs === 0 && d1.arcQ === 0 && d1.pulseIt === null &&
      d1.hero >= 0.9 - 1e-6 && d1.hero <= 1.2 + 1e-6 && visSame,
      `hero=${d1.hero.toFixed(2)}, calls=${d1.calls}` +
      ` (baseline ${visBase.calls}), fx=${d1.fx} (M9.5 final pulse),` +
      ` arcs=${d1.arcs},` +
      ` maxAv=${d1.maxAv.toFixed(2)}` +
      ` (visible set ${visSame ? 'identical' : 'DIFFERS'})`);

    /* 11. the vehicle offsets ease out to exactly 0 — hulls back on
     *     their analytic lanes */
    await page.waitForFunction(() => {
      const T = window.SIM.TRAFFIC;
      if (T.vcount === 0) return false;
      for (let i = 0; i < T.vcount; i++)
        if (T._vLive[i].av > 0) return false;
      return true;
    }, { timeout: 4000 });
    const v2 = await page.evaluate(() => {
      const T = window.SIM.TRAFFIC;
      let ok = true;
      for (let i = 0; i < T.vcount; i++) {
        const it = T._vLive[i];
        T.vmesh.getMatrixAt(i, T._vm);   /* fills T._vm (no return) */
        const e = T._vm.elements;
        /* last-frame slack on the lane axis only; altitude exact —
         * a leftover offset would leave ≥ 5 m of altitude */
        const lat = it.axis === 0 ? e[12] - it.px : e[14] - it.pz;
        if (Math.abs(lat) > 1.0) ok = false;
        if (Math.abs(e[13] - it.py) > 0.01) ok = false;
      }
      return ok;
    });
    check('M9.4: vehicle avoidance offsets ease out to exactly 0 (hulls back on their lanes)',
      v2);

    /* 12. re-trigger re-arms the cascade: STIR again, cascade idle,
     *     and a second full forced cycle re-fires + resolves clean
     *     (re-trigger safe) */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    const r1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY, W = window.SIM.WORLD;
      return {
        state: E.state,
        cascade: E._cascadeFired,
        traffic: E._trafficFired,
        pulseIt: E._pulseIt,
        wave: W._waveActive,
        count: E._wakeCount,
      };
    });
    check('M9.4: re-trigger re-arms the cascade (STIR again, cascade idle)',
      r1.state === 'STIR' && !r1.cascade && !r1.traffic &&
      r1.pulseIt === null && !r1.wave && r1.count === 6,
      `count=${r1.count}`);
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E.state === 'AWAKE' &&
        E._cascadeFired && E._trafficFired;
    }, { timeout: 8000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    const r2 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, T = S.TRAFFIC, W = S.WORLD;
      let colors = true;
      for (const ch of W.chunks.values()) {
        for (const b of [ch.sign, ch.ledWin]) {
          if (b.count === 0 || !b.mesh.instanceColor) continue;
          const a = b.mesh.instanceColor.array;
          for (let i = 0; i < b.count * 3; i++)
            if (a[i] !== 1) { colors = false; break; }
        }
      }
      let roles = 0;
      for (let i = 0; i < T.count; i++)
        if (T._live[i].state === 3 || T._live[i].state === 4) roles++;
      let fin = 0;
      for (let i = 0; i < S.FX.count; i++)
        if (S.FX._live[i].R === S.CFG.entity.beats.finalPulse.radius)
          fin++;
      return {
        colors, wave: W._waveActive, roles,
        fx: S.FX.count, arcs: S.FX.arcCount, arcQ: T._arcQ,
        fin,
        count: E._wakeCount,
      };
    });
    check('M9.4: second full cycle — cascade re-fires and resolves clean (re-trigger safe)',
      r2.count === 6 && r2.colors && !r2.wave && r2.roles === 0 &&
      r2.fx >= 1 && r2.fin >= 1 && r2.arcs === 0 && r2.arcQ === 0,
      `count=${r2.count}, fx=${r2.fx} (M9.5 final pulse ${r2.fin}),` +
      ` arcs=${r2.arcs}`);

    /* cleanup: park the dream wave + lightning, reset the spawn pose */
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      const C = S.CAMERA;
      C.pos.set(0, 4, 18);
      C.vel.set(0, 0, 0);
      C.yaw = 0;
      C.pitch = 0;
    });
    await sleep(250);
  }

  /* ------------------------------------------------------------------
   * M9.5 — Awakening beats 6–7 + decay
   *
   *  Beat 6: the Unsloth easter-egg reaction hook (M10.3) — fires
   *    `egg.delay` s into AWAKE (gated on _ignited, one fire per
   *    sequence): registered reactions get 'start', and 'end' at
   *    DORMANT entry. M10.3 is the only consumer — the smoke
   *    registers a fake reaction to verify the hook.
   *  Beat 7: decay — the ignited node grid dims outward (front from
   *    head level: inner nodes dim first, the front passes the
   *    farthest node + width before DORMANT entry ⇒ the byte-exact
   *    restore is pop-free), and one final pulse fires at DORMANT
   *    entry (radius 820 m — a distinct signature from the M9.4
   *    cascade pulse). The "hum settles" audio is M11.3 (no audio
   *    system yet — the DECAY/DORMANT state entry hooks are the seam).
   *
   *  Triggered via ENTITY.wake() (M9.6 wires the manual key to it);
   *    transitions forced by fast-forwarding stateT as in M9.2/M9.3.
   *    The gate: the full sequence ends in DORMANT with one final
   *    pulse; an immediate re-trigger works.
   * ------------------------------------------------------------------ */
  {
    const B = await page.evaluate(() => window.SIM.CFG.entity.beats);

    /* wait out M9.4's final pulses (5 s life each) + park the dream
     * wave + lightning auto-timer (as in M9.2/M9.3/M9.4) */
    await page.waitForFunction(
      () => window.SIM.FX.count === 0, { timeout: 12000 });
    await page.waitForFunction(() => {
      const E = window.SIM.ENTITY;
      return E && E._dream && !E._dream.active;
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });
    await page.waitForFunction(
      () => window.SIM.FX._flash === 0, { timeout: 5000 });

    /* 1. registered: config sane, beats 6–7 idle at DORMANT */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, B = S.CFG.entity.beats;
      return {
        cfg: B.egg.delay > B.cascade.traffic.delay &&
          B.decayDim.at > 0 && B.decayDim.at <= 1 &&
          B.finalPulse.radius > 0 && B.finalPulse.life > 0 &&
          B.finalPulse.radius !== B.cascade.pulse.radius &&
          E._dimSpeed > 0 && Array.isArray(E._eggReact) &&
          typeof E.eggReact === 'function',
        idle: !E._eggFired && E._beatAt.egg === 0 &&
          S.FX.count === 0,
        calls: S.renderer.info.render.calls,
      };
    });
    check('M9.5: beats 6–7 registered — config sane, egg/dim/final-pulse idle at DORMANT',
      reg.cfg && reg.idle, `calls=${reg.calls}`);

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* street pose (same as M9.1/M9.3/M9.4) + visible-object baseline */
    await page.evaluate(() => {
      const C = window.SIM.CAMERA;
      C.pos.set(72, 1.7, 55);
      C.vel.set(0, 0, 0);
      C.yaw = 0.92;
      C.pitch = 0.30;
    });
    await sleep(250);
    const visBase = await page.evaluate(() => {
      const S = window.SIM;
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return { vis, calls: S.renderer.info.render.calls };
    });

    /* 2. register a fake egg reaction (M10.3's future consumer) and
     *    wake() → STIR: beat 6 re-armed, no reaction fired yet */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      window.__m95 = { egg: [] };
      window.__m95.fake = (ph) => { window.__m95.egg.push(ph); };
      E.eggReact(window.__m95.fake);
      E.wake();
    });
    const st1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        state: E.state,
        eggFired: E._eggFired,
        eggAt: E._beatAt.egg,
        finalIt: E._finalPulseIt === null,
        egg: window.__m95.egg.slice(),
        count: E._wakeCount,
      };
    });
    check('M9.5: wake() re-arms beat 6 (STIR, egg idle, no reaction yet, final-pulse handle cleared)',
      st1.state === 'STIR' && !st1.eggFired && st1.eggAt === 0 &&
      st1.finalIt && st1.egg.length === 0 && st1.count === 7,
      `count=${st1.count}, egg=${st1.egg}`);

    /* 3. force STIR → AWAKE; wait for beat 6 (u ≥ 4.2 s): the fake
     *    reaction got exactly one 'start', beat time ≈ ignite + 4.2 */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY._eggFired, { timeout: 8000 });
    const b6 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        state: E.state,
        egg: window.__m95.egg.slice(),
        eggAt: E._beatAt.egg,
        igniteAt: E._beatAt.ignite,
      };
    });
    check('M9.5: beat 6 — easter-egg reaction hook fires once in AWAKE (u ≥ 4.2 s)',
      b6.state === 'AWAKE' &&
      JSON.stringify(b6.egg) === JSON.stringify(['start']) &&
      b6.eggAt > 0 &&
      Math.abs(b6.eggAt - b6.igniteAt - B.egg.delay) < 0.1,
      `Δbeat=${(b6.eggAt - b6.igniteAt).toFixed(2)} s (want ${B.egg.delay}),` +
      ` egg=${b6.egg}`);

    /* 4. beat 6 does not re-fire */
    await sleep(400);
    const b6b = await page.evaluate(() => window.__m95.egg.length);
    check('M9.5: beat 6 fires exactly once per sequence',
      b6b === 1, `egg calls=${b6b}`);

    /* 5. force AWAKE → DECAY: the ignited grid dims outward — inner
     *    nodes dim first (front travels outward from head level), the
     *    mean lit level falls frame to frame, outer nodes still lit */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    const dimSample = () => page.evaluate(() => {
      const E = window.SIM.ENTITY;
      const ic = E.nodes.instanceColor.array;
      const dist = E._nodeDist;
      let iIn = -1, iOut = -1;
      for (let i = 0; i < E.nodeCount; i++) {
        if (iIn < 0 && dist[i] < 12) iIn = i;
        if (iOut < 0 && dist[i] > E._dream.maxR - 2) iOut = i;
      }
      const br = i => {
        const i3 = i * 3;
        return Math.max(ic[i3], ic[i3 + 1], ic[i3 + 2]);
      };
      let sum = 0;
      for (let i = 0; i < E.nodeCount; i++) sum += br(i);
      return {
        state: E.state,
        in: iIn >= 0 ? br(iIn) : -1,
        out: iOut >= 0 ? br(iOut) : -1,
        mean: sum / E.nodeCount,
      };
    });
    await sleep(700);
    const dm1 = await dimSample();
    await sleep(300);
    const dm2 = await dimSample();
    check('M9.5: beat 7 — the wave dims outward during DECAY (inner first, mean falling, outer still lit)',
      dm1.state === 'DECAY' && dm1.in < dm1.out &&
      dm2.mean < dm1.mean && dm2.in < dm2.out &&
      dm2.out > 0.2 && dm2.mean > 0.05,
      `mean ${dm1.mean.toFixed(3)} → ${dm2.mean.toFixed(3)},` +
      ` inner ${dm1.in.toFixed(3)} → ${dm2.in.toFixed(3)},` +
      ` outer ${dm1.out.toFixed(3)} → ${dm2.out.toFixed(3)}`);

    /* 6. force DECAY → DORMANT: one final pulse fires, the egg
     *    reaction gets 'end', everything restores EXACTLY */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    const d3 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, B = S.CFG.entity.beats;
      let fin = 0, finOk = false;
      for (let i = 0; i < S.FX.count; i++) {
        const it = S.FX._live[i];
        if (it.R === B.finalPulse.radius) {
          fin++;
          finOk = it.ox === 0 && it.oy === 0.4 && it.oz === 0;
        }
      }
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      const qSame = i => {
        const q = E.parts[['ringA', 'ringB', 'ringC'][i]].quaternion;
        const b = E._ringBaseQ[i];
        return q.x === b.x && q.y === b.y && q.z === b.z && q.w === b.w;
      };
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true;
          for (let p = o; p; p = p.parent) v = v && p.visible;
          if (v) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return {
        fx: S.FX.count, fin, finOk,
        same,
        egg: window.__m95.egg.slice(),
        ignited: E._ignited,
        eggFired: E._eggFired,
        eggAt: E._beatAt.egg,
        armL: E.parts.armL.rotation.z,
        armR: E.parts.armR.rotation.z,
        rx: E.parts.head.rotation.x,
        hy: E.parts.head.position.y,
        jaw: E.parts.jaw.rotation.x,
        q: qSame(0) && qSame(1) && qSame(2),
        hero: E._hero.intensity,
        flash: S.FX._flash,
        calls: S.renderer.info.render.calls,
        vis,
      };
    });
    const visSame = JSON.stringify(d3.vis) ===
      JSON.stringify(visBase.vis);
    check('M9.5: sequence ends in DORMANT with one final pulse (egg reaction ended, everything byte-exact)',
      d3.fx === 1 && d3.fin === 1 && d3.finOk &&
      JSON.stringify(d3.egg) === JSON.stringify(['start', 'end']) &&
      d3.same && !d3.ignited && !d3.eggFired && d3.eggAt === 0 &&
      d3.armL === 0 && d3.armR === 0 &&
      d3.rx === 0 && d3.hy === 43.6 && d3.jaw === 0 && d3.q &&
      d3.hero >= 0.9 - 1e-6 && d3.hero <= 1.2 + 1e-6 &&
      d3.flash === 0 && visSame,
      `fx=${d3.fx} (final ${d3.fin}), hero=${d3.hero.toFixed(2)},` +
      ` calls=${d3.calls} (baseline ${visBase.calls})` +
      ` (visible set ${visSame ? 'identical' : 'DIFFERS'})`);

    /* 7. the final pulse resolves (5 s life) — no leftover FX state */
    await page.waitForFunction(() => {
      const S = window.SIM, B = S.CFG.entity.beats;
      for (let i = 0; i < S.FX.count; i++)
        if (S.FX._live[i].R === B.finalPulse.radius) return false;
      return true;
    }, { timeout: 8000 });
    const fp = await page.evaluate(() => {
      const S = window.SIM;
      return { fx: S.FX.count, arcs: S.FX.arcCount };
    });
    check('M9.5: the final pulse resolves clean (no leftover FX state)',
      fp.fx === 0 && fp.arcs === 0, `fx=${fp.fx}, arcs=${fp.arcs}`);

    /* 8. heap flat across the full sequence (window ends here —
     *    before the re-trigger, as in M9.3/M9.4) */
    const ha = await heapMin();
    check('M9.5: no allocation per frame (heap flat across the full sequence)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

    /* 9. re-trigger immediately works: STIR again (count 8), and a
     *    second full forced cycle re-fires beat 6 + the final pulse
     *    and resolves clean again */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    const r1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        state: E.state,
        eggFired: E._eggFired,
        count: E._wakeCount,
        egg: window.__m95.egg.length,
      };
    });
    check('M9.5: re-trigger immediately works (STIR again, beat 6 re-armed)',
      r1.state === 'STIR' && !r1.eggFired && r1.count === 8 &&
      r1.egg === 2,
      `count=${r1.count}, egg calls=${r1.egg}`);
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY._eggFired, { timeout: 8000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    const r2 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, B = S.CFG.entity.beats;
      let fin = 0;
      for (let i = 0; i < S.FX.count; i++)
        if (S.FX._live[i].R === B.finalPulse.radius) fin++;
      const ic = E.nodes.instanceColor.array;
      let same = true;
      for (let i = 0; i < E._nodeBase.length; i++)
        if (ic[i] !== E._nodeBase[i]) { same = false; break; }
      return {
        fin, fx: S.FX.count,
        egg: window.__m95.egg.slice(),
        same,
        ignited: E._ignited,
        eggFired: E._eggFired,
        count: E._wakeCount,
      };
    });
    check('M9.5: second full cycle — beat 6 + final pulse re-fire and resolve clean (re-trigger safe)',
      r2.count === 8 && r2.fin === 1 && r2.fx === 1 &&
      JSON.stringify(r2.egg) ===
      JSON.stringify(['start', 'end', 'start', 'end']) &&
      r2.same && !r2.ignited && !r2.eggFired,
      `count=${r2.count}, fx=${r2.fx} (final ${r2.fin})`);

    /* cleanup: drop the fake reaction (splice ONLY it — the real
     * M10.3 reaction is registered at boot and must survive), park the
     * dream wave + lightning again, reset the spawn pose */
    await page.evaluate(() => {
      const S = window.SIM;
      const i = S.ENTITY._eggReact.indexOf(window.__m95.fake);
      if (i >= 0) S.ENTITY._eggReact.splice(i, 1);
      delete S.__m95;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
      const C = S.CAMERA;
      C.pos.set(0, 4, 18);
      C.vel.set(0, 0, 0);
      C.yaw = 0;
      C.pitch = 0;
    });
    await sleep(250);
  }

  /* ------------------------------------------------------------------
   * M9.6 — Triggers: manual key (F) + HUD button + one-shot auto
   *
   *  All three entry paths route through ENTITY.wake() and therefore
   *    start the same state machine exactly once (wake() is a no-op
   *    unless DORMANT — a re-press / re-click mid-sequence never
   *    re-triggers). The auto fires once, trigger.auto (30 s) after
   *    intro end (BOOT.t0), for the session that presses nothing
   *    (`_userTriggered` gate) and never re-fires after burning.
   *    Smoke parked `_autoAt` from boot (a live auto at 30 s would
   *    inject a full sequence into the earlier sections) and steers
   *    it directly here; transitions are forced by fast-forwarding
   *    stateT as in M9.2/M9.5.
   *  No screenshot gate: the analytic checks are strictly stronger
   *    than a picture.
   * ------------------------------------------------------------------ */
  {
    /* wait out M9.5's final pulses (5 s life) + park the dream wave
     * and the lightning auto-timer (as in M9.2/M9.3/M9.4/M9.5) */
    await page.waitForFunction(
      () => window.SIM.FX.count === 0, { timeout: 12000 });
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });

    /* 1. registered: config sane, trigger state idle at DORMANT */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, I = S.INPUT;
      return {
        cfg: S.CFG.entity.trigger.auto === 30 &&
          E._userTriggered === false && E._autoFired === false &&
          E._autoAt === Infinity && I.wakeTrigger === false,
        btn: !!document.getElementById('awakeBtn'),
        state: E.state,
        count: E._wakeCount,
      };
    });
    check('M9.6: triggers registered — auto = 30 s, HUD button present, trigger state idle at DORMANT',
      reg.cfg && reg.btn && reg.state === 'DORMANT',
      `count=${reg.count}`);
    const count0 = reg.count;

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* fast-forward the live sequence back to DORMANT (M9.5 pattern)
     * and wait out the final pulse */
    const settleDormant = async () => {
      await page.evaluate(() => {
        const E = window.SIM.ENTITY;
        E.stateT = performance.now() / 1000 -
          window.SIM.CFG.entity.wake.stir - 0.05;
      });
      await page.waitForFunction(
        () => window.SIM.ENTITY.state === 'AWAKE', { timeout: 5000 });
      await page.evaluate(() => {
        const E = window.SIM.ENTITY;
        E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
      });
      await page.waitForFunction(
        () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
      await page.evaluate(() => {
        const E = window.SIM.ENTITY;
        E.stateT = performance.now() / 1000 -
          window.SIM.CFG.entity.wake.decay - 0.05;
      });
      await page.waitForFunction(
        () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
      await page.waitForFunction(
        () => window.SIM.FX.count === 0, { timeout: 12000 });
    };

    /* 2. manual key path: F starts the sequence exactly once (the
     *    edge is consumed, the user-triggered flag is set, and a
     *    re-press mid-sequence is a no-op — wake() needs DORMANT) */
    await page.keyboard.press('f');
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'STIR', { timeout: 5000 });
    const k1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      return {
        state: E.state, count: E._wakeCount,
        user: E._userTriggered, trig: S.INPUT.wakeTrigger,
      };
    });
    await page.keyboard.press('f');   // re-press mid-sequence: no-op
    await sleep(200);
    const k1b = await page.evaluate(
      () => window.SIM.ENTITY._wakeCount);
    check('M9.6: F key starts the sequence exactly once (re-press mid-sequence is a no-op)',
      k1.state === 'STIR' && k1.count === count0 + 1 &&
      k1.user === true && k1.trig === false &&
      k1b === count0 + 1,
      `count=${k1.count} (want ${count0 + 1}), re-press=${k1b}`);
    await settleDormant();

    /* 3. HUD button path: the same sequence exactly once (second
     *    click mid-sequence is a no-op) */
    await page.locator('#awakeBtn').click();
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'STIR', { timeout: 5000 });
    const b1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return { state: E.state, count: E._wakeCount };
    });
    await page.locator('#awakeBtn').click();  // re-click: no-op
    await sleep(200);
    const b1b = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return { state: E.state, count: E._wakeCount };
    });
    check('M9.6: HUD button starts the same sequence exactly once (re-click mid-sequence is a no-op)',
      b1.state === 'STIR' && b1.count === count0 + 2 &&
      b1b.state === 'STIR' && b1b.count === count0 + 2,
      `count=${b1.count} (want ${count0 + 2}), re-click=${b1b.count}`);
    await settleDormant();

    /* 4. the one-shot auto burns (skips) when the user already
     *    triggered — `_userTriggered` is true from the key test, so
     *    the deadline passing starts NOTHING, but the shot is gone */
    await page.evaluate(() => {
      window.SIM.ENTITY._autoAt = performance.now() / 1000 - 0.05;
    });
    await sleep(250);
    const skip = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return {
        fired: E._autoFired, state: E.state, count: E._wakeCount,
      };
    });
    check('M9.6: auto skips (and burns) when the user already triggered — no sequence started',
      skip.fired === true && skip.state === 'DORMANT' &&
      skip.count === count0 + 2,
      `count=${skip.count}, state=${skip.state}`);

    /* 5. the auto plays for the audience that presses nothing:
     *    re-arm the one-shot via the smoke seam (`_userTriggered` =
     *    false, `_autoFired` = false, `_autoAt` = null) — the lazy
     *    recompute must land on BOOT.t0 + 30 s and fire exactly one
     *    sequence (this boot is long past 30 s ⇒ fires next frame) */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E._userTriggered = false;
      E._autoFired = false;
      E._autoAt = null;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'STIR', { timeout: 5000 });
    const a1 = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY;
      return {
        state: E.state, count: E._wakeCount,
        fired: E._autoFired,
        autoAt: E._autoAt, t0: S.BOOT.t0,
      };
    });
    check('M9.6: auto starts the same sequence exactly once at BOOT.t0 + 30 s (audience that presses nothing)',
      a1.state === 'STIR' && a1.count === count0 + 3 &&
      a1.fired === true &&
      Math.abs(a1.autoAt - (a1.t0 + 30)) < 0.05,
      `count=${a1.count} (want ${count0 + 3}),` +
      ` Δdeadline=${(a1.autoAt - a1.t0).toFixed(2)} s (want 30)`);

    /* 6. the auto never re-fires: force back to DORMANT and let
     *    frames pass — the one-shot flag stays burned, no sequence */
    await settleDormant();
    await sleep(500);
    const nr = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return { state: E.state, fired: E._autoFired, count: E._wakeCount };
    });
    check('M9.6: auto never re-fires (one-shot) even after the DORMANT return',
      nr.state === 'DORMANT' && nr.fired === true &&
      nr.count === count0 + 3,
      `count=${nr.count} (want ${count0 + 3}), fired=${nr.fired}`);

    /* 7. key re-trigger after the auto still works (re-trigger safe),
     *    and resolves clean again */
    await page.keyboard.press('f');
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'STIR', { timeout: 5000 });
    const r1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return { state: E.state, count: E._wakeCount };
    });
    await settleDormant();
    check('M9.6: key re-trigger after the auto works and resolves clean (re-trigger safe)',
      r1.state === 'STIR' && r1.count === count0 + 4,
      `count=${r1.count} (want ${count0 + 4})`);

    /* 8. heap flat across the whole section */
    const ha = await heapMin();
    check('M9.6: no allocation per frame (heap flat across the section)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

    /* cleanup: park the dream wave + lightning again (the section's
     * forced cycles re-armed none of them; keep the suite state) */
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });
  }

  /* ------------------------------------------------------------------
   * M10.1 — Unsloth easter egg: voxel neon sloth monument + UNSLOTH sign
   *
   *  One side-avenue compute tower (seeded, mid-distance, plaza south
   *  side ⇒ outside the default intro-reveal framing) carries a voxel
   *  neon sloth on its crown + a rooftop UNSLOTH holo sign on the
   *  shared unsloth texture (tagline cycles via KIT._tagline). The
   *  monument is standalone (outside the chunk pools) ⇒ chunk regen
   *  never moves it. No forced state in this section — the checks are
   *  placement + framing + tagline cycle + street readability (on/off
   *  brightness) + bounded draw calls + regen-safety + heap flat.
   * ------------------------------------------------------------------ */
  {
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* 1. registered: one side-avenue compute tower, mid-distance,
     *    plaza south side, sign bound to the shared unsloth texture */
    const reg = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      if (!M || !M.g || M.g.children.length !== 3) return { ok: false };
      const m5 = n => ((n % 5) + 5) % 5;
      const d = Math.hypot(M.x, M.z);
      const info = S.WORLD.buildingAt(M.bx, M.bz, 0,
        ['server'], S.CFG.kit.slothMonument.minH);
      return {
        ok: true,
        onAvenue: m5(M.bx) !== 0 && m5(M.bz) !== 0 &&
          (m5(M.bx) === 1 || m5(M.bx) === 4 ||
           m5(M.bz) === 1 || m5(M.bz) === 4),
        south: M.bz > 0,
        mid: d >= 100 && d <= 300,
        server: !!info && info.arch === 'server' &&
          info.h >= S.CFG.kit.slothMonument.minH,
        onRoof: !!info && Math.abs(M.hTop - info.hTop) < 1e-6,
        signBound: M.sign.material.map === S.KIT.tex.signUnsloth.tex,
        d, bx: M.bx, bz: M.bz, hTop: M.hTop,
      };
    });
    check('M10.1: monument registered — voxel sloth + UNSLOTH sign on a side-avenue compute tower (mid-distance, plaza south side)',
      reg.ok && reg.onAvenue && reg.south && reg.mid && reg.server &&
        reg.onRoof && reg.signBound,
      reg.ok
        ? `block=(${reg.bx},${reg.bz}) d=${Math.round(reg.d)}m hTop=${Math.round(reg.hTop)}m`
        : 'monument missing');
    if (!reg.ok) throw new Error('M10.1: monument missing');

    /* 2. outside the default intro-reveal framing (spawn pose) */
    await page.evaluate(() => {
      const S = window.SIM;
      S.CAMERA.pos.set(0, 4, 18);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = 0;
      S.CAMERA.pitch = 0;
    });
    await sleep(300);
    const fr = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const out = p => p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      return {
        m: out(S.project(M.x, M.hTop + 2, M.z)),
        s: out(S.project(M.x, M.hTop + 7.2, M.z)),
      };
    });
    check('M10.1: monument + sign outside the default intro-reveal framing (spawn pose)',
      fr.m && fr.s);

    /* 3. tagline cycles (8 s) on the shared unsloth texture (8 Hz redraw) */
    const tg0 = await page.evaluate(() => ({
      tag: window.SIM.KIT._tagline(),
      frame: window.SIM.KIT.tex.signUnsloth.frame,
    }));
    await sleep(1100);
    const tg1 = await page.evaluate(() => ({
      frame: window.SIM.KIT.tex.signUnsloth.frame,
    }));
    let tg2 = tg0.tag;
    for (let i = 0; i < 40; i++) {           // ≤ 20 s — one 8 s flip inside
      tg2 = await page.evaluate(() => window.SIM.KIT._tagline());
      if (tg2 !== tg0.tag) break;
      await sleep(500);
    }
    const tags = ['LOCAL ≠ SLOW', 'WHY RUSH?'];
    check('M10.1: UNSLOTH tagline cycles ("local ≠ slow" / "why rush?") and the sign texture animates',
      tags.includes(tg0.tag) && tags.includes(tg2) && tg2 !== tg0.tag &&
        tg1.frame > tg0.frame,
      `${tg0.tag} -> ${tg2}, tex.frame ${tg0.frame} -> ${tg1.frame}`);

    /* 4. street view: monument + sign inside the frame from the nearest
     *    avenue, and the monument adds visible bright content (on/off)
     *    — the "readable from street" gate. Screenshot for the record. */
    const st = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument, B = S.WORLD.BLOCK;
      const m5 = n => ((n % 5) + 5) % 5;
      let ax = null, az = null;
      if (m5(M.bz) === 1) az = (M.bz - 1 + 0.5) * B;
      else if (m5(M.bz) === 4) az = (M.bz + 1 + 0.5) * B;
      else if (m5(M.bx) === 1) ax = (M.bx - 1 + 0.5) * B;
      else ax = (M.bx + 1 + 0.5) * B;
      const px = ax === null ? M.x : ax;
      const pz = az === null ? M.z : az;
      const dx = M.x - px, dz = M.z - pz;
      const dy = M.hTop + 3 - 1.7;
      S.CAMERA.pos.set(px, 1.7, pz);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = Math.atan2(-dx, -dz);
      S.CAMERA.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return { px, pz };
    });
    await sleep(450);
    const ins = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const inndc = p => p.z < 1 && Math.abs(p.x) < 0.75 && Math.abs(p.y) < 0.75;
      const pm = S.project(M.x, M.hTop + 2, M.z);
      const ps = S.project(M.x, M.hTop + 7.2, M.z);
      return {
        m: inndc(pm), s: inndc(ps),
        /* sign centre in frame coords for the on/off crop */
        sx: (ps.x + 1) / 2, sy: (1 - ps.y) / 2,
      };
    });
    const cVis = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.screenshot({ path: `${here}/shots/m101-sloth-street.png` });
    await page.evaluate(() => {
      window.SIM.WORLD.monument.g.visible = false;
    });
    await sleep(150);
    const cOff = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.screenshot({ path: `${here}/shots/m101-sloth-off.png` });
    await page.evaluate(() => {
      window.SIM.WORLD.monument.g.visible = true;
    });
    /* sign-region mean luminance, on vs off (screenshots decoded in-page
     * — the live WebGL canvas has no preserveDrawingBuffer). Crop a box
     * around the sign's projected centre: the monument is small in the
     * frame, so the full-frame mean barely moves. */
    const decSign = b64 => page.evaluate(async ([b64, cx, cy]) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + b64;
      });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const bw = Math.floor(c.width * 0.2), bh = Math.floor(c.height * 0.25);
      const x0 = Math.max(0, Math.min(c.width - 1 - bw, Math.floor(c.width * cx) - Math.floor(bw / 2)));
      const y0 = Math.max(0, Math.min(c.height - 1 - bh, Math.floor(c.height * cy) - Math.floor(bh / 2)));
      const d = ctx.getImageData(x0, y0, bw, bh).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    }, [b64, ins.sx, ins.sy]);
    const onB64 = fs.readFileSync(
      `${here}/shots/m101-sloth-street.png`).toString('base64');
    const offB64 = fs.readFileSync(
      `${here}/shots/m101-sloth-off.png`).toString('base64');
    const [cmpOn, cmpOff] = await Promise.all([
      decSign(onB64), decSign(offB64),
    ]);
    check('M10.1: monument + sign readable from the street (shots/m101-sloth-street.png, on/off brightness)',
      ins.m && ins.s && cmpOn > cmpOff + 1,
      `street=(${Math.round(st.px)},${Math.round(st.pz)}) sign-region mean ${cmpOff.toFixed(1)} -> ${cmpOn.toFixed(1)}`);

    /* 5. bounded draw-call cost (+3 meshes: body, neon, sign) */
    check('M10.1: monument costs a bounded +3 draw calls',
      cVis - cOff >= 2 && cVis - cOff <= 4, `delta=${cVis - cOff}`);

    /* 6. chunk regen leaves the monument untouched (standalone, outside
     *    the chunk pools) */
    const pre = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return { sign: M.sign.matrixWorld.elements.slice() };
    });
    await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const key = Math.floor(M.bx / 16) + ',' + Math.floor(M.bz / 16);
      S.WORLD.regen(key);
    });
    await sleep(200);
    const post = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return {
        sign: M.sign.matrixWorld.elements.slice(),
        children: M.g.children.length,
      };
    });
    check('M10.1: chunk regen leaves the monument untouched (standalone, outside the chunk pools)',
      post.children === 3 && pre.sign.every((v, i) => v === post.sign[i]));

    /* 7. heap flat across the section */
    const ha = await heapMin();
    check('M10.1: no allocation per frame (heap flat across the section)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

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

  /* ------------------------------------------------------------------ *
   * M10.2 — Holographic sloth + sloth drones
   *
   *  A relaxed holographic sloth silhouette (billboard canvas sprite,
   *  additive) hangs on the monument tower's antenna arm, slow
   *  breathing (per-frame sprite scale). 1–2 sloth-themed maintenance
   *  drones (bigger, soft pink, extra slow) patrol the monument's
   *  street only (one avenue line). Both are standalone children of
   *  WORLD.root (outside the chunk pools ⇒ chunk regen never touches
   *  them). No forced state — the checks are registration + breathing
   *  + street-only patrol (bounded + moving + bounce) + bounded draw
   *  calls + regen-safety + heap flat.
   * ------------------------------------------------------------------ */
  {
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* 1. registered: holo sloth (additive billboard, bound to the sloth
     *    texture) + sloth drones (soft pink, bigger, extra slow) on the
     *    monument's street */
    const reg = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      if (!M || !M.holo || !M.droneMesh || !Array.isArray(M.drones))
        return { ok: false };
      const D = S.CFG.kit.slothDrone;
      /* soft pink: red dominant, green below red, blue present (linear) */
      const pink = c => c.r > 0.9 && c.g < c.r && c.b > 0.5;
      return {
        ok: true,
        holoIsSprite: M.holo.isSprite === true,
        holoAdditive: M.holo.material.blending === 2,   // AdditiveBlending
        holoBound: M.holo.material.map === S.KIT.tex.slothHolo.tex,
        droneCount: M.drones.length,
        dronePink: M.drones.every(d => pink(d.tint)),
        droneBigger: D.size > S.CFG.traffic.drone.size,
        droneSlow: D.speed < S.CFG.traffic.drone.speed[0],
        axis: M.drones[0].axis,
        c: M.drones[0].c,
        span: (M.drones[0].aMax - M.drones[0].aMin) / 2,
        meshCount: M.droneMesh.count,
      };
    });
    check('M10.2: holo sloth + sloth drones registered (additive billboard, soft-pink/bigger/slow drones on the street)',
      reg.ok && reg.holoIsSprite && reg.holoAdditive && reg.holoBound &&
        reg.droneCount >= 1 && reg.droneCount <= 2 && reg.dronePink &&
        reg.droneBigger && reg.droneSlow,
      reg.ok
        ? `${reg.droneCount} drones, axis=${reg.axis} avenue=${Math.round(reg.c)} span=±${Math.round(reg.span)}m, mesh.count=${reg.meshCount}`
        : 'missing');
    if (!reg.ok) throw new Error('M10.2: holo sloth / drones missing');

    /* 2. holo sloth breathes (sprite scale oscillates over time) */
    const br0 = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return { sx: M.holo.scale.x, sy: M.holo.scale.y };
    });
    let br1 = br0;
    for (let i = 0; i < 40; i++) {            // ≤ 4 s — a breathing swing
      await sleep(100);
      br1 = await page.evaluate(() => {
        const M = window.SIM.WORLD.monument;
        return { sx: M.holo.scale.x, sy: M.holo.scale.y };
      });
      if (Math.abs(br1.sx - br0.sx) > 0.02) break;
    }
    check('M10.2: holo sloth breathes (sprite scale oscillates)',
      Math.abs(br1.sx - br0.sx) > 0.02 && br1.sy > 0,
      `scale.x ${br0.sx.toFixed(3)} -> ${br1.sx.toFixed(3)}`);

    /* 3. sloth drones patrol ONLY the monument's street: fixed cross-
     *    street coordinate (the avenue), bounded + moving along the
     *    street, and the instance-matrix cross-street coord stays on
     *    the avenue line */
    const p0 = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument, d = M.drones[0];
      return { along: d.along, aMin: d.aMin, aMax: d.aMax, c: d.c, axis: d.axis };
    });
    await sleep(1500);
    const p1 = await page.evaluate((along0) => {
      const M = window.SIM.WORLD.monument, d = M.drones[0];
      const e = M.droneMesh.instanceMatrix.array;
      const ix = e[12], iy = e[13], iz = e[14];
      const cross = d.axis === 'z' ? ix : iz;   // cross-street from the matrix
      return {
        along: d.along,
        inBounds: d.along >= d.aMin - 1e-3 && d.along <= d.aMax + 1e-3,
        moved: Math.abs(d.along - along0) > 0.05,
        crossOnStreet: Math.abs(cross - d.c) < 0.5,
        alt: iy,
      };
    }, p0.along);
    check('M10.2: sloth drones patrol ONLY the monument\'s street (fixed avenue, bounded + moving)',
      p1.inBounds && p1.moved && p1.crossOnStreet && p0.axis === reg.axis,
      `axis=${reg.axis} along ${p0.along.toFixed(1)} -> ${p1.along.toFixed(1)} (span ±${Math.round((p0.aMax - p0.aMin) / 2)}m), cross-street on avenue, alt=${p1.alt.toFixed(1)}m`);

    /* 4. the patrol bounces at the span ends (back-and-forth, not a
     *    one-way pass) — park a drone at the far end, it must turn back */
    await page.evaluate(() => {
      const d = window.SIM.WORLD.monument.drones[0];
      d.along = d.aMax; d.dir = 1;
    });
    await sleep(150);
    const bc = await page.evaluate(() => {
      const d = window.SIM.WORLD.monument.drones[0];
      return { along: d.along, dir: d.dir, atEnd: d.along <= d.aMax + 1e-3 };
    });
    check('M10.2: sloth drone patrol bounces at the span end (resumes toward the plaza)',
      bc.dir === -1 && bc.atEnd,
      `dir=${bc.dir} along=${bc.along.toFixed(1)} (aMax)`);

    /* 5. street view: holo sloth + drones readable from the monument's
     *    street (screenshot for the record) */
    const st = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument, B = S.WORLD.BLOCK;
      const m5 = n => ((n % 5) + 5) % 5;
      let ax = null, az = null;
      if (m5(M.bz) === 1) az = (M.bz - 1 + 0.5) * B;
      else if (m5(M.bz) === 4) az = (M.bz + 1 + 0.5) * B;
      else if (m5(M.bx) === 1) ax = (M.bx - 1 + 0.5) * B;
      else ax = (M.bx + 1 + 0.5) * B;
      const px = ax === null ? M.x : ax;
      const pz = az === null ? M.z : az;
      const dx = M.x - px, dz = M.z - pz;
      const dy = M.hTop + 10 - 1.7;
      S.CAMERA.pos.set(px, 1.7, pz);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = Math.atan2(-dx, -dz);
      S.CAMERA.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return { px, pz };
    });
    await sleep(450);
    const inHolo = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const p = S.project(M.x, M.hTop + 13, M.z);
      return p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9;
    });
    await page.screenshot({ path: `${here}/shots/m102-sloth-holo-street.png` });
    check('M10.2: holo sloth readable from the monument street (shots/m102-sloth-holo-street.png)',
      inHolo, `street=(${Math.round(st.px)},${Math.round(st.pz)})`);

    /* 6. bounded draw-call cost (+2: holo sprite + drone instanced mesh) */
    const cOn = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      M.holo.visible = false;
      M.droneMesh.visible = false;
    });
    await sleep(150);
    const cOff = await page.evaluate(() => window.SIM.renderer.info.render.calls);
    await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      M.holo.visible = true;
      M.droneMesh.visible = true;
    });
    check('M10.2: holo sloth + sloth drones cost a bounded +2 draw calls',
      cOn - cOff >= 2 && cOn - cOff <= 3, `delta=${cOn - cOff}`);

    /* 7. chunk regen leaves the holo sloth + drones untouched (standalone,
     *    outside the chunk pools) */
    const pre = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return {
        holoPos: M.holo.position.toArray(),
        count: M.drones.length,
        c: M.drones[0].c,
        axis: M.drones[0].axis,
      };
    });
    await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const key = Math.floor(M.bx / 16) + ',' + Math.floor(M.bz / 16);
      S.WORLD.regen(key);
    });
    await sleep(200);
    const post = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return {
        holoPos: M.holo.position.toArray(),
        count: M.drones.length,
        c: M.drones[0].c,
        axis: M.drones[0].axis,
        holoInScene: M.holo.parent === window.SIM.WORLD.root,
      };
    });
    check('M10.2: chunk regen leaves the holo sloth + drones untouched (standalone, outside the chunk pools)',
      post.holoPos.every((v, i) => v === pre.holoPos[i]) &&
        post.count === pre.count && post.c === pre.c &&
        post.axis === pre.axis && post.holoInScene);

    /* 8. heap flat across the section */
    const ha = await heapMin();
    check('M10.2: no allocation per frame (heap flat across the section)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

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

  /* ------------------------------------------------------------------ *
   * M10.3 — Unsloth easter egg: the awakening reaction
   *
   *  Hooked through ENTITY.eggReact (beat 6 fires at AWAKE + egg.delay,
   *  'end' at DORMANT entry): the UNSLOTH sign flares, the holo sloth
   *  brightens + plays one slow stretch, and the sloth drones rise to
   *  hover nearby for the pulse — then everything returns to idle
   *  (street patrol resumes) after DECAY. Subtle by design: it plays
   *  at the monument (outside the default intro-reveal framing) and
   *  adds no draw calls / no visible objects. Full awakening run,
   *  then a re-trigger.
   * ------------------------------------------------------------------ */
  {
    await page.evaluate(() => {
      const S = window.SIM;
      S.ENTITY._dream.nextAt = performance.now() / 1000 + 60;
      S.ATMOS._ltTimer = 1e9;
    });

    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory)
          m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 400));
      }
      return m === Infinity ? -1 : m;
    });
    const hb = await heapMin();

    /* 1. registered: the reaction is wired (WORLD owns the visuals,
     *    ENTITY.eggReact owns the timing), idle at DORMANT (holo at
     *    base brightness, sign at base, drones on the street) */
    const reg = await page.evaluate(() => {
      const S = window.SIM, E = S.ENTITY, M = S.WORLD.monument;
      const e = M.droneMesh.instanceMatrix.array;
      return {
        ok: !!M.egg && Array.isArray(E._eggReact) &&
          E._eggReact.length >= 1,
        reactLen: E._eggReact ? E._eggReact.length : -1,
        eggOn: M.egg ? M.egg.on : 'noegg',
        state: E.state,
        eggFired: E._eggFired,
        holoC: M.holoMat.color.r,
        signC: M.sign.material.color.r,
        alt: e[13],
      };
    });
    check('M10.3: awakening reaction wired (ENTITY.eggReact) and idle at DORMANT',
      reg.ok && reg.state === 'DORMANT' && !reg.eggFired &&
        reg.holoC === 1 && reg.signC === 1 && Math.abs(reg.alt - 30) < 0.6,
      `state=${reg.state} eggFired=${reg.eggFired}` +
      ` holo=${reg.holoC} sign=${reg.signC}` +
      ` alt=${reg.alt.toFixed(1)}m ok=${reg.ok}` +
      ` reactLen=${reg.reactLen} eggOn=${reg.eggOn}`);

    /* street pose (same as M10.2) so the reaction is in frame for the
     * screenshot + the visible-set / draw-call baselines */
    await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument, B = S.WORLD.BLOCK;
      const m5 = n => ((n % 5) + 5) % 5;
      let ax = null, az = null;
      if (m5(M.bz) === 1) az = (M.bz - 1 + 0.5) * B;
      else if (m5(M.bz) === 4) az = (M.bz + 1 + 0.5) * B;
      else if (m5(M.bx) === 1) ax = (M.bx - 1 + 0.5) * B;
      else ax = (M.bx + 1 + 0.5) * B;
      const px = ax === null ? M.x : ax;
      const pz = az === null ? M.z : az;
      const dx = M.x - px, dz = M.z - pz;
      const dy = M.hTop + 10 - 1.7;
      S.CAMERA.pos.set(px, 1.7, pz);
      S.CAMERA.vel.set(0, 0, 0);
      S.CAMERA.yaw = Math.atan2(-dx, -dz);
      S.CAMERA.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    });
    await sleep(450);
    const visBase = await page.evaluate(() => {
      const S = window.SIM;
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true, shaft = false;
          for (let p = o; p; p = p.parent) {
            v = v && p.visible;
            if (p === S.ATMOS.shaftGroup) shaft = true;
          }
          /* ATMOS-shafts fade in/out on a 2 s camera scan — excluded:
           * the pose change above can catch them mid-fade (environment,
           * not the reaction) */
          if (v && !shaft) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return { vis, calls: S.renderer.info.render.calls };
    });

    /* 2. full awakening run: wake() → force STIR→AWAKE → beat 6 fires
     *    (u ≥ 4.2 s) → the reaction ramps in (1.2 s): sign flares,
     *    holo brightens + the one slow stretch, drones rise to hover
     *    nearby (above the tower, off the street line) */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY._eggFired, { timeout: 8000 });
    await sleep(1200);   // ramp (1.2 s) done, stretch near its peak
    const on = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument,
        EG = S.CFG.kit.slothEgg, H = S.CFG.kit.slothHolo;
      const e = M.droneMesh.instanceMatrix.array;
      const drones = M.drones.map((d, i) => {
        const o = i * 16;
        return {
          x: e[o + 12], y: e[o + 13], z: e[o + 14],
          nearTower: Math.hypot(e[o + 12] - M.x, e[o + 14] - M.z) < 8,
          offStreet: Math.abs(
            (d.axis === 'z' ? e[o + 12] : e[o + 14]) - d.c) > 10,
        };
      });
      const inndc = p => p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9;
      const inHolo = inndc(S.project(M.x, M.hTop + 13, M.z));
      const tNow = performance.now() / 1000;
      return {
        egg: M.egg ? {
          on: M.egg.on, age: +(tNow - M.egg.t0).toFixed(1),
          endA: M.egg.endT ? +(tNow - M.egg.endT).toFixed(1) : null,
          st: M.egg.stretchT0 ? +(tNow - M.egg.stretchT0).toFixed(1) : null,
        } : 'noegg',
        holoC: M.holoMat.color.r,
        signC: M.sign.material.color.r,
        state: S.ENTITY.state,
        holoBright: M.holoMat.color.r > 1 + EG.holoBoost * 0.99,
        signFlare: M.neonMat.color.r > M.neonBase.r * 1.2 &&
          M.sign.material.color.r > 1,
        stretch: M.holo.scale.y >
          H.scale * (176 / 140) * (1 + H.breathAmp) + 0.2,
        allUp: drones.every(
          d => d.y > 35 && d.nearTower && d.offStreet),
        alt: drones.map(d => d.y),
        inHolo,
        calls: S.renderer.info.render.calls,
      };
    });
    await page.screenshot({ path: `${here}/shots/m103-sloth-awaken.png` });
    check('M10.3: reaction plays during AWAKE — sign flares, holo brightens + slow stretch, drones rise to hover nearby (shots/m103-sloth-awaken.png)',
      on.state === 'AWAKE' && on.holoBright && on.signFlare &&
        on.stretch && on.allUp && on.inHolo &&
        on.calls <= visBase.calls + 2,
      `egg=${JSON.stringify(on.egg)} holoC=${on.holoC.toFixed(2)}` +
      ` signC=${on.signC.toFixed(2)}` +
      ` alts=${on.alt.map(a => a.toFixed(1)).join('/')}m` +
      ` (baseline ${visBase.calls} + ≤2 live FX, got ${on.calls})`);

    /* 3. force AWAKE→DECAY: the reaction HOLDS (drones still up for the
     *    pulse — 'end' only fires at DORMANT entry) */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    const dc = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const e = M.droneMesh.instanceMatrix.array;
      return {
        state: S.ENTITY.state,
        holoBright: M.holoMat.color.r > 1 + S.CFG.kit.slothEgg.holoBoost * 0.99,
        up: M.drones.every((d, i) => e[i * 16 + 13] > 35),
      };
    });
    check('M10.3: reaction holds through DECAY (drones still hovering for the pulse)',
      dc.state === 'DECAY' && dc.holoBright && dc.up);

    /* 4. force DECAY→DORMANT: 'end' fires — everything eases back to
     *    idle (settle 2 s): holo/sign back to base, drones back on the
     *    street, the patrol resumes, no new visible objects */
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    await page.waitForFunction(() => {
      const M = window.SIM.WORLD.monument;
      return M.holoMat.color.r === 1;
    }, { timeout: 8000 });
    const back = await page.evaluate(() => {
      const S = window.SIM, M = S.WORLD.monument;
      const e = M.droneMesh.instanceMatrix.array;
      const d = M.drones[0];
      const H = S.CFG.kit.slothHolo;
      const nb = M.neonBase;
      const vis = [];
      S.scene.traverse(o => {
        if (o.isMesh || o.isPoints || o.isLine) {
          let v = true, shaft = false;
          for (let p = o; p; p = p.parent) {
            v = v && p.visible;
            if (p === S.ATMOS.shaftGroup) shaft = true;
          }
          if (v && !shaft) vis.push(o.name || o.type);
        }
      });
      vis.sort();
      return {
        holoC: M.holoMat.color.r,
        signC: M.sign.material.color.r,
        neonInBase: M.neonMat.color.r >= nb.r * 0.6 - 1e-3 &&
          M.neonMat.color.r <= nb.r + 1e-3,
        alt: e[13],
        onStreet: Math.abs((d.axis === 'z' ? e[12] : e[14]) - d.c) < 0.5,
        stretchEnded: M.holo.scale.y <=
          H.scale * (176 / 140) * (1 + H.breathAmp) + 1e-3,
        along: d.along,
        vis,
      };
    });
    await sleep(300);
    const back2 = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return { along: M.drones[0].along };
    });
    const visSame = JSON.stringify(back.vis) ===
      JSON.stringify(visBase.vis);
    const visAdd = back.vis.filter(x => !visBase.vis.includes(x));
    const visRem = visBase.vis.filter(x => !back.vis.includes(x));
    check('M10.3: everything returns to idle after DECAY (street patrol resumes, holo/sign back to base, no new objects)',
      back.holoC === 1 && back.signC === 1 && back.neonInBase &&
        Math.abs(back.alt - 30) < 0.6 && back.onStreet &&
        back.stretchEnded &&
        Math.abs(back2.along - back.along) > 0.05 && visSame,
      `alt=${back.alt.toFixed(1)}m, along ${back.along.toFixed(1)} ->` +
      ` ${back2.along.toFixed(1)},` +
      ` visible set ${visSame ? 'identical' : 'DIFFERS'}` +
      (visSame ? '' :
        ` add=${JSON.stringify(visAdd)} rem=${JSON.stringify(visRem)}`));

    /* 5. re-trigger: the reaction plays again and returns to idle
     *    again (re-trigger safe) */
    await page.evaluate(() => window.SIM.ENTITY.wake());
    const rt1 = await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      return { state: E.state, eggFired: E._eggFired };
    });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.stir - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY._eggFired, { timeout: 8000 });
    await sleep(1200);
    const rt2 = await page.evaluate(() => {
      const M = window.SIM.WORLD.monument;
      return {
        state: window.SIM.ENTITY.state,
        holoC: M.holoMat.color.r,
        egg: M.egg ? M.egg.on : 'noegg',
        holoBright: M.holoMat.color.r > 1 +
          window.SIM.CFG.kit.slothEgg.holoBoost * 0.99,
      };
    });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 - E._awakeDur - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DECAY', { timeout: 5000 });
    await page.evaluate(() => {
      const E = window.SIM.ENTITY;
      E.stateT = performance.now() / 1000 -
        window.SIM.CFG.entity.wake.decay - 0.05;
    });
    await page.waitForFunction(
      () => window.SIM.ENTITY.state === 'DORMANT', { timeout: 5000 });
    await page.waitForFunction(() => {
      const M = window.SIM.WORLD.monument;
      return M.holoMat.color.r === 1;
    }, { timeout: 8000 });
    check('M10.3: re-trigger works (the reaction plays again and returns to idle)',
      rt1.state === 'STIR' && !rt1.eggFired &&
        rt2.state === 'AWAKE' && rt2.holoBright,
      `first=${rt1.state}, re-fired=${rt2.holoBright}` +
      ` holoC=${rt2.holoC.toFixed(2)} eggOn=${rt2.egg}`);

    /* 6. heap flat across the section */
    const ha = await heapMin();
    check('M10.3: no allocation per frame (heap flat across the section)',
      hb > 0 && ha > 0 && ha - hb <= 2 * 1024 * 1024,
      `before=${Math.round(hb / 1024)}KB, after=${Math.round(ha / 1024)}KB`);

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

  /* ------------------------------------------------------------------ *
   * M11.1 — Audio master graph + gesture gate
   *
   *  master (bus gain 0.8) → DynamicsCompressor → muteGain (M key) →
   *  destination. unlock() runs only on the START click (the user
   *  gesture); the M key mutes the whole mix; a suspended context is
   *  resumed on gesture/visibility; refresh / re-entry rebuilds the
   *  module fresh and hits the same path again.
   *
   *  This section reloads the page: the pre-gesture check ("no audio
   *  before gesture") needs a fresh page (the intro auto-plays,
   *  no gesture yet — M12), and the refresh / re-entry check doubles
   *  as a second full re-entry.
   * ------------------------------------------------------------------ */
  {
    /* The headless Web Audio build exposes no inputs/outputs/
     * connections introspection on AudioNode, so wiring is verified
     * from the app-side flag captured at build time (connect() returns
     * the destination node) + node types. */
    const audioState = () => page.evaluate(() => {
      const A = window.SIM.AUDIO;
      if (!A || !A.ctx) return { ctx: false };
      const ctor = n => (n && n.constructor) ? n.constructor.name : '';
      return {
        ctx: true,
        state: A.ctx.state,
        types: ctor(A.master) === 'GainNode' &&
          ctor(A.comp) === 'DynamicsCompressorNode' &&
          ctor(A.muteGain) === 'GainNode' &&
          ctor(A.ctx.destination) === 'AudioDestinationNode',
        wired: A.wired === true,
        masterGain: A.master ? A.master.gain.value : -1,
        muteGain: A.muteGain ? A.muteGain.gain.value : -1,
        muted: A.muted,
      };
    });
    const ensureRunning = () => page.evaluate(async () => {
      const A = window.SIM.AUDIO;
      if (!A.ctx) return 'none';
      if (A.ctx.state === 'suspended') {
        await A.ctx.resume().catch(() => {});
      }
      return A.ctx.state;
    });

    /* 1. fresh page: no audio before the user gesture */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    {
      const a = await audioState();
      check('M11.1: no AudioContext before the user gesture', !a.ctx);
    }

    /* 2. START click (the gesture) unlocks the master graph */
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => window.SIM && window.SIM.BOOT.state === 'RUNNING', { timeout: 5000 });
    await sleep(150);
    {
      const a = await audioState();
      check('M11.1: START gesture creates the AudioContext', a.ctx, `state=${a.state}`);
      check('M11.1: master graph wired master→compressor→muteGain→destination',
        a.types && a.wired,
        `types=${a.types}, wired=${a.wired}`);
      check('M11.1: master bus gain 0.8, mute gain 1, not muted',
        Math.abs(a.masterGain - 0.8) < 1e-6 && Math.abs(a.muteGain - 1) < 1e-6 && !a.muted,
        `master=${a.masterGain}, mute=${a.muteGain}, muted=${a.muted}`);
      const st = await ensureRunning();
      check('M11.1: context running after the gesture (resume-safe)', st === 'running', `state=${st}`);
    }

    /* 3. M key mutes everything (mute gain is the last stage) */
    await page.keyboard.press('KeyM');
    await sleep(300);   // setTargetAtTime(time constant 0.02 s) settles
    {
      const a = await audioState();
      check('M11.1: M key mutes everything (mute gain → 0)',
        a.muted && a.muteGain < 0.01,
        `muted=${a.muted}, muteGain=${a.muteGain}`);
    }

    /* 4. M again unmutes */
    await page.keyboard.press('KeyM');
    await sleep(300);
    {
      const a = await audioState();
      check('M11.1: M again unmutes (mute gain → 1)',
        !a.muted && a.muteGain > 0.99,
        `muted=${a.muted}, muteGain=${a.muteGain}`);
    }

    /* 5. refresh / re-entry: fresh module, no context before the
     *    gesture again, START unlocks a fresh context, no errors */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    {
      const a = await audioState();
      check('M11.1: refresh returns to a fresh module (no context before gesture)', !a.ctx);
    }
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => window.SIM && window.SIM.BOOT.state === 'RUNNING', { timeout: 5000 });
    await sleep(150);
    {
      const a = await audioState();
      const st = await ensureRunning();
      check('M11.1: re-entry after refresh unlocks a fresh running context, no errors',
        a.ctx && a.types && a.wired && st === 'running' && pageErrors.length === 0,
        `ctx=${a.ctx}, types=${a.types}, wired=${a.wired}, state=${st}, pageErrors=${pageErrors.length}`);
    }
    /* suite hygiene: suppress the re-armed auto timers (same as the
     * earlier sections — nothing else runs after this point) */
    await page.evaluate(() => {
      window.SIM.ATMOS._ltTimer = 1e9;
      window.SIM.ENTITY._autoAt = Infinity;
    });
  }

  /* ------------------------------------------------------------------ *
   * M11.2 — Looping beds (reactor hum / fans / distant machinery)
   *
   *  All beds are built at unlock and connect to AUDIO.master
   *  (M11.1): reactor hum (2 detuned sines + sub sine, slow LFO),
   *  fans (looped noise through a band-pass with a slow LFO sweep),
   *  distant machinery (looped muffled noise + random low thumps
   *  scheduled in AUDIO.update). Looped buffers are ≥ 4 s ⇒ no
   *  audible repeat; nothing allocates per frame. The hum swell and
   *  the band-pass sweep are driven from the central update loop as
   *  deterministic sinusoids, so they are checked against the exact
   *  formula (AudioParam.value would not reflect oscillator-LFO
   *  inputs either way). The "machine city within 3 s" gate is
   *  qualitative — the proxy here is all three beds live at once,
   *  each with its own spectral element, running error-free over a
   *  long window with the mute untouched.
   * ------------------------------------------------------------------ */
  {
    const bedsState = () => page.evaluate(() => {
      const A = window.SIM.AUDIO;
      const B = A && A.beds;
      if (!B) return { beds: false };
      const C = window.SIM.CFG.audio;
      const ctor = n => (n && n.constructor) ? n.constructor.name : '';
      return {
        beds: true,
        ctxState: A.ctx.state,
        types:
          ctor(B.hum.osc1) === 'OscillatorNode' &&
          ctor(B.hum.osc2) === 'OscillatorNode' &&
          ctor(B.hum.sub) === 'OscillatorNode' &&
          ctor(B.fan.src) === 'AudioBufferSourceNode' &&
          ctor(B.fan.filter) === 'BiquadFilterNode' &&
          ctor(B.machine.src) === 'AudioBufferSourceNode' &&
          ctor(B.machine.filter) === 'BiquadFilterNode',
        humF: [
          B.hum.osc1.frequency.value,
          B.hum.osc2.frequency.value,
          B.hum.sub.frequency.value,
        ],
        humGain: B.hum.gain.gain.value,
        fanLoop: B.fan.src.loop,
        fanBuf: B.fan.src.buffer.duration,
        fanType: B.fan.filter.type,
        fanFreq: B.fan.filter.frequency.value,
        machLoop: B.machine.src.loop,
        machBuf: B.machine.src.buffer.duration,
        machType: B.machine.filter.type,
        machGain: B.machine.gain.gain.value,
        thumpCount: B.machine.thumpCount,
        nextThumpAt: B.machine.nextThumpAt,
        now: performance.now() / 1000,
        cfg: {
          f1: C.hum.f1, f2: C.hum.f2, sub: C.hum.sub,
          humGain: C.hum.gain, humDepth: C.hum.lfoDepth,
          humLfo: C.hum.lfo,
          machGain: C.machine.gain,
          sweep: C.fan.sweep,   // { range: [min, max], speed }
          every: C.machine.thump.every,
        },
      };
    });
    /* The swell/sweep are deterministic sinusoids of the central-loop
     * clock — check the live values against the exact formula (the
     * tolerances cover ≤ ~0.1 s of frame/IPC lag). */
    const humExpected = b => b.cfg.humGain * (1 + b.cfg.humDepth *
      Math.sin(b.now * 2 * Math.PI * b.cfg.humLfo));
    const fanExpected = b =>
      (b.cfg.sweep.range[0] + b.cfg.sweep.range[1]) / 2 +
      (b.cfg.sweep.range[1] - b.cfg.sweep.range[0]) / 2 *
      Math.sin(b.now * 2 * Math.PI * b.cfg.sweep.speed);
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 250));
      }
      return m === Infinity ? -1 : m;
    });

    /* 1. beds built after the gesture (page already RUNNING from
     *    M11.1's re-entry) */
    const b0 = await bedsState();
    check('M11.2: beds built after the gesture (hum/fan/machine node types)',
      b0.beds && b0.types, `beds=${b0.beds}, types=${b0.types}`);

    if (b0.beds) {
      /* 2. reactor hum: 2 detuned sines + sub, slow swell live */
      const [f1, f2, fs] = b0.humF;
      check('M11.2: reactor hum = 2 detuned sines + sub sine',
        Math.abs(f1 - b0.cfg.f1) < 1e-6 &&
        Math.abs(f2 - b0.cfg.f2) < 1e-6 &&
        Math.abs(fs - b0.cfg.sub) < 1e-6,
        `f1=${f1}, f2=${f2}, sub=${fs}`);
      check('M11.2: hum swell is live (gain tracks the deterministic formula)',
        Math.abs(b0.humGain - humExpected(b0)) < 0.01,
        `gain=${b0.humGain}, want=${humExpected(b0).toFixed(4)}`);

      /* 3. fans: looped noise through a band-pass inside the sweep */
      check('M11.2: fans = looped noise through a band-pass',
        b0.fanLoop === true && b0.fanBuf >= 3 && b0.fanType === 'bandpass',
        `loop=${b0.fanLoop}, buf=${b0.fanBuf}s, type=${b0.fanType}`);
      check('M11.2: band-pass sweep is live (center tracks the formula)',
        Math.abs(b0.fanFreq - fanExpected(b0)) < 40 &&
        b0.fanFreq >= b0.cfg.sweep.range[0] &&
        b0.fanFreq <= b0.cfg.sweep.range[1],
        `freq=${b0.fanFreq}, want=${fanExpected(b0).toFixed(1)}, ` +
        `range=${b0.cfg.sweep.range}`);

      /* 4. distant machinery: looped noise through a low-pass */
      check('M11.2: machinery = looped noise through a low-pass',
        b0.machLoop === true && b0.machBuf >= 3 &&
        b0.machType === 'lowpass',
        `loop=${b0.machLoop}, buf=${b0.machBuf}s, type=${b0.machType}`);

      /* 5. the sweep keeps moving (re-check the formula 5 s later —
       * the phase advanced a quarter period) */
      await sleep(5000);
      const b1 = await bedsState();
      check('M11.2: band-pass sweep still tracks the formula after 5 s',
        Math.abs(b1.fanFreq - fanExpected(b1)) < 40 &&
        Math.abs(b1.humGain - humExpected(b1)) < 0.01,
        `freq=${b1.fanFreq}, want=${fanExpected(b1).toFixed(1)}, ` +
        `humGain=${b1.humGain}, want=${humExpected(b1).toFixed(4)}`);

      /* 6. random low thump: force one now — count +1 and the
       *    deadline re-armed into [5, 14] s */
      await page.evaluate(() => {
        const A = window.SIM.AUDIO;
        A.beds.machine.nextThumpAt = performance.now() / 1000 - 0.01;
      });
      await sleep(600);
      const b2 = await bedsState();
      check('M11.2: low thump fires and re-arms the random deadline',
        b2.thumpCount >= b1.thumpCount + 1 &&
        b2.nextThumpAt > b2.now + b2.cfg.every[0] - 1 &&
        b2.nextThumpAt < b2.now + b2.cfg.every[1] + 1,
        `count=${b2.thumpCount} (was ${b1.thumpCount}), ` +
        `next=${(b2.nextThumpAt - b2.now).toFixed(1)}s`);

      /* 7. long-run: all beds still live, gains intact, no errors,
       *    heap flat (min-of-3 churn, same bound as the other sections) */
      const heapBefore = await heapMin();
      await sleep(8000);
      const b3 = await bedsState();
      const heapAfter = await heapMin();
      const humLo = b3.cfg.humGain * (1 - b3.cfg.humDepth);
      const humHi = b3.cfg.humGain * (1 + b3.cfg.humDepth);
      check('M11.2: beds run indefinitely (ctx running, gains intact, no errors)',
        b3.ctxState === 'running' &&
        b3.humGain > humLo && b3.humGain < humHi &&
        Math.abs(b3.machGain - b3.cfg.machGain) < 1e-6 &&
        pageErrors.length === 0,
        `state=${b3.ctxState}, humGain=${b3.humGain}, machGain=${b3.machGain}, ` +
        `pageErrors=${pageErrors.length}`);
      check('M11.2: heap flat across the long-run window',
        heapBefore > 0 && heapAfter - heapBefore <= 2 * 1024 * 1024,
        `Δ=${((heapAfter - heapBefore) / 1048576).toFixed(2)} MB`);

      /* 8. the M key mutes the beds (mute gain → 0) without touching
       *    them — then unmutes */
      await page.keyboard.press('KeyM');
      await sleep(300);
      const b4 = await bedsState();
      const muteGain = await page.evaluate(
        () => window.SIM.AUDIO.muteGain.gain.value);
      check('M11.2: M key mutes the beds (mute gain → 0, bed gains untouched)',
        muteGain < 0.01 && Math.abs(b4.machGain - b3.machGain) < 1e-6,
        `mute=${muteGain}, machGain=${b4.machGain}`);
      await page.keyboard.press('KeyM');
      await sleep(300);
    }
  }

  /* ------------------------------------------------------------------ *
   * M11.3 — Event sounds (pulse thump / arc crackle / steam hiss /
   *          drone whir)
   *
   *  Fire-and-forget one-shots fired from the real M6–M9 emitter
   *  call sites (FX.pulse / FX.arc / PARTS._spawnSteam /
   *  TRAFFIC._spawn), every output connecting to AUDIO.master — the
   *  M11.1 choke point — so the M key mutes all of them at zero
   *  cost. No per-frame work: AUDIO.update is untouched, each
   *  one-shot stops its own sources and is collected (zero cost
   *  when idle). Wiring is verified app-side: the eventsWired flags
   *  are captured from connect() return values (the headless build
   *  exposes no graph introspection) and each type has a fire
   *  counter, so "each event produces its sound" = each emitter's
   *  call site increments its counter exactly once per fire.
   * ------------------------------------------------------------------ */
  {
    const evState = () => page.evaluate(() => {
      const A = window.SIM.AUDIO;
      return {
        counters: { ...A.events },
        wired: { ...A.eventsWired },
        hasNoise: !!A._evNoise,
        noiseDur: A._evNoise ? A._evNoise.duration : -1,
        muted: A.muted,
        muteGain: A.muteGain ? A.muteGain.gain.value : -1,
      };
    });
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 250));
      }
      return m === Infinity ? -1 : m;
    });

    /* 1. setup: counters + shared one-shot noise buffer exist */
    const e0 = await evState();
    check('M11.3: event counters + shared one-shot noise buffer exist',
      e0.counters && e0.hasNoise && e0.noiseDur >= 1,
      `noise=${e0.noiseDur}s, counters=${JSON.stringify(e0.counters)}`);

    /* 2. pulse thump — the real FX.pulse call site */
    const p = await page.evaluate(() => {
      const S = window.SIM;
      const before = S.AUDIO.events.pulse;
      const it = S.FX.pulse({ x: 0, y: 0, z: 0 });
      const after = S.AUDIO.events.pulse;
      if (it) S.FX.dropPulse(it);
      return { before, after, fired: !!it };
    });
    check('M11.3: pulse thump fires from FX.pulse (counter +1)',
      p.fired && p.after === p.before + 1,
      `before=${p.before}, after=${p.after}`);

    /* 3. arc crackle — the real FX.arc call site */
    const ar = await page.evaluate(() => {
      const S = window.SIM;
      const before = S.AUDIO.events.arc;
      const it = S.FX.arc({ x: 10, y: 8, z: 10 }, { x: 40, y: 22, z: 30 });
      const after = S.AUDIO.events.arc;
      if (it) S.FX.dropArc(it);
      return { before, after, fired: !!it };
    });
    check('M11.3: arc crackle fires from FX.arc (counter +1)',
      ar.fired && ar.after === ar.before + 1,
      `before=${ar.before}, after=${ar.after}`);

    /* 4. steam hiss — the real PARTS._spawnSteam call site. The
     *    steam pool is saturated at cap (spawn rate × life > cap),
     *    so free one slot with the real trim path first. */
    const st = await page.evaluate(() => {
      const S = window.SIM;
      const before = S.AUDIO.events.steam;
      if (S.PARTS.scount > 0) S.PARTS._sReleaseAt(0);
      const it = S.PARTS.spool.acquire();
      if (it) S.PARTS._spawnSteam(it, { x: 50, z: 50, hTop: 30, r: 6 });
      return { before, after: S.AUDIO.events.steam, spawned: !!it };
    });
    check('M11.3: steam hiss fires from PARTS._spawnSteam (counter +1)',
      st.spawned && st.after === st.before + 1,
      `before=${st.before}, after=${st.after}`);

    /* 5. drone whir — the real TRAFFIC._spawn call site. The pool is
     *    at cap (every live drone is a pool item), so free one slot
     *    with the real trim path (_releaseAt) first; _spawn
     *    early-returns when the seeded dock search finds no dock,
     *    so retry a few times. */
    const dr = await page.evaluate(() => {
      const S = window.SIM;
      const T = S.TRAFFIC, A = S.AUDIO;
      const before = A.events.drone;
      if (T.count > 0) T._releaseAt(0);
      let it = T.pool.acquire();
      let fired = false;
      for (let i = 0; i < 6 && it && !fired; i++) {
        const b = A.events.drone;
        T._spawn(it);
        if (A.events.drone > b) { fired = true; break; }
        it = T.pool.acquire();
      }
      return { before, after: A.events.drone, fired, count: T.count };
    });
    check('M11.3: drone whir fires from TRAFFIC._spawn (counter +1)',
      dr.fired && dr.after === dr.before + 1,
      `before=${dr.before}, after=${dr.after}, count=${dr.count}`);

    /* 6. all silent when muted — fire every type while the M-key
     *    mute is on: the counters still move (the events happen),
     *    but every one-shot output connects to AUDIO.master whose
     *    only path to destination goes through the 0-gain muteGain
     *    (eventsWired captured from connect() return values). */
    await page.keyboard.press('KeyM');
    await sleep(250);
    const mm = await page.evaluate(() => {
      const S = window.SIM;
      const before = { ...S.AUDIO.events };
      const pit = S.FX.pulse({ x: 0, y: 0, z: 0 });
      if (pit) S.FX.dropPulse(pit);
      const ait = S.FX.arc({ x: 1, y: 2, z: 3 }, { x: 9, y: 5, z: 7 });
      if (ait) S.FX.dropArc(ait);
      if (S.PARTS.scount > 0) S.PARTS._sReleaseAt(0);
      const it = S.PARTS.spool.acquire();
      if (it) S.PARTS._spawnSteam(it, { x: 60, z: 60, hTop: 30, r: 6 });
      return {
        before, after: { ...S.AUDIO.events },
        muted: S.AUDIO.muted,
        mute: S.AUDIO.muteGain.gain.value,
      };
    });
    check('M11.3: events fire while muted — silent at the choke point',
      mm.muted && mm.mute < 0.01 &&
      mm.after.pulse === mm.before.pulse + 1 &&
      mm.after.arc === mm.before.arc + 1 &&
      mm.after.steam === mm.before.steam + 1,
      `muted=${mm.muted}, mute=${mm.mute}, Δpulse=${mm.after.pulse - mm.before.pulse}, ` +
      `Δarc=${mm.after.arc - mm.before.arc}, Δsteam=${mm.after.steam - mm.before.steam}`);
    await page.keyboard.press('KeyM');
    await sleep(250);

    /* 7. wiring: every event type's output connects to AUDIO.master
     *    (app-side flags captured from connect() return values) */
    const e1 = await evState();
    check('M11.3: every event output connects to AUDIO.master (wired flags)',
      e1.wired.pulse && e1.wired.arc && e1.wired.steam && e1.wired.drone,
      `wired=${JSON.stringify(e1.wired)}`);

    /* 8. zero cost when idle: no per-frame work — heap flat across a
     *    window with no forced fires (ambient steam/drone events are
     *    the emitters' own fires; everything else is set-and-forget
     *    self-stopping one-shots). */
    const h0 = await heapMin();
    await sleep(5000);
    const h1 = await heapMin();
    const e2 = await evState();
    check('M11.3: zero cost when idle (heap flat, no errors)',
      h0 > 0 && h1 - h0 <= 2 * 1024 * 1024 && pageErrors.length === 0,
      `Δ=${((h1 - h0) / 1048576).toFixed(2)} MB, errors=${pageErrors.length}, ` +
      `counters=${JSON.stringify(e2.counters)}`);
  }

  /* ------------------------------------------------------------------
   * M11.4 — Spatial-ish mixing (one panner + distance gain for the
   *          2–3 nearest emitters; the rest folded into ambient)
   *
   *  A pool of panner + distance-gain channels built at unlock
   *  (channels are reused ⇒ a spatial fire allocates only the
   *  one-shot itself); the listener is driven from CAMERA every
   *  frame — the only per-frame cost. "Walking past an emitter
   *  pans/attenuates it" is verified app-side (the headless build
   *  exposes no graph introspection): the channel panner position
   *  and the explicit distance gain are directly observable, and the
   *  listener tracks the camera.
   * ------------------------------------------------------------------ */
  {
    const spState = () => page.evaluate(() => {
      const A = window.SIM.AUDIO;
      const C = window.SIM.CFG.audio.spatial;
      const L = A._listener;
      const p0 = A.spatial && A.spatial.length ? A.spatial[0].panner : null;
      return {
        want: C.channels, ref: C.refDistance, rolloff: C.rolloff,
        minGain: C.minGain,
        channels: A.spatial ? A.spatial.length : -1,
        wired: A.spatialWired,
        folded: A.spatialFolded,
        pannerName: p0 ? p0.constructor.name : 'none',
        pannerModel: p0 ? p0.panningModel : 'none',
        counters: { ...A.events },
        muted: A.muted,
        muteGain: A.muteGain ? A.muteGain.gain.value : -1,
        listener: L ? {
          x: L.positionX ? L.positionX.value : -1e9,
          y: L.positionY ? L.positionY.value : -1e9,
          z: L.positionZ ? L.positionZ.value : -1e9,
        } : null,
        cam: {
          x: window.SIM.CAMERA.pos.x,
          y: window.SIM.CAMERA.pos.y,
          z: window.SIM.CAMERA.pos.z,
        },
      };
    });
    const teleport = async (x, y, z) => {
      await page.evaluate(([x, y, z]) => {
        const S = window.SIM;
        S.CAMERA.pos.set(x, y, z);
        S.CAMERA.vel.set(0, 0, 0);
        S.CAMERA.yaw = 0;
        S.CAMERA.pitch = 0;
      }, [x, y, z]);
      await sleep(250);
    };
    const firePulse = async (x, y, z) => page.evaluate(([x, y, z]) => {
      const S = window.SIM;
      const A = S.AUDIO;
      const it = S.FX.pulse({ x, y, z });
      if (it) S.FX.dropPulse(it);
      const last = A.spatialLast;
      const ch = last ? A.spatial[last.ch] : null;
      const p = ch ? ch.panner : null;
      return {
        fired: !!it,
        last: last ? {
          type: last.type, x: last.x, y: last.y, z: last.z,
          d: last.d, gain: last.gain,
        } : null,
        pannerPos: p ? {
          x: p.positionX ? p.positionX.value : -1e9,
          y: p.positionY ? p.positionY.value : -1e9,
          z: p.positionZ ? p.positionZ.value : -1e9,
        } : null,
        channelGain: ch ? ch.g.gain.value : -1,
      };
    }, [x, y, z]);
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 250));
      }
      return m === Infinity ? -1 : m;
    });
    const expGain = (d, s) => d <= s.ref
      ? 1
      : Math.max(s.minGain, s.ref / (s.ref + s.rolloff * (d - s.ref)));

    /* 1. pool: 3 panner + distance-gain channels, wired to master */
    const s0 = await spState();
    check('M11.4: spatial pool exists (panner + distance-gain channels)',
      s0.channels === s0.want && s0.wired &&
      s0.pannerName === 'PannerNode' && s0.pannerModel === 'equalpower',
      `channels=${s0.channels}/${s0.want}, wired=${s0.wired}, ` +
      `panner=${s0.pannerName} (${s0.pannerModel})`);

    /* 2. listener tracks the camera (position driven every frame) */
    await teleport(20, 5, -30);
    const s1 = await spState();
    check('M11.4: listener tracks the camera (per-frame drive)',
      s1.listener &&
      Math.abs(s1.listener.x - 20) < 0.01 &&
      Math.abs(s1.listener.y - 5) < 0.01 &&
      Math.abs(s1.listener.z + 30) < 0.01,
      `listener=(${s1.listener ? s1.listener.x.toFixed(2) + ', ' +
        s1.listener.y.toFixed(2) + ', ' + s1.listener.z.toFixed(2) : 'n/a'})`);

    /* 3. walking past an emitter attenuates it — near → far → near
     *    gain profile against the exact inverse-model formula */
    const walk = async (cx) => {
      await teleport(cx, 4, 0);
      return firePulse(0, 0, 0);
    };
    const w0 = await walk(-25);
    const w1 = await walk(0);
    const w2 = await walk(25);
    check('M11.4: walking past an emitter attenuates it (near→far→near)',
      w0.fired && w1.fired && w2.fired &&
      Math.abs(expGain(w0.last.d, s0) - w0.last.gain) < 1e-6 &&
      w1.last.gain === 1 &&
      Math.abs(expGain(w2.last.d, s0) - w2.last.gain) < 1e-6 &&
      w1.last.gain > w0.last.gain && w1.last.gain > w2.last.gain,
      `gains=(${w0.last ? w0.last.gain.toFixed(3) : '?'}, ` +
      `${w1.last ? w1.last.gain.toFixed(3) : '?'}, ` +
      `${w2.last ? w2.last.gain.toFixed(3) : '?'}), d=(${w0.last ? w0.last.d.toFixed(1) : '?'}, ` +
      `${w1.last ? w1.last.d.toFixed(1) : '?'}, ${w2.last ? w2.last.d.toFixed(1) : '?'})`);

    /* 4. the channel panner sits at the emitter (equalpower panning
     *    input) and the channel gain IS the distance gain */
    const p4 = await firePulse(12, 3, -7);
    check('M11.4: channel panner sits at the emitter (panning input)',
      p4.fired && p4.pannerPos &&
      Math.abs(p4.pannerPos.x - 12) < 1e-6 &&
      Math.abs(p4.pannerPos.y - 3) < 1e-6 &&
      Math.abs(p4.pannerPos.z + 7) < 1e-6 &&
      /* AudioParam values are float32 — read-back rounds to ~3e-8 */
      Math.abs(p4.channelGain - p4.last.gain) < 1e-6,
      `panner=(${p4.pannerPos ? p4.pannerPos.x + ', ' +
        p4.pannerPos.y + ', ' + p4.pannerPos.z : 'n/a'}), ` +
      `gain=${p4.channelGain}`);

    /* 5. pool overflow: 4 simultaneous emitters at equal distance →
     *    3 spatial + 1 folded into the ambient master */
    await sleep(1000);      // walking-test channels expire (hold ≈ 0.9 s)
    const fold = await page.evaluate(() => {
      const S = window.SIM;
      const A = S.AUDIO;
      const before = A.spatialFolded;
      const its = [];
      for (let i = 0; i < 4; i++) its.push(S.FX.pulse({ x: 0, y: 0, z: 0 }));
      for (const it of its) if (it) S.FX.dropPulse(it);
      return {
        before, after: A.spatialFolded,
        fired: its.filter(Boolean).length,
        delta: A.events.pulse,
      };
    });
    check('M11.4: pool overflow folds into the ambient master (4th fire)',
      fold.fired === 4 && fold.after === fold.before + 1,
      `fired=${fold.fired}, folded ${fold.before} → ${fold.after}`);

    /* 6. spatial events mute at the M11.1 choke point */
    await page.keyboard.press('KeyM');
    await sleep(250);
    const mute = await page.evaluate(() => {
      const S = window.SIM;
      const A = S.AUDIO;
      const before = A.events.pulse;
      const it = S.FX.pulse({ x: 5, y: 0, z: 5 });
      if (it) S.FX.dropPulse(it);
      return {
        muted: A.muted,
        mute: A.muteGain.gain.value,
        delta: A.events.pulse - before,
        gain: A.spatialLast ? A.spatialLast.gain : -1,
      };
    });
    check('M11.4: spatial events mute at the M11.1 choke point',
      mute.muted && mute.mute < 0.01 && mute.delta === 1 && mute.gain > 0,
      `muted=${mute.muted}, mute=${mute.mute}, gain=${mute.gain}`);
    await page.keyboard.press('KeyM');
    await sleep(250);

    /* 7. bounded cost: the per-frame listener drive + channel expiry
     *    are a handful of param writes — heap stays flat */
    await teleport(0, 4, 18);
    const h0 = await heapMin();
    await sleep(5000);
    const h1 = await heapMin();
    check('M11.4: bounded cost (heap flat while the listener drives)',
      h0 > 0 && h1 - h0 <= 2 * 1024 * 1024 && pageErrors.length === 0,
      `Δ=${((h1 - h0) / 1048576).toFixed(2)} MB, errors=${pageErrors.length}`);
  }

  /* ------------------------------------------------------------------ *
   * M12.1 — Intro engine: camera-keyframe timeline runner + beat 1
   *          (dark server corridor)
   *
   *  The intro auto-plays on page load (LOADER → INTRO → RUNNING):
   *  a near-black instanced tunnel of LED strips with a camera dolly
   *  on the timeline runner. No async resources: the tunnel is built
   *  synchronously at init. The runner: play(track, onDone) /
   *  cancel() / seek(t), driven from the central update loop; while
   *  playing it owns the camera pose (written after CAMERA.update);
   *  on cancel the camera returns to CAMERA.pos. The poses below are
   *  verified against the smoothstep formula computed in-page from
   *  the runner's own clock (same frame ⇒ exact).
   * ------------------------------------------------------------------ */
  {
    const introState = () => page.evaluate(() => {
      const S = window.SIM, I = S.INTRO;
      const m = S.camera.matrixWorld.elements;
      return {
        state: S.BOOT.state,
        playing: I.playing,
        t: I.t,
        dur: I.dur,
        trackLen: I.track ? I.track.length : -1,
        cam: { x: S.camera.position.x, y: S.camera.position.y, z: S.camera.position.z },
        fwd: { x: -m[8], y: -m[9], z: -m[10] },
      };
    });
    const heapMin = () => page.evaluate(async () => {
      let m = Infinity;
      for (let i = 0; i < 3; i++) {
        if (window.gc) window.gc();
        if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
        await new Promise(r => setTimeout(r, 250));
      }
      return m === Infinity ? -1 : m;
    });

    /* 1. fresh page: the corridor beat auto-plays (INTRO state) */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    {
      const s = await introState();
      check('M12.1: intro auto-plays (INTRO, timeline running, dur from CFG)',
        s.state === 'INTRO' && s.playing && s.trackLen === 32 &&
        Math.abs(s.dur - 15.2) < 0.01,
        `state=${s.state}, playing=${s.playing}, track=${s.trackLen}, dur=${s.dur}`);
      const scene = await page.evaluate(() => {
        const I = window.SIM.INTRO;
        return {
          scene: !!I.scene,
          children: I.scene ? I.scene.children.length : -1,
          shell: I.shell ? I.shell.type : 'none',
          racks: I.racks ? I.racks.mesh.isInstancedMesh + ':' + I.racks.mesh.count : 'none',
          dashes: I.dashes ? I.dashes.mesh.isInstancedMesh + ':' + I.dashes.mesh.count : 'none',
          strips: I.strips ? I.strips.type : 'none',
        };
      });
      check('M12.1: corridor scene built (shell + 48 racks + strips + 96 dashes)',
        scene.scene && scene.children >= 4 && scene.shell === 'Mesh' &&
        scene.racks === 'true:48' && scene.dashes === 'true:96' &&
        scene.strips === 'Mesh',
        JSON.stringify(scene));
    }

    /* 2. the dolly: the camera eases through the tunnel along -Z,
     *    looking down the corridor */
    {
      const a = await introState();
      await sleep(600);
      const b = await introState();
      check('M12.1: dolly advances through the tunnel (t + z advance, eye height, fwd -Z)',
        b.t > a.t && b.cam.z < a.cam.z &&
        Math.abs(b.cam.y - 2.5) < 0.01 && Math.abs(b.cam.x) < 0.01 &&
        b.fwd.z < -0.99 && Math.abs(b.fwd.x) < 0.05 && Math.abs(b.fwd.y) < 0.05,
        `t ${a.t.toFixed(2)} -> ${b.t.toFixed(2)}, z ${a.cam.z.toFixed(1)} -> ${b.cam.z.toFixed(1)}, fwd.z=${b.fwd.z.toFixed(2)}`);
    }

    /* 3. the LED dashes flow along the strips (instance matrices move) */
    {
      const hash = () => page.evaluate(() => {
        const a = window.SIM.INTRO.dashes.mesh.instanceMatrix.array;
        let h = 0;
        for (let i = 0; i < a.length; i += 37) h = (h * 31 + a[i]) | 0;
        return h;
      });
      const h0 = await hash();
      await sleep(400);
      const h1 = await hash();
      check('M12.1: LED dashes flow (instance matrices advance)', h0 !== h1,
        `hash ${h0} -> ${h1}`);
    }

    /* 4. the corridor renders in exactly 5 draw calls (shell / end
     *    wall / racks / strips / dashes — the city is not rendered
     *    while the intro plays; the portal stays hidden until beat 2) */
    {
      const calls = await page.evaluate(async () => {
        const r = window.SIM.renderer;
        let m = Infinity;
        for (let i = 0; i < 5; i++) {
          await new Promise(res => requestAnimationFrame(res));
          m = Math.min(m, r.info.render.calls);
        }
        return m;
      });
      check('M12.1: corridor renders in 5 draw calls (under budget)',
        calls === 5, `calls=${calls}`);
    }

    /* 5. screenshot of the beat — a near-black tunnel with bright LED
     *    lines (decoded in-page via dataURL → 2D canvas) */
    {
      const shot = await page.screenshot();
      fs.writeFileSync(`${here}/shots/m121-corridor.png`, shot);
      const lum = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = 'data:image/png;base64,' + b64;
        });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let mean = 0, bright = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          mean += l;
          if (l > 100) bright++;
        }
        return { mean: mean / n, bright: bright / n };
      }, shot.toString('base64'));
      const st = await introState();
      check('M12.1: screenshot shows the dark corridor with LED lines (shots/m121-corridor.png)',
        fs.existsSync(`${here}/shots/m121-corridor.png`) &&
        st.state === 'INTRO' && lum.mean < 40 && lum.bright > 0.002,
        `state=${st.state}, mean=${lum.mean.toFixed(1)}, bright=${(lum.bright * 100).toFixed(2)}%`);
    }

    /* 5b. bounded cost: dolly + flowing dashes are scratch-only —
     *     heap flat while the beat plays */
    {
      const h0 = await heapMin();
      const h1 = await heapMin();
      check('M12.1: bounded cost (heap flat while the corridor beat plays)',
        h0 > 0 && h1 - h0 <= 2 * 1024 * 1024,
        `Δ=${((h1 - h0) / 1048576).toFixed(2)} MB`);
    }

    /* 6. natural end: the beat plays to the end → street-level RUNNING
     *    (camera handed to the M0 street spawn) */
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'RUNNING',
      { timeout: 30000 },
    );
    {
      const s = await introState();
      check('M12.1: corridor beat plays to the end → street RUNNING (camera at spawn)',
        s.state === 'RUNNING' && !s.playing &&
        Math.abs(s.cam.x) < 0.01 && Math.abs(s.cam.y - 4) < 0.01 &&
        Math.abs(s.cam.z - 18) < 0.01,
        `state=${s.state}, playing=${s.playing}, cam=(${s.cam.x.toFixed(1)}, ${s.cam.y.toFixed(1)}, ${s.cam.z.toFixed(1)})`);
      /* the reload re-seeded the live events — park them for the
       * runner tests below (the M8.4/M9.6 sections own them). */
      await page.evaluate(() => {
        window.SIM.ATMOS._ltTimer = 1e9;
        window.SIM.ENTITY._autoAt = Infinity;
      });
    }

    /* 7. timeline runner: start / cancel mid-way / re-seek — all clean */
    {
      const track = [
        { t: 0, pos: [10, 20, -30], look: [0, 0, 0] },
        { t: 2, pos: [40, 30, 10], look: [0, 0, 0] },
      ];
      const poseAt = t => {
        const u = t / 2, e = u * u * (3 - 2 * u);
        return [10 + 30 * e, 20 + 10 * e, -30 + 40 * e];
      };
      const readPose = () => page.evaluate(() => {
        const S = window.SIM;
        const c = S.camera.position;
        return { x: c.x, y: c.y, z: c.z, t: S.INTRO.t, playing: S.INTRO.playing };
      });

      /* 7a. start: play → the camera rides the eased keyframes */
      const p0 = await page.evaluate((trk) => {
        const I = window.SIM.INTRO;
        window.__m121_done = 0;
        I.play(trk, () => { window.__m121_done++; });
        return { playing: I.playing, t: I.t, dur: I.dur };
      }, track);
      check('M12.1: runner start (play sets track, t=0, playing)',
        p0.playing && p0.t === 0 && p0.dur === 2,
        JSON.stringify(p0));
      await sleep(400);
      {
        const r = await readPose();
        const e = poseAt(r.t);
        check('M12.1: play — camera on the eased keyframe curve (same-frame pose)',
          r.playing &&
          Math.abs(r.x - e[0]) < 0.01 && Math.abs(r.y - e[1]) < 0.01 &&
          Math.abs(r.z - e[2]) < 0.01,
          `t=${r.t.toFixed(3)}, cam=(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}), want (${e[0].toFixed(2)}, ${e[1].toFixed(2)}, ${e[2].toFixed(2)})`);
      }

      /* 7b. seek mid-play: lands exactly on the eased pose */
      const s1 = await page.evaluate(() => {
        const I = window.SIM.INTRO;
        I.seek(1.0);
        const c = window.SIM.camera.position;
        return { x: c.x, y: c.y, z: c.z, t: I.t };
      });
      check('M12.1: seek mid-play lands exactly on the eased pose (t=1.0)',
        Math.abs(s1.x - 25) < 0.001 && Math.abs(s1.y - 25) < 0.001 &&
        Math.abs(s1.z + 10) < 0.001,
        `cam=(${s1.x.toFixed(3)}, ${s1.y.toFixed(3)}, ${s1.z.toFixed(3)}), want (25, 25, -10)`);

      /* 7c. seek clamps at the track end */
      const s2 = await page.evaluate(() => {
        const I = window.SIM.INTRO;
        I.seek(99);
        const c = window.SIM.camera.position;
        return { x: c.x, y: c.y, z: c.z, t: I.t };
      });
      check('M12.1: seek clamps at the track end (t=dur)',
        s2.t === 2 && Math.abs(s2.x - 40) < 0.001 && Math.abs(s2.y - 30) < 0.001 &&
        Math.abs(s2.z - 10) < 0.001,
        `t=${s2.t}, cam=(${s2.x.toFixed(3)}, ${s2.y.toFixed(3)}, ${s2.z.toFixed(3)}), want (40, 30, 10)`);

      /* 7d. cancel mid-way: playing off, camera returns to the street
       *     spawn (CAMERA.update owns it again) */
      await page.evaluate(() => {
        const I = window.SIM.INTRO;
        I.seek(1.0);           // back mid-way
        I.cancel();
      });
      await sleep(120);
      {
        const r = await readPose();
        check('M12.1: cancel mid-way — camera returns to the street spawn (clean)',
          !r.playing && Math.abs(r.x) < 0.01 && Math.abs(r.y - 4) < 0.01 &&
          Math.abs(r.z - 18) < 0.01,
          `playing=${r.playing}, cam=(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)})`);
      }

      /* 7e. re-seek after cancel: the pose applies again, clean */
      const s3 = await page.evaluate(() => {
        const I = window.SIM.INTRO;
        I.seek(0.5);
        const c = window.SIM.camera.position;
        return { x: c.x, y: c.y, z: c.z };
      });
      check('M12.1: re-seek after cancel applies the pose (t=0.5)',
        Math.abs(s3.x - 14.6875) < 0.001 &&
        Math.abs(s3.y - 21.5625) < 0.001 &&
        Math.abs(s3.z + 23.75) < 0.001,
        `cam=(${s3.x.toFixed(3)}, ${s3.y.toFixed(3)}, ${s3.z.toFixed(3)}), want (14.6875, 21.5625, -23.75)`);

      /* 7f. play to the end: onDone fires once, camera back at spawn */
      const p1 = await page.evaluate((trk) => {
        const I = window.SIM.INTRO;
        window.__m121_done = 0;
        I.play(trk, () => { window.__m121_done++; });
        return I.playing;
      }, track);
      await sleep(2400);
      {
        const r = await readPose();
        const done = await page.evaluate(() => window.__m121_done);
        check('M12.1: play to the end — onDone fires once, camera back at spawn',
          p1 && done === 1 && !r.playing &&
          Math.abs(r.x) < 0.01 && Math.abs(r.y - 4) < 0.01 &&
          Math.abs(r.z - 18) < 0.01,
          `done=${done}, playing=${r.playing}, cam=(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)})`);
      }

      /* 7g. bounded cost: the runner is scratch-only — heap flat */
      const h0 = await heapMin();
      await sleep(3000);
      const h1 = await heapMin();
      check('M12.1: bounded cost (heap flat while the runner idles)',
        h0 > 0 && h1 - h0 <= 2 * 1024 * 1024 && pageErrors.length === 0,
        `Δ=${((h1 - h0) / 1048576).toFixed(2)} MB, errors=${pageErrors.length}`);
    }
  }

  /* ------------------------------------------------------------------
   * M12.2 — Intro beats 2–5: reveal, orbit, title, drop
   *
   *  The full ~15.2 s intro auto-plays on every fresh load:
   *  B1 corridor dolly → B2 the corridor opens (far wall hidden,
   *  portal glow), the camera rushes through, a white DOM flash
   *  carries the scene switch and the CITY scene renders in a wide
   *  reveal dolly out → B3 a dive into a 1.5-orbit low orbit around
   *  the dormant creature → B4 the `QWEN FLASH // AWAKENING` title
   *  card (DOM, fades) while the orbit drifts on → B5 a lerp into
   *  the M0 street spawn → RUNNING with a controllable camera.
   *  Every pose below is verified same-frame (seek + read in one
   *  round-trip) against the keyframe math.
   * ------------------------------------------------------------------ */
  {
    const introState = () => page.evaluate(() => {
      const S = window.SIM, I = S.INTRO;
      const fadeEl = document.getElementById('introFade');
      const titleEl = document.getElementById('introTitle');
      const c = S.camera.position;
      return {
        state: S.BOOT.state,
        playing: I.playing,
        t: I.t,
        dur: I.dur,
        trackLen: I.track ? I.track.length : -1,
        inCity: I._inCity,
        cam: { x: c.x, y: c.y, z: c.z },
        fade: parseFloat(fadeEl.style.opacity),
        titleOp: parseFloat(titleEl.style.opacity),
        titleText: titleEl.textContent,
        endWall: I.endWall.visible,
        portalVisible: I.portal.visible,
        portalOp: I.portal.material.opacity,
      };
    });

    /* seek + read the pose/state in one round-trip (same frame ⇒
     * exact against the keyframes). */
    const seekState = (t) => page.evaluate((tt) => {
      const S = window.SIM, I = S.INTRO;
      I.seek(tt);
      const c = S.camera.position;
      const fadeEl = document.getElementById('introFade');
      const titleEl = document.getElementById('introTitle');
      return {
        x: c.x, y: c.y, z: c.z, t: I.t, inCity: I._inCity,
        fade: parseFloat(fadeEl.style.opacity),
        titleOp: parseFloat(titleEl.style.opacity),
        titleText: titleEl.textContent,
        endWall: I.endWall.visible,
        portalVisible: I.portal.visible,
        portalOp: I.portal.material.opacity,
      };
    }, t);

    /* is the camera exactly on the track's eased keyframe curve at t? */
    const onCurve = (t) => page.evaluate((tt) => {
      const S = window.SIM, I = S.INTRO;
      I.seek(tt);
      const kfs = I.track;
      let i = kfs.length - 2;
      for (let j = 0; j < kfs.length - 1; j++)
        if (I.t < kfs[j + 1].t) { i = j; break; }
      const a = kfs[i], b = kfs[i + 1];
      let u = (I.t - a.t) / ((b.t - a.t) || 1);
      u = Math.min(1, Math.max(0, u));
      const e = a.ease === 'linear' ? u : u * u * (3 - 2 * u);
      const c = S.camera.position;
      return Math.abs(c.x - (a.pos[0] + (b.pos[0] - a.pos[0]) * e)) < 1e-3 &&
        Math.abs(c.y - (a.pos[1] + (b.pos[1] - a.pos[1]) * e)) < 1e-3 &&
        Math.abs(c.z - (a.pos[2] + (b.pos[2] - a.pos[2]) * e)) < 1e-3;
    }, t);

    /* 1. fresh page: the full intro auto-plays (32 keyframes, ~15.2 s) */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    {
      const s = await introState();
      check('M12.2: full intro auto-plays (INTRO, 32 keyframes, ~15.2 s)',
        s.state === 'INTRO' && s.playing && s.trackLen === 32 &&
        Math.abs(s.dur - 15.2) < 0.01 &&
        s.titleText === 'QWEN FLASH // AWAKENING',
        `state=${s.state}, track=${s.trackLen}, dur=${s.dur}, title=${JSON.stringify(s.titleText)}`);
    }

    /* 2. beat 2a: the corridor opens — the far wall is gone, the
     *    portal glow fades in, and the camera rushes toward it */
    {
      const a = await seekState(4.6);
      const ok = await onCurve(4.6);
      check('M12.2: beat 2 — corridor opens (wall hidden, portal in, rush)',
        a.endWall === false && a.portalVisible === true &&
        Math.abs(a.portalOp - 1 / 3) < 0.05 && a.inCity === false &&
        a.y === 2.5 && a.z < -54 && ok,
        `wall=${a.endWall}, portal=${a.portalOp.toFixed(2)}, z=${a.z.toFixed(1)}, inCity=${a.inCity}, onCurve=${ok}`);
    }

    /* 2b. beat 2b: the white flash ramps up as the camera passes the
     *    wall (corridor scene until the switch time) */
    {
      const a = await seekState(5.5);
      check('M12.2: beat 2 — white flash ramping (t=5.5, fade 0.5, still corridor)',
        Math.abs(a.fade - 0.5) < 0.01 && a.inCity === false &&
        a.z < -60 && Math.abs(a.y - 2.5) < 0.01,
        `fade=${a.fade.toFixed(3)}, z=${a.z.toFixed(1)}, inCity=${a.inCity}`);
    }

    /* 2c. beat 2c: AT the switch time the CITY scene owns the frame —
     *    camera at the wide reveal start, flash fully up */
    {
      const a = await seekState(5.8);
      check('M12.2: beat 2 — scene switch at t=5.8 (city scene, flash 1.0)',
        a.inCity === true && a.fade === 1 &&
        Math.abs(a.x) < 1e-3 && Math.abs(a.y - 160) < 1e-3 &&
        Math.abs(a.z - 300) < 1e-3,
        `inCity=${a.inCity}, fade=${a.fade.toFixed(3)}, cam=(${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)})`);
    }

    /* 2d. beat 2d: the flash releases and the wide reveal dolly runs
     *    out over the city (screenshot of the wide shot) */
    {
      const a = await seekState(6.6);
      const ok = await onCurve(6.6);
      check('M12.2: beat 2 — flash released, wide reveal dolly out',
        a.fade === 0 && a.inCity === true &&
        a.y > 160 && a.y < 260 && a.z > 300 && ok,
        `fade=${a.fade.toFixed(3)}, cam=(${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)}), onCurve=${ok}`);
      await page.evaluate(() => window.SIM.INTRO.seek(7.0));
      await sleep(120); // let a city frame render
      const shot = await page.screenshot();
      fs.writeFileSync(`${here}/shots/m122-reveal.png`, shot);
      const lum = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = 'data:image/png;base64,' + b64;
        });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let mean = 0, bright = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          mean += l;
          if (l > 100) bright++;
        }
        return { mean: mean / n, bright: bright / n };
      }, shot.toString('base64'));
      const st = await introState();
      check('M12.2: screenshot shows the wide city reveal (shots/m122-reveal.png)',
        fs.existsSync(`${here}/shots/m122-reveal.png`) &&
        st.state === 'INTRO' && st.inCity &&
        lum.mean > 2 && lum.mean < 80 && lum.bright > 0.001,
        `state=${st.state}, inCity=${st.inCity}, mean=${lum.mean.toFixed(1)}, bright=${(lum.bright * 100).toFixed(2)}%`);
    }

    /* 3. beat 3: the low orbit — the camera rides a 104 m circle at
     *    64 m, looking at the dormant creature, for exactly 1.5 turns */
    const orbitPose = await page.evaluate(() => {
      const S = window.SIM, I = S.INTRO;
      I.seek(10.0);
      S.camera.updateMatrixWorld();   // pose was just written — matrixWorld lags one render
      const c = S.camera.position;
      const m = S.camera.matrixWorld.elements;
      const fwd = { x: -m[8], y: -m[9], z: -m[10] };
      /* look target (0, 32, 0): direction from the orbit point */
      const lx = -c.x, ly = 32 - c.y, lz = -c.z;
      const ll = Math.hypot(lx, ly, lz);
      return {
        x: c.x, y: c.y, z: c.z,
        dot: (fwd.x * lx + fwd.y * ly + fwd.z * lz) / ll,
      };
    });
    {
      const a = orbitPose;
      const r = Math.hypot(a.x, a.z);
      const dot = a.dot;
      check('M12.2: beat 3 — low orbit (r=104, h=64, looking at the creature)',
        Math.abs(r - 104) < 0.5 && Math.abs(a.y - 64) < 0.01 && dot > 0.99,
        `r=${r.toFixed(1)}, y=${a.y.toFixed(1)}, lookDot=${dot.toFixed(3)}`);
      /* 1.5 turns: at t=11.6 the orbit has swept 540° (≡ 180°) ⇒ the
       * far (-Z) side, exactly (0, 64, -104) */
      const b = await seekState(11.6);
      check('M12.2: beat 3 — exactly 1.5 orbits at t=11.6 (0, 64, -104)',
        Math.abs(b.x) < 0.5 && Math.abs(b.y - 64) < 0.01 &&
        Math.abs(b.z + 104) < 0.5,
        `cam=(${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.z.toFixed(1)})`);
      /* the orbit keyframes: exactly 18 linear r=104 keyframes inside
       * the beat 3 window (the dive start and beat-5 start keyframes
       * also sit on the circle but outside it) */
      const orbitKfs = await page.evaluate(() => {
        const I = window.SIM.INTRO, C = window.SIM.CFG.intro;
        const tDive = C.beat1.dur + C.beat2.dur + C.beat3.dive;
        const tEnd = C.beat1.dur + C.beat2.dur + C.beat3.dur;
        return I.track.filter(k => k.ease === 'linear' &&
          Math.abs(Math.hypot(k.pos[0], k.pos[2]) - 104) < 0.01 &&
          k.t > tDive + 1e-9 && k.t <= tEnd + 1e-9).length;
      });
      check('M12.2: beat 3 — orbit is 18 linear r=104 keyframes (30° each)',
        orbitKfs === 18, `linearOrbitKfs=${orbitKfs}`);
    }

    /* 4. beat 4: the title card — DOM, fades in, holds, fades out,
     *    while the orbit drifts on and rises */
    {
      const a = await seekState(12.3);
      const ok = await onCurve(12.3);
      check('M12.2: beat 4 — title card visible (opacity 1, orbit drifting up)',
        a.titleOp === 1 &&
        a.titleText === 'QWEN FLASH // AWAKENING' &&
        a.y > 64 && ok,
        `titleOp=${a.titleOp.toFixed(2)}, y=${a.y.toFixed(1)}, onCurve=${ok}`);
      /* on an orbit keyframe the radius is exactly 104 */
      const kf = await seekState(12.6);
      check('M12.2: beat 4 — orbit keyframe on the r=104 circle (t=12.6)',
        Math.abs(Math.hypot(kf.x, kf.z) - 104) < 0.01 &&
        Math.abs(kf.y - 68) < 0.01,
        `cam=(${kf.x.toFixed(1)}, ${kf.y.toFixed(1)}, ${kf.z.toFixed(1)})`);
      /* fade in / fade out windows */
      const f1 = await seekState(12.05);
      const f2 = await seekState(13.4);
      check('M12.2: beat 4 — title fades (in at 12.05 ≈ 0.9, out at 13.4 ≈ 0.33)',
        Math.abs(f1.titleOp - 0.9) < 0.05 && Math.abs(f2.titleOp - 1 / 3) < 0.05,
        `t12.05=${f1.titleOp.toFixed(2)}, t13.4=${f2.titleOp.toFixed(2)}`);
      await page.evaluate(() => window.SIM.INTRO.seek(12.3));
      await sleep(120);
      const shot = await page.screenshot();
      fs.writeFileSync(`${here}/shots/m122-title.png`, shot);
      const lum = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = 'data:image/png;base64,' + b64;
        });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let bright = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          if (l > 150) bright++;
        }
        return bright / n;
      }, shot.toString('base64'));
      check('M12.2: screenshot shows the title card (shots/m122-title.png)',
        fs.existsSync(`${here}/shots/m122-title.png`) && lum > 0.001,
        `bright=${(lum * 100).toFixed(2)}%`);
    }

    /* 5. beat 5: the drop — the camera lerps from the orbit end into
     *    the M0 street spawn */
    {
      const a = await seekState(14.5);
      const ok = await onCurve(14.5);
      check('M12.2: beat 5 — drop into the street spawn (lerp, on curve)',
        ok && a.x > -90.1 && a.x < 0 && a.y > 4 && a.y < 72 &&
        a.z > 18 && a.z < 52,
        `cam=(${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)}), onCurve=${ok}`);
    }

    /* 6. full natural play: the ~15.2 s intro plays to the end →
     *    RUNNING with a CONTROLLABLE street-level camera, and every
     *    beat FX is off */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'RUNNING',
      { timeout: 30000 },
    );
    {
      const s = await introState();
      check('M12.2: full intro plays to the end → street RUNNING (beat FX off)',
        s.state === 'RUNNING' && !s.playing &&
        Math.abs(s.dur - 15.2) < 0.01 &&
        Math.abs(s.cam.x) < 0.05 && Math.abs(s.cam.y - 4) < 0.05 &&
        Math.abs(s.cam.z - 18) < 0.05 &&
        s.fade === 0 && s.titleOp === 0 &&
        s.endWall === true && s.portalVisible === false &&
        s.inCity === false,
        `state=${s.state}, cam=(${s.cam.x.toFixed(1)}, ${s.cam.y.toFixed(1)}, ${s.cam.z.toFixed(1)}), fade=${s.fade}, title=${s.titleOp}, wall=${s.endWall}`);
      /* controllable: W moves the camera forward from the spawn */
      await page.keyboard.down('w');
      await sleep(700);
      await page.keyboard.up('w');
      const c2 = await page.evaluate(() => {
        const c = window.SIM.camera.position;
        return { x: c.x, y: c.y, z: c.z, state: window.SIM.BOOT.state };
      });
      check('M12.2: street-level camera is controllable (W moves forward)',
        c2.state === 'RUNNING' && c2.z < 17.5,
        `cam=(${c2.x.toFixed(1)}, ${c2.y.toFixed(1)}, ${c2.z.toFixed(1)}), state=${c2.state}`);
    }

    /* 7. bounded cost: the full intro is scratch-only — heap flat
     *    while the city beats play */
    {
      await page.evaluate(() => window.SIM.INTRO.seek(9.0));
      const heapMin = () => page.evaluate(async () => {
        let m = Infinity;
        for (let i = 0; i < 3; i++) {
          if (window.gc) window.gc();
          if (performance.memory) m = Math.min(m, performance.memory.usedJSHeapSize);
          await new Promise(r => setTimeout(r, 250));
        }
        return m === Infinity ? -1 : m;
      });
      const h0 = await heapMin();
      const h1 = await heapMin();
      check('M12.2: bounded cost (heap flat while the city beats play)',
        h0 > 0 && h1 - h0 <= 2 * 1024 * 1024,
        `Δ=${((h1 - h0) / 1048576).toFixed(2)} MB`);
    }
  }

  /* ------------------------------------------------------------------
   * M12.3 — Skip/cancel robustness
   *
   *  The intro is skippable/cancellable at ANY moment — START click,
   *  any click, any keypress — each starts a 0.5 s white fade to the
   *  street camera (INTRO._skip, driven from update()). The street
   *  handoff lands at the fade midpoint: the play state (RUNNING) is
   *  live while the fade is still on screen (the intro never blocks
   *  play). The START button stays hidden until 2 s into the intro
   *  (its .on class is a pure function of t ⇒ seek-safe); before that
   *  click/keypress still skip (the button is pointer-events:none,
   *  so the click lands on the page and the window pointerdown
   *  fires). All three paths must end in a controllable street-level
   *  camera: early skip (click, corridor), late interrupt (keypress,
   *  beat 5), natural finish.
   * ------------------------------------------------------------------ */
  {
    const startBtnState = () => page.evaluate(() => {
      const b = document.getElementById('startBtn');
      const cs = getComputedStyle(b);
      return {
        on: b.classList.contains('on'),
        op: parseFloat(cs.opacity),
        pe: cs.pointerEvents,
      };
    });

    /* the shared end state for every path: street RUNNING, timeline
     * off, street spawn pose, every beat FX off, overlay gone. */
    const endState = () => page.evaluate(() => {
      const S = window.SIM, I = S.INTRO;
      const c = S.camera.position;
      return {
        state: S.BOOT.state,
        playing: I.playing,
        skipDone: I._skip === null,
        inCity: I._inCity,
        cam: { x: c.x, y: c.y, z: c.z },
        fade: parseFloat(document.getElementById('introFade').style.opacity),
        titleOp: parseFloat(document.getElementById('introTitle').style.opacity),
        endWall: I.endWall.visible,
        portal: I.portal.visible,
        overlayHide: document.getElementById('overlay').classList.contains('hide'),
      };
    });

    const checkEnd = (name, s) => check(name,
      s.state === 'RUNNING' && !s.playing && s.skipDone &&
      Math.abs(s.cam.x) < 0.05 && Math.abs(s.cam.y - 4) < 0.05 &&
      Math.abs(s.cam.z - 18) < 0.05 &&
      s.fade === 0 && s.titleOp === 0 &&
      s.endWall === true && s.portal === false &&
      !s.inCity && s.overlayHide,
      `state=${s.state}, cam=(${s.cam.x.toFixed(1)}, ${s.cam.y.toFixed(1)}, ${s.cam.z.toFixed(1)}), fade=${s.fade}, title=${s.titleOp}, wall=${s.endWall}, inCity=${s.inCity}, overlay=${s.overlayHide}`);

    /* controllable: W moves the camera forward from the street spawn */
    const checkControllable = async (name) => {
      await page.keyboard.down('w');
      await sleep(700);
      await page.keyboard.up('w');
      const c = await page.evaluate(() => {
        const p = window.SIM.camera.position;
        return { x: p.x, y: p.y, z: p.z, state: window.SIM.BOOT.state };
      });
      check(name, c.state === 'RUNNING' && c.z < 17.5,
        `cam=(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}), state=${c.state}`);
    };

    /* in-flight skip state: fade running, timeline frozen, BOOT state
     * exactly where the fade clock says it is. */
    const inFlight = () => page.evaluate(() => {
      const I = window.SIM.INTRO;
      return {
        skip: I._skip !== null,
        playing: I.playing,
        state: window.SIM.BOOT.state,
        fade: parseFloat(document.getElementById('introFade').style.opacity),
      };
    });

    /* 1. EARLY SKIP (click, corridor, t ≈ 1.5 s) — the START button
     *    is still hidden, so the click lands on the page (window
     *    pointerdown) and skips from there. */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    {
      /* hidden before 2 s (sampled after the 0.5 s CSS transition
       * settles at intro start) */
      await page.waitForFunction(
        () => window.SIM.INTRO.t > 0.8, { timeout: 10000 });
      const b = await startBtnState();
      check('M12.3: START hidden before 2 s (class off, no pointer events, opacity 0)',
        !b.on && b.pe === 'none' && b.op < 0.05,
        `on=${b.on}, pe=${b.pe}, op=${b.op.toFixed(2)}`);
      /* visible-delay boundary: pure function of t (seek ⇒ same-frame)
       * — hidden at 1.9, on at 2.1 */
      const b1 = await page.evaluate(() => {
        window.SIM.INTRO.seek(1.9);
        return document.getElementById('startBtn').classList.contains('on');
      });
      const b2 = await page.evaluate(() => {
        window.SIM.INTRO.seek(2.1);
        return document.getElementById('startBtn').classList.contains('on');
      });
      check('M12.3: START visible-delay boundary (hidden at t=1.9, on at t=2.1)',
        b1 === false && b2 === true, `t1.9=${b1}, t2.1=${b2}`);
      /* back early for the skip itself (real play from the seeked pose) */
      await page.evaluate(() => window.SIM.INTRO.seek(1.0));
      await page.waitForFunction(
        () => window.SIM.INTRO.t > 1.5 && window.SIM.INTRO.t < 2.0,
        { timeout: 10000 });
      /* the skip: a plain click on the page (button hidden ⇒ the
       * pointerdown lands on the window listener) */
      await page.mouse.click(640, 400);
      const f = await inFlight();
      check('M12.3: early skip in flight (click) — fade started, timeline frozen, still INTRO',
        f.skip && !f.playing && f.state === 'INTRO' && f.fade >= 0 && f.fade < 1,
        `skip=${f.skip}, playing=${f.playing}, state=${f.state}, fade=${f.fade.toFixed(2)}`);
      /* the fade actually animates while the intro is still on screen
       * (headless runs ~10 fps — poll per-frame instead of sampling at
       * a fixed offset) */
      const anim = await page.waitForFunction(() => {
        const I = window.SIM.INTRO;
        const f = parseFloat(document.getElementById('introFade').style.opacity);
        return I._skip !== null && !I.playing &&
          window.SIM.BOOT.state === 'INTRO' && f > 0 && f < 1;
      }, { timeout: 3000 }).then(() => true).catch(() => false);
      check('M12.3: early skip fade animates while the intro is still on screen (0 < fade < 1)',
        anim);
      /* idempotent: a second trigger (a real START press fires the
       * window pointerdown AND the button click) must not restart or
       * double the fade */
      const same = await page.evaluate(() => {
        const I = window.SIM.INTRO;
        const a = I._skip;
        I.skip();
        return I._skip === a && I._skip !== null;
      });
      check('M12.3: skip is idempotent (second gesture keeps the one fade)', same);
      /* at the midpoint the PLAY STATE IS LIVE — RUNNING entered while
       * the fade is still on screen (the intro never blocks play).
       * Poll per-frame: the fade is 0.5 s ≈ 5 headless frames. */
      const live = await page.waitForFunction(() => {
        const I = window.SIM.INTRO;
        const f = parseFloat(document.getElementById('introFade').style.opacity);
        return window.SIM.BOOT.state === 'RUNNING' &&
          I._skip !== null && f > 0 && f < 1;
      }, { timeout: 3000 }).then(() => true).catch(() => false);
      check('M12.3: play state live mid-fade (RUNNING entered while the fade is still on screen)',
        live, `live=${live}`);
      await page.waitForFunction(
        () => parseFloat(document.getElementById('introFade').style.opacity) === 0 &&
          window.SIM.INTRO._skip === null,
        { timeout: 3000 });
      const s = await endState();
      checkEnd('M12.3: early skip ends in the street (fade done, beat FX off)', s);
      await checkControllable('M12.3: early skip → controllable street camera (W moves forward)');
    }

    /* 2. LATE INTERRUPT (keypress, beat 5, t ≈ 14.3 s) — the START
     *    button is visible by then; any keypress skips. */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => window.SIM.INTRO.t > 14.2 && window.SIM.INTRO.t < 15.05,
      { timeout: 25000 });
    {
      const b = await startBtnState();
      check('M12.3: START visible after 2 s (late intro: on, clickable, opaque)',
        b.on && b.pe === 'auto' && b.op > 0.9,
        `on=${b.on}, pe=${b.pe}, op=${b.op.toFixed(2)}`);
      /* the interrupt: a keypress (Escape) */
      await page.keyboard.press('Escape');
      const f = await inFlight();
      check('M12.3: late interrupt in flight (keypress) — fade started, timeline frozen, still INTRO',
        f.skip && !f.playing && f.state === 'INTRO' && f.fade >= 0 && f.fade < 1,
        `skip=${f.skip}, playing=${f.playing}, state=${f.state}, fade=${f.fade.toFixed(2)}`);
      /* same live-mid-fade guarantee (per-frame poll, ~10 fps headless) */
      const live = await page.waitForFunction(() => {
        const I = window.SIM.INTRO;
        const f = parseFloat(document.getElementById('introFade').style.opacity);
        return window.SIM.BOOT.state === 'RUNNING' &&
          I._skip !== null && f > 0 && f < 1;
      }, { timeout: 3000 }).then(() => true).catch(() => false);
      check('M12.3: late interrupt — play state live mid-fade (RUNNING)',
        live, `live=${live}`);
      await page.waitForFunction(
        () => parseFloat(document.getElementById('introFade').style.opacity) === 0 &&
          window.SIM.INTRO._skip === null,
        { timeout: 3000 });
      const s = await endState();
      checkEnd('M12.3: late interrupt ends in the street (fade done, beat FX off)', s);
      await checkControllable('M12.3: late interrupt → controllable street camera (W moves forward)');
    }

    /* 3. FINISH (natural) — the full intro plays to the end: the
     *    third path to the same controllable street camera. */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => window.SIM && window.SIM.BOOT.state === 'INTRO',
      { timeout: 20000 });
    await page.waitForFunction(
      () => window.SIM.BOOT.state === 'RUNNING',
      { timeout: 30000 });
    {
      const s = await endState();
      checkEnd('M12.3: natural finish ends in the street (fade done, beat FX off)', s);
      await checkControllable('M12.3: natural finish → controllable street camera (W moves forward)');
    }
  }

  /* ---- 9b. M13.1 — EVENTS scheduler: forced seed ⇒ legal firing
   *    order (no overlaps, min/max gap respected, cooldowns held,
   *    weighted picking, priority preemption, determinism) ---- */
  {
    /* synthetic registry: evA (weight 2, cd 2, prio 1), evB (weight 1,
     * cd 4, prio 1), evC (prio 2, gated off until flipped — it must
     * preempt whatever is running). Page is RUNNING (no reload). */
    await page.evaluate(() => {
      const S = window.SIM, E = S.EVENTS;
      S.CFG.events.gap = [2, 4];   // test pacing (shorter than CFG)
      S.CFG.events.first = 0;
      window.__m131 = { gate: false };
      E.register({ id: 'evA', weight: 2, duration: [1, 1],
                   cooldown: [2, 2], priority: 1 });
      E.register({ id: 'evB', weight: 1, duration: [1, 1],
                   cooldown: [4, 4], priority: 1 });
      E.register({ id: 'evC', weight: 1, duration: [0.5, 0.5],
                   cooldown: [1, 1], priority: 2,
                   eligible: () => window.__m131.gate });
    });

    /* the page loop drives the scheduler (update wired into systems) */
    const t0 = await page.evaluate(() => window.SIM.EVENTS._time);
    await sleep(400);
    const t1 = await page.evaluate(() => window.SIM.EVENTS._time);
    check('M13.1: scheduler clock advances in the page loop (update wired)',
      t1 > t0, `t ${t0.toFixed(3)} -> ${t1.toFixed(3)}`);

    /* phase 1: freeze the page loop, force the seed, run 1200 × 0.1 s
     * (120 s) — the firing order must be legal. */
    const log1 = await page.evaluate(() => {
      const S = window.SIM, E = S.EVENTS;
      E.paused = true;
      E.reset();
      E._rng = S.WORLD.mulberry(0x1337); // forced seed
      for (let i = 0; i < 1200; i++) E.step(0.1);
      return JSON.parse(JSON.stringify(E.log));
    });
    {
      let noOverlap = true;
      let gapsOk = true;
      let cdOk = true;
      const cdMin = { evA: 2, evB: 4, evC: 1 };
      for (let i = 1; i < log1.length; i++) {
        const gap = log1[i].start - log1[i - 1].end;
        if (!(log1[i].start > log1[i - 1].end)) noOverlap = false;
        /* gap ∈ [2, 4] plus one 0.1 s step of quantization */
        if (!(gap >= 2 - 1e-9 && gap <= 4 + 0.1 + 1e-9)) gapsOk = false;
        if (log1[i].id === log1[i - 1].id &&
            !(gap >= Math.max(2, cdMin[log1[i].id]) - 1e-9)) cdOk = false;
      }
      const nA = log1.filter(e => e.id === 'evA').length;
      const nB = log1.filter(e => e.id === 'evB').length;
      const nC = log1.filter(e => e.id === 'evC').length;
      check('M13.1: one-at-a-time (no overlapping events in the firing order)',
        noOverlap && log1.length >= 10, `n=${log1.length}`);
      check('M13.1: min/max gap respected (every gap in [2, 4] + step)',
        gapsOk, `n=${log1.length}`);
      check('M13.1: per-event cooldown held (same-id gap >= max(minGap, cd))',
        cdOk);
      check('M13.1: weighted picking (evA weight 2 fires more than evB weight 1)',
        nA > nB && nB >= 1, `A=${nA}, B=${nB}`);
      check('M13.1: gated event (evC) never fires while ineligible', nC === 0);
    }

    /* phase 2: priority — evC (prio 2) must preempt the RUNNING
     * lower-priority event the moment its gate opens: the victim ends
     * interrupted exactly where C starts (no overlap, no gap). */
    const p2 = await page.evaluate(() => {
      const S = window.SIM, E = S.EVENTS;
      let i = 0;
      while (!E._active && i < 300) { E.step(0.1); i++; }
      const activeBefore = E._active ? E._active.id : null;
      const victimIdx = E.log.length; // where the victim lands after the step
      window.__m131.gate = true;
      E.step(0.1); // victim → log (interrupted), evC → active
      const preempted = E._active && E._active.id === 'evC';
      window.__m131.gate = false;
      for (let j = 0; j < 100; j++) E.step(0.1); // 10 s, C gated off
      const tail = E.log.slice(victimIdx).map(e => ({ id: e.id, start: e.start,
        end: e.end, interrupted: e.interrupted }));
      return { activeBefore, preempted,
        victim: tail[0] || null,
        c: tail[1] || null,
        tail };
    });
    check('M13.1: priority held (evC preempts the running lower-priority event)',
      !!p2.c && !!p2.victim && p2.victim.id === p2.activeBefore &&
      p2.victim.interrupted === true && p2.c.start === p2.victim.end &&
      p2.preempted,
      `active=${p2.activeBefore}, victim=${JSON.stringify(p2.victim)}, c=${JSON.stringify(p2.c)}`);
    {
      /* after the preemption: C fires exactly once (gated off after),
       * no overlaps, and the normal gap resumes from C's end. */
      let ok = p2.tail.length >= 2 && p2.tail[0].id === p2.victim.id &&
        p2.tail[1].id === 'evC' &&
        p2.tail.filter(e => e.id === 'evC').length === 1;
      for (let i = 1; i < p2.tail.length && ok; i++) {
        const gap = p2.tail[i].start - p2.tail[i - 1].end;
        /* i=1 is the preemption pair: C starts exactly at the victim's
         * end (no gap, no overlap) */
        if (!(p2.tail[i].start >= p2.tail[i - 1].end - 1e-9)) ok = false;
        if (i > 1) { /* gap rule applies from C's end onward */
          if (!(gap >= 2 - 1e-9 && gap <= 4 + 0.1 + 1e-9)) ok = false;
        }
      }
      check('M13.1: post-preemption (C fires once, no overlap, gap resumes)',
        ok, `tail=${JSON.stringify(p2.tail.slice(0, 4))}`);
    }

    /* phase 3: determinism — same seed + same steps ⇒ identical log. */
    const log2 = await page.evaluate(() => {
      const S = window.SIM, E = S.EVENTS;
      E.reset();
      E._rng = S.WORLD.mulberry(0x1337);
      for (let i = 0; i < 1200; i++) E.step(0.1);
      return JSON.parse(JSON.stringify(E.log));
    });
    check('M13.1: forced seed ⇒ identical firing order (deterministic)',
      JSON.stringify(log2) === JSON.stringify(log1),
      `n1=${log1.length}, n2=${log2.length}`);

    /* cleanup: synthetic registry gone, real CFG/clock/rng restored */
    await page.evaluate(() => {
      const S = window.SIM, E = S.EVENTS;
      E.unregister('evA');
      E.unregister('evB');
      E.unregister('evC');
      S.CFG.events.gap = [14, 30];
      S.CFG.events.first = 20;
      E.reset();
      E._rng = S.WORLD.mulberry(S.CFG.city.seed ^ S.CFG.events.seed);
      E.paused = false;
      delete window.__m131;
    });
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
