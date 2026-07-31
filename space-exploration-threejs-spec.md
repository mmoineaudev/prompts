---
name: space-exploration-threejs
description: |
  Detailed specification for a procedurally generated, visually deep
  browser-based space exploration game built with Three.js.
  Exploration and movement are the core loop; shooting is supportive.
triggers:
  - "space exploration game"
  - "threejs space game spec"
  - "procedural starfield game"
---

# Space Exploration Game — Technical Specification

> **Primary Loop:** Fly → Discover → Navigate → (optionally destroy debris) → Push further.
> **Shooting is supporting, not the focus.** Visual immersion is the main goal.

---

## 1. Project Setup & Verification

### 1.1 Prerequisites Checklist

| Item | Required Version | Verification Command |
|------|-----------------|---------------------|
| Node.js | ≥ 18.0.0 | `node --version` |
| npm | ≥ 9.0.0 | `npm --version` |

### 1.2 Project Initialization

```bash
cd /home/neo/Documents/games-benchmarks
mkdir -p space-exploration && cd space-exploration
npm init -y
npm install three@0.165.0
npm install -D vite@5.4.0 @types/three@0.165.0
```

### 1.3 Vite Configuration (`vite.config.js`)

```js
import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2020' },
  server: { open: true },
});
```

### 1.4 Entry Point (`index.html`)

Single-page HTML with a full-screen `<canvas>` container (`#game-container`). HiDPI support: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`. Responsive resize handler updates camera aspect and renderer size. No title screen — game boots directly into the scene.

Canvas: full window, background color `0x000011`, exponential fog `new THREE.FogExp2(0x000011, 0.008)`.

### 1.5 Acceptance Criteria — Setup

- [ ] `npm install` completes without errors or warnings.
- [ ] `npm run dev` launches a dev server on `localhost:5173`.
- [ ] `npm run build` succeeds with exit code 0.
- [ ] Opening `localhost:5173` shows a dark starfield — no console errors, no black screen.

---

## 2. Controls

All input uses **event.code** for AZERTY/QWERTY compatibility:

| Action | AZERTY | QWERTY (equivalent) | Notes |
|--------|--------|---------------------|-------|
| Move forward / thrust | Z | W | Hold for continuous acceleration |
| Move left | Q | A | Strafe |
| Move right | D | D | Strafe |
| Move backward | S | S | Decelerate |
| Roll left | A | A | Smooth interpolated roll rotation |
| Roll right | E | E | Smooth interpolated roll rotation |
| Fire weapon | Space or Left Click | Space or Left Click | Single laser burst, rate-limited |
| Pitch up / down | Mouse up / down | Mouse up / down | Y-axis look, smooth interpolation |
| Yaw left / right | Mouse left / right | Mouse left / right | X-axis look, smooth interpolation |
| Pause | Escape | Escape | |
| Mute audio | M | M | Toggle all sound |
| Restart (on death) | R | R | |

**Arrow keys** also work as aliases: Up=Z, Down=S, Left=Q, Right=D.

**Touch/mobile**: virtual joystick overlay (left half = movement, right half = look: drag to pitch/yaw). Tap to fire. Two-finger swipe to roll.

**Mouse**: X-axis movement = yaw, Y-axis movement = pitch (smooth interpolation, `MOUSE_LOOK_SPEED`). A/E keys handle roll. Left click to fire. Click the canvas to capture the pointer (pointer lock); Esc releases and pauses.

Game boots directly into gameplay — no title screen. Press R on death screen to restart.

---

## 3. Project Structure

```
space-exploration/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.js                           # Bootstraps Game, mounts canvas
│   ├── core/
│   │   ├── Game.js                       # Orchestrator: init, loop, shutdown, restart
│   │   ├── EventBus.js                   # Singleton pub/sub with domain:action events
│   │   ├── GameState.js                  # Centralized state: player, combat, game
│   │   └── Constants.js                  # All magic numbers, colors, timings, configs
│   ├── systems/
│   │   ├── InputSystem.js                # event.code keyboard + mouse/pointer mapping
│   │   ├── CameraSystem.js               # Follow-cam, damping, FOV speed effect
│   │   ├── PhysicsSystem.js              # Collision detection, bounding volumes (AABB)
│   │   ├── AudioSystem.js                # Web Audio API procedural synthesis (no audio files)
│   │   ├── ParticleSystem.js             # Pool-based particle manager (trails, explosions)
│   │   └── PostProcessingSystem.js       # UnrealBloomPass, vignette (custom ShaderPass), film grain (custom), chromatic aberration (custom or skip on low-end)
│   ├── gameplay/
│   │   ├── PlayerShip.js                 # Ship mesh, movement logic, thrust, steering, health
│   │   ├── WeaponSystem.js               # Laser projectiles, firing rate, cooldown
│   │   ├── ScoreSystem.js                # Score tracking, high score in localStorage
│   │   └── BuffSystem.js                 # Time-based stat modifiers
│   ├── level/
│   │   ├── ChunkManager.js               # Chunk/segment spawn (ahead) & cleanup (behind)
│   │   ├── Starfield.js                  # Multi-layer parallax particle starfield (3 layers)
│   │   ├── NebulaSystem.js               # Volumetric-feel nebula clouds (billboard + custom shader)
│   │   ├── AsteroidField.js           # Procedural asteroid generation (InstancedMesh)
│   │   ├── CometSystem.js             # Comets: spawn, trajectory, dust + smoke trails
│   │   ├── BlackHoleSystem.js         # Black holes: gravity well, accretion disk, consumption
│   │   ├── DeadStarSystem.js          # Dead stars: dark-red remnants, ember glow, light
│   │   ├── DebrisSystem.js            # Floating debris, destructible objects
│   │   └── BiomeGenerator.js             # Biome variant selection per distance zone
│   ├── ui/
│   │   ├── HUD.js                        # DOM overlay: score, distance, health bar
│   │   ├── DeathScreen.js                # DOM: final score, distance, high score, restart prompt
│   │   └── Crosshair.js                  # Center reticle (circle + 4 dots)
│   └── utils/
│       ├── MathHelpers.js                # Vector pooling, mulberry32 seeded RNG
│       └── ShaderHelpers.js              # Common GLSL: snoise, fbm, gradient templates
```

No external assets — all textures and audio are procedurally generated:
- Star texture: `canvas`-generated soft round dot texture (avoids square PointsMaterial)
- Audio: all Web Audio API oscillator/noise synthesis (no .ogg/.mp3 files)
- Ship/asteroid meshes: procedural geometry

### Architecture Principles (from game-architecture skill)

1. **Orchestrator Pattern** — `Game.js` initializes all systems, runs main loop, manages flow.
2. **Event-Driven** — No direct cross-module imports for communication. All messaging through `EventBus`.
3. **Centralized State** — `GameState` singleton holds everything. Systems read/modify through events.
4. **Configuration Centralization** — Every value in `Constants.js`. Zero hardcoded numbers in logic.
5. **Restart-Safe** — `GameState.reset()` provides clean slate. All listeners removed in shutdown. Test: restart 3×.
6. **Delta-Time Normalized** — All movement uses `delta = Math.min(clock.getDelta(), 0.1)`. Capped to prevent tab-out death spiral.

---

## 4. Constants (all values)

```js
export const Constants = {
    // Game
    GAME_NAME: 'Void Drift',
    VERSION: '1.0.0',

    // Ship
    MAX_SHIP_SPEED: 80,           // units/s
    SHIP_ACCELERATION: 40,        // units/s²
    SHIP_DRAG: 0.98,              // per-frame multiplier (velocity *= drag when thrust released)
    SHIP_ROLL_SPEED: 3.0,         // rad/s
    MOUSE_LOOK_SPEED: 0.0025,     // rad per pixel, yaw & pitch (free flight)
    SHIP_SPAWN: { x: 0, y: 2, z: 0 },

    // Camera
    CAMERA_DISTANCE: 12,          // behind ship
    CAMERA_HEIGHT: 5,             // above ship
    CAMERA_FOV_REST: 75,          // normal FOV
    CAMERA_FOV_MAX: 95,           // FOV at max thrust
    CAMERA_DAMPING: 0.05,         // lerp factor per frame

    // Weapon
    FIRE_RATE: 8,                 // shots per second
    PROJECTILE_SPEED: 200,        // units/s
    PROJECTILE_LIFETIME: 3.0,     // seconds
    PROJECTILE_RANGE: 200,        // units (whichever reached first)
    PROJECTILE_DAMAGE: 25,

    // Health
    MAX_HEALTH: 100,
    COLLISION_THRESHOLD_LARGE: 2.0,  // size > this = large asteroid damage
    COLLISION_DAMAGE_LARGE: 20,
    COLLISION_DAMAGE_SMALL: 5,
    WARNING_HEALTH_THRESHOLD: 30,     // red vignette + warning beep below this
    DAMAGE_INVULNERABILITY: 0.75,     // seconds without damage after a hit
    ASTEROID_HP: { large: 100, medium: 50, small: 25 },  // 4 / 2 / 1 laser shots
    ASTEROID_DRIFT_MIN: 1,            // u/s base drift
    ASTEROID_DRIFT_MAX: 4,

    // Comets
    COMET_MIN_SCALE: 3,
    COMET_MAX_SCALE: 6,
    COMET_SPEED_MIN: 15,          // units/s (moderate speed)
    COMET_SPEED_MAX: 30,
    COMET_HP: 150,                // 6 laser shots
    COMET_DAMAGE: 25,             // ship collision damage
    COMET_SCORE: 100,
    COMET_TUMBLE_SPEED: 0.3,      // rad/s
    COMET_TRAIL_POOL: 800,        // global dust trail pool (shared across comets)
    COMET_SMOKE_POOL: 300,        // global smoke trail sprite pool (shared)
    COMET_CURVE_AMPLITUDE: 10,    // u, sinusoidal path deviation
    COMET_CURVE_WAVELENGTH: 150,  // u, sine wavelength
    COMET_MIN_DIST_FROM_SHIP: 150,// u, spawn fairness guard
    COMET_TRAIL_LIFETIME: 4.0,    // seconds
    COMET_SMOKE_LIFETIME: 6.0,    // seconds

    // Black holes
    BLACK_HOLE_RADIUS: 8,             // event horizon — anything closer is consumed
    BLACK_HOLE_GRAVITY_RADIUS: 150,   // influence radius (units)
    BLACK_HOLE_GRAVITY_STRENGTH: 2500,// acceleration = strength / distance² (capped at 120)
    BLACK_HOLE_SHIP_PULL_FACTOR: 0.5, // ship feels half the pull (escapable hazard)
    BLACK_HOLE_DISK_SPEED: 0.5,       // accretion disk rotation (rad/s)
    BLACK_HOLE_MAX_PULL: 120,         // u/s² gravity cap
    BLACK_HOLE_WARNING_RANGE: 40,     // u from the horizon surface
    BLACK_HOLE_MIN_DISTANCE: 3000,    // only spawns from Nebula Corridor onward

    // Dead stars (stellar remnants)
    DEAD_STAR_RADIUS_MIN: 25,         // great size — dwarfs everything else
    DEAD_STAR_RADIUS_MAX: 45,
    DEAD_STAR_GLOW_SCALE: 6,          // glow sprite radius × sphere radius
    DEAD_STAR_LIGHT_INTENSITY: 3.0,
    DEAD_STAR_LIGHT_RANGE: 600,       // visible from afar (crosses chunks)
    DEAD_STAR_LIGHT_COLOR: 0xff3322,
    DEAD_STAR_WARNING_RANGE: 60,      // from surface
    DEAD_STAR_MIN_SPACING: 1500,      // units between dead stars
    DEAD_STAR_MIN_DIST_FROM_SHIP: 400, // u, spawn fairness guard (they are huge)
    DEAD_STAR_EMBER_POOL: 100,        // surface ember particles

    // Wormhole tunnel
    WORMHOLE_TUNNEL_RADIUS: 40,       // inner opening radius (u)
    WORMHOLE_WALL_THICKNESS: 25,      // wall shell depth (u)
    WORMHOLE_BLUR_MAX_INTENSITY: 0.85,// blur strength at full penetration
    WORMHOLE_BLUR_FADE: 0.5,          // s, blur fade-out after exiting a wall

    // Space stations (decorative)
    STATION_MIN_SCALE: 12,            // hull length u
    STATION_MAX_SCALE: 20,
    STATION_MIN_DIST_FROM_SHIP: 300,  // u, spawn fairness guard

    // Screen shake
    SHAKE_DAMAGE_INTENSITY: 0.5,      // units of random offset
    SHAKE_DAMAGE_DURATION: 0.3,       // seconds
    SHAKE_EXPLOSION_INTENSITY: 0.8,
    SHAKE_EXPLOSION_DURATION: 0.5,
    SHAKE_DECAY_RATE: 4.0,            // exponential decay factor

    // World / chunks
    CHUNK_SIZE: 200,                  // units per chunk (square)
    CHUNKS_AHEAD: 3,                  // chunks spawned ahead of ship
    CHUNKS_BEHIND: 2,                 // chunks retained behind ship
    SHIP_FORWARD_AXIS: 'z',           // ship's forward axis is local -Z (heading is free)

    // Biomes (distance in units traveled)
    BIOMES: {
        OPEN_SPACE:       { range: [0, 1000],   asteroidDensity: 10,  nebulaCount: 2,  cometDensity: 3,  blackHoleDensity: 0,  deadStarDensity: 1,  stationDensity: 0,  color: [0.1, 0.15, 0.3] },
        ASTEROID_BELT:    { range: [1000, 3000], asteroidDensity: 40,  nebulaCount: 3,  cometDensity: 6,  blackHoleDensity: 0,  deadStarDensity: 2,  stationDensity: 2,  color: [0.4, 0.2, 0.1] },
        NEBULA_CORRIDOR:  { range: [3000, 5000], asteroidDensity: 20,  nebulaCount: 6,  cometDensity: 8,  blackHoleDensity: 4,  deadStarDensity: 3,  stationDensity: 3,  color: [0.3, 0.15, 0.4] },
        WORMHOLE:         { range: [5000, 7000], asteroidDensity: 60,  nebulaCount: 8,  cometDensity: 10, blackHoleDensity: 8,  deadStarDensity: 4,  stationDensity: 4,  color: [0.2, 0.1, 0.5] },
    },
    POST_7000_MULTIPLIER: 1.5,        // intensity multiplier for repeated biome cycles

    // Starfield
    STAR_LAYERS: {
        far:   { count: 5000, size: 0.5,  parallaxSpeed: 0.1,  color: [0.8, 0.85, 1.0] },
        mid:   { count: 2000, size: 1.0,  parallaxSpeed: 0.3,  color: [1.0, 0.95, 0.8] },
        near:  { count: 500,  size: 2.0,  parallaxSpeed: 0.8,  color: [1.0, 0.9, 0.7] },
    },
    BRIGHT_STAR_COUNT: 30,             // large stars with bloom pass

    // Post-processing
    BLOOM:   { strength: 1.5, radius: 0.4, threshold: 0.15 },
    VIGNETTE: { darkness: 0.5, offset: 0.2 },
    FILM_GRAIN: { intensity: 0.03 },
    CHROMATIC_ABERRATION_MAX: 0.003,   // max offset at top speed

    // Fog
    FOG_COLOR: 0x000011,
    FOG_DENSITY: 0.008,

    // Particles
    PARTICLE_POOLS: {
        exhaust:     { maxParticles: 200, lifetime: 0.8,  size: 0.3 },
        laserSpark:  { maxParticles: 50,  lifetime: 0.3,  size: 0.15 },
        explosion:   { maxParticles: 80,  lifetime: 1.2,  size: 0.4 },
        cometDust:   { maxParticles: 800, lifetime: 4.0,  size: 0.8 },  // shared across comets
        cometSmoke:  { maxParticles: 300, lifetime: 6.0,  size: 2.0 },
        ember:       { maxParticles: 100, lifetime: 2.0,  size: 0.3 },  // dead star surface
    },

    // Scoring
    SCORE_ASTEROID_BASE: 10,           // × size tier (small=1, medium=2, large=3)
    SCORE_DEBRIS: 1,
    SCORE_DISTANCE_DIVISOR: 10,        // 1 point per 10 units traveled
    DEBRIS_DENSITY_FACTOR: 0.4,        // debrisCount = round(asteroidDensity × this)

    // Performance targets
    MAX_DRAW_CALLS: 50,
    MAX_TRIANGLES: 200000,
    MAX_INSTANCED_OBJECTS: 2000,
    DPR_MAX: 2,
    TARGET_FPS: 60,
    MIN_ACCEPTABLE_FPS: 30,
};
```

---

## 5. Visual Effects Master Plan

### 5.1 Starfield (Multi-Layer Parallax)

| Layer | Count | Size | Speed | Color | Visual Goal |
|-------|-------|------|-------|-------|-------------|
| Far background | 5,000 | 0.5 | 0.1× | Blue-white tint | Distant stars, depth anchor |
| Mid layer | 2,000 | 1.0 | 0.3× | Slight warm variation | Standard star field |
| Near layer | 500 | 2.0 | 0.8× | Warm white, perlin-noise twinkle | Speed sensation |
| Bright stars | 30 | 3.0-5.0 | — | White, bloom pass | Light sources, visual anchors |

**Implementation:** `THREE.Points` with custom `ShaderMaterial` (vertex + fragment). Single `BufferGeometry` with attributes for size, color, alpha per layer. Near-layer twinkle via perlin noise on alpha in fragment shader.
Star materials render with `fog: false` so exponential fog never swallows the background.

### 5.2 Nebula Clouds (Volumetric Feel)

Billboarded sprite clusters (8-12 overlapping billboards per cluster) with custom GLSL fragment shader using 3D simplex noise. `nebulaCount` clusters per chunk (2/3/6/8 by biome, see §5.8). Biome-dependent color palettes. Animated via `uTime` uniform (slow drift + pulse). See §10 for GLSL reference.

### 5.3 Dynamic Lighting

| Light | Type | Intensity | Purpose |
|-------|------|-----------|---------|
| Ambient | AmbientLight | 0.05 | Base visibility |
| Directional | DirectionalLight | 0.3 | Shading on asteroids |
| Nebula cores | PointLight[] (≤4/chunk) | 0.8-1.5 | Local illumination, color accents |
| Ship headlight | SpotLight (cone ahead) | 1.0, range 30 | Illuminates path, reveals debris |
| Ship accent | PointLight (below ship) | 0.4, blue/purple | Rim glow, cinematic feel |
| Dead stars | PointLight (at core) | 3.0, range 600, red | Landmark glow, tints nearby objects |

Materials: `MeshStandardMaterial` with roughness 0.8-1.0, metalness 0.1-0.3.

### 5.4 Post-Processing Pipeline

Render through `EffectComposer`:
1. **RenderPass** — Base scene render.
2. **UnrealBloomPass** — Strength 1.5, radius 0.4, threshold 0.15.
3. **ChromaticAberrationPass** — Custom ShaderPass (RGB channel offset scaling with ship velocity, max 0.003 at top speed). Skip on low-end devices.
4. **Vignette** — Custom ShaderPass: darken edges, darkness 0.5, offset 0.2.
5. **FilmGrainPass** — Custom ShaderPass: noise overlay, intensity 0.03. Skip on low-end.
6. **WormholeBlurPass** — Custom ShaderPass, active only while the ship is inside a wormhole wall shell: gaussian blur + UV distortion + chromatic fringe, intensity ramps with wall penetration, fades 0.5 s after exit. Single full-screen pass, runs on all devices.

Low-end device detection: `navigator.hardwareConcurrency < 4` → skip chromatic aberration and film grain.

### 5.5 Particle Systems

| System | Technique | Pool size | Lifetime | Size |
|--------|-----------|-----------|----------|------|
| Ship exhaust trail | Points + custom shader, velocity attribute | 200 | 0.8s | 0.3 |
| Engine flame | Cone geometry + ShaderMaterial (flickering noise) | — | — | — |
| Laser impact spark | Burst particles, fade out | 50 | 0.3s | 0.15 |
| Destruction explosion | Expanding sphere, color fade yellow→red→black | 80 | 1.2s | 0.4 |
| Debris fragments | Small InstancedMesh shards with simple physics | 100 | 2.0s | 0.1-0.5 |
| Comet dust trail | Points, emitted behind nucleus | 800 (shared) | 4.0s | 0.5-1.2 |
| Comet smoke trail | Soft dark-grey sprites, slowly expanding | 300 (shared) | 6.0s | 1.5-2.5 |
| Dead star embers | Faint rising sparks | 100 | 2.0s | 0.3 |

Object pooling: pre-allocate, reset to origin on reuse. Update via `BufferAttribute` each frame (no allocations in the loop).

### 5.6 Ship Visual Design

- Low-poly fighter: elongated fuselage with swept wings and tail fins
- Cockpit: small glass canopy with `MeshPhysicalMaterial` (transmission, roughness 0.1)
- Engine nacelles: glowing exhaust cones (emissive) on each side
- Wingtip lights: small emissive spheres (red port / green starboard)
- All materials PBR: `MeshStandardMaterial` / `MeshPhysicalMaterial`

### 5.7 Asteroid & Debris Generation

| Type | Geometry | Scale range | Instanced |
|------|----------|-------------|-----------|
| Large asteroid | IcosahedronGeometry + vertex displacement (noise) | 2-5u | No (individual) |
| Medium asteroid | DodecahedronGeometry + vertex displacement | 0.8-2u | Yes (InstancedMesh) |
| Small rocks | OctahedronGeometry + vertex displacement | 0.2-0.8u | Yes (InstancedMesh) |
| Debris | BoxGeometry (random aspect ratios) | 0.05-0.3u | Yes (InstancedMesh) |
| Space junk | CylinderGeometry (broken, rotated) | 0.1-0.5u | Yes (InstancedMesh) |

Vertex displacement via simplex noise during geometry creation. Per-instance color via `InstancedMesh.setColorAt()`.

### 5.8 Biome-Specific Visuals

| Biome | Distance | Asteroid density | Nebula count | Comets | Black holes | Dead stars | Stations | Colors | Visual signature |
|-------|----------|-----------------|--------------|--------|-------------|------------|----------|--------|-----------------|
| Open space | 0-1000 | 10/chunk | 2 | 3/chunk | 0 | 1%/chunk | 0 | Blue-black | Sparse stars, 1-2 small nebulae |
| Asteroid belt | 1000-3000 | 40/chunk | 3 | 6/chunk | 0 | 2%/chunk | 2%/chunk | Orange/red | Dense rocks, warm nebula, debris, comet streaks |
| Nebula corridor | 3000-5000 | 20/chunk | 6 | 8/chunk | 4%/chunk | 3%/chunk | 3%/chunk | Multi-hue | Billowing clouds, comet trails, first black holes |
| Wormhole | 5000-7000 | 60/chunk | 8 | 10/chunk | 8%/chunk | 4%/chunk | 4%/chunk | Purple/blue/cyan | Curved tunnel, vortex, black hole accretion glow |
| 7000+ repeat | — | ×1.5 all | ×1.5 all | ×1.5 | ×1.5 | ×1.5 | ×1.5 | All | Biome cycle repeats with increased intensity |

### 5.9 Speed & Motion Effects

- **FOV breathing**: Camera FOV 75° → 95° proportional to thrust fraction
- **Star streaking**: Near-layer particle size scales with speed
- **Camera shake**: Random offset added to camera position, exponential decay (factor 4.0). Triggered on damage (intensity 0.5, 0.3s) or nearby explosion (intensity 0.8, 0.5s)
- **Ship exhaust**: Visible particle trail during thrust, stops when thrust released

### 5.10 Atmospheric Haze

`scene.fog = new THREE.FogExp2(0x000011, 0.008)` — exponential fog. Distant objects fade naturally. Nebula density increases slightly with fog for seamless blending.

### 5.11 Comet Visuals

- **Nucleus**: IcosahedronGeometry + simplex displacement, 3-6 u, ice-blue/rocky PBR (roughness 0.9, metalness 0.1, faint bluish emissive tint), slow tumble (`COMET_TUMBLE_SPEED`).
- **Coma**: soft billboard sprite ~2.5× nucleus radius, pale cyan, additive blending, subtle pulse.
- **Dust tail**: particle stream emitted behind the nucleus (yellowish-white, additive), pool 400, lifetime 4 s, sized 0.5-1.2 u.
- **Ion tail**: thin elongated stretched sprite aligned with the velocity vector, electric blue, additive, low opacity.
- **Smoke trail**: 200 soft dark-grey sprites, lifetime 6 s, semi-transparent, slowly expanding — the "smoke" behind the comet.
- Trails bend slightly when the comet is inside a black hole's gravity well (trajectory curves toward the hole).

### 5.12 Black Hole Visuals

- **Event horizon**: sphere, radius 8 u, pure black (`MeshBasicMaterial` 0x000000, renders black regardless of light).
- **Photon ring**: thin torus at ~1.5× horizon radius, emissive orange-white, bloom glow.
- **Accretion disk**: RingGeometry (inner ~1.2×, outer ~3× horizon radius) with custom ShaderMaterial — radial falloff, Doppler beaming (approaching side visibly brighter), palette white→yellow→orange, rotating via uTime (`BLACK_HOLE_DISK_SPEED`).
- **Consumption flash**: when any object crosses the horizon, a quick radial flash + brief disk flare (0.2 s) — the object is gone, no explosion debris.
- Distant objects near the hole appear subtly lensed (cheap approximation: slight vertex bulge on the disk shader only; full screen-space lensing is a stretch goal).

### 5.13 Dead Star Visuals

- **Body**: huge sphere, radius 25-45 u, `MeshStandardMaterial` deep red-black (color 0x1a0505, emissive 0x4a0d0d) with pulsing emissive intensity (0.4-1.2, simplex noise — a dying ember).
- **Surface detail**: canvas-generated emissive map with patchy hot cracks (dark reds on near-black) so the sphere reads as cooling crust, not a flat ball.
- **Glow sprite**: billboard 6× sphere radius, dark-red radial gradient, additive, `fog: false` — visible from afar even in fog.
- **Light**: red PointLight (intensity 3, range 600, decay 2) — radiates light across several chunks, tinting nearby asteroids and nebulae.
- **Ember particles**: faint rising sparks (pool 100, lifetime 2 s) drifting off the surface.

---

## 6. Gameplay Systems

### 6.1 Player Ship

- **Free flight**: the ship has a free 3D heading (yaw + pitch). Mouse X = yaw, mouse Y = pitch at `MOUSE_LOOK_SPEED`; heading rotates smoothly and the camera reorients behind it with damping. A/E keys roll (visual + slight turn assist — no lift physics).
- **Movement**: Inertia-based. Thrust (Z key held) → acceleration at `SHIP_ACCELERATION` **along the ship's local -Z axis**. Release → velocity decays at `SHIP_DRAG` multiplier per frame.
- **Max speed**: Capped at `MAX_SHIP_SPEED` (80 units/s).
- **Strafing**: Q/D for lateral movement along the ship's local X axis at same acceleration/drag.
- **Forward direction**: fully player-controlled heading; camera trails behind the heading (CAMERA_DISTANCE / CAMERA_HEIGHT in ship-local space, damped).
- **Camera roll**: the camera does NOT inherit ship roll — it eases back toward world-up, preventing disorientation during rolls.

### 6.2 Weapon System

- Fire: Space or left click → single laser burst. Rate-limited to `FIRE_RATE` (8 shots/s).
- Projectile: visible glowing beam (thin CylinderGeometry, emissive + bloom), travels forward relative to ship heading.
- Speed: 200 units/s. Lifetime: 3s OR range 200 units (whichever first).
- Destructible targets: asteroids, rocks, debris, comets. Non-destructible: space stations, wormhole walls (pass-through + blur, see §6.3), black holes (projectiles swallowed by the event horizon with no effect), dead stars (lasers spark harmlessly on the surface).
- Impact feedback: spark particles (10-20, 0.3s fade) + screen flash + explosion sound.
- Asteroid HP: large 100 / medium 50 / small 25 → 4 / 2 / 1 shots at 25 dmg.

### 6.3 Procedural World Generation

**Chunk-based infinite world:**
- Chunk size: 200×200 units
- 3 chunks spawned ahead of ship, 2 retained behind
- Seeded RNG (mulberry32) with chunk coordinates as seed → deterministic regeneration

**Per-chunk content:**
1. Starfield particles (full-scene, not per-chunk)
2. Nebula cloud clusters (0-3 per chunk, biome-dependent)
3. Asteroid field (density per biome × seeded randomization)
4. Debris objects (density per biome × seeded randomization)
5. Biome decorations (wormhole tunnel geometry for WORMHOLE biome)
6. Comets (`cometDensity` per biome × seeded randomization)
7. Black holes (`blackHoleDensity` % chance per chunk, NEBULA_CORRIDOR onward only)
8. Dead stars (`deadStarDensity` % chance per chunk, max 1 per chunk, min 1500 u spacing)

**Wormhole tunnel**: `TubeGeometry` along a curved CatmullRom path through the chunk. Walls use custom ShaderMaterial with swirling UV distortion. Particle vortex (200+ particles) spiraling through center. **Walls are pass-through**: flying inside the wall shell (distance from centerline between `WORMHOLE_TUNNEL_RADIUS` and `WORMHOLE_TUNNEL_RADIUS + WORMHOLE_WALL_THICKNESS`) triggers the WormholeBlurPass — heavy blur + distortion, intensity ramps with penetration, fades `WORMHOLE_BLUR_FADE` after exiting. No damage, no slowdown — the opening is the comfortable path, cutting through a wall is the shortcut with a visual cost.

**Intensity scaling** (within each biome zone, linear interpolation):
- Asteroid count × (1 + distance/5000)
- Nebula density × (1 + distance/8000)
- Asteroid speed × (1 + distance/6000)
- Comet count × (1 + distance/5000)
- Black hole pull × (1 + distance/8000), capped at 2×

**World rules:**
- Biome distance = cumulative odometer (monotonic — never regresses on backward flight).
- Content spawns in a Y band of ±60 u around the ship's Y (chunk grid tracks X/Z only).
- Asteroid base drift: 1-4 u/s in a random direction + slow tumble; speed scales ×(1 + distance/6000).
- Debris count per chunk: `round(asteroidDensity × DEBRIS_DENSITY_FACTOR)`, seeded.
- Fairness guards: comets spawn ≥ 150 u from the ship; dead stars ≥ 400 u (they are huge).

### 6.4 Score System

- Asteroid destroyed: 10 × size tier (small=1, medium=2, large=3)
- Debris destroyed: 1
- Comet destroyed: 100
- Distance: 1 per 10 units traveled
- High score persisted in `localStorage` key `void_drift_highscore`

### 6.5 Health System

- Health: 100 points.
- Collision with asteroid > 2 units: -20 + screen shake + red flash
- Collision with asteroid ≤ 2 units or debris: -5
- Collision with comet: -25
- After any hit: `DAMAGE_INVULNERABILITY` (0.75 s) — no damage during the window
- Black hole horizon or dead star surface contact: instant death (bypasses invulnerability)
- Health < 30: red vignette pulse overlay, warning beep
- Health = 0: death dissolve → game over screen → Press R to restart
- No health regeneration during gameplay

### 6.6 Comets

- Big icy/rocky bodies, 3-6 u, flying at a moderate 15-30 u/s in a mostly straight line with a slight sinusoidal curve.
- Leave two persistent trails: dust particle trail (4 s fade) and smoke sprite trail (6 s fade, slowly expanding).
- Destructible: 150 HP (6 laser shots), ship collision damage 25, score 100. On destruction: large explosion + score + shake (bigger than an asteroid).
- Trajectory is bent by black hole gravity — a comet can be pulled off course and consumed.
- Spawn per chunk at `cometDensity` (3/6/8/10 per biome), seeded, ≥ 150 u from the ship. Comets do not collide with asteroids (pass through).

### 6.7 Black Holes

- Rare gravitational anomalies; spawn from Nebula Corridor onward (`blackHoleDensity` 4% / 8% chance per chunk, never in Open Space or Asteroid Belt).
- **Gravity well**: every asteroid, comet, and debris object within `BLACK_HOLE_GRAVITY_RADIUS` (150 u) accelerates toward the center with `a = BLACK_HOLE_GRAVITY_STRENGTH / d²` (capped at 120 u/s²). **The closer, the stronger the pull.**
- **Ship**: feels the same pull × `BLACK_HOLE_SHIP_PULL_FACTOR` (0.5) — a real hazard that must be thrust against, but escapable at the edge of the well.
- **Consumption**: any object (asteroid, comet, debris, projectile, ship) crossing `BLACK_HOLE_RADIUS` (8 u) disappears with a brief accretion flash. No explosion debris, no score.
- Ship consumed → instant death, death screen title "CONSUMED BY A BLACK HOLE".
- Black holes cannot be damaged or destroyed. Wormhole biome can contain both a tunnel and a black hole.
- **Warning**: pulsing red "⚠ EVENT HORIZON" HUD text within `BLACK_HOLE_WARNING_RANGE` (40 u) of the horizon surface.

### 6.8 Dead Stars

- Rare stellar remnants: **dark red, radiating light**, enormous (25-45 u radius). Spawn via `deadStarDensity` % chance per chunk — 1% Open Space, 2% Asteroid Belt, 3% Nebula Corridor, 4% Wormhole. Max one per chunk, minimum 1500 u spacing between dead stars, ≥ 400 u from the ship.
- **Landmark only**: no gravity, no destruction, no score. Comets and asteroids pass by unaffected.
- **Collision**: touching the surface = instant death (PLAYER_DIED reason `dead_star`), death screen "VAPORIZED BY A DEAD STAR".
- **Warning**: pulsing red "⚠ STELLAR REMNANT" HUD text within 60 u of the surface.
- **Visible from afar**: red point light (range 600) + 6× glow sprite with bloom — spot it from several chunks away and steer around it.

### 6.9 Space Stations (decorative)

- Rare artificial structures, spawn via `stationDensity` % chance per chunk (0% Open Space, 2% Asteroid Belt, 3% Nebula Corridor, 4% Wormhole), max 1 per chunk, ≥ 300 u from the ship. Seeded.
- **Look**: procedural station — central cylindrical hull (length 12-20 u), torus ring around the middle, emissive window bands, slow rotation, blinking beacon light (small emissive sphere). Grey/blue PBR.
- **Behavior**: decorative and non-destructible — no score, lasers spark off the hull, collision = 20 dmg (solid, like a large asteroid).
- **Future-proofing**: stations are standalone entities with stable IDs in a world registry, deliberately kept out of the chunk-cleanup path (persist while in range) and data-modeled rather than ad-hoc — a later version may give them real functionality (landing, trading, refuel).

---

## 7. UI / HUD

All UI is HTML/CSS DOM overlay on top of canvas (not 3D objects).

| Element | Position | Content |
|---------|----------|---------|
| Score | Top-left | `SCORE: 12,450` |
| Distance | Top-center | `DISTANCE: 3,200 u` |
| Health bar | Bottom-center | Horizontal bar: green (>50) → yellow (30-50) → red (<30) with pulse animation |
| Crosshair | Center | Subtle reticle: thin circle (radius 12px) + 4 dots (NSEW), white at 50% opacity |
| Biome indicator | Top-right | Current biome name, fades in/out on transition |
| Speed indicator | Bottom-left | Small bar showing thrust fraction |
| Event horizon warning | Center-bottom | Pulsing red "⚠ EVENT HORIZON" text when ship is within 40 u of the horizon surface |
| Stellar remnant warning | Center-bottom | Pulsing red "⚠ STELLAR REMNANT" text when ship is within 60 u of a dead star's surface |

### Death Screen

Appears when health reaches 0 after 1s delay (or instantly on black hole / dead star contact). Shows:
- Title by cause: "SHIP DESTROYED" (collision/health), "CONSUMED BY A BLACK HOLE", "VAPORIZED BY A DEAD STAR"
- Final score
- Distance traveled
- High score (with "NEW!" if beaten)
- "Press R to restart"

---

## 8. Audio System

All audio is procedurally synthesized via Web Audio API oscillators and noise. **No external audio files required.**

| Sound | Trigger | Technique |
|-------|---------|-----------|
| Engine rumble | Always (while alive) | Low-freq sawtooth (60Hz) + low-pass filter (200Hz), volume scales with thrust fraction |
| Laser shot | Fire event | Short white noise burst (50ms) + frequency sweep 800→200Hz |
| Explosion | Destruction event | White noise burst, low-pass filter, 0.5s exponential decay |
| Collision hit | Damage event | Low thud: sine 100Hz, 0.3s decay, slight distortion |
| Warning beep | Health < 30 | 800Hz sine, 3 pulses (50ms on, 150ms off), repeating every 2s |
| Biome transition | Zone change | Rising arpeggio: 3 sine tones (200, 300, 500Hz), 0.3s each |
| Black hole consumption | Object crosses horizon | Descending sweep 300→60Hz (0.4s) + low sub thump |
| Comet destruction | Comet destroyed | Deep rumble + crackle burst (noise, low-pass 400Hz, 0.6s) |

**Spatial audio**: explosion sounds panned based on direction from ship (optional).

**Mute**: M key toggles all audio. Mute state indicated by small 🔊/🔇 icon top-right.

---

## 9. Test Strategy

### 9.1 Quick Verification

| Criterion | Method |
|-----------|--------|
| Boot | Open page → scene renders → stars visible → no console errors within 5s |
| Ship moves | Press Z → ship position changes forward (-Z) |
| Shooting | Press Space → laser spawns → travels → despawns at range |
| Destruction | Shoot asteroid → removed → particles spawn → score increases |
| Restart | Restart 3× → identical starting state → no memory growth |
| Bloom | Bright objects have visible glow halos |
| Fog | Distant objects fade to background color |
| Parallax | Move ship → star layers move at different speeds |
| Performance | 60s gameplay → FPS never drops below 30 |

### 9.2 Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Frame rate | ≥ 60fps on mid-range GPU | `performance.now()` delta |
| Draw calls | ≤ 50 | `renderer.info.render.calls` |
| Triangles | ≤ 200K | `renderer.info.render.triangles` |
| Memory growth | < 10MB over 5 min | DevTools heap snapshot |
| Load time | < 3s to first frame | `performance.mark` |

---

## 10. GLSL Reference Functions

### 10.1 3D Simplex Noise

```glsl
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
```

### 10.2 Fractal Brownian Motion (fBm)

```glsl
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
```

---

## 11. EventBus Event Catalog

```js
export const Events = {
    // Game flow
    GAME_STARTED:       'game:started',
    GAME_PAUSED:        'game:paused',
    GAME_RESUMED:       'game:resumed',
    GAME_OVER:          'game:over',
    GAME_RESTART:       'game:restart',

    // Player
    PLAYER_THRUST:      'player:thrust',          // { thrustFraction }
    PLAYER_THRUST_END:  'player:thrustEnd',
    PLAYER_DAMAGED:     'player:damaged',         // { amount, source, newHealth }
    PLAYER_DIED:        'player:died',            // { reason: 'collision' | 'black_hole' | 'dead_star' }
    PLAYER_HEALTH_CHANGED: 'player:healthChanged', // { health, maxHealth }

    // Weapon
    WEAPON_FIRED:       'weapon:fired',           // { position, direction }
    WEAPON_HIT:         'weapon:hit',             // { target, position }
    WEAPON_DESPAWNED:   'weapon:despawned',

    // Environment
    ASTEROID_DESTROYED: 'environment:asteroidDestroyed', // { position, size, score }
    DEBRIS_DESTROYED:   'environment:debrisDestroyed',
    COMET_DESTROYED:    'environment:cometDestroyed',    // { position, score }
    OBJECT_CONSUMED:    'environment:objectConsumed',    // { objectType, position } — asteroid/comet/debris eaten by a black hole
    BLACK_HOLE_SPAWNED: 'environment:blackHoleSpawned',  // { position, radius }
    DEAD_STAR_SPAWNED:  'environment:deadStarSpawned',   // { position, radius }
    STATION_SPAWNED:    'environment:stationSpawned',    // { position, scale }
    CHUNK_SPAWNED:      'environment:chunkSpawned',     // { chunkX, chunkZ }
    CHUNK_CLEANED:      'environment:chunkCleaned',
    BIOME_CHANGED:      'environment:biomeChanged',     // { from, to }

    // Score
    SCORE_CHANGED:      'score:changed',          // { score, delta, reason }
    HIGH_SCORE_SAVED:   'score:highScoreSaved',   // { score }

    // Audio
    AUDIO_PLAY:         'audio:play',             // { sound, volume, pan }
    AUDIO_STOP:         'audio:stop',
    AUDIO_MUTED:        'audio:muted',            // { muted }

    // Visual
    SCREEN_SHAKE:       'visual:shake',           // { intensity, duration }
    SCREEN_FLASH:       'visual:flash',           // { color, duration }
    WARNING_PULSE:      'visual:warningPulse',    // { active }
};
```

---

## 12. Build & Run Commands

```bash
npm run dev       # Development with HMR
npm run build     # Production build
npm run preview   # Preview production build
```

---

## 13. Known Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| Memory leaks from undisposed geometries | `.dispose()` on all geometries, materials, textures in cleanup |
| GC stutters from allocations in loop | Pre-allocate vectors/matrices/particles. Zero `new` in animation loop |
| Too many draw calls | InstancedMesh for repeated objects. Merge static geometries |
| Z-fighting | Use near=0.1 (not 0.001). Adjust far to cover world |
| Mobile black screen (shader precision) | `precision mediump float` in shaders, wrap highp in `#ifdef` |
| WebGL context loss | Listen for `webglcontextlost`/`restored`, re-init on restore |
| HiDPI blur | `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` |
| Tab-out death spiral | `delta = Math.min(clock.getDelta(), 0.1)` |
| Stale event listeners on restart | Store unsubscribe functions, call all in `shutdown()` |
| AZERTY keyboard issues | Use `event.code` everywhere. ZQSD + A/E documented as primary |
| Space key fires AND mutes | Mute is M key only. Space is fire only. Documented separately |
| No audio files | All audio is procedural Web Audio synthesis. No .ogg/.mp3 |
| No external textures | Star texture generated via canvas. Ships/asteroids are procedural geometry |
| Post-processing passes not in three/addons | Vignette, film grain, chromatic aberration are custom ShaderPass implementations |
| Gravity loop cost | Cap gravity iterations per frame (e.g. 32 bodies/frame), use squared distances, skip bodies beyond GRAVITY_RADIUS |
| Camera disorientation in free flight | Keep camera lerp smooth (CAMERA_DAMPING), never snap; roll is visual only |
| Comet trail overdraw | Trails are additive/dark sprites with short lifetimes — pooling keeps draw calls flat |
| Many point lights | Dead star + nebula lights are the only dynamic lights — cull by range (dead star range 600, decay 2), keep ≤ 8 active |
| Wormhole blur pass cost | Single full-screen pass driven by one intensity uniform; render only while ship is inside a wall shell |

---

## 14. Stretch Goals (Post-MVP)

1. Holographic UI elements — scanline-effect overlay shader
2. Dynamic god rays — screen-space light shafts from nebula cores
3. Speed distortion — vertex displacement near ship at high speed
4. Cosmic background radiation — subtle static/noise texture overlay
5. Procedural music — Web Audio generative ambient soundscape
6. Speed run leaderboard — distance-based records
7. Photo mode — pause + free camera + screenshot
8. Shader-based wormhole vortex — full-screen tunnel distortion post-process
9. Full-screen gravitational lensing — screen-space distortion around black holes

---

## 15. Acceptance Criteria (Agent Checklist)

### Phase 1 — Foundation
- [ ] P1.1 `npm install`, `npm run dev`, `npm run build` all succeed
- [ ] P1.2 Full-screen canvas renders, HiDPI, responsive resize
- [ ] P1.3 Scene with dark background + fog, camera + renderer instantiated
- [ ] P1.4 RAF loop runs, delta-time measured and capped at 0.1s
- [ ] P1.5 No console errors on boot

### Phase 2 — Core Architecture
- [ ] P2.1 Game.js orchestrator, EventBus, GameState, Constants all exist
- [ ] P2.2 Event-driven communication (no direct cross-module imports)
- [ ] P2.3 GameState.reset() clears all state cleanly
- [ ] P2.4 Zero magic numbers in game logic (verify via grep)
- [ ] P2.5 Delta-time normalization with 0.1s cap

### Phase 3 — Ship & Controls
- [ ] P3.1 Ship mesh visible: fuselage, wings, engines, cockpit
- [ ] P3.2 ZQSD movement: translation in correct directions
- [ ] P3.3 Inertia physics: smooth acceleration, no instant-turn
- [ ] P3.4 Max speed cap enforced (80 units/s)
- [ ] P3.5 A/E roll keys: smooth interpolated roll
- [ ] P3.6 Camera follows ship with damping, cinematic offset
- [ ] P3.7 Free flight: mouse yaw/pitch rotates heading, thrust follows local -Z
- [ ] P3.8 Camera reorients behind ship heading with damping, no snapping

### Phase 4 — Starfield
- [ ] P4.1 Three-layer parallax starfield visible
- [ ] P4.2 Custom ShaderMaterial per layer, single draw call each
- [ ] P4.3 30 bright stars with visible bloom halos
- [ ] P4.4 Fog active: distant objects fade to background
- [ ] P4.5 Scene background is dark (0x000011), not pure black

### Phase 5 — Nebulae
- [ ] P5.1 Nebula clusters visible: 8-12 billboards each
- [ ] P5.2 Noise-based color gradients, animated via uTime
- [ ] P5.3 Biome-dependent colors
- [ ] P5.4 Nebula density increases with distance

### Phase 6 — Asteroids & Debris
- [ ] P6.1 Procedural asteroids with vertex displacement
- [ ] P6.2 InstancedMesh for medium/small objects
- [ ] P6.3 PBR materials with per-instance color variation
- [ ] P6.4 Debris objects: varied shapes, slow rotation
- [ ] P6.5 Directional light + ship spotlight visible on asteroids

### Phase 7 — Shooting & Destruction
- [ ] P7.1 Laser fires and travels forward from ship
- [ ] P7.2 Fire rate limited to 8 shots/s
- [ ] P7.3 Laser visual: glowing beam with emissive + bloom
- [ ] P7.4 Shooting asteroid removes it from scene
- [ ] P7.5 Explosion particles: 40-80 expanding, color fading
- [ ] P7.6 Screen shake or flash on destruction
- [ ] P7.7 Score updates in HUD
- [ ] P7.8 Projectiles despawn at range limit or lifetime

### Phase 8 — Post-Processing
- [ ] P8.1 Bloom active: bright objects glow
- [ ] P8.2 Bloom tuned: strength 1.5, radius 0.4, threshold 0.15
- [ ] P8.3 Chromatic aberration at high speed (skip on low-end)
- [ ] P8.4 Vignette: edges darkened
- [ ] P8.5 Film grain visible (skip on low-end)
- [ ] P8.6 FOV breathing: 75° → 95° under thrust
- [ ] P8.7 Ship exhaust trail during thrust
- [ ] P8.8 Engine flame with flickering shader

### Phase 9 — World Generation
- [ ] P9.1 Chunk system: spawn ahead, cleanup behind
- [ ] P9.2 Seamless transitions at chunk boundaries
- [ ] P9.3 Seeded RNG: same coords = same content
- [ ] P9.4 Biome variation: distinct visual signatures
- [ ] P9.5 Infinite exploration: no environment end
- [ ] P9.6 Wormhole walls pass-through: blur pass ramps in/out with penetration, no damage

### Phase 10 — Game Flow
- [ ] P10.1 Health system: collision damage, health bar update
- [ ] P10.2 Game over at 0 health: death screen with score
- [ ] P10.3 Restart (R key): clean reset, all state fresh
- [ ] P10.4 3× restart test: identical results, no memory leaks
- [ ] P10.5 High score persists via localStorage

### Phase 11 — Audio
- [ ] P11.1 Engine rumble: continuous, volume scales with thrust
- [ ] P11.2 Laser sound on fire
- [ ] P11.3 Explosion sound on destruction
- [ ] P11.4 Warning beep when health < 30
- [ ] P11.5 M key toggles mute, indicator icon visible

### Phase 12 — Performance & Polish
- [ ] P12.1 ≥ 60fps sustained for 60s gameplay
- [ ] P12.2 Draw calls ≤ 50
- [ ] P12.3 Triangles ≤ 200K
- [ ] P12.4 No memory leaks (< 10MB growth over 5 min)
- [ ] P12.5 Touch controls functional
- [ ] P12.6 Responsive canvas on window resize
- [ ] P12.7 Zero console errors
- [ ] P12.8 `npm run build` succeeds
- [ ] P12.9 Visual "wow" factor: dense, layered, atmospheric

### Phase 13 — Comets & Black Holes
- [ ] P13.1 Comets visible: 3-6 u nuclei with dust + smoke trails, moving 15-30 u/s
- [ ] P13.2 Comets destructible: 150 HP, 100 score, collision damage 25
- [ ] P13.3 Black holes spawn in Nebula Corridor+, accretion disk + photon ring visible
- [ ] P13.4 Gravity: asteroids/comets/debris accelerate toward hole — stronger when closer
- [ ] P13.5 Objects consumed at event horizon: disappear with flash, no debris
- [ ] P13.6 Ship pulled (weakly) near a hole; touching horizon = death "CONSUMED BY A BLACK HOLE"
- [ ] P13.7 Projectiles swallowed by horizon; hole indestructible
- [ ] P13.8 Event horizon warning shows within 40 u of horizon

### Phase 14 — Dead Stars
- [ ] P14.1 Dead stars visible: huge dark-red spheres radiating red light, glow visible from afar
- [ ] P14.2 Ember pulse: emissive surface flickers, ember particles drift off surface
- [ ] P14.3 Spawn rare (1-4%/chunk), max 1 per chunk, min 1500 u spacing
- [ ] P14.4 Collision = instant death "VAPORIZED BY A DEAD STAR"
- [ ] P14.5 Indestructible, no score; lasers spark on surface
- [ ] P14.6 "⚠ STELLAR REMNANT" warning within 60 u of surface

### Phase 15 — Space Stations
- [ ] P15.1 Stations visible in Asteroid Belt+ biomes: hull + ring + emissive windows + beacon
- [ ] P15.2 Decorative: non-destructible, no score, lasers spark off hull, 20 dmg collision
- [ ] P15.3 Max 1 per chunk, ≥ 300 u from ship; registered with stable IDs for future features

---

*This specification is the source of truth for building the space exploration game. All visual, architectural, and gameplay decisions should reference back to these criteria.*