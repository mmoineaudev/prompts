# Space Hauler C++ — Procedural Galaxy Trading (OpenGL + GLFW + Dear ImGui)

**Source of truth for the C++ implementation.** Everything in this document is binding: mechanics, numbers, rules, formulas, technical architecture, directory structure, and verification.

**v1.0.0** — First specification. Supersedes any prior prompt or design note.

---

## 1. Game Identity & Design Pillars

- **The hauler**: You're a space trucker buying cargo at Station A, navigating through a procedurally-generated cluster of star systems, surviving encounters (pirates, asteroids, cosmic hazards), and selling at Station B for profit. Die in transit → return home → spend persistent credits on upgrades.
- **Hybrid view**: A 2D top-down **Galaxy Map** (node graph, orthographic) for route planning, and a first-person **3D Flight Segment** for traversal and encounters. Transition between them is seamless.
- **Data-driven**: Ship stats, cargo types, encounter definitions, economy tables, and faction data all live in JSON files. Changing a stat or adding a new entity type requires no code changes — only data edits.
- **Modular & extensible**: A base Entity class with pluggable components (physics, render, AI, damage) means new encounter types and animated entities can be added by writing a single component file + JSON definition.
- **Performance is a hard requirement**: 60 fps cap, enforced by design budgets and a self-degrading quality system (3 tiers: auto, eco, high).

### Scope-Limited MVP

1. 1 ship (Hauler Mk I), 3 systems (Home → Trading Post → Mining Outpost, 2 routes)
2. 3 cargo types: Food, Ore, Tech
3. 2 encounters: Asteroid field (dodge/cancel) and Pirate ambush (shoot)
4. 1 upgrade: Cargo Bay (+10t, one-time, 50 persistent)
5. Visual: low-poly ship model, 2 station models, parallax starfield, engine trail particles, bloom on stations, basic flight corridor
6. HUD: credits, cargo manifest, fuel bar, hull bar
7. Galaxy map: simple line of 3 nodes, adjacent-only click, show fuel cost
8. Flight segment: free flight for 15s, encounter triggers at midpoint, system name on arrival
9. Death: hull <= 0 → death screen → back to home port
10. Meta-progression: none yet (no persistent credits) — just validating the loop

---

## 2. Controls

All binds use `event.code` (physical key position — AZERTY compatible).

| Action | Bind (code) | Type | Notes |
|---|---|---|---|
| Pitch down | `KeyW` (Z on AZERTY) | hold | 1.5 rad/s |
| Pitch up | `KeyS` | hold | 1.5 rad/s |
| Strafe left | `KeyA` (Q on AZERTY) | hold | local X axis |
| Strafe right | `KeyD` | hold | local X axis |
| Roll left / right | `KeyQ` (A on AZERTY) / `KeyE` | hold | 3.0 rad/s |
| Throttle forward/back | `Shift` / `Ctrl` | hold | ±10% per second |
| Mouse aim | Mouse movement | pointer lock | 0.0025 rad/px |
| Fire turret | `MouseLeft` | click | when weapon mounted |
| Brace (solar flare) | `Space` | edge press | within time window |
| Toggle map | `KeyM` | edge | switch between map and flight |
| Pause | `Escape` | edge press | toggles |
| Restart (death screen) | `KeyR` | edge | |
| Mute | `KeyN` | edge | toggles audio |

---

## 3. State Machine

```
           +----------+    select system    +-------+    arrive     +----------+
           |   HUB    | ──────────────────> |  MAP  | ────────────> |  SYSTEM  |
           +----------+                     +-------+               +----------+
               ^                                |                       |
               |                        confirm route           buy/sell/depart
               |                                |                       |
               |                                v                       |
               |                        +-------------+                  |
               | <── death ──────────── |   FLIGHT    | <────────────────┘
               |                        +-------------+
               |                               |  │
               |                        encounter │  │ arrive
               |                             triggers │
               |                               v  v
               |                        +-------------+
               | <── success ─────────── |  RESULT     |
               |                        +-------------+
               |
               v
           +-----------+
           |  DEATH    | (summary → HUB)
           +-----------+
```

### State transitions

| From | Trigger | To | Action |
|---|---|---|---|
| HUB | Click "View Galaxy" | MAP | Show procedurally generated galaxy |
| MAP | Click adjacent system | MAP | Highlight route, show danger/fuel summary |
| MAP | Click "Launch" | FLIGHT | Begin flight along route |
| FLIGHT | Encounter trigger (distance threshold) | FLIGHT | Pause free flight, run encounter |
| FLIGHT | All route edges traversed | SYSTEM | Arrive at destination, show market |
| SYSTEM | Click adjacent system + "Depart" | FLIGHT | Continue journey |
| SYSTEM | Click "Return Home" → A* auto-path | FLIGHT | Auto-route to home port |
| SYSTEM | hull <= 0 during flight | DEATH | Show death screen |
| DEATH | Click "Continue" | HUB | Reset run state, return to hub |
| HUB | Run ends (returned home) | HUB | Show success screen, award persistent credits |

---

## 4. Core Systems

### 4.1 Galaxy Generation (Node Graph)

The galaxy is a weighted graph of 8-15 **systems** connected by **routes**.

Each system has:
- **Name**: procedurally generated (syllable combination: "Keplar-3", "Vorath Prime", "Nexus Station")
- **Type**: Trade Hub, Mining Outpost, Pirate Den, Research Station, Refugee Colony, Black Market
- **Economy**: import goods (high buy price), export goods (low sell price), supply/demand
- **Danger level**: 1-5, determines encounter frequency and severity
- **Faction**: Federation, Pirates, Merchants Guild, Scientists, Neutral
- **Services**: refuel and repair available at all stations
- **Nodes**: 1-3 points of interest per system

Generation algorithm:
1. Place a "home" system (safe, Federation, always starting point)
2. Place 1-2 "endpoint" systems (high-value, harder danger)
3. Fill remaining nodes with random types
4. Connect via Delaunay triangulation + prune for interesting graph
5. Assign route distances and danger levels based on endpoint danger values
6. Validate graph connectivity — every system reachable from home; regenerate if disconnected

### 4.2 Flight Fuel

- Ship has **600 fuel units** (10 minutes flight time)
- Consumption: **1 fuel per 10 distance units**
- Route distance → fuel cost = distance / 10
- Engine upgrade reduces consumption rate (-10% per level)
- Fuel = 0 and not docked → DEATH
- Player sees exact fuel cost before committing

### 4.3 Refuel & Repair

- **Refuel**: 1 credit per 10 fuel units. Full refuel (0→600) = 60 credits.
- **Repair**: 20% of current run credits for full hull restore. Dynamic: cheap when poor, expensive when rich.

### 4.4 Flight & Encounters

Flight corridor is **2x screen width** for freedom. Ship flies freely using ZQSD. Encounters trigger at **random distance intervals with minimum 2 minutes between encounters**.

#### Encounter count per route (Fibonacci)

| Danger Level | Encounters per route |
|---|---|
| 1 | 1 |
| 2 | 1 |
| 3 | 2 |
| 4 | 3 |
| 5 | 5 |

#### Encounter types

| Encounter | Interactive | Success outcome | Failure outcome |
|---|---|---|---|
| **Asteroid field** | Dodge (ZQSD) | No damage | Lose 5-15% hull |
| **Pirate ambush** | Manual crosshair turret (mouse aim + click). ~5 shots to kill. | Pirates destroyed | Lose 10-25% hull + 10-30% cargo |
| **Distress signal** | Choice: investigate / ignore | Rescue crew → faction rep + credits | Nothing |
| **Solar flare** | Brace (press Space within time window) | No damage | Lose 10-30% shield |
| **Mining claim** | Choice: extract / skip | Free ore cargo (costs extra fuel) | Nothing |
| **Black market** | Choice: trade / decline | Sell contraband at 2x price, risk follow-up attack | Nothing |
| **Jump gate** | Choice: enter / reroute | Shortcut (skips remaining route) | Random hull damage 5-20% |
| **Empty transit** | None | Peaceful leg | N/A |

Encounter duration: **5-15 seconds**. ECM Jammer: **40% chance to skip all pirate encounters on a route** (rolled once per route, not per encounter).

### 4.5 Cargo & Economy

#### Cargo types

| Type | Base price | Weight (t) | Notes |
|---|---|---|---|
| Food | 10 | 1 | Stable demand everywhere |
| Ore | 8 | 3 | Bulky, low value per ton |
| Tech | 25 | 1 | High value, attracts pirates |
| Medicine | 15 | 1 | Stable, moderate value |
| Weapons | 20 | 2 | Contraband in Federation (risk/reward) |
| Artifacts | 50 | 1 | Rare, one per run max |

#### Buy/sell limits
- **Buy**: up to remaining cargo hold capacity
- **Sell**: any quantity up to what you hold

#### Pricing per system type

Sell modifier = price system pays YOU. Buy modifier = price system CHARGES you. Final price = base price x modifier.

#### Supply & Demand

- Each system stocks limited quantity of each good (20-50 units at generation)
- Buying depletes supply → prices rise. Selling floods supply → prices fall.
- Quantities reset when leaving and re-entering a system.

#### Edge cases

- **Empty cargo hold**: allowed
- **No arbitrage possible**: if all reachable systems offer worse prices than purchase price → must return home or abort. Returning home is still a success.
- **Supply hits 0**: can't buy more. Normal.

| System Type | Food (sell/buy) | Ore (sell/buy) | Tech (sell/buy) | Medicine (sell/buy) | Weapons (sell/buy) | Artifacts (sell/buy) |
|---|---|---|---|---|---|---|
| Trade Hub | 90/110 | 80/120 | 150/80 | 110/95 | 100/100 | 130/70 |
| Mining Outpost | 110/90 | 50/200 | 200/50 | 105/95 | 80/120 | 100/100 |
| Pirate Den | 120/80 | 90/110 | 110/90 | 130/70 | 180/50 | 150/60 |
| Research Station | 100/100 | 100/100 | 180/60 | 120/80 | 70/130 | 200/40 |
| Refugee Colony | 80/130 | 120/80 | 90/110 | 160/70 | 60/140 | 90/110 |
| Black Market | 140/70 | 130/80 | 160/60 | 140/70 | 200/40 | 250/30 |

### 4.6 Run Scoring

- **Success**: returning to home port alive. Always counts as success regardless of profit/loss.
- **Profit/loss displayed** on success screen — profit earns persistent credits, loss earns zero.
- **Distance bonus**: +10% of total run credits for each system beyond first visited.

### 4.7 Ship & Upgrades

**Starting ship** — "Hauler Mk I": cargo 20t, fuel 600, hull 100, shield 50, speed 1.0x, no weapon

#### Upgrade slots

| Upgrade | Effect | Max Level | Cost formula |
|---|---|---|---|
| Cargo Bay | +10t capacity | 5 | level x 50 persistent |
| Engine | +20% speed, -10% fuel consumption | 5 | level x 60 persistent |
| Fuel Tank | +100 fuel capacity | 3 | level x 40 persistent |
| Hull Plating | +20 max hull | 5 | level x 50 persistent |
| Shield Generator | +30 max shield | 3 | level x 45 persistent |
| Weapon Mount | Adds turret | 1 | 80 persistent (one-time) |
| ECM Jammer | 40% skip pirate encounters | 1 | 100 persistent (one-time) |

#### Unlockable ships

| Ship | Cargo | Fuel | Speed | Hull | Shield | Special | Cost |
|---|---|---|---|---|---|---|---|
| Fast Courier | 10t | 480 | 1.8x | 70 | 30 | No weapon slot | 200 |
| Bulk Transporter | 50t | 900 | 0.6x | 200 | 80 | — | 300 |
| Armed Escort | 15t | 600 | 1.2x | 150 | 60 | Twin guns (double damage) | 350 |
| Smuggler's Run | 20t | 600 | 1.3x | 100 | 50 | ECM built-in, contraband immunity | 400 |

### 4.8 Meta-Progression

Two currencies:
- **Run credits**: earned during a run, lost on death. Used to buy cargo, pay services.
- **Persistent credits**: 10% of run credits earned at death/success added to persistent pool. Used for upgrades and ship unlocks.

**Starting capital** — unlock at home port:
- Level 1: +50 run credits, costs 100 persistent
- Level 2: +100 run credits, costs 200 persistent
- Level 3: +150 run credits, costs 300 persistent

#### Economy balance (MVP — intentionally easy)
- Successful run profit target: **200-500 run credits**
- Persistent credits per run: **20-50**
- First upgrade (Cargo Bay L1): **50 persistent** (1-2 successful runs)
- First new ship (Fast Courier): **200 persistent** (4-10 successful runs)

### 4.9 Faction Reputation

- Each profitable trade (sell price > buy price) with a faction awards **+10% reputation**
- Neutral faction trades count toward no faction
- Reputation is linear, 0-100%
- Each 10% reputation = **1% better buy prices and 1% better sell prices**
- Max bonus: 100% reputation = 10% price advantage

---

## 5. Application Architecture

### 5.1 Directory Structure

```
c++_space-explorer-qwenlocal/
├── CMakeLists.txt          # Build system (CMake, modern C++17)
├── launch.sh               # Launcher: build (if needed) + run
├── data/                   # JSON data files (no code changes needed to edit game content)
│   ├── ships.json          # Ship definitions, stats, upgrade paths, costs
│   ├── cargo.json          # Cargo type definitions, base prices, weights
│   ├── encounters.json     # Encounter types, probability weights, damage ranges
│   ├── factions.json       # Faction definitions, color palettes, price modifiers
│   ├── systems.json        # System type definitions, economy modifiers, service costs
│   ├── economy.json        # Pricing formulas, supply/demand constants
│   └── galaxy.json         # Procedural generation parameters (syllables, node count)
├── src/
│   ├── main.cpp            # Entry point: window init, game create, main loop
│   ├── core/
│   │   ├── Game.hpp/cpp    # Orchestrator: init, loop, shutdown, restart
│   │   ├── EventBus.hpp/cpp# Singleton pub/sub (typed events, no cross-module imports)
│   │   ├── GameState.hpp/cpp# Singleton: run state + meta state, reset() for new runs
│   │   ├── Constants.hpp   # Runtime constants (non-configuration: camera, rendering settings)
│   │   ├── Window.hpp/cpp  # GLFW window management, monitor detection
│   │   └── Timing.hpp/cpp  # Fixed timestep, delta-time normalization, frame pacing
│   ├── systems/
│   │   ├── InputSystem.hpp/cpp   # GLFW callbacks mapped to event.code (ZQSD)
│   │   ├── PhysicsSystem.hpp/cpp # AABB collision, impulse resolution
│   │   ├── AudioSystem.hpp/cpp   # Discrete audio: simple WAV/OGG playback, mute toggle
│   │   ├── RenderSystem.hpp/cpp  # OpenGL render pipeline (buffers, shaders, post-processing)
│   │   ├── LightManager.hpp/cpp  # Dynamic light budget (priority-culled)
│   │   └── ParticleSystem.hpp/cpp# Engine trails, explosions, bloom glow
│   ├── gameplay/
│   │   ├── PlayerShip.hpp/cpp    # Ship model, movement (ZQSD), weapons, damage flash
│   │   ├── WeaponSystem.hpp/cpp  # Turret logic, projectile pool, fire rate
│   │   └── BuffSystem.hpp/cpp    # Temporary buffs (invulnerability, speed boost, etc.)
│   ├── entities/             # Entity base class + pluggable components
│   │   ├── Entity.hpp/cpp    # Base class: position, orientation, component storage
│   │   ├── components/
│   │   │   ├── Physics.hpp   # Component: velocity, mass, acceleration
│   │   │   ├── Render.hpp    # Component: mesh, material, transform
│   │   │   ├── Damage.hpp    # Component: health, damage source, invulnerability
│   │   │   ├── AI.hpp        # Component: movement patterns, targets, behavior
│   │   │   └── ComponentBase.hpp  # Interface: update(dt), onCollision(other), onRemove()
│   │   ├── Asteroid.hpp/cpp  # Component: physics + damage + render
│   │   ├── PirateShip.hpp/cpp # Component: physics + damage + AI (turret, evasion)
│   │   ├── Station.hpp/cpp   # Component: render + AI (docking animation)
│   │   ├── CargoContainer.hpp/cpp # Component: render (cargo boxes on hull)
│   │   └── EntityFactory.hpp/cpp  # Factory: create entity from JSON definition
│   ├── level/
│   │   ├── GalaxyGenerator.hpp/cpp  # Procedural node graph: Delaunay + validation
│   │   ├── RouteManager.hpp/cpp     # Pathfinding (A* for auto-routing home)
│   │   ├── BiomeGenerator.hpp/cpp   # Biome zone definitions, transition handling
│   │   └── ChunkManager.hpp/cpp     # Chunk-based world streaming
│   ├── ui/
│   │   ├── HUD.hpp/cpp               # ImGui overlay: credits, cargo manifest, bars
│   │   ├── GalaxyMapUI.hpp/cpp       # ImGui overlay: system tooltips, route info
│   │   ├── EncounterUI.hpp/cpp       # ImGui overlay: encounter-specific UI
│   │   ├── CargoMarket.hpp/cpp       # ImGui overlay: buy/sell panel
│   │   ├── DeathScreen.hpp/cpp       # ImGui overlay: run summary
│   │   └── Tutorial.hpp/cpp          # ImGui overlay: first-run tooltips
│   └── utils/                        # Pre-defined utility functions (see §6)
│       ├── Math.hpp                  # Vec3, Quat, Mat4, lerp, clamp, smoothstep, RNG
│       ├── Shader.hpp/cpp            # Compile/link shaders, bind uniforms, hot-reload
│       ├── ResourceLoader.hpp/cpp    # File I/O: JSON data, textures, model files
│       ├── ConfigParser.hpp/cpp      # Parse JSON configs (nlohmann/json)
│       ├── PerfProbe.hpp/cpp         # Frame timing, FPS counter, quality levels
│       └── Logging.hpp/cpp           # §6.7 Observability: console+file logs, trace scopes, crash safety
├── shaders/                          # GLSL shader files (separate for hot-reload)
│   ├── base.vert                     # Vertex shader: MVP transform, normals
│   ├── base.frag                     # Fragment shader: diffuse + specular + fog
│   ├── fresnel.frag                  # Fresnel rim shader (ship glow)
│   ├── glow.frag                     # Glow pulse (stations, jump gates)
│   ├── engine.frag                   # Engine flame shader
│   ├── bloom.vert/frag              # Post-processing: blur, combine
│   ├── light.frag                    # Multi-light shading (budgeted)
│   └── particle.vert/frag            # Additive particles (billboard)
└── assets/                          # Binary assets (textures, models, audio)
    ├── textures/                    # Procedural textures (canvas-generated at runtime)
    ├── models/                      # Low-poly model files (OBJ format)
    └── audio/                       # Discrete audio files (WAV/OGG, 44.1 kHz mono or stereo)
```

### 5.1b JSON Data Convention (enforced)

All JSON data files follow this strict schema. The ConfigParser validates every file at startup — **any missing field, wrong type, or unknown key causes a hard compile-time error** (see §16.3). No silent fallbacks.

**Top-level envelope**: every data file has exactly one top-level key, the plural snake_case name of its contents.

| File | Top-level key | Element key | Required fields |
|---|---|---|---|
| ships.json | `ships` | (unnamed) | `id`, `name`, `cargo`, `fuel`, `hull`, `shield`, `speed`, `modelPath` |
| cargo.json | `cargoTypes` | (unnamed) | `id`, `name`, `basePrice`, `weight` |
| encounters.json | `encounterTypes` | (unnamed) | `id`, `name`, `type` (dodge/combat/choice), `interactive` (bool) |
| factions.json | `factions` | (unnamed) | `id`, `name`, `color` ([r,g,b] floats 0-1), `priceMultiplier` |
| systems.json | `systemTypes` | (unnamed) | `id`, `name`, `services` ([refuel,repair]), `dangerBase` |
| economy.json | `economy` | `pricingTable`, `supplyDemand` | see §4.5 tables |
| galaxy.json | `galaxy` | `syllables`, `nodeCountMin`, `nodeCountMax`, `edgePruneDist` | all present |

**Naming rules**:
- All keys: `snake_case`
- IDs: `snake_case`, lowercase, no special characters
- Numeric values: no units in the field name — units are defined in the spec section
- Arrays must be non-empty; objects must have at least one element
- Booleans must be native JSON `true`/`false`, not string `"true"`

**Validation**: `ConfigParser::validate(dataPath)` reads the file, checks the top-level key, checks required fields per element, and **throws** on first error. The game does not start if validation fails.

### 5.2 Entity System (Hybrid: Base Class + Components)

The entity system uses a **base Entity class** (familiar, simple) with **pluggable components** (extendable, no inheritance explosion).

```cpp
class Entity {
public:
    virtual ~Entity() = default;
    virtual void update(float dt) = 0;
    virtual void onCollision(Entity* other) = 0;
    virtual void onRemove() = 0;

    Vec3 position;
    Vec3 orientation;       // Euler angles: pitch, yaw, roll
    EntityFactory* factory; // Pointer back to factory (for creation)
};

// Components are stored as a flat array within Entity, accessed by type.
// Adding a new component type = 1 new header + 1 new JSON entry.
```

Example: PirateShip adds `Physics`, `Damage`, `AI`, and `Render` components. Asteroid adds `Physics`, `Damage`, `Render`. Station adds `Render`, `AI`.

### 5.3 EventBus Events

```cpp
// Game flow
GAME_STATE_CHANGE   // { from, to }
RUN_STARTED
RUN_ENDED          // { reason, runCredits, profit, persistentCredits, systemsVisited }

// Map / route
SYSTEM_SELECTED    // { system }
ROUTE_CONFIRMED    // { from, to, danger, fuelCost, encounterCount }
SYSTEM_ARRIVED     // { system }

// Flight
FLIGHT_STARTED     // { route }
FLIGHT_ENDED       // { arrived }
ENCOUNTER_TRIGGERED     // { type, data }
ENCOUNTER_RESOLVED      // { type, outcome, damage, cargoLost }

// Cargo / economy
CARGO_BOUGHT       // { type, quantity, price, total }
CARGO_SOLD         // { type, quantity, price, total, profit }
CREDITS_CHANGED    // { amount, reason, newTotal }

// Ship
SHIP_DAMAGED       // { amount, source, newHull }
SHIP_DESTROYED     // { reason }
SHIP_REPAIRED      // { cost, newHull }
FUEL_CHANGED       // { amount, newTotal }
CARGO_CHANGED      // { cargoManifest }

// UI
UI_OPEN_MARKET     // { system }
UI_CLOSE_MARKET
UI_SHOW_DEATH      // { summary }
UI_SHOW_SUCCESS    // { summary }

// Meta
META_UPGRADE_BOUGHT  // { upgrade, level, cost }
META_SHIP_UNLOCKED   // { shipId }
FACTION_REP_CHANGED  // { faction, change, newTotal }
```

### 5.4 GameState Structure

```cpp
class GameState {
public:
    void reset();  // Restore clean run slate, keep meta

    // Game
    std::string state;           // "HUB" | "MAP" | "FLIGHT" | "ENCOUNTER" | "SYSTEM" | "DEATH"
    bool runActive;
    bool paused;

    // Ship
    std::string shipId;
    int cargo;           // current tons
    int cargoMax;
    int fuel;
    int fuelMax;
    int hull;
    int hullMax;
    int shield;
    int shieldMax;
    float speed;
    bool hasWeapon;
    bool hasECM;

    // Run
    int credits;
    int startingCredits;
    std::map<std::string, int> cargoManifest;  // { cargoType: quantity }
    std::string currentSystem;
    std::vector<std::string> visitedSystems;
    std::vector<std::string> routeHistory;
    std::map<std::string, int> factionTrades;
    int profit;

    // Meta
    int persistentCredits;
    std::map<std::string, int> upgrades;  // { upgradeId: level }
    std::vector<std::string> unlockedShips;
    std::map<std::string, int> factionRep;  // { factionId: 0-100 }
    int startingCapitalLevel;  // 0-3
};
```

---

## 6. Utility Functions (Pre-defined)

These utilities are **pre-implemented** before game logic begins. Every system uses them — no duplication, no reinvention.

### 6.1 Math Utilities (`utils/Math.hpp`)

| Function | Purpose |
|---|---|
| `Vec3 lerp(Vec3 a, Vec3 b, float t)` | Linear interpolation (clamped 0-1) |
| `float lerp(float a, float b, float t)` | Scalar interpolation |
| `float clamp(float val, float min, float max)` | Clamp to range |
| `float smoothstep(float edge0, float edge1, float x)` | Smooth interpolation |
| `float deg2rad(float deg)` | Degrees to radians |
| `float rad2deg(float rad)` | Radians to degrees |
| `float randRange(float min, float max, int seed)` | Deterministic random range |
| `float noise2D(float x, float y)` | Perlin/simplex noise (1D and 2D variants) |
| `float distance(Vec3 a, Vec3 b)` | Euclidean distance |
| `Vec3 normalize(Vec3 v)` | Safe normalize (returns zero vector if length < 1e-6) |
| `Vec3 reflect(Vec3 v, Vec3 n)` | Reflect vector off normal |
| `bool aabbIntersect(Rect a, Rect b)` | AABB intersection test |

All math functions are **inline constexpr** where possible. No virtual dispatch.

### 6.2 Shader Utilities (`utils/Shader.hpp`)

| Function | Purpose |
|---|---|
| `ShaderProgram compileShader(std::string vertPath, std::string fragPath)` | Compile and link vertex + fragment shaders |
| `void bindUniform(ShaderProgram prog, const std::string& name, float value)` | Bind uniform by name |
| `void bindUniform(ShaderProgram prog, const std::string& name, const Vec3& value)` | Bind vec3 uniform |
| `void bindUniform(ShaderProgram prog, const std::string& name, const Mat4& value)` | Bind mat4 uniform |
| `ShaderProgram getShaderByName(std::string name)` | Lookup compiled shader by registered name |
| `void registerShader(std::string name, ShaderProgram prog)` | Register shader for lookup |
| `bool shaderHotReload(ShaderProgram& prog, std::string vertPath, std::string fragPath)` | Dev-only: recompile if file changed (file timestamp check) |

Shaders are compiled at init and registered by name. UI/game systems request shaders by name — no direct includes of shader files.

### 6.3 Resource Management (`utils/ResourceLoader.hpp`)

| Function | Purpose |
|---|---|
| `std::string readTextFile(std::string path)` | Read file contents as string |
| `std::vector<uint8_t> readBinaryFile(std::string path)` | Read binary file |
| `JsonData loadJSON(std::string path)` | Parse JSON (using nlohmann/json) |
| `bool writeJSON(JsonData data, std::string path)` | Write JSON to file (for meta-save) |
| `void disposeTexture(GLuint tex)` | Delete OpenGL texture and reset |
| `void disposeMesh(GLuint vbo, GLuint ebo)` | Delete mesh buffers |
| `void disposeAllResources()` | Cleanup all loaded resources (called on restart) |

Resources are tracked in a `ResourceManager` singleton. On `GameState.reset()`, all resources are disposed and reloaded from scratch.

**Async worker thread**: All file I/O (JSON configs, OBJ models, textures, audio samples) runs on a **dedicated worker thread** (`std::jthread`). The main thread requests loads via `ResourceManager::loadAsync(path, priority)`. The worker reads files, parses data, and returns `ResourceHandle` objects through a lock-free channel. The main thread polls handles each frame. Priority queue ensures game-critical resources (shaders, ship model) load before decorative ones (distant textures).

### 6.4 Entity Factory (`entities/EntityFactory.hpp`)

| Function | Purpose |
|---|---|
| `Entity* createEntity(std::string type, JsonData data)` | Create entity from JSON definition |
| `void registerEntityType(std::string name, FactoryFunc)` | Register a factory function for a type |
| `void destroyEntity(Entity* entity)` | Delete entity and remove from scene |
| `void clearAllEntities()` | Destroy all entities in scene |

Types are registered at startup (Asteroid, PirateShip, Station, etc.). The factory reads the JSON data and attaches the appropriate components.

### 6.5 Config/Data Loading (`utils/ConfigParser.hpp`)

| Function | Purpose |
|---|---|
| `JsonData loadShipConfig(std::string path)` | Load ships.json |
| `JsonData loadCargoConfig(std::string path)` | Load cargo.json |
| `JsonData loadEncounterConfig(std::string path)` | Load encounters.json |
| `JsonData loadEconomyConfig(std::string path)` | Load economy.json |
| `ShipStats getShipStats(std::string id)` | Get ship stats by ID (cached) |
| `CargoType getCargoType(std::string id)` | Get cargo type by ID (cached) |
| `EncounterType getEncounterType(std::string id)` | Get encounter type by ID (cached) |

Data is loaded once at init and cached. Runtime lookups are O(1) map accesses.

### 6.6 Timing (`utils/Timing.hpp`)

| Function | Purpose |
|---|---|
| `float getDeltaTime()` | Return delta time (seconds) since last frame |
| `float getFixedDeltaTime()` | Return fixed timestep (1/60) |
| `void resetTimer()` | Reset internal timer (called on restart) |
| `int getFPS()` | Return current FPS (smoothed over 0.5s) |
| `bool shouldTick(float dt)` | Check if enough time has passed for fixed timestep |
| `void waitForTargetFPS(int target)` | Throttle to target FPS (60) |

Uses `std::chrono::high_resolution_clock`. Fixed timestep at 60 Hz; interpolation for rendering.

### 6.7 Logging & Observability (`utils/Logging.hpp/cpp`)

A lightweight, zero-overhead logging system for **debug traces and runtime observability**. Logs are emitted to both **console and a rotate log file** (`logs/game.log`), with **trace groups** for sharing session traces with the developer.

#### Severity Levels

| Level | Constant | Meaning | Always emitted |
|---|---|---|---|
| DEBUG | `LOG_DEBUG` | Dev-only diagnostics (entity spawns, physics ticks, AI decisions) | No (compile-time optional) |
| INFO | `LOG_INFO` | Normal runtime state changes (state transitions, encounter triggers, economy events) | Yes |
| WARN | `LOG_WARN` | Non-fatal warnings (entity budget exceeded, failed texture load, supply depleted) | Yes |
| ERROR | `LOG_ERROR` | Failures that degrade gameplay (collision resolution failure, event bus handler crash) | Yes |
| FATAL | `LOG_FATAL` | Game-breaking errors (OpenGL context lost, save write failure, data validation failure) | Yes |

#### Format

Console output (with ANSI color):
```
[HH:MM:SS.mmm] [LEVEL] [FPS:N] [Δt:X.XXms] [module.cpp:line] message
```

File output (machine-parseable, no ANSI):
```
2026-09-02T14:30:00.123|INFO|FPS:58|Δt:16.52ms|Game.cpp:142|Game loop started
```

#### Trace Groups

Named scopes for **session traces** that can be shared. A trace is a bracketed block of logs around a specific gameplay segment (e.g., a route, an encounter, or a meta-progression purchase).

```cpp
// Usage:
Logging::TraceScope("route:Home→TradingPost");
    LOG_INFO("launching route, danger=3, fuelCost=120");
    // ... gameplay events ...
    LOG_DEBUG("asteroid collision at t=4.2s, hull=-8");
LOG_SCOPE_END(); // auto-closes

// Output:
// [14:30:01.000] [INFO] [FPS:59] [Δt:16.20ms] Game.cpp:200 | >>> TRACE route:Home→TradingPost <<<
// [14:30:01.050] [INFO] [FPS:59] [Δt:16.20ms] RouteManager.cpp:45 | launching route, danger=3, fuelCost=120
// [14:30:05.123] [DEBUG] [FPS:58] [Δt:17.10ms] PhysicsSystem.cpp:180 | asteroid collision at t=4.2s, hull=-8
// [14:30:05.123] [INFO] [FPS:58] [Δt:17.10ms] Game.cpp:210 | <<< TRACE route:Home→TradingPost END (Δt=4.12s)
```

#### Configuration

```cpp
// Logging::init() reads from env/config at startup
Logging::Config config;
config.consoleEnabled = true;
config.fileEnabled = true;
config.fileMaxSizeKB = 1024;      // 1MB log, then rotate to game.log.1
config.traceEnabled = true;       // trace groups on by default
config.debugLevelEnabled = false; // compile-time optional via LOG_DEBUG macro
config.jsonOutput = false;        // file output in JSON for machine parsing
config.logDir = "logs";
```

Compile-time control: `#define LOG_ENABLE_DEBUG` enables `LOG_DEBUG` messages. Without it, debug logs are **zero-cost** (inline void function, optimized away by compiler).

#### API

| Function | Purpose |
|---|---|
| `LOG_INFO(msg)` | Info log (always emitted) |
| `LOG_WARN(msg)` | Warning log |
| `LOG_ERROR(msg)` | Error log |
| `LOG_FATAL(msg)` | Fatal log (then abort) |
| `LOG_DEBUG(msg)` | Debug log (compile-time optional) |
| `Logging::TraceScope scope("name")` | Begin named trace group |
| `Logging::TraceScope::~TraceScope()` | End trace, auto-emit duration |
| `Logging::flush()` | Force flush to file (for crash safety) |
| `Logging::getLogFile()` | Returns path to current log file |
| `Logging::shutdown()` | Flush all, close file handles |

#### Crash Safety

- All logs are **unbuffered** (written immediately to file). No loss on crash.
- `LOG_FATAL` calls `Logging::flush()` before `std::abort()`.
- Log file is opened with `std::ios::app` (append), never truncated (unless explicitly rotated).
- File handles are closed in `Logging::shutdown()`, called from `Game::shutdown()`.

#### Example Session Trace

A full session trace for sharing with the developer:

```
[14:30:00.000] [INFO] [FPS:60] [Δt:16.33ms] Game.cpp:50 | Game initialized, version 1.0.0
[14:30:00.100] [INFO] [FPS:60] [Δt:16.40ms] GameState.cpp:30 | meta state loaded, persistentCredits=50
>>> TRACE session:run1 <<<
[14:30:00.200] [INFO] [FPS:60] [Δt:16.50ms] Game.cpp:100 | state: HUB→MAP
[14:30:00.300] [INFO] [FPS:60] [Δt:16.55ms] RouteManager.cpp:80 | route selected: Home→TradingPost, danger=3, fuelCost=120
>>> TRACE route:Home→TradingPost <<<
[14:30:00.400] [INFO] [FPS:60] [Δt:16.60ms] Game.cpp:120 | state: MAP→FLIGHT
[14:30:05.100] [WARN] [FPS:55] [Δt:18.20ms] PhysicsSystem.cpp:200 | entity budget exceeded: 195/200 active
[14:30:05.200] [DEBUG] [FPS:54] [Δt:18.50ms] EncounterSystem.cpp:150 | encounter triggered: asteroid_field, distance=1250
[14:30:06.500] [INFO] [FPS:58] [Δt:17.10ms] EncounterSystem.cpp:200 | encounter resolved: dodge_success, hull_change=0
<<< TRACE route:Home→TradingPost END (Δt=6.10s)
[14:30:10.000] [INFO] [FPS:59] [Δt:16.80ms] Game.cpp:130 | state: FLIGHT→SYSTEM, arrived at TradingPost
[14:30:15.000] [INFO] [FPS:60] [Δt:16.40ms] EconomySystem.cpp:80 | cargo sold: Tech x5, profit=125
<<< TRACE session:run1 END (Δt=15.00s, profit=125, systemsVisited=2)
```

---

## 7. Build System

CMakeLists.txt (modern C++17):

```cmake
cmake_minimum_required(VERSION 3.16)
project(SpaceHauler VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Dependencies (installed via apt or vcpkg)
find_package(OpenGL REQUIRED)
find_package(glfw3 REQUIRED)
find_package(fmt REQUIRED)  # Optional: formatting
include_directories(${CMAKE_SOURCE_DIR}/src)

# Dear ImGui
add_subdirectory(external/imgui)

# Main executable
add_executable(SpaceHauler src/main.cpp ...)
target_link_libraries(SpaceHauler
    OpenGL::GL
    glfw
    imgui
    nlohmann_json::nlohmann_json
    libsndfile  # For discrete audio playback
)
```

**Dependencies**: GLFW, OpenGL, Dear ImGui, nlohmann/json, libsndfile (or OpenAL for audio), GLM (math library).

---

## 8. Audio

Discrete audio — simplicity first. Uses **libsndfile** for WAV/OGG playback with a minimal API:
- `AudioSystem::playOnce(fileRelativePath, volume)` — non-blocking, plays to stream
- `AudioSystem::playLoop(fileRelativePath, volume)` — loops until stopped
- `AudioSystem::stopAll()` — stop everything (called on restart)
- `AudioSystem::setMuted(bool)` — global mute toggle via `KeyN`

No music. No spatial audio. No mixing effects (reverb, EQ, Doppler). Just play/stop/mute.

Audio files are loaded asynchronously on a **worker thread** during the loading screen. The worker thread reads files, decodes with libsndfile, and pushes decoded samples into a lock-free ring buffer. The main thread's `AudioSystem` reads from the ring buffer to the ALSA/PulseAudio output stream. No blocking on the main thread after init.

---

## 9. Visual Style

- **Low-poly pixel-retro 3D** — flat-shaded ships and stations with vertex coloring
- **Galaxy map** — 2D top-down node graph rendered orthographically. Systems are glowing dots connected by trade route lines. Ship icon hops between nodes. Nebula gradients in background.
- **3D flight segments** — first-person cockpit view. Ship flies freely through a corridor (2x screen width) with parallax star layers, nebulae, distant celestial bodies. Encounters spawn at distance triggers.
- **Bloom** — on engine trails, station beacons, jump gates, and rare cargo
- **Discrete motion blur** — single-pass directional blur (1-3 passes, quality-dependent), applied to the full-screen quad during flight segments only (disabled on galaxy map). Not full per-object; just screen-space directional smear based on camera velocity.
- **Vignette** — subtle radial darkening at screen edges (10-15% darkening, quadratic falloff). Quality-dependent: auto=visible, eco=disabled, high=enhanced.
- **Ship models** — composite geometry (body + wings + cockpit + engine pods), named children for animation
- **Stations** — torus/dome geometries with glowing docking bays. Rotating antenna arrays.
- **Faction color palettes** — Federation (blue/gray), Pirates (red/black), Merchants (green/gold), Scientists (purple/cyan)
- **Station docking** — on-rails animation: ship glides into station bay, camera zooms, fade to market screen

---

## 10. Visual Polish Checklist

- [ ] Engine trail particles (additive blending, tiny cone sprite, ship-color tinted)
- [ ] Station glow pulse (rotating emissive band on station geometry)
- [ ] Jump gate visual (torus ring with animated emissive shader, particle burst on transit)
- [ ] Asteroid break effect (large asteroid → 2-3 smaller fragments on collision)
- [ ] Pirate ship model (dark palette, red rim shader, aggressive geometry)
- [ ] Cargo container model (box with straps, color-coded by cargo type)
- [ ] Ship damage visual (emissive flash on hit, brief scale stagger)
- [ ] Parallax star layers (3 depths at varying speeds, soft-round dot texture)
- [ ] Nebula backdrop (large transparent plane with noise-based shader at z=-200)
- [ ] Distance fog in flight segments (subtle, hides the end of the corridor)
- [ ] Bloom (threshold 0.4, strength 0.7) — stations and jump gates glow, ship doesn't wash out
- [ ] System dot pulse on galaxy map (breathing glow on reachable nodes, dim on visited)
- [ ] Route line animation (dashed line with moving dots showing active trade flow)
- [ ] Docking approach animation (ship glides into station bay, camera zooms, fade to market screen)
- [ ] Buy/sell visual feedback (credits counter animates, cargo icon appears/disappears)

---

## 11. Pitfalls to Avoid

- **Flight segment too long** — 15-30 seconds per route is the cap. Encounters minimum 2 min apart.
- **Economy too complex for MVP** — start with flat buy/sell prices per system type. Add supply/demand later.
- **Galaxy generation disconnected routes** — validate graph connectivity after generation. Regenerate if any system is unreachable.
- **Fuel as a softlock** — player must see fuel cost before committing. Fuel = 0 in transit = death.
- **Cargo not worth the risk** — successful run profit target: 200-500 run credits. First upgrade at 50 persistent.
- **Use event.code, not event.key** — flight controls are ZQSD. GLFW callbacks map to `event.code`.
- **Restart cleanup** — clean state on new run. Galaxy regenerates, ship resets, all entities destroyed, all resources disposed. Test 3 restarts in a row.
- **Audio out of scope for MVP** — discrete sounds only for MVP. No full audio system.
- **Map clicks: adjacent only** — player clicks a system connected by one edge to the current system.
- **Pirate ship HP** — 5 shots to kill with basic turret. Twin guns kill in 3 shots.
- **Repair is 20% of current credits** — full restore, one price regardless of damage.
- **ECM rolls once per route** — not per encounter. On success, ALL pirate encounters on that route are skipped.

---

## 12. Performance Requirements

- **60 fps cap**: `glSwapInterval(1)` enforced. Frame time budget: 16.67 ms.
- **Quality tiers** (3 levels, adjustable via `KeyL`):
    - **Auto** (default): bloom enabled, up to 14 dynamic lights, full shader complexity
    - **Eco**: bloom disabled, up to 6 dynamic lights, simplified shaders
    - **High**: bloom enhanced, up to 20 dynamic lights, higher detail models
- **Entity budget**: max 200 active entities (asteroids, pirates, stations, debris)
- **Instanced rendering** for repeated geometry (asteroids, debris, particle sprites)
- **LOD**: distant asteroids render as simple billboards instead of full meshes
- **Chunk streaming**: only load chunks within 500 units of player position
- **Light budget**: priority-culled. Ship lights always on; environmental lights sorted by importance

---

## 13. Data Format Examples

### ships.json

```json
{
  "ships": [
    {
      "id": "hauler_mk1",
      "name": "Hauler Mk I",
      "cargo": 20,
      "fuel": 600,
      "fuelMax": 600,
      "hull": 100,
      "hullMax": 100,
      "shield": 50,
      "shieldMax": 50,
      "speed": 1.0,
      "hasWeapon": false,
      "hasECM": false,
      "modelPath": "assets/models/hauler.obj"
    }
  ],
  "upgrades": [
    { "id": "cargo_bay",   "name": "Cargo Bay",      "costFormula": "level * 50",  "maxLevel": 5,  "effect": "+10t capacity" },
    { "id": "engine",      "name": "Engine",          "costFormula": "level * 60",  "maxLevel": 5,  "effect": "+20% speed, -10% fuel consumption" }
  ]
}
```

### cargo.json

```json
{
  "cargoTypes": [
    { "id": "food",      "name": "Food",    "basePrice": 10, "weight": 1 },
    { "id": "ore",       "name": "Ore",     "basePrice": 8,  "weight": 3 },
    { "id": "tech",      "name": "Tech",    "basePrice": 25, "weight": 1 }
  ]
}
```

### encounters.json

```json
{
  "encounterTypes": [
    {
      "id": "asteroid_field",
      "name": "Asteroid Field",
      "interactive": true,
      "type": "dodge",
      "durationMin": 5,
      "durationMax": 15,
      "successOutcome": "no_damage",
      "failureHullDamageMin": 5,
      "failureHullDamageMax": 15
    },
    {
      "id": "pirate_ambush",
      "name": "Pirate Ambush",
      "interactive": true,
      "type": "combat",
      "durationMin": 10,
      "durationMax": 30,
      "piratesPer5Min": 1,
      "shotsToKill": 5,
      "failureHullDamageMin": 10,
      "failureHullDamageMax": 25,
      "failureCargoLossMin": 10,
      "failureCargoLossMax": 30
    }
  ]
}
```

---

## 14. Application Architecture — Detailed

### 14.1 Orchestrator (Game)

The `Game` class is the single entry point. It:
1. Creates the GLFW window
2. Initializes OpenGL context
3. Creates the EventBus singleton
4. Loads all JSON data files
5. Initializes systems (Input, Physics, Audio, Render, Light, Particle)
6. Creates the GameState singleton
7. Enters the main loop (input → update → render)
8. Handles shutdown (dispose all resources, destroy window)

### 14.2 System Initialization Order

```
Game::init()
  → Window::init()
  → ShaderManager::init()     // Compile all shaders from .vert/.frag files
  → ResourceLoader::init()    // Load textures, models, audio
  → InputSystem::init()       // Register GLFW callbacks
  → PhysicsSystem::init()     // Setup collision pairs
  → AudioSystem::init()       // Initialize libsndfile
  → RenderSystem::init()      // Setup FBOs, bloom pass, ImGui context
  → LightManager::init()      // Setup dynamic light pool
  → ParticleSystem::init()    // Setup particle pool
  → EntityFactory::init()     // Register entity types
  → EventBus::init()          // Already exists, register listeners
  → GameState::init()         // Load meta-progression from disk
```

### 14.3 Main Loop

```cpp
while (!shouldQuit) {
    glfwPollEvents();
    float dt = Timing::getDeltaTime();

    if (!gameState.paused) {
        if (Timing::shouldTick(dt)) {
            inputSystem.update();          // Read GLFW state
            gameState.update(dt);          // Update run state
            entitySystem.update(dt);       // Update all entities
            physicsSystem.update(dt);      // Resolve collisions
            routeManager.update(dt);       // Check encounter triggers
        }
    }

    renderSystem.render();              // Render all visible entities
    uiSystem.render();                  // ImGui overlays
    Timing::waitForTargetFPS(60);       // Cap at 60 fps
}
```

### 14.4 Entity Lifecycle

```
Game::spawnEntity(JsonData data)
  → EntityFactory::createEntity(type, data)
    → Allocate new Entity
    → Attach components based on data
    → Add to scene graph
    → Emit Events::ENTITY_SPAWNED

Game::destroyEntity(Entity* entity)
  → Remove from scene graph
  → Destroy components
  → Delete entity
  → Emit Events::ENTITY_DESTROYED

Game::destroyAllEntities()
  → Clear scene graph
  → Dispose all components
  → Emit Events::ENTITY_CLEAR
```

### 14.5 Component System

Components are stored as **flat arrays** within an Entity:

```cpp
class Entity {
    std::vector<std::unique_ptr<ComponentBase>> components;
    Physics* getPhysics()  { return findComponent<Physics>(); }
    Render*  getRender()   { return findComponent<Render>(); }
    Damage*  getDamage()   { return findComponent<Damage>(); }
    AI*      getAI()       { return findComponent<AI>(); }
};
```

New component types are added by:
1. Adding a new class in `components/`
2. Registering it in `EntityFactory`
3. Adding a JSON entry in the appropriate data file

No code changes required for new entity definitions — only JSON.

---

## 15. Procedural Generation

### 15.1 Galaxy Graph Generation

Algorithm:
1. Place home system at origin (0, 0) on 2D plane
2. Place 1-2 endpoint systems at random distance 3-6 units from home
3. Place remaining 5-12 systems using Poisson-disc sampling (minimum 1.5 units apart)
4. Connect via Delaunay triangulation
5. Prune edges longer than 3 units (keep graph sparse)
6. Validate connectivity: BFS from home — every system must be reachable. Regenerate if not.
7. Assign route distances: edge length x 100 (arbitrary units)
8. Assign danger levels: max(dangerA, dangerB) + random 0-1, clamped 1-5
9. Assign economy: based on system type JSON definition
10. Assign faction: based on proximity to other systems of same faction

### 15.2 System Name Generation

Syllable tables:
- Prefixes: ["Ke", "Vor", "Nex", "Aur", "Sol", "Lyr", "Cyg", "Zen", "Kai", "Tyr"]
- Suffixes: ["par", "on", "ix", "us", "is", "ra", "na", "um", "ar", "eth"]
- Modifiers: ["Prime", "Station", "Outpost", "Hub", "Depot", "Nexus"]

Format: `{prefix}-{suffix} {modifier}` or `{prefix}{suffix}`

### 15.3 Encounter Sequence Generation

For each route:
1. Calculate fibonacci-based encounter count from route danger level
2. For each encounter: roll random type weighted by encounter probability (from encounters.json)
3. ECM roll: 40% chance to skip ALL pirate encounters on this route
4. Spacing: distribute encounters evenly along route distance with random ±20% offset

---

## 16. Save Format

Persistent save file: `data/save.json` (human-readable JSON, versioned). Written on: run end (death or success), ship upgrade purchase, ship unlock, starting capital purchase. Read on game start.

```json
{
  "saveVersion": 1,
  "persistentCredits": 0,
  "upgrades": {
    "cargo_bay": 0,
    "engine": 0,
    "fuel_tank": 0,
    "hull_plating": 0,
    "shield_generator": 0,
    "weapon_mount": false,
    "ecm_jammer": false
  },
  "unlockedShips": ["hauler_mk1"],
  "factionRep": {
    "federation": 0,
    "pirates": 0,
    "merchants_guild": 0,
    "scientists": 0,
    "neutral": 0
  },
  "startingCapitalLevel": 0
}
```

**Versioning**: `saveVersion` increments on any breaking schema change. On load, if `saveVersion` < current, a migration function rebuilds the save object (default all zeros for new fields). On write, always write full file — no partial updates.

**Atomic writes**: write to `.tmp` file, then `rename()` to `save.json`. `rename()` is atomic on POSIX — crash during write leaves the old file intact.

**Validation on load**: if JSON parses but fails the expected schema, log a warning and fall back to defaults (not a hard crash — save corruption is not a game-breaking error).

---

## 17. Verification Suite

### 16.1 Compile Check

```bash
mkdir -p build && cd build && cmake .. && make -j$(nproc)
```

### 16.2 Smoke Test

```bash
./build/SpaceHauler --headless --run-smoke-test
# Exits 0 if: window creates, renders 60 frames, game loop runs without crash
```

### 16.3 Integration Test (script)

```bash
./scripts/verify.sh
# Runs: compile check + smoke test + verifies data files are valid JSON
```

---

## 18. Notes on Implementation Order

1. **Foundation first**: GLFW window, OpenGL context, ImGui rendering — get a blank screen with text
2. **Entity system**: base Entity, component system, factory — get a rotating cube
3. **Ship movement**: ZQSD controls, inertia physics, camera follow — get a moving ship
4. **Galaxy map**: 2D node graph, system dots, route lines — get a clickable map
5. **Flight segment**: starfield, corridor, free flight — get a navigable 3D space
6. **Encounters**: asteroid field (dodge) — get one interactive encounter
7. **Economy**: buy/sell at station — get market screen
8. **Meta-progression**: upgrades, ship unlocks — get persistent progression
9. **Polish**: bloom, particles, animations — get visual feedback

Every step must compile and run. No step is "complete" until the game is playable at that level.
