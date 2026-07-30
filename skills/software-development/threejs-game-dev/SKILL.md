---
name: threejs-game-dev
description: >
  Patterns, pitfalls, and workflows for building browser-based 3D games with Three.js + Vite.
  Covers project structure, game loop architecture, post-processing pipelines, InstancedMesh performance,
  procedural audio, and the most common Three.js runtime pitfalls. Use when building or debugging
  a Three.js game, not for general Three.js demos or static 3D scenes.
triggers:
  - "threejs game"
  - "three.js game"
  - "3d browser game"
  - "webgl game"
  - "threejs post-processing"
  - "InstancedMesh"
  - "Three.js game loop"
  - "EffectComposer"
  - "ShaderPass"
---

# Three.js Game Development

Building production-quality 3D games in the browser with Three.js + Vite.

## 0. When NOT to use this skill

This skill covers 3D space/ship/flying games. For **2D-in-3D platformers and
metroidvanias** (room-based worlds, AABB collision on a 2D gameplay plane,
orthographic camera, player state machines, ability gating, boss phases),
load `threejs-2d-platformer` instead — it has the genre-specific patterns
this skill does not cover.

---

## 1. Project Structure

```
project/
├── public/
│   └── index.html          ← Game canvas + HUD overlay (no game logic)
├── src/
│   ├── core/
│   │   ├── Constants.js    ← All magic numbers, colors, timings
│   │   ├── EventBus.js     ← Singleton pub/sub (domain:action events)
│   │   ├── GameState.js    ← Centralized state singleton
│   │   └── Game.js         ← Orchestrator: init, loop, restart, shutdown
│   ├── systems/
│   │   ├── InputSystem.js
│   │   ├── CameraSystem.js
│   │   ├── PhysicsSystem.js
│   │   ├── AudioSystem.js
│   │   ├── ParticleSystem.js
│   │   └── PostProcessingSystem.js
│   ├── gameplay/
│   │   ├── PlayerShip.js / Player.js
│   │   ├── WeaponSystem.js
│   │   ├── ScoreSystem.js
│   │   └── BuffSystem.js
│   ├── level/
│   │   ├── Starfield.js
│   │   ├── ChunkManager.js / WorldManager.js
│   │   ├── AsteroidField.js / EnemySpawner.js
│   │   └── BiomeGenerator.js
│   ├── ui/
│   │   ├── HUD.js
│   │   └── Crosshair.js
│   ├── utils/
│   │   ├── MathHelpers.js
│   │   └── ShaderHelpers.js
│   └── main.js             ← Bootstrapper
├── vite.config.js
└── package.json
```

**Entry-point rule:** Root `index.html` is the Vite entry and must load `/src/main.js`. Remove or rename any stale duplicate public entry files.

## 2. Game Loop Architecture

```js
class Game {
  constructor(containerId) {
    this._isRunning = false;
    this._lastTime = 0;
    this._delta = 0;
  }

  init() {
    this._initRenderer();
    this._initScene();
    this._initSystems();   // Create ALL systems
    this._setupEvents();   // Register event listeners
    this._isRunning = true;
    this._animate();
  }

  _animate() {
    if (!this._isRunning) return;
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    this._delta = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    this._updateInput();
    this._updatePhysics();
    this._updateGameplay();
    this._updateLevel();
    this._updateParticles();
    this._checkCollisions();
    this._updatePostProcessing();
    this._updateHUD();
    this._render();
  }

  _restart() {
    this.player.destroy();
    this.weapon.clear();
    this.particles.destroy();
    this.starfield.destroy();
    this.chunkManager.destroy();
    this.postProcessing.composer?.dispose();
    this._disposeScene();

    this.scene.clear();
    this._setupLighting();

    GameState.restart();
    EventBus.emit('game:restart');
    this.score.reset();
    this.buffs.clearAll();
    this._projectileHitsProcessed.clear();
    this._lastTime = performance.now();

    for (const unsub of this._unsubscribers) unsub();
    this._unsubscribers = [];
    this._setupEvents();

    this._isRunning = true;
    this._animate();
  }

  _initSystems() {
    this.input = new InputSystem(); this.input.init();
    this.cameraSystem = new CameraSystem(this.camera, this.scene); this.cameraSystem.init();
    this.physics = new PhysicsSystem();
    this.audio = new AudioSystem(); this.audio.init();
    this.particles = new ParticleSystem(this.scene); this.particles.init();
    this.postProcessing = new PostProcessingSystem(this.renderer, this.camera, this.scene); this.postProcessing.init();
    this.playerShip = new PlayerShip(this.scene); this.playerShip.init();
    this.weapon = new WeaponSystem(this.scene); this.weapon.init();
    this.score = new ScoreSystem(); this.score.init();
    this.buffs = new BuffSystem(); this.buffs.init();
    this.starfield = new Starfield(this.scene); this.starfield.init();
    this.chunkManager = new ChunkManager(this.scene, this.camera); this.chunkManager.init();
    this.hud = new HUD(); this.hud.init();
    this.crosshair = new Crosshair(); this.crosshair.init();
  }
}
```

**Critical:** `_restart()` must call `_initSystems()`, NOT `init()`. Calling `init()` re-adds event listeners and duplicates gameplay init.

## 2.1 Infinite World Chunking — 2D to 3D Migration

Early prototypes often spawn chunks with 2D keys like `${cx},${cz}` and only vary `x/z`. When the game gains vertical motion, that assumption breaks. Migration rules:

- Chunk key: `${cx},${cy},${cz}`.
- Volume: `cx * WIDTH`, `cy * HEIGHT`, `cz * LENGTH` bounds a cube centered at `(cx*WIDTH + WIDTH/2, ...)`.
- Spawn neighborhood: 3D shell around the ship with radius `SPAWN_AHEAD` in all three axes. Near-origin spawning can stay flatter if you want, but vertical axis must still chunk.
- Cleanup: remove a chunk only when it is `> CLEANUP_BEHIND` in **every** axis, not just one.
- Placement helpers: replace `randomInCylinder` with volumetric helpers so nebula/asteroid/debris placement respects vertical bounds too.
- Keep origin-safety checks, but evaluate them against 3D distance.
- `ChunkManager` must also clean up any `userData.isChunkObject` / `isWormhole` stragglers in `_clearAllChunks()`.

## 3. Post-Processing Pipeline

Use EffectComposer with additive passes. Put OutputPass last for proper tone mapping.

```js
init() {
  this.composer = new EffectComposer(this.renderer);
  this.composer.addPass(new RenderPass(this.scene, this.camera));
  this.bloomPass = new UnrealBloomPass(new Vector2(width, height), strength, radius, threshold);
  this.composer.addPass(this.bloomPass);
  if (!this._isLowEnd) {
    this.composer.addPass(new ShaderPass(ChromaticAberrationShader));
    this.composer.addPass(new ShaderPass(FilmGrainShader));
  }
  this.composer.addPass(new ShaderPass(VignetteShader));
  this.composer.addPass(new OutputPass());
}
```

**Low-end detection:** `navigator.hardwareConcurrency <= 4`.

## 4. Input Mapping / Control Schemes

### 4.1 InputSystem Suppression and Right-Click Event Bus

In `InputSystem.init()`, always suppress the native context menu when the game uses right-click for actions:

```js
const onContextMenu = (e) => e.preventDefault();
window.addEventListener('contextmenu', onContextMenu);
```

If right-click should route into gameplay instead of doing nothing, emit an EventBus event and let `Game.js` own the UI/menu:

```js
const onMouseDown = (e) => {
  EventBus.emit('input:mousedown', e);
  if (e.button === 2) EventBus.emit('input:contextmenu', { x: e.clientX, y: e.clientY });
};
window.addEventListener('mousedown', onMouseDown);
```

Register all new listeners in `_boundHandlers` so `destroy()` removes them. If the game later drops mouse controls, remove every mouse/contextmenu branch; stale listeners silently update dead state and cause “right-click still opens menu” bugs.

### 4.1 Mouse-only + click thrust/brake (preferred for endless flyers)

Preferred default for browser space flyers. See `references/control-schemes.md` for the full startup-oriented invariant and rationale.

```js
// InputSystem.js
init() {
  this.rawMouseX = 0;
  this.rawMouseY = 0;
  this.mouseX = 0;
  this.mouseY = 0;
  this.thrust = false;
  this.brake = false;

  const onMouseMove = (e) => {
    this.rawMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.rawMouseY = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onPointerDown = (e) => {
    if (e.button === 0) this.thrust = true;
    if (e.button === 2) this.brake = true;
  };
  const onPointerUp = (e) => {
    if (e.button === 0) this.thrust = false;
    if (e.button === 2) this.brake = false;
  };
  const onContextMenu = (e) => e.preventDefault();

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('contextmenu', onContextMenu);

  this._boundHandlers.set('destroy', () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('contextmenu', onContextMenu);
  });
}
```

**Smoothed update:**
```js
update(dt) {
  const t = 1 - Math.pow(0.0005, dt);
  this.mouseX += (this.rawMouseX - this.mouseX) * t;
  this.mouseY += (this.rawMouseY - this.mouseY) * t;
}
```

**Orientation in ship mesh:**
```js
updateRotation(dt, input) {
  this.mesh.rotation.x += (-input.mouseY * 0.9 - this.mesh.rotation.x) * ROTATION_SPEED * speedLerp * dt;
  this.mesh.rotation.y += ( input.mouseX * 0.9 - this.mesh.rotation.y) * ROTATION_SPEED * speedLerp * dt;
}
```

**Why this is preferred for small teams/users switching schemes:**
- No keyboard layout assumptions.
- No Q/D/A/E/S/Z/Shift/Comma leftovers.
- Movement is fully driven by ship orientation; rotation and acceleration are decoupled cleanly.

### 4.1 Mouse-Orientation Pitfalls: Inversion + Unbounded Pointer-Lock Accumulator

When switching to mouse orientation, the first playtest usually reports “inverted controls.” In screen-NDC space, positive `mouseX` moves right, but positive Three.js yaw usually turns left. So the default should be `-mouseX` for yaw and `-mouseY` for pitch, not `+mouseX` / `+mouseY`.

Workable defaults:
```js
this.mesh.rotation.x += ( input.mouseY) * ROTATION_SPEED * speedLerp * dt;
this.mesh.rotation.y += (-input.mouseX) * ROTATION_SPEED * speedLerp * dt;
```

If you want an invert toggle, expose `setInvertY(bool)` and flip only the signed term, not both axes.

**Critical pattern:** Do **not** clamp the input rate to `[-1,1]` before steering. That is the “turn cap” bug: sustained circular input never exceeds a fixed yaw angle. The robust pattern is an unbounded accumulator for orientation plus bounded deltas each frame.

```js
// InputSystem.js
const SENSITIVITY = 3.5;

class InputSystem {
  constructor() {
    this.yaw = 0;
    this.pitch = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this._lastYaw = 0;
    this._lastPitch = 0;
    // ...
  }

  init() {
    const onMouseMove = (e) => {
      if (document.pointerLockElement) {
        this.yaw   += e.movementX * SENSITIVITY * 0.001;
        this.pitch  += -e.movementY * SENSITIVITY * 0.001;
      } else {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        const lerp = 1 - Math.pow(0.0005, 1 / 60);
        const targetYaw   = x * SENSITIVITY * 0.001;
        const targetPitch = -y * SENSITIVITY * 0.001;
        this.yaw   += (targetYaw   - this.yaw)   * lerp;
        this.pitch += (targetPitch - this.pitch) * lerp;
      }
    };
    // ...
  }

  update(dt) {
    if (dt > 0) {
      this.mouseX = Math.tanh((this.yaw - this._lastYaw) / dt);
      this.mouseY = Math.tanh((this.pitch - this._lastPitch) / dt);
      this._lastYaw = this.yaw;
      this._lastPitch = this.pitch;
    }
  }
}
```

Then `PlayerShip` treats `input.mouseX/Y` as additive rates:

```js
const yawRate   = input.mouseX * rate * dt;
const pitchRate = input.mouseY  * rate * dt;
this.mesh.rotation.y += yawRate;
this.mesh.rotation.x += pitchRate;
```

Apply only Euler-safety clamping where it really matters:

```js
const q = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
q.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, q.x));
this.mesh.quaternion.setFromEuler(q);
```

This gives deliberate, schedule-free pointer-lock control that can complete full circles, plus a smooth non-lock fallback when the cursor is at the screen edge. Suppress `contextmenu` so right-click brake keeps working under pointer lock.

### 4.2 Idle Self-Level After 3 Seconds

When the player stops steering, let the ship drift visually back toward level flight instead of holding the last extreme attitude. Gate this behind an idle timer so it does not fight active input:

```js
updateRotation(dt, input) {
  // ... existing steering ...

  const inputStrength = Math.abs(input.mouseX) + Math.abs(input.mouseY);
  if (inputStrength < 0.001) {
    this._idleTime += dt;
  } else {
    this._idleTime = 0;
  }

  if (this._idleTime > 3) {
    const t = Math.min((this._idleTime - 3) * 0.5, 1);
    this.mesh.rotation.x += (0 - this.mesh.rotation.x) * 2 * dt * t;
    this.mesh.rotation.z += (0 - this.mesh.rotation.z) * 2 * dt * t;
  }
}
```

Key details:
- Reset on any mouse movement, not just large moves.
- Increase strength `t` from `0→1` over about 2 seconds so the self-level feels like decay, not a hard snap.
- Only level **pitch** and **roll**; do **not** snap yaw back toward a fixed heading, or circular flight becomes impossible.

### 4.2 Idle Self-Level After 3 Seconds

When the player stops steering, let the ship drift visually back toward level flight instead of holding the last extreme attitude. Gate this behind an idle timer so it does not fight active input:

```js
updateRotation(dt, input) {
  // ... existing steering ...

  const inputStrength = Math.abs(input.mouseX) + Math.abs(input.mouseY);
  if (inputStrength < 0.001) {
    this._idleTime += dt;
  } else {
    this._idleTime = 0;
  }

  if (this._idleTime > 3) {
    const t = Math.min((this._idleTime - 3) * 0.5, 1);
    this.mesh.rotation.x += (0 - this.mesh.rotation.x) * 2 * dt * t;
    this.mesh.rotation.z += (0 - this.mesh.rotation.z) * 2 * dt * t;
  }
}
```

Key details:
- Reset on any mouse movement, not just large moves.
- Increase strength `t` from `0→1` over about 2 seconds so the self-level feels like decay, not a hard snap.
- Only level **pitch** and **roll**; do **not** snap yaw back toward a fixed heading, or circular flight becomes impossible.

### 4.3 AZERTY-aware keyboard flight (optional, secondary)

Use only if the project explicitly requires combined mouse + keyboard flight. Bind by `event.code`, not `event.key`.

- `Z=forward`, `S=backward`, `Q/D=strafe`, `A/E=up/down`.
- Mouse = pitch + yaw.
- Do not reuse `Q/D` or `A/E` for roll unless you explicitly want that conflict.
- Add `KeyZ` to the `keydown` prevention list so AZERTY forward does not trigger browser shortcuts.

```js
getForwardInput()   { return clamp((this.isPressed('ArrowUp')?1:0) + (this.isPressed('KeyZ')?1:0)); }
getBackwardInput()  { return clamp((this.isPressed('ArrowDown')?-1:0) + (this.isPressed('KeyS')?-1:0)); }
getStrafeInput()    { return clamp((this.isPressed('KeyD')?1:0) + (this.isPressed('KeyQ')?-1:0)); }
getVerticalInput()  { return clamp((this.isPressed('KeyE')?1:0) + (this.isPressed('KeyA')?-1:0)); }
getYawInput()       { return this.mouseX; }
getPitchInput()     { return this._invertY ? -this.mouseY : this.mouseY; }
```

### 4.4 Keyboard-only screen-relative flight (simple default)

When the user says navigation is unperfect and wants simpler controls, the right move is often this: the ship stays visually aligned to the screen, arrows drive nose relative to the viewport, and mouse piloting is removed entirely.

Preferred mappings:
- **Arrow Up/Down** → pitch nose up/down in screen space.
- **Arrow Left/Right** → yaw nose left/right in screen space.
- **Shift / LShift** → accelerate.
- **Space** → brake.
- **F** → fire.

`PlayerShip.updateRotation()` then becomes a direct check, not a rate-steering lerp from `mouseX/Y`:
```js
updateRotation(dt, input) {
  if (!this.mesh) return;
  const rate = Constants.SHIP.ROTATION_SPEED * (0.6 + 0.4 * speedRatio) * dt;
  if (input.isPressed('ArrowLeft'))  this.mesh.rotation.y += rate;
  if (input.isPressed('ArrowRight')) this.mesh.rotation.y -= rate;
  if (input.isPressed('ArrowDown'))  this.mesh.rotation.x += rate;
  if (input.isPressed('ArrowUp'))    this.mesh.rotation.x -= rate;

  const q = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
  q.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, q.x));
  this.mesh.quaternion.setFromEuler(q);
}
```

`InputSystem` should expose boolean `thrust`/`brake` and derive them in `update(dt)` from pressed keys instead of binding pointer events:
```js
update(dt) {
  this.thrust = !!this.keys[Constants.INPUT.FORWARD];
  this.brake   = !!this.keys[Constants.INPUT.BACKWARD];
}
```

### 4.5 Arrow yaw as opposed-engine thrust feedback

When the user wants turning to feel like thrust-biased turning rather than lateral lean:
- In `PlayerShip.updateRotation()`, accumulate `this._yawInput` from ArrowLeft/ArrowRight only.
- In `updateEngineFlames()`, scale the **opposite** flame higher, e.g.:
  - left arrow press → right flame/glow intensifies
  - right arrow press → left flame/glow intensifies
- Brighten the reactor glow sprite on the active side too; do not add roll/bank for this effect.
- Keep the visual read as “more thrust on the far side,” not ship tilt.

### 4.6 Ship redesign: old-school muscle-car silhouette

When rebuilding the ship mesh:
- Body: long low box + rounded nose + trunk + cabin windshield.
- Wings: small red low-aspect boxes mounted mid-rear.
- Reactors: nacelles on the wings, not the fuselage; add torus rings around intake.
- Tail: paired vertical fins + twin red tail lights at rear corners.
- Keep separate engine/flame emitters per reactor; do not merge them into one center nozzle.

#### Rear Emitter Brightness / Flare Cleanup

White squares behind the ship usually come from too-large additive flame cones and oversized glow sprites. Resolve in `PlayerShip._createEngineFlames()`:

- Use smaller flame cone geometry, e.g. `ConeGeometry(0.12, 0.8, 6)`.
- Prefer `NormalBlending` or low-opacity additive; avoid pure additive at high opacity.
- Lower glow sprite opacity to `0.10–0.15` and scale to `1.4–1.8`.
- Keep exhaust origin at the nacelle rear, not far ahead of it.
- In `updateEngineFlames()`, cap yaw-feedback multipliers so scaled flame stays under `2×` base size.

### 4.7 World landmarks and ambient NPC traffic

- Landmarks: own managed by `PlanetManager` on a sparse 3D grid, **not** per-chunk. They should persist across chunk reloads and be cleaned up only by distance/neighborhood, not chunk eviction.
- NPCs: cap max count low for rarity; prefer fewer ship objects with additive `Points` trails over many bare meshes. Trails should be a shared `Points` pool with per-slot lifetimes, not per-NPC `Points` objects.
- Both must set `userData.isChunkObject = true` so `_clearAllChunks()` and restart paths clean them up.

## 29. Planet Shader: Luminescent Gas/Cloud Giant
### Tuning Brightness When Shaders “Blow Out”

When planets or emissive objects are too bright to see clearly, tune in this order:
1. Post-processing: lower `BLOOM_STRENGTH`, lower `BLOOM_RADIUS`, raise `BLOOM_THRESHOLD`.
2. Live lights: lower `SpotLight`/`PointLight` `intensity` and `distance`; lower wingtip/ring `emissiveIntensity`.
3. Projectiles: lower shared laser `emissiveIntensity`.
4. Particles: lower particle `opacity` and `size` for exhaust/explosions/sparks.
5. Planet shader: reduce fresnel rim multiplier; reduce base alpha; darken color palettes to near-black with faint colored highlights; make atmosphere semi-transparent and only attach it to large planets.
6. Vignette: raise `VIGNETTE_DARKNESS` to restore perceived contrast.

Do **not** add new lights to compensate; prefer bloom/emissive to live lighting.

### Planet Quantity Control

Planet spawn should be *probabilistic, not guaranteed per eligible cell*. Add a deterministic gate so the same chunk always makes the same choice:

```js
update(shipPos) {
  // ...
  if (!this._planets.has(key)) {
    const hash = this._hashKey(key);
    if (hash < 0.18) this._spawnPlanet(cx+dx, cy+dy, cz+dz, key);
  }
}

_hashKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffff;
  return (hash % 10000) / 10000;
}
```

Also widen radius range and scale geometric detail with size:

```js
const minRadius = Constants.CHUNK.WIDTH * 0.25;
const maxRadius = Constants.CHUNK.WIDTH * 1.4;
const radius = minRadius + rng() * (maxRadius - minRadius);
const detail = Math.max(2, Math.floor(3 + radius * 0.04));
```

Gate atmosphere on size so small planets stay cheap:

```js
if (radius > 12) {
  const atmoGeo = new THREE.IcosahedronGeometry(radius * 1.12, 2);
  // ...
}
```

Use very dark palettes for “dimmer” feel, and keep the atmosphere opacity low (`0.06–0.08`).

## 29. Planet Shader: Luminescent Gas/Cloud Giant

Replace solid-color planet meshes with a custom `ShaderMaterial` surface. Keep runtime cost low by using procedural bands in the fragment shader, not per-planet texture atlases.

```glsl
// fragment
float band(vec3 p, float freq, float speed){
  return sin(p.y * freq + uTime * speed + sin(p.z * 1.3 + uTime * 0.2) * 1.4);
}
float flow = band(...) + 0.4 * band(..., 6.0, 0.25);
float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.6);
vec3 color = mix(uColor1, uColor2, flow);
color += uRim * fresnel * 0.9;
```

Rules:
- One `ShaderMaterial` per planet; animate only `uTime` in `update()`.
- Use 4 seeded color uniforms per planet: deep base, mid band, bright highlight, rim color.
- Atmosphere shell: cheap `BackSide` mesh at `radius * 1.06–1.12`, low opacity, same palette rim.

## 30. Ambient Traffic: Rare NPC Ships With Trails
## 30. Ambient Traffic: Rare NPC Ships With Trails

Prefer a single shared `BufferGeometry`/`Points` trail pool over per-NPC geometry for trails.

```js
_buildTrailPool(capacity) {
  this._trailPositions = new Float32Array(capacity * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3));
  geo.setDrawRange(0, 0);
  this._trailPoints = new THREE.Points(geo, trailMat);
}
```

Rules:
- 4 shape types max; seeded cosmetic color per NPC.
- Speed lowered roughly 60–70% vs player; keep wander deterministic per cell.
- Update route: spawn on neighborhood entry, move deterministically, despawn on exit/distance.
- Trail cadence should be time-based, not frame-based (`ud.trailAccum += dt; if (ud.trailAccum > 0.05) spawn...`).

### Rarity vs. Visibility Tuning

Player feedback that NPCs “don’t exist” usually means either they’re too dim, spawn too far away, or never actually change direction. Address all three together, not just spacing.

- Lower emissive so they don’t wash out against space, but keep trail color bright.
- Increase max count modestly and reduce view distance so nearby cells concentrate spawns.
- Give each ship its own wander timer so movement is visibly non-linear:

```js
mesh.userData = {
  velocity,
  rotSpeedY: (rng() - 0.5) * 0.5,
  rotSpeedX: (rng() - 0.5) * 0.25,
  trailAccum: 0,
  wanderRng: mulberry32(seed + 999),
  wanderAccum: Math.random() * 2,
};

_moveNPC(npc, dt) {
  const ud = npc.userData;
  ud.wanderAccum -= dt;
  if (ud.wanderAccum <= 0) {
    ud.wanderAccum = 0.8 + Math.random() * 1.5;
    this._wander(ud.velocity, 1, ud.wanderRng);
  }
  npc.position.addScaledVector(ud.velocity, dt);
  // ...
}
```

Deterministic per-cell spawn + per-ship wander seed gives reproducible distribution without revealing grid boundaries in motion.

## 31. Visual Speed Feedback: Higher Ceilings + Distortion Scaling

When making the ship feel faster, prefer changing these constants together rather than only `MAX_SPEED`:

- `MAX_SPEED`: how fast the ship can go.
- `ACCELERATION` / `DECELERATION`: how fast it gets there.
- Post-processing dynamic bounds: `minBloom`, `maxBloom`, `maxOffset` for chromatic aberration.
- Starfield bright-star count: additive bright particles reinforce speed perception.

Update `PostProcessingSystem.updateBloom()` and `updateChromaticAberration()` to react to `speedRatio` so distortion scales with velocity, not just presence of thrust. A wider dynamic range makes the difference between “fast” and “really fast” readable.

Keep `MAX_SPEED` validated by `dt`-capped `forwardSpeed` in `updatePlayerPhysics()`; don’t let floats drift above the intended ceiling.

## 32. ShootingStarManager: Rare Transient Trails

Add as a new `Points`-based transient system, not per-star meshes. Spawn checks should be time-based, rare, and randomized around the ship:

```js
update(shipPos, dt) {
  const t = this._clock.getElapsedTime();
  if (t - this._lastSpawnCheck > this._spawnInterval) {
    this._lastSpawnCheck = t;
    this._maybeSpawn(shipPos);
  }
  // age existing, remove on expiry, rebuild along velocity vector
}
```

Rules:
- `_spawnInterval` ≈ 3.5s; spawn chance ≈ 35% per check.
- Lifespan ≈ 1.2–2.6s; trail length 12–32 points behind the head along `-velocity`.
- Use per-acquisition lifecycle: add to `_stars` on spawn, delete on expiry.
- Reuse pool `Points` objects when possible; dispose all on `destroy()`.
- Be careful not to call `.clone().normalize()` inside the per-point inner loop; cache the back direction once per star per frame.
- `Game._initSystems()` / `_restart()` / `shutdown()` must create / destroy this manager.
- **Visibility tuning:** if players report “never see them,” either raise spawn chance slightly or shorten `_spawnInterval`; do not increase per-star brightness, since additive trails already read clearly against space.

### Engine Flare / Glow Cleanup

White square bloom around engines usually comes from additive-blended flame cones and oversized glow sprites. Fix in `PlayerShip._createEngineFlames()` instead of adding post bloom:

- Use smaller cone geometry (`ConeGeometry(0.12, 0.8, 6)` or similar).
- Use `NormalBlending` or low-opacity `AdditiveBlending` for flame material.
- Lower glow sprite opacity (`0.10–0.15`) and scale (`1.4–1.8`).
- Move flame origin slightly rearward of the nacelle ring, not forward of it.

Update `updateEngineFlames()` scaling too; don't let yaw-feedback multipliers grow the flame past 2× base scale.

## 33. Asteroid/Debris Density Discipline

When users say “too dense,” reduce chunk counts and prefer rarity + variety over volume:

```js
const asteroidCount = 1 + Math.floor(rng() * 8);   // was often 12+
const debrisCount    = 30 + Math.floor(rng() * 40); // was often 10–100
```

Tune Pools too: spawns should feel like landmarks, not wallpaper. Earlier reduction is better than post-hoc removal.

## 34. Chunk Spawn Seeding and Determinism

Use seeded `mulberry32` for all per-chunk content so neighborhood entry is deterministic. Wander/Biome/Planet/NPC systems must derive their RNG from `chunkSeed(gx, gy, gz)`, not global `Math.random()`, or repetition will break immersion at chunk boundaries.

## 35. Verification in Browser Projects

When making the ship feel faster, prefer changing these constants together rather than only `MAX_SPEED`:

- `MAX_SPEED`: how fast the ship can go.
- `ACCELERATION` / `DECELERATION`: how fast it gets there.
- Post-processing dynamic bounds: `minBloom`, `maxBloom`, `maxOffset` for chromatic aberration.
- Starfield bright-star count: additive bright particles reinforce speed perception.

Update `PostProcessingSystem.updateBloom()` and `updateChromaticAberration()` to react to `speedRatio` so distortion scales with velocity, not just presence of thrust. A wider dynamic range makes the difference between “fast” and “really fast” readable.

Keep `MAX_SPEED` validated by `dt`-capped `forwardSpeed` in `updatePlayerPhysics()`; don’t let floats drift above the intended ceiling.

### Pitfall 22: Scheme Switches Leave Stale Mouse Listeners

When making the ship feel faster, prefer changing these constants together rather than only `MAX_SPEED`:

- `MAX_SPEED`: how fast the ship can go.
- `ACCELERATION` / `DECELERATION`: how fast it gets there.
- Post-processing dynamic bounds: `minBloom`, `maxBloom`, `maxOffset` for chromatic aberration.
- Starfield bright-star count: additive bright particles reinforce speed perception.

Update `PostProcessingSystem.updateBloom()` and `updateChromaticAberration()` to react to `speedRatio` so distortion scales with velocity, not just presence of thrust. A wider dynamic range makes the difference between “fast” and “really fast” readable.

Keep `MAX_SPEED` validated by `dt`-capped `forwardSpeed` in `updatePlayerPhysics()`; don’t let floats drift above the intended ceiling.

### Pitfall 22: Scheme Switches Leave Stale Mouse Listeners

When switching away from mouse control, remove every mouse branch from `InputSystem.init()`. Similarly, when switching away from keyboard control, remove the arrow branches. Stale listeners silently update dead state and make the next “mouse is inverted” / “arrows don’t work” bug very confusing.

### Pitfall 23: Pause Overlay Gets Forgot After Control Changes

`Game._showPauseScreen()` hardcodes the control description into the pause div. Any control-scheme change that changes the active mappings must regenerate that string. If the UI still says “Mouse to steer” after removing mouse input, users will immediately report ghost controls. After every scheme change, grep the project for the old binding text to catch leftovers.

## 5. Forward-Only Flight and Low-FPS Stability

## 5. Forward-Only Flight and Low-FPS Stability

For “ship goes where it points” behavior, do NOT accumulate velocity and then project onto forward. Reconstruct velocity every frame as a scalar along the current forward vector.

```js
// PhysicsSystem.js
updatePlayerPhysics(shipObject, input, dt) {
  const vel = shipObject.userData.velocity;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipObject.quaternion).normalize();

  let forwardSpeed = vel.dot(forward);

  if (input.thrust) forwardSpeed += Constants.SHIP.ACCELERATION * dt;
  if (input.brake && forwardSpeed > 0) {
    forwardSpeed -= Constants.SHIP.DECELERATION * dt;
    if (forwardSpeed < 0) forwardSpeed = 0;
  }

  forwardSpeed = Math.max(0, Math.min(forwardSpeed, Constants.SHIP.MAX_SPEED));
  vel.copy(forward).multiplyScalar(forwardSpeed);

  shipObject.position.addScaledVector(vel, dt);
  // ...
}
```

**Low-fps cap:**
```js
export const SHIP = {
  MAX_SPEED: 35,         // safe for 20 fps and below
  ACCELERATION: 30,
  DECELERATION: 20,
};
```

Using `dt` directly prevents micro-step explosion while preserving responsiveness at lower framerates.

## 6. Smoothed Mouse + Third-Person Camera

- Store raw normalized mouse, lerp each frame to smoothed input.
- Build follow-cam target from ship-local back/right/up axes.
- Look slightly behind/ahead of ship, not through it.

```js
mousemove(e) {
  this.rawMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  this.rawMouseY = (e.clientY / window.innerHeight) * 2 - 1;
}
update(dt) {
  const t = 1 - Math.pow(0.0005, dt);
  this.mouseX += (this.rawMouseX - this.mouseX) * t;
  this.mouseY += (this.rawMouseY - this.mouseY) * t;
}
```

## 6.1 3/4 Above-Behind Camera Framing

To make the ship feel framed like a 3/4 rear view, put the camera above and behind, but aim lower than the ship center so the ship lands in the **lower-center area of screen**, not dead center.

Recommended constants:
```js
export const CAMERA = {
  FOLLOW_HEIGHT: 6,
  FOLLOW_DISTANCE: 12,
  LOOK_OFFSET_Y: -1.5,
  LOOK_OFFSET_Z: -12,
};
```

In `CameraSystem.update()`:
```js
const heightOffset = this._heightOffset.copy(up).multiplyScalar(Constants.CAMERA.FOLLOW_HEIGHT);
const baseDist = Constants.CAMERA.FOLLOW_DISTANCE * Math.max(this.zoomFactor, Constants.CAMERA.ZOOM_MIN);
const backOffset = this._backOffset.copy(back).multiplyScalar(baseDist);
this._targetPos.copy(shipObject.position).add(heightOffset).add(backOffset);

this._lookTarget.copy(shipObject.position)
  .addScaledVector(up, -Constants.CAMERA.LOOK_OFFSET_Y)
  .addScaledVector(back, Constants.CAMERA.LOOK_OFFSET_Z);
```

This keeps standard pitch/yaw turns stable, while the negative Y offset drops the aim point so the ship occupies the bottom portion of the frame.

## 6.2 Mouse-Wheel Zoom

Add discrete zoom controls only when requested. `CameraSystem` owns `zoomFactor`; `InputSystem` emits `camera:zoom` on `wheel`; `Game` routes it.

```js
// CameraSystem.js
this.zoomFactor = 1;

update(ship, dt) {
  const baseFollowDist = Constants.CAMERA.FOLLOW_DISTANCE * Math.max(this.zoomFactor, Constants.CAMERA.ZOOM_MIN);
  // use baseFollowDist instead of FOLLOW_DISTANCE directly
}

applyZoom(delta) {
  this.zoomFactor = Math.max(
    Constants.CAMERA.ZOOM_MIN,
    Math.min(Constants.CAMERA.ZOOM_MAX, this.zoomFactor + delta)
  );
}
```

Input wiring:
```js
// InputSystem.js
const onWheel = (e) => {
  EventBus.emit('camera:zoom', -Math.sign(e.deltaY) * Constants.CAMERA.ZOOM_STEP);
};
window.addEventListener('wheel', onWheel, { passive: true });
```

Constants:
```js
export const CAMERA = {
  ZOOM_MIN: 1,
  ZOOM_MAX: 3,
  ZOOM_STEP: 0.25,
};
```

**Reset on restart / state transitions** to avoid stale zoom persisting across playthroughs: `this.cameraSystem.zoomFactor = 1;` before re-entering gameplay.

## 60. Tower Defense: Coupler-less Game._tick() Is Fragile

When a system constructor isn't wired into `Game._initSystems()`, updates never run. This is distinct from “missing listener”: the system instance exists, but `Game._loop()` skips it, so enemies spawn but don't move, or towers never fire.

Fix pattern:
- After renaming/moving any system, grep for `_tick` / `_update` in `Game.js` and verify every system has a corresponding call in `_animate()` or `_loop()`.
- Prefer a flat call list in `_loop()`: wave, economy, towers, enemies, projectiles, collisions, particles, input, HUD, render. If a new system is added but not called here, it is a silent persistent bug.

## 61. Tower Defense: Path `_ensureConnected` Must Preserve Mutability

Modern bundlers/TS runtimes reject reassigning `const`-declared locals. In DFS/backtrack path generators, do not reassign a `let cur` after declaring it `const`. Use `let` for backtrack variables or restructure into a follow-up pass rather than mutating the same local across both DFS and BFS/repair phases.

## 62. Tower Defense: Gameplay Wiring Must Be Live, Not Stubbed

A full bundle is not proof the game works. After wiring tower-defense systems, validate the actual tick path in `Game._loop()`:
- wave manager updates and queues spawns,
- economy manager applies wave-end bonuses and kill rewards,
- tower manager updates cooldowns and requests projectiles from the projectile system,
- enemy manager advances along the real path tile list,
- projectile system owns movement and hit removal or delegates collision updates consistently,
- collision system applies damage/slow/splash and triggers enemy kills/leaks,
- particle system plays hit/explosion feedback,
- HUD is bound to the live `Game`/state and refreshed every tick,
- context menu system clears stale open menus on restart.

When you introduce a new gameplay controller module, add it to `Game._loop()` explicitly; otherwise it executes constructor-only and effectively never runs.

## 63. Tower Defense: Start Screen and Wave Flow Must Be User-Facing

Default tower-defense gameplay should not auto-start. Provide a visible start phase: init everything, build the path, show a start overlay, then begin wave queuing on user action. The wave button or equivalent must live in `HUD` and emit a bus/handler event that `WaveManager.spawnQueue()` handles. `BUDGET.startMoney` should afford early towers without being so high that placement feels meaningless. After every pause or game-over flow, ensure pause overlay shows usable summary data and restart resets all managers/systems cleanly.

## 64. Tower Defense: Economy Callback Origin Must Match The Live Instance

`EnemyManager.kill()` should not reach back to economy via `this._economy?.applyKill` when the purchase path is actually owned by `EconomyManager` instance in `Game`. Either inject the economy instance/helper into `EnemyManager` or route kills through `EventBus` and let `EconomyManager` apply rewards; rewarding/kill-tracking through a blind optional chain delays verification and can silently miss.

## 65. Tower Defense: Right-Click Context Menu Requires Live Ray Targets

Right-click interaction on towers/enemies needs world-space hit targets that are actual raycaster-compatible meshes. Towers benefit from simple fixture meshes rather than group traversals. Towers should have owner `BuildingManager` return the hit mesh, not rely on enemy group structures. When building the right-click menu, read world position from the intersected mesh and anchor HTML context menu to screen coordinates; otherwise mouse coordinates stay stale and the menu never follows gameplay.

## 66. Tower Defense: Vite Three Addons Require `importmap` Or Aliases

Post-processing passes such as `UnrealBloomPass` and `OutputPass` live under `three/examples/jsm/postprocessing/`. With Vite, import them via `three/addons/...` using browser `importmap`, or via path alias. Forgetting to expose `three/examples/jsm/` means tower bloom never resolves even if the source compiles.

## 62. Tower Defense: Coordinate Aliasing In Coarse Tile Grids

On a tile-indexed grid, towers and enemies must follow the actual tile center, not world truncation. Store entity x/z as `qx + 0.5`, `qy + 0.5` (in tile units) or snap `Mesh.position` to `worldFromTile(qx,qy)`. Otherwise enemies overshoot a tile by 0.6 units per step and look "slippery" across menus and mouse hover.

## 67. Tower Defense: Visual Enrichment Patterns

Composite model factories (named-child animation hooks), fresnel rim shaders
with per-type material presets, dynamic vertex-colored ground reacting to
enemy/tower positions, death dissolve + spawn burst animations, tower
rotation-to-target with recoil, top-down camera setup, and TD economy/HP
wave scaling. See `references/td-visual-enrichment.md`.

On a tile-indexed grid, towers and enemies must follow the actual tile center, not world truncation. Store entity x/z as `qx + 0.5`, `qy + 0.5` (in tile units) or snap `Mesh.position` to `worldFromTile(qx,qy)`. Otherwise enemies overshoot a tile by 0.6 units per step and look “slippery” across menus and mouse hover.

When the scene feels too dark near the horizon, adjust the rig in this order instead of adding new lights:

1. Raise **ambient** intensity and color value slightly.
2. Brighten **key/fill/rim** directional lights in small steps.
3. Add a **hemisphere light** for sky/ground gradient.
4. If still flat, raise **fog/background** brightness together.

Relevant working baseline:
```js
const ambient = new THREE.AmbientLight(0x161e33, 0.85);
const sunLight = new THREE.DirectionalLight(0xddeeff, 1.1);
const fill = new THREE.DirectionalLight(0x5577aa, 0.6);
const rim = new THREE.DirectionalLight(0x335577, 0.4);
const horizon = new THREE.HemisphereLight(0x334466, 0x0a0a0a, 0.35);
```

Avoid compensating by adding new point/spot lights; prefer the above rig plus post bloom/emissive layering.

## 37. Planet Visibility Tuning Without Reintroducing Blowout

If planets are too dim to notice, lift visibility through shader terms, not extra lights:

1. Increase **fresnel rim multiplier**, e.g. `uRim * fresnel * 0.45`.
2. Raise **base alpha**, e.g. `0.75 + fresnel * 0.22`.
3. Brighten one palette slot (usually rim color) slightly.
4. Keep atmosphere opacity low (`0.06–0.08`) and attach it only to large planets.

Do not revert prior dimness fixes by cranking light intensities in response.

## 38. Ad-Hoc Targeted Verification Script Pattern

Use a small disposable `node --input-type=module` script for focused verification instead of broad test runners:

```bash
tmpfile=$(mktemp /tmp/hermes-verify-XXXXXX.js) && cat > "$tmpfile" <<'EOF'
const fs = require('fs');
let ok = true;
const assert = (label, cond) => cond ? console.log('PASS:', label) : (console.error('FAIL:', label), ok = false);
// ... file-content assertions ...
try {
  require('child_process').execSync("node --input-type=module -e \"import fs from 'fs'; fs.readFileSync('src/...')\"", { cwd: '<repo>', encoding: 'utf8' });
  console.log('PASS: changed files parse as ES module source');
} catch (e) {
  console.error('FAIL: parse error', e.message.split('\n')[0]);
  ok = false;
}
console.log(ok ? 'ALL VERIFICATIONS PASS' : 'VERIFICATIONS FAILED');
process.exit(ok ? 0 : 1);
EOF
node "$tmpfile" 2>&1 && rm -f "$tmpfile"
```

ALWAYS delete the temp file when done. Commit/push immediately after a green pass.

## 39. Ship Rear Flare / Glow Cleanup

White square bloom behind engines comes from oversized additive cones and bright glow sprites. Fix in `PlayerShip._createEngineFlames()`:

- Smaller cone geometry: `ConeGeometry(0.12, 0.8, 6)`
- Use `NormalBlending` or low-opacity additive
- Lower glow sprite opacity to `0.10–0.15`, scale `1.4–1.8`
- Keep exhaust origin at rear nacelle, not ahead of it
- Cap yaw-feedback scaling so scaled flame stays under `2×` base

## 7. InstancedMesh Performance

Use InstancedMesh for repeated objects. Individual meshes kill performance beyond ~50 instances.

**Collision pitfall:** InstancedMesh proxy objects lack `.position`, `.boundingSphere`, `.visible`. Physics must skip `isInstanced === true` when no per-instance collidables are stored.

### Making Instanced Content Collidable

**Proven pattern (from production):** expose per-instance collidables from the generator and iterate them in `PhysicsSystem.checkShipCollisions()`:

```js
// AsteroidField.js — store collidables during generation
const collidables = [];
for (let i = 0; i < count; i++) {
  // ... create instance matrix ...
  collidables.push({
    instanceId: i,
    position: pos,       // world-space center
    size,
    radius: size,
  });
}
instancedMesh.userData.isInstanced = true;
instancedMesh.userData._collidables = collidables;

// PhysicsSystem.js — iterate instances
if (target.isInstanced) {
  if (!target.userData?._collidables) continue;
  const meshCenter = target.position.clone();
  for (const c of target.userData._collidables) {
    const worldPos = meshCenter.clone().add(c.position);
    this._targetSphere.center.copy(worldPos);
    this._targetSphere.radius = c.radius || 1;
    if (this._sphere.intersectsSphere(this._targetSphere)) {
      collisions.push({
        target: { position: worldPos, userData: { size: c.size, radius: c.radius } },
        isLarge: c.size > 2,
        damage: Constants.HEALTH.COLLISION_DAMAGE,
      });
    }
  }
  continue;
}
```

**Critical:** `handleCollision()` must not use optional chaining on `collision.target.userData?.radius` if that value is used in a comparison like `> 2`, because `undefined > 2 === false`, masking logic errors. Use explicit property checks:
```js
let pen = 1.2;
if (target.userData) {
  if (target.userData.radius) pen = target.userData.radius;
  else if (target.userData.size) pen = target.userData.size;
}
shipObject.position.addScaledVector(normal, pen + 0.2);
```

### Residual-Velocity Bounce Pitfall

When `updatePlayerPhysics()` forces velocity onto the ship's forward axis every frame, `handleCollision()`'s reflected velocity can be silently overwritten on the next step, making bounce feel weak. Use a short residual override if bounce feel matters more than strict forward-only flight:

```js
this._bounceTimer = 0;

handleCollision(...){ this._bounceTimer = 0.15; }

updatePlayerPhysics(shipObject, input, dt) {
  if (this._bounceTimer > 0) { this._bounceTimer -= dt; shipObject.position.addScaledVector(vel, dt); return true; }
  // normal scalar-forward path
}
```

## 8. Molecule-Scale Smoke / Spark Particles

Prefer thin-billboard quads or sprites for small smoke/sparks. In the shader, modulate alpha by view-space depth and lifetime:

```glsl
float depth = max(-mvPos.z, 1.0);
float scale = mix(maxSize, 1.0, alpha) * (200.0 / depth);
gl_PointSize = clamp(scale, 1.0, maxSize);
```

This keeps vaporous effects visible at both close and far ranges without overdraw spikes.

## 9. Demo-Grade Visual Juice Without New Systems

- Bloom: raise `BLOOM_STRENGTH` and `BLOOM_RADIUS` slightly; keep threshold moderate.
- Emissive layering: ship hull, engine rings, wingtips, accent underbelly.
- Engine glow sprite: additive `Sprite` near engines with speed-based opacity/scale.
- Lighting rig: ambient fill + key + rim directional lights.
- HUD glass: blurred panel background, neon text-shadow, brighter health bar glow.

Default space-game lighting should be **bright, not black**:

```js
export const SCENE = {
  BACKGROUND_COLOR: 0x111827,  // readable dark blue, not pure black
  FOG_COLOR:        0x111827,
  FOG_DENSITY:      0.0008,    // chew into depth cheaply
};
```

Tune exposure and fog density before adding geometry. High fog density with a dark background (`0x000011`, `0.008`) hides the best models.

### Headlight Beam Sizing

A dominant ship headlight should be small and focused, not wide-bore:

```js
this._headlight = new THREE.SpotLight(
  0xffffff,
  intensity,     // 1.0–1.5 instead of default 2.0+
  distance,      // 30–40 instead of 80+
  angle,         // Math.PI / 6 instead of Math.PI / 5
  penumbra,      // 0.6 for softer falloff
  1.5
);
this._headlight.target.position.set(0, 0, -15);
```

Target length should match the effective distance.

**Reduced emission tuning:** lower all of: headlight `intensity` and `distance`, accent/underbelly `PointLight` `intensity` and `distance`, wingtip `emissiveIntensity -> 3`. After any reduction, remove chasing “make it pop” adjustments to the same lights; the goal is ambient+post bloom, fewer live lights.

```js
this._headlight = new THREE.SpotLight(0xffffff, 0.8, 22, Math.PI / 6, 0.6, 1.5);
this._accentLight = new THREE.PointLight(Constants.SHIP.ACCENT_COLOR, 1.0, 10);
```

Verify visually: the hull/engines/emissives should still read clearly via bloom+rim lights without visible cone spill.

## 10. Procedural Audio (Web Audio API)

```js
this._engineOsc = ctx.createOscillator();
this._engineOsc.type = 'sawtooth';
this._engineFilter = ctx.createBiquadFilter();
this._engineFilter.type = 'lowpass';
this._engineGain = ctx.createGain();
this._engineOsc.frequency.setTargetAtTime(freq, now, 0.1);
this._engineGain.gain.setTargetAtTime(vol, now, 0.1);
```

**Audio context requires user gesture.** Create on first click/keydown, not at init.

## 11. Most Common Three.js Runtime Pitfalls

### Pitfall 1: Ternary Precedence Bug
```js
// BUG: (1 + thrusting) ? 3 : 0 — always true, always returns 3
this._accentLight.intensity = 1 + thrusting ? 3 : 0;
// FIX
this._accentLight.intensity = thrusting ? 3 : 1;
```

### Pitfall 2: Pooled Vector Mutation
```js
// FIX: return fresh vector in hot paths
export function getVector3(x = 0, y = 0, z = 0) {
  return new THREE.Vector3(x, y, z);
}
```

### Pitfall 3: THREE Missing in State Files
Every file using `THREE.Vector3`, `THREE.Sphere`, etc., must `import * as THREE from 'three'`.

### Pitfall 4: Restart Event Listener Duplication
`_restart()` must call `_initSystems()`, not `init()`.

### Pitfall 5: Shader Division by Zero
```glsl
gl_PointSize = mix(4.0, 1.0, 0.5) * (200.0 / max(-mvPos.z, 1.0));
```

### Pitfall 6: Hit Flash Doesn't Actually Flash
```js
child.material.emissiveIntensity = 0.8;
child.material.emissive.setHex(0xff0000);
```

### Pitfall 7: Lazy-Init Shared Resources
Lazy-init shared geometry/material on first use if referenced before full init ordering completes.

### Pitfall 8: Map Entry Created After Method Call
Create the Map entry before calling methods that assume it exists.

### Pitfall 9: Event Bus Completeness — Orphaned Events
Audit emits/listeners with grep or `scripts/event-bus-audit.js`. Fix emit/listen mismatches.

### Pitfall 10: Distance Tracking Uses Absolute Position
Track cumulative distance rather than `abs(x)+abs(y)+abs(z)` from origin.

### Pitfall 11: Biome Wrapping Broken for Large Distances
Use modulo on full cycle range: `const cycle = distance % 7000`.

### Pitfall 12: Vite Entry-Point Mismatch
Ensure root `index.html` is the Vite entry loading `/src/main.js`.

### Pitfall 23: Pause Overlay String Quoting
Use simple quoted strings for `style.cssText` / `innerHTML` injection to avoid escaping bugs.

### Pause, Start, and Economics Summary Pattern

Prefer two overlays rather than one mixed-use pause screen:
- `_showStartScreen()` — shown once after `init()`, removed on first Space press, starts the loop.
- `togglePause()` — shows/hides `_showPauseOverlay()` during gameplay.
- `_showPauseOverlay()` — include an economics summary if the world tracks distance/credits.

Example summary composition:
```js
const distance = Math.floor(GameState.distance);
const credits = Math.floor(distance * Constants.ECONOMY.CREDIT_PER_KILOMETER);
const summary = [
  'PAUSED',
  `Distance : ${distance.toLocaleString()} units`,
  `Credits  : ${credits}`,
  `Score    : ${GameState.score.toLocaleString()}`,
  `Hull     : ${Math.max(0, Math.ceil(GameState.health))}%`,
].join('<br>');
```

After every control-scheme or start/pause flow change, grep the project for old binding text so overlays don’t advertise removed controls.

### Pitfall 14: Silent Freezes Mask Real Errors
When the game freezes with no readable output, the failure mode is often a runtime exception thrown inside `requestAnimationFrame` that kills the loop and disappears because there’s no boundary catch. Fix is twofold and cheap:
1. Wrap `_animate()` body in `try { ... } catch (err) { console.error('[Game] Fatal tick error:', err); }` so fatal ticks surface to DevTools/terminal.
2. Insert null guards in hot path entry points (`updatePlayerPhysics()`, `update()`, `updateRotation()`) so uninitialized singletons don’t throw on the very first frame.
Then check DevTools: if the loop is running but nothing updates, `this._isRunning` got flipped by a silent catch, or a system early-exits on `null`. Do not rerun “to see if it passes this time” — inspect `_isRunning` first.

### Pitfall 15: Obsolete renderer.info / WebGLInfo Patches
Remove legacy monkey-patches of `renderer.info.reset`; modern Three.js no longer exports `WebGLInfo` in the main build.

### Pitfall 16: Clearing Instanced Debris/Asteroids On Restart
When using `InstancedMesh`, do not gate cleanup on `!isInstanced`. Both instanced and non-instanced objects need `scene.remove()`, geometry disposal, and material disposal during destroy/clear.

### Pitfall 17: 3D Chunk Key/Seed Must Include Y Axis
When converting chunking from 2D to 3D, update all helpers and biome seeding to include `cy`/`y`:
- `chunkSeed(x, y, z)` not `chunkSeed(x, z)`.
- `getChunkRNG(cx, cy, cz)` must pass `cy` to `chunkSeed`.
Otherwise chunks at different heights but same `(x,z)` generate identical content and world feels flat.

### Pitfall 18: 3D Chunk Eviction Requires Signed-Axis Check
After 2D→3D migration, replace `Math.abs() && AND` eviction with signed check:
```js
const dx = chunk.cx - shipChunkX;
const dy = chunk.cy - shipChunkY;
const dz = chunk.cz - shipChunkZ;
if (dx < -1 || dy < -1 || dz < -1 || dx > SPAWN_AHEAD || dy > SPAWN_AHEAD || dz > SPAWN_AHEAD) {
  toRemove.push(key);
}
```
Without this, stale 3D chunks leak because old logic requires all three axes to be out of range simultaneously.

### Pitfall 19: Camera Look Target Must Actually Use Offset Constants
When adding `LOOK_OFFSET_Y`/`LOOK_OFFSET_Z`, verify the look-target line is actually wired to them:
```js
this._lookTarget.copy(shipObject.position)
  .addScaledVector(up, -Constants.CAMERA.LOOK_OFFSET_Y)
  .addScaledVector(back, Constants.CAMERA.LOOK_OFFSET_Z);
```
A stale constant name or translator variance silently falls back to ship center, ruining the intended 3/4 framing.

### Pitfall 20: Collectible Visibility Stability
When spawning collectibles, set `mesh.visible = true` at creation. In `update()`, check `c.visible` first and skip already-collected items. Do **not** toggle visibility inside update as a state check — that causes flickering and double-collection bugs.
### Pitfall 21: Volumetric Spawning Multiplies Object Count

When expanding from 2D to 3D chunk spawning, reduce per-chunk counts and biome densities proportionally or the world becomes much denser. Characterize active object count with a probe before tuning density.

### Pitfall 24a: Adding New Constants Without Overwriting Existing Constants File

When introducing a new constants block, never use `write_file` on shared files like `Constants.js` unless you’re intentionally replacing the whole file. If you do, you will clobber unrelated constants and break the build. Read the file first, then patch the existing structure or append the new block.

### Safe New-System Integration Pattern

When adding a standalone world system like `BlackHoleSystem`, use this uniform contract so `Game.js` can treat it like every other system:

- **Constructor** takes `scene` only; does not call `init()`.
- **`init()`** is a no-op placeholder so `Game` can call it uniformly.
- **`update(...)`** advances simulation/rendering each tick.
- **`clearAll()`** removes generated content but keeps the instance alive.
- **`destroy()`** tears down shared resources and clears content.

`Game.js` should then:
- construct in `_initSystems()`
- call `init()` immediately after construction
- call `update()` in `_tick()`
- call `clearAll()` in `_restart()`
- call `destroy()` in `shutdown()`

And lifecycle order matters: `clearAll()` before `restart()`, `destroy()` after all other systems in `shutdown()`.

### Cross-System Gravity Helper

Rather than tightly coupling `AsteroidField` to `BlackHoleSystem`, expose a gravity helper and inject it:

```js
// Game.js
this.asteroids.update(dt, this.blackHoles.applyGravityToWorld);

// AsteroidField.js
update(dt, blackHoleGravity) {
  for (const r of this._rotators) {
    // existing drift...
    if (typeof blackHoleGravity === 'function') {
      const pull = blackHoleGravity(r.obj.position, dt);
      if (pull && pull.isVector3 && pull.lengthSq() > 0) {
        r.obj.position.addScaledVector(pull, 0.35);
      }
    }
  }
}
```

This keeps systems decoupled while still sharing behavior. The damping factor (`0.35`) should be tuned per feedback.

### Repeating Far-Object Visibility Discipline

When objects spawn far from the ship, fix visibility in this order:
1. Raise camera far plane together with max speed/view-distance increases.
2. Use `sizeAttenuation: false` for world-locked distant `Points` and trail effects.
3. Only then consider further range increases.

### Pitfall 21b: Far-Plane / Size Attenuation Clips Distant Effects

When NPCs, shooting stars, or wormholes are spawned far from the ship, the default camera far plane and default `sizeAttenuation: true` will make them effectively invisible. Fixes:
- Raise camera far plane when visibility range increases.
- Disable `sizeAttenuation` for world-locked distant `Points`/sprites so they retain screen-space size regardless of distance.
- If fast ships reach the far plane, raise it further or use multiple visibility layers.

### Pitfall 21c: Faster Ships Require Visibility Scaling

Raising `MAX_SPEED` without raising the camera far plane creates a hard visual wall. Increase far plane together with speed, or the player sees clipping at max thrust.

### Coherent Visibility Tuning: Larger Chunks, Same Counts

If the world feels like it pops in/out too often, a cheap coherence win is doubling `CHUNK.SIZE` while keeping per-chunk spawn counts unchanged. Density drops, but the active neighborhood covers a much larger volume and far objects persist longer. This usually reads as more stable than adding extra spawn logic.

### Distant Effect Visibility: Disable Size Attenuation

For shooting stars, NPC trails, or far sky objects, use `sizeAttenuation: false` on `PointsMaterial`. With attenuation enabled, objects at 5,000–17,000 units shrink below visible size even when geometry exists.

### Dim Fantomatic Wormholes: Shader-First, Light-Last

When a wormhole/bloom object reads as too bright, do not add new lights. Reduce shader contribution first:
- lower color multipliers in the fragment shader,
- lower base alpha and rim contributions,
- reduce pulse/outer brightness terms,
- tighten discard threshold.

Only if it still blows out should you reduce post bloom or scene lighting.

### NPC Visibility Without Overlighting

If users report “no other ships seen,” fix visibility before density:
- raise emissive slightly on ship body,
- keep shared trail `Points` additive with `sizeAttenuation: false`,
- increase deterministic neighborhood range by one cell and modestly raise `MAX_COUNT`/`SPAWN_CHANCE`,
- only then consider view-distance increases.

### Pitfall 14: Obsolete renderer.info / WebGLInfo Patches
Remove legacy monkey-patches of `renderer.info.reset`; modern Three.js no longer exports `WebGLInfo` in the main build.

## 12. Perf: Reuse Explosion Points

Precreate reusable `Points` from an explosion pool; on spawn, overwrite positions/lifetimes/velocities in-place; reuse instead of splicing per-shot allocations.

## 13. Perf: Avoid Allocating Vectors Per Particle

Use in-place scalar multiplication in hot paths:

```js
p.userData.position.addScaledVector(p.userData.velocity, dt);
```

Add scratch-vector pooling in `PhysicsSystem`, `CameraSystem`, and `Game` for axes/exhaust math. Pre-allocate once in the constructor, then `.set()`/`.copy()`/`.addScaledVector()` per frame. This removes the dominant per-frame heap churn in ship-physics and follow-cam hot paths.

**Physics hot-path pitfall:** `updatePlayerPhysics()` should read `input.keys` directly instead of calling `getForwardInput()` / `getStrafeInput()` / `getVerticalInput()` per frame — those helpers add extra function-call overhead in the main loop. Cache the three axis vectors once as `_forward`, `_right`, `_up`, and reuse a single `_accel` vector.

**Camera hot-path pitfall:** `update()` must not call `.clone()` or `new THREE.Vector3(...)` per frame. Cache `_back`, `_rightAxis`, `_upAxis`, `_heightOffset`, `_backOffset`, and reuse them.

**Game loop pitfall:** After changing `_targetPos`, do not recompute `shipObject.position + heightOffset + backOffset` a second time before lerp. That duplicate line is a hidden per-frame cost and a correctness-risk time-bomb.

**Particle explosion hot path:** Use direct `geometry.attributes.position.array` access with `j3 = j * 3` stride in inner loops instead of `posAttr.getX(j)` / `posAttr.setX(...)`. This avoids per-attribute method call overhead for thousands of particles per frame.

**Asteroid drift:** Use `asteroid.position.addScaledVector(asteroid.userData.driftVelocity, dt)` instead of `asteroid.position.add(asteroid.userData.driftVelocity.clone().multiplyScalar(dt))`.

**Scratch vector summary table:**
| System | Scratch vectors to pre-allocate |
|---|---|
| PhysicsSystem | `_forward`, `_right`, `_up`, `_accel`, `_contactPoint` |
| CameraSystem | `_back`, `_rightAxis`, `_upAxis`, `_heightOffset`, `_backOffset` |
| Game | `_forward`, `_right`, `_up`, `_exhaustDir`, `_exhaustOrigin`, `_exhaustOffset` |

## 14. Perf: Limit Dynamic Lights Per Chunk

Cap per-chunk lights to 1–2, lower intensity/range, only near nebula cores. Prefer bloom trickery over live lighting for nebula glow.

## 15. Weapon Visual Feedback Without Draw-Call Spam

Share laser geometry/material across projectiles; bump `emissiveIntensity` for bloom punch; on fire, spawn a small exhaust burst from the muzzle.

## 16. Demo-Grade Visual Juice Without New Systems

- Bloom: raise `BLOOM_STRENGTH` and `BLOOM_RADIUS` slightly; keep threshold moderate.
- Emissive layering: ship hull, engine rings, wingtips, accent underbelly.
- Engine glow sprite: additive `Sprite` near engines with speed-based opacity/scale.
- Lighting rig: ambient fill + key + rim directional lights.
- HUD glass: blurred panel background, neon text-shadow, brighter health bar glow.

Update colors in `Constants.js`, not scattered literals.

## 17. Verification in Browser Projects

- `npm run build` succeeds
- Changed JS files pass `node --check`
- Dev server starts and serves the game page
- Frame-time probe with `performance.now()` when possible
- Kill dev server after verification
- Do not include non-JS files like `index.html` in syntax checks

**Robust dev-server probe pattern:** spawn `npm run dev` detached/unrefed, wait ~1400ms, scan ports 5173–5185 with short HTTP timeouts, then `process.kill(-dev.pid, 'SIGKILL')`. If a verification script times out, the likely cause is the dev server still running; fix cleanup instead of rerunning unchanged.

## 18. Build Commands

```bash
npm run dev          # Development server with HMR
npm run build        # Production bundle
npm run preview      # Preview production build
```

### 18.1 Dev-Server Launcher Script

For browser games that need a one-command launch (install deps, start Vite, open browser, clean shutdown), use the `templates/launch.sh` starter. **Key detail:** parse the actual `Local:` URL from Vite's log output rather than hardcoding port 5173, because Vite auto-selects the next available port when 5173 is already in use (common when multiple games run simultaneously on the same machine). Replace `<GAME_NAME>` with the project name.

```bash
cp templates/launch.sh launch.sh
# edit: replace <GAME_NAME> with the project name (e.g. tower-defense)
chmod +x launch.sh
./launch.sh
```

## 40. Black Hole Entity Integration Pattern

New distant-hazard entity: use `references/blackhole-system-pattern.md` for lifecycle, disposal safety, visual readability, cross-system gravity coupling, and spawn discipline.

### Cross-System Gravity Callback Binding

When wiring gravity into non-player systems, bind the callback to preserve `this`:

```js
// CORRECT
this.asteroids.update(dt, this.blackHoles.applyGravityToWorld.bind(this.blackHoles));
```

Passing `this.blackHoles.applyGravityToWorld` unbounded will run with `this === undefined` inside the callee and read `this._holes` as `undefined`.

## 58. Dense Asteroid-Field Requests Should Be Biome-Local, Not Global

When the user asks for denser asteroid fields, do not raise global spawn counts or add more entity types system-wide. The right move is biome-local:

- Raise `asteroidDensity` on one specific zone.
- Add duplicate `'asteroid'` entries to that zone’s `entities` allowlist to increase per-chunk asteroid selection weight.
- Keep all other zones lean; remove non-asteroid entity types from those zones unless explicitly requested.
- If overall scene count is still too high, reduce `ASTEROID_COUNT_VAR` globally and recover density only inside the chosen dense belt.

This preserves gameplay variety without adding generic entity spam.

## 59. Session Tuning Reference

Stable performance/visual tuning targets for this project are captured in `references/void-drift-performance-tune-2026-07-22.md`. Use it when reducing scene load, rebalancing biomes, or choosing dense-vs-sparse zone parameters.

When a menu should preview gameplay objects, give each card its own mini Three.js render tree instead of 2D swatches:

- One `WebGLRenderer`, `Scene`, `PerspectiveCamera` per card.
- Reuse the existing gameplay object builders so previews stay in sync with actual gameplay assets.
- Rotate in a rAF loop owned by the overlay; cancel it in `destroy()`.
- Dispose each preview’s renderer and object graph on destroy to avoid leaked GL contexts.

Pitfall: in `_build()`, the forEach loop variable must be passed into preview helpers; referencing an outer/undefined `preset` causes a silent startup crash.

## Delta-Time Pattern

All movement must use delta time:

```js
position.add(velocity.clone().multiplyScalar(dt));
rotation.y += speed * dt;
cooldown -= dt;
if (cooldown <= 0) { fire(); cooldown = fireInterval; }
```

## 19. GLSL Shader Composition From Helper Modules

When shader code lives in JS modules (`src/utils/ShaderHelpers.js`), split it into reusable pieces instead of one monolithic string:

- `SIMPLEX_3D_GLSL` — noise library (no `main()`, no uniforms)
- `NEBULA_FRAGMENT_BODY` — `main()` body referencing `vUv`, `snoise`, `fbm`
- Compose in the consumer: `` fragmentShader: `${SIMPLEX_3D_GLSL}\\n${NEBULA_FRAGMENT_BODY}` ``

**Pitfall:** Do not inline the noise library inside every fragment string. Either import it once per `ShaderMaterial` or concatenate the shared constant. If you split into `header` + `body`, make sure the body wraps its logic in `void main() { ... }`.

## 20. Browser Console Can Be Misleading In Headless/CDP Env

In some Browserbase/Camofox sessions, `browser_console` may report a persistent generic JS error after page load even when the page is actually running fine. Trust page-state evidence when available:

- DOM snapshot / accessibility tree
- `browser_vision` screenshot
- `browser_console` evaluations that inspect live state (`typeof window`, `performance.getEntriesByType(...)`)

Generic post-load console errors that survive reload usually indicate stale cached bundles, not current source errors. Hard-reload or restart the dev server instead of chasing the phantom stack.

## 21. Verify Before Declaring Done

Run fresh verification after every nontrivial edit:

```bash
node --check <changed files>
npm run build
```

For browser projects, probe an actual reloaded page with `browser_navigate` + `browser_press(Space)` + visual check, rather than relying solely on prior session state. Do not claim success until the latest reloaded state is inspected.

## 22. ParticlePool: Keep Geometry Alive

Keep geometry alive for the whole pool lifetime; hide/deactivate instead of disposing mid-life. Dispose everything in `destroy()`. Precreate reusable `Points`, overwrite positions/lifetimes/velocities in-place, reuse instead of splicing per-shot allocations.

Update colors in `Constants.js`, not scattered literals.

## 23. Nebula Shader Compose Guard

When composing nebula shaders from `ShaderHelpers.js` fragments (`SIMPLEX_3D_GLSL` + body), ensure the fragment body actually declares `varying vec2 vUv;`. A common silent failure is omitting that varying and then using `vUv * scalar + uTime`, which fails to compile because WebGL drops undeclared identifiers. Also remember that `fbm` takes `vec3`, so thread time through `vec3(vUv, uTime * factor)` instead of adding scalar time to a `vec2`.

## 24. Avoid `game:tick` Per-Frame Emission

Emitting `game:tick` every frame is unnecessary unless a subscriber truly needs per-frame updates. Prefer event-driven updates on state changes or less frequent ticks. If you keep it, make sure subscribers can handle high-frequency events without allocation churn.

## 25. Game-Loop Scratch Vector Minimum Set

In `Game._animate`, cache these scratch vectors once and reuse them instead of allocating per frame:

- `_forward`
- `_right`
- `_up`
- `_exhaustDir`
- `_exhaustOrigin`
- `_exhaustOffset`

Reuse pattern:

```js
const _exhaustDir = this._exhaustDir;
_exhaustDir.set(0, 0, 1).applyQuaternion(this.playerShip.mesh.quaternion);

const _exhaustOrigin = this._exhaustOrigin;
_exhaustOrigin.copy(this.playerShip.mesh.position).addScaledVector(_exhaustDir, 1.5);
```

## 26. Collision Handler Scratch Vector

Even after refactoring `PhysicsSystem` to reuse scratch vectors, `handleCollision()` still needs a push-direction scratch vector (`_pushDir`). Keep collision feedback behavior instead of stripping it; otherwise damage-related camera shake and velocity response disappear silently.

## 27. Hot-Path Input Access

In `updatePlayerPhysics()`, read `input.keys` directly instead of calling `getForwardInput()` / `getStrafeInput()` / `getVerticalInput()` per frame. Those helper calls add extra function-call overhead in the main loop. Cache axes into `forwardInput`, `rightInput`, `verticalInput` locals.

## 28. Particle Hot Path: Direct Array Access

Use direct `geometry.attributes.position.array` access with `j3 = j * 3` stride in inner loops instead of `posAttr.getX(j)` / `posAttr.setX(...)` when updating thousands of particles per frame.

## 41. Biome Variety: Config-Driven Entity Allowlists

If a world feels monotonous, the bottleneck is often identical spawn tables in every chunk, not missing content. Add one `entities` array to `BIOME.ZONES` entries and filter chunk spawning against it.

```js
// Constants.js
{ name: 'Crystal Rift',
  min: 9000, max: 12000, asteroidDensity: 0.18, debrisCount: 2,
  nebulaColors: [0x22cc77, 0x66ffaa, 0x116644], wormhole: false,
  entities: ['crystal','crystal','ruin','boost'] }
```

In `BiomeGenerator.getBiomeParams(distance)`, pass `entities` through. In `ChunkManager._spawnChunk()`, gate each subsystem:

```js
const allowed = new Set(params.entities || []);
if (allowed.has('asteroid')) this._sub.asteroids.generateChunk(...);
if (allowed.has('debris'))   this._sub.debris.generateChunk(...);
if (allowed.has('crystal') || allowed.has('ruin') || allowed.has('boost')) {
  this._sub.collectibles.generateChunk(center, rng, isSafe, allowed);
}
if (allowed.has('cloud'))    this._sub.nebula.generateChunk(...);
```

Keep chunk bookkeeping intact when adding routing; do not remove `this._chunks.set(...)` or wormhole storage during these edits.

## 42. Volumetric Clouds From 2D Nebula Quads

Billboard nebula quads are always 2D; angled views reveal the plane. Replace with translucent `SphereGeometry` shells when variety demands true cloud volumes:

- Use `SphereGeometry(radius, 16, 12)`, not `PlaneGeometry`.
- Keep the same procedural noise shader; wrap a `void main()` that reads position-space time.
- Slow-rotate each shell in `update(dt, camera)` so clouds feel volumetric without camera-facing billboard hacks.
- Dispose per-cloud geometry in `clearChunk()` / `clearAll()`.

## 43. New Collectible Type With Score Multiplier Boost

For temporary gameplay boosts with score benefits:
- Add `BOOST` constants in `Constants.js`: `DURATION` and `MULTIPLIER`.
- Add state in `GameState.js`:
  - `restart()` initializes `this._boostEnd = 0`.
  - `isBoostActive` compares current time to `_boostEnd`.
  - `beginBoost()` extends `_boostEnd`.
  - `getBoostMultiplier()` returns `1` or multiplier.
- In `ScoreSystem.updateDistanceScore()`, multiply the raw target by `getBoostMultiplier()`.
- Pickup handling in `Game.js` calls `GameState.beginBoost()` when `type === 'boost'`; scoring from crystals/ruins remains unchanged.

## 44. Preserve Chunk Bookkeeping When Refactoring Spawns

Symptom: after adding biome-routed spawning, chunks no longer evict, wormholes leak, or `getCollidables()` sees stale state.

Fix pattern:
- Keep `this._chunks.set(key, { cx, cy, cz, center, wormhole })` as the canonical chunk registration.
- Spawn entities after the chunk record exists; never delete the record while only inlining conditional branches.
- If `_spawnWormhole()` was removed inline, restore it or keep a no-op branch that still stores chunk metadata.

## 45. Ship Preset Light/Flame Constants Must Exist On Both Levels

Symptom: browser console warns `THREE.Material: parameter 'emissiveIntensity' has value of undefined` and `parameter 'color' has value of undefined` during ship creation.

Root causes seen in playable sessions:
1. `PlayerShip.js` reads shade/flame/accent/headlight values directly from `S` (`S.ENGINE_COLOR`, `S.ACCENT_COLOR`, `S.ACCENT_INTENSITY`, `S.ACCENT_DISTANCE`, `S.HEADLIGHT_INTENSITY`, `S.HEADLIGHT_DISTANCE`, `S.WINGTIP_EMISSIVE`).
2. The top-level `Constants.SHIP` object has no such keys, so `undefined` flows into `MeshStandardMaterial`, `ShaderMaterial`, `SpriteMaterial`, and `SpotLight` constructors.

Fix pattern:
- Define fallbacks on `Constants.SHIP`: `ENGINE_COLOR`, `ACCENT_COLOR`, `ACCENT_INTENSITY`, `ACCENT_DISTANCE`, `HEADLIGHT_INTENSITY`, `HEADLIGHT_DISTANCE`, `WINGTIP_EMISSIVE`.
- Add preset-specific overrides inside each `SHIP.PRESETS` entry: `engineColor`, `accentColor`, `accentIntensity`, `accentDistance`, `headlightIntensity`, `headlightDistance`, `wingtipEmissive`.
- In `PlayerShip.init()`, prefer `p.<field> || S.<FIELD> || <hard fallback>` for every material/light parameter.

```js
const wingtipEmissive = p.wingtipEmissive == null ? S.WINGTIP_EMISSIVE : p.wingtipEmissive;
const eng = p.engineColor || S.ENGINE_COLOR || 0x44aaff;
const accentIntensity = p.accentIntensity == null ? S.ACCENT_INTENSITY : p.accentIntensity;
const accentDistance  = p.accentDistance  == null ? S.ACCENT_DISTANCE  : p.accentDistance;
```

Why this matters: once preset-level fields exist, `Constants.SHIP` global fields can stay as safe defaults, and regenerating different ships no longer emits material warnings.

## 45a. Collectible Chunk Tracking Must Set `chunkKey`

Symptom: biome variety verification shows collectibles leaking or the wrong collectibles appearing; `clearChunk()` silently fails.

Root cause: `CollectibleSystem.generateChunk()` creates meshes with `mesh.userData = { isChunkObject: true }` but never stores `chunkKey`; `clearChunk()` filters by `mesh.userData.chunkKey === chunkKey`, so nothing matches.

Fix pattern:
```js
mesh.userData = { isChunkObject: true, chunkKey };
this._items.push({ mesh, type, baseY, phase: rng() * Math.PI * 2, chunkKey });
```

Verification:
- After `tagChunk(key)`, collectibles from that chunk must be removable by `clearChunk(key)`.
- Biome variety tests that inspect live collectible counts by distance should run only after this fix, otherwise counts are corrupted by leaked state.

## 46. Safe Constants File Editing

Symptom: after adding a new constants block, unrelated constants disappear and the build breaks.

Fix pattern:
- Never overwrite `Constants.js` with a small new file via `write_file` unless you intend to replace the whole document.
- Read first, then append or patch the existing structure.
- After any `Constants.js` edit, run `npm run build` before assuming success.

## 47. Start-Screen 3D Ship Previews

When the start menu should show live 3D ship previews instead of 2D swatches, give each card its own mini Three.js render tree:

- One `WebGLRenderer`, `Scene`, `PerspectiveCamera` per card.
- Reuse the existing `PlayerShip` preset builder so previews stay in sync with gameplay ships.
- Rotate slowly in a rAF loop owned by the start screen; cancel it in `destroy()`.
- Dispose each preview’s renderer and ship on destroy to avoid leaked GL contexts.

Pitfalls:
- `mount()` must build DOM and start preview rAF together; otherwise the overlay appears blank.
- `_build()` forEach loop variables must be passed into preview helpers; referencing an outer `preset` causes a silent startup crash.
- Cleanup: cancel rAF, dispose preview renderers/ships, remove DOM root.

## 48. Group-Mesh Disposal in Prune/Despawn Paths

When an NPC/entity is now a `THREE.Group`, direct `mesh.geometry.dispose()` / `mesh.material.dispose()` crashes because those properties are undefined on the group.

Fix pattern:
```js
if (mesh.isGroup || mesh.type === 'Group') {
  mesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
} else {
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  }
}
```

## 49. Collidables Must Be Real Meshes

`PhysicsSystem.checkShipCollisions()` assumes each entry has `.position`. Container objects such as wormhole registries `{outer, inner, outerMat, innerMat}` will crash it.

Fix pattern:
- Push the real mesh (`chunk.wormhole.outer`) into collidables, not the container.
- If unsure, guard: `const target = entry.outer || entry; if (!target.position) continue;`

## 50. Wormhole Teleportation Pattern

New teleporting-hazard system: use a dedicated registry with lifecycle hooks so target selection never collides with stale chunks.

- `register(group, center, chunkKey)` on chunk spawn.
- `unregister(chunkKey)` on chunk eviction.
- `update(shipPos, dt)` returns `{from, to}` or null, with a cooldown to prevent instant re-teleport.
- `applyTeleport({from, to, shipMesh, cameraSystem})` recenters ship with preserved offset and snaps camera.
- Drive from `Game._tick()` after collectible pickup handling, before HUD/scoring so the teleported frame never double-applies nearby pickups.

**Reliability fix:** Update-time proximity teleport is not enough in practice. Ship collision handling often misses thin-ring colliders or prevents overlap long enough that proximity checks never trigger. The robust path is collision-driven teleport from `Game._tick`:

```js
let wormholeTeleport = null;
for (const hit of shipHits) {
  if (hit.mesh && hit.mesh.userData && hit.mesh.userData.isWormhole) {
    wormholeTeleport = hit;
    continue;
  }
  // ...existing damage/hit-flash path...
}
if (wormholeTeleport) {
  const from = worm._holes.find(h => h.center.distanceTo(this.playerShip.mesh.position) < Constants.WORMHOLE.TELEPORT_RADIUS);
  if (from) {
    const targets = worm._holes.filter(h => h.chunkKey !== from.chunkKey);
    const to = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
    if (to) this.wormholes.applyTeleport({ from, to, shipMesh: this.playerShip.mesh, cameraSystem: this.cameraSystem });
  }
}
```

**Availability fix:** Biome-only wormhole spawning hides them at high distance. Use a global `WORMHOLE.SPAWN_CHANCE` constant in `_spawnChunk()` and remove hard biome gating if the goal is discoverability. A safe baseline is `SPAWN_CHANCE: 0.12` with `TELEPORT_RADIUS: 50` and `VIEW_DISTANCE: 24000–26000` so wormholes are visible well before collision range.

**Collidables note:** `getCollidables()` must push the real wormhole outer mesh, not the registry container object: `list.push(chunk.wormhole.outer || chunk.wormhole)`. Container objects lack `.position` and crash `PhysicsSystem.checkShipCollisions()`.

## 51. NPC Ship Variety Through Shared Preset Builder

Do not duplicate hull shapes inside `NPCShipManager`. Reuse `PlayerShip` geometry branches by exposing a hull-only builder:

```js
// PlayerShip.js
buildShipHull(preset) {
  const rng = { __preset: preset, value: () => 0.5 };
  const mesh = this._buildShipMesh(rng);
  mesh.scale.setScalar(preset.scale || 1);
  mesh.userData = { velocity: new THREE.Vector3() };
  return mesh;
}
```

`NPCShipManager` then calls this instead of random primitive shapes. For random preset selection, wrap a tiny fake rng whose `__preset` field short-circuits preset lookup.

## 52. Defensive Collidables Guard

`ChunkManager.getCollidables(shipPos)` is called every tick. If the player object is transiently missing, returning `[]` is safer than throwing:

```js
getCollidables(shipPos) {
  if (!shipPos) return [];
  // ...
}
```

## 53. Start-Screen DOM-Build Variable Scoping

Symptoms of a broken start screen: `drawSwatch is not defined`, blank overlay, or silent startup failure. Causes:
- helper removed from scope after rewrite but still referenced
- forEach callback references outer-scope `preset` instead of loop param `p`

Fix pattern: audit every helper reference inside `_build()` after replacing swatch code with preview components; if a helper is dead, remove its call site instead of restoring the helper.

## 54. Vite HMR Reconnect Noise Is Not JS Errors

In dev-server sessions, `[vite] connecting...` / `[vite] connected.` lines are normal HMR reconnect chatter, not script failures. Do not treat them as evidence of runtime errors.

## 55. Overlap Note: `threejs-game-dev` vs `threejs-game-debugging`

`threejs-game-dev` owns implementation patterns for Three.js browser games, including start-screen previews, preset reuse, and safe spawn/despawn. `threejs-game-debugging` owns diagnostic workflows for silent failures, runtime errors, and headless verification. This skill now carries the preview and safe-disposal patterns; debugging-specific guidance stays in `threejs-game-debugging`.

## 56. Wormhole Teleport Reliability Fixes

Two classes of failure show up consistently:
1. Registry emptiness after startup: `WormholeSystem` is instantiated, but pre-existing world wormholes are never seeded because spawning happens in chunks before the registry observes them.
2. Silent miss despite visible wormhole: `PhysicsSystem.checkShipCollisions()` falls back to `radius = 1` when no collision radius is tagged, so the ship glides through large visual shells without triggering.

Always include these in a new wormhole feature:
- `WormholeSystem.init(chunkManager)` that walks `chunkManager._chunks` and registers each `chunk.wormhole`.
- Call `wormholes.init(this.chunkManager)` from `Game._startRun()` so the registry is primed before the first `_tick`.
- Tag outer meshes with `outer.userData.radius = 38` so collision checks use a reasonable trigger size.
- Keep collision-driven teleport in `Game._tick` rather than relying solely on proximity in `WormholeSystem.update()`.

**Availability:** if only one biome gates `wormhole: true`, players may never encounter one. Either enable spawning globally with `WORMHOLE.SPAWN_CHANCE` or raise per-biome chance substantially.

---

**Lint/Build status:** Changed files pass `node --check`.
