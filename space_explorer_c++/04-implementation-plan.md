# Void Drift C++ — Implementation Plan (v1.0.0)

This document is a step-by-step implementation plan for coding the
Void Drift C++ game from scratch. Every step is concrete: file to create,
what to put in it, and how to verify.

---

## Phase 0 — Project setup

### 0.1 Create project structure

```
void_drift/
  CMakeLists.txt
  launch.sh
  data/
  shaders/
  scripts/
  src/
    main.cpp
    core/
    systems/
    gameplay/
    level/
    ui/
    utils/
  external/
    imgui/          # Dear ImGui source
```

### 0.2 Dependencies

- OpenGL 4.6 (system or Mesa)
- GLFW 3.4+ (`sudo apt install libglfw3-dev` or vcpkg)
- GLM (header-only, or system package)
- Dear ImGui 1.91+ (clone into `external/imgui`)
- OpenAL (`sudo apt install libopenal-dev`)
- libsndfile (`sudo apt install libsndfile1-dev`)
- nlohmann/json (header-only, or system package)

### 0.3 CMakeLists.txt

Per 03-technical-specification §12.

### 0.4 launch.sh

```bash
#!/bin/bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
./build/void_drift
```

### 0.5 Verify

- `cmake -B build && cmake --build build` → compiles clean.
- `./build/void_drift` → opens a black window with ImGui test triangle
  (or just a clear color).
- `Esc` → quits.

---

## Phase 1 — Core infrastructure

### 1.1 Constants.hpp

Create `src/core/Constants.hpp` with ALL values from
03-technical-specification §2. Every magic number in the codebase must
be named. No raw numbers in system code.

### 1.2 EventBus

Create `src/core/EventBus.hpp/cpp`.

```cpp
class EventBus {
public:
    static EventBus& instance();
    template<typename Payload>
    auto on(const char* event, std::function<void(const Payload&)> handler)
        -> UnsubToken;
    template<typename Payload>
    void emit(const char* event, const Payload& payload);
    void off(const char* event, UnsubToken token);
private:
    std::unordered_map<std::string, std::vector<HandlerSlot>> _handlers;
};
```

Use `std::any` or type-erasure for mixed-payload events. Each event
has a known payload type — define a `PayloadMap` struct mapping
event name → payload type.

### 1.3 GameState

Create `src/core/GameState.hpp/cpp`.

```cpp
class GameState {
public:
    static GameState& instance();
    void reset();           // new run: zero score, distance, health
    void loadConfig();     // read ~/.void_drift/config.json
    void saveConfig();     // write ~/.void_drift/config.json
    // public data members (see 02-architecture-specification §10.1)
};
```

### 1.4 Window

Create `src/core/Window.hpp/cpp`.

- GLFW init, window creation (1920×1080, resizable).
- OpenGL 4.6 core context.
- ImGui context init (GLFW backend).
- Vsync: on.
- DPI: `glfwGetMonitorDPI()`, cap at 2.0.
- Callbacks: framebuffer size, key, mouse button, cursor, scroll,
  context lost/restored.

### 1.5 Timing

Create `src/core/Timing.hpp/cpp`.

- `glfwGetTime()` for absolute time.
- `getDeltaTime()` returns seconds since last frame.
- `getFPS()` returns frames-per-second (60-frame rolling average).
- `frameCount()` returns total frames since init.

### 1.6 Math utilities

Create `src/utils/Math.hpp`.

- `Mulberry32` struct (port from JS: identical output for same seed).
- `hash3(int x, int y, int z)` — MUST include y.
- `lerp`, `clamp`, `damp` (GLM has `glm::mix` and `glm::smoothstep`,
  but `damp` is custom: `a + (b - a) * (1 - exp(-lambda * dt))`).
- `Scratch` struct: shared `Vec3 v1, v2, v3; Quat q1, q2; Mat4 m1;`.

### 1.7 Verify

- `./build/void_drift` → opens window, ImGui shows "Hello" text.
- `Esc` → quits cleanly.
- No memory leaks (Valgrind clean on exit).

---

## Phase 2 — Rendering pipeline

### 2.1 Shader manager

Create `src/utils/Shader.hpp/cpp`.

- `compileShader(type, file)` → shader object.
- `linkProgram(vert, frag)` → program object.
- `getUniformLocation` helper.
- `#include` preprocessing: at build time, concatenate `#include`
  directives (or use `glslangValidator -E` for preprocessing).

### 2.2 Base shaders

Create `shaders/base.vert` and `shaders/base.frag`.

- `base.vert`: standard MVP transform, pass normal + position to frag.
- `base.frag`: diffuse + Blinn-Phong specular + fog (exponential,
  `VD::FOG_DENSITY`) + dynamic lights (uniform array `vec4 lights[16]`)
  + ACES tone mapping.

### 2.3 Starfield

Create `src/level/Starfield.hpp/cpp` + `shaders/star.vert` + `shaders/star.frag`.

- 3 point-cloud layers (5000/2000/500 points) + 30 bright stars.
- Position data: `Vec3 position` + `float size` + `float twinklePhase`.
- Parallax: each layer moves at `(1 - parallaxSpeed)` × ship position.
- Wrap: 1200 u box around ship.
- Color temperature: 30% blue-white (0.7, 0.8, 1.0), 40% white (1, 1, 1),
  20% warm (1.0, 0.85, 0.7), 10% red (1.0, 0.5, 0.3).
- Shooting stars: 2 concurrent, spawn every 30 s, 0.45 s life,
  1600 u/s. Rendered as small quads with additive blending.
- All star materials: fog disabled.

### 2.4 Post-processing pipeline

Create `src/systems/PostProcessingSystem.hpp/cpp`.

FBO chain:
1. Render scene → scene FBO.
2. Scene FBO → bloom FBO (threshold + bright pass).
3. Bloom FBO → blur FBO (horizontal + vertical Gaussian).
4. Scene + blur → composite FBO (additive bloom).
5. Composite → chromatic aberration FBO.
6. CA → vignette FBO.
7. Vignette → grain FBO.
8. Grain → wormhole blur FBO (if wormholeIntensity > 0).
9. Final → screen.

Each FBO is `RGBA8` + depth buffer (only scene FBO needs depth).
Bloom: 2-pass Gaussian (5×5 kernel), strength 1.5, radius 0.4,
threshold 0.15.
CA: per-pixel RGB offset proportional to distance from center ×
speed fraction.
Vignette: radial gradient, darkness 0.5, offset 0.2.
Grain: per-pixel random noise (time-driven), intensity 0.03.
Wormhole: 8-tap radial blur + swirl + chromatic fringe.
Wormhole intensity: driven by BIOME_CHANGED (wormhole biome) +
black hole proximity.

### 2.5 Verify

- Scene renders with fog + lighting.
- Starfield visible, twinkling, parallax works.
- Post-processing passes: bloom visible on bright objects, vignette
  darkens corners, grain adds subtle noise.
- Performance: 60 FPS with 5000 points + 6 FBO passes.

---

## Phase 3 — Ship + camera + input

### 3.1 PlayerShip

Create `src/gameplay/PlayerShip.hpp/cpp`.

- Ship mesh: procedural (cone + wings + engine). 4 muzzles.
- Movement: acceleration 44 u/s², max speed 88 u/s, drag 0.98/frame.
- Roll: 3.0 rad/s.
- Pitch/yaw: mouse look (pointer lock) + keyboard fallback
  (1.5 rad/s).
- Shield: right-click, 1 s cooldown, radius 22 u, deflect power 60.
- Health: 100 max, 2%/s regen, 0.75 s invulnerability.
- Death: `PLAYER_DIED` event, cause-specific.

### 3.2 CameraSystem

Create `src/systems/CameraSystem.hpp/cpp`.

- Chase: 6 u behind, 3 u above, damped (lambda 8).
- FOV: 75° rest, 95° at full throttle (lerp).
- Shake: 0.25 × damage impulse, decay 0.3 s.
- No roll inheritance.

### 3.3 InputSystem

Create `src/systems/InputSystem.hpp/cpp`.

- GLFW callbacks → EventBus events.
- AZERTY-first binding: `GLFW_KEY_W` (Z on AZERTY) = pitch up,
  `GLFW_KEY_S` = pitch down, `GLFW_KEY_A` (Q) = strafe left,
  `GLFW_KEY_D` = strafe right, `GLFW_KEY_S` = roll...

  **Wait — AZERTY mapping is subtle.** On AZERTY:
  - Physical W position = Z key → `GLFW_KEY_Z`
  - Physical A position = Q key → `GLFW_KEY_Q`
  - Physical S position = S key → `GLFW_KEY_S` (same)
  - Physical D position = D key → `GLFW_KEY_D` (same)

  So on AZERTY: Z = pitch up, Q = strafe left, S = strafe right / roll,
  D = pitch down.

  **This is confusing. Use physical key codes, not labels.**
  GLFW key codes are layout-independent:
  - `GLFW_KEY_W` = the key at the W position (Z on AZERTY)
  - `GLFW_KEY_A` = the key at the A position (Q on AZERTY)
  - `GLFW_KEY_S` = the key at the S position (S on AZERTY)
  - `GLFW_KEY_D` = the key at the D position (D on AZERTY)

  So use `GLFW_KEY_W`, `GLFW_KEY_A`, `GLFW_KEY_S`, `GLFW_KEY_D`
  directly. GLFW handles the mapping.

- Space = fire, Right-click = shield, Esc = pause, M = mute,
  L = light profile, C = ladder chart, R = restart.
- Scroll = throttle.

### 3.4 Verify

- Ship moves with ZQSD (AZERTY) / WASD (QWERTY).
- Mouse look works (pointer lock).
- Camera follows ship smoothly.
- Health regen visible in HUD.
- Shield pushes asteroids away (test with a few asteroids).

---

## Phase 4 — World generation

### 4.1 BiomeGenerator

Create `src/level/BiomeGenerator.hpp/cpp`.

- `getRungConfig(float distance) → const RungConfig&`.
- `getRungIndex(float distance) → int`.
- `isFinale(float distance) → bool`.
- On rung change: emit `LADDER_RUNG_CHANGED`.
- On finale: emit `LADDER_FINALE_REACHED` (once).

### 4.2 ChunkManager

Create `src/level/ChunkManager.hpp/cpp`.

- Chunk grid: 3×3×3 around ship (cx, cy, cz).
- Chunk struct: per 02-architecture-specification §5.
- Staggered streaming: max 3 chunks spawned per frame.
- Cleanup radius: 1.6× spawn radius.
- `update(shipPos, distance)`: compute active set, spawn new, cleanup old.

### 4.3 AsteroidField

Create `src/level/AsteroidField.hpp/cpp`.

- 3 tiers (large/medium/small), instanced VAO.
- HP: 100/50/25, score: 100/50/25, collision: 25/15/10.
- Radius: 8–12 / 4–7 / 2–3.5 u.
- `spawnChunk`: N asteroids per chunk (ladder cfg).
- `update`: rotation, drift.
- `getColliders`: sphere colliders.
- On destroy: explosion burst + shards.

### 4.4 CometSystem

Create `src/level/CometSystem.hpp/cpp`.

- 150 HP, score 100, collision 25.
- Tail: particle stream (shared pool).
- Fixed trajectory through chunks.

### 4.5 BlackHoleSystem

Create `src/level/BlackHoleSystem.hpp/cpp`.

- Contact = instant death. Radius 10–22 u.
- Gravity: base 7500 × (radius/10)², per-hole radius 450 × (0.6 + radius/30).
- Max pull 160 u/s², ship pull factor 1.15.
- BH-BH attraction: within 480 u, strength 60000, cap 100.
- Merge: d < (rA+rB)×1.2.
- Collapse: ship within 80 u takes 50 damage.
- Visual: accretion disk shader (Doppler-beamed ring).

### 4.6 Remaining entity systems

Each system in `level/` implements the `EntitySystem` contract
(02-architecture-specification §6). Create in this order:

1. **DeadStarSystem** — ember sprites, instant-death collision.
2. **NebulaSystem** — fbm billboard planes, no collision.
3. **StationSystem** — decorative, collision 20.
4. **DebrisSystem** — small instanced rocks, HP 10, score 5.
5. **CrystalSystem** — octahedron clusters, child beam splitting.
6. **PulsarSystem** — counter-rotating beam cones, 500 u, half-angle 0.06.
7. **StormSystem** — cloud pairs, telegraph/bolt state machine.
8. **HulkSystem** — procedural wrecks, drift+tumble, strobe.
9. **CitySystem** — city fragments (finale) + blinking wrecks.
10. **ProceduralWrecks** — shared geometry/material cache.

### 4.7 Verify

- Fly forward: chunks stream in and out smoothly.
- Asteroids appear, can be shot, explode.
- Biome changes visible (fog color, entity density).
- Black hole pulls ship, kills on contact.
- Pulsar beams rotate, deal damage on contact.
- Storm bolts fire between cloud pairs.
- City fragments visible in finale, windows flicker.
- No memory leaks (Valgrind clean after 2 min of flight).

---

## Phase 5 — Weapons + physics

### 5.1 WeaponSystem

Create `src/gameplay/WeaponSystem.hpp/cpp`.

- 4 muzzles, sustained beams while Space held.
- Beam: instanced cylinder, length 9 u, core radius 0.18, glow 0.5,
  hit radius 1.8.
- Damage 25, speed 200 u/s, lifetime 1.5 s, range 200 u.
- Pool: 96 beams (4 sustained + 12 child + 80 spare).
- Child beams: crystal hit → 2 children at ±18°.
- On hit: spark burst + glow light.
- On destroy: explosion + shards + shockwave.

### 5.2 PhysicsSystem

Create `src/systems/PhysicsSystem.hpp/cpp`.

- Ship vs collider: sphere-sphere (ship radius 2 u).
- Laser vs collider: ray-sphere intersection.
- Storm bolt vs ship: segment-sphere distance.
- Black hole gravity: applied to ship velocity.
- Collision response: damage + knockback.

### 5.3 ScoreSystem

Create `src/gameplay/ScoreSystem.hpp/cpp`.

- Distance: 1 point per 10 u × scoreMult.
- Kills: per-entity score × scoreMult.
- High score: persisted on death.
- `SCORE_CHANGED` event on every increment.

### 5.4 Verify

- Hold Space: 4 beams fire simultaneously.
- Beams hit asteroids: damage, sparks, explosion on destroy.
- Crystal hit: 2 child beams split off.
- Score increases with distance and kills.
- Death by collision: cause-specific message.
- High score persists across restarts.

---

## Phase 6 — UI

### 6.1 HUD

Create `src/ui/HUD.hpp/cpp`.

- ImGui overlay: score, distance, biome, health bar, shield bar,
  thrust bar, warnings, flash, vignette, storm static, controls hint,
  AQ indicator, pause overlay.
- All values polled from `GameState` + systems each frame.

### 6.2 LadderChart

Create `src/ui/LadderChart.hpp/cpp`.

- C-key toggle.
- 14 entries with name, range, progress bar.
- Current entry highlighted.

### 6.3 Crosshair

Create `src/ui/Crosshair.hpp/cpp`.

- Center reticle: thin circle + 4 dots.
- ImGui draw list.

### 6.4 DeathScreen

Create `src/ui/DeathScreen.hpp/cpp`.

- Full-screen ImGui overlay.
- 6 cause-specific titles.
- Score, distance, high score, "PRESS R TO RESTART".

### 6.5 Verify

- HUD shows all elements correctly.
- Health bar changes color (green → yellow → red).
- Shield bar tracks cooldown.
- Announce banner appears on biome change.
- Ladder chart toggles with C.
- Death screen shows on death, R restarts.

---

## Phase 7 — Audio

### 7.1 AudioSystem

Create `src/systems/AudioSystem.hpp/cpp`.

- OpenAL device + context.
- Sound buffer pool: pre-load all WAV files at init.
- `playOnce(name, volume)`, `playLoop(name, volume)`, `stopAll()`.
- Engine rumble: 60 Hz sawtooth loop, gain 0.04–0.16 with thrust.
- Mute: M key, persisted.
- Warning beep: 800 Hz × 3, repeats every 2 s while health < 30.

### 7.2 Audio files

Generate or source WAV files (44.1 kHz mono):
- `engine_rumble.wav` — 60 Hz sawtooth, 2 s loop.
- `deflagration.wav` — metallic ping, 0.3 s.
- `laser.wav` — single shot, 0.15 s.
- `explosion.wav` — explosion burst, 0.5 s.
- `collision.wav` — impact, 0.3 s.
- `biome_change.wav` — chime, 0.5 s.
- `comet.wav` — whoosh, 0.4 s.
- `shield_ping.wav` — ping, 0.2 s.
- `collapse_boom.wav` — boom, 0.8 s.
- `warning.wav` — 800 Hz × 3, 0.6 s.

### 7.3 Verify

- Engine rumble audibly changes with throttle.
- Laser shots produce sound.
- Explosions produce sound.
- Mute works (M key).
- Warning beep at low health.

---

## Phase 8 — Polish + performance

### 8.1 LightManager

Create `src/systems/LightManager.hpp/cpp`.

- Register lights by name convention.
- Every 6 frames: sort by (priority, distance to camera).
- Toggle visibility to stay under cap (16 auto / 6 eco).
- Ship lights exempt.
- L key: toggle auto/eco.
- AQ2 forces eco.

### 8.2 AdaptiveQuality

Create `src/systems/AdaptiveQuality.hpp/cpp`.

- Rolling 1-second FPS window (time-based).
- Level 0 → 1: FPS < 45 for 2 s.
- Level 1 → 2: FPS < 30 for 2 s.
- Level 2 → 1: FPS > 55 for 3 s.
- Level 1 → 0: FPS > 55 for 3 s.
- Effects: resolution scale, CA, grain, light profile.

### 8.3 ParticleSystem

Create `src/systems/ParticleSystem.hpp/cpp`.

- 5 point pools + 4 mesh pools.
- Pre-allocated, ring-cursor write.
- Per-particle: position, velocity, lifetime, size, color, alpha.
- Shader: `GL_PROGRAM_POINT_SIZE`, alpha blending.
- Shockwave: expanding ring mesh.
- Debris shards: small tetrahedra with gravity.
- Speed lines: streaks at high speed.
- Impact glow: short-range point light + glow quad.

### 8.4 Verify

- Particles pool correctly (no allocations in update).
- Explosions look good (burst + shards + shockwave).
- Engine exhaust visible.
- Lightning bolt segments render correctly.
- Light budget respected (≤ 16 active in auto mode).
- AQ drops resolution under load.

---

## Phase 9 — Integration + perf gate

### 9.1 Full integration test

- Fly from rung 0 to rung 13 (35,000 u).
- All biomes appear in order.
- All entities spawn and behave correctly.
- Score accumulates correctly.
- High score persists.
- No crashes, no memory leaks (Valgrind clean).

### 9.2 Headless perf check

Create `scripts/check-perf.sh`.

```bash
#!/bin/bash
export LIBGL_ALWAYS_SOFTWARE=1
./build/void_drift --teleport 36000 --perf-duration 30 --headless
```

Binary flags:
- `--teleport <distance>`: skip to distance on start.
- `--perf-duration <seconds>`: run for N seconds then exit.
- `--headless`: no window (or offscreen render).

Script parses stdout for:
- FPS (avg over 30 s).
- Draw calls (max).
- Triangles (max).
- Exit code.

### 9.3 Verify

- `bash scripts/check-perf.sh` → exits 0.
- Real GPU: 60 FPS in SPATIAL_GRAVEYARD.
- No performance degradation over 5 min of continuous flight.

### 9.4 Final checklist

- [ ] All 14 ladder rungs reachable in order.
- [ ] All 14 entity systems spawn and behave correctly.
- [ ] Weapons work (4 beams + child beams).
- [ ] Physics correct (collisions, gravity, laser hits).
- [ ] Score correct (distance + kills + multipliers).
- [ ] High score persists.
- [ ] HUD complete (all elements).
- [ ] Audio works (all sounds).
- [ ] Adaptive quality works.
- [ ] Light manager works.
- [ ] No memory leaks.
- [ ] Perf gate passes.
- [ ] CMake builds clean.
- [ ] launch.sh works.
