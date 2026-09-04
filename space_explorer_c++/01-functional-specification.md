# Void Drift C++ — Functional Specification (v1.0.0)

Source of truth: this document. All gameplay values are carried over from
the Three.js reference implementation (v2.0.0) unless explicitly changed.
Where this document and the JS implementation disagree, **this document wins**.

---

## 1. Game concept

A single-player, endless-procedural space flight game. The player pilots a
ship through an infinite 3D void, pushing forward along an ascending
"ladder" of 9 content sectors separated by 4 Deep Void corridors, ending at
the SPATIAL GRAVEYARD finale at 35,000 u. The core loop:

    Fly → Discover → Navigate → Destroy (optional) → Push

There is no win state. The game ends when the ship is destroyed. The goal is
to survive as far down the ladder as possible while scoring points from
distance, kills, and biome progression.

---

## 2. Player ship

| Property | Value |
|----------|-------|
| Max health | 100 |
| Health regen | 2% of max HP/s (passive hull repair) |
| Invulnerability window | 0.75 s after taking any damage |
| "Shield" (deflagration) | 1.0 s cooldown, radius 22 u, deflect power 60, no HP drain — it pushes asteroids/debris away |
| Acceleration | 44 u/s² |
| Max speed | 88 u/s |
| Drag | 0.98 per frame (lateral drift decay, 60 fps basis) |
| Roll speed | 3.0 rad/s |
| Throttle | 0–100%, scroll wheel or touch slider |
| Spawn | (0, 2, 0) |

### 2.1 Deflagration (right-click burst)

Right-click fires an electronic deflagration: a radial electric discharge
that shoves asteroids and debris within 22 u away (impulse 60, falls off
with distance). 1 s cooldown. The HUD bar below the health bar tracks the
cooldown. This is NOT a damage-absorbing shield — it is a defensive push.

### 2.2 Damage and death

Damage sources: asteroid/comet/hulk/wreck/city-fragment collisions,
pulsar beam contact, storm bolt strikes, black hole contact (instant
death), dead star contact (instant death), pulsar body contact (instant
death), black hole collapse.

On death: DeathScreen shows cause-specific title, final score, distance,
high score, and "PRESS R TO RESTART".

---

## 3. Controls

AZERTY-first (physical key position binding via GLFW `key` code, never
label):

| Input | Action |
|-------|--------|
| Z / S (GLFW_KEY_W / GLFW_KEY_S) | Pitch up / down |
| Q / D (GLFW_KEY_A / GLFW_KEY_D) | Strafe left / right |
| A / E (GLFW_KEY_S / GLFW_KEY_E) | Roll |
| Mouse look | Aim (pointer lock) |
| Scroll wheel | Throttle 0–100% |
| Space (keydown/up) | Fire |
| Right-click (mousedown 2 / up) | Shield on / off |
| Esc | Pause / unlock pointer |
| M | Mute |
| L | Light profile: auto / eco |
| C | Ladder chart overlay |
| R | Restart (on death screen) |

Touch controls (shown when `pointer: coarse`): shield button, throttle
slider. No touch fire button (pointer lock unavailable on touch).

### 3.1 Pause

Esc toggles pause. While paused the game loop stops accumulating time, the
HUD pause overlay shows, and pointer lock is released. Pressing Esc again
resumes.

---

## 4. World / ladder

### 4.1 Ladder structure

Fixed, strictly ascending sequence. 9 content rungs + 4 Deep Void intervals
+ finale. Total distance covered: 0 → 35,000 u (endless after).

| # | Key | Range (u) | Score mult |
|---|-----|-----------|------------|
| 1 | OPEN_SPACE | 0 – 1,000 | 1.0× |
| 2 | ASTEROID_BELT | 1,000 – 3,000 | 1.0× |
| 3 | NEBULA_CORRIDOR | 3,000 – 5,000 | 1.2× |
| 4 | WORMHOLE | 5,000 – 7,000 | 1.5× |
| 5 | DEEP_VOID | 7,000 – 8,000 | 1.5× |
| 6 | CRYSTAL_FIELDS | 8,000 – 11,000 | 2.0× |
| 7 | DEEP_VOID | 11,000 – 12,500 | 2.0× |
| 8 | PULSAR_REGION | 12,500 – 16,000 | 2.5× |
| 9 | DEEP_VOID | 16,000 – 18,000 | 2.5× |
| 10 | PLASMA_STORM | 18,000 – 22,000 | 3.0× |
| 11 | DEEP_VOID | 22,000 – 25,000 | 3.0× |
| 12 | DERELICT_GRAVEYARD | 25,000 – 29,000 | 3.5× |
| 13 | DEEP_VOID (Final Approach) | 29,000 – 35,000 | 3.5× |
| 14 | SPATIAL_GRAVEYARD | 35,000 → ∞ | 4.0× |

Deep Void base config: asteroid 2, nebula 0, comet 2, blackHole 0,
deadStar 0, station 1, color [0.05, 0.08, 0.15]. Deep Void scoreMult
is set to the previous content rung's multiplier (not dynamically
computed).

### 4.2 Score

Score accumulates from:
- Distance: 1 point per 10 u of forward progress (SCORE_DISTANCE_DIVISOR
  10), multiplied by the current rung's scoreMult.
- Kills: asteroid (base 10, scaled by tier), debris (1), comet 100,
  hulk 150, finale wreck 200, crystal 40 (per octahedron in cluster).
- No biome change bonus (not implemented).

Score is stored in `GameState.score`, emitted as `SCORE_CHANGED`, and
persisted to the high-score file only on death.

---

## 5. Entities

### 5.1 Asteroids (all rungs)

3 tiers, instanced.

| Tier | HP | Score | Radius range |
|------|----|-------|--------------|
| Large | 100 | 100 | 8–12 u |
| Medium | 50 | 50 | 4–7 u |
| Small | 25 | 25 | 2–3.5 u |

Collision damage to player: 25 (large), 15 (medium), 10 (small).
Destroyed asteroids spawn an explosion burst + shards.

### 5.2 Comets (all rungs)

150 HP, score 100, collision 25. Tail rendered with particle stream.
Comets fly on fixed trajectories through chunks.

### 5.3 Black holes (NEBULA_CORRIDOR, WORMHOLE, PLASMA_STORM, DERELICT_GRAVEYARD, SPATIAL_GRAVEYARD)

Contact = instant death. Radius 10–22 u per hole.
Gravity: base 7500 × (radius/10)² → 7500–36300, per-hole gravity radius
450 × (0.6 + radius/30) → 420–600 u. Max pull 160 u/s².
Ship pull factor 1.15 (ship feels FULL pull +15%, NOT escapable by
reducing pull).
Black holes attract each other within 480 u (strength 60000, cap 100).
Merge when d < (rA+rB)×1.2.
Collapse: ship within 80 u takes 50 damage.
Visual: accretion disk shader (Doppler-beamed ring).

### 5.4 Dead stars (NEBULA_CORRIDOR, WORMHOLE, DEEP_VOID)

Collision = instant death. Rendered as dim ember sprites with flicker.

### 5.5 Nebulae (NEBULA_CORRIDOR)

Billboarded fbm shader planes. No collision. Purely visual.

### 5.6 Space stations (DEEP_VOID, several rungs)

Decorative only. Collision damage 20. No score.

### 5.7 Debris (WORMHOLE, DEEP_VOID)

Small instanced rock fragments. Low HP (10), score 5. Collision 5.

### 5.8 Crystal shards (CRYSTAL_FIELDS)

Clusters of 4–8 octahedra. Each octahedron: HP 25, score 40.
On destruction each crystal splits into 2 child beams at ±18° from the
beam axis (max 12 concurrent child beams).
Collision 10.

### 5.9 Pulsars (PULSAR_REGION)

Radius 22–30 u. Two counter-rotating beam cones, 500 u long, half-angle
0.06 rad. Beam touch radius 9 u.
Beam touch: 50 damage. Body contact: instant death.
`minSpacing` 800 u between pulsars, `minDistFromShip` 400 u.
Pulse rate 1.5 Hz.

### 5.10 Storm clouds (PLASMA_STORM)

3-plane cloud clusters, radius 20–40 u.
Pairs within 120 u (`boltDistanceMax`) form strike pairs.
State machine: waiting → telegraph (0.4 s) → bolt (0.15 s) → waiting.
Bolt: 6-segment jagged polyline. Re-strike interval 1.2–2.8 s.
Strike damage: 45, strike radius 28 u.
Flicker: 6 Hz.
HUD static overlay: active within 350 u, intense within 150 u
(opacity 0.04 / 0.08, 20 Hz flicker).

### 5.11 Ship hulks (DERELICT_GRAVEYARD)

Procedural wreck (3 hull variants). HP 100, score 150, collision 30.
Drift + tumble. Emergency strobe light (1.5 Hz flicker).
`minSpacing` guard between spawns.

### 5.12 City fragments (SPATIAL_GRAVEYARD finale)

Indestructible (hp 0). Base scale 260 u, radius 70 u (collision).
3 variants (ring segment, station superstructure, tower cluster).
Window texture (90 windows) flickers at 0.8 Hz with random dropout
(every 2 s, duration 0.2 s).
Collision 25. `cityChance` 0.75/chunk (max 1/chunk).
`minDistShip` 600 u, `minSpacing` 500 u.
Landmark glow sprite (opacity 0.08, scale 4×).

### 5.13 Blinking wrecks (SPATIAL_GRAVEYARD finale)

HP 100, score 200, collision 25. Scale 0.5–0.9.
Staggered red/white strobes (phase offset π), 3 Hz.
`wreckDensity` 5/chunk (ladder cfg: 4 in SPATIAL_GRAVEYARD).

---

## 6. Weapons

### 6.1 Continuous quad beams

- Fire: Space keydown (hold to fire). 4 muzzles (2 cockpit cannons +
  1 per wingtip) fire sustained beams simultaneously.
- Pool: 96 beams total (4 muzzles × sustained beams + 12 child beams).
- Beam: instanced cylinder, length 9 u, core radius 0.18 u, glow radius
  0.5 u, hit radius 1.8 u. Color 0x33ff66 (green).
- Damage: 25 per hit. Projectile speed 200 u/s, lifetime 1.5 s, range 200 u.
- On hit: laser spark burst + green impact glow light (0.15 s).
- On destroy: explosion burst + shards + shockwave ring.
- Child beam splitting: crystal interaction, ±18° (0.3142 rad), max 12.

### 6.2 No secondary weapon

Single laser only. No missiles, no bombs.

---

## 7. Biome / world generation

### 7.1 Chunk system

- Chunk size: 200 u.
- Grid: 3×3×3 horizontal (cx, cz) × 3 vertical (cy) = up to 27 active
  chunks at `CHUNKS_RADIUS` 1.
- Cleanup radius: 1.6× spawn radius.
- Staggered streaming: `CHUNKS_SPAWN_PER_FRAME` 3 chunks spawned per frame
  to prevent boundary hitches.
- Instance cull radius: 460 u (beyond this, instanced meshes are culled).
- Seeded RNG: mulberry32 with hash3(cx, cy, cz) — deterministic per chunk
  position.

### 7.2 Density reduction

`DENSITY_REDUCTION` 0.55: entity counts scale with
`(1 - distance/100000) * DENSITY_REDUCTION + 0.45` to keep late-game
chunks lighter.

### 7.3 Per-chunk entity spawning

Each system's `spawnChunk(chunk, rng, cfg, shipPos)` is called when a chunk
enters the active set. `cfg` is the current ladder rung config.
`shipPos` is passed so spawn guards can avoid placing entities within
`minDistFromShip` of the player.

---

## 8. Visual systems

### 8.1 Starfield

3 point-cloud layers (far 5000, mid 2000, near 500) + 30 bright stars.
Parallax: each layer moves at `(1 - parallaxSpeed)` × ship position.
Far parallaxSpeed 0.1, mid 0.3, near 0.8.
Wrap: 1200 u box around ship.
Color temperature: 30% blue-white, 40% white, 20% warm, 10% red giants.
Shooting stars: every 30 s, max 2 active, 0.45 s life, speed 1600 u/s.
All star materials: `fog: false`.

### 8.2 Fog

Exponential fog, color 0x000011, density 0.008.

### 8.3 Post-processing pipeline

    RenderPass → Bloom → ChromaticAberration → Vignette → FilmGrain → WormholeBlur

| Pass | Params |
|------|--------|
| Bloom | strength 1.5, radius 0.4, threshold 0.15 (per-rung override) |
| Chromatic aberration | max 0.003, driven by speed fraction + storm CA |
| Vignette | darkness 0.5, offset 0.2 |
| Film grain | intensity 0.03, time-driven |
| Wormhole blur | 8-tap blur + swirl + chromatic fringe, intensity from wormhole |

Low-end hardware (hardwareConcurrency < 4): CA + grain disabled at startup.
AQ2: CA + grain disabled dynamically.

### 8.4 Lighting

Directional light (ambient 0.3) + hemisphere light.
Dynamic lights managed by `LightManager` (see §9.3).

### 8.5 Particles

5 named pools (exhaust 200, laserSpark 50, explosion 80, ember 100,
sparkle 256) + 4 mesh pools (shockwave rings 4, debris shards 12, speed
lines, impact glow lights 4).
Zero allocations in update loop. Per-particle size/color/alpha via
shader attributes.

---

## 9. Systems

### 9.1 Physics (PhysicsSystem)

- Ship vs collider: sphere-sphere (ship radius 2 u).
- Laser vs collider: ray-sphere intersection.
- Storm bolt vs ship: segment-sphere distance.
- Black hole gravity: applied to ship velocity before integration.
- Collision response: damage + knockback impulse.

### 9.2 Adaptive quality (AdaptiveQuality)

Rolling 1-second FPS average (time-based, not frame-count-based).

| Level | Trigger | Effect |
|-------|---------|--------|
| 0 | — | Full quality |
| 1 | FPS < 45 for 2 s | Resolution × 0.85 |
| 2 | FPS < 30 for 2 s | Resolution × 0.7, CA+grain off, eco lights |

Recovery: FPS > 55 for 3 s → step down one level.
Level reported to HUD as `AQ1` / `AQ2`.

### 9.3 Light manager (LightManager)

Lights register by name convention:
- `ship:<id>` → always on (ship lights).
- `sig:<key>` → signature lights, priority by key.
- `land:<key>` → landmark lights.

Every 6 frames the manager scans the scene, sorts by (priority, distance
to camera), and toggles visibility to stay under the cap.

| Profile | Cap | Sig budget | Land budget |
|---------|-----|------------|-------------|
| auto | 16 | 4 | 4 |
| eco | 6 | 0 | 0 |

Priority order (lower number = higher priority):
pulsarSweep(1) > stormFlicker(2) > crystalCluster(3) > wreckStrobe(4) >
cityWindow(5) > hulkEmergency(6).

Light profile is user-toggleable via `L` key (auto/eco), persisted to the
config file.

### 9.4 Audio (AudioSystem)

OpenAL + libsndfile. Discrete sound playback — no music, no spatial audio.
- Engine rumble: 60 Hz sawtooth loop (generated WAV at build time), gain
  scales with thrust (0.04–0.16).
- Deflagration: metallic ping (square 1200→300 Hz + highpass noise).
- One-shots: laser, explosion, collision, biome change, consumption, comet,
  shield ping, black hole collapse boom.
- Warning beep: 800 Hz × 3 pulses, repeats every 2 s while health < 30.
- Mute: `M` key, persisted to config file.

All audio files are short WAV clips (44.1 kHz mono), generated at build
time or loaded from `assets/audio/`.

### 9.5 HUD

Dear ImGui overlay. Elements:
- Score (top-left), distance (top-center), biome name (top-right).
- Rung label + progress bar (top-left, below score).
- Announce banner (center, fades after 5 s).
- Health bar (bottom-center, green/yellow/red by %).
- Shield bar (above health bar).
- Thrust bar (bottom-left).
- Warnings: EVENT HORIZON, STELLAR REMNANT, PULSAR BEAM (bottom-center).
- Flash overlay (red, 120 ms on damage).
- Low HP vignette (radial red gradient, opacity when < 30%).
- Storm static overlay (flicker animation, distance-driven).
- Controls hint (bottom-right, always visible).
- Pause overlay (Esc).
- Mute icon (top-right).
- AQ indicator (bottom-right).

### 9.6 Ladder chart (LadderChart)

`C` key toggles an ImGui panel (right side, 300 px wide) listing all 14
ladder entries with name, range, and progress bar. Current entry
highlighted.

### 9.7 Crosshair

Center reticle: thin circle + 4 dots. Rendered via ImGui draw list.

### 9.8 Death screen

Full-screen ImGui overlay. Cause-specific title (6 variants). Score,
distance, high score, "PRESS R TO RESTART".

---

## 10. Persistence

| Key | Value |
|-----|-------|
| `void_drift_highscore` | Number, max score achieved |
| `void_drift_muted` | Boolean |
| `void_drift_light_profile` | 'auto' \| 'eco' |

Persisted to a JSON config file in the user's home directory
(`~/.void_drift/config.json`). No other persistence. No save system.

---

## 11. Game states

| State | Trigger |
|-------|---------|
| running | Default; game loop active |
| paused | Esc pressed |
| dead | Ship destroyed; DeathScreen shown |
| restarting | R pressed on death screen; full state reset |

Transition: dead → restarting → running (new run, same high score).

---

## 12. Event bus contract

All inter-system communication via `EventBus` (singleton).
Events are string names with optional payload struct. Key events:

| Event | Payload | Emitted by |
|-------|---------|------------|
| `SCORE_CHANGED` | { score } | ScoreSystem |
| `BIOME_CHANGED` | { to, from } | BiomeGenerator |
| `PLAYER_HEALTH_CHANGED` | { health, maxHealth } | PlayerShip |
| `PLAYER_HEALTH_REGEN` | { health, maxHealth } | PlayerShip |
| `PLAYER_DIED` | { reason } | PlayerShip / PhysicsSystem |
| `PLAYER_KILLED_ENTITY` | { type, score } | WeaponSystem / PhysicsSystem |
| `LADDER_RUNG_CHANGED` | { rung, index, isFinale } | BiomeGenerator |
| `LADDER_FINALE_REACHED` | { } | BiomeGenerator |
| `ENVIRONMENT_CRYSTAL_DESTROYED` | { position } | CrystalSystem |
| `ENVIRONMENT_PULSAR_SPAWNED` | { position } | PulsarSystem |
| `ENVIRONMENT_STORM_STRIKE` | { position, damage } | StormSystem |
| `ENVIRONMENT_HULK_DESTROYED` | { position, score } | HulkSystem |
| `ENVIRONMENT_CITY_FRAGMENT_SPAWNED` | { position, scale } | CitySystem |
| `ENVIRONMENT_WRECK_DESTROYED` | { position, score } | CitySystem |
| `ENVIRONMENT_BLACK_HOLE_COLLAPSE` | { position } | BlackHoleSystem |
| `STORM_STATIC_CHANGED` | { active, intensity } | StormSystem |
| `AUDIO_MUTED` | { muted } | AudioSystem / InputSystem |
| `INPUT_SHIELD` | { active } | InputSystem / HUD touch button |
| `INPUT_THROTTLE_SET` | { value } | InputSystem / HUD slider |
| `GAME_PAUSED` | { paused } | InputSystem |
