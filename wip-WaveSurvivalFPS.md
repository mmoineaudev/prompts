# Wave Survival FPS — Hybrid Build & Defend (Three.js + Vite)

## Concept

A wave survival game with a hybrid structure: **build phase** (top-down grid trap/turret placement using your tower defense experience) → **combat phase** (first-person shooter defending your base). Each run generates a fresh arena, escalating enemy waves, resource management, and a final siege. Die = lose all carried gear. Survive all waves = extract with loot, spend on permanent upgrades.

Think They Are Billions meets Tower Defense meets Doom, rendered with a clean low-poly 3D aesthetic. The procedural generation creates varied arenas; the hybrid structure gives strategic depth from two perspectives.

## Visual Style

- **Clean low-poly 3D** — flat-shaded geometric shapes with bright, readable colors. Slightly stylized military/outpost aesthetic.
- **Build phase camera**: isometric top-down (angled ~45°), grid-based. Show full arena, placement preview, enemy path indicators.
- **Combat phase camera**: first-person from player position. Weapon viewmodel, muzzle flash, enemy blood/gib particles.
- **Arena**: 30×30 grid of tiles (1 unit each). Terrain: grass/dirt base, spawn zones (red), extraction zone (blue), buildable tiles (highlighted).
- **Traps & turrets**: distinct low-poly silhouettes — turret (rotating barrel on base), spike trap (raised spikes), glue trap (puddle), tesla coil (glowing orb), barricade (wall segment), landmine (disc on ground), flamethrower (nozzle + tank).
- **Enemies**: low-poly creatures with fresnel rim shaders. Distinct shapes per type (grunt = humanoid, runner = quadruped, tank = blob, flyer = winged orb, boss = massive multi-limb).
- **Player**: first-person arms + weapon viewmodel. Visible in build phase as a pawn on the grid.
- **Bloom**: threshold 0.4, strength 0.7 on muzzle flash, tesla arcs, explosion flares, extraction zone glow.
- **Dynamic lighting**: muzzle flash (50ms point light), explosions (flickering light), tesla arcs (continuous light), fire traps (orange ambient), extraction zone (blue beam to sky).

## Tech Stack

- Vite + Three.js (ES modules, `src/` directory)
- PostProcessing via three/addons (EffectComposer, UnrealBloomPass, RenderPass, OutputPass)
- No physics engine — simple AABB/sphere collision, grid-based pathfinding
- All constants in `Constants.js`
- EventBus.js + GameState.js pattern (from game-architecture skill)
- localStorage for meta-progression (with validation + parse-fallback fallback)
- Web Audio API for discrete sound effects (no audio system)

## Controls

### Build Phase (Isometric)

All input uses **event.code** for AZERTY/QWERTY compatibility:

| Action | Key | Notes |
|--------|-----|-------|
| Pan camera | ZQSD | AZERTY-compatible |
| Rotate camera | Q / E keys | Rotate 45° increments |
| Zoom camera | Mouse wheel | Range 15-50 |
| Select trap/turret | Number keys 1-7 | Select build type |
| Place on tile | Left click | On valid buildable tile |
| Remove trap | Right click | Sell at 70% refund |
| Upgrade trap | Middle click | Level up if affordable |
| Start wave | Space | Begin combat phase |
| Pause | Escape | |

### Combat Phase (First-Person)

| Action | AZERTY | QWERTY (equivalent) | Notes |
|--------|--------|---------------------|-------|
| Move forward | Z | W | |
| Move backward | S | S | |
| Strafe left | Q | A | |
| Strafe right | D | D | |
| Aim/look | Mouse movement | Mouse movement | Pointer lock |
| Fire weapon | Left click | Left click | |
| Aim down sights | Right click | Right click | Zooms FOV, reduces sway |
| Reload | R | R | |
| Switch weapon | 1 / 2 | 1 / 2 | Primary / secondary |
| Use consumable | 3 | 3 | Medkit / ammo pack |
| Switch to build mode | B | B | Switch back to build phase (if between waves) |
| Interact | F | F | Pick up items, activate extraction |
| Map overlay | M | M | Toggle minimap zoom |
| Pause | Escape | Escape | |

## Arena Generation

### Structure

The arena is a 30×30 grid (1 unit per tile). Two **spawn zones** (red) on opposite sides funnel enemies toward the **extraction zone** (blue) at center. Player defends the extraction zone.

### Generation algorithm

1. Create 30×30 grid, all tiles default to `buildable`
2. Place extraction zone at center (3×3 tiles, marked `base`)
3. Place two spawn zones at opposite edges (3×3 tiles, marked `spawn`)
4. Generate 2-3 paths from each spawn zone to the extraction zone using A* with random waypoints (enemies follow paths)
5. Mark path tiles as `path` (non-buildable)
6. Scatter 5-10 obstacle tiles (`rock`, non-buildable, non-path)
7. Ensure both spawn zones have valid paths to extraction; regenerate if not

### Tile types

```
GRASS      — buildable, default terrain
PATH       — non-buildable, enemies walk here
ROCK       — non-buildable, obstacle
BASE       — extraction zone, 3×3 at center, non-buildable
SPAWN      — enemy spawn, 3×3 at edges, non-buildable
TRAP       — player-placed trap
TURRET     — player-placed turret
```

## Build Phase Mechanics

### Currency: Scrap

- Start each run with **100 scrap** (base amount, upgradable in meta)
- Earn scrap between waves: **20 scrap + 5 per wave** (e.g., wave 1→2 = 25 scrap, wave 5→6 = 45 scrap)
- Kill bonus: +1 scrap per enemy killed (during combat, added to build budget after wave ends)
- **Scrap does NOT carry between runs** — only extracted loot does

### Traps & Turrets (Buildings)

| Building | Cost | HP | Range | Damage | Effect | Level Up |
|----------|------|----|-------|--------|--------|----------|
| Spike Trap | 15 | 50 | 1 tile | 15 | Melee, triggers when enemy steps on it | +10 dmg, +20 HP |
| Glue Trap | 20 | 30 | 1 tile | 5 | Slows enemy 50% for 3s | +2s slow, +15 HP |
| Barricade | 10 | 150 | — | 0 | Blocks enemy path (enemies attack it) | +50 HP |
| Turret (bullet) | 40 | 40 | 8 | 8 | Fast fire, single target | +4 dmg, +1 range |
| Turret (sniper) | 70 | 30 | 15 | 25 | Slow fire, high damage | +12 dmg, +2 range |
| Tesla Coil | 90 | 50 | 5 | 12 | Chains to 3 nearby enemies | +1 chain, +5 dmg |
| Landmine | 25 | 10 | 1.5 | 40 | AoE 2.5 tiles, one-time use | +15 dmg, +0.5 range |
| Flamethrower | 60 | 45 | 4 | 6/sec | Cone AoE, DOT 2/sec for 3s | +3/sec, +1 range |
| Freeze Ray | 80 | 40 | 6 | 4/sec | Slows 70% + minor damage | +3% slow, +2 dmg |
| Singularity | 150 | 60 | 7 | 0 | Pulls enemies 30% toward center, 3s cooldown | +10% pull, +1 range |

### Building rules

- Max **20 buildings** per run (upgradable in meta)
- Cannot place on path, rock, base, or spawn tiles
- Cannot place on occupied tile
- Level up: max level 3, cost = base × (0.8 + 0.5 × level)
- Sell: 70% refund of total invested (base + upgrades)
- Buildings have HP; enemies attack buildings in their way (barricades block, others get destroyed if enemy reaches them)

### Build phase flow

```
BUILD PHASE (60s timer, or press Space to start early)
  → Place traps/turrets on buildable tiles
  → Upgrade existing buildings
  → Sell unwanted buildings
  → Press Space → start Wave 1

WAVE 1 (combat phase)
  → Enemies spawn, follow paths to extraction zone
  → Player fights in first-person
  → Traps/turrets auto-fire at enemies in range
  → Enemies attack barricades/traps in their path
  → Wave ends when all enemies dead

BUILD PHASE (between waves)
  → Earn scrap (base + wave bonus + kill bonus)
  → Repair buildings (costs scrap, 1 scrap = 10 HP)
  → Rearrange, upgrade, sell
  → Press Space → start Wave 2

... repeat for N waves ...

FINAL WAVE (boss siege)
  → Massive enemy + minions
  → Survive → EXTRACT
```

## Combat Phase Mechanics

### Player weapons

| Weapon | Type | Damage | Fire rate | Range | Mag size | Recoil | Cost (scrap) |
|--------|------|--------|-----------|-------|----------|--------|--------------|
| Pistol | Sidearm | 12 | 4 rpm | 25 | 12 | Low | Free (start) |
| SMG | Auto | 10 | 10 rpm | 20 | 30 | Medium | 30 |
| Shotgun | Auto | 70 (pellets) | 2 rpm | 12 | 6 | High | 50 |
| Rifle | Auto | 22 | 7 rpm | 45 | 25 | High | 70 |
| Sniper | Bolt | 85 | 1 rpm | 80 | 5 | Very high | 100 |
| Minigun | Auto | 8 | 15 rpm | 35 | 100 | Very high | 150 |

### Weapon mods (found in supply drops during combat)

| Mod | Effect | Rarity |
|-----|--------|--------|
| Extended mag | +50% magazine size | Common |
| Suppressor | -30% sound (enemies less likely to target you) | Uncommon |
| Scope | +25% ADS zoom | Common |
| Armor piercing | +20% damage vs armored enemies | Rare |
| Hollow point | +30% damage vs unarmored | Common |
| Laser sight | +15% hipfire accuracy | Uncommon |
| Grenade launcher | Secondary fire: 40mm grenade (50 dmg AoE) | Legendary |

### Player stats

| Stat | Base | Max upgrade |
|------|------|-------------|
| Health | 100 | 150 |
| Armor | 0 (find armor pickups) | 100 |
| Movement speed | 6.0 u/s | 8.0 u/s |
| ADS speed | 0.3s | 0.15s |
| Inventory slots | 6 | 12 |

### Damage model

```
finalDamage = weaponDamage × rangeMultiplier × armorMultiplier × headshotMultiplier
```

- **Range multiplier**: 1.0 at 0 units, 0.5 at max range (linear falloff)
- **Armor multiplier**: armor absorbs 1:1 until depleted, then full health damage
- **Headshot multiplier**: 2.0× (enemies have head hitbox)

### Supply drops

During combat, supply drops spawn at random buildable tiles every 30-45 seconds. Walk over to open:

| Drop type | Contents | Rarity |
|-----------|----------|--------|
| Ammo crate | Full ammo for current weapon | Common |
| Medkit | +40 health | Common |
| Armor plate | +25 armor | Uncommon |
| Weapon mod | Random mod for current weapon | Rare |
| Scrap cache | +20 scrap (added to build budget) | Uncommon |
| Rare weapon | Random weapon from loot table | Legendary |

## Enemy Types

| Type | Shape | HP | Speed | Armor | Dmg | Special | Wave |
|------|-------|----|-------|-------|-----|---------|------|
| Grunt | Humanoid | 20 | 2.5 | 0 | 5 | None | 1+ |
| Runner | Quadruped | 12 | 5.0 | 0 | 3 | Fast, low HP | 1+ |
| Tank | Blob | 80 | 1.2 | 30 | 10 | High armor, slow | 3+ |
| Flyer | Winged orb | 15 | 3.5 | 0 | 4 | Flies (ignores barricades) | 4+ |
| Shielded | Humanoid + shield | 30 | 2.0 | 50 | 6 | Frontal shield blocks 80% dmg | 5+ |
| Exploder | Blob + volatile | 20 | 3.0 | 0 | 30 (AoE) | Explodes on death/contact | 6+ |
| Elite | Heavy + armor | 120 | 1.8 | 60 | 15 | Minigun, high armor | 8+ |
| Boss | Multi-limb titan | 800 | 1.0 | 100 | 40 | Spawns minions, AoE slam | 10 (final) |

### Enemy scaling per wave

```
hpMultiplier = 1 + (wave - 1) × 0.15
speedMultiplier = 1 + (wave - 1) × 0.02
count = 5 + wave × 2
```

### Enemy AI

- Follow path from spawn zone to extraction zone
- Attack barricades/traps blocking their path (melee, 5 dmg/sec)
- If player is within aggro range (10 units) and line-of-sight, some enemies target player instead of base
- Flyers ignore barricades, fly directly to base
- Exploders rush nearest building/player, explode on contact
- Boss: spawns 2 grunts every 15s, AoE slam every 8s (15 dmg in 5 units)

## Wave Structure

### Wave composition

| Wave | Enemies | Special | Scrap reward (base) |
|------|---------|---------|---------------------|
| 1 | 7 grunts | — | 25 |
| 2 | 10 grunts, 3 runners | — | 30 |
| 3 | 8 grunts, 5 runners, 2 tanks | First tanks | 35 |
| 4 | 10 grunts, 6 runners, 2 tanks, 3 flyers | First flyers | 40 |
| 5 | 12 grunts, 8 runners, 3 tanks, 4 flyers, 2 shielded | First shielded | 45 |
| 6 | 14 grunts, 10 runners, 4 tanks, 5 flyers, 3 shielded, 2 exploders | First exploders | 50 |
| 7 | 16 grunts, 12 runners, 5 tanks, 6 flyers, 4 shielded, 3 exploders | — | 55 |
| 8 | 18 grunts, 14 runners, 6 tanks, 7 flyers, 5 shielded, 4 exploders, 2 elites | First elites | 60 |
| 9 | 20 grunts, 16 runners, 7 tanks, 8 flyers, 6 shielded, 5 exploders, 3 elites | — | 65 |
| 10 (final) | Boss + 10 grunts, 5 runners, 3 tanks | BOSS SIEGE | 100 + extraction |

### Build phase timer

- **60 seconds** between waves (or press Space to start early)
- Timer shown in center-top of screen
- If timer expires, wave starts automatically

### Combat phase duration

- Wave ends when all enemies are dead
- If extraction zone HP reaches 0 → game over
- Extraction zone has **100 HP** (base), enemies that reach it deal 5 HP each before being teleported back to spawn (or killed if player kills them)

## Meta-Progression (Home Base)

Stored in localStorage key `wave_survival_fps_meta` with JSON validation (parse failure → reset to defaults).

### Persistent systems

1. **Armory** — unlock permanent weapons for combat phase (start with pistol only, unlock others with credits)
2. **Engineering** — unlock permanent trap/turret types (start with spike/turret/barricade, unlock others)
3. **Upgrades** — permanent stat upgrades (health, speed, starting scrap, building limit, extraction HP)
4. **Stash** — store extracted weapon mods between runs
5. **Vendor** — sell unwanted mods for credits, buy specific mods (rotating stock)

### Currency: Credits

- **Scrap** — per-run currency, used for building/traps/upgrades during a run. Lost on death.
- **Credits** — persistent currency. Earned by:
  - Completing waves: +10 credits per wave survived
  - Final extraction: +50 credits
  - Selling mods to vendor: +5-20 credits per mod
  - Kill bonus: +1 credit per 10 kills

### Upgrade tree (MVP)

| Upgrade | Effect | Cost (credits) | Max level |
|---------|--------|----------------|-----------|
| Starting scrap | +25 scrap per run | 30 | 4 |
| Building limit | +5 max buildings | 40 | 4 |
| Extraction HP | +25 base HP | 35 | 4 |
| Health training | +10 max health | 25 | 5 |
| Speed training | +0.2 max speed | 25 | 4 |
| Repair efficiency | -20% repair cost | 50 | 2 |
| Supply drop rate | +10% drop frequency | 45 | 3 |
| Scrap magnet | +10% scrap from kills | 30 | 3 |

### Unlockable weapons (Armory)

| Weapon | Unlock cost | Notes |
|--------|-------------|-------|
| Pistol | Free | Starting weapon |
| SMG | 40 credits | |
| Shotgun | 60 credits | |
| Rifle | 80 credits | |
| Sniper | 100 credits | |
| Minigun | 150 credits | |

### Unlockable buildings (Engineering)

| Building | Unlock cost | Notes |
|----------|-------------|-------|
| Spike Trap | Free | Starting building |
| Barricade | Free | Starting building |
| Turret (bullet) | Free | Starting building |
| Glue Trap | 30 credits | |
| Turret (sniper) | 50 credits | |
| Landmine | 40 credits | |
| Tesla Coil | 70 credits | |
| Flamethrower | 60 credits | |
| Freeze Ray | 80 credits | |
| Singularity | 120 credits | |

### Weapon mods in stash

- Extracted mods go to stash (max 20 slots, upgradable)
- Equip mods before run (1 mod per weapon slot: mag/barrel/optic)
- Sell unwanted mods for credits
- Mods persist across runs until sold/equipped

## Game Flow

```
MAIN MENU
  → PLAY (start run)
  → ARMORY (unlock weapons, manage mods)
  → ENGINEERING (unlock buildings)
  → UPGRADES (permanent stat upgrades)
  → VENDOR (buy/sell mods)
  → SETTINGS
  → EXIT

PLAY (arena generation)
  → Generate arena (30×30 grid, spawns, paths, obstacles)
  → BUILD PHASE 1 (60s or Space)
    → Place starting buildings (spike, barricade, turret)
    → Start Wave 1

WAVE 1..9 (combat + build loop)
  → COMBAT PHASE
    → Enemies spawn, follow paths
    → Player fights in first-person
    → Buildings auto-fire
    → Supply drops spawn
    → Kill enemies, protect extraction zone
    → Wave ends when all enemies dead
  → BUILD PHASE
    → Earn scrap (base + wave bonus + kills)
    → Repair, build, upgrade, sell
    → Rearrange defenses
    → Start next wave

WAVE 10 (final siege)
  → Boss + minions spawn
  → Fight until boss dead
  → EXTRACT

EXTRACTION SUCCESS
  → Survived all 10 waves
  → Credits earned (10/wave + 50 final)
  → Weapon mods found during run → stash
  → Run summary (kills, waves, buildings, time)
  → Return to HOME BASE

DEATH / BASE DESTROYED
  → Extraction zone HP = 0
  → Death screen (wave reached, kills, time)
  → No credits earned (partial: credits from completed waves only)
  → Return to HOME BASE

HOME BASE
  → Armory: unlock weapons, equip mods
  → Engineering: unlock buildings
  → Upgrades: buy permanent upgrades
  → Vendor: sell/buy mods
  → Start next RUN
```

### Run end conditions

- **Victory**: survive all 10 waves, boss dead → extract with loot
- **Defeat**: extraction zone HP = 0 → game over, partial credits
- **Abort**: pause menu → abort run → no rewards

## Architecture

```
src/
  core/
    Game.js              — orchestrator: init, RAF loop, state machine (MENU/BUILD/COMBAT/EXTRACT/DEFEAT/HOME)
    EventBus.js          — singleton: domain:action events + Events constants
    GameState.js         — singleton: per-run state + meta state, clean reset, localStorage
    Constants.js         — ALL config: buildings, enemies, weapons, waves, arena, combat
    Logger.js            — structured debug logging with tags + levels
  systems/
    Input.js             — event.code: ZQSD pan, mouse look (pointer lock), build/combat actions
    CameraRig.js         — dual-mode: isometric (build) ↔ first-person (combat), smooth transition
    ArenaGenerator.js    — procedural 30×30 grid: paths (A*), obstacles, spawn zones, extraction zone
    BuildSystem.js       — placement validation, cost, sell, upgrade, building HP, grid management
    BuildingManager.js   — per-building AI (targeting, firing, animation), damage, destruction
    EnemyManager.js      — spawn, pathfinding (follow path), AI (attack base/player), death, scaling
    WaveManager.js       — wave composition, spawn queue, timers, boss wave, rewards
    WeaponSystem.js      — fire logic, recoil, ADS spread, ammo, jam, mod application
    CombatSystem.js      — damage calc, hit detection (raycast), armor, headshot, player health
    SupplyDrop.js        — spawn timer, loot table, pickup processing
    TrapSystem.js        — spike/glue/landmine triggers, AoE, slow, one-time vs persistent
    TurretSystem.js      — targeting priority (first/strong/closest), fire rate, projectile spawn
    AudioSystem.js       — Web Audio: footstep, gunshot, reload, explosion, build, UI
    ParticleSystem.js    — muzzle flash, blood, gibs, explosion, tesla arc, fire, freeze
    MetaProgression.js   — localStorage persistence, JSON validation, upgrade/armory/vendor logic
  entities/
    Player.js            — dual-mode: pawn (build) ↔ first-person (combat), movement, health, armor
    Enemy.js             — generic AI: follow path, attack base/player, death, scaling per wave
    Building.js          — base class: HP, level, targeting, fire, destruction, sell
    Trap.js              — extends Building: trigger on enemy enter, AoE, slow, one-time
    Turret.js            — extends Building: target enemies, fire projectiles, rotate barrel
    Projectile.js        — bullets (hitscan + tracer), grenades (arcing), freeze beam (continuous)
    SupplyCrate.js       — floating crate, bob animation, glow, pickup trigger
    Boss.js              — extends Enemy: multi-phase, spawn minions, AoE slam, high HP
  visuals/
    ModelFactory.js      — weapon meshes (6 base), building meshes (10 types), enemy meshes (8 types), supply crate
    Shaders.js           — fresnel rim (enemies), emissive pulse (supply crate), dissolve (death), building damage
    PostProcessing.js    — EffectComposer: RenderPass → UnrealBloom → OutputPass
    ArenaRenderer.js     — grid tiles, path visualization, spawn/base zones, fog
    GridHighlight.js     — buildable tile highlight, placement preview (green/red), range indicator
  ui/
    BuildHUD.js          — DOM: scrap counter, building palette (1-7 keys), wave timer, start button
    CombatHUD.js         — DOM: health/armor bars, ammo counter, weapon icon, minimap, extraction HP
    BuildPreview.js      — DOM: ghost building on hover, cost tooltip, range circle
    WaveComplete.js      — DOM: wave summary, scrap earned, "Next Wave" button
    DeathScreen.js       — DOM: wave reached, kills, time, "Return to Home Base"
    VictoryScreen.js     — DOM: run summary, credits earned, mods extracted, "Return to Home Base"
    HomeBase.js          — DOM: navigation (armory/engineering/upgrades/vendor), credits display
    ArmoryUI.js          — DOM: weapon list, unlock buttons, mod slots, equipped mods
    EngineeringUI.js     — DOM: building list, unlock buttons, stats
    UpgradeUI.js         — DOM: upgrade tree, buy buttons, current levels
    VendorUI.js          — DOM: rotating stock, buy/sell, mod list
```

## EventBus events

```javascript
export const Events = {
  // Game flow
  GAME_STATE_CHANGE: 'game:stateChange',       // { from, to }
  RUN_STARTED: 'game:runStarted',
  RUN_ENDED: 'game:runEnded',                 // { victory, waveReached, kills, time, creditsEarned },

  // Build phase
  BUILDING_PLACED: 'build:placed',            // { building, tile, cost }
  BUILDING_UPGRADED: 'build:upgraded',        // { building, newLevel, cost }
  BUILDING_SOLD: 'build:sold',                // { building, refund }
  BUILDING_DESTROYED: 'build:destroyed',      // { building, enemy },
  SCRAP_CHANGED: 'economy:scrapChanged',      // { amount, newTotal },

  // Combat phase
  WEAPON_FIRED: 'weapon:fired',               // { weapon, ammoLeft }
  WEAPON_RELOADED: 'weapon:reloaded',         // { weapon, ammoLeft }
  PLAYER_DAMAGED: 'player:damaged',           // { amount, source, newHealth }
  PLAYER_HEALED: 'player:healed',             // { amount, newHealth },
  PLAYER_KILLED: 'player:killed',             // { source },
  ENEMY_KILLED: 'enemy:killed',               // { enemyType, killer, scrapDrop },
  BASE_DAMAGED: 'base:damaged',               // { amount, newHP },

  // Waves
  WAVE_STARTED: 'wave:started',              // { wave, enemyCount },
  WAVE_CLEARED: 'wave:cleared',              // { wave, scrapReward, killBonus },
  BOSS_SPAWNED: 'wave:bossSpawned',
  SUPPLY_DROPPED: 'supply:dropped',          // { type, position },
  SUPPLY_PICKED: 'supply:picked',            // { type, contents },

  // Meta
  META_WEAPON_UNLOCKED: 'meta:weaponUnlocked',    // { weaponId, cost },
  META_BUILDING_UNLOCKED: 'meta:buildingUnlocked',// { buildingId, cost },
  META_UPGRADE_BOUGHT: 'meta:upgradeBought',      // { upgrade, level, cost },
  META_MOD_SOLD: 'meta:modSold',                  // { mod, credits },
  META_MOD_BOUGHT: 'meta:modBought',              // { mod, cost },
  CREDITS_CHANGED: 'meta:creditsChanged',         // { amount, newTotal },

  // UI
  UI_OPEN_BUILD: 'ui:openBuild',
  UI_OPEN_COMBAT: 'ui:openCombat',
  UI_SHOW_TOOLTIP: 'ui:showTooltip',           // { entity },
  UI_HIDE_TOOLTIP: 'ui:hideTooltip',
};
```

## GameState structure

```javascript
class GameState {
  constructor() {
    this.game = {
      state: 'MENU',          // MENU | BUILD | COMBAT | WAVE_COMPLETE | EXTRACT | DEFEAT | HOME
      runActive: false,
      paused: false,
      waveActive: false,
    };
    this.player = {
      health: 100,
      healthMax: 100,
      armor: 0,
      armorMax: 100,
      position: { x: 15, y: 1.7, z: 15 },  // center of arena (eye height)
      speed: 6.0,
      adsProgress: 0,
      weapons: {
        primary: { id: 'pistol', ammoInMag: 12, ammoReserve: 48, mods: [] },
        secondary: null,
        activeIndex: 0,
      },
      inventory: [],          // supply drops picked up
    };
    this.run = {
      wave: 0,
      maxWaves: 10,
      scrap: 100,
      buildings: [],          // placed buildings
      buildingLimit: 20,
      enemies: [],            // active enemies
      supplyDrops: [],        // active crates
      extractionHP: 100,
      extractionHPMax: 100,
      kills: 0,
      time: 0,
      buildTimer: 60,         // seconds until auto-start wave
    };
    this.arena = {
      grid: [],               // 30×30 tile types
      paths: [],              // array of path arrays (tile indices)
      spawnZones: [],         // tile indices
      extractionZone: { x: 15, z: 15 },
      obstacles: [],          // rock positions
      seed: 0,
    };
    this.meta = {
      credits: 0,
      unlockedWeapons: ['pistol'],
      unlockedBuildings: ['spike_trap', 'barricade', 'turret_bullet'],
      upgrades: {},           // { upgradeId: level }
      modStash: [],           // extracted mods
      vendorStock: [],        // rotating, 5-8 items
      vendorRotatesIn: 3,
    };
  }

  reset() { /* restore clean run slate, keep meta */ }
}
```

## Scope-Limited MVP

1. **1 arena type** (flat 30×30 grid), 2 spawn zones, 1 extraction zone, 2-3 paths
2. **3 buildings**: Spike Trap, Barricade, Turret (bullet) — unlock others in meta
3. **3 weapons**: Pistol, SMG, Shotgun — unlock others in meta
4. **4 enemy types**: Grunt, Runner, Tank, Flyer — unlock others in meta
5. **5 waves** (not 10) — boss at wave 5
6. **Build phase**: 60s timer, place/upgrade/sell, start wave
7. **Combat phase**: first-person, ZQSD movement, mouse look, fire/ADS/reload
8. **Supply drops**: ammo, medkit, scrap (no weapon mods in MVP)
9. **Extraction**: survive 5 waves → extract with credits + mods
10. **Meta-progression**: credits, 3 upgrades, 3 weapon unlocks, 3 building unlocks
11. **Visual**: isometric build camera, first-person combat camera, building meshes, enemy fresnel rim, muzzle flash, blood particles, supply crate glow
12. **HUD**: build palette, scrap counter, wave timer, health/armor, ammo, minimap, extraction HP
13. **Controls**: ZQSD pan (build), ZQSD move (combat), mouse look (combat), number keys (build select), Space (start wave)
14. **Restart**: clean state reset, 3x restart test, no console errors

## Visual Polish Checklist

- [ ] Isometric camera transition to first-person (smooth lerp over 0.5s)
- [ ] Building placement preview (green ghost on valid, red on invalid)
- [ ] Building range circle on hover (semi-transparent ring)
- [ ] Building damage visual (emissive flash on hit, cracks via shader)
- [ ] Building destruction (scale to 0 + particle burst)
- [ ] Turret barrel rotation (smooth lerp toward target)
- [ ] Muzzle flash (point light burst 50ms + particle sprite)
- [ ] Shell casing ejection (physics: bounce, fade after 3s)
- [ ] Blood particles on enemy hit (red spray, 0.3s lifetime)
- [ ] Enemy gib death (scale to 0 + particle burst + dissolve shader)
- [ ] Supply crate glow pulse (emissive sine 2.0 rad/s, white/blue)
- [ ] Supply drop landing (parachute or drop-pod animation)
- [ ] Tesla arc (line renderer between coil and enemies, flickering)
- [ ] Fire trap (particle system, orange flames, light)
- [ ] Freeze effect (enemy turns blue, ice shader overlay)
- [ ] Explosion (sphere expand + particle burst + light flash)
- [ ] Boss AoE slam (shockwave ring + screen shake)
- [ ] Extraction zone beam (vertical blue light column, pulsing)
- [ ] Wave complete animation (banner + scrap counter tick)
- [ ] Minimap (circular radar, enemy blips, building icons, player dot)
- [ ] Damage vignette (screen edges flash red on hit)
- [ ] Low-health warning (vignette pulses red, heartbeat sound)
- [ ] Build phase grid lines (subtle, fade on distance)
- [ ] Path visualization (red arrows on path tiles during build)

## Audio (Web Audio oscillator + sample-free synthesis)

| Event | Sound |
|-------|-------|
| Footstep | Short noise burst, pitch varies by surface |
| Gunshot | Low square wave + noise burst, pitch per weapon |
| Reload | Two clicks (mag out, mag in) + bolt rack |
| Enemy death | Descending noise burst + body thud |
| Enemy hit | Short click |
| Building place | Thud + mechanical click |
| Building upgrade | Power-up sine sweep |
| Building sell | Cha-ching (two-tone blip) |
| Building destroyed | Explosion + debris |
| Wave start | Alarm (square wave 400Hz, 100ms on/off) |
| Wave complete | Victory fanfare (three ascending tones) |
| Supply drop | Whoosh + landing thud |
| Supply pickup | Rising ping (800Hz, 60ms) |
| Player hit | Low buzz (150Hz, 80ms) |
| Base damaged | Alarm buzzer (200Hz, 200ms) |
| Boss roar | Low square wave sweep (100→50Hz, 500ms) |
| UI click | Short blip (600Hz, 30ms) |

## Pitfalls to Avoid

- **Camera mode switching** — smoothly lerp between isometric and first-person over 0.5s. Disable input during transition.
- **Pointer lock timing** — request on combat phase start, exit on build phase start / pause / Escape.
- **Building placement validation** — check tile type, occupancy, scrap cost, building limit. Show clear error feedback.
- **Enemy pathfinding** — precompute paths at arena generation. Enemies follow waypoints, don't recalculate every frame.
- **Enemy stuck on destroyed building** — if a building is destroyed, recalculate path for nearby enemies (or just let them continue to next waypoint).
- **Wave timer pause** — build phase timer pauses when inventory/menu is open. Resume on close.
- **Supply drop spawn** — only spawn on buildable tiles, not on path/rock/base. Check tile type.
- **Extraction zone damage** — enemies that reach base deal damage, then despawn (or get teleported back to spawn for player to kill). Don't let them stand at base infinitely.
- **Building HP vs enemy damage** — buildings take damage from enemies attacking them. Show HP bar above building when damaged.
- **Scrap overflow** — cap scrap at 999. Show "MAX" when capped.
- **localStorage corruption** — wrap JSON.parse in try/catch, reset to defaults on failure. Never crash on corrupted save.
- **Restart cleanup** — remove all event listeners, clear scene, cancel animation frames, unlock pointer. Test 3× restart.
- **Minimap enemy blips** — only show enemies within 20 units of player or in combat. Don't reveal all enemies.
- **Building range visualization** — show range circle on hover, hide on placement. Don't render all range circles (perf).
- **Enemy scaling balance** — test wave 5 boss is challenging but not impossible with starting buildings. Tune HP/damage if needed.
- **Weapon mod application** — mods modify weapon stats at equip time. Don't modify base weapon definition.
- **Grid coordinate conversion** — world (x, z) → grid (col, row) = (Math.floor(x), Math.floor(z)). Keep consistent.
- **Isometric camera panning** — pan in screen space, not world space. ZQSD moves camera relative to its orientation.
