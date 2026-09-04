# Void Drift C++ — Technical Specification (v1.0.0)

All values carried over from the Three.js reference implementation (v2.0.0).
Where the JS implementation and this document disagree, **this document wins**.

---

## 1. Dependencies

| Package | Version | Role |
|---------|---------|------|
| OpenGL | 4.6 core profile | Rendering |
| GLFW | 3.4 | Window, input, context |
| GLM | 4.x | Math (vec3, quat, mat4, trig) |
| Dear ImGui | 1.91+ | HUD overlay |
| OpenAL | 1.20 | Audio playback |
| libsndfile | 1.2.2 | WAV decode |
| nlohmann/json | 3.x | Config persistence |
| CMake | 3.16+ | Build system |

C++ standard: C++17. No other dependencies.

---

## 2. Constants (numeric ground truth)

All values live in `src/core/Constants.hpp` as `constexpr` or `const`
named constants. One header, one `namespace VD`.

### 2.1 Ship

| Constant | Value |
|----------|-------|
| `VD::MAX_HEALTH` | 100 |
| `VD::HEALTH_REGEN_PERCENT_PER_SEC` | 0.02f |
| `VD::DAMAGE_INVULNERABILITY` | 0.75f |
| `VD::SHIELD_RADIUS` | 22.0f |
| `VD::SHIELD_DEFLECT_POWER` | 60.0f |
| `VD::SHIELD_COOLDOWN` | 1.0f |
| `VD::SHIP_ACCELERATION` | 44.0f |
| `VD::MAX_SHIP_SPEED` | 88.0f |
| `VD::SHIP_DRAG` | 0.98f |
| `VD::SHIP_ROLL_SPEED` | 3.0f |
| `VD::MOUSE_LOOK_SPEED` | 0.0025f |
| `VD::KEYBOARD_PITCH_SPEED` | 1.5f |
| `VD::PITCH_LIMIT` | 1.2f |
| `VD::SHIP_SPAWN` | Vec3(0, 2, 0) |
| `VD::CAMERA_DISTANCE` | 6.0f |
| `VD::CAMERA_HEIGHT` | 3.0f |
| `VD::CAMERA_FOV_REST` | 75.0f |
| `VD::CAMERA_FOV_MAX` | 95.0f |
| `VD::CAMERA_DAMPING` | 5.0f |
| `VD::HEADLIGHT_INTENSITY` | 6.5f |
| `VD::HEADLIGHT_RANGE` | 95.0f |
| `VD::HEADLIGHT_ANGLE` | 0.7f |

### 2.2 World

| Constant | Value |
|----------|-------|
| `VD::CHUNK_SIZE` | 200.0f |
| `VD::CHUNKS_RADIUS` | 1 |
| `VD::CHUNKS_CLEANUP_RADIUS` | 1.6f |
| `VD::CHUNKS_SPAWN_PER_FRAME` | 3 |
| `VD::CONTENT_Y_BAND` | 100.0f |
| `VD::DENSITY_REDUCTION` | 0.55f |
| `VD::INSTANCE_CULL_RADIUS` | 460.0f |

### 2.3 Weapon — continuous quad beams

| Constant | Value |
|----------|-------|
| `VD::FIRE_RATE` | 6.0f |
| `VD::PROJECTILE_SPEED` | 200.0f |
| `VD::PROJECTILE_LIFETIME` | 1.5f |
| `VD::PROJECTILE_RANGE` | 200.0f |
| `VD::PROJECTILE_DAMAGE` | 25 |
| `VD::LASER_POOL` | 96 |
| `VD::LASER_LENGTH` | 9.0f |
| `VD::LASER_RADIUS` | 0.18f |
| `VD::LASER_GLOW_RADIUS` | 0.5f |
| `VD::LASER_HIT_RADIUS` | 1.8f |
| `VD::LASER_COLOR` | Vec3(0.2f, 1.0f, 0.4f) // 0x33ff66 |
| `VD::CRYSTAL_SPLIT_ANGLE` | 0.3142f |
| `VD::CRYSTAL_CHILD_BEAM_MAX` | 12 |

### 2.4 Score

| Constant | Value |
|----------|-------|
| `VD::SCORE_DISTANCE_DIVISOR` | 10 |
| `VD::SCORE_ASTEROID` | 10 |
| `VD::SCORE_COMET` | 60 |
| `VD::SCORE_CRYSTAL` | 40 |
| `VD::SCORE_PULSAR` | 150 |
| `VD::SCORE_STORM` | 80 |
| `VD::SCORE_STATION` | 120 |
| `VD::SCORE_HULK` | 150 |
| `VD::SCORE_WRECK` | 200 |
| `VD::SCORE_CITY` | 300 |
| `VD::SCORE_DEBRIS` | 5 |
| `VD::SCORE_BLACK_HOLE` | 500 |
| `VD::SCORE_MULT_DIVISOR` | 3000 |

### 2.5 Particles

| Pool | Max | Lifetime | Size |
|------|-----|----------|------|
| exhaust | 200 | 0.8 s | 0.6 |
| laserSpark | 50 | 0.3 s | 0.4 |
| explosion | 80 | 1.2 s | 1.4 (grow) |
| ember | 100 | 1.5 s | 0.5 |
| sparkle | 256 | 0.6 s | 2.5 (grow) |

Mesh pools: shockwave rings 4 (life 0.4 s), debris shards 12 (life 0.8 s,
gravity 20), speed lines (count 24), impact glow lights 4 (life 0.15 s).

### 2.6 Starfield

| Constant | Value |
|----------|-------|
| `VD::STAR_FAR_COUNT` | 5000 |
| `VD::STAR_MID_COUNT` | 2000 |
| `VD::STAR_NEAR_COUNT` | 500 |
| `VD::BRIGHT_STAR_COUNT` | 30 |
| `VD::STARFIELD_WRAP` | 1200.0f |

Parallax speeds: far 0.1, mid 0.3, near 0.8.
Shooting stars: every 30 s, max 2, life 0.45 s, speed 1600 u/s.

### 2.7 Post-processing

| Constant | Value |
|----------|-------|
| `VD::BLOOM_STRENGTH` | 1.5f |
| `VD::BLOOM_RADIUS` | 0.4f |
| `VD::BLOOM_THRESHOLD` | 0.15f |
| `VD::VIGNETTE_DARKNESS` | 0.5f |
| `VD::VIGNETTE_OFFSET` | 0.2f |
| `VD::FILM_GRAIN_INTENSITY` | 0.03f |
| `VD::CA_MAX` | 0.003f |
| `VD::FOG_COLOR` | Vec3(0.0f, 0.0f, 0.067f) // 0x000011 |
| `VD::FOG_DENSITY` | 0.008f |

### 2.8 Light manager

| Constant | Value |
|----------|-------|
| `VD::LIGHT_CAP_AUTO` | 16 |
| `VD::LIGHT_CAP_ECO` | 6 |
| `VD::LIGHT_SIG_BUDGET` | 4 |
| `VD::LIGHT_LAND_BUDGET` | 4 |
| `VD::LIGHT_REEVAL_EVERY` | 6 |

Priorities (lower = higher priority):
pulsarSweep 1, stormFlicker 2, crystalCluster 3, wreckStrobe 4,
cityWindow 5, hulkEmergency 6.

### 2.9 Adaptive quality

| Constant | Value |
|----------|-------|
| `VD::AQ_DROP_FPS` | 45 |
| `VD::AQ_DROP_HOLD` | 2.0f |
| `VD::AQ_SCALE1` | 0.85f |
| `VD::AQ_HARD_FPS` | 30 |
| `VD::AQ_SCALE2` | 0.7f |
| `VD::AQ_RECOVER_FPS` | 55 |
| `VD::AQ_RECOVER_HOLD` | 3.0f |

### 2.10 Ladder (14 entries)

```cpp
struct RungConfig {
    std::string key;
    float rangeMin, rangeMax;
    float scoreMult;
    int asteroid, comet, crystal, pulsar, storm, hulk;
    int blackHole, deadStar, station, nebula, debris;
    float cityChance;
    int wreckDensity;
    Vec3 color;
};
```

| Index | Key | Range (u) | Score mult |
|-------|-----|-----------|------------|
| 0 | OPEN_SPACE | 0 – 1,000 | 1.0 |
| 1 | ASTEROID_BELT | 1,000 – 3,000 | 1.0 |
| 2 | NEBULA_CORRIDOR | 3,000 – 5,000 | 1.2 |
| 3 | WORMHOLE | 5,000 – 7,000 | 1.5 |
| 4 | DEEP_VOID | 7,000 – 8,000 | inherit |
| 5 | CRYSTAL_FIELDS | 8,000 – 11,000 | 2.0 |
| 6 | DEEP_VOID | 11,000 – 12,500 | inherit |
| 7 | PULSAR_REGION | 12,500 – 16,000 | 2.5 |
| 8 | DEEP_VOID | 16,000 – 18,000 | inherit |
| 9 | PLASMA_STORM | 18,000 – 22,000 | 3.0 |
| 10 | DEEP_VOID | 22,000 – 25,000 | inherit |
| 11 | DERELICT_GRAVEYARD | 25,000 – 29,000 | 3.5 |
| 12 | DEEP_VOID (Final) | 29,000 – 35,000 | inherit |
| 13 | SPATIAL_GRAVEYARD | 35,000 → ∞ | 4.0 |

Deep void base: asteroid 2, comet 2, station 1, color [0.05, 0.08, 0.15].

### 2.11 Entity constants

| System | Key values |
|--------|------------|
| CRYSTAL | density 8, cluster 4–8, childBeamMax 12, hp 25, score 40 |
| PULSAR | density 4, beamLength 500, damage 50, minSpacing 800, radius 22–30 |
| STORM | density 4, strikeDamage 45, boltLife 0.15, boltSegments 6, telegraphTime 0.4, re-strike 1.2–2.8 s, staticRange 350, staticRangeIntense 150, flickerHz 6, cloudRadius 20–40, boltDistanceMax 120 |
| HULK | density 4, hp 100, damage 30, score 150, strobeFreq 1.5 |
| CITY | cityChance 0.75, fragmentScale 260, fragmentRadius 70, fragmentHp 0, windowCount 90, wreckDensity 5, wreckHp 100, wreckScore 200, minSpacing 500, minDistShip 600, flickerFreq 0.8, dropoutEvery 2.0, strobeFreq 3.0, glowOpacity 0.08 |

---

## 3. OpenGL configuration

```cpp
// Window.hpp
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
glfwWindowHint(GLFW_SAMPLES, 4);          // 4× MSAA
glfwWindowHint(GLFW_DOUBLEBUFFER, GLFW_TRUE);

// RenderSystem.hpp
glViewport(0, 0, w, h);
glClearColor(0.0f, 0.0f, 0.067f, 1.0f);   // 0x000011
glEnable(GL_DEPTH_TEST);
glEnable(GL_CULL_FACE);
glEnable(GL_PROGRAM_POINT_SIZE);
glEnable(GL_MULTISAMPLE);                  // 4× MSAA

// Tone mapping: ACES Filmic (implemented in base.frag)
// Exposure: 1.0
```

DPR: `glfwGetMonitorDPI()` or `GLFW_DPI_SCALE`. Cap at 2.0.

---

## 4. Camera

- `PerspectiveCamera`, FOV 75°, near 0.1, far 5000.
- Chase: 6 u behind, 3 u above ship position.
- Look-at: ship position (damped, lambda 8).
- FOV boost: +20° at full throttle (lerp with speed fraction,
  `CAMERA_FOV_MAX` = 95).
- Shake: 0.25 × damage impulse, decays over 0.3 s.
- No roll inheritance from ship (camera roll = 0 always).
- Pointer lock: mouse movement → yaw/pitch on ship (not camera).

---

## 5. Math utilities (`utils/Math.hpp`)

```cpp
namespace VD {
    // Vectors / quats / matrices (use GLM types directly)
    using Vec3  = glm::vec3;
    using Quat  = glm::quat;
    using Mat4  = glm::mat4;
    using Euler = glm::eulerAngleZYX;

    // Deterministic PRNG
    struct Mulberry32 {
        uint32_t state;
        explicit Mulberry32(uint32_t seed);
        float next();          // 0..1
        float range(float min, float max);
    };

    // Hash
    uint32_t hash3(int x, int y, int z);  // MUST include y

    // Interpolation
    float lerp(float a, float b, float t);
    float damp(float a, float b, float lambda, float dt);
    float clamp(float v, float lo, float hi);

    // Scratch (shared, no heap alloc in hot loops)
    struct Scratch {
        Vec3  v1, v2, v3;
        Quat  q1, q2;
        Mat4  m1;
    };
    extern Scratch scratch;
}
```

**Critical:** `hash3` must include `y`. Seeding by `(x, z)` only makes
every vertical layer an exact copy.

---

## 6. Shader inventory

All shaders are GLSL 4.60 (`#version 460`). Separate `.vert`/`.frag`
files in `shaders/`. Compiled at init, registered by name.

| Shader | Files | Purpose |
|--------|-------|---------|
| STAR | star.vert / star.frag | Starfield points (size, twinkle, soft dot) |
| NEBULA | nebula.vert / nebula.frag | Nebula fbm billboards |
| DISK | disk.vert / disk.frag | Black hole accretion disk (Doppler) |
| SNOISE | snoise.glsl | Simplex noise + fBm (inlined into nebula via `#include`) |
| PARTICLE | particle.vert / particle.frag | Particle points (size, alpha, color) |
| VIGNETTE | vignette.frag | Screen vignette |
| GRAIN | grain.frag | Film grain (time-driven hash) |
| CA | ca.frag | Speed chromatic aberration |
| WORMHOLE_BLUR | wormhole_blur.frag | Wormhole blur + swirl + fringe |
| BLOOM | bloom.vert / bloom.frag | Post-processing bloom (threshold + blur + combine) |
| BASE | base.vert / base.frag | Standard diffuse + specular + fog + dynamic lights |
| FRESNEL | fresnel.frag | Fresnel rim (ship glow) |
| GLOW | glow.frag | Glow pulse (stations, beacons) |
| ENGINE | engine.frag | Engine flame shader |
| LIGHT | light.frag | Multi-light shading helper (included in base.frag) |

All shaders use `#include` for shared chunks (snoise.glsl, light.frag).
CMake step concatenates `#include` directives at build time, or use
`glslangValidator` preprocessing.

---

## 7. Audio

OpenAL + libsndfile. Discrete playback — no music, no spatial audio.

```cpp
class AudioSystem {
public:
    void init();           // OpenAL device + context
    void playOnce(const std::string& name, float volume);
    void playLoop(const std::string& name, float volume);
    void stopAll();
    void setMuted(bool);
    void updateThrust(float thrust);  // engine rumble gain
};
```

Audio files (WAV, 44.1 kHz mono):
- `engine_rumble.wav` — 60 Hz sawtooth loop
- `deflagration.wav` — metallic ping
- `laser.wav` — single shot
- `explosion.wav` — explosion burst
- `collision.wav` — impact
- `biome_change.wav` — chime
- `comet.wav` — whoosh
- `shield_ping.wav` — deflagration ping
- `collapse_boom.wav` — black hole collapse
- `warning.wav` — 800 Hz beep × 3

AudioContext equivalent: OpenAL device created lazily on first keypress
(user gesture requirement).

---

## 8. ImGui structure (UI overlay)

```
ImGui::Begin("##overlay", nullptr, ImGuiWindowFlags_NoDecoration)
  ├─ Score (top-left)
  ├─ Rung label + progress bar
  ├─ Announce banner (center, fades)
  ├─ Distance (top-center)
  ├─ Biome name (top-right)
  ├─ Mute icon (top-right)
  ├─ Health bar (bottom-center)
  ├─ Shield bar (above health)
  ├─ Thrust bar (bottom-left)
  ├─ Warnings (bottom-center)
  ├─ Flash overlay (full-screen red, 120 ms)
  ├─ Low HP vignette (full-screen radial)
  ├─ Storm static (full-screen noise)
  ├─ Controls hint (bottom-right)
  ├─ AQ indicator (bottom-right)
  └─ Pause overlay (full-screen)
ImGui::End()

// Separate windows:
ImGui::Begin("LadderChart")   // C-key toggle
ImGui::Begin("DeathScreen")   // full-screen on death
```

Z-order handled by ImGui (render order = z-order).

---

## 9. Event catalog (complete)

Same event names as the JS implementation. See 01-functional-specification
§12 for the full table.

C++ implementation:
```cpp
namespace Events {
    constexpr const char* SCORE_CHANGED = "SCORE_CHANGED";
    constexpr const char* BIOME_CHANGED = "BIOME_CHANGED";
    constexpr const char* PLAYER_HEALTH_CHANGED = "PLAYER_HEALTH_CHANGED";
    constexpr const char* PLAYER_HEALTH_REGEN = "PLAYER_HEALTH_REGEN";
    constexpr const char* PLAYER_DIED = "PLAYER_DIED";
    constexpr const char* PLAYER_KILLED_ENTITY = "PLAYER_KILLED_ENTITY";
    constexpr const char* LADDER_RUNG_CHANGED = "LADDER_RUNG_CHANGED";
    constexpr const char* LADDER_FINALE_REACHED = "LADDER_FINALE_REACHED";
    constexpr const char* ENV_CRYSTAL_DESTROYED = "ENVIRONMENT_CRYSTAL_DESTROYED";
    constexpr const char* ENV_PULSAR_SPAWNED = "ENVIRONMENT_PULSAR_SPAWNED";
    constexpr const char* ENV_STORM_STRIKE = "ENVIRONMENT_STORM_STRIKE";
    constexpr const char* ENV_HULK_DESTROYED = "ENVIRONMENT_HULK_DESTROYED";
    constexpr const char* ENV_CITY_FRAGMENT_SPAWNED = "ENVIRONMENT_CITY_FRAGMENT_SPAWNED";
    constexpr const char* ENV_WRECK_DESTROYED = "ENVIRONMENT_WRECK_DESTROYED";
    constexpr const char* ENV_BLACK_HOLE_COLLAPSE = "ENVIRONMENT_BLACK_HOLE_COLLAPSE";
    constexpr const char* STORM_STATIC_CHANGED = "STORM_STATIC_CHANGED";
    constexpr const char* AUDIO_MUTED = "AUDIO_MUTED";
    constexpr const char* INPUT_SHIELD = "INPUT_SHIELD";
    constexpr const char* INPUT_THROTTLE_SET = "INPUT_THROTTLE_SET";
    constexpr const char* GAME_PAUSED = "GAME_PAUSED";
}
```

---

## 10. Config file

`~/.void_drift/config.json`:
```json
{
  "highscore": 0,
  "muted": false,
  "lightProfile": "auto"
}
```

Written atomically (write to temp file, rename). Read on init with
defaults on missing/corrupt.

---

## 11. Headless perf check (`scripts/check-perf.sh`)

**Prerequisites:**
- Built binary.
- `LIBGL_ALWAYS_SOFTWARE=1` for SwiftShader (software GL).

**Procedure:**
1. Run binary with `--teleport 36000` flag (teleport to SPATIAL_GRAVEYARD).
2. Wait 2 s for world to populate.
3. Sample 30 s: FPS, draw calls (via `GL_DEBUG_OUTPUT` or debug label),
   triangles.

**Assertions:**
- 0 crash/segfault.
- Max draw calls ≤ 3500.
- Avg FPS ≥ 5 (SwiftShader sanity floor).

**Exit codes:** 0 = pass, 1 = fail.

**Why 3500 not 500:** SwiftShader frustum-culls nothing. 3500 catches
runaway pools while staying achievable. Real GPU with frustum culling
targets ≤ 500.

---

## 12. CMake configuration

```cmake
cmake_minimum_required(VERSION 3.16)
project(VoidDrift VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenGL REQUIRED)
find_package(glfw3 REQUIRED)
find_package(GLM REQUIRED)
find_package(OpenAL REQUIRED)
find_package(SndFile REQUIRED)
find_package(nlohmann_json REQUIRED)

# Dear ImGui
add_subdirectory(external/imgui)

add_executable(void_drift
    src/main.cpp
    src/core/Game.cpp
    src/core/EventBus.cpp
    src/core/GameState.cpp
    src/core/Window.cpp
    src/core/Timing.cpp
    src/systems/InputSystem.cpp
    src/systems/PhysicsSystem.cpp
    src/systems/CameraSystem.cpp
    src/systems/ParticleSystem.cpp
    src/systems/AudioSystem.cpp
    src/systems/PostProcessingSystem.cpp
    src/systems/LightManager.cpp
    src/systems/AdaptiveQuality.cpp
    src/gameplay/PlayerShip.cpp
    src/gameplay/WeaponSystem.cpp
    src/gameplay/ScoreSystem.cpp
    src/level/ChunkManager.cpp
    src/level/BiomeGenerator.cpp
    src/level/AsteroidField.cpp
    src/level/CometSystem.cpp
    src/level/BlackHoleSystem.cpp
    src/level/DeadStarSystem.cpp
    src/level/NebulaSystem.cpp
    src/level/StationSystem.cpp
    src/level/DebrisSystem.cpp
    src/level/CrystalSystem.cpp
    src/level/PulsarSystem.cpp
    src/level/StormSystem.cpp
    src/level/HulkSystem.cpp
    src/level/CitySystem.cpp
    src/level/ProceduralWrecks.cpp
    src/level/Starfield.cpp
    src/ui/HUD.cpp
    src/ui/LadderChart.cpp
    src/ui/Crosshair.cpp
    src/ui/DeathScreen.cpp
    src/utils/Shader.cpp
    src/utils/ResourceLoader.cpp
    src/utils/PerfProbe.cpp
)

target_link_libraries(void_drift
    OpenGL::GL
    glfw
    imgui
    openal
    sndfile
    nlohmann_json::nlohmann_json
    GLM::glm
)

target_include_directories(void_drift PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/external
)

# Shader preprocessor (optional: concatenate #include directives)
# add_custom_command for shader preprocessing
```

---

## 13. Key differences from the JS implementation

| Aspect | JS (Three.js) | C++ (OpenGL) |
|--------|--------------|--------------|
| Renderer | WebGL2 (via Three.js) | OpenGL 4.6 core |
| Math | Three.js Vec3/Quat/Mat4 | GLM (glm::vec3/quat/mat4) |
| Shaders | JS template strings | Separate .vert/.frag files |
| HUD | DOM elements | Dear ImGui |
| Audio | Web Audio API (procedural) | OpenAL + libsndfile (WAV files) |
| Persistence | localStorage | JSON config file |
| Build | Vite dev server | CMake + Makefile |
| Pointer lock | `document.pointerLockElement` | `glfwSetInputMode(GLFW_CURSOR` |
| MSAA | `antialias: true` (WebGL) | `GLFW_SAMPLES, 4` + `GL_MULTISAMPLE` |
| Tone mapping | `ACESFilmicToneMapping` (Three.js) | Manual ACES in base.frag |
| Fog | `THREE.FogExp2` | Manual in base.frag |
| Instancing | `THREE.InstancedMesh` | `glDrawElementsInstanced` / `glDrawArraysInstanced` |
| Points | `THREE.Points` | `glDrawArrays(GL_POINTS)` + `GL_PROGRAM_POINT_SIZE` |
| Post-processing | `EffectComposer` | Manual FBO chain |
| Chunk streaming | JS object pool | C++ struct pool (pre-allocated) |
| RNG | mulberry32 (JS) | mulberry32 (C++ port) |
| Config | localStorage | JSON file |
| Dev tools | Browser DevTools | ImGui perf probe + `--perf` flag |
