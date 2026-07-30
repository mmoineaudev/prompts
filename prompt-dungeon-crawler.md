# Procedural Roguelite Dungeon Crawler — Pixel-Retro 3D (Three.js + Vite)

## Concept

A top-down 3D dungeon crawler with roguelite permadeath and meta-progression. Every run generates a unique multi-floor dungeon — rooms connected by corridors, filled with enemies, traps, treasure, and a guaranteed path to the exit stairs. Think GameCube-era Zelda dungeons meets The Binding of Isaac, rendered in low-poly 3D with pixel-retro shaders and bloom.

The camera is an angled top-down third-person view (like Diablo or Hades), following the player through procedurally-connected rooms. The dungeon is a grid of rooms at each floor level, with corridors between them. Each floor has a fixed number of rooms (5-8 for MVP), the last of which contains the stairs down.

## Visual Style

- **GameCube pixel-retro 3D** — low-poly geometry, flat-shaded or vertex-colored. Limited color palette per biome (earth tones for crypt, blues/cyan for ice, reds/oranges for lava).
- **Angled top-down camera** — 55° angle, position offset (0, 18, -12) from player, FOV 60, looking at player + (0, 0, 2). Smooth lerp follow. Walls between camera and player become semi-transparent (camera-clip-through approach — simpler than wall lowering).
- **Fog** — exponential fog, density 0.008, color matches biome. Hides distant geometry, moody atmosphere.
- **Bloom** — threshold 0.3, strength 0.6, radius 0.5. Torches glow, white geometry stays readable.
- **Dynamic lighting** — player carries torch (point light: #ffcc88, intensity 0.8, range 6, decay 2). Wall torches provide ambient light (point light: #ff9944, intensity 1.5, range 8, decay 2). Torch flicker: intensity × sin(time × 8 + seed) × 0.15 + light position jitter ±0.05.
- **Enemies** — low-poly geometric creatures with fresnel rim shaders. Dark center, colored edge glow.
- **Player** — low-poly knight: body, head, shield arm, sword arm, legs. Named children: `_body`, `_head`, `_swordArm`, `_shieldArm`, `_legs`. States: idle (gentle bob), run (bob ×1.5), dodge (tuck + roll), attack (swing arm), hurt (stagger + flash), dead (dissolve).
- **Dungeon architecture** — tiled floors (grid texture), walls 3 units tall (extruded boxes), doors as archways, corridors 2 tiles wide with wall sconces.

## Tech Stack

- Vite + Three.js (ES modules)
- `src/` directory following game-architecture patterns
- PostProcessing via three/addons (EffectComposer, UnrealBloomPass, RenderPass)
- No physics engine — simple AABB collision on XZ plane
- All constants in `Constants.js`
- All cross-module communication via EventBus.js (`domain:action` format)
- GameState.js singleton with clean `.reset()`, meta-progression in localStorage

## Controls

All input uses **event.code** for AZERTY/QWERTY compatibility:

| Action | AZERTY | QWERTY (equivalent) | Notes |
|--------|--------|---------------------|-------|
| Move | ZQSD | WASD | Camera-relative, 8-directional |
| Dodge roll | Space | Space | Dash in movement direction, 2s cooldown |
| Attack | E or Left Click | E or Left Click | Melee swing in facing direction |
| Interact | F | F | Open chests, pick up items, descend stairs, talk to NPCs |
| Pause | Escape | Escape | Pause overlay |

### Camera-relative movement
```
forward = normalize(cameraForward projected on XZ plane)
right   = normalize(cameraRight projected on XZ plane)
direction = normalize(forward × (Z-S) + right × (Q-D))
```

## Player Stats

| Stat | Value | Notes |
|------|-------|-------|
| Collision radius | 0.4 units | Cylinder on XZ plane |
| Move speed | 6.0 units/s | Base, +30% with speed boots |
| Max hearts | 3 (base), 5 (max) | +1 per heart container from boss |
| Dodge distance | 4 units | Over 0.2s, 0.15s iframes |
| Dodge cooldown | 2.0s | |
| Attack arc | 120° (base sword) | Varies by weapon |
| Attack range | 1.5 units (base) | Varies by weapon |
| Attack duration | 0.3s (base) | Varies by weapon |
| Pickup range | 1.0 unit | 2.0 with magnet item |

### Player state priority
`dead` > `hurt` > `dodge` > `attack` > `interact` > `idle`/`run`
Cannot attack during dodge or hurt. Cannot dodge during attack wind-down.

## Weapons

| Weapon | Arc | Range | Duration | Damage | Special | Unlock cost |
|--------|-----|-------|----------|--------|---------|-------------|
| Short Sword | 120° | 1.5u | 0.3s | 1 | Starting weapon | Free |
| Broadsword | 150° | 1.8u | 0.5s | 2 | Wide sweep | 150g |
| Dagger | 60° | 1.2u | 0.15s | 0.5 | 3-hit combo (0.5→0.75→1.0 dmg) | 100g |
| Spear | 30° | 2.5u | 0.4s | 1.5 | Long reach | 200g |
| Hammer | 180° | 1.5u | 0.7s | 3 | Stuns enemies 1s | 300g |

Only one weapon equipped at a time. Equipment found mid-run is lost on death.

## Passive Items

| Item | Effect | Found in |
|------|--------|----------|
| Speed Boots | +30% move speed | Treasure chests |
| Thornmail | Reflect 30% of taken damage | Treasure chests, bosses |
| Lifesteal Ring | Heal 0.5 heart per kill | Treasure chests, bosses |
| Magnet | Double pickup range (1→2 units) | Treasure chests |

## Consumables

| Item | Effect | Max stack |
|------|--------|-----------|
| Health Potion | Heal 1 heart | 3 |
| Bomb | 3u explosion, 3 damage, breaks cracked walls | 3 |
| Key | Opens one locked door or chest | 3 |

## Enemy Types

Detection range: 8 units (all types). Patrol: random wander within room, change direction every 2-4s.

| Type | Shape | HP | Dmg | Speed | Behavior |
|------|-------|----|-----|-------|----------|
| Grunt | Box + 4 cone spikes | 2 | 1 | 2.5 | Patrol, charge at 6u range (8u dash) |
| Ranged | Octahedron + eye | 1 | 1 | 2.0 | Keeps 5u distance, fires projectile at 8u/s every 2s |
| Shield | Sphere + torus | 3 | 1 | 2.0 | Blocks frontal 120° arc. Flank to damage. |
| Sprinter | Cone (forward) | 2 | 1 | 4.0 | Dashes at 8u/s for 6u, 1.5s pause after miss |
| Exploder | Spiky sphere | 1 | 2 | 3.5 | Rushes player, explodes when within 2u (0.5s fuse, 2u radius) |
| Boss F5 | Dodecahedron + horns | 8 | 2 | 3.0 | Phase 1: charge 8u/s + AoE slam 3u radius. Phase 2 (≤50% HP): spawns 2 Grunts every 8s |
| Boss F10 | Sphere + spike ring | 12 | 2 | 2.5 | Phase 1: spin 3u radius at 3u/s + 8-projectile burst every 4s. Phase 2 (≤50%): spin 5u/s + 12 projectiles |

All enemies have fresnel rim shader with per-type rim color. Death: dissolve animation (scale to 0 + fade over 0.4s).

## Procedural Dungeon Generation

### Grid system
- 1 tile = 1 world unit
- Room templates define width × depth in tiles
- All positions use `{ x, z }` coordinates in the XZ plane

### Floor layout
1. Create room grid (e.g. 5×5 for small, 7×7 for larger)
2. Place spawn room at one edge, exit room at opposite edge
3. Place boss room (every 5th floor), challenge room, treasure room, shop room (post-MVP)
4. Fill remaining with combat rooms
5. Build spanning tree from spawn to exit (guaranteed connectivity)
6. Add optional secondary connections for exploration
7. Corridors: 2 tiles wide, length = distance between connected room edges
8. Select templates randomly for each room type

### Room templates (data-driven)
```javascript
const ROOM_TEMPLATES = {
  combat: [
    {
      width: 7, depth: 7,
      walls: [[1,1,1,5], [5,1,1,5]],          // [x, z, width, depth]
      pillars: [[3,3]],
      enemies: [
        { type: 'grunt', x: 2, z: 2 },
        { type: 'grunt', x: 4, z: 4 }
      ],
      doors: { north: [3,0], south: [3,6] }   // [x, z] door center
    },
    {
      width: 9, depth: 7,
      walls: [[2,2,1,3], [6,2,1,3]],
      pillars: [[4,3], [4,5]],
      enemies: [
        { type: 'grunt', x: 1, z: 3 },
        { type: 'ranged', x: 7, z: 3 }
      ],
      doors: { west: [0,3], east: [8,3] }
    },
  ],
  treasure: [
    {
      width: 5, depth: 5,
      walls: [], pillars: [], enemies: [],
      chests: [{ x: 2, z: 2, loot: 'gold_50' }],
      doors: { south: [2,4] }
    },
  ],
  spawn: [
    {
      width: 7, depth: 7,
      walls: [], pillars: [[1,1], [5,1], [1,5], [5,5]],
      enemies: [],
      doors: { north: [3,0], east: [6,3] },
      safe: true
    },
  ],
  // ... shop, challenge, boss, exit templates
};
```

Walls and pillars are extruded boxes (wall height: 3 units). Floor is a textured plane. Doors are 2-tile-wide openings (archway frame).

### Door mechanics
- Player walks through door zone → triggers room transition (no button press)
- Camera slides to new room over 0.3s
- Previous room enemies deactivate (AI paused); new room enemies activate
- Minimap updates to show discovered room

### Corridors
- 2 tiles wide, walls on both sides
- Length = distance between connected room door positions
- May contain wall torches but no enemies or loot

### Stairs
- Exit room contains stairs at room center
- Player approaches + presses F → fade to black 0.5s → load next floor
- MVP: stairs lead to "DEMO COMPLETE" screen, then hub

## Combat & Loot

- Each enemy kill drops loot: 50% gold (5-15), 20% consumable, 5% equipment, 25% nothing
- Equipment rarity within 5% drop: 60% common, 30% rare, 10% legendary
- Chest loot table: gold_25, gold_50, gold_100, health_potion, bomb, key, equipment_common, equipment_rare
- Boss drop: heart container (first kill) + guaranteed equipment + 50 gold

### Gold
- Single pool — collected during run, persists across runs
- On death: all run gold is permanently saved to meta-progression
- In hub: spend meta gold on permanent upgrades
- Gold pickups float toward player when within pickup range

## Camera & Rendering

| Parameter | Value |
|-----------|-------|
| FOV | 60 |
| Offset from player | (0, 18, -12) |
| Look target | player position + (0, 0, 2) |
| Smooth lerp | 0.1 factor |
| Near plane | 0.5 |
| Far plane | 50 |
| Near-wall opacity | 0.2 (walls between camera and player) |
| Fog type | Exponential |
| Fog density | 0.008 |
| Canvas | Full window, responsive resize, HiDPI (max 2× pixel ratio) |

## Post-Processing

```js
// EffectComposer pipeline
RenderPass → UnrealBloomPass({ threshold: 0.3, strength: 0.6, radius: 0.5 }) → OutputPass
```

## Meta-Progression (Roguelite Hub)

Hub is a 10×10 tile room, cozy dungeon chamber with ambient torches and NPC stands. Rendered in 3D.

**Interaction**: walk up to NPC (within 2 units), press F → menu overlay opens.

| NPC | Upgrades | Cost |
|-----|----------|------|
| Blacksmith | Unlock Dagger (start with it) | 100g |
| Blacksmith | Unlock Broadsword | 150g |
| Blacksmith | Unlock Spear | 200g |
| Blacksmith | Unlock Hammer | 300g |
| Trainer | +1 starting heart (max 5) | 200g |
| Trainer | Start with Speed Boots | 150g |
| Merchant | Start with 1 Health Potion | 50g |
| Merchant | Start with 2 Bombs | 75g |

Meta-progression stored in localStorage with validation (parse failure → reset to defaults).

## Architecture

```
src/
  core/
    Game.js              — orchestrator: init, RAF loop, state machine (BOOT/HUB/DUNGEON/DEATH)
    EventBus.js          — singleton, domain:action events
    GameState.js         — singleton, clean .reset(), per-run + meta state
    Constants.js         — ALL magic numbers, balance, enemy/item/weapon defs
  systems/
    Input.js             — event.code, camera-relative movement calc
    Camera.js            — angled top-down follow, near-wall transparency, smooth lerp
    DungeonGenerator.js  — floor layout, spanning tree, template selection, connectivity
    RoomManager.js       — loads/unloads room geometry, activation, transitions
    EnemyManager.js      — spawns per template, AI behaviors, death/loot
    LootManager.js       — drops, pickups, equipment, rarity, consumables
    ParticleSystem.js    — hit sparks, death burst, pickup glow, heal particles
    MetaProgression.js   — localStorage persistence, validation, hub upgrades
  entities/
    Player.js            — movement, dodge, attack, damage, state machine
    Enemy.js             — generic AI with configurable behavior (patrol/charge/ranged/explode)
    Item.js              — gold, hearts, keys, bombs, potions, equipment pickups
    Projectile.js        — enemy ranged projectiles (8 units/s, destroyed on wall hit)
  visuals/
    ModelFactory.js      — procedural: player, enemies, items, NPCs, chests
    Shaders.js           — fresnel rim, glow pulse, dissolve
    DungeonArchitecture.js — builds room geometry from templates (walls, floor, pillars, doors, torches)
  ui/
    HUD.js               — DOM: hearts, gold, equipment icon, floor number, consumables
    HubUI.js             — DOM: NPC interaction panels, upgrade shop
    DeathScreen.js       — DOM: floor reached, enemies killed, gold earned, "Return to Hub"
    DamageNumbers.js     — floating DOM text on hits (red for player dmg, white for enemy dmg)
    ItemTooltip.js       — floating DOM tooltip on nearby loot
    Minimap.js           — 150×150px DOM canvas, bottom-right, 3×3 rooms around player
```

## Game Flow

```
BOOT → HUB (upgrade shop, equip starting items)
     → ENTER DUNGEON (Floor 1 spawn room)
     → Explore rooms: clear enemies → loot chests → find exit
     → Descend stairs to next floor
     → Repeat until death or demo complete
     → DEATH SCREEN (run summary, gold permanent save)
     → Return to HUB (spend gold)
     → Repeat
```

### Hub to dungeon
Player walks to dungeon entrance door → press F → confirm → fade 0.5s → load Floor 1

### Room transitions
Player walks through door zone → camera slides 0.3s → enemies activate in new room, deactivate in old. No loading screen.

### Stairs transition
Player approaches stair tile → press F → fade to black 0.5s → spawn on next floor's spawn room.

### Death
HP reaches 0 → death state (dissolve 0.4s) → fade 0.5s → death screen → save all run gold → press Space → return to hub.

## Scope-Limited MVP

1. **Floor 1 only** — 5 rooms (spawn → 2 combat → treasure → exit). Hand-placed templates.
2. **2 enemy types**: Grunt and Ranged
3. **3 items**: gold pickup (5-15), health pickup, broadsword (equipment)
4. **No boss** — exit room has stairs → "DEMO COMPLETE" screen → hub
5. **Simple hub**: 10×10 room, blacksmith NPC with 2 upgrades (broadsword 150g, +1 heart 200g)
6. **Visual**: 2 room templates per type, fog, bloom, one wall torch per room, enemy fresnel rim
7. **HUD**: hearts (3), gold counter, floor number, equipment slot
8. **Death**: HP=0 → dissolve → death screen → gold saved → Space → hub
9. **Meta-progression**: gold in localStorage with validation
10. **Restart**: clean .reset(), 3× restart test with no console errors

## Audio (Web Audio oscillator beeps, minimal)

| Event | Sound |
|-------|-------|
| Player attack | Short high blip (400Hz, 50ms) |
| Player hit | Low buzz (150Hz, 80ms) |
| Enemy death | Descending chirp (600→200Hz, 100ms) |
| Item pickup | Rising ping (800Hz, 60ms) |
| Door transition | Soft whoosh (white noise, 100ms) |

## Pitfalls to Avoid

- **Camera-relative movement** — must be relative to camera angle, not world axes. Compute forward/right from camera XZ projection.
- **Room transition ghosting** — deactivate enemy AI when leaving room, don't destroy them.
- **Collision resolution order** — player-vs-wall → player-vs-enemy → enemy-vs-wall. Wrong order = enemies clip walls.
- **Dodge roll** — skip damage during dodge (0.15s iframes), but still collide with walls.
- **Meta-progression corruption** — validate localStorage JSON on load, reset to defaults on parse failure.
- **Gold on death** — save at death moment. Tab-close mid-run = lose run gold (intentional roguelite design).
- **Floor generation** — generate full room layout on stair descent, build geometry lazily on first enter.
- **Item stacking** — equipment: 1 slot, replace on pickup. Consumables: stack to 3. Gold: unbounded counter.
- **Bloom over-brightness** — threshold 0.3 so torches glow but white geometry doesn't wash out.
- **event.key → event.code** — always use event.code. Primary controls documented as ZQSD.
- **Restart cleanup** — all listeners, timers, scene children, intervals cleaned on death. 3× restart test.
- **Wall transparency** — walls between camera and player get opacity 0.2. Check via raycaster from camera to player — any wall hit gets transparent material swap.