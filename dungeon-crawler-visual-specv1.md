# Dungeon Crawler Visual — Reproduction Specification (v1)

**Source of truth for re-implementing the game with any future model.** Everything in this document is binding: the mechanics, the numbers, the rules, the formulas, the technical architecture, and the order of operations. A faithful re-implementation must match the gameplay AND the engineering described here, and must pass the verification suite in §24.

**Scope rule — graphic elements are deliberately unspecified.** Colors, palettes, mesh geometry, prop shapes, textures, particle visuals, post-processing *look* parameters, HUD styling, and audio are left to the implementer's judgment. The game's *identity* (biome themes, weapon silhouette per tier, Dark-Souls-style HUD) is specified at the level of *what the player experiences*, never as pixel recipes. **What IS binding**: every number that affects gameplay (damage, HP, speeds, ranges, timings, counts, weights, probabilities, formulas), every rule, every state transition, every technical mechanism (generation algorithm, collision model, pooling, disposal, rendering pipeline structure, camera layers, budgets), and everything that keeps the game at its 30 fps floor.

Reference implementation: Three.js + Vite browser game (raw Three.js + `three/examples/jsm` post-processing; no game engine, no audio, no asset files — procedural canvas textures only).

---

## 1. Game identity & design pillars

- **The descent**: endless, level-by-level descent. Each level is a procedurally generated dungeon with an entrance and a golden exit portal; reaching the exit advances to the next level. The level number never resets except on death.
- **Orb economy as risk/reward**: orbs are BOTH ammo and score. Kills drop orbs; you spend orbs to shoot; holding orbs makes the sword bigger/stronger AND makes the game spawn more enemies (more pressure, more drops). Dying costs everything on a fresh run, or 75% of banked orbs on NG+.
- **Souls-ladder progression**: the souls counter (orbs = souls — one notion) drives a 6-tier sword evolution; the tier locks at the max reached and is communicated by the weapon's form, the slot label and a toast — never by a number on the HUD.
- **Escalation without reset**: enemy count, enemy speed/attack, and the timer all scale with level; biomes cycle underneath. Boss kills permanently buff all mobs (+10% speed/attack each). NG+ stacks +200% enemy HP per cycle (effects doubled).
- **Timed pressure**: 180 seconds per level. Run out → the run ends.
- **Buffs**: temporary, powerful, one at a time, looted from broken crates/barrels (or boss kills). Never the same buff twice in a row.
- **Souls-like HUD**: hearts top-left (red bar), gold "Souls" counter, weapon slot, dark-fantasy panels. All HUD elements represent real state; no fake meters.
- **Performance is a hard requirement**: 30 fps floor, enforced by design budgets (§22) and a self-degrading safeguard.

---

## 2. Controls

All binds use `event.code` (physical key position, not layout label) — this makes AZERTY/QWERTY layouts work with zero rebinding: on AZERTY, `KeyW` is the physical Z key, `KeyA` is the physical Q key.

| Action | Bind | Type | Notes |
|---|---|---|---|
| Move forward | `KeyW` (Z on AZERTY) | hold | base speed 4 u/s |
| Move back | `KeyS` | hold | |
| Strafe left | `KeyA` (Q on AZERTY) | hold | |
| Strafe right | `KeyD` | hold | |
| Sprint | `ShiftLeft` / `ShiftRight` | hold | ×1.55 speed, FOV kick, +5%/s acceleration tier (capped ×3) |
| Look | mouse | pointer-locked | sensitivity 0.002 rad/px, pitch clamp ±85° |
| Fire orb | Mouse 0 (LMB) | hold | one click = one step of the 3-step sequence; hold keeps stepping at 0.22 s |
| Sword attack | Mouse 2 (RMB) | edge press | 3-hit combo; press again inside the 0.34 s window to chain |
| Fireball (buff) | Mouse 2 (RMB) | hold | only while FIREBALL buff is active; free, 0.35 s cooldown |
| Descend | `KeyE` | edge | only inside the exit room and while the portal is open |
| Toggle post-processing | `KeyP` | edge | default ON |
| Leaderboard panel | `Tab` | edge | |
| Restart / New Game+ (death screen) | `KeyN` / `KeyY` | edge | also clickable buttons |
| Save for later (death screen) | `KeyS` | edge | writes the run to localStorage; one save per death screen |
| Load last save / New Game (startup menu) | `KeyL` / `KeyN` | edge | menu appears only when a save exists |
| Pointer lock | click on canvas | — | RMB context menu suppressed |

Input handling: `InputSystem` stores key/mouse state from `window` listeners (`keydown/keyup`, `mousedown/mouseup`, `mousemove` accumulated deltas); consumers read `isPressed(code)`, `isMouseDown(button)`, `consumeMouse()` (returns accumulated deltas and resets), `isPointerLocked()`; click on canvas requests pointer lock; RMB context menu is prevented. Edge-triggering (E, P, Tab, Y/N, RMB combo) is done by the consumer comparing previous-frame state.

---

## 3. Run structure & meta-loop

- **Level flow**: spawn at the entrance room → explore → kill enemies → collect orbs → reach the golden exit → press E → next level. The exit portal is hidden/closed on boss levels until the boss dies.
- **Boss cadence**: every 7th level (`BOSS.INTERVAL = 7`) is a single-boss arena: levels 7, 14, 21, 28… The boss biome (SPECTRAL_COURT) overrides the normal biome ladder on those levels.
- **Timed run**: `TIMED_RUN.LEVEL_TIME_LIMIT = 180` seconds per level. `levelTime` counts up while playing; at 180 s the run ends (reason "time"). The run timer does not tick while the title screen holds the scene, and starts fresh after it lifts (so loading lag never counts).
- **Death**: any lethal damage ends the run (reason "dead"). On death, the run is submitted to the leaderboard and the death screen offers **Restart [N]** (fresh run, level 1, everything reset), **New Game+ [Y]**, or **Save for later [S]**:
  - NG+ starts at `max(1, floor(level / 2))`, keeps `floor(souls × 0.25)` (a heavy **75% toll** on the ONE souls counter — never a full reset), increments `ngPlus`, keeps `bossKills`, and KEEPS the weapon tier (the ladder never downgrades). Mobs get **+300% HP per NG+ cycle** (100% base + the doubled-effect ruling +200% + an additional +100%) AND **+100% bonus HP every 10 levels**; spawn pressure ABOVE the ×100 spawn cap converts to HP at +100% per 10 excess points (`enemyHpMultiplier = (1 + 3·ngPlus) × (1 + floor(level/10) + floor(max(0, level+souls−990)/10))`).
  - A fresh restart: level 1, 0 orbs, ngPlus 0, bossKills 0, max health 3.
  - **Save [S]** writes the run to localStorage (`dungeonCrawlerSave`) AND mirrors it to a file on disk via the companion save-server (`scripts/save-server.mjs`, port 5174, started by `launch.sh`): level, runTime, souls (the single orbs/souls counter), weapon tier, permanent hearts, NG+ cycle, boss kills, plus the just-recorded death entry.
- **Startup**: a TITLE SCREEN always shows first — a living spectral-court showcase scene (golden exit portal, hovering soul orbs, an idling Spectral Lord, cold pillar flames) with the game's name in huge type. The menu offers **Load last save [L]** (only when a save exists) and **New Game [N]**. Loading restarts the SAVED LEVEL from the beginning — fresh level, full health, spawn protection — with ALL meta-progression intact: souls (single counter, no 10% penalty on load), weapon tier, permanent hearts, NG+ cycle unchanged, boss kills kept. The save is NOT consumed by loading: it persists until a new death-save overwrites it, so the Load option never disappears. At startup the game prefers the local copy and falls back to the file-backed server copy (survives browser storage wipes, private windows, and localhost-vs-LAN origin switches between server runs). The stale death entry is removed from the ledger (the run didn't end there). A buff never carries across a save-load.
- **Level advance** (E at exit, non-boss or boss-after-death): keeps `runTime`, `level + 1`, `collectedOrbs` (the one souls counter), `ngPlus`, `bossKills`, `weaponTier`, `maxHealth` (permanent hearts), and carries an active buff with **×5 its remaining time, capped at 90 s**. Health always starts a new level at full. The buff's side effects are re-applied AFTER the level systems are rebuilt (never against disposed systems).
- **Boss defeat**: `bossKills++` (permanent +10% movement AND attack speed for all mobs, multiplicative), a 5-minute buff (uncapped duration), +1 permanent max heart (heal +1), and the exit portal opens.
- **Loading/title screen** (each level): shows level number, biome name, active buff + description, and live stats (Souls, DMG ×, Orb DMG, Reach, Enemy HP, Mob speed, Spawns, Regen). It lifts when: the rolling average fps over a ~3 s window is ≥ 30 AND the enemy spawn queue is fully drained, or after a hard max-hold of 8 s. When it lifts: `safeSpawn = 5 s` and `invulnTimer = 5 s` (player rooted + invincible, mobs idle, countdown shown).

---

## 4. Technical architecture

### 4.1 Stack & module map
Stack: **Vite + Three.js** (ES modules via npm; `three/examples/jsm` only for post-processing). No game framework, no asset files, no audio. All textures/materials are procedural (Canvas 2D + ImageData).

```
index.html                  HUD DOM (static divs), loading overlay, fonts
src/
  main.js                   Bootstrap: new Game('app'); game.init(); window.game = game (QA hook)
  core/
    Constants.js            ALL numbers (the game's data contract): WORLD, PLAYER, CAMERA, LIGHTING,
                            MATERIALS, DUNGEON (room types/eligibility/modifiers), BIOMES (palettes,
                            sequence, torchMode, brazierRooms), BOSS, BIOME_ROOM_MODIFIERS, RENDERER,
                            SMOKE, SKELETON, ENEMY, ARMORED/ARCHER/RAT/BRUTE/WRAITH, ELITE,
                            ENEMY_SPAWN_WEIGHTS, ENEMY_TYPES, ROOM_ENEMY_MODIFIERS, SWORD (+COMBO,
                            ELECTRIC_*), HIT_STOP, EVOLUTION (+weaponTier, swordHitDamage), BUFF,
                            HUNTER, ORB_WEAPON (+orbPowerMultiplier, orbDamageMultiplier, excessOrbs,
                            enemyHpMultiplier), MAGICIAN, BURN, DROP, PROPS (+POOLS), LIGHT_SOURCES,
                            LIGHT_CEILING, TIMED_RUN, biomeForLevel()
    GameState.js            Serializable run state; applyBuff/updateBuff/updateSprint/sprintSpeedMult
    Game.js                 Orchestrator: init, level lifecycle, update loop, combat, HUD, meta
    Collision.js            Shared circle-vs-AABB helpers: circleHitsBox, resolveCircleCollisions
    Leaderboard.js          localStorage top-10 rankings
    EventBus.js             Tiny pub/sub (on/off/emit)
    Materials.js            Seeded procedural material factories (+ normal/roughness maps)
  world/
    DungeonGenerator.js     Seeded grid dungeon: rooms, MST corridors, entrance/exit (§5)
    WorldBuilder.js         Grid → instanced geometry (floor/ceiling/debris) + wall boxes + collision
    Textures.js             Canvas texture generators (wall/floor/ceiling/runes/glow), biome tinting
    BiomeSystem.js          Biome progression, palette resolution, lazy per-biome texture cache
    PropSystem.js           Props/decorations: weighted per-room+biome pools, breakables, interactives,
                            hazards (lava/acid pools), instanced decoratives, degraded-mode reducer
  entities/
    PlayerSword.js          First-person weapon: combo state machine, per-tier forms (§9), trails,
                            sparks, smoke, danger/growth lights, evolution forms
    OrbSystem.js            Drop-only orb economy: instant-credit orbs (1 s visual), health/buff
                            pickups, pickup rings, death bursts
    OrbShooter.js           Orb weapon: pooled projectiles (48 + 10 fireball slots), sequence logic,
                            bounces, explosions, fireball variant
    SkeletonSystem.js       Enemy spawner + AI driver: spawn plan/queue, reveal pacing, per-type
                            behaviors, LOS/pathing, projectiles (orb/arrow pools), brute shockwave,
                            boss hookup, BURN handling, hitSkeleton, dispose
    Skeleton.js             Base enemy (skeleton/magician): procedural rig, pose state machine, hit/death
    Hunter.js               HUNTER buff companion (follow, LOS-targeted beam)
    enemies/
      ArmoredSkeleton.js    tank variant
      ArcherSkeleton.js     ranged kiter variant
      Brute.js              slam variant
      Rat.js                pack chaff variant
      Wraith.js             phasing variant
      GhostBoss.js          boss (7 variants, charge+summon AI)
      Burning.js            BURN final foe
  systems/
    InputSystem.js          Keyboard/mouse/pointer-lock state
    LightingSystem.js       Ambient/fog, torches (exposed-edge placement, shadow budget), braziers,
                            crystals, god rays, start/exit markers, dispose
    SmokeSystem.js          Pooled GPU point-sprite smoke (emitters + transient puffs, distance fade)
    ParticleSystem.js       Ambient dust motes (Points, torch-adjacent opacity)
    RuneSystem.js           Procedural wall runes (pulsing opacity)
    PostProcessing.js       EffectComposer pipeline + enemy-glow layer pass (§12)
scripts/                    Headless verification suite (§24)
docs/                       (specs/history — not needed to build)
```

### 4.2 Bootstrap & init order
`main.js`: `new Game('app')` → `game.init()` → `window.game = game`.

`Game.init()` order (binding):
1. `_initRenderer()` — WebGLRenderer, antialias, ACESFilmic tone mapping exposure 1.0, PCFSoft shadow map, sRGB output, pixel ratio `min(devicePixelRatio, 2)`, resize listener.
2. `_initCamera()` — PerspectiveCamera (FOV 90, near 0.1, far 160); `camera.layers.enable(2)`; creates the sword (camera child, layer 2), the headlight (camera child, layer 0, no shadow), and the held-fireball group (camera child).
3. `_initPostProcessing()` — composer pipeline (§12); post ON by default.
4. `_initInput()`.
5. `_bindEventToasts()`, then the save bootstrap (corrupt local save dropped; file-backed copy pulled when local is empty).
6. `_initTitleScene()` — the spectral showcase room (portal + orbs + boss) behind the start menu; `_showStartMenu()`; `_animateTitleScene()` (bobs orbs, spins the portal ring, drifts the boss, sways the camera).
7. Choosing New Game / Load calls `_beginRun()` → `_stopTitleScene()` (loop cancelled; the scene is torn down by the first `_disposeScene`) → `_regenerateDungeon()`.
8. Build level: `_generateDungeon()` → `_buildWorld()` → `_initLighting()` → `_initProps()` → `_initSmoke()` → `_initParticles()` → `_initRunes()` → `_initOrbs()` → `_initCombat()` → `_placeWaterPuddles()` → `_setupPlayerStart()`.
9. Welcome messages, bind toasts, `_emitLevelStart()` (`level:start` event), `_updateHUD()`.
10. Start clocks, `_showTitle()`, `_animate()`.

### 4.3 Level lifecycle (the async loader)
`_regenerateDungeon({newRun, nextState, startMessage})` — async, phased, yields one `requestAnimationFrame` between phases so the browser stays responsive and GC can run:
1. `_isRunning = false` (stop loop/timer); show the title with the TARGET level number (never stale).
2. `_teardownLevel()` — dispose every level-owned system in order: hunter, orbs, runes, particles, lighting, props, smoke, skeletons, shooter; null arc bolts; dispose water puddle geometry; then `_disposeScene()` (§14). Yield.
3. Capture a carried buff (level advance only) BEFORE replacing state: `{effect, time}` → later applied ×5 capped at 90 s.
4. Rebuild state (fresh / NG+ / level-advance carry rules per §3). `maxHealth` resets only on a new run; health always starts full. Yield.
5. `biomes.applyLevel(level, state)`; emit `biome:change` if it changed.
6. Build phases, each followed by a yield: `_generateDungeon` → `_buildWorld` → new `LightingSystem` + init → `_initProps` → new `SmokeSystem` + rebind emitters → new `ParticleSystem` → new `RuneSystem` → new `OrbSystem` (+ re-wire `onBuffCollected`) → `_initCombat` (new shooter, new SkeletonSystem, exit portal setup, fire-patch pool) → water puddles → player start.
7. Messages, `_emitLevelStart`, re-apply carried buff side effects (or clear stuck visuals), `_isRunning = true`, restart `_lastTime`, `_animate()`.

The **update loop** (`_animate`): rAF; `dt = min((now − last)/1000, 0.1)`; perf monitor (§22); title-fps logic; input → camera → toggles → exit check → timers → lighting/particles/smoke/runes/orbs → fire patches → props → breakable steps → combat (shooting/sword when not title + safeSpawn ≤ 0) → buffs → skeletons → hunter → shooter → invuln/safe-spawn clocks → regen → shake → water animation → messages → HUD → weapon evolution check → arc bolts → sword smoke → post-processing render.

**Hit-stop**: `state.hitStop` counts down by raw `dt`; while > 0 the world `dt` is set to 0 (camera shake still runs). Set to 0.06 s on sword hits, 0.12 s on the electric chain, 0.1 s on weapon evolution.

### 4.4 Event bus
`EventBus` (on/off/emit). Events used: `level:start {level, biome}`, `biome:change {biome, biomeIndex}`, `sword:hit {step, enemiesHit, damage}`, `prop:opened`, `prop:broken`. Other wiring is direct callbacks (onKill, onBossKill, onPlayerDamaged, onPlayerDeath, onBurn, onExplode, onHitProp, onBuffCollected, lavaHazard, onBreak).

### 4.5 State schema (`GameState`)
```js
{
  player: { x, y, z, yaw, pitch },
  collectedOrbs,        // THE ONE souls counter (orbs = souls): ammo, score, spawn + ladder source
  weaponTier,           // 0..5, locked at the max reached (spending ammo never downgrades)
  ngPlus,               // NG+ cycle
  bossKills,            // permanent: +10% mob move/attack per kill
  totalOrbs,            // per-level pickup count (unused for scoring)
  health, maxHealth,
  invulnTimer, safeSpawn, visitedCells, dungeonSeed,
  effectsEnabled, minimapVisible (unused), pointerLocked,
  inExitRoom, runTime, level, levelTime,
  biome, biomeIndex, swordCombo, hitStop,
  sprintHoldTime, sprintTier, buffEffect (0..5), buffTime,
}
```
Plus Game-side runtime state (not persisted): `_maxHealth` (permanent hearts, grows with boss kills), `_bossPortalOpen`, `_degraded` (perf), fire-patch pool, arc bolt pool, etc.

---

## 5. Level generation mechanism (exact)

All randomness in the generator goes through a seeded **mulberry32** PRNG (`seed` = `Date.now()` per level) — the same seed always produces the same dungeon.

### 5.1 Parameters
Grid 12–16 cells; cell size 6 u; rooms 8–12; 1-cell min room distance; dead ends 0–4; wall height 20 u; 200 max placement attempts.

### 5.2 Algorithm (order is binding)
1. **`_initGrid()`** — `gridSize × gridSize` cells, all `empty`; parallel `metadata` array (`{type:'empty'}`).
2. **`_placeRooms()`** — loop until `rooms.length >= count` or 200 attempts:
   - `_pickRoomType()`: iterate `DUNGEON.ROOM_TYPES`; skip rooms not eligible for the current biome (§7.3); weight = `base × BIOME_ROOM_MODIFIERS[biome][room] ?? 1`; skip weight ≤ 0; weighted sample.
   - Size: `w = minSize + rnd × (maxSize − minSize + 1)`; `h = maxSize > 2 ? minSize + rnd × (maxSize − minSize + 1) : 1` (HALL is 1–2 × 1).
   - Random top-left cell; accept only if `_canPlaceRoom` (bounds with 1-cell margin + no overlap with any carved cell within margin 1).
   - Carve: cells → `room`, metadata `{type:'room', roomType}`; push `{cx, cz, w, h, type}`.
3. **`_connectRooms()`** — Prim's MST over the complete graph with Manhattan distance between room centers; carve a corridor for each MST edge. Then add loop corridors: sort all remaining pairs by distance, take pairs with distance ≤ gridSize, up to `min(3, floor(n/3))`.
4. **`_carveCorridor(a, b)`** — from center to center; roll: < 0.35 horizontal-then-vertical L; < 0.7 vertical-then-horizontal L; else Z (H-V-H through a midpoint ±1). `_carveH`/`_carveV` only flip `empty` cells to `corridor` (metadata `{type:'corridor'}`) — overlaps with existing paths are harmless.
5. **`_addDeadEnds()`** — `0..DEAD_END_MAX` stubs: pick a random corridor cell, extend 1–2 cells in a random cardinal direction if all target cells are still `empty` (≤ 50 attempts).
6. **`_designateEntranceAndExit()`** —
   - Entrance: the room with minimum `cx + cz` (nearest top-left); entrance cell = its center cell.
   - Exit: BFS over non-empty cells from the entrance; the exit cell = the LAST room cell reached at maximum distance.
7. Output contract: `{ grid, metadata, rooms, gridSize, cellSize, entranceCell, exitCell }`.

### 5.3 Room type catalog
Base weights (relative; picked with weight / total eligible weight):

| Room | Base weight | Size (cells) | Gameplay notes |
|---|---|---|---|
| CHAMBER | 40 | 2–3 × 2–3 | generic room |
| HALL | 35 | 1–2 × 1 | connector |
| VAULT | 25 | 3–4 × 3–4 | treasure room, water puddle |
| ARMORY | 10 | 3 × 3 | weapon racks + breakables |
| LIBRARY | 10 | 3 × 3 | bookshelves; Skeleton-only enemies |
| CRYPT | 10 | 2–3 × 2–3 | sarcophagi (interactive) |
| MUSHROOM_GROVE | 8 | 2–3 × 2–3 | mushroom clusters; rats +50% |
| ARENA | 6 | 4 × 4 | combat setpiece: +2 spawn slots, first spawn roll guaranteed elite |
| CRYSTAL_CHAMBER | 8 | 2–3 × 2–3 | signature room of CRYSTAL_DEPTHS |
| TEMPLE | 8 | 3 × 3 | signature room of GOLDEN_TEMPLE |

**Eligibility** (room → biomes, `'all'` = every biome): CHAMBER/HALL/VAULT/ARENA = all; ARMORY = STONE, VOLCANIC_DEPTHS, GOLDEN_TEMPLE, EMBER_FORGE; LIBRARY = STONE, HAUNTED_CRYPT; CRYPT = HAUNTED_CRYPT; MUSHROOM_GROVE = FUNGAL_CAVERN, POISON_SWAMP; CRYSTAL_CHAMBER = CRYSTAL_DEPTHS; TEMPLE = GOLDEN_TEMPLE.

**Room-weight modifiers per biome** (multiplier on base weight, 0 excludes):

| Biome | Modifiers |
|---|---|
| STONE | — |
| HAUNTED_CRYPT | CRYPT ×3, LIBRARY ×1.5, ARMORY ×0.5 |
| FUNGAL_CAVERN | MUSHROOM_GROVE ×3, VAULT ×0.7 |
| VOLCANIC_DEPTHS | ARMORY ×2, CHAMBER ×0.8 |
| FROZEN_HALLS | VAULT ×1.5, CHAMBER ×1.2, MUSHROOM_GROVE ×0 |
| CRYSTAL_DEPTHS | CRYSTAL_CHAMBER ×3, VAULT ×1.2 |
| POISON_SWAMP | MUSHROOM_GROVE ×2.5, VAULT ×0.5 |
| GOLDEN_TEMPLE | TEMPLE ×3, VAULT ×2, ARMORY ×1.5 |
| FLOODED_RUINS | VAULT ×1.5, CHAMBER ×1.2 |
| EMBER_FORGE | ARMORY ×2.5, VAULT ×0.7 |

Per-biome eligible-weight sum must stay ≥ 100 (design invariant, verified by the check suite).

**Room enemy modifiers** (multiplier on spawn weights inside that room type): ARMORY = { ARMORED ×1.3, ARCHER ×1.2 }; LIBRARY = { SKELETON ×1, all others ×0 }; CRYPT = { WRAITH ×1.4, SKELETON ×1.2 }; MUSHROOM_GROVE = { RAT ×1.5 }; TEMPLE = { ARMORED ×1.2 }.

### 5.4 World geometry build (WorldBuilder)
- **Floors**: ONE InstancedMesh over all non-empty cells (plane per cell, rotX −π/2, y 0) — one draw call.
- **Ceilings**: ONE InstancedMesh (planes at y = WALL_HEIGHT, rotX +π/2).
- **Walls**: per non-empty cell, for each exposed edge (grid boundary or `empty` neighbor) one `BoxGeometry(cell, 20, 0.3)` (rotated for east/west). Wall meshes are `castShadow/receiveShadow = true`.
- **Collision boxes**: one AABB per wall segment, but with **thickness × 0.6** (0.18 u effective) — deliberately thinner than the visual for forgiving gameplay. Prop collision AABBs (pillars, bookshelves, sarcophagi) are appended AFTER walls, BEFORE enemy spawn, so pathing respects them.
- **Floor debris**: ONE InstancedMesh of small pebbles (≈ 1 per cell, ~80% cut) — single draw call.
- Materials use the biome texture set (RepeatWrapping, repeat ×2).

---

## 6. Collision & movement model (technical)

Two shared functions in `Collision.js` (used identically by player, enemies, projectiles):

- `circleHitsBox(boxes, x, z, radius)` → true if any AABB's closest point to (x, z) is within radius.
- `resolveCircleCollisions(boxes, pos, radius)` → for each box, push the circle out along the closest-point normal by the overlap.

**Radii**: player 0.35; melee/ground enemies 0.35; boss 0.9; player orbs 0.3; LOS probes 0.25.

**Sub-stepped movement (anti-tunneling, binding)**: every mover (player, chasing/fleeing enemies, BURN, wraith, rats) advances in slivers of at most **0.08 u**, resolving collisions after every sliver. A large dt (level-loading hitch) can never tunnel an actor through a wall.

**Player movement**: forward/right vectors from yaw; accumulate WASD; normalize; speed = 4 × sprintMult × buffMult × dt; sub-step; exit-room detection = distance² < 4 from the exit cell center (2 u radius).

**Line of sight** (enemies, hunter): 2D ray march from actor to player in 0.4 u steps, `circleHitsBox(..., 0.25)` → blocked. Used to gate ranged attacks, pursuit, and hunter targeting.

**Pathing**: greedy 4-neighbor step toward the player's CELL — pick the adjacent non-empty cell whose center minimizes distance² to the player's cell, skipping cells whose centers collide; re-evaluate every 300 ms. Used when LOS is blocked.

---

## 7. Biomes

Cyclic ladder, 2 levels per biome: `biomeIndex = floor((level−1) / 2) % 10` over the sequence, EXCEPT boss levels (every 7th) which use SPECTRAL_COURT:

```
SEQUENCE = [STONE, HAUNTED_CRYPT, FUNGAL_CAVERN, VOLCANIC_DEPTHS, FROZEN_HALLS,
            CRYSTAL_DEPTHS, POISON_SWAMP, GOLDEN_TEMPLE, FLOODED_RUINS, EMBER_FORGE]
```

Levels 1–2 STONE, 3–4 HAUNTED_CRYPT, 5–6 FUNGAL_CAVERN, 7 boss, 8 VOLCANIC_DEPTHS, 9–10 FROZEN_HALLS, 11–12 CRYSTAL_DEPTHS, 13 POISON_SWAMP, 14 boss, 15–16 GOLDEN_TEMPLE, 17–18 FLOODED_RUINS, 19–20 EMBER_FORGE, 21 boss, 22 STONE (cycle restarts)…

**Difficulty never resets** on biome change. A biome is fixed for the whole level (applied at level build, never mid-level). `biomeForLevel(level)` = boss branch first, else `SEQUENCE[floor((level−1)/2) % 10]`.

### 7.1 Biome data model (the schema each biome entry must have)
```js
BIOMES[id] = {
  wall, floor, ceiling, fog, fogDensity, ambient, ambientIntensity,  // palette (GRAPHICS — free)
  torchColor, label,                                                  // label = display name (binding text)
  torchMode: 'standard' | 'vaultOnly',                                // BINDING (gameplay/lighting)
  brazierRooms: ['HALL'] (GOLDEN_TEMPLE: ['HALL','TEMPLE']),          // BINDING
}
```
Plus, outside the entry: `ENEMY_SPAWN_WEIGHTS[id]` (7 numbers, sum 100), `BIOME_ROOM_MODIFIERS[id]`, prop-set membership. `LIGHT_CEILING` guards the light budget (§22).

### 7.2 Biome identity (what the player experiences — visuals are the implementer's choice)

| # | Biome | Identity |
|---|---|---|
| 1 | STONE | classic stone dungeon, torchlit |
| 2 | HAUNTED_CRYPT | cold crypt, sarcophagi, wisps; wraith-heavy |
| 3 | FUNGAL_CAVERN | bioluminescent mushroom cavern; torchless (lit by glowing fungi) |
| 4 | VOLCANIC_DEPTHS | lava pools everywhere; armored + brute heavy |
| 5 | FROZEN_HALLS | ice-blue halls, ice crystal lamps, archers |
| 6 | CRYSTAL_DEPTHS | violet crystal cavern, crystal clusters |
| 7 | POISON_SWAMP | toxic marsh; torchless, acid pools, rat swarms |
| 8 | GOLDEN_TEMPLE | sand/gold shrine halls, altars, braziers, armored guards |
| 9 | FLOODED_RUINS | teal waterlogged ruins, aqua wisps, rats |
| 10 | EMBER_FORGE | charcoal smithy, lava pools reused, brutes |
| B | SPECTRAL_COURT | boss arena biome |

### 7.3 Per-biome rules (binding, gameplay-relevant)
- **Torch mode**: `'standard'` = torches on every exposed grid edge; `'vaultOnly'` = torches ONLY inside VAULT rooms. `vaultOnly`: FUNGAL_CAVERN, POISON_SWAMP (lit by their own glow sources).
- **Braziers**: one lit brazier per room of `brazierRooms` — `['HALL']` for every biome except GOLDEN_TEMPLE (`['HALL','TEMPLE']`).
- **Hazards**: lava pools (1–2/room) in VOLCANIC_DEPTHS and EMBER_FORGE (identical lava rules); acid pools (1–2/room) in POISON_SWAMP. Both: within 1.2 u of pool center → 1 damage per 0.8 s tick (i-frames respected). Pools never within 3 u of the exit marker.
- **Wisps**: 1–2 per CRYPT room in HAUNTED_CRYPT; exactly 1 per room (aqua) in FLOODED_RUINS. Patrol radius 2 u at y 1.2 around the room center, bounce at room bounds.
- **Mushrooms**: ~6 clusters per MUSHROOM_GROVE, ~2 per other room in FUNGAL_CAVERN (weight-5 pool); toxic variant in POISON_SWAMP (weight 4). Each cluster emits a green point light (`LIGHT_SOURCES.MUSHROOM`: 3.2, dist 12, decay 1.2, no shadow) — the torchless caverns are lit by their own glow.
- **Crystal lamps**: 1 cluster per room in CRYSTAL_DEPTHS; 2 clusters per room in FROZEN_HALLS.
- **Spawn weights**: per-biome enemy mix (§16.4). Wraiths are crypt-exclusive (weight 0 elsewhere). Brutes peak in EMBER_FORGE (35) — the last rung of the cycle is the danger rung.
- **Light budget invariant** (§22): every biome's per-level point-light count must stay ≤ the heaviest existing biome (avg 154 / max 199 measured), verified by the probe.

---

## 8. Player mechanics

### 8.1 Movement
- Base speed 4 u/s; sprint ×1.55 (FOV +8 while sprinting).
- **Sprint acceleration**: holding Shift + moving for `SPRINT_ACCEL_WINDOW = 1` consecutive second grants `SPRINT_ACCEL_STEP = +5%` sprint speed per tier, cumulative, stacking multiplicatively on the 1.55 base; **capped at `SPRINT_ACCEL_MAX = ×3`** (the HUD readout is the accel component; an endless sprint can never exceed ×3); resets to 0 the moment sprinting stops (or during safe spawn).
- Sub-stepped movement + circle collision (§6). Camera: pointer-locked, pitch clamp ±85°, sensitivity 0.002.
- **Safe spawn**: 5 s rooted + invincible at level start, with visible countdown; mobs don't track or attack during it.

### 8.2 Health
- Max health 3, +1 permanent heart per boss kill.
- Damage: any hit sets `invulnTimer = 0.8 s`; damage ignored while invulnerable. Hit → damage flash + shake (0.25 s) + regen clock reset.
- **Passive regen**: starts immediately (no delay — `REGEN_DELAY = 0`), +1 heart every 5 s, capped at max.
- **Health pickups**: 15% per kill; pickup ADDS `DROP.HEALTH_RESTORE = 3` hearts, capped at max (never a flat set — permanent hearts are kept).

---

## 9. Combat — the sword

### 9.1 Combo
Right-click (edge-triggered) starts/extends a 3-step combo. State machine in `PlayerSword`: windup → slash → recover → (window) → next step, with a final cooldown. One damage application per strike, hitting ALL enemies in the cone (multi-hit), breakables, and enemy projectiles in the swing path.

| Step | Windup | Swing | Recover | Damage | Arc (cone half-angle) | Notes |
|---|---|---|---|---|---|---|
| 1 | 0.10 s | 0.16 s | 0.14 s | 2 | ±68° (0.38π) | diagonal slash |
| 2 | 0.08 s | 0.15 s | 0.14 s | 2 | ±68° (0.38π) | opposite diagonal |
| 3 | 0.12 s | 0.18 s | 0.20 s | 3 | ±16° (0.09π) | piercing thrust, range ×1.25 |

Combo window: 0.34 s from each recover start (0.14 recover + 0.20 input grace); a press inside it (or buffered) chains. Cooldown between combos: 0.30 s. Attack-speed multipliers (buffs) scale the duration fields only, never damage/arcs.

### 9.2 Formulas
- Base damage per step (tier 0): 2 / 2 / 3.
- `swordHitDamage(step, tier) = base + tier` (pure function; tier 5 → 7 / 7 / 8).
- Applied: `currentDamage = swordHitDamage(step, tier) × damageMult`, `damageMult = 1 + (scale − 1) × 0.5`.
- Range: `SWORD.RANGE (2.2) × scale × (1 + 0.04 × tier)`; thrust ×1.25.
- Scale: `min(orbPowerMultiplier(orbs) × lengthMult, 5.0)`; `orbPowerMultiplier = 1 + min(floor(orbs/10), 15) × 0.2` (+20%/10 orbs, cap ×4 at 150). The same multiplier drives spawns (§16.1).
- Hit-stop 0.06 s on any sword hit. Blade flash 0.1 s.
- The swing also: hits breakables in a slightly looser cone (±(maxDot−0.12)) over the full reach; breaks enemy projectiles in the cone (`breakProjectiles`).

### 9.3 Evolution (the Souls Ladder)
`collectedOrbs` IS the souls counter (orbs = souls — ONE notion). Every orb pickup increments it; spending ammo lowers it, but the weapon tier LOCKS at the max reached (`weaponTier` only ever raises). NG+ keeps 90% of the counter (flat 10% toll) and keeps the tier. A fresh run resets both.

- Tier: exponential thresholds — **T1=100, T2=200, T3=400, T4=800, T5=1600** souls (`EVOLUTION.TIER_THRESHOLDS`, each tier doubles the previous — user ruling), evaluated as a ceiling — once reached, never reverts. Every tier: **+1 damage per hit** and a NEW weapon form (silhouette, color identity — see table). Strictly cumulative; never reverts.

| Tier | Souls | Form identity | Damage | Effects |
|---|---|---|---|---|
| 0 | 0–99 | crude executioner's blade | 2/2/3 | 1% legendary electric proc |
| 1 | 100–199 | proper knight's arming sword (crossguard) | 3/3/4 | — |
| 2 | 200–399 | runic greatsword (glowing runes) | 4/4/5 | — |
| 3 | 400–799 | crystal soulblade (faceted crystal) | 5/5/6 | arc bolt 10% per landing strike |
| 4 | 800–1599 | white-hot soulfire greatblade | 6/6/7 | arc bolt 35% per strike |
| 5 | 1600+ | lightsaber throwing electric arcs | 7/7/8 | 2 arc bolts on EVERY landing strike + idle crackle |

- **Range**: +4% reach per tier, stacked on the orb ladder.
- **Electric proc** (all tiers): on any landing strike, 1% chance to chain a blast killing every enemy within 20 u (shake + hit-stop 0.12 s + message). Can co-fire with arc bolts.
- **Arc bolts** (tiers 3–5): pooled homing projectiles (pool 8; max 6 in flight). On a landing strike, roll `ARC_CHANCE[tier]`; spawn `ARC_BOLTS[tier]` bolts aimed at the nearest ALIVE enemy within 20 u; 24 u/s, life 1.2 s, re-target on target death, flat 1 damage on impact, fizzle at life end. Enemies only.
- **Evolution feedback**: toast (`Your blade awakens — Tier N`; final `Your blade is whole — the lightsaber sings`), blade flash, 0.1 s non-blocking hit-stop. Form rebuilt on level start from the stored tier.
- **Form constraints** (binding taste): blades straight (no bends); weapon floats (no hands); never lit by the headlight (self-lit, layer 2); no shadow casting. Tier 5 adds exactly ONE extra camera-attached point light (budget §22). Blade color identity stops following the orb-size color ladder at tier 3+ (the form owns its look); the orb ladder keeps driving size/range only.

---

## 10. Combat — the orb weapon

One collected orb = ONE 3-step sequence; ONE click = ONE step (each aimed at the click-time camera direction).

- **Sequence**: steps 1–2 are normal orbs (bounce up to 3 times off floor/ceiling/walls, reflecting off the dominant axis, then fizzle on the next surface contact); step 3 is explosive and detonates on its FIRST contact with anything (floor, ceiling, wall, prop, enemy, or life end).
- **Ammo**: only the FIRST step of a NEW sequence costs 1 orb; steps 2–3 of an open sequence are free. 0 orbs → "No orbs!" message. Hold LMB steps every `STEP_INTERVAL = 0.22 s`. Sequence expires after `SEQUENCE_WINDOW = 1.2 s` without a step.
- **Projectile**: speed 12.4 u/s, lifetime 2.5 s, radius 0.3; direct-hit damage = `round(2 × orbDamageMultiplier(orbs))`, `orbDamageMultiplier = 1 + 0.02 × orbs` (base damage 2, doubled from 1).
- **Explosion** (step 3): AOE `round(2 × orbDamageMultiplier)` to every enemy within `EXPLODE_RADIUS = 1.5` u (only if blast y < 2.6).
- **Breakables**: orb hits break breakables (and continue). Enemy projectiles are NOT broken by orbs (sword only).
- Pooled (48 normal + 6 fireball slots), zero per-shot allocation. Fireball slots carry NO shot-trace smear sprite and use reduced emissive (2.2) + shorter explosion rings (0.22 s) — the FIREBALL buff was the laggiest one, these cuts keep it cheap while held-spamming.

**Fireball (FIREBALL buff)**: RMB hurls a free fiery projectile exploding on first contact (same explosion rules, no ammo cost, `FIREBALL_COOLDOWN = 0.35 s` while held). The sword is hidden while active.

---

## 11. Combat — temporary buffs

One buff at a time; picking a new one REPLACES the current, and the roll NEVER repeats the active effect.

| # | Buff | Duration | Effect |
|---|---|---|---|
| 1 | BRIGHT | 60 s (cap 90) | level lights up (ambient ×2.5, fog density ×0.35); ALL enemies flee (no attacks) |
| 2 | FIREBALL | 60 s (cap 90) | RMB = free explosive fireball (0.35 s cooldown) |
| 3 | EMPOWERED | 60 s (cap 90) | sword +50% longer, move +20%, attack speed +20% |
| 4 | GODSPEED | 60 s (cap 90) | attack speed +50% AND move speed +50% |
| 5 | HUNTER | 60 s (cap 90) | spectral companion follows and lashes enemies (below) |

- **Sources**: breaking breakables rolls `BUFF.CHANCE = 6%` per break, +0.05% per orb above 100, and drops `BUFF.ORB_DROP_MIN..MAX = 1..5` soul orbs on `BUFF.ORB_DROP_CHANCE = 20%` of breaks. Boss kills grant `BUFF.BOSS_DURATION = 300 s` (5 min), NOT capped by the 90 s ceiling.
- **Cap rule**: breakable buffs hard-capped at `BUFF.MAX_DURATION = 90 s`; boss-kill buffs uncapped.
- **Level carry**: an active buff carries to the next level at ×5 remaining time (capped 90 s). Never across death/restart.
- **HUNTER companion**: HP 9999 (invulnerable), follows at 6.5 u/s keeping 2.5 u, attacks the nearest VISIBLE enemy within 7 u with a 2-damage beam; interval `1.0 / clamp(collectedOrbs/100, 0.25, 5)` (more orbs = faster); beam flash 0.35 s.

---

## 12. Rendering pipeline & post-processing (technical)

### 12.1 Renderer & scene
- `WebGLRenderer({antialias: true})`; `toneMapping = ACESFilmicToneMapping`, exposure 1.0; `shadowMap = PCFSoftShadowMap`; `outputColorSpace = SRGBColorSpace`; `pixelRatio = min(devicePixelRatio, 2)`; resize handler.
- Camera: FOV 90 (was 75 — +20% wider), near 0.1, far 160. `scene.background` = biome fog color; `scene.fog = FogExp2(fog, fogDensity)`.
- **Camera layers (binding design)**: layer 0 = world + headlight; layer 1 = enemy-glow pass (enemy meshes opt-in via `setEnemyTargets`); layer 2 = first-person sword. The camera has layers 0+2 enabled. The headlight (layer 0, camera-attached, no shadow) therefore NEVER lights the sword — the sword is self-lit.
- **Shadows**: only the 8 torches nearest the player cast shadows (`TORCH_SHADOW_COUNT = 8`), map 256², near 0.5, far 11, bias −0.005, normalBias 0.02; nearest-8 re-evaluated every 0.5 s. Every other light `castShadow = false` forever.

### 12.2 Post-processing (EffectComposer)
Pipeline order (binding structure; the exact pass parameters are "~5% of the old look" — treat the numbers below as the binding values):
1. `RenderPass`
2. `UnrealBloomPass(resolution, 0.055, 0.5, 0.5)` — the "5%" rule: a barely-there glow, no ghosting.
3. `ShaderPass(HueSaturationShader)` with `saturation = 0.0175`.
4. `ShaderPass(EnemyGlowShader)` — final composite adding the enemy highlight.

**Enemy highlight pipeline** (technical): a clone camera with `layers.set(1)`; enemy meshes are marked onto layer 1 (idempotent, unmarked when dead); each frame: render the scene with `overrideMaterial` (flat red-orange) to a HALF-RES render target → separable 5-tap gaussian blur (weights 0.227/0.194/0.121, horizontal then vertical ping-pong) → the composite pass adds `(blur × 1.6 × uPulse + sharp × 0.5) × uIntensity` to the scene. `uPulse = 0.75 + 0.25·sin(now·0.003)`; `uIntensity = min(1, base × 0.05)` with distance fade `far = clamp((d − 1.2) / 4.5, 0.15, 1)` — enemies glow when FAR (small), fade as they close. (A legacy x-ray variant exists in the code but no current buff drives it — it may be omitted.)
- `render()`: composer when `enabled || xray`, else direct `renderer.render`. `toggle()` via P; **default ON**.

---

## 13. Pooling, instancing & zero-allocation contract (technical)

**Binding rule: zero per-frame allocations.** Every transient effect is pre-allocated and round-robin reused; nothing is `new`'d in hot paths.

| Pool | Size | Notes |
|---|---|---|
| Player orb projectiles | 48 | + 10 fireball slots (separate slot pool, round-robin filtered by type) |
| Explosion rings (orb / fireball) | 8 / 6 | additive torus rings |
| Arc bolts (sword T3+) | 8 | homing |
| Enemy arrows | 10 | archer |
| Enemy orbs | 12 | magician |
| Pickup rings | 8 | TTL 0.45 s |
| Death bursts | 3 | purple particles |
| Sword sparks | 1 | impact |
| Sword trail sprites | 1 per pool × 3 pools | slash1/slash2/thrust |
| Sword smoke | 1 | dark wrap |
| Blade crackle (T5) | 3 | |
| Fire patches (magic) | 6 | TTL 10 s |
| Brute shockwaves | 4 | TTL 0.25 s |
| Smoke particles | 9 | GPU Points, shared geometry |
| Ambient dust | 30 | GPU Points |
| Stalactites (instanced) | 60 | |
| Water pools (instanced) | 24 | |

**InstancedMesh usage (binding)**: floors (1 mesh, all cells), ceilings (1), floor debris (1), stalactites (1), water pools (1), skull piles, books — every repeated decorative is ONE InstancedMesh per type per level with matrices set at placement; `instanceMatrix.needsUpdate` only on placement. Breakables are individual meshes (≤ 3/room).

---

## 14. Memory lifecycle (technical)

- **Per-level teardown** (`_teardownLevel`): dispose hunter, orbs, runes, particles, lighting, props, smoke, skeletons, shooter; null arc bolts; dispose water-puddle geometry/materials; then `_disposeScene()`.
- **`_disposeScene()`**: detach the camera (with its children: sword, headlight, fireball — they survive), traverse the scene disposing every geometry and material (texture maps disposed UNLESS `userData.biomeCached`), `scene.clear()`, re-attach the camera.
- **What survives level regens**: camera + sword + headlight + held fireball (camera children), the BiomeSystem texture cache (lazy per-biome, `biomeCached` markers), the EventBus, the Leaderboard, and the carried GameState fields.
- **Dispose contract**: every system/entity class implements `dispose()`; materials are tracked in arrays and disposed; pooled geometries/materials disposed once. Known leak fixes are part of the contract (torch lights AND ambient are removed from the scene on dispose; material disposal guards against double-dispose).
- **Async loader** (§4.3) yields one frame between teardown and each build phase so GC reclaims memory and the browser stays responsive; memory must be stable over 3 descends (verified).

---

## 15. Procedural content systems (technical)

- **Textures.js**: Canvas-2D generators — `generateStoneWallTexture(size, tint)` (staggered bricks, mortar, cracks), `generateFloorTexture(size, tint)` (flagstones, grout, scratches), `generateCeilingTexture` (rough patches), `generateRuneTexture(char, color)` (glow + symbol), `generateGlowTexture()` (radial soft sprite). Tints are mixed toward a hex via `mixHex` (0.35 amount). Wall/floor textures are `RepeatWrapping`, repeat ×2. Sizes: 256 for surfaces, 64 for glow/runes.
- **Materials.js**: seeded material factories (`makeBone/Metal/Cloth/Leather/Hide/Stone/Wood`) producing fresh `MeshStandardMaterial`s sharing cached procedural normal maps (styles: `grain`, `stripes`, `pits`) and roughness maps (ImageData-based, Sobel-style height→tangent-space normal, seeded mulberry32 so a key always yields the same map; cached by `style:seed:strength`). `makeBasic/makeGlow/makeSpriteGlow` for unlit/emissive uses. **Headless shim**: all factories must degrade to map-less materials when the canvas `imageData` API is absent (the check scripts stub the canvas) — `canvasCapable()` gates map generation.
- **Enemy rig**: procedural skeleton rig — named bone parts (`root, ribcage, head, armL/R, forearmL/R, legL/R, shinL/R`) with pose keyframes driven by a state machine (DORMANT/WAKING/CHASE/ATTACK/DEAD). Death: hold then fade (materials are transparent by construction, §15), then dispose. Grounding: after positioning, `group.position.y = −Box3.min.y` so feet rest on y 0.

---

## 16. Enemies & spawning

### 16.1 Spawn system
Per level (non-boss): compute slots and build a spawn PLAN (cheap data) then reveal one mob every `SPAWN_INTERVAL = 0.5 s` (first reveals immediately) so construction is spread out. A queued spawn within 30 m of the player is deferred (rotates to the back of the queue). While the title screen holds, spawns still drain but mobs are frozen (`frozen` flag); during safe spawn they idle. Mobs > 40 m from the player are frozen immobile (`FROZEN_DIST`).

- **Slots**: `min(round((2 + (level − 1)) × spawnMult), MAX_ALIVE 200)`; +2 if an ARENA is present. `spawnMult = min(1 + (level + souls)/10, ×100)` — level AND banked souls accelerate spawns, CAPPED at ×100 (`SPAWN_CAP`); past the cap, pressure feeds enemy HP at +100% per 10 excess points (the overflow rule). **Spawns only occur more than 30 m from the player** (`SPAWN_PLAYER_DIST`): a queued spawn whose spot is too close rotates to the back of the queue until the player moves away — nothing materializes next to you.
- **Candidate cells**: non-empty cells at BFS distance ≥ 6 from the entrance, EXCLUDING the exit room; shuffled.
- **Far-frozen bodies**: mobs more than 40 m from the player are IMMOBILE (`FROZEN_DIST` — idle in place, no AI/tracking/attacks), which makes the 200-body cap affordable (distant mobs cost almost nothing per frame).
- **Type pick**: biome weight column × room-enemy modifiers, weighted sample.
- **Rats**: a RAT roll spawns a pack of 2–3 at one cell (clamped to rat cap 6 and live-body cap), each rat a separate body; 0 drops.
- **Elites**: 1-in-10 per non-rat spawn for eligible types (ARMORED, ARCHER, BRUTE, WRAITH). ARENA: first spawn roll guaranteed elite if eligible.
- **Scaling** (all enemies):
  - `speedMult = (1 + 0.05 × (level − 1)) × (1 + 0.1 × bossKills)`
  - `attackMult = (1 + 0.05 × floor((level − 1)/3)) × (1 + 0.1 × bossKills)`
  - HP: `ceil(hp × (1 + ngPlus))`.
- **Live-body cap**: 16 total (rats individually).
- **Boss levels**: skip the plan; ONE boss at the exit cell (§17). **BURN** (§18) spawns later.

### 16.2 Shared AI
- States: DORMANT → WAKING → CHASE → ATTACK → DEAD (simplified for boss/rat/burn).
- Chase: move toward player when LOS; greedy 4-neighbor step when blocked (300 ms re-eval); all movement sub-stepped (0.08 u) + circle collisions (0.35).
- Attack: in range + cooldown ready → windup/swing/recover; hit lands at swing progress ≥ 0.35 via `onAttackHit` (melee damage respects i-frames; ranged types fire projectiles instead). Cooldown set at cycle end.
- Death: corpse → fade → dispose; on death: drop orbs, 15% health drop, purple burst.
- **Flee (BRIGHT)**: all enemies run away at scaled speed, no attacks.
- **Boss/BURN**: gated by safe spawn like everything else.

### 16.3 Roster (base stats; seconds)

| Enemy | HP | Speed | DMG | Range | Cycle (w/s/r/cd) | Behavior notes | Drops |
|---|---|---|---|---|---|---|---|
| Skeleton | 2 | 2.6 | 1 | 1.6 | 0.35/0.25/0.4/1.2 | melee, no elite | 1 |
| Magician | 2 | 2.6 | 1 | cast 9 | same cycle | red orb 6.2 u/s, life 4, radius 0.3, 1 dmg; stops at 0.6×cast range; no elite | 1 |
| Armored Skeleton | 5 | 1.8 | 2 | 0.85 (÷2 from 1.7) | 0.5/0.3/0.5/1.6 | tank; no block (armor = HP) | 2 |
| Archer Skeleton | 2 | 2.4 | 1 | 10 | 0.5/0.1/0.4/1.8 | kites (stop 8 u, retreat under 4 u at 2.0 u/s); arrow 8 u/s, life 3, radius 0.15; needs LOS | 1 |
| Rat (pack) | 1 | 4.2 | 1 | 0.9 | instant/0.8 | packs 2–3; straight chase (greedy when blocked); no elite; 0 drops | 0 |
| Brute | 8 | 1.2 | 3 | 2.4 | 1.2/0.3/1.2/2.5 | slam ±50° cone (0.87 rad), damage 3 (one-shot); slow | 3 |
| Wraith | 2 | 2.4 | 1 | 0.9 | instant/1.0 | PHASES through walls — straight flight, no pathing/LOS, cannot be blocked | 2 |

**Elites** (1-in-10):

| Base | Elite name | HP | Speed | Drops | Notes |
|---|---|---|---|---|---|
| Armored | Warlord | 10 | ×1.3 | 3 | |
| Archer | Sharpshooter | 2 | — | 2 | 2-arrow fan (±8°) |
| Brute | Ogre | 16 | ×1.2 | 4 | scale ×1.9 |
| Wraith | Banshee | 4 | ×1.4 | 3 | |

### 16.4 Spawn weights per biome (sum 100; Skeleton, Magician, Armored, Archer, Rat, Brute, Wraith)

| Enemy | STONE | CRYPT | FUNGAL | VOLCANIC | FROZEN | CRYSTAL | POISON | GOLDEN | FLOODED | EMBER |
|---|---|---|---|---|---|---|---|---|---|---|
| Skeleton | 45 | 25 | 30 | 20 | 25 | 30 | 15 | 20 | 20 | 10 |
| Magician | 10 | 10 | 10 | 10 | 10 | 15 | 10 | 10 | 15 | 10 |
| Armored | 15 | 10 | 10 | 25 | 20 | 15 | 10 | 25 | 10 | 25 |
| Archer | 15 | 15 | 5 | 15 | 25 | 20 | 10 | 20 | 15 | 15 |
| Rat | 10 | 5 | 40 | 10 | 10 | 10 | 45 | 10 | 25 | 5 |
| Brute | 5 | 5 | 5 | 20 | 10 | 10 | 10 | 15 | 15 | 35 |
| Wraith | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 16.5 Drops & score
Drop-on-kill: Skeleton 1, Magician 1, Armored 2, Archer 1, Rat 0, Brute 3, Wraith 2, BURN 2, elites base+1. Orbs credit INSTANTLY on drop (`collectedOrbs++` — the single souls counter); the orb visual bobs ~`DROP.VISUAL_LIFE = 1` s then vanishes. Health/buff pickups auto-collect within 1.4 u. 15% health roll per kill. Leaderboard scores souls only.

---

## 17. Boss — the Spectral Lord

Every 7th level; one boss at the exit cell (portal closed until it dies).

- **HP**: `ceil(4 × BOSS.HP_MULT 22.5)` = **90** (15x +50%), scaled by the player's wealth: +25% per 50 souls held (`ceil(90 × (1 + 0.25·floor(souls/50)))` — 100 souls → 135, 300 souls → 225), then NG+ scaling (base × (1 + 3·ngPlus)).
- **Health bar**: a canvas sprite hovers above the boss showing current HP (red bar, drawn each frame; fades out with the death dissipation).
- **Variant**: one of 7 (Skeleton, Armored, Archer, Brute, Wraith, Rat, Magician) — different look/scale/label, identical AI. Labels: BONE LORD / IRON GHOUL / SPECTRAL HUNTER / ASH TITAN / SPECTRAL LORD / VERMIN KING / LICH ARCHMAGE.
- **AI** (states CHASE/CHARGING/DEAD):
  - Drift toward player at 2.2 u/s beyond 2.5 u.
  - **Charge**: off cooldown and within 14 u → telegraph → dash at 14 u/s for 0.9 s along a locked direction; contact within 1.4 u deals 1 (once per charge); cooldown 3.2 s (first charge at ×0.6). Collision radius 0.9.
  - **Summon**: every 6 s, up to 3 projectile-firing wraiths at random candidate cells, cap 6 living summoned wraiths.
- **Defeat**: `bossKills++`, 5-minute uncapped buff, +1 permanent max heart (+1 heal), portal opens, message. Boss bar during the fight (green → amber → red at 50%/25%).

---

## 18. BURN — the final foe

Rises once the ENTIRE level is cleared (no living non-boss enemies, spawn queue drained) — non-boss, non-arena levels. At most one per level.

- HP `ceil(3 × 30 × (1 + ngPlus))` = 90 on NG 0 (boss-tier), then NG+ scaling. Speed 2.6, damage 1, range 1.3, cooldown 1.4 s. Chases straight-line (sub-stepped, collision-resolved — does NOT phase).
- **Ground fire**: while moving, every 0.6 s spawns a fire patch at its position (pooled, visual-only — patches do NOT damage).
- Drops 2 orbs. Dies like any enemy. (The same pooled fire-patch system serves the electric chain blast — visual + light only.)

---

## 19. Economy & pickups

- **Orbs**: only from kills/breakables (drop-on-kill); none placed on the map. Credited INSTANTLY on drop: `collectedOrbs++` — the ONE souls counter (orbs ARE souls; no separate lifetime notion). The orb visual stays ~`DROP.VISUAL_LIFE = 1` s as feedback, then vanishes. `totalOrbs` (per-level count) unused for scoring.
- **Health pickups**: 15% per kill; +3 hearts (capped at max).
- **Buff pickups**: from broken breakables (6% + excess-orb bonus) — see §11. Boss kills grant directly.
- **Breakables** (barrels/crates): HP 1, any damage source breaks (sword arc, orb hit, stepping on them); no orb drops; 6% buff roll per break (+0.05%/orb above 100); debris + smoke; ≤ 3/room. Sarcophagi (interactive): lid opens on first proximity (< 2.5 u), 30% chance to spawn a Wraith, guaranteed 1 orb, one-time.

---

## 20. Difficulty & scaling summary (all binding)

| Source | Effect |
|---|---|
| Level | move speed ×(1 + 0.05(level−1)); attack speed ×(1 + 0.05·floor((level−1)/3)); **mob HP ×(1 + floor(level/10))**; spawn slots +1/level (×spawnMult, cap 200); **spawnMult = min(1 + (level + souls)/10, ×100)**; past ×100, pressure feeds HP (+100%/10 excess) |
| Held orbs | sword scale +20%/10 orbs (cap ×4 at 150); orb damage +2%/orb; orbs > 100 add buff-drop chance |
| Boss kills | +10% mob move AND attack speed each (permanent, multiplicative) |
| NG+ | enemy HP ×(1 + 3·ngPlus) — 100% base + doubled-effect +100% additional (× level/overflow HP bonus above); run restarts at floor(level/2) keeping 25% of souls (heavy 75% toll) + the weapon tier |
| Timer | 180 s/level, ends the run |

---

## 21. HUD & state mapping (state → element; visuals free)

| Element | State it renders |
|---|---|
| SOULS counter (top-right) | `collectedOrbs` — the ONE souls/ammo counter (orbs = souls; no separate lifetime line) |
| Power suffix | sword scale (+% power) |
| Danger glow | 4 screen borders, red edge gradient — in FRONT → bottom, behind → top, right → right, left → left; alpha = min(1, Σ(1/d)/2) over living enemies within 40 m of that sector (additive, no nearest-enemy computation) |
| HP bar + number | `health` / `maxHealth` |
| Level title | `LEVEL n · NG+k — <biome label>` |
| Timer | `180 − levelTime` (m:ss; red under 30 s; NG+ suffix) |
| Combo pips | `sword.comboStep` (0–3) |
| Weapon slot | tier name + effect: `EVOLUTION.TIER_NAMES[weaponTier]` + `TIER n — TIER_EFFECTS[n]` (updates on tier change) |
| Sprint bonus | `sprintSpeedMult` when > 1 |
| Buff badge | `buffEffect` + `buffTime` (hidden when none) |
| Safe-spawn | `safeSpawn` countdown |
| Boss bar | boss `hp/maxHp` + variant label |
| Stats panel | LIVE coefficients: DMG ×, Orb DMG, Orb AOE, Reach, Sword size, Atk speed, Move speed, Enemy HP ×, Mob speed ×, Spawns ×, Regen |
| Perf warning | degraded mode (§22), bottom-right, hidden at start |
| Damage flash | on any player hit |
| Messages | toasts (goal hints, evolution, ELECTRIC CHAIN, boss defeat, …) |
| Prompt | "Click to explore" when pointer unlocked |
| Exit prompt | shown only in exit room AND portal open |
| Leaderboard | Tab / death screen |
| Loading/title | level, biome, buff, stats; fps gate §3 |

Death screen: stats (level reached, total time, souls, rank #) + Restart [N] / New Game+ [Y].

---

## 22. Performance budgets & degraded mode (binding)

Target: fluid gameplay with a **30 fps floor** on mid-range hardware.

- **Lights**: shadow-casting lights = 8 max (nearest-8 torches, re-evaluated every 0.5 s, 256² maps). Total point lights per level must stay ≤ the heaviest existing biome — `LIGHT_CEILING.AVG = 154` average / `MAX = 199` peak (VOLCANIC_DEPTHS and FROZEN_HALLS are the heaviest); torchless biomes (FUNGAL, POISON) keep torch averages ≤ 10 / peaks ≤ 50. All non-torch lights shadow-free.
- **Torch placement**: one torch per exposed grid edge, spacing 16 u, y 2.5; `vaultOnly` biomes place torches only in VAULT rooms.
- **Draw calls ≤ 120**; prop instances ≤ 400/level (repeated decoratives MUST be instanced); breakables ≤ 3/room individual meshes.
- **Pools**: zero per-frame allocation (§13).
- **Textures**: procedural canvas only; ≤ 16 MB (11 biome sets × 3 × 256 px + shared).
- **Degraded mode (perf safeguard)** — if sustained fps < 30 for more than 10 s (EMA of frame rate; hitches > 0.25 s and the title screen excluded):
  1. `reduceDecorations(0.5)` — hide a random 50% of the CURRENT level's purely cosmetic props (rubble, skull piles, blood decals, anvils, chains, candles, ice crystals, mushrooms — lights included) and shed the tail instances of the instanced water/stalactite meshes (count halved).
  2. NEVER touched: hazards, breakables, interactives, structural props, biome light props (crystal clusters, wisps, altars).
  3. Small bottom-right warning label: "DEGRADED MODE — decorations reduced for performance".
  4. Once triggered, the run STAYS degraded — every subsequent level builds at 50% decorative density.

---

## 23. Leaderboard & persistence

localStorage, top 10. Entry `{level, time (total run seconds), orbs (banked at death), ngPlus, date}`. Ranking: NG+ desc → level desc → total time asc → orbs desc. Written on run end only. Panel shows entries with the current run highlighted.

---

## 24. Verification suite (how a re-implementation proves parity)

Headless Node scripts (no browser except the smoke test). The scripts stub `document`/canvas where needed (Materials degrade to map-less materials; generators skip pixel ops) so the whole suite runs in plain Node.

| Command | Expected |
|---|---|
| `node scripts/dungeon-check.mjs 40` | `broken=0/40` |
| `node scripts/biome-check.mjs` | `biome-check: ALL GATES PASS` |
| `node scripts/weapon-check.mjs` | `weapon-check: ALL GATES PASS` |
| `node scripts/biome-light-probe.mjs` | reproduces the §22 measured table (25 seeds) |
| headless browser smoke (CDP) | see below |

**dungeon-check** (algorithm): for each seed, run the generator; mirror WorldBuilder's collision boxes exactly (wall thickness 0.3, collision depth ×0.6, player radius 0.35); sample walkable points on a 0.2 u grid over the dungeon plus a 1-cell margin; BFS from the entrance over walkable samples; count `escapes` (reachable-but-outside-dungeon — a broken wall), `unreachableInside` (dungeon cells not reachable), and `disconnected` (cell-grid 4-connectivity from the entrance); any > 0 marks the seed BROKEN. Also reports avg rooms and avg BFS exit distance.

**biome-check** (11 gates): sequence = 10 biomes; palettes have all 9 keys; the 5 new biomes' palette VALUES match the spec verbatim; spawn-weight columns sum to exactly 100 with 7 entries; every biome has a `BIOME_ROOM_MODIFIERS` entry; eligibility resolves (FLOODED_RUINS exempt from the themed-room rule) and every room type appears somewhere; per-biome eligible room weight ≥ 100; every room type has `PROPS.PROPS_PER_ROOM`; referenced light sources exist; TEMPLE modifier = {ARMORED 1.2}; light probe (default 10 seeds, arg-configurable) — every biome avg ≤ 154 / max ≤ 199, vaultOnly torch avg ≤ 10 / max ≤ 50.

**weapon-check** (12 gates): EVOLUTION block complete + finite; tier math exponential 100/200/400/800/1600 (0/99/100/199/200/399/400/799/800/1599/1600 → 0/0/1/1/2/2/3/3/4/4/5); damage ladder 2/2/3→7/7/8 + brute breakpoint (HP 8 dies in 2 hits at tier 5, armored 5 dies in 1 at tier 3); arc table (lengths = MAX_TIER+1, T5 = 1.0/2, pool ≥ 6); ELECTRIC_CHANCE/RANGE finite + referenced in Game; blade length monotonic 0.76→1.0, TIP_LOCAL = length × 0.79, scale clamp ≥ 4; HUD single SOULS counter (no `#souls-line`, no `#tier-pips`) + all 6 tier icons present; Game.js free of `soulsEarned`; six per-tier form builders + `_formMeshes` registry present; no Torus/TorusKnot geometry in PlayerSword; Game.js writes the single souls counter; dungeon-check 0/40.

**browser smoke** (headless Chromium via raw CDP, Node WebSocket): boot the game against the dev server; wait for level build; assert canvas + WebGL2; HUD ids present (`#orb-count`, `#perf-warning`, `#biome-label`, `#timer`, `#hp-fill`, `#combo-pips`, `#weapon-slot`, `#stats-panel`); single souls label `SOULS`; `#perf-warning` hidden; loading screen passed; timer advances; **zero JS exceptions**.

In-game invariants: memory stable over 3 descends (no leaks — teardown contract §14); camera + sword survive regens; `window.game` exposed for QA.

---

## 25. UX strings (binding)

All player-facing text is part of the game feel and is binding (text is not a graphic element). Exact strings from the reference implementation:

| Context | Text |
|---|---|
| Goal toasts (level start) | `Skeletons hunt you — reach the golden exit!` · `Slay them for orbs — shoot or swing` · `Level ${n} — descend!` (level > 1) · `New Game+ ${n} — the depths grow stronger` · `A new descent begins` |
| Orb pickup | (no toast — the instant-credit SOULS counter + 1 s orb visual are the feedback) |
| No ammo | `No orbs! Slay skeletons to gather orbs` (shown once per dry-fire stretch; resets after a successful shot) |
| Entered exit room | `The depths await — press E to descend` |
| Directional hint | every 8 s: `Golden exit lies ${dir} (${dist}m)` — dist in whole meters; dir from the 8-way compass (atan2 sectors of 45°: north / northeast / east / southeast / south / southwest / west / northwest) |
| Weapon evolution | `Your blade awakens — Tier ${t}` · final tier: `Your blade is whole — the lightsaber sings` |
| Electric chain | `ELECTRIC CHAIN — ${k} foes vaporized!` |
| Boss defeated | `The Spectral Lord falls — a heart and a blessing are yours. The portal opens!` |
| Death titles | `The dead claim you` (killed) · `The darkness consumes you` (time out) |
| Death stats | `Level reached: ${level}${ng} · Total time: ${m}:${ss} · Souls: ${orbs}${rank}` |
| Death buttons | `Restart — Level 1 [N]` · `New Game+ [Y] — Level ${half} (keep ${orbs} Souls · mobs +${10·ng}% HP)` |
| Buff descriptions (title screen) | `No active buff` · `BRIGHT — the level lights up, enemies flee from you` · `FIREBALL — right-click hurls an explosive fireball` · `EMPOWERED — longer reach, faster movement & attacks` · `GODSPEED — +50% attack speed and +50% move speed` · `HUNTER — a spectral boss companion follows and attacks mobs` |
| Perf warning | `⚠ DEGRADED MODE — decorations reduced for performance` |
| HUD hint line | `WASD move · Shift sprint · LMB orb · RMB dagger · E descend · Tab ledger · P bloom` |
| Prompts | `Click to explore` (pointer unlocked) · `The depths beckon further... [E] to descend` (exit prompt) · `[Tab] close` |
| Leaderboard | title `DEPTH LEDGER` · empty `No runs yet — descend!` |
| Biome labels | `STONE DUNGEON`, `HAUNTED CRYPT`, `FUNGAL CAVERN`, `VOLCANIC DEPTHS`, `FROZEN HALLS`, `CRYSTAL DEPTHS`, `POISON SWAMP`, `GOLDEN TEMPLE`, `FLOODED RUINS`, `EMBER FORGE`, `SPECTRAL COURT` |
| Boss variant labels | `BONE LORD`, `IRON GHOUL`, `SPECTRAL HUNTER`, `ASH TITAN`, `SPECTRAL LORD`, `VERMIN KING`, `LICH ARCHMAGE` |
| Loading screen | `LEVEL ${n}${ng}` + biome label + buff description + stats rows (Souls / DMG × / Orb DMG / Reach / Enemy HP / Mob speed / Spawns / Regen) |

---

## 26. Behavioral details & edge cases (binding)

- **Sarcophagus** (CRYPT interactive): triggers on first proximity < 2.5 u; lid slides open over 0.6 s; 30% chance to spawn a Wraith (level-scaled); guaranteed 1 orb drop inside; one-time. Has a collision AABB.
- **Exit portal**: golden ring + disc at the exit cell center, y 1.3; hidden until the boss dies on boss levels (`_bossPortalOpen`); `E` works only when `inExitRoom` (within 2 u of the exit cell center) AND the portal is open.
- **Start/exit markers** (guidance): green ring + light at the entrance; golden ring + glow + vertical beam + light at the exit.
- **God rays**: only in VAULT rooms — one additive light shaft per torch inside a VAULT.
- **Water puddles**: VAULT rooms only, centered plane at y 0.02, with a gentle sine-wave vertex displacement in the update loop (per-frame vertex write, one mesh per VAULT). Decorative only.
- **Step-on-breakables**: walking within 0.45 u of a breakable shatters it (same buff drop roll as a weapon/orb break).
- **Orb explosion height gate**: the AOE only damages enemies when the blast point y < 2.6 (ground-level).
- **Fire patches** (magic-blue from electric chain + BURN ground fire): visual + light ONLY, no damage; TTL 10 s, pool 6, quick grow-in (0.3 s) and end-fade.
- **Lava/acid tick**: 1 damage per 0.8 s within 1.2 u of the pool center; i-frames respected; pools never within 3 u of the exit marker.
- **No-ammo message**: shown once per dry-fire stretch; resets after a successful shot.
- **Hit-stop**: world dt zeroed while active; camera shake, HUD, and input still process.
- **Carried buff**: captured BEFORE the state is replaced; side effects re-applied only AFTER the level systems are rebuilt; when no buff is carried, stuck visuals are cleared (the gone-fireball fix).
- **Rat pack**: one RAT roll spawns a pack of 2–3 rats at one cell; pack size clamps to the rat cap (6) and the live-body cap (200).
- **Elite roll**: 1-in-10 per non-rat spawn, eligible types only; ARENA first spawn roll is guaranteed elite if its type is eligible.
- **BURN**: never on boss or arena levels; spawns at the walkable cell farthest from the player once the level is cleared.
- **Title gate**: lifts only when the rolling ~3 s average fps ≥ 30 AND the spawn queue is drained (spawn-drain prevents the post-title hitch); hard 8 s max-hold so the player is never trapped.
- **Degraded mode**: frame hitches > 0.25 s and the title screen are excluded from the measurement; once degraded, the run stays degraded (§22).

---

## 27. Engineering gotchas & legacy (do not re-introduce, do not chase)

- **Headless shim**: the verification scripts stub `document`/canvas. `Materials.js` gates normal/roughness map generation on `canvasCapable()` (presence of `createImageData`/`putImageData`/`getImageData`) and returns map-less materials otherwise; texture generators only run in a real browser. Preserve this pattern or the check suite cannot run.
- **Electric proc hoist**: the 1% chain was once DEAD CODE because the constants lived nested under `SWORD.COMBO` and the reads at the top level were `undefined`. They now live at the `SWORD` level (`SWORD.ELECTRIC_CHANCE`, `SWORD.ELECTRIC_RANGE`) — keep them there.
- **Carried buff ordering**: capture the buff before replacing `state`; re-apply its side effects AFTER `_initCombat` rebuilds skeletons/lighting; always clear stuck visuals when no buff is carried (this fixed the "fireball stuck on screen + sword hidden while buffEffect = 0" bug).
- **Title gate**: lifting requires BOTH the fps window AND an empty spawn queue — the queue drain is what actually prevents the post-title hitch.
- **Camera layers are load-bearing**: sword on layer 2 (the layer-0 headlight must never light it), enemy-glow pass on layer 1, world on layer 0. Preserve the scheme.
- **Orb pool split**: 48 normal slots + 10 fireball slots; the round-robin allocator MUST filter by slot type so a volley never spawns an orange fireball mid-sequence.
- **Legacy/unused (present but inert — do not build on them)**: `DUNGEON.TORCH_SPACING` (the real spacing is 16, in LightingSystem), `DUNGEON.ARCH_PROBABILITY` / `CRACK_PROBABILITY` (WorldBuilder builds no arches/cracks), the `minimapVisible` flag, the stamina-fill element (the stamina bar was removed; the element is kept pinned at 100%), the post-processing `xray` flag (no buff drives it), `totalOrbs` (per-level count, not scored).
- **`window.game` is exposed** — keep it (the headless QA hook).
- **Perf-cuts philosophy**: many systems carry "~90% cut" comments (smoke 90→9, dust 300→30, trail 4→1 per pool, sparks 4→1, death bursts 30→3, floor debris −80%). These are intentional; do not re-inflate them — the §22 budgets are the contract.

---

## 28. Design rationale & tuning philosophy (why the numbers are what they are)

Use this when tuning or extending — keep the intent, not just the values.

- **Orbs are ammo AND spawn pressure**: the same `orbPowerMultiplier` drives sword scale and enemy spawns; orbs above 100 stop growing the sword (cap ×4) and instead feed buff drops + extra spawns. Hoarding has diminishing returns and escalating risk — that is the game's economy.
- **Souls ladder cap at 500 (tier 5)**: endgame damage 7/7/8 one-hits most of the fixed-HP roster but a brute (8 HP) still takes 2 hits; NG+ HP ×2 keeps the top tier honest. Uncapped damage would trivialize the roster.
- **Total-only souls HUD**: the tier is a feel signal (form + toast), never a number. The HUD shows real state only — no fake meters.
- **Buffs never repeat back-to-back** so every pickup is visibly different; breakable buffs cap at 90 s while boss buffs run 5 min uncapped — rewards scale with the source.
- **Torchless biomes (FUNGAL, POISON)** are both a perf move (≈50 lights vs ≈135 if torchlit) and a theme move (lit by their own glow). When a biome is too heavy, cut structure like this — never lower the light ceiling.
- **EMBER_FORGE Brute weight 35**: the forge is the last rung of the cycle — a deliberate finale pressure band.
- **NG+ keeps 90% of orbs and starts at half the level**: a softer reset that preserves the power fantasy while mobs get +100% HP. The 10% tax is the only death penalty beyond the level reset.
- **Buff carry ×5 (capped 90 s)**: smooths level transitions without letting a 5-minute boss buff trivialize the next level.
- **The 30 fps floor is non-negotiable**: when a feature threatens it, CUT decisively (torchless biomes, density caps, 90% particle cuts, degraded mode). Never lower `LIGHT_CEILING`.
- **Post-processing "5% rule"**: bloom, saturation, and the enemy glow all sit at ~5% of their original strength — atmosphere over spectacle, and ON by default (toggleable with P).
- **Red is reserved for danger**: the idle sword's tint is never red (it would fake an "enemy nearby" signal); red/orange reads as threat everywhere in the game.

---

## 29. Manual QA checklist (human verification beyond the automated scripts)

1. **Boot**: title appears; lifts ≥ 30 fps; safe-spawn counts 5 → 0; zero console errors.
2. **Biome cadence**: levels 1–2 STONE, 3–4 CRYPT, 5–6 FUNGAL, 7 boss, 8 VOLCANIC, 9–10 FROZEN, 11–12 CRYSTAL, 13 POISON, 14 boss, 15–16 GOLDEN, 17–18 FLOODED, 19–20 EMBER, 21 boss, 22 STONE.
3. **Boss levels (7/14/21)**: portal closed until the boss dies; boss bar shows; defeat grants the heart + 5-min buff + opens the portal.
4. **Spawns**: biome weight mixes feel right; wraiths only in crypts; brutes surge in EMBER_FORGE; elites appear ~1-in-10 over a long session; the ARENA's first spawn is elite.
5. **Sword**: combo 2/2/3 → 7/7/8 by tier; T3+ arc bolts; T5 double bolts every strike; the 1% electric chain eventually fires.
6. **Orbs**: steps 2–3 of a sequence are free; step 3 explodes; holding LMB steps at 0.22 s; 0-orbs shows the warning once.
7. **Buffs**: never back-to-back repeats; boss buff 5:00 uncapped; breakable buff ≤ 1:30; carry ×5 across levels; BRIGHT makes everything flee.
8. **Degraded mode**: force low fps (throttling/devtools) → after ~10 s the warning appears and ~half the decorations vanish; the next level builds at 50%.
9. **Memory**: 3 descends with stable RAM/GPU memory; no console warnings.
10. **NG+**: death → [Y] keeps 90% of orbs, starts at half the level, mobs have +100% HP; [N] restarts clean at level 1.
11. **Leaderboard**: entries rank NG+ → level → time → orbs; top 10 persist in localStorage.
12. **Perf invariants**: `renderer.info` — draw calls ≤ 120, prop instances ≤ 400, lights ≤ ceiling, shadow casters = 8.

---

## 30. Explicitly out of scope / non-goals

- **All graphic elements** (deliberate): colors, palette hexes, mesh geometry, prop recipes, particle visuals, post-processing look, HUD styling, textures, audio. Freedom within the identity descriptions and the budgets above. (Binding exceptions: the camera-layer scheme §12.1, the "5%" post-processing rule §12.2, pool sizes, and every budget in §22 — those are engineering, not looks.)
- No audio system (visual cues only).
- No save/continue — single-session runs; only the leaderboard persists.
- No new frameworks/engines/assets — Vite + raw Three.js, procedural canvas only.
- No minimap rendering (`minimapVisible` flag exists but is unused).
- No charged attacks, blocking/parry, or weapon switching — the 3-hit combo is the only sword mode.
- No XP/talents/inventory — progression is orbs, souls, hearts, NG+ only.
- No non-rectangular rooms — grid-based rectangles only.
- No multiplayer/co-op.
