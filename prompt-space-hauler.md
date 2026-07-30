# Space Hauler Roguelite — Procedural Galaxy Trading (Three.js + Vite)

## Concept

You're a space trucker in a procedurally-generated galaxy. Each run: buy cargo at Station A, navigate a route through connected star systems, survive pirates, asteroids, and cosmic hazards, then sell at Station B for profit. Die in transit → back to home port → spend credits on permanent ship upgrades, new vessels, and faction unlocks.

Think FTL's galaxy map meets a streamlined 3D space flight sim with cargo management. The procedural generation is a node graph — every run generates a fresh cluster of systems with varying economies, danger levels, and secrets. The 3D flight segments are short, cinematic, and focused on encounters rather than open exploration (keeping scope tight).

## Visual Style

- **Low-poly pixel-retro 3D** — flat-shaded ships and stations with vertex coloring. Think Star Fox 64 / Freelancer meets a retro palette.
- **Galaxy map** — a 2D top-down node graph rendered as a Three.js scene (orthographic camera). Systems are glowing dots connected by trade route lines. The ship icon hops between nodes. Nebula gradients in the background.
- **3D flight segments** — first-person cockpit view. Ship flies freely through a themed corridor (asteroid field, nebula, empty space, pirate territory) with parallax star layers, nebulae, and distant celestial bodies. Corridor is 2× screen width for a sense of freedom. Encounters spawn at distance triggers.
- **Bloom** — on engine trails, station beacons, jump gates, and rare cargo.
- **Ship models** — composite geometry (body + wings + cockpit + engine pods), named children for animation. Low-poly cargo containers attach to the hull.
- **Stations** — torus/dome geometries with glowing docking bays. Rotating antenna arrays.
- **Faction color palettes** — each faction has a signature color scheme (blue/gray for Federation, red/black for Pirates, green/gold for Merchants Guild, purple/cyan for Scientists).
- **Station docking** — on-rails animation: ship glides into station bay, camera zooms, fade to market screen.

## Tech Stack

- Vite + Three.js (ES modules, `src/` directory)
- PostProcessing via three/addons (bloom)
- No physics engine — simple AABB collision for flight encounter obstacles
- All constants in `src/data/` directory split by domain
- EventBus.js + GameState.js pattern (from game-architecture skill)
- localStorage for meta-progression
- **No audio** — out of scope

## Controls

### Galaxy map
- Mouse click to select **adjacent** destination system (shows route info)
- Mouse wheel to zoom
- Middle-mouse drag to pan (orthographic camera)

### Flight segments
- **event.code** for input compatibility (AZERTY ↔ QWERTY)
- **Z** (forward) / **S** (back) — pitch/dodge vertical
- **Q** (left) / **D** (right) — yaw/dodge horizontal
- **Mouse** — aim turret crosshair
- **Left click** — fire turret (when weapon mounted)
- **Space** — brace for solar flare QTE
- **Escape** — pause

## State Machine

```
             ┌──────────────────────────────────────────────┐
             │                                              │
             ▼                                              │
          ┌──────┐    select system    ┌─────┐    arrive    ┌────────┐
          │ HUB  │ ──────────────────▶ │ MAP │ ───────────▶ │ SYSTEM │
          └──────┘                     └─────┘              └────────┘
             ▲                            │                      │
             │                    confirm route             buy/sell/depart
             │                            │                      │
             │                            ▼                      │
             │                    ┌───────────┐                  │
             │◀── death ───────── │  FLIGHT   │ ◀────────────────┘
             │                    └───────────┘
             │                         │  │
             │               encounter │  │ arrive
             │                    triggers │
             │                         ▼  ▼
             │                    ┌───────────┐
             │◀── success ─────── │  RESULT   │
             │                    └───────────┘
             │
             ▼
          ┌───────┐
          │ DEATH │ (summary → HUB)
          └───────┘
```

### State transitions

| From | Trigger | To | Action |
|------|---------|-----|--------|
| HUB | Click "View Galaxy" | MAP | Show procedurally generated galaxy |
| MAP | Click adjacent system | MAP | Highlight route, show danger/fuel summary |
| MAP | Click "Launch" | FLIGHT | Begin flight along route |
| FLIGHT | Encounter trigger hit (distance threshold) | FLIGHT | Pause free flight, run encounter sequence |
| FLIGHT | All route edges traversed | SYSTEM | Arrive at destination, show market |
| SYSTEM | Click adjacent system + "Depart" | FLIGHT | Continue journey |
| SYSTEM | Click "Return to Home" → A* autopath | FLIGHT | Auto-route to home port |
| SYSTEM | hull ≤ 0 during flight | DEATH | Show death screen |
| DEATH | Click "Continue" | HUB | Reset run state, return to hub |
| HUB | Run ends (returned home) | HUB | Show success screen (profit or loss), award persistent credits |

## Core Systems

### Galaxy Generation (Node Graph)

The galaxy is a weighted graph of 8-15 **systems** connected by **routes** of varying length and danger level.

Each system has:
- **Name** — procedurally generated (syllable combination: "Keplar-3", "Vorath Prime", "Nexus Station")
- **Type** — Trade Hub, Mining Outpost, Pirate Den, Research Station, Refugee Colony, Black Market
- **Economy** — import goods (high buy price), export goods (low sell price), supply/demand quantities
- **Danger level** — 1-5, determines encounter frequency and severity on connected routes
- **Faction** — Federation, Pirates, Merchants Guild, Scientists, Neutral
- **Services** — refuel and repair available at **all** stations (including Pirate Dens)
- **Nodes** — 1-3 "points of interest" per system (shop, quest giver, upgrade vendor, info broker)

Generation algorithm:
1. Place a "home" system (safe, Federation, always starting point)
2. Place 1-2 "endpoint" systems (high-value trade destinations, harder danger)
3. Fill remaining nodes with random types
4. Connect via Delaunay triangulation + prune to create an interesting graph
5. Assign route distances (arbitrary units) and danger levels based on endpoint danger values
6. **Validate graph connectivity** — every system must be reachable from home. Regenerate if disconnected.

### Flight Fuel

- Ship has **600 fuel units** (represents 10 minutes of flight time)
- **Fuel consumption: 1 fuel unit per 10 distance units**
- Each route has a distance value → fuel cost = route distance / 10
- Engine upgrade reduces consumption rate (-10% per level)
- Fuel = 0 and not docked → **DEATH** (stranded in space)
- Player sees exact fuel cost of selected route before committing

### Refuel

- Available at **all stations**
- Cost: **1 credit per 10 fuel units** (60 credits for a full 0→600 refuel)
- Example: 200 fuel missing → 20 credits

### Repair

- Available at **all stations**
- Cost: **20% of current run credits** for a **full hull restore** (regardless of damage amount)
- Dynamic: cheap when poor, expensive when rich → incentivizes repairing early

### Flight & Encounters

The flight corridor is **2× screen width** for freedom. Ship flies freely on Z-axis between encounters using ZQSD. Encounters trigger at **random distance intervals with minimum 2 minutes between encounters**.

#### Encounter count per route (Fibonacci)

| Danger Level | Encounters per route |
|-------------|---------------------|
| 1 | 1 |
| 2 | 1 |
| 3 | 2 |
| 4 | 3 |
| 5 | 5 |

Same encounter type can appear multiple times on one route.

#### Encounter types

| Encounter | Interactive | Success outcome | Failure outcome |
|-----------|------------|-----------------|-----------------|
| **Asteroid field** | Dodge 4-directional (ZQSD) | No damage | Lose 5-15% hull |
| **Pirate ambush** | Manual crosshair turret (mouse aim + click). ~5 shots to kill. Spawns 1 ship per 5 min of route time. | Pirates destroyed | Lose 10-25% hull + lose 10-30% cargo |
| **Distress signal** | Choice: investigate / ignore | Rescue crew → faction rep + credits reward | Nothing |
| **Solar flare** | Brace (press Space within time window) | No damage | Lose 10-30% shield |
| **Mining claim** | Choice: extract / skip | Free ore cargo (costs extra fuel) | Nothing |
| **Black market rendezvous** | Choice: trade / decline | Sell contraband at 2x price, risk follow-up pirate attack | Nothing |
| **Jump gate anomaly** | Choice: enter / reroute | Shortcut to another system (skips remaining route) | Random hull damage 5-20% |
| **Empty transit** | None | Peaceful leg | N/A |

Encounter duration: **5-15 seconds**. ECM Jammer: **40% chance to skip pirate encounters, rolled once per route** (not per encounter — either all pirate encounters on that route are skipped or none are).

### Cargo & Economy

#### Cargo types

| Type | Base price | Weight (t) | Notes |
|------|-----------|-----------|-------|
| Food | 10 | 1 | Stable demand everywhere |
| Ore | 8 | 3 | Bulky, low value per ton |
| Tech | 25 | 1 | High value, attracts pirates |
| Medicine | 15 | 1 | Stable, moderate value |
| Weapons | 20 | 2 | Contraband in Federation systems (can still carry — risk/reward) |
| Artifacts | 50 | 1 | Rare, one per run max, highest value |

#### Buy/sell limits
- **Buy**: up to remaining cargo hold capacity. No per-station cap (other than supply availability).
- **Sell**: any quantity, up to what you hold.

#### Pricing per system type

Sell modifier = price system pays YOU. Buy modifier = price system CHARGES you. Final price = base price × modifier.

| System Type | Food | Ore | Tech | Medicine | Weapons | Artifacts |
|------------|------|-----|------|----------|---------|-----------|
| Trade Hub | sell:90 / buy:110 | sell:80 / buy:120 | sell:150 / buy:80 | sell:110 / buy:95 | sell:100 / buy:100 | sell:130 / buy:70 |
| Mining Outpost | sell:110 / buy:90 | sell:50 / buy:200 | sell:200 / buy:50 | sell:105 / buy:95 | sell:80 / buy:120 | sell:100 / buy:100 |
| Pirate Den | sell:120 / buy:80 | sell:90 / buy:110 | sell:110 / buy:90 | sell:130 / buy:70 | sell:180 / buy:50 | sell:150 / buy:60 |
| Research Station | sell:100 / buy:100 | sell:100 / buy:100 | sell:180 / buy:60 | sell:120 / buy:80 | sell:70 / buy:130 | sell:200 / buy:40 |
| Refugee Colony | sell:80 / buy:130 | sell:120 / buy:80 | sell:90 / buy:110 | sell:160 / buy:70 | sell:60 / buy:140 | sell:90 / buy:110 |
| Black Market | sell:140 / buy:70 | sell:130 / buy:80 | sell:160 / buy:60 | sell:140 / buy:70 | sell:200 / buy:40 | sell:250 / buy:30 |

#### Supply & Demand

- Each system stocks a limited quantity of each good (20-50 units at generation)
- Buying depletes supply → prices rise
- Selling floods supply → prices fall
- Quantities reset when leaving and re-entering a system

#### Edge cases

- **Empty cargo hold**: allowed — fly with nothing.
- **No arbitrage possible**: if all reachable systems offer identical or worse prices than your purchase price → run is deadlocked. Player must return home or abort. Returning home with a loss is still a **success** (you survived).
- **Supply hits 0**: can't buy more. Normal.
- **Contraband in hostile space**: you can carry Weapons in Federation space. The risk is purely through encounters, not automatic seizure.

### Run Scoring

- **Success**: returning to home port alive. Always counts as success regardless of profit/loss.
- **Profit/loss displayed** on success screen — profit earns persistent credits, loss earns zero persistent credits.
- **Distance bonus**: +10% of total run credits for each system beyond the first visited (applied at success).

### Ship & Upgrades

**Starting ship** — "Hauler Mk I": cargo 20t, fuel 600, hull 100, shield 50, speed 1.0x, no weapon

**Upgrade slots** (buy in home port meta-progression, applied to current ship):

| Upgrade | Effect | Max Level | Cost formula |
|---------|--------|-----------|-------------|
| Cargo Bay | +10t capacity | 5 | level × 50 persistent |
| Engine | +20% speed, -10% fuel consumption | 5 | level × 60 persistent |
| Fuel Tank | +100 fuel capacity | 3 | level × 40 persistent |
| Hull Plating | +20 max hull | 5 | level × 50 persistent |
| Shield Generator | +30 max shield | 3 | level × 45 persistent |
| Weapon Mount | Adds turret for pirate encounters | 1 | 80 persistent (one-time) |
| ECM Jammer | 40% chance to skip all pirate encounters on a route | 1 | 100 persistent (one-time) |

Upgrades apply at run start. No mid-run upgrade purchases.

**Unlockable ships** (one-time persistent credit cost):

| Ship | Cargo | Fuel | Speed | Hull | Shield | Special | Cost |
|------|-------|------|-------|------|--------|---------|------|
| Fast Courier | 10t | 480 | 1.8x | 70 | 30 | No weapon slot | 200 |
| Bulk Transporter | 50t | 900 | 0.6x | 200 | 80 | — | 300 |
| Armed Escort | 15t | 600 | 1.2x | 150 | 60 | Twin guns (double damage) | 350 |
| Smuggler's Run | 20t | 600 | 1.3x | 100 | 50 | ECM built-in, contraband detection immunity | 400 |

### Meta-Progression

Two currencies:
- **Run credits** — earned during a run, lost on death. Used to buy cargo, pay for services.
- **Persistent credits** — 10% of run credits earned at death/success are added to persistent pool. Used for ship upgrades and new ships.

**Starting capital** — unlock at home port: start each future run with bonus credits. 3 levels:
- Level 1: +50 run credits, costs 100 persistent
- Level 2: +100 run credits, costs 200 persistent
- Level 3: +150 run credits, costs 300 persistent

**Crew hire** — deferred to post-MVP (passive bonuses: fuel efficiency, trade prices, pirate deterrence).

#### Economy balance (MVP — intentionally easy)

- Successful run profit target: **200-500 run credits**
- Persistent credits per run: **20-50**
- First upgrade (Cargo Bay L1): **50 persistent** (1-2 successful runs)
- First new ship (Fast Courier): **200 persistent** (4-10 successful runs)
- **Numbers will be tuned upward after playtesting.**

### Faction Reputation

- Each profitable trade (sell price > buy price) with a faction awards **+10% reputation** with that faction
- Neutral faction trades count toward no faction (Neutral stays at 0%)
- Reputation is linear, 0-100%
- Each 10% reputation = **1% better buy prices** and **1% better sell prices** with that faction
- Reputation persists across runs (stored in localStorage)
- Max bonus: 100% reputation = 10% price advantage

## Architecture

### Directory structure

```
src/
  core/
    Game.js              — orchestrator, state machine (HUB/MAP/FLIGHT/ENCOUNTER/SYSTEM/DEATH)
    EventBus.js          — singleton pub/sub
    GameState.js         — singleton: run state + meta state, reset() for new runs
  data/
    ships.js             — ship definitions, stats, upgrade paths, costs
    cargo.js             — cargo type definitions, base prices, weights
    encounters.js        — encounter types, probability weights, damage ranges
    factions.js          — faction definitions, color palettes, price modifiers
    systems.js           — system type definitions, economy modifiers, service costs
    economy.js           — pricing formulas, supply/demand constants
  systems/
    Input.js             — event.code keyboard (ZQSD for flight), mouse for turret + map, wheel zoom
    GalaxyGenerator.js   — procedural node graph: system placement, route connections, economy assignment
    RouteManager.js      — pathfinding (A* for auto-routing home), encounter sequence generation per route
    FlightController.js  — 3D flight segment: free-flight corridor (2× screen width), encounter spawn triggers, first-person camera
    EncounterSystem.js   — encounter logic (asteroid dodge, pirate fight, distress signal, etc.)
    EconomySystem.js     — buy/sell pricing, supply/demand simulation, faction price modifiers
    ShipManager.js       — ship stats, cargo inventory, fuel consumption, damage, upgrades
    MetaProgression.js   — localStorage persistence, upgrade unlocks, ship unlocks, faction rep
    ParticleSystem.js    — engine trails, explosion sparks, jump gate glow, cargo container effects
  entities/
    PlayerShip.js        — ship model, free movement during flight (ZQSD), weapons, damage flash
    CargoContainer.js    — visual cargo boxes on ship hull, changes with cargo load
    EncounterObject.js   — asteroids, pirate ships, jump gates, stations (visual + trigger zone)
  visuals/
    ModelFactory.js      — ship models (Hauler, Courier, Transporter, Escort, Smuggler), station types, encounter objects
    GalaxyRenderer.js    — node graph rendering (orthographic top-down), system dots, route lines, ship icon, nebula background
    FlightScene.js       — builds 3D flight corridor: star layers, parallax, distant bodies, first-person cockpit
    Shaders.js           — fresnel rim, glow pulse (stations/jump gates), engine flame
  ui/
    HUD.js               — DOM overlay: credits, cargo manifest, fuel/shield/hull bars, current system
    GalaxyMapUI.js       — DOM overlay: system tooltips on hover, route danger + fuel cost, adjacent-only click
    EncounterUI.js       — encounter-specific UI (dodge prompt, turret crosshair, choice buttons, QTE timer)
    CargoMarket.js       — DOM overlay: buy/sell panel with prices, quantities, cargo hold view
    DeathScreen.js       — DOM overlay: run summary (systems visited, profit/loss, cargo lost), persistent credits earned
    Tutorial.js          — first-run tooltips explaining trade mechanics
```

### EventBus events

```js
export const Events = {
  // Game flow
  GAME_STATE_CHANGE: 'game:stateChange',     // { from, to }
  RUN_STARTED: 'game:runStarted',
  RUN_ENDED: 'game:runEnded',               // { reason, runCredits, profit, persistentCredits, systemsVisited }

  // Map / route
  SYSTEM_SELECTED: 'map:systemSelected',     // { system } — adjacent only
  ROUTE_CONFIRMED: 'map:routeConfirmed',     // { from, to, danger, fuelCost, encounterCount }
  SYSTEM_ARRIVED: 'map:systemArrived',       // { system }

  // Flight
  FLIGHT_STARTED: 'flight:started',          // { route }
  FLIGHT_ENDED: 'flight:ended',             // { arrived }
  ENCOUNTER_TRIGGERED: 'flight:encounter',   // { type, data }
  ENCOUNTER_RESOLVED: 'flight:encounterDone',// { type, outcome, damage, cargoLost }

  // Cargo / economy
  CARGO_BOUGHT: 'cargo:bought',             // { type, quantity, price, total }
  CARGO_SOLD: 'cargo:sold',                 // { type, quantity, price, total, profit }
  CREDITS_CHANGED: 'economy:creditsChanged', // { amount, reason, newTotal }

  // Ship
  SHIP_DAMAGED: 'ship:damaged',             // { amount, source, newHull }
  SHIP_DESTROYED: 'ship:destroyed',         // { reason }
  SHIP_REPAIRED: 'ship:repaired',           // { cost, newHull }
  FUEL_CHANGED: 'ship:fuelChanged',         // { amount, newTotal }
  CARGO_CHANGED: 'ship:cargoChanged',       // { cargoManifest }

  // UI
  UI_OPEN_MARKET: 'ui:openMarket',          // { system }
  UI_CLOSE_MARKET: 'ui:closeMarket',
  UI_SHOW_DEATH: 'ui:showDeath',            // { summary }
  UI_SHOW_SUCCESS: 'ui:showSuccess',        // { summary }

  // Meta
  META_UPGRADE_BOUGHT: 'meta:upgradeBought',// { upgrade, level, cost }
  META_SHIP_UNLOCKED: 'meta:shipUnlocked',  // { shipId }
  FACTION_REP_CHANGED: 'meta:factionRep',   // { faction, change, newTotal }
};
```

### GameState structure

```js
class GameState {
  constructor() {
    this.game = {
      state: 'HUB',          // HUB | MAP | FLIGHT | ENCOUNTER | SYSTEM | DEATH
      runActive: false,
      paused: false,
    };
    this.ship = {
      id: 'hauler_mk1',
      cargo: 20,             // current tons
      cargoMax: 20,
      fuel: 600,
      fuelMax: 600,
      hull: 100,
      hullMax: 100,
      shield: 50,
      shieldMax: 50,
      speed: 1.0,
      hasWeapon: false,
      hasECM: false,
    };
    this.run = {
      credits: 0,
      startingCredits: 0,
      cargoManifest: {},     // { cargoType: quantity }
      currentSystem: null,
      visitedSystems: [],
      routeHistory: [],
      factionTrades: {},     // { factionId: count }
      profit: 0,             // running profit/loss
    };
    this.meta = {
      persistentCredits: 0,
      upgrades: {},          // { upgradeId: level }
      unlockedShips: ['hauler_mk1'],
      factionRep: {},        // { factionId: 0-100 }
      startingCapitalLevel: 0, // 0-3
    };
    this.galaxy = {
      systems: [],
      routes: [],
      generated: false,
    };
  }

  reset() { /* restore clean run slate, keep meta */ }
}
```

## Game Flow

```
HUB (home port)
  → view galaxy map (procedurally generated cluster, 8-15 systems visible)
  → click adjacent system (highlight route, show danger + fuel cost + encounter count)
  → BUY CARGO at current system's market
  → LAUNCH: free-flight segment with encounters triggering at random intervals (min 2 min apart)
    → each encounter is ~5-15 seconds interactive
    → arrive at next system
  → SELL CARGO, decide: continue trading or return home
  → die in transit → DEATH SCREEN → HUB
  → return to home port (any profit/loss) → SUCCESS SCREEN → HUB
  → HUB: spend persistent credits on upgrades, unlock ships, check faction rep
  → NEXT RUN: galaxy regenerates fresh
```

### Run end conditions

- **Death**: hull ≤ 0 → lose all cargo and run credits, earn persistent credits (10% of run credits earned before death)
- **Success**: return to home port alive → keep run credits, earn persistent credits (10% of profit), +10% distance bonus per system visited beyond first
- **Abort**: manually abort at any station → keep run credits, earn persistent credits (10% of profit), no distance bonus

## Scope-Limited MVP

1. **1 ship** (Hauler Mk I), **3 systems** (Home → Trading Post → Mining Outpost, 2 adjacent routes)
2. **3 cargo types**: Food, Ore, Tech
3. **2 encounters**: Asteroid field (dodge ZQSD) and Empty transit
4. **1 upgrade**: Cargo Bay +10t (level 1 only, 50 persistent credits)
5. **Visual**: ship model, 2 station models, parallax starfield, engine trail particles, bloom on stations, basic flight corridor (2× screen width), first-person camera
6. **HUD**: credits, cargo hold (3 slots + quantities), fuel bar, hull bar
7. **Galaxy map**: simple line of 3 nodes rendered orthographic top-down, adjacent-only click, show fuel cost
8. **Flight segment**: free flight for 15s, encounter triggers at midpoint, system name appears on arrival
9. **Death**: hull ≤ 0 → death screen with run summary → back to home port
10. **Meta-progression**: none yet (no persistent credits) — just validating the loop

## Visual Polish Checklist

- [ ] Engine trail particles (additive blending, tiny cone sprite, ship-color tinted)
- [ ] Station glow pulse (rotating emissive band on station geometry)
- [ ] Jump gate visual (torus ring with animated emissive shader, particle burst on transit)
- [ ] Asteroid break effect (large asteroid → 2-3 smaller fragments on collision)
- [ ] Pirate ship model (dark palette, red rim shader, aggressive geometry)
- [ ] Cargo container model (box with straps, color-coded by cargo type)
- [ ] Ship damage visual (emissive flash on hit, brief scale stagger)
- [ ] Parallax star layers (3 depths at varying speeds, soft-round dot texture, no square PointsMaterial)
- [ ] Nebula backdrop (large transparent plane with noise-based shader at z=-200)
- [ ] Distance fog in flight segments (subtle, hides the end of the corridor)
- [ ] Bloom (threshold 0.4, strength 0.7) — stations and jump gates glow, ship doesn't wash out
- [ ] System dot pulse on galaxy map (breathing glow on reachable nodes, dim on visited)
- [ ] Route line animation (dashed line with moving dots showing active trade flow)
- [ ] Docking approach animation (ship glides into station bay, camera zooms, fade to market screen)
- [ ] Buy/sell visual feedback (credits counter animates, cargo icon appears/disappears with scale pop)

## Pitfalls to Avoid

- **Flight segment too long** — 15-30 seconds per route is the cap. Encounters minimum 2 min apart, random spacing.
- **Economy too complex for MVP** — start with flat buy/sell prices per system type. Add supply/demand later.
- **Galaxy generation disconnected routes** — validate graph connectivity after generation. Regenerate if any system is unreachable.
- **Fuel as a softlock** — player must see fuel cost before committing. Fuel = 0 in transit = death. Fuel = 0 docked = can refuel at 1 credit per 10 fuel units.
- **Cargo not worth the risk** — successful run profit target: 200-500 run credits. First upgrade at 50 persistent (1-2 runs). Deliberately easy, tune upward later.
- **Use event.code, not event.key** — flight controls are ZQSD.
- **Restart cleanup** — clean state on new run. Galaxy regenerates, ship resets to base stats, cargo empty. Remove all event listeners in cleanup. Test 3 restarts in a row.
- **No audio** — don't add AudioSystem. Skip entirely.
- **Map clicks: adjacent only** — player clicks a system connected by one edge to the current system. Shows route info. Must click "Launch" to commit.
- **Pirate ship HP** — 5 shots to kill with basic turret. Twin guns kill in 3 shots. Spawns 1 pirate per 5 min of route flight time.
- **Repair is 20% of current credits** — full restore, one price regardless of damage.
- **ECM rolls once per route** — not per encounter. On success, ALL pirate encounters on that route are skipped.