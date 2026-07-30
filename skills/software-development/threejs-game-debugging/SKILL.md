---
name: threejs-game-debugging
description: Debugging patterns, silent failures, and troubleshooting techniques for Three.js browser games (Vite, Webpack, or raw HTML). Use when Three.js games exhibit silent failures — features that never trigger, visual effects that don't work, memory leaks on restart, shader issues, or event mismatches.
triggers:
  - "threejs game debugging"
  - "threejs silent failure"
  - "webgl game broken"
  - "threejs memory leak restart"
  - "threejs shader not working"
  - "threejs game event mismatch"
  - "main.js wiring"
  - "tooltip menu crash"
  - "launcher port conflict"
---
# Three.js Game Debugging

> **Which debugging skill to use?** This skill (`threejs-game-debugging`) covers gameplay-specific silent failures — events not firing, HUD stuck, systems not triggering, wiring corruption. For general Three.js runtime failures (crashes, null refs, WebGL errors, build issues), use the companion `threejs-debugging` skill instead.

## Core Debugging Checklist

When a Three.js browser game has issues, run through these in order:

### 1. Missing Import Files (Total Load Failure)
**Symptom**: Game won't load at all — blank screen, no console output, or immediate crash on module import.
**Cause**: A `.js` file is imported but doesn't exist on disk. ES modules fail hard on missing imports with no graceful fallback.
**Fix**: Before anything else, verify every `import` has a corresponding file:
```bash
# List all imports from main entry point
grep -rn "^import" src/main.js | grep "from" | sed "s/.*from ['\"]\(.*\)['\"].*/\1/" | while read f; do
  if [ ! -f "src/$f" ]; then echo "MISSING: $f"; fi
done

# Or more aggressively — check all imports across the project
grep -rh "^import.*from" src/ | grep -oE "'([^']+)'|\"([^\"]+)\"" | tr -d "'\"" | sort -u | while read f; do
  if [ ! -f "src/$f" ]; then echo "MISSING: $f"; fi
done
```

### 2. main.js Wiring Corruption (EventBus / UI / Overlay Instantiation)

**Symptom**: Browser console shows fatal errors in `TooltipMenu.bind`, `PauseOverlay`, `ContextMenuSystem`, or duplicate `const` declaration syntax errors.

**Cause**: `main.js` was partially edited across turns. Typical corruption patterns:
- same `const` declared twice (syntax error).
- overlay/tooltip instantiated before the managers it depends on exist.
- a later edit wipes out an earlier correct block (`ParticleSystem`, `Game`, exported globals, `setParticleSystem`, `setAudioSystem`) without restoring it.

**Fix before browser retry**:
1. Read the full `main.js` once and look for duplicate declarations and out-of-order `const` chains.
2. Restore this instantiation order:
   - primitive systems first (`state`, `bus`, `input`, `audio`, `render`, `ui`)
   - managers next (`pathSystem`, `enemyManager`, `waveManager`, `economy`, `towerManager`)
   - overlay/UI consumers last (`pause`, `hud`, `context`), with managers passed in
3. Re-add any missing post-init wiring: `ParticleSystem`, `Game`, exported globals, `setParticleSystem`, `setAudioSystem`.
4. Match constructor signatures exactly. If `TooltipMenu` requires `(root, bus, state, camera, towerManager, enemyManager)`, every `new TooltipMenu(...)` must pass them.

**Tower-defense specific**:
- `PauseOverlay` now requires `towerManager` and `enemyManager` so pause stats read `towerManager.towers.size` and `enemyManager.activeEnemies.length` directly.
- `TooltipMenu` requires `(document, bus)`; never call it with no arguments.

### 3. HTML Routing Mismatch (Vite Projects)
**Symptom**: Game loads the launcher/welcome page instead of the actual game canvas, or URL redirects to a non-existent route.
**Cause**: Launcher and game pages swapped between `public/` and project root. Vite serves from `public/`, so `/index.html` resolves to whatever is in `public/index.html`. If the game HTML lives at project root, it's unreachable via normal routing.
**Fix**: 
- All HTML entry points must live in `public/`.
- Launcher redirects should point to the actual game file (e.g., `/game.html`), not `/index.html`.
- `vite.config.js` `server.open` and `preview.open` should match the game page path.
```bash
# Verify routing consistency
grep -rn "window.location.href\|location\.href" public/ src/ | grep -i "html"
cat vite.config.js | grep -A2 "open:"
ls public/*.html  # all entry points should be here
```

### 4. Double Emission (EventBus + Direct Call)
**Symptom**: Effects fire twice — explosions play sound AND call `audio.playExplosion()` directly; score awards points from both `EventBus.emit('weapon:destroy')` listener and direct `score.awardDestruction()` call.
**Cause**: Game loop calls both the event system AND direct method calls for the same logical action, creating duplicate side effects.
**Fix**: Pick one path — either emit an event (and let subscribers handle it) OR call the method directly. Never do both:
```js
// WRONG — triggers explosion sound twice
EventBus.emit('audio:explosion', size);
this.audio.playExplosion(size);

// CORRECT — single path
EventBus.emit('audio:explosion', size);
// (AudioSystem listens to 'audio:explosion' and calls playExplosion internally)
```

### 5. Scene Disposal Memory Leak
**Symptom**: After 2-3 restarts, FPS drops, browser tab crashes.
**Cause**: `_disposeScene()` manually traverses and removes objects but may miss geometries/materials on complex scenes, or doesn't properly clean up all references.
**Fix**: Use `scene.clear()` after disposing geometries/materials:
```js
_disposeScene() {
  // Dispose all geometries and materials in scene
  this.scene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  this.scene.clear();
}
```

### 6. Event Mismatches (Most Common Silent Failure)
**Symptom**: Game "runs" but specific features never trigger — HUD never updates, explosions have no sound, game over screen never shows.
**Cause**: `EventBus.emit()` is called without a corresponding `EventBus.on()` listener, or event names don't match exactly.
**Fix**: 
```bash
# Verify all events have both emit and on
grep -rn "EventBus\.emit" src/ | sort > /tmp/emits.txt
grep -rn "EventBus\.on" src/ | sort > /tmp/listens.txt
diff /tmp/emits.txt /tmp/listens.txt
```

### 7. Missing Constants (Second Most Common)
**Symptom**: NaN values, zero speeds, invisible objects — no error in console.
**Cause**: `.CAMERA.MIN_FOV` returns `undefined` if the key doesn't exist. No error, just NaN or 0.
**Fix**: Every referenced constant key must exist in Constants.js:
```bash
grep -rn "Constants\." src/ | grep -v "node_modules" | sort -u
```

### 8. Per-Frame Audio Spam
**Symptom**: Warning beeps firing thousands of times/sec when a condition is true.
**Cause**: No rate limiting on audio events in the game loop.
**Fix**: Add timestamp-based cooldown:
```js
_lastWarningTime = 0;
const COOLDOWN = 1.5;

playWarning() {
  if (this._ctx.currentTime - this._lastWarningTime < COOLDOWN) return;
  this._lastWarningTime = this._ctx.currentTime;
  // ... play sound
}
```

### 9. HUD Not Updating
**Symptom**: Health bar stuck at 100%, score not changing.
**Cause**: `game:tick` event not emitted every frame, or subscribers not connected.
**Fix**: Emit `game:tick` every frame in the main loop after all updates. Emit `game:restart` on restart.

### 10. Nebula/Particle Billboarding
**Symptom**: Clouds or particles render as flat planes from one angle.
**Cause**: `lookAt(camera.position)` not called on each frame.
**Fix**: Pass camera explicitly to update functions and call `mesh.lookAt(camera.position)`.

### 11. Restart Memory Leaks
**Symptom**: After 2-3 restarts, FPS drops, browser tab crashes.
**Cause**: Geometries/materials not disposed before scene clear, EventBus subscribers not cleaned up.
**Fix**: 
```js
// Before scene.clear(), dispose everything
this.scene.traverse(obj => {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => m.dispose());
    } else {
      obj.material.dispose();
    }
  }
});

// Clear all EventBus subscribers
for (const unsub of this._unsubscribers) {
  unsub();
}
this._unsubscribers = [];

this.scene.clear();
```

### 12. Shader Compatibility
**Symptom**: WebGL errors, missing effects, blank screens.
**Cause**: `texture2D()` was removed in Three.js r125+. Modern Three.js uses `texture()`.
**Fix**: 
```bash
grep -rn "texture2D" src/ | sed 's/texture2D/texture/g'
```

### 13. Delta-Time Death Spiral
**Symptom**: Switching browser tabs, then switching back — ship moves instantaneously off screen.
**Cause**: Large delta time when tab is inactive.
**Fix**: Always cap delta:
```js
const now = performance.now();
this._delta = Math.min((now - this._lastTime) / 1000, 0.1);
this._lastTime = now;
```

## Manager Wrapper vs Raw Mesh Position Access

**Symptom**: `TypeError: Cannot read properties of undefined (reading 'distanceToSquared')` on manager cleanup/spawn loops.

**Cause**: Different managers store different shapes in their Maps: one stores `{ mesh, atmo }`, another stores the raw `THREE.Mesh`. Cleanup code copied from the raw-mesh pattern reads `.position` from the wrapper object, which has no `.position`.

**Fix**: Audit the Map's stored value shape before copying distance/cleanup logic. When a map value is a wrapper, access through its documented fields instead of assuming `.position`. Add null guards for partially initialized or already removed values.

## Planet/Atmosphere Wrapper Pitfall

**Symptom**: Same fatal-tick crash as above, but only after refactoring planet storage to a wrapper.

**Fix**: Update reads to `planet.mesh.position`. Guard with `!planet?.mesh?.position` before distance checks. `_removePlanet()` must dispose both `planet.mesh` and `planet.atmo`, then delete the key.

## Distant Effects Silently Culled

**Symptom**: NPCs, shooting stars, far-world objects "don't exist" — no errors.

**Cause**: Camera far plane too short, or sprite/trail materials use default `sizeAttenuation` so at range they shrink to sub-pixel.

**Fix**: Raise far plane to cover the world spawn shell. Disable `sizeAttenuation` for gameplay-significant distant sprites/trails.

## New Entity System Lifecycle

**Symptom**: New entity works in one run, then corrupts next run; or memory grows across restarts.

**Fix**: Add explicit clear/destroy calls in restart and shutdown paths. Prefer uniform `init()`/`clearAll()`/`destroy()` on any new system.

```js
// Game orchestrator pattern
this.newSystem = new NewSystem(this.scene);
this.newSystem.init();

// restart
this.newSystem.clearAll();

// shutdown
this.newSystem.destroy();
```

## Avoid Broad Recovery Edits After a Regression

**Symptom**: After destabilizing change, follow-up edits become broad/invasive and risk clobbering stable systems.

**Fix**: After a regression, prioritize in this order:
1. restore broken shared files from VCS,
2. fix the contained bug,
3. restore affected lifecycle methods,
4. one narrow visual/behavioral tweak at most.

Do not add global shader, lighting, or post-processing changes while recovering from a regression.

## Ship Preset / UI Launch Flow

**Symptom**: Game shows selected preset UI, but `_startRun()` does not actually enter play.

**Fix**: Verify start screen mounted, `chosen >= 0`, and runtime state is populated before launch. Space or click must invoke `_startRun` and hide overlays.

## Stale Call Sites After Dead-Code Removal

**Symptom**: Fatal tick error: `this.<method> is not a function`.

**Fix**: Before patching the symptom, `grep` the symbol across `src/`. If it only exists at one call site, remove it; do not implement dead wrappers.

## Cross-System Method Binding

**Symptom**: `TypeError: Cannot read properties of undefined (reading '...')` when passing a method into another system’s update.

**Fix**: Bind at call site when crossing module boundaries:
```js
this.asteroids.update(dt, this.blackHoles.applyGravityToWorld.bind(this.blackHoles));
```

## Collidables Must Be Actual Meshes

**Symptom**: `PhysicsSystem.checkShipCollisions()` crashes with `Cannot read properties of undefined (reading 'x')` after a new entity type is added.

**Fix**: Always push a real mesh/object with `.position`, `.rotation`, and `.userData` into the collidable list. If the live entity wraps sub-meshes, push the outermost mesh.

## Vite Launcher Port Detection Under Port Conflicts

**Symptom**: `launch.sh` hardcodes port 5173, but multiple Vite dev servers already occupy nearby ports. The script opens another project's game or fails to open anything useful.

**Cause**: Vite auto-increments ports when the default is taken. Fixed port checks hit the wrong server or miss the newly started one.

**Fix**: Parse Vite's `Local:` URL from the log instead of probing fixed ports:
```bash
URL=""
for i in {1..80}; do
  URL=$(grep -Eo 'Local:\s+http://[^ ]+' /tmp/<project>-vite.log | tail -n1 | awk '{print $2}' || true)
  if [ -n "$URL" ]; then
    echo "[launcher] server is up (pid=$VITE_PID)"; break
  fi
  sleep 0.25
done
```

This works regardless of how many neighboring servers already occupy ports 5173–5177.

## Material Parameter Warnings from Missing Preset Constants

**Symptom**: `THREE.Material: parameter 'emissiveIntensity' / 'color' has value of undefined.`

**Fix**: Add local guarded defaults near construction instead of relying on every preset to define every optional key.

```js
const wingtipEmissive = S.WINGTIP_EMISSIVE == null ? 2.0 : S.WINGTIP_EMISSIVE;
const engineColor = S.ENGINE_COLOR || 0x44aaff;
```

## Boot Sequence / Pause Overlay Initialization (Tower Defense)

**Symptom**: Red console errors on page load before gameplay starts, especially in `TooltipMenu` / `PauseOverlay`.

**Fix**: In overlays that consume live systems, pass managers at construction time rather than querying them later. Keep pause summary data read from `towerManager.towers.size` and `enemyManager.activeEnemies.length` so the overlay doesn't depend on counters that may not exist on `GameState`.

## Empty-World vs Black Screen

**Symptom**: Game "looks black" after launch.

**Cause**: World state hasn't populated; `scene.children` has lights but zero gameplay objects.

**Fix**: Verify live entity counts with an in-page probe before changing draw order, camera, or shaders.

## Biome/Variety Registry Pattern

**Symptom**: Biomes feel repetitive.

**Fix**: Resolve biome from ship distance. Have each biome declare an `entities` allowlist. Convert allowlist to a `Set` and only call each subsystem's `generateChunk()` if its type is in the set.

## Chunk userData/chunkKey Lifecycle

**Symptom**: Chunk eviction leaks memory / collectibles never clear.

**Fix**: Set `mesh.userData = { isChunkObject: true, chunkKey }` on every spawned mesh. Match by this field in `clearChunk(key)`.

## Duplicate Export Recovery

**Symptom**: `Identifier 'X' has already been declared` from duplicated export block.

**Fix**: After reorganizing constants, rebuild and ensure each exported name appears exactly once.

## Ship Preset Hull Builder Reuse

**Symptom**: NPCs use generic primitives while player has detailed hulls.

**Fix**: Extract a preset-based hull builder that returns a `Group` for any preset. NPCs use hull silhouette without engine flames/lights.

## Restart/Shutdown Discipline

**Symptom**: After restart, some content never respawns, or audio/subscribers double-fire.

**Fix**: 
- Restart path: `chunkManager.clearAll()`, plus `clearAll()` on every live system, then reset `GameState` and camera.
- Shutdown path: `destroy()` on every system and remove listeners; do not leave `_unsubscribers` holding stale callbacks.

## Mouse Flight Steering Cap

**Symptom**: Mouse flight can yaw but cannot complete full circles.

**Cause**: Input stores an absolute steer value clamped to `[-1, 1]`.

**Fix**: Treat mouse input as continuous yaw/pitch rate, integrate additively each frame, and only clamp Euler angles afterward for safety.

## InstancedMesh Restart Disposal

**Symptom**: After restart, instanced meshes leak memory.

**Fix**: Dispose `InstancedMesh` during system/scene clear:
```js
if (obj.isInstancedMesh) {
  obj.geometry?.dispose();
  obj.material?.dispose();
  scene.remove(obj);
}
```

## Per-Frame GC Pressure in Hot Loops

**Symptom**: Micro-stutters under collision checks.

**Fix**: Pool/reuse math objects in constructor; mutate fields per iteration.

## Chunk/Map Ordering Bug

**Symptom**: `Uncaught TypeError: Cannot set properties of undefined` at chunk spawn.

**Fix**: Create entry → set on Map → pass to spawn. Never `.get()` before `.set()`.

## New System Registry Must Initialize From Existing World State

**Symptom**: New feature "does nothing" with no console errors.

**Fix**: Add an `init(chunkManager)` that scans current live state into the registry before gameplay starts.

## Collision Trigger Needs Explicit In-Tick Detection

**Symptom**: Feature does nothing in gameplay.

**Fix**: In `Game._tick()`, inspect entity markers from collision checks and handle effects there. Do not depend on a separate per-system proximity scan unless it runs every frame.

## UI 3D Preview Loops Require Their Own Render Loop

**Symptom**: Start menu shows blank preview canvases.

**Fix**: After building previews, start a `requestAnimationFrame` loop that calls `renderer.render()`.

## Performance Tuning Priority for Dense Three.js Scenes

**Fix**: Edit scene volume, not renderer quality:
1. Reduce per-chunk spawn counts.
2. Reduce view distance and chunk shell.
3. Reduce shared-bill sizes.
4. Reduce geometry subdivision.
5. Only after above, reduce post-processing.

## Wormhole/Teleport System Pattern

**Fix**: Dedicated `WormholeSystem` with its own registry, explicit `clearAll()`/`destroy()`, and teleport handled in the game tick with cooldown.

## Boost/Powerup Pickup Pattern

**Fix**: Keep buff state in `GameState`; expose `beginBoost()`, `isBoostActive`, `getBoostMultiplier()`. Pickups only call `beginBoost()` and play SFX/particles.

## Brightness/Intensity Leaks

**Fix**: Centralize intensity tuning. Reduce in layers: post-process → scene lights → ship lights → particles → shader terms.

## Projectile Double-Processing

**Symptom**: Two explosions per kill.

**Fix**: Track processed hits in a `Set` keyed by projectile-target pair, then replay/summary once.

## InstancedMesh Collision

**Symptom**: Shooting instanced objects does nothing.

**Fix**: Only check collisions against non-instanced meshes, or use bounding spheres.

## Quick Diagnostic Commands

```bash
# Missing imports
grep -rh "^import.*from" src/ | grep -oE "'([^']+)'|\"([^\"]+)\"" | tr -d "'\"" | sort -u | while read f; do
  if [ ! -f "src/$f" ]; then echo "MISSING: $f"; fi
done

# Event emit/on consistency
grep -rn "EventBus\.emit" src/ | sort
grep -rn "EventBus\.on" src/ | sort

# Constants checks
grep -rn "Constants\." src/ | grep -v "node_modules" | sort -u

# Deprecated shader APIs
grep -rn "texture2D" src/

# Dispose-call presence
grep -rn "\.dispose()" src/

# HUD heartbeat
grep -rn "game:tick" src/

# Scene additions
grep -rn "scene\.add" src/

# HTML routing
grep -rn "window.location.href\|location\.href" public/ src/ | grep -i "html"
cat vite.config.js | grep -A2 "open:"
ls public/*.html
```

## Shared Resource Init Ordering (Lazy Init)

Also see: `references/init-order-traps.md`

**Symptom**: `Uncaught TypeError: Cannot read properties of null (reading ...)` during Three.js construction.

**Cause**: System A's `init()` calls System B's method before System B's shared resources exist.

**Fix**: Lazy-init in first-use, or pass resources as constructor parameters, or enforce strict init order.

## Registry Initialization From Existing World State

Also see: `references/space-flight game-launch-flow.md`

**Symptom**: New feature "does nothing".

**Fix**: Add an `init(chunkManager)` that seeds the registry from already-spawned live state before gameplay starts.

## True 3D Chunk Management

**Symptom**: Infinite world only populates along X/Z.

**Fix**: Key chunks with `(cx, cy, cz)` as a signed triple, seed all 3 axes, and cleanup across all axes.

## 3rd-Person Look Target for Elevated Framing

**Symptom**: Ship appears CENTERED instead of lower-third, or HUD looks wrong.

**Fix**: Compute a below-and-behind offset from ship quaternion once per frame; do not lerp it back toward ship position.

## Mouse Flight Steering Cap

**Symptom**: Mouse yaw feels capped.

**Fix**: Integrate mouse input additively as continuous rate. Clamp only Euler angles afterward.

## Distant Effects Silently Culled

**Symptom**: Far entities don't render.

**Fix**: Raise camera far plane and disable `sizeAttenuation` for gameplay-critical distant sprites/trails.

## New Entity System Lifecycle

**Symptom**: Works once, then corrupts on restart.

**Fix**: Add explicit `clearAll()`/`destroy()` paths, plus orchestrator wiring in init/restart/shutdown.

## Collidables Must Be Actual Meshes

**Symptom**: Collision crashes after new entity type.

**Fix**: Only push real meshes with `.position`/`.rotation`/`.userData` into collidables.

## Group-Based NPC Hull Disposal

**Symptom**: Prune crashes on Group-based NPCShipManager.

**Fix**: Traverse children for disposal; check arrays before calling `.dispose()`.

## Ship Preset Hull Builder Reuse

**Symptom**: NPC visual identity breaks.

**Fix**: Return a `Group` for any preset shape. NPCs omit extra effects.

## Common File Structure for Games

```
src/
├── main.js                    # Entry point — creates Game instance
├── core/
│   ├── Game.js                # Orchestrator — init, loop, shutdown, restart
│   ├── EventBus.js            # Singleton pub/sub
│   ├── GameState.js           # Centralized state singleton
│   └── Constants.js           # All magic numbers
├── systems/
│   ├── InputSystem.js         # Keyboard + mouse
│   ├── CameraSystem.js        # Follow cam
│   ├── PhysicsSystem.js       # Collision detection
│   ├── AudioSystem.js         # Web Audio API wrapper
│   ├── ParticleSystem.js      # Pool-based particles
│   └── PostProcessingSystem.js
├── gameplay/
│   ├── PlayerShip.js          # Ship mesh, movement
│   ├── WeaponSystem.js        # Lasers, projectiles
│   ├── ScoreSystem.js         # Score, distance
│   └── BuffSystem.js          # Time-based stat modifiers
├── level/
│   ├── Starfield.js           # Multi-layer parallax
│   ├── NebulaSystem.js        # Volumetric clouds
│   ├── AsteroidField.js       # Instanced asteroids
│   ├── DebrisSystem.js       # Floating debris
│   ├── ChunkManager.js        # Infinite world chunks
│   └── BiomeGenerator.js      # Biome variant selection
├── ui/
│   ├── HUD.js                 # Overlay HUD
│   └── Crosshair.js           # Reticle
└── utils/
    ├── MathHelpers.js         # Vector pooling
    └── ShaderHelpers.js       # GLSL shader templates
```