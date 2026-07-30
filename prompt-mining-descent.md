# Mining Descent Roguelite — Procedural Planet Dig (Three.js + Vite)

## Concept

You pilot a drilling vehicle into a procedurally-generated planet. Each run: descend through layered underground biomes, mine rare minerals, manage fuel/oxygen/hull integrity, fight cave creatures. Die in the depths → surface base → spend minerals on permanent vehicle upgrades.

Think SteamWorld Dig meets Deep Rock Galactic, rendered in low-poly 3D with a tight vertical scope. The procedural generation is the star — terrain layers, ore veins, cave networks, and creature spawns are all algorithmically placed for a fresh descent every run.

The entire gameplay is **vertical** — you dig down, find treasures, and desperately try to get back up before your resources run out.

## Visual Style

- **Low-poly pixel-retro 3D** — flat-shaded terrain layers with vertex-colored gradients.
- **Angled top-down camera** — 47° angle (PI/3.8), distance 30 units, height 24 units, smooth lerp factor 4. Mouse drag orbits horizontally, A/E keys orbit, ZQSD pans camera, mouse wheel zooms (10–60 range).
- **Cutaway rendering** — terrain is half-sectioned: tiles in the camera-direction quadrant are hidden (moved to transparent InstancedMesh with depthWrite=false) so the player can always see their vehicle and nearby enemies/ores.
- **Layered biomes** — distinct color bands with depth thresholds:
  - Topsoil (y=0): brown/green, roots, small stones
  - Rock layer (y=1-25): gray-blue, compact stone, coal veins
  - Crystal caverns (y=25-40): cyan/purple, glowing crystal formations, open voids
  - Magma core (y=40-45): red/orange, lava pools, heat damage
  - Alien remains (y=45-49): organic purple/green, bioluminescent
- **Vehicle headlights** — cone spotlight from vehicle (range 15, angle 30°, intensity 1.2, color #ffffcc). Extends visible range beyond standard fog.
- **Drill effect** — dust burst particles on dig (8 particles, 0.6s lifetime, 0.3 spread, additively blended).
- **Ore glow** — pulsing emissive on ore tiles (speed 2.5 rad/s, intensity 0.15–0.55).
- **Bloom** — threshold 0.5, strength 1.0 on glowing ores and headlights. Keeps it moody without washing out.
- **Fog** — near 8 tiles, far 18 tiles. Color shifts from sky blue at surface to deep dark at depth.

## Tech Stack

- Vite + Three.js (ES modules, `src/` directory)
- No physics engine — simple grid-based movement (tile-by-tile lerp)
- Terrain: dual InstancedMesh per layer (opaque + transparent cutaway), instances moved between meshes on camera rotation
- PostProcessing: bloom (threshold 0.5, strength 1.0)
- EventBus.js, GameState.js pattern (from game-architecture skill)
- Logger.js for structured debug logging
- localStorage for meta-progression (with validation + parse-failure fallback)

## Controls

All input uses **event.code**:

| Action | Key | Notes |
|--------|-----|-------|
| Move vehicle | Arrow keys | Camera-relative: up=away from cam, down=toward cam |
| Dig | ArrowDown against solid tile | Consumes 1 fuel, 0.3s duration |
| Climb | ArrowUp against wall (tile above is air) | Consumes O2 at climbing rate, 0.5s duration |
| Pause | Escape | Toggle pause overlay |
| Orbit camera left | A key | Rotates view CCW |
| Orbit camera right | E key | Rotates view CW |
| Pan camera | ZQSD | Z=forward, Q=left, S=back, D=right (AZERTY) |
| Zoom camera | Mouse wheel | Range 10–60 |
| Orbit camera (mouse) | Mouse drag (left button) | Horizontal orbit |

Vehicle sits **on top** of tiles (worldY = -tileY). Movement is grid-based with 8 tiles/s lerp speed.

## World & Terrain

### Dimensions
- World: 40 wide × 40 deep × 50 tall tiles (W×D×H)
- Surface at y=0, deepest at y=49
- Cave entrance at grid center (20, 0, 20)
- Tile size: 1 unit (each tile is a 1×1×1 box)
- Surface layer: all tiles at y=0 are solid SURFACE

### Tile types
```
AIR = 0       — empty space (dug out or never filled)
SURFACE = 1   — grass/green, indestructible
ROCK = 2      — diggable stone (gray-blue)
COAL_ORE = 3  — dark brown, coal vein
COPPER_ORE = 4 — warm orange, copper vein
```
Future: CRYSTAL_ORE, GOLD_ORE, LAVA, ALIEN_ORE.

### Generation algorithm
1. Fill all tiles at y=0 with SURFACE (indestructible, blocks digging upward)
2. Fill y=1 through y=WORLD_MAX_Y with ROCK
3. Carve entrance shaft: clear 3×3 column at cave entrance from y=0 to y=3
4. Place ore veins: for each ore type, pick a random seed tile within depth range, then grow via 4-directional flood fill (Poisson-like spreading, each neighbor has 70% chance to become ore). Repeat for veinCount iterations per ore type.
5. Cave pockets: for each ore type's depth range, carve a few large open chambers (3-5 tiles radius) using cellular automata smoothing

### Digging
- Moving onto a ROCK or ORE tile triggers dig action
- Dig costs 1 fuel per tile, takes 0.3s
- Dug tile becomes AIR (open space)
- Surface tiles (y=0) cannot be dug (prevents digging upward out of the world)
- Digging sideways (horizontal) creates tunnels
- Digging downward: you fall into the new space

### Falling
- If vehicle is on an AIR tile (below was just dug, or walked into a void), it falls
- Fall damage: 5 hull per tile fallen beyond 2 tiles
- Falls are instant (no animation during fall, just reposition)

### Climbing
- ArrowUp against a wall tile (adjacent has ROCK/ORE/SURFACE, tile above you is AIR)
- Consumes O2 at 2.0/sec during climb
- Takes 0.5s to climb up one tile
- Vehicle tilts visually during climb

## Resources

| Resource | Start | Drain | Dig cost | Replenish |
|----------|-------|-------|----------|-----------|
| Fuel | 50 | 0 (only on dig) | 1/tile | Coal burning (post-MVP), fuel caches (post-MVP) |
| Oxygen | 120s worth | 0.5/s idle, 1.0/s moving, 2.0/s climbing | — | O2 tanks (post-MVP) |
| Hull | 100 | Enemy hits, falls (>2 tiles) | — | Repair kits (post-MVP), surface repair (post-MVP) |

Run ends instantly when any resource reaches 0:
- Fuel=0 → "ENGINE STALLED — STRANDED"
- Oxygen=0 → "OXYGEN DEPLETED — SUFFOCATED"  
- Hull=0 → "HULL BREACH — DESTROYED"

## Ores & Cargo

| Ore | Depth | Color | Per-unit value | Vein size | Vein count | Glow |
|-----|-------|-------|----------------|-----------|------------|------|
| Coal | y=1-25 | 0x3a2a1a | 5 (MVP) | 4-8 | 12 | 0x8b6914 |
| Copper | y=20-49 | 0xd4842a | 5 (MVP) | 3-7 | 10 | 0xd4842a |

MVP simplifies: both ores worth 5 currency. Full game uses differentiated values (coal=1, copper=5, silver=15, gold=30, crystal=20, alien=100).

- Cargo hold: max 20 units base
- Ore conversion to currency: 1:1 in MVP (full game uses per-ore values)
- Inventory tracked as `{ oreType: count }` per type

## Enemies

| Creature | Biomes | Shape | HP | Damage | Speed | Aggro range | Special |
|----------|--------|-------|----|--------|-------|-------------|---------|
| Stone Mite | Rock | Sphere + legs | 1 | 5 | 2.5 tiles/s | 10 tiles | Scuttles directly toward player |
| Crystal Shard | Crystal | Sharp tetrahedron | 2 | 10 | 0 | 8 tiles | Stationary, fires projectile when player near |
| Lava Leech | Magma | Elongated snake | 3 | 20 | 3.0 | 12 tiles | Burrows through lava, emerges to attack |
| Alien Spore | Alien | Floating orb + tendrils | 1 | 15 | 2.0 | 10 tiles | Explodes on death (AoE 3 tiles) |
| Guardian Golem | Cross-biome | Box + pillar legs | 8 | 30 | 1.0 | 15 tiles | Charges when hit, boss-tier |

Enemy spawn: placed during terrain generation at random positions in valid depth ranges, at least 8 tiles from player start position. Enemies remain dormant until player enters aggro range, then activate AI.

All enemies use fresnel rim shaders. Death animation: scale to 0 + fade over 0.4s.

## Meta-Progression (Surface Outpost)

Stored in localStorage key `mining_descent_meta` with JSON validation (parse failure → reset to defaults).

### Per-run flow
1. Player arrives at surface with ore cargo
2. Ore converted to currency at 1:1 ratio
3. Currency can be spent on permanent upgrades in the workshop
4. Run stats recorded: deepest depth, ores collected, enemies killed

### MVP upgrades (Workshop)
| Upgrade | Effect | Cost | Max level |
|---------|--------|------|-----------|
| Fuel Tank +25 | +25 max fuel per level | 50 currency | 3 |

### Post-MVP upgrades
- Oxygen tank (+60 per level, 3 levels)
- Hull plating (+25 per level, 4 levels)
- Cargo hold (+5 slots per level, 3 levels)
- Headlights (range +3, width +2 per level, 3 levels)
- Jump jets (unlock 150, +1 height per level, 2 levels)
- Grapple (unlock 200 — negate fall damage, traverse gaps)

### Post-MVP: Crafting station
- Emergency beacon: survive one death per run (cost: 5 crystal + 10 silver)
- Sonic repeller: enemies flee 30s (cost: 3 crystal)
- Deep drill: dig 2 tiles at once for 3× fuel (cost: 10 copper + 5 silver)
- Scanner pod: reveal ores within 15 tiles for 60s (cost: 3 gold)

### Post-MVP: Hangar vehicles
- "Mole": +20 hull, +40 fuel, slower, cargo 15 (cost: 100 currency)
- "Scarab": +30 fuel, +60 O2, faster, cargo 10, built-in headlights (cost: 150)
- "Reaper": +40 hull, ram attack damages enemies on contact, cargo 8 (cost: 200)

### Post-MVP: Run history
Data terminal tracks: deepest depth, most ore hauled, creatures killed, total runs. Cosmetic unlocks at milestones.

## Architecture

```
src/
  core/
    Game.js              — orchestrator: init, RAF loop, state machine (hub/descent/death)
    EventBus.js          — singleton: domain:action events + Events constants
    GameState.js         — singleton: per-run state + meta state, clean reset, localStorage
    Constants.js         — ALL config: world size, tiles, ores, enemies, resources, camera, particles
    Logger.js            — structured debug logging with tags + levels
  systems/
    Input.js             — event.code: Arrow keys (vehicle), ZQSD (camera pan), A/E (orbit), mouse (drag orbit), wheel (zoom)
    Camera.js            — angled follow (47°), cutaway-aware, smooth lerp, pan offset tracking
    TerrainGenerator.js  — procedural 3D grid: surface layer, rock fill, ore veins (flood-fill spread), cave carving, entrance shaft
    DigSystem.js         — tile removal trigger, falling detection, climbing trigger, dig animation
    ResourceSystem.js    — fuel/O2/hull tracking with passive drain per state
    OreManager.js        — inventory tracking, cargo limit enforcement, pickup processing
    EnemyManager.js      — per-enemy AI (scuttle/turret/drift), aggro range activation, death handling
    MetaProgression.js   — localStorage persistence, JSON validation, upgrade purchase, run history
    ParticleSystem.js    — drill dust, ore glow pulse, death burst, engine exhaust
  entities/
    Vehicle.js           — player model, grid movement, state machine (idle/move/dig/climb/fall/hurt/dead)
    Creature.js          — enemy base: patrol, aggro, chase, attack, death
    OreDeposit.js        — visual ore cluster with glow shader, mining trigger zone
  visuals/
    ModelFactory.js      — vehicle mesh (body + drill + wheels), enemy meshes (5 types)
    TerrainRenderer.js   — dual InstancedMesh (opaque + transparent cutaway), instance migration on camera move
    HeadlightEffect.js   — cone spotlight from vehicle, cuts through fog, upgradable params
    Shaders.js           — fresnel rim, ore glow pulse (sine emissive), enemy dissolve
  ui/
    HUD.js               — DOM overlay: depth, fuel/O2/hull bars, ore counter, phase indicator
    Minimap.js           — DOM canvas: discovered tiles (white on black), player dot (yellow), ore markers
    WorkshopUI.js        — DOM panel: upgrade list with costs, current levels, purchase buttons
    DeathScreen.js       — DOM overlay: death cause, depth reached, ore lost, meta currency earned, "Return to Hub" button
```

## Game Flow

```
SURFACE OUTPOST (hub)
  → view workshop, buy upgrades with currency from previous runs
  → press button to START DESCENT
  → DESCENT PHASE:
    → start at cave entrance (20, 0, 20) at y=0
    → ArrowDown to dig, Arrow keys to navigate tunnels
    → manage fuel (digging), O2 (time + climbing), hull (enemies + falls)
    → mine ore veins by digging into them (auto-added to cargo)
    → fight or avoid creatures (aggro at 10 tiles)
    → decide: go deeper or head back up?
  → RETURN PHASE:
    → climb back through your tunnel network (ArrowUp)
    → climbing costs 2× O2 — plan your return
    → reach surface (y=0 at entrance) → automatically transition to hub
  → DEATH AT ANY POINT:
    → death screen with cause + stats
    → all carried ore is LOST
    → press button → return to hub
  → SUCCESSFUL RETURN:
    → ore converted to currency (1:1)
    → spend currency on upgrades
    → next run: upgrades applied (fuel tank bonus, etc.)
  → Repeat
```

## Scope-Limited MVP

1. **1 biome** (Rock layer, y=1-49, all gray-blue rock)
2. **1 enemy**: Stone Mite (scuttles, 1 HP, 5 damage, 10 tile aggro)
3. **2 ores**: Coal (y=1-25) and Copper (y=20-49), both worth 5 currency each
4. **Vehicle**: base model, grid movement + dig + climb. No jump jets, no grapple.
5. **World**: 40×40×50 grid, InstancedMesh rendering with cutaway
6. **Resources**: Fuel start 50 (dig cost 1/tile), O2 start 120s (drain 0.5/1.0/2.0), Hull 100
7. **1 upgrade**: Fuel Tank +25 (costs 50 currency, max 3 levels)
8. **Visual**: headlights (spotlight cone, fixed), fog (near 8/far 18), ore glow shader, dust particles, starfield
9. **HUD**: fuel bar, O2 bar, hull bar, ore counter, depth counter
10. **Hub**: workshop panel (fuel tank upgrade)
11. **Death**: any resource=0 → death screen with cause → back to hub. Ore lost on death.
12. **Meta-progression**: ore→currency 1:1, localStorage with JSON validation, upgrades persist

## Visual Polish Checklist

- [ ] Drill dust burst (8 brown particles, 0.6s lifetime, additive blend)
- [ ] Ore glow pulse (emissive sine wave 2.5 rad/s, intensity 0.15–0.55, color-coded)
- [ ] Headlight cone (spotlight: angle 30°, range 15, intensity 1.2, color #ffffcc)
- [ ] Cave darkness (fog near 8/far 18, headlight extends visibility)
- [ ] Enemy fresnel rim shader (dark center, colored edge glow, biome-tinted)
- [ ] Enemy death burst (particles + scale-to-zero fade 0.4s)
- [ ] Engine exhaust (small downward particle stream while vehicle is active)
- [ ] Fall effect (instant reposition, dust ring on impact)
- [ ] Climb animation (vehicle tilts against wall, headlight adjusts)
- [ ] Surface transition (fog color shifts from deep dark to sky blue near y=0)
- [ ] Bloom on glowing ores and headlights (threshold 0.5, strength 1.0)
- [ ] Distance fog matching biome (brown/gray at rock layer)
- [ ] Visible tunnel from above (surface hole shows darkness below)
- [ ] Ore counter animation (UI counter ticks up with bounce on pickup)
- [ ] Cutaway terrain (quadrant hiding, dual InstancedMesh migration)

## Pitfalls to Avoid

- **Getting lost** — minimap is mandatory from day one. Shows discovered tiles (white), player dot (yellow), ore markers. 150×150px DOM canvas.
- **Fuel deadlock** — guarantee a coal vein within 5 tiles of entrance. If the player somehow mines all fuel and can't reach any, they die (intentional design — go back up earlier next time).
- **Climbing oxygen tax** — climbing uses 2× O2. Player must see O2 drain rate clearly in HUD so they can plan returns.
- **Ore balance** — successful MVP run should net ~15-25 ore (3-5 veins, 3-7 ore each). Fuel tank costs 50 = 2-3 successful runs. Tune if grindy.
- **Terrain performance** — 40×40×50 = 80,000 tiles. Use dual InstancedMesh (one draw call per material/tile-type). Update instance matrices on dig; don't recreate geometry. Transparent mesh uses depthWrite=false.
- **Dig through surface** — surface tiles (y=0, TILE_SURFACE) are indestructible. Prevents digging a new exit anywhere.
- **Camera collision** — cutaway approach (hide tiles in camera quadrant) eliminates all camera-vs-terrain issues. Tiles are hidden before the camera can clip them.
- **AZERTY** — use event.code throughout. Vehicle: Arrow keys. Camera: ZQSD + A/E. All documented in both layouts.
- **Restart cleanup** — terrain regenerates, vehicle resets, inventory empties, all event listeners removed. Test 3× restart.
- **Cutaway direction** — the hidden quadrant is determined by camera angle mod PI/2. Tiles in that quadrant get moved from opaque to transparent InstancedMesh. Update on every camera rotation change.
- **Falling is instant** — no smooth fall animation in MVP. If vehicle is on AIR tile, immediately resolve fall: calculate distance to first solid tile below, apply damage, snap position.
- **localStorage corruption** — wrap JSON.parse in try/catch, reset to _metaDefault() on failure. Never crash on corrupted save data.