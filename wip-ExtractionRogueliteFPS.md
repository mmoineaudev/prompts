# Extraction Roguelite FPS — Procedural Combat Scavenge (Three.js + Vite)

## Concept

You drop into a procedurally-generated map with nothing. Scavenge weapons, mods, and supplies from the environment. Fight AI enemies and environmental hazards. Reach an extraction point before the timer runs out or the map collapses. Die = lose everything you brought in and found. Extract = keep it all, bank it in a persistent stash, spend it on permanent upgrades before the next drop.

Think Escape from Tarkov meets Hades, rendered in first-person low-poly 3D with moody volumetric lighting. The procedural generation is the star — maps, loot spawns, enemy patrols, and hazard zones are all algorithmically placed for a fresh drop every run.

The entire gameplay is **risk/reward** — you drop in empty, find gear, and desperately try to reach extraction before the situation deteriorates.

## Visual Style

- **Moody low-poly 3D** — flat-shaded geometry with limited color palette per zone (industrial grays/oranges, military greens, clinical whites for labs).
- **First-person camera** — weapon viewmodel in bottom-right, sway on movement, recoil kick on fire.
- **Volumetric fog** — exponential fog with density 0.015, color shifts per zone (gray for industrial, green for toxic, orange for fire zones). Flashlight beam cuts through fog via spotlight cone.
- **Dynamic lighting** — flashlight (spotlight: #ffffcc, intensity 1.5, range 12, angle 35°, decay 1.6), muzzle flash (point light burst 50ms), environmental lights (flickering fluorescents, fire barrels, alarm lights).
- **Bloom** — threshold 0.4, strength 0.8 on muzzle flash, flashlight beam, glowing loot, environmental hazards.
- **Weapon viewmodel** — composite mesh (body + magazine + barrel attachment + stock attachment + scope attachment), named children for animation. Mods visibly change the weapon silhouette.
- **Enemies** — low-poly humanoid/creature shapes with fresnel rim shaders. Dark silhouette, colored rim (orange for grunts, red for elites, purple for specials). Death: dissolve + particle burst.
- **Loot** — glowing pickup items with pulsing emissive (common=white, uncommon=green, rare=blue, legendary=purple). Floating above containers.
- **HUD** — DOM overlay: health bar, armor bar, ammo counter, timer, extract status, minimap (circular), inventory grid.

## Tech Stack

- Vite + Three.js (ES modules, `src/` directory)
- PostProcessing via three/addons (EffectComposer, UnrealBloomPass, RenderPass)
- No physics engine — simple AABB/sphere collision on XZ plane + raycasting for line of sight
- All constants in `Constants.js`
- EventBus.js + GameState.js pattern (from game-architecture skill)
- localStorage for meta-progression (with validation + parse-failure fallback)
- Web Audio API for discrete sound effects (no audio system)

## Controls

All input uses **event.code** for AZERTY/QWERTY compatibility:

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
| Interact/pickup | F | F | Open containers, pick up loot, activate extract |
| Switch weapon | 1 / 2 | 1 / 2 | Primary / secondary |
| Use consumable | 3 | 3 | Medkit / stim |
| Flashlight toggle | T | T | |
| Map overlay | M | M | Toggle minimap zoom |
| Inventory | Tab | Tab | Pause run, open inventory |
| Pause | Escape | Escape | |

### Mouse sensitivity

- Default: 0.002 rad/px
- ADS multiplier: 0.5x
- Adjustable in meta-progression settings

## Map Generation

### Zone structure

Each map is a cluster of interconnected **zones** (rooms, corridors, open areas, points of interest) connected by doorways/gates. Zones are placed on a 2D grid and connected to guarantee full traversal.

Map dimensions: 200x200 world units. Zone size: 10-40 units per side.

### Zone types

| Type | Size | Contents | Density |
|------|------|----------|---------|
| Spawn room | 10x10 | Safe, one basic weapon, one container | 1 per map |
| Corridor | 4x15 | Tight, loot spawns, ambush risk | 8-12 per map |
| Warehouse | 20x20 | Multiple containers, verticality, enemy patrol | 3-5 per map |
| Lab | 15x15 | High-value loot, tight corridors, hazard zones | 2-3 per map |
| Industrial | 25x25 | Machinery cover, fire hazards, multiple levels | 2-3 per map |
| Extraction zone | 15x15 | Open area, single extract point, defend or flee | 1-2 per map |

### Generation algorithm

1. Place spawn room at map center
2. Place extraction zone(s) at edges (minimum 80 units from spawn)
3. Place remaining zones via random walk with minimum distance constraints
4. Connect all zones via corridors using spanning tree (guaranteed connectivity)
5. Add 1-2 secondary connections for alternate routes
6. Populate each zone: container spawns, loot spawns, enemy spawns, hazard spawns
7. Validate: every zone reachable from spawn, at least one extraction zone reachable

### Container spawns

- **Crate** (common): weapons, ammo, basic mods
- **Weapon rack** (uncommon): guaranteed weapon, chance for mod
- **Loot vault** (rare): high-value items, locked (requires lockpick or keycard)
- **Corpse** (random): enemy gear, random condition
- **Supply drop** (legendary): guaranteed rare+ item, audible alarm attracts enemies

### Loot table (per zone tier)

| Tier | Zone types | Common | Uncommon | Rare | Legendary |
|------|-----------|--------|----------|------|-----------|
| 1 | Spawn, corridors | 70% | 25% | 5% | 0% |
| 2 | Warehouses, labs | 50% | 35% | 13% | 2% |
| 3 | Industrial, vaults | 30% | 40% | 25% | 5% |

## Weapons & Modding

### Base weapons

| Weapon | Type | Damage | Fire rate | Range | Mag size | Recoil | Movement speed |
|--------|------|--------|-----------|-------|----------|--------|----------------|
| Pistol | Sidearm | 15 | 4 rpm | 30 | 12 | Low | 1.0x |
| SMG | Auto | 12 | 10 rpm | 25 | 30 | Medium | 1.05x |
| Rifle | Auto | 25 | 7 rpm | 50 | 25 | High | 0.95x |
| Shotgun | Auto | 80 (pellets) | 2 rpm | 15 | 6 | Very high | 0.90x |
| Sniper | Bolt | 90 | 1 rpm | 100 | 5 | High | 0.85x |

### Weapon mods

Mods found in containers, attached at workbench or mid-run via inventory. Each weapon has 3 slots: **Barrel**, **Stock**, **Optic**. Post-MVP: **Ammo** slot.

| Slot | Mod | Effect | Rarity |
|------|-----|--------|--------|
| Barrel | Suppressor | -30% sound range, -5% damage | Uncommon |
| Barrel | Extended barrel | +15% range, +10% recoil | Common |
| Barrel | Compensator | -20% recoil, +10% sound | Common |
| Stock | Light stock | +10% ADS speed, +5% sway | Common |
| Stock | Heavy stock | -25% recoil, -10% ADS speed | Uncommon |
| Stock | Tactical stock | +15% movement speed | Rare |
| Optic | Red dot | +20% ADS accuracy | Common |
| Optic | 4x scope | +50% ADS zoom, -10% close range | Uncommon |
| Optic | Thermal | See enemies through smoke/fog | Rare |
| Ammo (post-MVP) | Armor piercing | +25% armor damage, -10% health damage | Uncommon |
| Ammo (post-MVP) | Hollow point | +30% health damage, -15% armor | Common |

### Weapon condition

Weapons have **condition** (0-100%). Found weapons: 30-70% condition. Low condition = jam chance, reduced accuracy. Condition degrades per shot. Repair at workbench between runs.

### Ammo

- Weapons consume ammo from a shared pool per caliber
- Calibers: 9mm (pistol/SMG), 5.56 (rifle), 12ga (shotgun), .338 (sniper)
- Ammo found in containers, carried in inventory
- No weapon = melee only (knife: 25 damage, 1.5 rpm, range 2)

## AI Enemies

### Enemy types

| Type | Shape | HP | Armor | Dmg | Speed | Range | Behavior | Rarity |
|------|-------|----|-------|-----|-------|-------|----------|--------|
| Grunt | Humanoid + rifle | 30 | 0 | 8 | 3.0 | 25 | Patrol, chase, shoot | Common |
| Armored | Humanoid + heavy armor | 40 | 40 | 10 | 2.5 | 30 | Patrol, suppressed fire | Uncommon |
| Rusher | Quadruped + claws | 20 | 0 | 15 | 5.5 | 2 | Sprint, flank, melee | Common |
| Sniper | Humanoid + rifle | 25 | 0 | 25 | 1.5 | 60 | Stationary, high accuracy | Uncommon |
| Exploder | Blob + volatile | 15 | 0 | 40 (AoE) | 4.0 | 0 | Rush, explode on death/contact | Rare |
| Elite | Heavy + minigun | 80 | 60 | 12 | 2.0 | 35 | Suppressive fire, slow rotate | Legendary |
| Boss | Mechanical + missile | 200 | 100 | 30 | 1.5 | 50 | Multi-phase, zone control | Once per map |

### AI behavior states

```
PATROL (waypoints) ──alert──▶ INVESTIGATE (move to sound/lastSeen)
     ▲                              │
     │                           lineOfSight
     │                              ▼
     └─────── lostTarget ──────── COMBAT (shoot/cover/strafe)
```

- **Patrol**: follow zone waypoints, pause at each
- **Investigate**: move to alert source, 5s search, return to patrol
- **Combat**: maintain 10-20 units distance, strafe, suppress, flank (rusher), flee if <20% HP (grunt)
- **Alert propagation**: enemies within 15 units of a combat enemy also investigate

### Enemy spawn

- Placed during map generation: 1-3 enemies per zone, 4-8 in warehouses/industrial
- Elites spawn only in tier 3 zones, max 2 per map
- Boss spawns in extraction zone or central landmark
- Enemies remain dormant until player enters aggro range (grunt: 20, rusher: 30, sniper: 50)

## Combat Mechanics

### Damage model

```
finalDamage = weaponDamage × conditionMultiplier × rangeMultiplier × armorMultiplier
```

- **Condition multiplier**: 1.0 at 100% condition, 0.7 at 0% condition
- **Range multiplier**: 1.0 at 0 units, 0.5 at max range (linear falloff)
- **Armor multiplier**: armor absorbs damage 1:1 until depleted, then full health damage. AP ammo: 25% armor pen

### Hit zones

| Zone | Multiplier |
|------|-----------|
| Head | 2.0x |
| Torso | 1.0x |
| Limbs | 0.7x |

### Player stats

| Stat | Base | Max upgrade |
|------|------|-------------|
| Health | 100 | 150 |
| Armor | 0 (find armor) | 100 |
| Movement speed | 6.0 u/s | 8.0 u/s |
| ADS speed | 0.3s | 0.15s |
| Inventory slots | 8 | 16 |

### Armor system

- Found in containers (light: 25, medium: 50, heavy: 100 armor points)
- Absorbs damage 1:1 from torso hits (50% from limbs)
- Degrades with damage (1:1 ratio)
- No head protection (helmets post-MVP)

## Extraction Mechanics

### Extract types

| Type | Condition | Risk |
|------|-----------|------|
| Standard | Reach zone, press F, hold 5s | Defend during timer |
| Timed | Appears at T-5min, lasts 30s | Rush to location |
| Conditional | Need keycard (found in map) | Hunt for keycard |
| Scavenger | Extract with full inventory only | Encourages greed |
| Collapsing | Map floods/burns after T-0 | Forced extraction |

### Map collapse timer

- **MVP**: 15 minutes to extract
- Timer visible in HUD (yellow at 10min, red at 5min, flashing at 1min)
- At T-0: map collapse begins, damage ramp 10/sec increasing, forced death in 60s
- Collapse visual: fog color shifts to red, screen vignette intensifies, ambient sound rises

### Extraction rewards

- All carried loot saved to stash
- Bonus for time remaining: +10% value per 2 minutes under cap
- Bonus for kills: +5% value per enemy killed
- Bonus for exploration: +2% value per zone discovered

## Meta-Progression (Persistent Hideout)

Stored in localStorage key `extraction_fps_meta` with JSON validation (parse failure → reset to defaults).

### Persistent systems

1. **Stash** — container for all extracted loot. Capacity: 20 slots base, upgradable.
2. **Workbench** — repair weapons, attach/dismantle mods, craft ammo. Tier determines what mods can be crafted.
3. **Upgrade station** — permanent stat upgrades (health, speed, inventory, ADS speed).
4. **Vendor** — sells basic weapons/ammo for extracted currency, rotates stock every 3 runs.
5. **Insurance** — insure 1 weapon + 1 armor per run. If you die, insured items return to stash (50% condition).

### Currency

- **Run credits** — value of extracted loot, converted at vendor
- **Scrap** — dismantled mods/weapons, used for workbench crafts

### Upgrade tree (MVP)

| Upgrade | Effect | Cost | Max level |
|---------|--------|------|-----------|
| Stash expansion | +5 slots | 100 credits | 4 |
| Health training | +10 max health | 80 credits | 5 |
| Speed training | +0.2 max speed | 80 credits | 4 |
| ADS training | -0.03s ADS time | 100 credits | 4 |
| Inventory expansion | +2 slots | 120 credits | 4 |
| Workbench tier 1 | Craft common mods | 150 credits | 1 |
| Workbench tier 2 | Craft uncommon mods | 300 credits | 1 |
| Insurance slot | +1 insured item | 200 credits | 2 |

### Crafting (post-MVP)

| Craft | Input | Output |
|-------|-------|--------|
| Repair kit | 5 scrap | Restore weapon to 80% condition |
| Ammo pack | 3 scrap | 30 ammo (selected caliber) |
| Common mod | 10 scrap | Random common mod slot item |
| Uncommon mod | 25 scrap + 1 weapon part | Random uncommon mod slot item |

## Game Flow

```
MAIN MENU
  → PLAY (enter loadout)
  → HIDEOUT (stash, workbench, upgrades, vendor)
  → SETTINGS (sensitivity, keybinds, graphics)
  → EXIT

LOADOUT (pre-drop)
  → Select insured weapon (if any)
  → Select insured armor (if any)
  → Buy ammo from vendor if needed
  → DROP

DROP PHASE
  → Spawn in spawn room
  → Loot basic weapon if no insured weapon
  → Explore zones, find loot, fight enemies
  → Manage inventory (drop items to make room)
  → Decide: push deeper or extract?
  → Reach extraction zone
  → Hold/defend during extract timer
  → EXTRACT

EXTRACT SUCCESS
  → Loot saved to stash
  → Run summary (time, kills, zones, loot value, bonuses)
  → Return to HIDEOUT

DEATH
  → Death screen (killer, time survived, loot lost)
  → Insured items returned to stash
  → Return to HIDEOUT

HIDEOUT
  → Stash: view/sell/sort loot
  → Workbench: repair, attach/dismantle, craft
  → Upgrades: buy permanent stat upgrades
  → Vendor: buy/sell, rotating stock
  → Insurance: select items for next run
  → Start next DROP
```

### Run end conditions

- **Extract success**: reach extraction, survive timer → loot saved
- **Death**: health ≤ 0 → lose all carried loot (insured items survive)
- **Map collapse**: timer expires → forced collapse, death in 60s unless extracting
- **Manual abort**: pause menu → abort run → keep nothing (counts as death)

## Architecture

```
src/
  core/
    Game.js              — orchestrator: init, RAF loop, state machine (MENU/LOADOUT/DROP/EXTRACT/DEATH/HIDEOUT)
    EventBus.js          — singleton: domain:action events + Events constants
    GameState.js         — singleton: per-run state + meta state, clean reset, localStorage
    Constants.js         — ALL config: weapons, mods, enemies, loot, zones, map gen, combat
    Logger.js            — structured debug logging with tags + levels
  systems/
    Input.js             — event.code: ZQSD movement, mouse look (pointer lock), actions (F/R/Tab/etc.)
    Camera.js            — first-person camera: position, FOV, sway, ADS zoom, recoil kick
    WeaponSystem.js      — fire logic, recoil pattern, ADS spread, ammo consumption, jam chance
    ModSystem.js         — attach/dismantle mods, calculate weapon stats from base + mods
    Inventory.js         — slot management, add/remove/drop items, weight/capacity
    CombatSystem.js      — damage calc, hit detection (raycast), armor, hit zones
    EnemyManager.js      — spawn, AI behavior tree, alert propagation, death handling
    LootManager.js       — container spawns, loot table rolls, pickup processing, rarity colors
    MapGenerator.js      — procedural zone placement, spanning tree, container/enemy/loot population
    ExtractSystem.js     — extract zone logic, timer, conditions, collapse sequence
    AudioSystem.js       — Web Audio: footstep, gunshot, reload, hit, ambient, UI
    ParticleSystem.js    — muzzle flash, blood, death burst, shell casings, environmental
    MetaProgression.js   — localStorage persistence, JSON validation, upgrade/stash/vendor logic
  entities/
    Player.js            — movement, ADS, weapon handling, health/armor, state machine
    Enemy.js             — generic AI: patrol/investigate/combat/flee, configurable per type
    Weapon.js            — weapon viewmodel, fire animation, reload animation, mod attachment visuals
    LootItem.js          — glowing pickup mesh, bob/rotation, rarity color, pickup trigger
    Container.js         — crate/rack/vault, open animation, loot spawn on interact
    Projectile.js        — bullets (hitscan instant + tracer visual), thrown items
  visuals/
    ModelFactory.js      — weapon meshes (5 base + mod attachments), enemy meshes, container meshes, loot item meshes
    Shaders.js           — fresnel rim (enemies), emissive pulse (loot), dissolve (death), shell casing physics
    PostProcessing.js    — EffectComposer: RenderPass → UnrealBloom → OutputPass
    FogSystem.js         — zone-based fog color/density, collapse transition
    Lighting.js          — flashlight, muzzle flash, environmental lights, dynamic shadow (simple)
  ui/
    HUD.js               — DOM: health/armor bars, ammo counter, weapon icon, timer, extract status
    Minimap.js           — DOM canvas: circular radar, discovered zones, enemy blips (if detected)
    InventoryUI.js       — DOM: grid of slots, drag-drop, item tooltips, compare stats
    StashUI.js           — DOM: grid of slots, sort/filter, sell/dismantle/repair buttons
    WorkbenchUI.js       — DOM: weapon display, mod slots (drag mod → slot), condition bar
    VendorUI.js          — DOM: rotating stock, buy/sell, price display
    LoadoutUI.js         — DOM: pre-drop equipment selection, insurance checkboxes
    DeathScreen.js       — DOM: killer, time, loot lost, insured items returned, "Back to Hideout"
    ExtractScreen.js     — DOM: run summary, loot saved, bonuses, "Back to Hideout"
    HideoutMenu.js       — DOM: navigation (stash/workbench/upgrades/vendor/loadout), currency display
```

## EventBus events

```javascript
export const Events = {
  // Game flow
  GAME_STATE_CHANGE: 'game:stateChange',       // { from, to }
  RUN_STARTED: 'game:runStarted',
  RUN_ENDED: 'game:runEnded',                 // { reason, lootValue, kills, time, bonuses }

  // Combat
  WEAPON_FIRED: 'weapon:fired',               // { weapon, ammoLeft }
  WEAPON_RELOADED: 'weapon:reloaded',         // { weapon, ammoLeft }
  WEAPON_JAMMED: 'weapon:jammed',             // { weapon }
  PLAYER_DAMAGED: 'player:damaged',           // { amount, source, newHealth }
  PLAYER_HEALED: 'player:healed',             // { amount, newHealth }
  PLAYER_KILLED: 'player:killed',             // { killer }
  ENEMY_KILLED: 'enemy:killed',               // { enemyType, killer, lootDrop },

  // Loot & inventory
  ITEM_PICKED_UP: 'loot:pickedUp',            // { item }
  ITEM_DROPPED: 'loot:dropped',               // { item, reason },
  CONTAINER_OPENED: 'container:opened',       // { container },
  INVENTORY_FULL: 'inventory:full',           // { item },

  // Map
  ZONE_DISCOVERED: 'map:zoneDiscovered',      // { zoneId },
  EXTRACT_AVAILABLE: 'map:extractAvailable',  // { extractId, position },
  EXTRACT_STARTED: 'extract:started',         // { extractId, duration },
  EXTRACT_COMPLETED: 'extract:completed',     // { extractId },
  COLLAPSE_STARTED: 'map:collapseStarted',
  COLLAPSE_DAMAGE: 'map:collapseDamage',      // { amount },

  // Mods & workbench
  MOD_ATTACHED: 'mod:attached',               // { weapon, mod, slot },
  MOD_DETACHED: 'mod:detached',               // { weapon, mod, slot },
  WEAPON_REPAIRED: 'weapon:repaired',         // { weapon, newCondition },
  ITEM_DISMANTLED: 'loot:dismantled',         // { item, scrapYield },

  // Meta
  META_UPGRADE_BOUGHT: 'meta:upgradeBought',  // { upgrade, level, cost },
  STASH_CHANGED: 'meta:stashChanged',         // { item, action },
  VENDOR_STOCK_ROTATED: 'meta:vendorRotated',
  INSURANCE_SELECTED: 'meta:insuranceSelected', // { items },

  // UI
  UI_OPEN_INVENTORY: 'ui:openInventory',
  UI_CLOSE_INVENTORY: 'ui:closeInventory',
  UI_SHOW_TOOLTIP: 'ui:showTooltip',           // { item },
  UI_HIDE_TOOLTIP: 'ui:hideTooltip',
};
```

## GameState structure

```javascript
class GameState {
  constructor() {
    this.game = {
      state: 'MENU',          // MENU | LOADOUT | DROP | EXTRACT | DEATH | HIDEOUT
      runActive: false,
      paused: false,
    };
    this.player = {
      health: 100,
      healthMax: 100,
      armor: 0,
      armorMax: 100,
      position: { x: 0, y: 1.7, z: 0 },  // eye height
      velocity: { x: 0, y: 0, z: 0 },
      speed: 6.0,
      adsProgress: 0,         // 0 = hipfire, 1 = full ADS
      adsTime: 0.3,
    };
    this.weapons = {
      primary: null,          // { id, baseId, mods: { barrel, stock, optic }, condition, ammoInMag }
      secondary: null,
      melee: { id: 'knife', damage: 25 },
      activeIndex: 0,         // 0 = primary, 1 = secondary
    };
    this.inventory = {
      slots: [],              // 8-16 slots, each null or item
      capacity: 8,
    };
    this.run = {
      timeRemaining: 900,     // 15 min in seconds
      kills: 0,
      zonesDiscovered: [],
      lootValue: 0,           // running total of carried loot
      extractZone: null,
      collapseActive: false,
    };
    this.meta = {
      credits: 0,
      scrap: 0,
      stash: [],              // array of item objects
      stashCapacity: 20,
      upgrades: {},           // { upgradeId: level }
      insuredItems: [],       // max 2
      vendorStock: [],        // rotating, 5-8 items
      vendorRotatesIn: 3,     // runs until rotation
      workbenchTier: 0,
    };
    this.map = {
      zones: [],              // generated zone data
      containers: [],         // spawned containers
      enemies: [],            // spawned enemies
      loot: [],               // spawned loot items
      extractZones: [],
      seed: 0,
    };
  }

  reset() { /* restore clean run slate, keep meta */ }
}
```

## Scope-Limited MVP

1. **1 map type** (industrial complex), 8-10 zones, 1 extraction zone
2. **3 weapons**: Pistol, SMG, Rifle (Shotgun + Sniper post-MVP)
3. **3 mod slots** (Barrel, Stock, Optic), 2 mods per slot per rarity
4. **3 enemy types**: Grunt, Armored, Rusher (Sniper, Exploder, Elite, Boss post-MVP)
5. **1 extract type** (standard: hold 5s in zone)
6. **Timer**: 10 minutes, collapse at T-0 (30s grace)
7. **Stash**: 20 slots, view/sell/dismantle
8. **Workbench**: tier 0 (repair only), tier 1 unlock (craft common mods)
9. **Vendor**: rotates every 3 runs, sells basic weapons/ammo
10. **Insurance**: 1 weapon slot, 1 armor slot
11. **Visual**: first-person camera, weapon viewmodel, flashlight, fog, bloom, enemy fresnel rim, loot glow, muzzle flash particles, shell casings
12. **HUD**: health, armor, ammo, timer, minimap, inventory grid
13. **Controls**: ZQSD movement, mouse look (pointer lock), fire/ADS/reload/interact/switch
14. **Meta-progression**: credits, upgrades (health, speed, stash), localStorage with validation
15. **Restart**: clean state reset, 3x restart test, no console errors

## Visual Polish Checklist

- [ ] Flashlight cone (spotlight: #ffffcc, intensity 1.5, range 12, angle 35°, decay 1.6)
- [ ] Muzzle flash (point light burst 50ms + particle sprite)
- [ ] Shell casing ejection (physics: bounce, fade after 5s)
- [ ] Weapon sway (sine on movement, reduced when ADS)
- [ ] Weapon recoil (camera kick + viewmodel kick, per-weapon pattern)
- [ ] ADS zoom (FOV 70 → 50 over 0.3s, reduced sway)
- [ ] Blood particles on enemy hit (red spray, 0.3s lifetime)
- [ ] Death dissolve (enemy shader: emissive fade + scale to 0 over 0.5s)
- [ ] Loot glow pulse (emissive sine 2.0 rad/s, intensity 0.3-0.8, rarity color)
- [ ] Container open animation (lid rotates 90°, loot spawns with glow)
- [ ] Fog color shift on collapse (gray → red over 5s)
- [ ] Minimap discovery (zones fade in as discovered, player dot + facing arrow)
- [ ] Damage vignette (screen edges flash red on hit)
- [ ] Low-health warning (vignette pulses red, heartbeat sound)
- [ ] Extract timer UI (progress bar, countdown, defend indicator)
- [ ] Ammo counter animation (number ticks down on fire, reload spins)
- [ ] Inventory slot hover (tooltip with item name, stats, rarity border)
- [ ] Workbench weapon rotation (360° view, mod slots highlighted)
- [ ] Stash sort animation (items rearrange with lerp)

## Audio (Web Audio oscillator + sample-free synthesis)

| Event | Sound |
|-------|-------|
| Footstep | Short noise burst, pitch varies by surface |
| Gunshot | Low square wave + noise burst, pitch per weapon |
| Reload | Two clicks (mag out, mag in) + bolt rack |
| Weapon jam | Click + clack |
| Enemy death | Descending noise burst + body thud |
| Player hit | Low buzz (150Hz, 80ms) |
| Loot pickup | Rising ping (800Hz, 60ms) |
| Container open | Creak (sine sweep 200→100Hz, 150ms) |
| Extract start | Alarm beep (1kHz, 100ms on/off) |
| Collapse warning | Rising siren (sine 400→800Hz over 2s, looping) |
| UI click | Short blip (600Hz, 30ms) |

## Pitfalls to Avoid

- **Pointer lock timing** — request on canvas click, exit on Escape. Re-show cursor for menus.
- **Mouse sensitivity** — store in meta settings, apply to camera look calculation.
- **Weapon mod stacking** — each slot holds 1 mod. Detach existing mod before attaching new one (old mod returns to inventory if space, else dropped).
- **Loot pickup priority** — if inventory full, pickup fails with "Inventory full" message + UI flash. Don't auto-drop items.
- **Enemy alert propagation** — prevent infinite alert loops. Enemies already in combat don't re-investigate.
- **Map connectivity** — validate spanning tree covers all zones. If not, add corridors until connected.
- **Extraction zone reachability** — guarantee at least one extract reachable from spawn without passing through boss.
- **Timer pause** — timer pauses in inventory/menu. Resume on close. Prevents "pause to think" exploit.
- **Condition degradation** — 1% per shot for rifles, 2% for SMGs, 0.5% for pistols. Tune for ~200-400 shots before 0%.
- **Armor degradation** — 1:1 with absorbed damage. Repair at workbench (costs scrap).
- **localStorage corruption** — wrap JSON.parse in try/catch, reset to defaults on failure. Never crash on corrupted save.
- **Restart cleanup** — remove all event listeners, clear scene, cancel animation frames, unlock pointer. Test 3× restart.
- **Ammo pool sharing** — weapons of same caliber share ammo pool. Switching weapons doesn't refill mag.
- **Flashlight through walls** — don't cast shadows from flashlight (perf). Use simple cone visual.
- **Bloom over-brightness** — threshold 0.4 so muzzle flash and flashlight glow but weapon viewmodel doesn't wash out.
- **Fog color interpolation** — lerp fog color on zone transition over 1s, don't snap.
- **Weapon viewmodel clipping** — offset weapon from camera (0.3 right, -0.2 down, -0.5 forward). Adjust per weapon.
- **ADS raycast** — when ADS, raycast from camera center (crosshair). When hipfire, raycast from camera center with spread cone.
- **Minimap enemy blips** — only show enemies that are in combat or have line of sight to player. Don't reveal dormant enemies.
