# Procedural Metroidvania — 2D-in-3D (Three.js + Vite)

## Concept

A sidescrolling metroidvania where every playthrough generates a unique interconnected world. The player explores procedurally-connected rooms, gains abilities (double jump, dash, wall jump, etc.), and uses them to reach new areas. Rendered in 3D space using Three.js — think Paper Mario / Trine / Little Big Planet aesthetic: flat gameplay on a 2D plane, but with real 3D depth layers, parallax, volumetric lighting, and particle effects in the background.

The world is a grid of rooms (22×16 tiles, 1 unit = 1 tile). Rooms connect via left/right doors, vertical shafts, and hidden passages. Abilities unlock new path types (double jump reaches high ledges, dash crosses gaps, missiles break cracked walls, grapple hooks across chasms).

## Visual Style

- **GameCube era pixel-retro** — low-poly geometry with flat/vertex coloring and toon-shaded look.
- **2D gameplay plane** — player, enemies, and platforms exist on z=0. Background/foreground layers at z=-0.5 (platforms), z=1.5 (foreground detail), z=-3/-6/-10/-16 (parallax background).
- **Parallax background layers** — 4 distant layers at increasing z-depths, each darker. Speeds [0.1, 0.25, 0.45, 0.7] relative to camera. Use MeshBasicMaterial with vertex colors for painterly retro look.
- **Pixel-perfect bloom** — threshold 0.6, strength 0.35, radius 0.4. Nostalgic glow, not modern realism.
- **Dynamic lighting** — player emits point light (intensity 0.6, range 4, color #88ccff). Room elements (save points, ability pickups, glowing mushrooms) emit ambient light. Dark rooms exist where only player light reveals terrain.
- **Enemies** — low-poly geometry with fresnel rim shaders (dark center, colored edge glow). Pop against dark caves.
- **Player** — low-poly humanoid with named mesh children: `_torso`, `_head`, `_upperArm_L/R`, `_lowerArm_L/R`, `_upperLeg_L/R`, `_lowerLeg_L/R`, `_weapon`, `_backpack`, `_visor`. Idle bob, run cycle, double-jump spin, dash stretch, wall slide tilt.

## Tech Stack

- Vite + Three.js (ES modules, `src/` directory)
- PostProcessing via three/addons (EffectComposer, UnrealBloomPass, RenderPass, OutputPass)
- No physics engine — custom 2D AABB collision with gravity, acceleration, friction
- All constants in `Constants.js` — zero magic numbers in game logic
- EventBus.js + GameState.js pattern (from game-architecture skill)
- Logger: built-in `LOG(domain, ...args)` / `LOG_ERR(domain, ...args)` helpers with debug level filtering

## Controls

All input uses **event.code**:

| Action | AZERTY | QWERTY equivalent | Notes |
|--------|--------|-------------------|-------|
| Move left | Q | A | |
| Move right | D | D | |
| Jump | Z | W | |
| Jump (alt) | Space | Space | |
| Dash | Left Shift | Left Shift | |
| Attack | F | F | Melee swing in facing direction |
| Map | M | M | Toggle full map overlay |
| Pause | Escape | Escape | |
| Restart (on death) | R | R | |

## Player Physics & Movement

| Parameter | Value | Notes |
|-----------|-------|-------|
| Collision box | 0.7 × 1.2 units | Width × height |
| Walk acceleration | 50 units/s² | |
| Max walk speed | 8 units/s | |
| Friction | 12 units/s² | |
| Gravity | 45 units/s² | |
| Max fall speed | 30 units/s | |
| Jump velocity | 13 units/s | |
| Jump hold gravity | 15 units/s² | Reduced gravity while holding jump |
| Jump cut multiplier | 0.45× | Velocity multiplier on early release |
| Double jump velocity | 11 units/s | Slightly weaker |
| Dash speed | 18 units/s | |
| Dash duration | 0.15s | |
| Dash cooldown | 0.8s | |
| Wall slide max speed | 6 units/s | |
| Wall jump horizontal | 8 units/s | Push away from wall |
| Wall jump vertical | 12 units/s | |
| Coyote time | 4 frames (~66ms) | Grace period after leaving ledge |
| Jump buffer | 6 frames (~100ms) | Pre-land input window |
| HP | 5 | |
| Attack range | 1.0 units | Melee arc in facing direction |
| Attack width | 0.6 units | Arc width |
| Attack damage | 1 | |
| Attack cooldown | 0.35s | |
| Hit invincibility | 1.2s | After taking damage |
| Knockback force | 6 units/s | |
| Knockback duration | 0.2s | |

State machine: `idle` → `running` → `jumping` → `doubleJumping` → `dashing` → `wallSliding` → `hurt`. Double jump resets on ground contact.

## Rooms

### Room specs

| Parameter | Value |
|-----------|-------|
| Width | 22 tiles |
| Height | 16 tiles |
| Tile size | 1 unit = 1 tile |
| World coordinates | x∈[room.worldX - 11, room.worldX + 11], y∈[room.worldY - 8, room.worldY + 8] |
| Transition duration | 0.3s |
| Room origin | Rooms are offset by multiples of room width (22 × roomIndex) |

### Platform types

```javascript
{ x, y, w, h, kind: 'floor'|'platform'|'wall'|'door' }
```
- **Floor**: solid, player + enemies stand on top
- **Platform**: solid, player can stand on top or pass through from below
- **Wall**: left/right room boundary, blocks all movement
- **Door**: marks room-to-room connection point, triggers transition

### MVP room layout (3 hand-built rooms)

**Spawn Room** ("Awakening Chamber", worldX=0):
- Floor spanning room width at y=-7, height 2
- Left platform at y=-3 (reachable without abilities)
- High ledge at y=-0.5 on right side (requires double jump)
- Left/right wall boundaries

**Ability Room** ("Crystal Vault", worldX=22):
- Double jump pickup at mid-height center
- Split-level platforms requiring jumping
- Patrolling drone enemies

**Boss Room** ("Guardian's Sanctum", worldX=44):
- Wide open arena, raised boss platform at center-right
- Boss spawn at center-right, elevated
- No other enemies

## Enemies

### Drone (MVP)

| Parameter | Value |
|-----------|-------|
| HP | 2 |
| Speed | 2.5 units/s |
| Damage | 1 |
| Scale | 0.5 |
| Patrol pause | 1.5s |
| Detection range | 6 units |

Behavior: patrols left-right between platform edges, pauses at endpoints, turns to face player when detected.

### Boss (MVP)

| Parameter | Value |
|-----------|-------|
| HP | 8 |
| Scale | 1.4 |
| Speed | 3.5 units/s |
| Damage | 1 |
| Charge speed | 10 units/s |
| Charge telegraph | 0.4s |
| Charge cooldown | 1.8s |
| Jump telegraph | 0.3s |
| Jump cooldown | 2.2s |
| Phase 2 threshold | 50% HP |
| Phase 2 speed multiplier | 1.4× |

**Phase 1**: slow drift toward player → telegraph flash → horizontal charge → recover.
**Phase 2** (≤50% HP): same pattern but 1.4× faster. Visual: color shifts to magenta (#ff00ff), spike rings animate faster.

## Camera

| Parameter | Value |
|-----------|-------|
| Deadzone X | 1.5 units |
| Deadzone Y | 1.0 units |
| Lerp speed | 8 |
| Base zoom | 16 units |
| Near plane | 0.1 |
| Far plane | 200 |
| Fog near | 10 |
| Fog far | 60 |
| Fog color | #0d1025 |

Camera follows player within deadzone, smooth lerp. On map toggle (M key), zoom out to show full world.

## Visual & Post-Processing

| Parameter | Value |
|-----------|-------|
| Bloom threshold | 0.6 |
| Bloom strength | 0.35 |
| Bloom radius | 0.4 |
| Parallax layers | 4 |
| Parallax speeds | [0.1, 0.25, 0.45, 0.7] |
| Player glow intensity | 0.6 |
| Player glow range | 4 |
| Player glow color | #88ccff |
| Ambient intensity | 0.25 |
| Ambient color | #223344 |
| Hit flash duration | 0.2s |
| Death dissolve time | 0.35s |

## Colors

| Element | Color |
|---------|-------|
| Player | #4488ff |
| Player emissive | #2266cc |
| Enemy | #ff5555 |
| Enemy rim | #ff8888 |
| Boss | #ff2222 |
| Boss rim | #ff6644 |
| Boss phase 2 | #ff00ff |
| Platform | #334466 |
| Wall | #1a2a3a |
| Door | #2266aa |
| Locked door | #663333 |
| Ability pickup | #ffcc00 |
| Ability glow | #ffaa00 |
| Health pickup | #44ff44 |
| Background layer 0 | #0d0d1a |
| Background layer 1 | #111122 |
| Background layer 2 | #151528 |
| Background layer 3 | #1a1a2e |
| HUD health full | #ff4444 |
| HUD health empty | #331111 |
| HUD text | #ccddee |
| Minimap background | rgba(0,0,0,0.6) |
| Minimap room | rgba(60,100,160,0.5) |
| Minimap current | rgba(100,160,255,0.8) |

## Architecture

```
src/
  core/
    Game.js              — orchestrator, RAF loop, state machine (title/spawn/explore/death/victory)
    EventBus.js          — singleton pub/sub
    GameState.js         — singleton: player state, abilities, discovered rooms, run stats
    Constants.js         — ALL config: physics, rooms, enemies, camera, visuals, keys, colors, layers
  systems/
    Input.js             — event.code key state map, input polling per frame
    Camera.js            — 2D follow with deadzone, smooth lerp, map zoom, room clamping
    RoomManager.js       — loads/unloads room geometry, manages transitions, collision data query
    EnemyManager.js      — spawns enemies per room, AI (patrol + detect), death handling
    AbilityManager.js    — unlocked abilities, movement modifiers, pickup spawning
    MapSystem.js         — minimap DOM canvas + full-screen map overlay (M key)
  entities/
    Player.js            — movement physics, state machine, combat, damage, death
    Enemy.js             — drone patrol AI with configurable behavior
    Boss.js              — 2-phase boss AI: charge + jump, phase transition, death dissolve
    AbilityPickup.js     — floating collectible with glow + bob animation
  visuals/
    ModelFactory.js      — procedural geometry: player (humanoid), enemies, boss, pickups
    BackgroundLayers.js  — 4 parallax layers at varying z-depths
    VisualFX.js          — particles, screen shake, hit flash, death dissolve, damage numbers
    Shaders.js           — custom GLSL: fresnel rim, ability glow pulse
  ui/
    HUD.js               — DOM overlay: health bar, ability icons, minimap, boss HP bar
    MapOverlay.js        — DOM overlay: full map, room shapes, connections, unexplored exits
```

## Game Flow

```
Boot → Title screen ("PROCEDURAL METROIDVANIA")
     → Press Space or click → Spawn room
     → Explore: move left/right, jump, discover doors
     → Room transition (0.3s slide in travel direction)
     → Find ability room → "NEW ABILITY!" popup → double jump unlocked
     → Revisit spawn room → reach high ledge → access boss room
     → Boss fight → defeat → VICTORY screen
     → DEATH: death dissolve → game over screen → press R → fresh restart
```

### Room transitions
- Cross room edge at door → instant load adjacent room + 0.3s slide transition
- Player position resets cleanly (x wraps, y preserved)
- Enemies in inactive rooms are paused, reactivate on room entry
- Camera snaps to new room bounds

## Scope-Limited MVP

1. **3 rooms** hand-built: spawn → ability (double jump) → boss
2. **1 enemy type**: patrolling drone
3. **1 ability**: double jump
4. **1 boss**: 2-phase fight (charge attack, phase 2 at 50%)
5. **Visual**: 4 parallax layers, bloom, player glow, enemy rim shader, hit flash, death dissolve
6. **HUD**: health bar (♥), double jump indicator, minimap, boss HP bar
7. **Restart**: R key on death → clean restart with full state reset
8. **Map**: minimap only (M key for full map deferred)
9. **No save/load** — every run is fresh

## Visual Polish Checklist

- [ ] Enemy fresnel rim shader (dark center, colored edge glow, hit flash on damage)
- [ ] Player hit flash (white overlay on damage, decays over 200ms)
- [ ] Death dissolve (scale→0 + fade over 0.35s)
- [ ] Spawn effect (expanding additive ring + player ease-in from scale 0.01)
- [ ] Ability pickup glow (rotating mesh with pulsating emissive)
- [ ] Screen shake on hit (position jitter via countdown timer)
- [ ] Damage numbers (floating DOM text that rises and fades)
- [ ] Parallax background layers (4 depths, speed multipliers [0.1, 0.25, 0.45, 0.7])
- [ ] Ambient particles (dust motes in foreground)
- [ ] Bloom post-processing (threshold 0.6, strength 0.35, radius 0.4)
- [ ] Room transition (slide 0.3s in travel direction)
- [ ] Player dash trail (brief ghost afterimage at previous position)
- [ ] Boss animations: spike ring rotation, core bob, eye glow pulse, telegraph flash
- [ ] Boss phase 2 visual: color shift to magenta, faster ring spin

## Debug Features

- God mode toggle for testing: `DEBUG.GOD_MODE` in Constants
- Collision visualization: `DEBUG.SHOW_COLLISION` in Constants
- FPS counter: `DEBUG.SHOW_FPS` in Constants
- Log level control: `DEBUG.LOG_LEVEL` (0=none, 1=errors, 2=info, 3=verbose)

## Pitfalls to Avoid

- **Physics spiral of death** — clamp delta time to `DT_MAX = 0.05s` to prevent tunneling through thin platforms at low FPS.
- **Double jump state reset** — `jumpsRemaining` resets to `maxJumps` only on ground contact (`onGround === true`). Wall jumps consume one jump without resetting.
- **Wall jump direction** — push away from wall horizontally (`±8`) + vertical boost (`12`). Applied as velocity override, not additive.
- **Room transition position** — player x wraps from room right edge to next room left edge (seamless horizontal traversal). Y preserved.
- **Restart cleanup** — all event listeners, meshes, timers, and state reset. Test 3× restart with no console errors.
- **AZERTY** — event.code throughout: Q=left, D=right, Z=jump, Space=jumpAlt, Shift=dash, F=attack, M=map, R=restart, Escape=pause.
- **Scope discipline** — MVP is 3 hand-built rooms. Do NOT build procedural generation in first pass. Hand-place rooms in JSON, then proceduralize.