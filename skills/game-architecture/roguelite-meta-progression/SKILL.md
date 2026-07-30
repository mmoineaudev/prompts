---
name: roguelite-meta-progression
description: Architecture pattern for persistent cross-run progression in roguelite games. Two-currency economy, upgrade trees, localStorage persistence, hub/run state machines, faction reputation, and unlock systems. Use when building a game with permadeath runs and persistent upgrades between them.
trigger:
  - roguelite architecture
  - meta-progression design
  - two-currency economy for games
  - hub between runs
  - permanent upgrades across playthroughs
  - persistent progression in browser games
---

# Roguelite Meta-Progression Architecture

Pattern for games where the player has persistent progression across runs — permadeath runs with permanent upgrades that survive death. Suitable for dungeon crawlers, space haulers, mining descent games, and any roguelite loop.

## Core Concept — Two State Scopes

| Scope | Lifetime | Contents | Storage |
|-------|----------|----------|---------|
| **Run state** | Single play session | Position, health, inventory, floor number, run currency | `GameState` (in-memory, clean `.reset()` on new run) |
| **Meta state** | Across all runs | Persistent currency, unlocked upgrades, faction rep, ship unlocks | `MetaProgression` (localStorage, survives browser close) |

Every roguelite has these two scopes. The tension between them — "I want to go deeper for better loot but risking my run cargo" — IS the game loop.

## Two-Currency Economy

The signature pattern. Two currencies create the risk/reward tension:

```
RUN CURRENCY (spent during run)
  → earned: enemies, chests, trade profits, ore mining
  → lost: on death (all unspent run currency gone)
  → spent: gear, items, services, cargo during the run

PERSISTENT CURRENCY (spent between runs)
  → earned: % of run currency converted at death/success (typically 10%)
          + milestone bonuses (first boss kill, deepest floor, etc.)
  → never lost: once earned, it's permanent
  → spent: permanent upgrades, ship unlocks, stat boosts, faction rep
```

Conversion formula:
```javascript
persistentEarned = Math.floor(runCredits * PERSISTENT_FRACTION) + milestoneBonuses;
// PERSISTENT_FRACTION typically 0.10
```

This makes death feel productive (you always leave with something) without removing the sting of losing what you carried. The player grinds toward the next upgrade even on failed runs.

## Meta-Progression State Shape

```javascript
class MetaProgression {
  constructor() {
    this.persistentCredits = 0;
    this.upgrades = {
      cargoBay: 0,     // level 0-5
      engine: 0,       // level 0-3
      fuelTank: 0,     // level 0-3
      hullPlating: 0,  // level 0-5
      shieldGen: 0,    // level 0-3
    };
    this.unlockedItems = ['starter_sword'];  // first item always available
    this.unlockedShips = ['hauler_mk1'];     // starter ship
    this.factionReputation = {
      federation: 0,
      pirates: 0,
      merchants: 0,
      scientists: 0,
    };
    this.runHistory = [];   // { depth, enemiesKilled, creditsEarned, date }
    this.achievements = []; // ['first_kill', 'depth_100', ...]
    this.settings = {
      difficultyModifier: 0,  // -1 (easier) to +3 (harder)
    };
  }
}
```

## localStorage Persistence

```javascript
const STORAGE_KEY = 'mygame_metaprogression';

export function saveMeta(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Meta save failed (quota?):', e);
  }
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new MetaProgression();
    const parsed = JSON.parse(raw);
    return Object.assign(new MetaProgression(), parsed);
  } catch (e) {
    console.warn('Meta data corrupted, resetting:', e);
    return new MetaProgression();  // safe fallback
  }
}
```

**Corruption guard**: always validate parsed JSON. If parsing fails or required fields are missing, silently reset to defaults. Never crash the game over corrupted localStorage.

## Upgrade Trees

Escalating costs, visible diminishing returns:

```javascript
const UPGRADE_DEFS = {
  cargoBay: {
    name: 'Cargo Bay',
    maxLevel: 5,
    costs: [50, 150, 400, 800, 1500],
    effects: [10, 15, 20, 25, 30],  // +capacity per level
    description: 'Increases cargo capacity by +{value}t',
  },
};
```

Cost curve: each level costs ~2-3x the previous. The first upgrade costs 1-2 successful runs. The final level requires mastery (10+ runs). This creates a satisfying progression arc without making the early game feel grindy.

## Hub State Machine

The hub is its own game state, rendered in the same 3D style as the game (not a separate HTML page):

```
HUB_ENTRY → { Workshop | Hangar | Merchant | Shrine | DataTerminal }
          → LAUNCH_RUN → generate new run state → reset GameState
          → DUNGEON/GAMEPLAY → die or succeed
          → convert runCredits → save MetaProgression
          → HUB_ENTRY (with new credits available for spending)
```

Hub NPC archetypes:
- **Blacksmith** — weapon/equipment unlocks (start with better gear next run)
- **Merchant** — consumable unlocks (start with potions/bombs)
- **Trainer** — permanent stat upgrades (+heart, +speed, +damage)
- **Shrine** — difficulty modifiers (enemy HP multiplier, gold multiplier)
- **Shipwright** — alternate vehicles/ships with different stat profiles

## When to Use This Pattern

**Use when:**
- The game has permadeath (die = lose run progress)
- The player needs to feel progression even after failed runs
- There are unlockable abilities, ships, or permanent stat upgrades
- You want replayability through incremental power growth

**Don't use when:**
- The game is a single-session experience (arcade, linear story)
- Progression is entirely level-based with checkpoints/saves
- The game has no death penalty (casual, infinite-retry)

## Common Pitfalls

- **Run currency loss on death is too punishing** — if players lose 100% of everything, runs feel wasted. The 10% conversion buffer makes death sting without feeling pointless.
- **Grind wall** — if the first upgrade costs 10 successful runs, players quit. First upgrade should cost 1-2 runs. Last upgrade should cost 10+ runs.
- **LOCALSTORAGE QUOTA** — browsers limit localStorage to ~5MB per origin. Store only compact JSON (upgrade levels, not full run logs). Never store binary data.
- **Corruption cascade** — if loading meta-progression throws an error, the entire game breaks. Always wrap in try/catch with a safe fallback.
- **Cheating by clearing localStorage** — don't fight this. If the user clears their browser data, they reset to defaults. Accept it.
- **Hub as afterthought** — the hub is where the player spends 50% of their time. Give it visual care (same art style as the game, ambient animations, NPCs with idle cycles).
- **Infinite scaling** — cap all upgrade levels. "Cargo Bay +999" is not meaningful gameplay. 3-5 levels per upgrade is the sweet spot.

## Reference Implementations

See concrete examples in game design prompts at `~/Documents/games-benchmarks/`:
- `prompt-dungeon-crawler.md` — 4 hub NPCs, weapon/passive/stat upgrade trees, faction rep
- `prompt-space-hauler.md` — two-currency economy, 8 upgrade slots, 4 unlockable ships, faction trading
- `prompt-mining-descent.md` — resource system as soft meta-progression, ore conversion, alternate vehicles
