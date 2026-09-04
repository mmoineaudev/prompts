# Void Drift C++ — Architecture Specification (v1.0.0)

---

## 1. High-level design

Desktop OpenGL 4.6 application. GLFW 3.4 for window/input, GLM 4.x for
math, Dear ImGui 1.91+ for HUD overlay, OpenAL + libsndfile for audio,
nlohmann/json for config persistence. CMake build system, C++17.

The game is a **system graph**: one `Game` class owns and drives all
subsystems in a fixed update order. Subsystems communicate exclusively via
the `EventBus` singleton. There is no global mutable state object beyond
`GameState` (a plain data struct) and the `EventBus` itself.

```
main.cpp
  └─ Game (core/Game.hpp)
       ├─ InputSystem        (systems/)
       ├─ PlayerShip         (gameplay/)
       ├─ WeaponSystem       (gameplay/)
       ├─ ScoreSystem        (gameplay/)
       ├─ PhysicsSystem      (systems/)
       ├─ CameraSystem       (systems/)
       ├─ ChunkManager       (level/)
       │    └─ BiomeGenerator (level/)
       │         ├─ AsteroidField
       │         ├─ CometSystem
       │         ├─ BlackHoleSystem
       │         ├─ DeadStarSystem
       │         ├─ NebulaSystem
       │         ├─ StationSystem
       │         ├─ DebrisSystem
       │         ├─ CrystalSystem
       │         ├─ PulsarSystem
       │         ├─ StormSystem
       │         ├─ HulkSystem
       │         └─ CitySystem
       ├─ ParticleSystem     (systems/)
       ├─ Starfield          (level/)
       ├─ PostProcessingSystem (systems/)
       ├─ LightManager       (systems/)
       ├─ AdaptiveQuality    (systems/)
       ├─ AudioSystem        (systems/)
       ├─ HUD                (ui/)
       ├─ LadderChart        (ui/)
       ├─ Crosshair          (ui/)
       └─ DeathScreen        (ui/)
```

---

## 2. File structure

```
CMakeLists.txt              — build system (CMake, C++17)
launch.sh                   — build + run launcher

data/
  config.json               — user persistence (high score, mute, light profile)

shaders/
  star.vert / star.frag    — starfield points (size, twinkle, soft dot)
  nebula.vert / nebula.frag — nebula fbm billboards
  disk.vert / disk.frag    — black hole accretion disk (Doppler)
  snoise.glsl              — simplex noise + fBm (inlined into nebula)
  particle.vert / particle.frag — particle points (size, alpha, color)
  vignette.frag            — screen vignette
  grain.frag               — film grain (time-driven hash)
  ca.frag                  — speed chromatic aberration
  wormhole_blur.frag       — wormhole blur + swirl + fringe
  bloom.vert / bloom.frag  — post-processing bloom
  base.vert / base.frag    — standard PBR-ish diffuse + specular + fog
  light.frag               — multi-light shading (budgeted)
  fresnel.frag             — fresnel rim (ship glow)
  glow.frag                — glow pulse (stations, beacons)
  engine.frag              — engine flame shader

src/
  main.cpp                  — entry point: window init, game create, main loop
  core/
    Game.hpp/cpp            — orchestrator: init, loop, shutdown, restart
    EventBus.hpp/cpp        — singleton pub/sub (typed events)
    GameState.hpp/cpp       — singleton: run state, reset() for new runs
    Constants.hpp           — ALL magic numbers (source of numeric truth)
    Window.hpp/cpp          — GLFW window management, context init
    Timing.hpp/cpp          — delta-time, frame pacing, FPS tracking
  systems/
    InputSystem.hpp/cpp     — GLFW callbacks mapped to GLFW_KEY codes
    PhysicsSystem.hpp/cpp   — sphere-sphere, ray-sphere, gravity, laser hits
    CameraSystem.hpp/cpp    — chase camera, FOV, shake
    ParticleSystem.hpp/cpp  — 5 particle pools + 4 mesh VFX pools
    AudioSystem.hpp/cpp     — OpenAL discrete playback
    PostProcessingSystem.hpp/cpp — FBO pipeline: bloom, CA, vignette, grain, wormhole
    LightManager.hpp/cpp    — priority-culled dynamic light budget
    AdaptiveQuality.hpp/cpp — FPS-driven resolution/FX scaling
  gameplay/
    PlayerShip.hpp/cpp      — ship mesh, movement, shield, health, death
    WeaponSystem.hpp/cpp    — laser pool, beam geometry, child beams
    ScoreSystem.hpp/cpp     — score accumulation, high score persistence
  level/
    ChunkManager.hpp/cpp    — chunk grid lifecycle, staggered streaming
    BiomeGenerator.hpp/cpp  — ladder config lookup, rung change events
    AsteroidField.hpp/cpp   — instanced 3-tier asteroids
    CometSystem.hpp/cpp     — comet bodies + particle tails
    BlackHoleSystem.hpp/cpp — event horizon, accretion disk, gravity
    DeadStarSystem.hpp/cpp  — ember sprites, instant-death collision
    NebulaSystem.hpp/cpp    — fbm billboard planes
    StationSystem.hpp/cpp   — decorative stations
    DebrisSystem.hpp/cpp    — small instanced rock fragments
    CrystalSystem.hpp/cpp   — octahedron clusters + child beam splitting
    PulsarSystem.hpp/cpp    — counter-rotating beam cones
    StormSystem.hpp/cpp     — cloud pairs, telegraph/bolt state machine
    HulkSystem.hpp/cpp      — procedural wrecked ships (drift+tumble)
    CitySystem.hpp/cpp      — city fragments + blinking wrecks (finale)
    ProceduralWrecks.hpp/cpp — shared hulk/city geometry + material cache
    Starfield.hpp/cpp       — 3-layer parallax stars + shooting stars
  ui/
    HUD.hpp/cpp             — ImGui overlay: all readouts, bars, warnings
    LadderChart.hpp/cpp     — C-key expedition chart panel
    Crosshair.hpp/cpp       — ImGui reticle
    DeathScreen.hpp/cpp     — death overlay
  utils/
    Math.hpp                — Vec3, Quat, Mat4, lerp, clamp, damp, mulberry32, hash3
    Shader.hpp/cpp          — compile/link shaders, bind uniforms
    ResourceLoader.hpp/cpp  — file I/O: JSON config, texture loading
    PerfProbe.hpp/cpp       — dev overlay (FPS, draw calls, tris)
```

---

## 3. Core loop (Game.hpp)

```cpp
void Game::init() {
    Window::init();                    // GLFW + OpenGL 4.6 context
    ShaderManager::init();            // compile all shaders from shaders/
    InputSystem::init();              // register GLFW callbacks
    PhysicsSystem::init();
    AudioSystem::init();              // OpenAL device + context
    RenderSystem::init();             // FBOs, bloom pass, ImGui context
    LightManager::init();
    ParticleSystem::init();
    ChunkManager::init();
    BiomeGenerator::init();
    Starfield::init();
    PostProcessingSystem::init();
    AdaptiveQuality::init();
    InputSystem::init();              // second pass: pointer lock, etc.
    GameState::loadConfig();          // read ~/.void_drift/config.json
    // ... (all remaining init)
}

void Game::loop() {
    while (!shouldQuit) {
        glfwPollEvents();
        float dt = Timing::getDeltaTime();
        if (dt > 0.1f) dt = 0.1f;    // cap 100 ms

        if (!gameState.paused) {
            // 1. Input
            inputSystem.update(dt);

            // 2. Ship (movement, shield, health, death check)
            ship.update(dt);

            // 3. World (chunk streaming, entity updates)
            chunkManager.update(ship.position, state.distance);

            // 4. Weapons
            weapon.update(dt, &ship);

            // 5. Physics (collisions, gravity, laser hits)
            physics.update(dt, &ship, &weapon, &chunkManager);

            // 6. Camera
            camera.update(dt, &ship);

            // 7. Particles
            particles.update(dt);

            // 8. Post-processing
            post.update(dt, speedFraction, wormholeIntensity);

            // 9. Lights
            lightManager.update(camera.position);

            // 10. Adaptive quality
            adaptiveQuality.update(dt);

            // 11. HUD (polled values)
            hud.update(state, &ship, &chunkManager);
        }

        // 12. Render
        if (post.enabled()) {
            post.render();
        } else {
            renderer.render();
        }

        // 13. ImGui
        ImGui::NewFrame();
        uiSystem.render();
        ImGui::Render();
        glSwapBuffers();
    }
}
```

### 3.1 Frame budget

- `dt` capped at 0.1 s (prevents tunneling on tab-switch).
- All per-frame allocations in hot loops must be zero (scratch vectors,
  pre-allocated buffers).
- Target: 60 FPS. Floor: 30 FPS (AQ2 engages below).

---

## 4. EventBus

Singleton `EventBus` with:
- `on(event, handler) → unsubscribe token`
- `emit(event, payload?)`
- `off(event, token)`

`Events` is a `constexpr` struct of string constants.

**Rule:** Systems never hold direct references to each other's internals.
They communicate via EventBus events + reading `GameState` for shared
numeric state. The only exceptions are:
- `Game` owns all systems (constructor injection).
- `PhysicsSystem` receives collider arrays from entity systems each frame
  (pull model, not push).
- `ChunkManager` calls `spawnChunk`/`cleanupChunk` on entity systems
  directly (lifecycle is owned by ChunkManager).

---

## 5. Chunk lifecycle

```cpp
void ChunkManager::update(const Vec3& shipPos, float distance) {
    // 1. Compute active chunk set (3×3×3 grid around ship)
    // 2. For each new chunk: allocate, seed RNG (hash3), call
    //    BiomeGenerator.getRungConfig(distance) → cfg, call each
    //    entity system's spawnChunk(chunk, rng, cfg, shipPos)
    // 3. For each chunk leaving cleanup radius: call each system's
    //    cleanupChunk(chunk), remove from scene
    // 4. Staggered streaming: max CHUNKS_SPAWN_PER_FRAME (3) chunks
    //    spawned per frame; remaining queued for next frame
}
```

Chunk keys: `cx, cy, cz` (integers). Chunk data struct:
```cpp
struct Chunk {
    int cx, cy, cz;
    std::string key;
    Mulberry32 rng;
    // per-system data (set by spawnChunk):
    std::vector<Asteroid> asteroids;
    std::vector<Comet> comets;
    std::vector<BlackHole> blackHoles;
    std::vector<DeadStar> deadStars;
    std::vector<Nebula> nebulae;
    std::vector<Station> stations;
    std::vector<Debris> debris;
    std::vector<Crystal> crystals;
    std::vector<Pulsar> pulsars;
    StormData storm;
    std::vector<Hulk> hulks;
    std::optional<CityFragment> cityFragment;
    std::vector<CityWreck> cityWrecks;
};
```

---

## 6. Entity system contract

Every entity system in `level/` implements:

```cpp
class EntitySystem {
public:
    virtual void spawnChunk(Chunk& chunk, Mulberry32& rng, const RungConfig& cfg,
                            const Vec3& shipPos) = 0;
    virtual void update(float dt, const Vec3& shipPos) = 0;
    virtual void cleanupChunk(Chunk& chunk) = 0;
    virtual void dispose() = 0;
    virtual std::vector<Collider> getColliders() const = 0;
    virtual void remove(Collider& body) = 0;
};

struct Collider {
    Vec3 position;
    float radius;
    int hp;
    int score;
    ColliderType type;
    bool active;
    EntitySystem* owner;
};
```

`getColliders()` is polled by `PhysicsSystem` every frame. Entities mark
`active = false` when destroyed; PhysicsSystem skips them.

---

## 7. Rendering strategy

| Element | Technique | Draw calls |
|---------|-----------|------------|
| Asteroids (all tiers) | GL instanced VAO × 3 | 3 |
| Comets | Instanced VAO + particle tail | 1 + shared pool |
| Black holes | VAO (disk) + VAO (horizon) | 2 per hole |
| Dead stars | Instanced VAO (sprite-like) | 1 |
| Nebulae | VAO × N (fbm shader) | N |
| Stations | Instanced VAO | 1 |
| Debris | Instanced VAO | 1 |
| Crystals | Instanced VAO (octahedra) | 1 |
| Pulsars | VAO (core) + VAO (beam cone × 2) | 3 per pulsar |
| Storm clouds | VAO × 3 per cloud + GL_LINES (bolts) | 3N + 1 |
| Hulks | VAO group of 5–6 (shared geos/mats) | ~5 per hulk |
| City fragments | VAO group of 2–8 | ~5 per fragment |
| Wrecks | Same as hulks + white beacon | ~6 per wreck |
| Starfield | GL_POINTS × 3 + GL_POINTS (bright) + quads (shooting) | 4–5 |
| Particles | GL_POINTS × 5 pools + mesh pools | 5 + ~20 |
| Post-processing | FBO passes | +6–8 full-screen |

**Shared resources:** `ProceduralWrecks` caches all hulk geometries
and materials at module level (static VAOs + VBOs). Spawning a chunk
creates ZERO new GPU resources.

**Instance culling:** Instanced VAO objects beyond `INSTANCE_CULL_RADIUS`
(460 u) from camera are culled (skip draw call).

---

## 8. Lighting architecture

### 8.1 Static lights

- Directional light (intensity 0.3, from top-right) — baked into base.frag
- Hemisphere light (sky 0x4466aa, ground 0x112244, intensity 0.4) —
  baked into base.frag

### 8.2 Dynamic lights (managed by LightManager)

Registered by name convention:
- `ship:head` — ship headlight (always on, not budgeted).
- `ship:impact` × 4 — laser impact glow (always on, very short range).
- `sig:pulsarSweep` — pulsar beam light.
- `sig:stormFlicker` — storm cloud flicker.
- `sig:crystalCluster` — crystal cluster glow.
- `sig:wreckStrobe` — hulk/wreck emergency strobe.
- `sig:cityWindow` — city fragment window light.
- `sig:hulkEmergency` — hulk emergency light.
- `land:deadStar` — dead star ember glow.
- `land:nebula` — nebula ambient glow.
- `land:station` — station glow.

Budget: 16 total (auto) / 6 (eco). Ship lights exempt from budget.
Re-evaluation: every 6 frames.

Dynamic lights are passed to the shader as a uniform array
`vec4 lights[16]` (xyz = position, w = intensity). The fragment shader
loops over active lights and accumulates.

### 8.3 Light profile

- `auto`: full budget, all signatures.
- `eco`: cap 6, no signatures, no landmarks.
- Toggled by `L` key. Persisted to config file.
- AQ2 forces eco regardless of user setting.

---

## 9. Performance architecture

### 9.1 Adaptive quality

Time-based FPS sampling (1-second window). Not frame-count-based.

| Level | Resolution scale | CA | Grain | Lights |
|-------|-----------------|----|-------|--------|
| 0 | 1.0 | on | on | auto profile |
| 1 | 0.85 | on | on | auto profile |
| 2 | 0.7 | off | off | eco profile |

### 9.2 Headless perf gate

`scripts/check-perf.sh`:
- Requires: built binary, `LIBGL_ALWAYS_SOFTWARE=1` env for SwiftShader.
- Teleports to rung 9 (Spatial Graveyard) with `CHUNKS_RADIUS` 1.
- Samples 30 s: FPS, draw calls (via `glGetError` or debug label),
  triangles.
- Ceilings: draw calls ≤ 3500 (software renderer; real-GPU budget is 500),
  avg FPS ≥ 5 (sanity for SwiftShader), 0 crash/segfault.
- Exits 0 on pass, 1 on fail.

### 9.3 Perf probe

`--perf` CLI flag enables `PerfProbe`. Shows:
FPS (60-frame avg), draw calls, triangles, active lights, live particles,
current rung. Rendered as ImGui overlay.

### 9.4 Allocation discipline

- `scratch` struct in `Math.hpp`: shared `Vec3`, `Quat`, `Euler`, `Mat4`
  instances for hot loops.
- Particle pools: pre-allocated `std::vector<Particle>` with ring-cursor
  write. No heap allocation in update.
- Bolt pool: single `GL_LINES` VBO with `glDrawArrays` range (no
  geometry recreation).
- Wreck/city geometries and materials: static cache
  (`ProceduralWrecks`).
- No `new Vec3()` in update loops (except in spawn paths, which are
  amortized by chunk streaming).

---

## 10. State management

### 10.1 GameState (mutable data struct)

```cpp
struct GameState {
    int score = 0;
    float distance = 0.0f;          // u, monotonically increasing
    int health = 100;
    int maxHealth = 100;
    int shield = 100;
    float throttle = 0.0f;         // 0..1
    int rungIndex = 0;             // 0..13
    std::string lightProfile = "auto";
    bool muted = false;
    bool paused = false;
    bool dead = false;
    int highScore = 0;
    int adaptiveLevel = 0;
    float wormholeIntensity = 0.0f;
};
```

Read by: HUD, PerfProbe. Written by: systems via direct property
assignment (no setter methods).

### 10.2 Persistence

Config file: `~/.void_drift/config.json`
```json
{
  "highscore": 12345,
  "muted": false,
  "lightProfile": "auto"
}
```

Written on: death (high score), mute toggle, light profile change.
Read on: init.

---

## 11. Input architecture

`InputSystem` owns all raw input:
- GLFW `keyCallback` → movement keys, fire, pause, mute, light profile,
  ladder chart, restart.
- GLFW `mouseButtonCallback` → fire, shield.
- GLFW `cursorCallback` → camera look (pointer lock).
- GLFW `scrollCallback` → throttle.
- Pointer lock: Esc to pause/unlock.

All input is converted to EventBus events or direct GameState writes.
Systems never read GLFW event objects directly.

---

## 12. Error / edge-case handling

| Case | Handling |
|------|----------|
| OpenGL context lost | `glContextLost` callback: pause, show message |
| OpenGL context restored | Resume |
| Window minimized | `dt` capped at 0.1 s (no tunneling) |
| Audio device unavailable | Disable audio, show warning |
| Chunk spawn too close to ship | `shipPos` guard in every spawnChunk |
| Pulsar too close to another pulsar | `minSpacing` guard, skip spawn |
| City fragment too close to ship/other | `minDistShip` + `minSpacing` guards |
| Low-end hardware | CA + grain disabled at startup |
| Perf regression | `check-perf.sh` gate in CI/dev workflow |
| Shader compile failure | Log error, abort init with message |
| Config file missing/corrupt | Use defaults, log warning |
