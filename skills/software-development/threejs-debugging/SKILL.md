---
name: threejs-debugging
description: >
  Debugging patterns and pitfall avoidance for Three.js games and 3D web apps.
  Covers lazy-init, event bus audit, init ordering, restart safety, shader
  attribute mismatches, Web AudioContext pitfalls, and headless CDP testing
  when browser automation tools are unavailable.
triggers:
  - "threejs crash"
  - "threejs error"
  - "Three.js bug"
  - "WebGL error"
  - "scene null"
  - "geometry dispose"
  - "background empty"
  - "starfield"
  - "black screen"
  - "fog"
version: 1.1.0
---

# Three.js Debugging Patterns

## Overview

Three.js projects have a unique set of runtime failure modes that differ from
standard web apps. This skill captures the most common and destructive patterns
discovered through debugging production Three.js games.

---

## Pitfall 1: Lazy-Init Shared Resources

**Problem:** `init()` creates shared resources (shared `BufferGeometry`,
shared materials) but child systems call their methods before `init()` runs.
Result: `Cannot read properties of null (reading 'morphAttributes')` or
similar null-reference crashes.

**Root cause:** Initialization ordering. `ChunkManager` is instantiated
before `init()` is called. `ChunkManager.init()` immediately calls
`_spawnChunk()` → `nebula.createCluster()` → tries to use `this._sharedGeo`
which is `null` because `NebulaSystem.init()` hasn't run yet.

**Fix: Lazy initialization.** Create shared resources on first use:

```javascript
class NebulaSystem {
  createCluster(position, params, rng) {
    // Lazily create shared geometry (avoids init() ordering issues)
    if (!this._sharedGeo) {
      this._sharedGeo = new THREE.PlaneGeometry(1, 1);
    }
    // ... rest of method uses this._sharedGeo
  }
}
```

Also update `init()` to not pre-create the resource:
```javascript
init() {
  // Lazy-init shared geometry on first createCluster() call
  return this._clusters;
}
```

**When to apply:** Any shared resource (geometry, material, texture, buffer)
that is referenced by methods that might be called during construction or
early init before the parent's `init()` runs.

---

## Pitfall 2: Map Entry Created After Method Call

**Problem:** `Uncaught TypeError: Cannot set properties of undefined`
when a method tries to set a property on a Map entry that hasn't been
added to the Map yet.

**Root cause:** Code pattern:
```javascript
this._spawnChunk(cx, cz);                        // ← tries .get() on key
this._activeChunks.set(key, { cx, cz, objects: [] });  // ← too late
```

The `_spawnChunk` method calls `this._activeChunks.get(key)` but the key
wasn't added to the Map yet.

**Fix:** Create the entry BEFORE calling the method:
```javascript
const chunkEntry = { cx, cz, objects: [] };
this._activeChunks.set(key, chunkEntry);
this._spawnChunk(cx, cz, chunkEntry);  // pass entry as argument
```

And in the method, use the passed entry instead of `.get()`:
```javascript
_spawnChunk(cx, cz, chunkEntry) {
  const chunkObjects = chunkEntry.objects;  // direct reference
  // ... no .get() needed
}
```

**When to apply:** Any Map/Dictionary pattern where a method needs to
store or modify data associated with a key that it doesn't own the
creation of.

---

## Pitfall 3: Event Bus Completeness — Orphaned Events

**Problem:** Events are emitted but never listened to (silently dropped),
or listened to but never emitted (dead code). In a large event-driven
system, these are nearly impossible to find without a systematic audit.

**Symptoms:**
- `audio:warning` emitted but no handler → warning beeps never play
- `game:gameover` listened to in 3 files but never emitted → game over
  screen never shows, crosshair never dims
- `game:restart` listened to in Crosshair and HUD but never emitted →
  UI elements don't reset on restart
- `audio:mute` listened to for logging but never emitted → mute logging
  never fires

**Audit technique** (run from project root):
```bash
# Find all emits and their files
grep -rn "EventBus.emit(" src/

# Find all listeners and their files
grep -rn "EventBus.on(" src/
```

Then manually compare: every event name that appears in emits must have
a matching listener, and every listener must have a matching emitter.

**Automated audit** (see `scripts/event-bus-audit.js` in references/):
A Node.js script that parses all JS files, extracts emit/on calls,
and reports mismatches.

**Fix:** For each mismatch:
- Emitted but not listened → add listener in the appropriate system
- Listened but not emitted → add emit call in the appropriate system

---

## Pitfall 4: Duplicate Event + Direct Call

**Problem:** Action fires twice — once from an event handler and once
from a direct check. In the game loop:

```javascript
// In _setupEvents():
EventBus.on('input:keydown', (code) => {
  if (code === 'Space') this._attemptFire();  // ← fires from event
});

// In game loop:
if (this.input.isPressed(Constants.INPUT.FIRE)) {
  this._attemptFire();  // ← fires again on every frame space is held
}
```

**Result:** Double fire rate, unexpected behavior.

**Fix:** Use ONE mechanism. For continuous actions (hold spacebar to
fire), use `isPressed()` in the game loop. For single-trigger actions
(button press), use event handlers. Don't do both.

```javascript
// Event handler — only handles non-fire keys
EventBus.on('input:keydown', (code) => {
  if (code === 'KeyR' && !GameState.isAlive) this._restart();
  if (code === 'KeyM') this.audio.toggleMute();
});

// Game loop handles continuous input
if (this.input.isPressed(Constants.INPUT.FIRE)) {
  this._attemptFire();
}
```

---

## Pitfall 5: `game:restart` Event Not Emitted

**Problem:** Multiple UI systems listen for `game:restart` to reset
their state (Crosshair fades back in, HUD resets health bar), but the
event is never emitted during `_restart()`.

**Result:** After restart, UI elements are stuck in their "game over"
state — crosshair stays dim, health bar shows 0.

**Fix:** Emit the event at the start of restart, before re-init:
```javascript
_restart() {
  this._isRunning = false;
  this.hud.hideGameOver();
  // ... cleanup ...
  GameState.restart();
  EventBus.emit('game:restart');  // ← notify all listeners
  this.score.reset();
  // ... re-init systems ...
}
```

---

## Pitfall 6: WebGL Shader Attribute Mismatches

**Problem:** `Uncaught TypeError: Cannot read properties of null
(reading 'morphAttributes')` when creating a Mesh with a ShaderMaterial
that expects attributes the geometry doesn't provide.

**Root cause:** Three.js 0.165+ requires `texture()` in fragment shaders
(not `texture2D()`). Vertex shaders that reference attributes like
`offset`, `scale`, `rotation` must have these defined in the geometry's
BufferAttribute — if they're missing, the shader fails silently until
the first draw call.

**Fix:** Always verify that every uniform and attribute referenced in a
shader is provided by the material's uniforms object and the geometry's
attributes. Use lazy init for shared geometries to ensure they exist
before first use.

---

## Pitfall 7: Web AudioContext Autoplay Policy

**Problem:** AudioContext is suspended due to browser autoplay policy.
Audio doesn't play until user interaction.

**Fix:** Defer AudioContext creation until a user gesture (click or
keydown), then resume:
```javascript
init() {
  const initOnce = () => {
    if (this._isInitialized) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    // ... setup ...
    this._isInitialized = true;
    this._removeInitListeners();  // remove once-after-first-use
  };
  
  window.addEventListener('click', this._initClickHandler, { once: false });
  window.addEventListener('keydown', this._initKeyHandler);
}
```

Also check `this._ctx.state === 'running'` before playing sounds.

---

## Pitfall 8: Restart Memory Leaks

**Problem:** Restarting a Three.js scene leaks geometries, materials,
and event listeners because:
1. Old scene objects aren't disposed
2. Old event listeners aren't unsubscribed
3. Hit-tracking Sets aren't cleared

**Fix:** In restart/shutdown:
```javascript
_restart() {
  // 1. Stop loop
  this._isRunning = false;
  
  // 2. Destroy individual systems
  this.playerShip.destroy();
  this.weapon.clear();
  this.particles.destroy();
  this.starfield.destroy();
  this.chunkManager.destroy();
  this.postProcessing.composer?.dispose();
  
  // 3. Dispose all remaining scene objects
  this._disposeScene();
  this.scene.clear();
  
  // 4. Reset state
  GameState.restart();
  this._projectileHitsProcessed.clear();
  
  // 5. Unsubscribe old event listeners
  for (const unsub of this._unsubscribers) unsub();
  this._unsubscribers = [];
  
  // 6. Re-init everything
  this._initSystems();
  this._setupEvents();
  this._isRunning = true;
  this._animate();
}
```

**Verification:** Restart 3 times. Check DevTools memory profiler —
heap should not grow.

---

## Pitfall 9: Distance Tracking Uses Absolute Position

**Problem:** Biome progression and distance-based scoring frozen because
distance is computed as `Math.abs(x) + Math.abs(y) + Math.abs(z)` —
absolute magnitude, not cumulative travel. Ship at position (-10, 0, 0)
has same "distance" as ship at (10, 0, 0).

**Fix:** Track cumulative distance from position magnitude:
```javascript
const currentDist = Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z);
if (currentDist > this._lastPos) {
  GameState.addDistance(currentDist - this._lastPos);
}
this._lastPos = currentDist;
```

---

## Pitfall 10: Biome Wrapping Broken

**Problem:** `getCurrentBiome(distance)` works for distances up to 7000
but produces wrong biome beyond that. Original code:
```javascript
const cycle = (dist - 5000) % 2000;  // wrong: gives 0-1999 range
// but zones start at 0, 1000, 3000, 5000 — so 14000 gives cycle=4000
// which doesn't match any zone
```

**Fix:** Use modulo on the full cycle range:
```javascript
const totalCycle = 7000;  // last zone end
const cycle = distance % totalCycle;
```

---

## Pitfall 16: Per-Frame Cooldown Gate Blocks Synchronous Operations

**Problem:** A synchronous loop tries to place N towers (or spawn N objects)
by calling `place()` in a tight loop, but only the first call succeeds.
Subsequent calls silently fail because `place()` checks a cooldown that is
only decremented in the game loop's `update()` — which hasn't run yet.

```javascript
// TowerManager.place (broken for batch ops)
place(state, idx, ...) {
  if (state.buildCooldown > 0) return false;  // ← blocks loop
  // ... place tower ...
  state.buildCooldown = 0.15;                 // ← set after first success
}

// Game._loop — cooldown is only decremented here
_towers.update(dt, state) {
  if (state.buildCooldown > 0) state.buildCooldown -= dt;
}
```

**Result:** Batch tower placement during test or during a "sell all and
rebuild" flow silently fails after one placement. The player has to wait
between clicks.

**Fix:**

Option A — remove the cooldown gate entirely if it's just anti-spam:
```javascript
place(state, idx, ...) {
  // No cooldown check — money and occupancy checks are enough
  if (!pathSet || pathSet.has(idx)) return false;
  if (state.grid[idx] !== 'empty') return false;
  // ...
}
```

Option B — make the cooldown self-resetting within the method so batch
calls work:
```javascript
place(state, idx, ...) {
  if (state.buildCooldown > 0 && this._lastPlaceFrame === frame) return false;
  this._lastPlaceFrame = frame;
  // ... place ...
}
```

**When to apply:** Any game method that both checks AND sets a cooldown
that is normally decremented in the frame loop. If you ever need to call
it multiple times synchronously (tests, batch ops, "refund all" flows),
the cooldown gate must be removed or made per-frame rather than per-call.

## Quick Reference: Common Error Messages

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `Cannot read properties of null (reading 'morphAttributes')` | Shared geometry/material not initialized | Lazy init with `if (!this._geo) this._geo = new THREE...` |
| `Cannot set properties of undefined (setting 'objects')` | Map entry not created before use | `.set()` before `.get()`, pass entry as arg |
| `Uncaught TypeError: Cannot read properties of undefined` | Event bus listener missing | Audit emits vs listeners |
| `AudioContext is not running` | Autoplay policy | Check `ctx.state === 'running'` |
| `MaxListenersExceededWarning` | Event listeners not unsubscribed on restart | Store unsubscribe funcs, call on shutdown |
| Shader silently fails | Missing geometry attributes | Verify all uniforms/attributes match |
| `Cannot read properties of undefined (reading 'prototype')` | `THREE.WebGLInfo` removed in r160+ | Guard: `if (THREE.WebGLInfo && THREE.WebGLInfo.prototype) ...` |
| Black screen, game initializes, no exceptions | DOM overlay on top of canvas | Check for fullscreen elements with solid background and high z-index (Pitfall 14) |
| Camera jumps on frame 1, wrong view | Pan target hardcoded to (0,0) instead of camera position | Read `this.camera.position` when initializing pan/controls (Pitfall 15) |
| Batch operation succeeds only once | Cooldown gate checked+set in method, decremented in loop | Remove cooldown check or make per-frame (Pitfall 16) |
| Whole grid is invisible except path | Buildable tile color too close to `scene.background` | Use brighter buildable color, collapse hit-target mesh with display mesh (Pitfall 17) |
| Spacebar / toggle crashes with stack overflow, no error message | Event emit triggers handler that calls back into emitting method | Add re-entry guard: `if (this._state === newValue) return;` before state change (Pitfall 20) |
| All enemies spawn stacked on one tile in a single frame | `while` loop drains entire spawn queue instead of `if` per frame | Change `while (timer >= interval)` to `if (timer >= interval)`, reset timer to 0 after one spawn (Pitfall 21) |
| Values diverge between constant file and hardcoded copies | Centralized constant tweaked but not all references updated | Grep for the hardcoded number; replace with constant reference; verify single source of truth (Pitfall 22) |
| Enemies randomly skipped, appear invincible; no errors | `for...of` iterates live array while `_remove()` splices from it — iterator index desyncs | Use backwards `for (let i = arr.length-1; i >= 0; i--)` when removal during iteration is possible (Pitfall 23) |
| One enemy killed spawns exponential clones that flood the map | Child entities inherit parent's ability tags including `split: true` | Override propagation-prone tags: `tags: { ...parentDef, split: false }` (Pitfall 24) |
---

## Pitfall 11: `THREE.WebGLInfo` Removed in Three.js r160+

**Problem:** Runtime crash — `Cannot read properties of undefined (reading 'prototype')` — triggered by accessing `THREE.WebGLInfo`.

**Root cause:** `WebGLInfo` was removed from the three.js public exports starting in r160. It still exists internally but is not a named export. Vite's build emits a warning (`Import WebGLInfo will always be undefined`) but **the build still succeeds** (exit code 0). The crash only manifests at runtime when the guarded code path executes.

**Symptoms:**
- Build completes with no errors, only warnings
- Game renders initially (scene loads, objects visible)
- Crash occurs on first interaction that triggers post-processing or renderer.info access
- Error: `Uncaught TypeError: Cannot read properties of undefined (reading 'prototype')` at the line accessing `THREE.WebGLInfo.prototype`

**Fix:** Always guard before accessing:
```javascript
if (THREE.WebGLInfo && THREE.WebGLInfo.prototype && THREE.WebGLInfo.prototype.reset) {
  THREE.WebGLInfo.prototype.reset.call(this, ...args);
}
```

**Prevention:** Check the three.js changelog for removed exports when upgrading versions. Search `node_modules/three/build/three.module.js` for `export {` to see what's actually exported.

---

---

## Pitfall 18: Kill Reward Formula Ignores Wave Scaling Constant

**Problem:** Mid-game waves become unkillable because kill rewards don't scale with wave number, so players can't afford to buy enough towers between waves.

**Root cause:** The reward formula uses a flat multiplier instead of scaling with wave number. A common fix is `enemy.reward * (1 + (state.wave - 1) * killWaveScale)` with `killWaveScale` around 1.5.

A `killWaveScale` constant may exist in the constants file but go unused because the formula was written before the constant was introduced, or the formula uses `state.wave` directly without the scaling factor. When waves scale linearly but rewards stay flat, by wave 10 the player can't afford to place enough towers to kill what spawns.

**Check the constants AND the implementation together:**
```bash
grep -n "killWaveScale\|killBase\|reward" src/core/Constants.js
grep -n "reward =" src/systems/EnemyManager.js
```

If `killWaveScale` is defined but the formula doesn't use it, or the formula produces rewards smaller than what the wave composition demands, the game is unwinnable past a certain wave.

**Sanity check for TD wave balance:**
1. Calculate enemies per wave at wave N: `mobsBase + mobsGrow * N`
2. Calculate total HP budget for wave N
3. Calculate total tower DPS budget affordable from cumulative rewards
4. If HP budget > DPS budget at wave X, waves beyond X are unkillable unless the player hoards aggressively

**Fix:**
- Lower `mobsBase` and `mobsGrow` so wave count grows gently
- Ensure kill-reward formula uses a wave-scaling constant
- Increase start money so the first wave is buildable
- Reduce boss HP when they appear — bosses with extreme HP pools at early waves are mathematically impossible

**When to apply:** Any wave-based game where players report "wave X is impossible." Always audit the reward formula and wave scaling constants together.

---

## Pitfall 19: Vite Build Succeeds Despite Import Errors

**Problem:** `npm run build` exits with code 0 even when there are import errors on undefined exports. The build produces a bundle that crashes at runtime.

**Root cause:** Vite treats missing exports as warnings, not errors. It substitutes `undefined` for the missing import and continues building. This is by design — Vite assumes the developer will fix warnings, but doesn't enforce it.

**Symptoms:**
- Build output shows `[IMPORT_IS_UNDEFINED]` or `"X" is not exported by "module"` warnings
- Exit code is 0
- Game/app loads but crashes on first use of the missing symbol
- Console shows `TypeError: Cannot read properties of undefined`

**Fix:** Always scan build output for warning patterns, don't just check exit code:
```bash
npm run build 2>&1 | grep -iE 'warning|undefined|not exported'
```

Or add a CI check:
```bash
BUILD_OUTPUT=$(npm run build 2>&1)
echo "$BUILD_OUTPUT" | grep -qiE 'is not exported by|IMPORT_IS_UNDEFINED' && { echo "Build has import warnings"; exit 1; }
```

**When to apply:** Any Vite/ESM project where third-party library upgrades may remove exports. Always inspect full build output, not just the exit code.

---

## Pitfall 13: Ground Tiles Invisible Against Scene Background

**Problem:** The three.js scene renders correctly (no exceptions, scene has children) but the player sees only a black void. Path tiles with additive blending are visible, but buildable tiles blend into the dark background.

**Root cause:** Tile color `0x0b1020` is only slightly lighter than scene background `#05060d`. The vertex-colored grid mesh has `opacity: 0.92` but the base colors are too dark to distinguish.

```javascript
// Scene background
scene.background = new THREE.Color(0x05060d);

// Buildable tile color — too dark!
const buildColor = new THREE.Color(0x0b1020);  // barely visible against 0x05060d
```

**Symptoms:**
- Console shows init logs, no exceptions
- `window._psGame` exists, scene has children
- Path is visible (glowing overlay) but rest of canvas is solid black/dark
- User reports "background is entirely black" or "can't see where to build"

**Fix:** Make buildable tiles noticeably brighter than the background:
```javascript
const buildColor = new THREE.Color(0x253050);  // visible dark blue against 0x05060d
```

**When to apply:** Any Three.js grid/tile system on a dark background. Test by temporarily setting background to `new THREE.Color(0x000000)` to verify contrast.

---

## Pitfall 14: DOM Overlay Covers Entire Canvas

**Problem:** Game renders correctly but user sees a black screen with only UI elements visible. The canvas is hidden behind a full-screen overlay element.

**Root cause:** Diagnostic overlays, loading screens, or HUD containers with `position:fixed;inset:0;z-index:99` and solid backgrounds. Even with `pointer-events:none`, the background visually blocks the canvas.

```javascript
// In main.js — imports a diagnostic overlay
import './game-diagnostic.js';  // creates <pre> with background:#05060d;z-index:99
```

**Symptoms:**
- Console shows init logs, no exceptions
- `window._psGame` exists, scene has children
- Player reports "black screen" with only UI buttons visible
- Game loop is running (enemies move, towers fire) but nothing visible

**Fix:** Remove the overlay import or change its style:
```css
#ps-diag {
  background: transparent !important;  /* or remove entirely */
  z-index: 0 !important;
}
```

**When to apply:** Any "black screen" where the 3D scene initializes but nothing is visible. Check DOM overlays before debugging the Three.js pipeline.

---

## Pitfall 15: Camera Position Mismatch in Input System

**Problem:** Camera starts at correct position but immediately jumps to wrong angle on frame 1.

**Root cause:** `InputSystem._pan` initializes to `(0,0)` instead of reading from `camera.position`:

```javascript
// Wrong — hardcoded to origin
this._pan = { x: 0, z: 0, y: this.camera.position.y };

// Camera is actually at (-4, 22, 28) from RenderSystem
// Frame 1 lerps camera toward (0, 22, 0) instead of staying at (-4, 22, 28)
```

**Symptoms:**
- Game loads but view is wrong
- Camera swings immediately without user input
- Grid is in view but from bad angle
- `lookAt` target is correct but camera position is wrong

**Fix:** Initialize pan target from actual camera position:
```javascript
this._pan = { 
  x: this.camera.position.x, 
  z: this.camera.position.z, 
  y: this.camera.position.y 
};
```

**When to apply:** Any camera update system (input, orbit controls, lerp-based follow) instantiated after render system. Always read from `camera.position` instead of hardcoding.

---

## Pitfall 13: Headless CDP Testing When Browser Tools Are Unavailable

**Problem:** You need to test a Three.js/Vite game at runtime — verify the
game loop fires, towers/projectiles/enemies interact, UI clicks work — but
`browser_navigate()` / `browser_vision()` are unavailable (stale CDP endpoint,
no vision model, the user said "don't use browser use", or the tools fail to
connect). Static `node --check` only catches syntax errors; it cannot catch a
path-generation bug that produces a 424-tile path with 163 discontinuities.

**Root cause:** Hermes browser tools require a working CDP endpoint, and when
they fail the whole runtime-verification path appears blocked. But a plain
headless Chromium + a tiny Node script using the **built-in `WebSocket`**
(Node 22+) can drive the page directly via CDP — no `puppeteer`, no `ws`
package, no Hermes browser tool needed.

**The harness** (see `scripts/cdp-game-test.mjs` for a copy-and-edit template):

```bash
# 1. Launch headless Chromium with remote debugging (background terminal)
chromium-browser --headless=new --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 --no-sandbox \
  --disable-gpu --disable-dev-shm-usage --window-size=1280,800 about:blank
```

```javascript
// 2. Node script — attach to the PAGE target, not the browser target
import http from 'http';
const list = await getJSON('http://127.0.0.1:9222/json/list'); // NOT /json/version
const page = list.find(t => t.type === 'page');                // ← page, not browser
const ws = new WebSocket(page.webSocketDebuggerUrl);
// send CDP commands: Runtime.enable, Page.enable, Network.enable,
// Page.navigate, Runtime.evaluate
```

**Three gotchas that cost real time this session:**

1. **Attach to the PAGE target from `/json/list`, NOT the browser target from
   `/json/version`.** The browser-level `webSocketDebuggerUrl` accepts
   `Runtime.enable` silently but `Runtime.evaluate` returns `undefined` with
   zero error. You will stare at "EVAL: undefined" for an entire iteration.
   Fix: `GET /json/list` → find `{type:'page'}` → use ITS
   `webSocketDebuggerUrl`.

2. **Vite dev server may land on a non-default port.** If 5173 is busy, Vite
   increments (5174, 5175, 5176...). Read the `npm run dev` output — the
   "Local: http://localhost:5176/" line is authoritative. Hardcoding 5173 when
   the server is actually on 5176 gives HTTP 000 and `window._psGame` is
   `undefined` with NO console errors (you connected to a dead page).

3. **Wrap `Runtime.evaluate` expressions in try/catch + `returnByValue:true`.**
   Without the wrapper, an exception inside the game returns `{result:{}}`
   (opaque `undefined`), and you can't tell a real `undefined` from a thrown
   error. Pattern:
   ```javascript
   await send('Runtime.evaluate', { expression:
     `(() => { try { return JSON.stringify({game: typeof window._psGame}); }
              catch(e) { return 'CAUGHT: '+e.message; } })()`,
     returnByValue: true });
   ```

**Driving the game without waiting on real time:** You can call internal game
methods directly via `Runtime.evaluate` to simulate N seconds of gameplay in
milliseconds — no `setTimeout` chains:
```javascript
// Simulate 15s of the game loop in one eval:
`for (let i=0;i<150;i++) {
   const dt=0.1; const g=window._psGame; const st=g._gs.state;
   g._towers.update(dt,st); g._towerFire(dt,st);
   g._enemies.update(dt,st,g._pathSystem,g._towers.towers);
   g._projectiles.update(dt,g._enemies,st);
   g._collisions.update(dt,st,g._projectiles,g._enemies,g._towers,g._particles);
   g._particles.update(dt);
 }`
```
This is how you verify "towers actually fire and kill enemies" in a test
rather than eyeballing a screenshot.

**When to apply:** Any browser-game debugging session where Hermes browser
tools are unavailable or you need deterministic, scriptable runtime control
(specific click coordinates, internal-method calls, N-second simulations)
that a vision-model screenshot cannot provide. The same harness works for any
Vite/ESM web app, not just Three.js games.

---

## Pitfall 14: DOM Overlays Obscuring the Canvas (Black Screen)

**Problem:** Game loads and initializes (console shows "GAME_INIT", scene has
children) but the user sees a completely black screen. The canvas renders
correctly behind the scenes, but a DOM element sits on top of it.

**Root cause:** Diagnostic overlays, loading spinners, or HUD containers
positioned with `position:fixed;inset:0;z-index:99` and a solid
`background` color. Even with `pointer-events:none`, the background
visually blocks the canvas underneath.

In this session a `<pre id="ps-diag">` diagnostic element imported via
`import './game-diagnostic.js'` had `background:#05060d;z-index:99` —
exactly the same color as the scene background, making it look like the
scene itself was black.

**Symptoms:**
- Console shows init logs, no exceptions
- `window._psGame` exists, scene has children
- Player says "black screen" even though game loop is running
- Hard to diagnose via runtime alone — need to inspect DOM overlay state
  (via CDP: check `document.getElementById('ps-diag')` or
  `getComputedStyle(canvas).zIndex`)

**Fix:** Remove the overlay import if it's not needed, or change its style:
```css
#ps-diag {
  background: transparent !important;
  z-index: 0 !important; /* behind the canvas */
  pointer-events: none;
}
```

**When to apply:** Any "black screen" report where the 3D scene
initializes but nothing is visible. Check DOM overlays before debugging
the Three.js pipeline.

---

## Pitfall 15: Camera Position Desync Between Init and Update Systems

**Problem:** The camera is positioned correctly during scene setup (e.g. at
`(-4, 22, 28)` looking at the grid center), but an input/update system
lerps it to a different position starting from `(0, 22, 0)` on frame 1.
The camera swings to an unintended angle, potentially pointing at empty
space.

**Root cause:** Two systems independently compute the camera position from
different starting assumptions. `RenderSystem` sets the camera to
`(GRID_COLS/2 + isoX, isoY, GRID_ROWS/2 + isoZ)`. `InputSystem` starts its
pan target at `{x:0, z:0, y:camera.position.y}` — hardcoded `0` for x/z
instead of reading from the camera's actual position.

```javascript
// Wrong — pan starts at (0, 22, 0), camera is at (-4, 22, 28):
this._pan = { x: 0, z: 0, y: this.camera.position.y, ... };

// Right — pan starts where the camera actually is:
this._pan = { x: this.camera.position.x, z: this.camera.position.z,
              y: this.camera.position.y, ... };
```

**Symptoms:**
- Game loads but the view looks wrong or shows empty space
- Camera drifts immediately on frame 1 without user input
- `lookAt` target is correct, so the grid IS in view, but from a bad angle

**When to apply:** Any time a camera update system (input, orbit controls,
lerp-based follow) is instantiated after the render system and needs to
preserve the initial camera position. Always read from `this.camera.position`
rather than hardcoding coordinates.

---

## Pitfall 17: Ground Tiles Invisible Against Scene Background

**Problem:** The three.js scene renders but the player reports seeing "only
a black void plus the path." Buildable tiles where the player should place
towers are invisible. The canvas IS rendering correctly — geometry exists
and is hit by raycasters — but the tiles blend into the darkness.

**Root cause:** The ground tile color is too close to `scene.background`.
A common choice like `0x0b1020` differs from `#05060d` by only a few
luminance steps. On a laptop screen or in a browser with default contrast,
the tiles are indistinguishable from the backdrop. The path tiles glow
brightly (additive blending) so they show, but the vast buildable area
looks empty. Player doesn't know where to click to build towers.

```javascript
// Scene background
scene.background = new THREE.Color(0x05060d);

// Buildable tile color — too dark:
const buildColor = new THREE.Color(0x0b1020);  // ← barely visible

// Ground overlay opacity also too low:
const mat = new THREE.MeshBasicMaterial({ opacity: 0.92, ... });
// Even at 0.92 opacity, the vertex color itself is nearly black.
```

**Fix:** Make the buildable tile color noticeably lighter than the
scene background — a delta of at least 60-80 in each RGB channel:

```javascript
const buildColor = new THREE.Color(0x253050);  // visible dark blue against #05060d
const dimPathColor = new THREE.Color(COLORS.pathGlow).multiplyScalar(0.5);
```

If the user still complains it's too dark, go even brighter
(`0x2d3860`) or add a subtle grid line pattern on top.

**Accompanying fix — hover highlight for tile placement:**
Making tiles visible is necessary but often not sufficient. Players
still don't know where they can actually build. Add a hover mesh that
highlights buildable (green) vs. invalid (red) tiles under the cursor:

```javascript
// In a GameplaySystem that runs every frame via mousemove + raycasting:
_handleHover(e) {
  if (!this._buildPending) return this._clearHover();
  const hit = raycaster.intersectObject(groundPlane)[0];
  if (!hit) return;
  const tile = this.pathSystem.tileFromWorld(hit.point.x, hit.point.z);
  if (!tile) return;
  const buildable = !state.path.has(tile.idx)
    && state.grid[tile.idx] === 'empty'
    && state.money >= TOWER_DEFS[this._selectedType].cost;
  this._showHover(tile, buildable ? 0x22ff88 : 0xff4444);
}
```

Add a subtle `Math.sin(performance.now()/1000*4)*0.02` pulse on the hover
mesh's Y position so it feels alive. Also have right-click cancel the
pending build and clear the hover mesh.

**Secondary issue: raycaster hit target.** The old code kept a separate
invisible `_groundPlane` mesh solely for raycasting:
```javascript
// Old pattern — two meshes, one visible, one for raycast hit
this._groundPlane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
this._groundPlane.rotation.x = -Math.PI / 2;
// then another visible tilesMesh on top...
```
This worked (raycaster hits invisible meshes in Three.js), but if you
ever drop the invisible mesh, raycaster clicks fail silently because there
is no geometry at tile-z to intersect. Collapse both into ONE visible
vertex-colored grid that serves as both the display and the raycast target:

```javascript
this._groundGrid = new THREE.Mesh(gridGeo, gridMat); // vertex-colored
this.scene.add(this._groundGrid);
get groundPlane() { return this._groundGrid; } // reuse for raycaster
```

**Symptoms:**
- Game renders correctly (scene children > 0, no exceptions)
- Path is visible (glowing overlay) but rest of canvas is solid black/dark
- Raycaster click placement works when clicking near the path because
  the ground mesh IS there — player just can't see where to click
- User asks "is it supposed to look like this?", "background is entirely black"

**When to apply:** Any Three.js ground-plane / tile-grid rendering where
the scene background color is dark and the ground color is even darker.
Always preview your palette choice on an actual sRGB monitor, and if in
doubt, make the buildable area 20-30% brighter than the background.

**Related:** See also Pitfall 14 (black screen) — if the fix to Pitfall 17
makes tiles *visible* but the user still reports "nothing to look at", the
issue may have been Pitfall 14 (overlay on top). Both pitfalls can coexist:
invisible tiles AND an overlay, in which case you fix the overlay first to
expose the underlying (still-invisible) tiles, then apply Pitfall 17.

---

## Pitfall 20: Event Bus Self-Triggered Infinite Recursion

**Problem:** Pressing spacebar to toggle pause crashes with a stack overflow —
no visible error in console, no exception message, just a hard crash. The
game's `_setPaused()` method emits the event that its own init handler
listens for, and the handler calls `_setPaused()` again synchronously.

```javascript
// In init() — handler registered for 'game:paused':
EventBus.on('game:paused', () => this._setPaused(true));

// In _setPaused() — EMITS the same event that called it:
_setPaused(v) {
  this._paused = v;                        // state change
  this._pause.show(this._gs.state);
  EventBus.emit('game:paused');            // ← triggers handler → _setPaused(true) → emit → handler → …
}
```

**Result:** Synchronous infinite recursion. Every call to emit runs the
handler, which calls `_setPaused` again, which emits again. No stack
guard, no async break, just a runaway call stack.

**Why it's hard to spot:** The code looks correct on first read — emitting
a state-change event is standard practice, and registering handlers for
state-change events is also standard. The bug is that the *same* event
name appears on both sides of the same flow. A code reviewer sees two
separate registrations that look innocuous (handler in `init()`, emitter
in the toggle method) and doesn't notice they form a closed loop.

**Fix — add a re-entry guard at the top of the state-changing method:**

```javascript
_setPaused(v) {
  if (this._paused === v) return;  // guard: already in this state
  this._paused = v;
  this._pause.show(this._gs.state);
  EventBus.emit('game:paused');
}
```

The guard prevents the infinite recursion because the second call
(happening inside the handler) sees `this._paused` is already `true` and
returns immediately without emitting again.

**Alternative — split the event names** so the handler listens for an
external trigger (`input:pause`) while the method emits a different event
(`game:pausedChanged`) that downstream systems consume:

```javascript
// init():
EventBus.on('input:pause', () => this._setPaused(true));

// _setPaused():
EventBus.emit('game:pausedChanged');  // downstream: audio, particles, etc.
```

This decouples the trigger from the notification. The first approach
(guard) is simpler for a single site; the second is preferred when
multiple triggers can call the same state change.

**When to apply:** Any event-driven method that both (a) changes state and
(b) emits an event with the same name that a handler registered in
`init()`/constructor listens for. Audit the full call chain: init handler
→ method → emit → handler → method → emit → … . A re-entry guard on the
target state is the simplest fix.

---

## Pitfall 21: Timer-Based Queue Consumed in One Frame (while vs if)

**Problem:** A wave/spawn manager uses a `while` loop to consume a timer:
when `dt` is large or the spawn interval is short, the loop drains the
entire spawn queue in a single frame. Every enemy spawns simultaneously
on the same tile.

```javascript
// WaveManager.update — BROKEN: drains all enemies in one frame
this._spawnTimer += dt;
while (this._spawnTimer >= this._spawnInterval && this._spawnQueue.length > 0) {
  const item = this._spawnQueue.shift();
  enemies.spawnWave([item], pathSystem);
  this._spawnTimer -= this._spawnInterval;  // may stay above interval → loops again
}
```

**Result:** At wave 5 with a spawn interval of 1.25s and a queue of 3
mobs + 1 boss, all 4 enemies appear on the start tile simultaneously.
The staggered-spawn mechanic is completely bypassed. Player sees a
pile of enemies on one square, and wave pacing feels broken.

**Fix — use `if` instead of `while` to spawn at most ONE enemy per frame:**

```javascript
this._spawnTimer += dt;
if (this._spawnTimer >= this._spawnInterval && this._spawnQueue.length > 0) {
  const item = this._spawnQueue.shift();
  enemies.spawnWave([item], pathSystem);
  this._spawnTimer = 0;  // reset fully — next enemy spawns after full interval
}
```

Key differences:
- `while` → `if`: only one iteration per call to `update()`
- `this._spawnTimer -= this._spawnInterval` → `this._spawnTimer = 0`: always
  resets to zero so the next spawn gets the full interval. The old approach
  of subtracting meant that if the timer was at 2.5 and the interval was
  1.25, the timer became 0.0 after two loops — but those two enemies still
  spawned in the same frame.
- `this._spawnTimer = 0` also handles the case where `dt` is very large
  (e.g. tab was backgrounded and a 30-second catch-up fires) — only one
  enemy appears rather than the entire wave.

**When to apply:** Any game system with a queue + timer pattern: wave
spawners, projectile cooldowns that queue shots, particle burst systems,
dialog sequencers. The `while` pattern is correct for *processing* all
available work (event dispatch, network message handling) but wrong for
*time-gated spawning* where the point is to stagger items across multiple
frames.

---

## Pitfall 22: Centralized Constants Diverging from Hardcoded Values

**Problem:** A centralized constants file defines `BUDGET.sellBackRatio = 0.7`,
but two call sites (`TowerManager.sell()` and `GameplaySystem._handleRightClick()`)
both hardcode `0.6`. The constant was updated (likely during a balance pass) but
the hardcoded copies were not — the game silently uses a stale value everywhere.

```javascript
// Constants.js — one source of truth
BUDGET.sellBackRatio = 0.7;

// TowerManager.js — STALE, never updated:
const refund = Math.floor(t.totalInvested * 0.6);  // ← should be BUDGET.sellBackRatio

// GameplaySystem.js — same stale value:
{ label: 'Sell (+$' + Math.floor(t.totalInvested*0.6) + ')', ... }
```

**Why it's hard to catch:** No error is thrown — the code runs fine, just with
wrong math. Linters can't catch it because `0.6` is a valid numeric literal.
The player sees a smaller refund than what the constants file advertises
and doesn't know why.

**Root cause pattern:** A centralized configuration file (`Constants.js`,
`config.js`, `gameSettings.ts`) is the declared single source of truth, but
two or more files independently reference a hardcoded numeric/string value
instead of importing the constant. When the constant is later adjusted
(e.g. sellBackRatio changed from 0.6 to 0.7 during balance tuning), only the
definition changes — the scattered hardcoded copies silently diverge.

**Audit technique:**

```bash
# Find every file that references the hardcoded value
grep -rn "0\.6" src/ --include='*.js'

# Cross-reference: does Constants.js define a matching constant?
grep -n "sellBackRatio\|refund\|0\.6\|0\.7" src/core/Constants.js
```

**Fix:**

1. Import the constant where it's used:
```javascript
import { BUDGET } from '../core/Constants.js';
```

2. Replace ALL hardcoded copies with the import:
```javascript
const refund = Math.floor(t.totalInvested * BUDGET.sellBackRatio);
```

3. If the constant doesn't exist yet, CREATE it in the constants file first,
then reference it everywhere. Never keep the numeric literal as a fallback.

**Prevention — when adding a new tunable value:**
- Add it to the constants file FIRST as a named export.
- Immediately grep for any existing hardcoded version and replace all with the import.
- If a UI label also displays the value (e.g. tooltip showing refund amount),
  compute from the constant, not a separate string.

**When to apply:** Any game where gameplay constants (damage, cost, ratio,
cooldown, speed) exist in a centralized file. After ANY balance pass that
changes a constant, audit every file that touches that domain to confirm
the import is used everywhere.

---

## Pitfall 23: `for...of` Array Mutation During Iteration

**Problem:** Enemies are randomly skipped in the update loop, appearing
invincible or frozen. No errors in the console. The symptom is
intermittent — some enemies work fine, others get "stuck."

**Root cause:** `EnemyManager.update` was refactored from a backwards
`for` loop to a `for...of` loop. When an enemy reaches the end of the
path, `leak()` calls `_remove()` which splices from `this.enemies`.
The `for...of` iterator's internal index desyncs from the now-modified
array, causing one enemy to be silently skipped.

```javascript
// BROKEN — for...of + splice during iteration skips items:
for (const enemy of this.enemies) {
  if (enemy.dead) continue;
  // ... move enemy, may call leak() which calls _remove():
  if (idx >= path.length) this.leak(enemy, state);  // splices from this.enemies!
}
```

When `_remove()` splices at index 3, the element at index 4 slides into
index 3, but the iterator has already advanced past index 3 — so the
element that was at index 4 is never processed.

**Why it's hard to spot:** The same loop works fine most of the time
because `leak()` is rare. The bug only manifests when an enemy actually
reaches the end of the path, which might be wave 5 or later. At that
point, the skipped enemy is still in the array with `dead: false` but
its movement code never runs again — it appears "frozen" or "invincible."

**Fix — use backwards iteration when removal is possible:**

```javascript
// Correct — backwards for loop, safe for splice during iteration:
for (let i = this.enemies.length - 1; i >= 0; i--) {
  const enemy = this.enemies[i];
  if (enemy.dead) continue;
  // ... move enemy, may call leak() which splices from this.enemies:
  if (idx >= path.length) this.leak(enemy, state);  // safe: i-- after splice
}
```

Backwards iteration is safe because:
- Removing at index 3 shifts elements 4+ down, but we've already processed
  them (since we're going backwards from end to start).
- Even if the removed element isn't at the current index, the remaining
  indices at lower positions are unaffected.

**Also applies to these patterns:**
- `forEach` + splice: same problem as `for...of`, iterator skips
- `for (let i = 0; i < arr.length; i++)` + splice: index 0 is fine but
  may skip elements shifted into the current index
- `for...of` + `Set.delete()` — not a problem because Set iteration
  handles deletion differently

**When to apply:** Any loop that iterates a live array where elements
can be removed by code inside the loop body. When in doubt, use
`for (let i = arr.length - 1; i >= 0; i--)`. Only use `for...of` when
you're certain the array won't be modified during iteration.

---

## Pitfall 24: Enemy Child Propagation — Abilities Inherited by Clones

**Problem:** One enemy is killed and spawns children, but the children inherit
the parent's ability tags via `{ ...def }` spread — including `split: true`.
When children are killed, they spawn more children, which spawn more children,
creating an exponential chain. In a tower-defense game this manifests as a
single Splitter turning into an unstoppable flood of 1.1× speed clones that
overrun the map.

**Root cause:** The child creation code copies ALL properties from the
enemy definition without thinking about which properties should NOT propagate:

```javascript
// Broken — copies every tag including split:
const child = {
  id: this._nextId++,
  defIdx: enemy.defIdx,       // same type as parent
  hp: def.hp * 0.6,
  tags: { ...def },            // ← spread copies split, armor, shieldPercent, etc.
  // ...
};
```

If `def` (ENEMY_DEFS[4]) has `split: true`, every child gets it, and the chain
never ends.

**Why it's hard to spot:** It works correctly for all other abilities — armor,
speed, shieldPercent — which SHOULD propagate. Only `split` specifically
causes runaway behavior because it's a multiplicative effect. A code reviewer
sees the spread and thinks \"children should inherit parent traits,\" which is
intuitive — but `split` creates new entities, making it uniquely dangerous.

**Fix — explicitly override propagation-prone tags on children:**

```javascript
const child = {
  id: this._nextId++,
  defIdx: enemy.defIdx,
  hp: def.hp * 0.6,
  tags: { ...def, split: false },  // ← children don't split again
};
```

**Audit check:** Search for every `{ ...enemyDef }` or `{ ...def }` spread
in entity-spawning code and verify that any ability which creates new
entities (split, spawn, duplicate, clone) is explicitly overridden to `false`
on children. Common offenders: `split`, `spawnsMobs`, `duplicate`.

**When to apply:** Any game where killed enemies spawn children or where
entities can create other entities. Always assume the worst case for
propagation — does this ability make more entities? If yes, override it on
children.

---

## Pitfall 25: Exponential Fog Extinguishes Distant Background Objects

**Problem:** A starfield or distant background is completely invisible even though the points/geometry exist in the scene and the camera far-plane is large enough. The scene looks empty and black. No errors in console.

**Root cause:** `THREE.FogExp2` with even moderate density makes objects at distance invisible. The attenuation formula is `exp(-density × distance²)`, so visibility drops quadratically with distance:

```javascript
// This looks reasonable but kills everything past ~50 units:
scene.fog = new THREE.FogExp2(0x05060d, 0.003);

// At distance 30: exp(-0.003 × 900) = 0.067  → barely visible
// At distance 50: exp(-0.003 × 2500) = 0.0005 → invisible
// At distance 100: effectively zero
```

If stars are positioned at radii 100–500, they are completely extinguished. The game renders a black void.

**Fix — use a MUCH lower density for deep-space backgrounds:**

```javascript
scene.fog = new THREE.FogExp2(0x05060d, 0.00008);
// At distance 300: still faintly visible
// At distance 500: naturally gone
```

**Rule of thumb:** `density ≈ 2 / maxVisibleDistance²`. For 300 units: 2/90000 ≈ 0.00002. Use 3–4× that for gradual fade.

**Alternative — linear fog:**
```javascript
scene.fog = new THREE.Fog(0x05060d, 200, 500);
```

**Secondary fix — `sizeAttenuation` for star points:**
`THREE.PointsMaterial` with `sizeAttenuation: true` shrinks points at distance. For starfield backgrounds use `sizeAttenuation: false` with pixel-sized points (1.5–2.5).

**Symptoms:** stars exist in scene · no console errors · camera far is adequate · background appears empty · removing fog fixes it.
