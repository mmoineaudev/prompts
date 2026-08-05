# Dungeon Crawler Visual — Reproduction Specification (v1)

**Source of truth for re-implementing the game with any future model.** Everything in this document is binding: the numbers, the rules, the formulas, the order of operations. A faithful re-implementation must match the mechanics here exactly and must pass the verification suite in §18.

**Scope rule — graphic elements are deliberately unspecified.** Colors, palettes, mesh geometry, prop shapes, textures, particle visuals, post-processing look, HUD styling, and audio are intentionally left to the implementer's judgment. The game's *identity* (biome themes, weapon silhouette per tier, Dark-Souls-style HUD) is specified at the level of *what the player experiences*, never as pixel recipes. What IS binding: every number that affects gameplay (damage, HP, speeds, ranges, timings, counts, weights, probabilities, formulas), every rule, every state transition, every budget that keeps the game at its 30 fps floor.

Reference implementation: a Three.js + Vite browser game (raw Three.js, no framework, no game engine, no audio). It uses procedural canvas textures only — no asset files. The game runs a per-level timed descent through a procedurally generated dungeon; the player is a first-person character with a melee sword and an orb-projectile weapon, fighting skeleton-family enemies for orbs (ammo + score), descending through a 10-biome ladder, with an elite system, a periodic boss, temporary buffs, a leaderboard, and a New Game+ mode.

---

## 1. Game identity & design pillars

- **The descent**: endless, level-by-level descent. Each level is a procedurally generated dungeon with an entrance and a golden exit portal; reaching the exit advances to the next level. The level number never resets except on death.
- **Orb economy as risk/reward**: orbs are BOTH ammo and score. Kills drop orbs; you spend orbs to shoot; holding orbs makes the sword bigger/stronger AND makes the game spawn more enemies (more pressure, more drops). Dying costs you everything on a fresh run, or 10% of banked orbs on NG+.
- **Souls-ladder progression**: a separate monotonic counter (lifetime orb pickups) drives a 6-tier sword evolution, from a crude blade to a lightsaber that throws electric arcs. The tier is communicated by the weapon's form and a toast — never by a number on the HUD.
- **Escalation without reset**: enemy count, enemy speed/attack, and the timer all scale with level; biomes cycle underneath. Boss kills permanently buff all mobs (+10% speed/attack each). NG+ stacks +100% enemy HP per cycle.
- **Timed pressure**: 180 seconds per level. Run out → the run ends. The timer is central to the HUD.
- **Buffs**: temporary, powerful, one at a time, looted from broken crates/barrels (or boss kills). Never the same buff twice in a row.
- **Souls-like HUD**: hearts top-left (red bar), gold "Souls" counter, weapon slot, dark-fantasy panels. All HUD elements represent real state; no fake meters.
- **Performance is a hard requirement**: 30 fps floor. The game self-degrades (§16) when fps sags.

---

## 2. Controls

All binds use `event.code` (physical key position, not layout label) — this makes AZERTY/QWERTY layouts work with zero rebinding: on AZERTY, `KeyW` is the physical Z key, `KeyA` is the physical Q key.

| Action | Bind | Type | Notes |
|---|---|---|---|
| Move forward | `KeyW` (Z on AZERTY) | hold | base speed 4 u/s |
| Move back | `KeyS` | hold | |
| Strafe left | `KeyA` (Q on AZERTY) | hold | |
| Strafe right | `KeyD` | hold | |
| Sprint | `ShiftLeft` / `ShiftRight` | hold | ×1.55 speed, FOV kick, +5%/5s acceleration tier |
| Look | mouse | pointer-locked | sensitivity 0.002 rad/px, pitch clamp ±85° |
| Fire orb | Mouse 0 (LMB) | hold | one click = one step of the 3-step sequence; hold keeps stepping at 0.22 s |
| Sword attack | Mouse 2 (RMB) | edge press | 3-hit combo; press again inside the 0.34 s window to chain |
| Fireball (buff) | Mouse 2 (RMB) | hold | only while FIREBALL buff is active; free, 0.35 s cooldown |
| Descend | `KeyE` | edge | only inside the exit room and while the portal is open |
| Toggle post-processing | `KeyP` | edge | default ON |
| Leaderboard panel | `Tab` | edge | |
| Restart / New Game+ (death screen) | `KeyN` / `KeyY` | edge | also clickable buttons |
| Pointer lock | click on canvas | — | RMB context menu suppressed |

---

## 3. Run structure & meta-loop

- **Level flow**: spawn at the entrance room → explore → kill enemies → collect orbs → reach the golden exit → press E → next level. The exit portal is hidden/closed on boss levels until the boss dies.
- **Boss cadence**: every 7th level (`BOSS.INTERVAL = 7`) is a single-boss arena: levels 7, 14, 21, 28… The boss biome overrides the normal biome ladder on those levels.
- **Timed run**: `TIMED_RUN.LEVEL_TIME_LIMIT = 180` seconds per level. `levelTime` counts up while playing; at 180 s the run ends (reason "time"). The run timer never pauses between levels (except while the loading/title screen holds, and during the safe-spawn countdown it does not tick either — it starts when play actually begins).
- **Death**: any lethal damage ends the run (reason "dead"). On death, the run is submitted to the leaderboard and the death screen offers **Restart [N]** (fresh run, level 1, everything reset) or **New Game+ [Y]**:
  - NG+ starts at `max(1, floor(level / 2))`, keeps `floor(bankedOrbs * 0.9)` orbs, increments `ngPlus`, and keeps `bossKills`. Mobs get +100% HP per NG+ cycle (`enemyHpMultiplier = 1 + ngPlus`).
  - A fresh restart: level 1, 0 orbs, ngPlus 0, bossKills 0, max health 3.
- **Level advance** (E at exit, non-boss or boss-after-death): keeps `runTime`, `level + 1`, `collectedOrbs`, `ngPlus`, `bossKills`, `soulsEarned`, `weaponTier`, `maxHealth` (permanent hearts), and carries an active buff with **×5 its remaining time, capped at 90 s**. Health always starts a new level at full.
- **Boss defeat**: `bossKills++` (permanent +10% movement AND attack speed for all mobs, multiplicative), a 5-minute buff (uncapped duration), +1 permanent max heart (heal +1), and the exit portal opens.
- **Loading/title screen** (each level): shows level number, biome name, active buff + description, and live stats (Souls, DMG ×, Orb DMG, Reach, Enemy HP, Mob speed, Spawns, Regen). It lifts when: the rolling average fps over a ~3 s window is ≥ 30 AND the enemy spawn queue is fully drained, or after a hard max-hold of 8 s. When it lifts: `safeSpawn = 5 s` and `invulnTimer = 5 s` (player rooted + invincible, mobs idle, countdown shown).

---

## 4. World generation

Seeded random (mulberry32), seed stored in state per level.

### 4.1 Grid parameters
| Param | Value |
|---|---|
| Grid size | 12–16 cells (random) |
| Cell size | 6 units |
| Corridor width | 1 cell |
| Wall/ceiling height | 20 units |
| Player eye height | 1.7 |
| Rooms per level | 8–12 |
| Room min distance | 1 cell margin |
| Dead-end corridors | 0–4 |
| Max room placement attempts | 200 |

### 4.2 Algorithm
1. Fill the grid with `empty` cells.
2. **Place rooms**: repeatedly pick a room type (weighted, see 4.3), pick a size within the type's min/max, pick a top-left cell, reject if it overlaps (with 1-cell margin) anything; carve. Stop at the room count or after 200 attempts.
3. **Connect rooms**: Prim's MST over the complete graph using Manhattan distance between room centers; carve L-shaped (or Z-shaped) 1-cell corridors between connected centers; then add up to `min(3, floor(n/3))` extra short loop corridors.
4. **Dead ends**: add 0–4 one- or two-cell dead-end stubs off existing corridors.
5. **Entrance/exit**: entrance = the room nearest the top-left corner (min `cx + cz`); exit = the farthest reachable room cell by BFS distance over non-empty cells from the entrance.
6. Cell metadata records `roomType` per cell; corridor cells are `corridor`.

### 4.3 Room type catalog
Base weights (relative; a room is picked with weight / total eligible weight):

| Room | Base weight | Size (cells) | Gameplay notes |
|---|---|---|---|
| CHAMBER | 40 | 2–3 × 2–3 | generic room |
| HALL | 35 | 1–2 × 1 | connector |
| VAULT | 25 | 3–4 × 3–4 | treasure room, water puddle |
| ARMORY | 10 | 3 × 3 | weapon racks + breakables |
| LIBRARY | 10 | 3 × 3 | bookshelves; Skeleton-only enemies |
| CRYPT | 10 | 2–3 × 2–3 | sarcophagi (interactive) |
| MUSHROOM_GROVE | 8 | 2–3 × 2–3 | mushroom clusters; rats +50% |
| ARENA | 6 | 4 × 4 | combat setpiece: +2 spawn slots, first spawn roll is guaranteed elite |
| CRYSTAL_CHAMBER | 8 | 2–3 × 2–3 | signature room of CRYSTAL_DEPTHS |
| TEMPLE | 8 | 3 × 3 | signature room of GOLDEN_TEMPLE |

**Eligibility** (room → biomes, `'all'` = every biome): CHAMBER/HALL/VAULT/ARENA = all; ARMORY = STONE, VOLCANIC_DEPTHS, GOLDEN_TEMPLE, EMBER_FORGE; LIBRARY = STONE, HAUNTED_CRYPT; CRYPT = HAUNTED_CRYPT; MUSHROOM_GROVE = FUNGAL_CAVERN, POISON_SWAMP; CRYSTAL_CHAMBER = CRYSTAL_DEPTHS; TEMPLE = GOLDEN_TEMPLE.

**Room-weight modifiers per biome** (multiplier on the base weight, 0 excludes):

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

---

## 5. Biomes

Cyclic ladder, 2 levels per biome: `biomeIndex = floor((level-1) / 2) % 10` over the sequence, EXCEPT boss levels (every 7th) which use the boss arena biome (SPECTRAL_COURT) instead:

```
SEQUENCE = [STONE, HAUNTED_CRYPT, FUNGAL_CAVERN, VOLCANIC_DEPTHS, FROZEN_HALLS,
            CRYSTAL_DEPTHS, POISON_SWAMP, GOLDEN_TEMPLE, FLOODED_RUINS, EMBER_FORGE]
```

Levels 1–2 STONE, 3–4 HAUNTED_CRYPT, 5–6 FUNGAL_CAVERN, 7 boss, 8 VOLCANIC_DEPTHS, 9–10 FROZEN_HALLS, 11–12 CRYSTAL_DEPTHS, 13 POISON_SWAMP, 14 boss, 15–16 GOLDEN_TEMPLE, 17–18 FLOODED_RUINS, 19–20 EMBER_FORGE, 21 boss, 22 STONE (cycle restarts)…

**Difficulty never resets** on biome change: enemy scaling, spawn slots, and the timer continue. A biome is fixed for the whole level (applied at level build, never mid-level).

### 5.1 Biome identity (what the player experiences — visuals are the implementer's choice)

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

### 5.2 Per-biome rules (binding, gameplay-relevant)

- **Torch mode**: each biome has `torchMode` = `'standard'` (torches on every exposed grid edge) or `'vaultOnly'` (torches ONLY inside VAULT rooms). `vaultOnly`: FUNGAL_CAVERN, POISON_SWAMP. These are the torchless biomes, lit by their own glow sources.
- **Braziers**: one lit brazier per room of the biome's `brazierRooms` list — `['HALL']` for every biome except GOLDEN_TEMPLE, which uses `['HALL', 'TEMPLE']`.
- **Hazards**: lava pools (1–2/room) in VOLCANIC_DEPTHS and EMBER_FORGE (same lava rules); acid pools (1–2/room) in POISON_SWAMP. Both: standing within 1.2 u of the pool center takes 1 damage per 0.8 s tick (i-frames respected). Pools never spawn within 3 u of the exit marker.
- **Wisps**: 1–2 per CRYPT room in HAUNTED_CRYPT; exactly 1 per room (aqua tint) in FLOODED_RUINS. Wisps patrol a circle of radius 2 u at y 1.2 around the room center, bouncing at room bounds.
- **Mushrooms**: 3 clusters per MUSHROOM_GROVE, 1 per other room in FUNGAL_CAVERN; toxic variant in POISON_SWAMP (same rules, different look).
- **Crystal lamps**: 1 cluster per room in CRYSTAL_DEPTHS (violet); 2 clusters per room in FROZEN_HALLS (ice).
- **Ice crystals / chandeliers / candles / chains** are atmospheric light props with per-room counts; all are decorative+light and never gameplay-critical.
- **Spawn weights**: per-biome enemy mix, see §10.4. Wraiths are crypt-exclusive (weight 0 everywhere else). Brutes peak in EMBER_FORGE (35) — the last rung of the cycle is the danger rung.
- **Light budget invariant** (see §16): every biome's per-level point-light count must stay ≤ the heaviest existing biome (avg 154 / max 199 measured), verified by the probe.

---

## 6. Player mechanics

### 6.1 Movement
- Base speed 4 u/s; sprint ×1.55 (FOV +8 while sprinting).
- **Sprint acceleration**: holding Shift + moving for `SPRINT_ACCEL_WINDOW = 5` consecutive seconds grants `SPRINT_ACCEL_STEP = +5%` sprint speed per tier, cumulative, stacking multiplicatively on the 1.55 base; resets to 0 the moment sprinting stops (or during safe spawn).
- Movement is sub-stepped (max 0.08 u per step) with circle-vs-AABB collision resolution (player radius 0.35) after every sliver — a large frame dt can never tunnel through a wall.
- Camera: pointer-locked mouse look, yaw/pitch, pitch clamp ±85°, sensitivity 0.002.
- **Safe spawn**: at each level start the player is rooted (camera look works, no movement/attacks) and invincible for 5 s with a visible countdown; mobs do not track or attack during it.

### 6.2 Health
- Max health 3 (`PLAYER.MAX_HEALTH`), +1 permanent heart per boss kill.
- Damage application: any hit sets `invulnTimer = 0.8 s` (i-frames); damage is ignored while invulnerable. Taking a hit triggers a damage flash + screen shake (0.25 s) and resets the regen clock.
- **Passive regen**: after 20 s without taking a hit, restore +1 heart every 5 s, capped at max. Never regen while dead or while the game-over screen is up.
- **Health pickups**: 15% chance per kill to drop one; collecting it restores ALL empty hearts (full heal). 

---

## 7. Combat — the sword

### 7.1 Combo
Right-click (edge-triggered) starts/extends a 3-step combo. State machine: windup → slash → recover → (window) → next step, with a final cooldown. One damage application per strike, hitting ALL enemies in the cone (multi-hit) plus breakables and enemy projectiles in the swing path.

| Step | Windup | Swing | Recover | Damage | Arc (cone half-angle) | Notes |
|---|---|---|---|---|---|---|
| 1 | 0.10 s | 0.16 s | 0.14 s | 2 | ±68° (0.38π) | diagonal slash |
| 2 | 0.08 s | 0.15 s | 0.14 s | 2 | ±68° (0.38π) | opposite diagonal |
| 3 | 0.12 s | 0.18 s | 0.20 s | 3 | ±16° (0.09π) | piercing thrust, range ×1.25 |

Combo window: 0.34 s from each recover start (0.14 recover + 0.20 input grace); a press inside it (or buffered during it) chains to the next step. Cooldown between combos: 0.30 s. Attack speed multipliers (buffs) scale the duration fields only, never damage/arcs.

### 7.2 Formulas
- **Base damage** per step (tier 0): 2 / 2 / 3.
- **Damage with evolution**: `swordHitDamage(step, tier) = base + tier` (pure function; tier 5 → 7 / 7 / 8).
- **Applied damage**: `currentDamage = swordHitDamage(step, tier) × damageMult` where `damageMult = 1 + (scale − 1) × 0.5` (bigger sword = more damage; at 3× scale damage is ×2).
- **Range**: `SWORD.RANGE (2.2) × scale × (1 + 0.04 × tier)`; the thrust multiplies by 1.25.
- **Scale** (orb growth): `scale = min(orbPowerMultiplier(orbs) × lengthMult, 5.0)` where `orbPowerMultiplier(orbs) = 1 + min(floor(orbs/10), 15) × 0.2` (i.e. +20% per 10 orbs, capped ×4 at 150) and `lengthMult` is the EMPOWERED buff multiplier. The same orb power multiplier drives enemy spawns (§10.1) — banked ammo is the game's risk/reward lever.
- **Hit-stop**: any sword hit sets `hitStop = 0.06 s` — world updates freeze (camera shake still runs).
- **Blade flash** on hit: brief emissive/color flash (0.1 s).

### 7.3 Evolution (the Souls Ladder)
A new monotonic state counter, `soulsEarned`, increments by 1 on EVERY orb pickup (never on health/buff pickups). It persists across levels (but resets on a fresh run; NG+ keeps it — it is carried like `collectedOrbs`).

- Tier: `min(floor(soulsEarned / 100), 5)`.
- Every tier: **+1 damage per hit** and a NEW weapon form (silhouette, color identity — see table). Progression is strictly cumulative; forms never revert.
- **Tier table** (form identities; exact visual recipes are the implementer's choice):

| Tier | Souls | Form identity | Damage | Effects |
|---|---|---|---|---|
| 0 | 0–99 | crude executioner's blade | 2/2/3 | 1% legendary electric proc |
| 1 | 100–199 | proper knight's arming sword (crossguard) | 3/3/4 | — |
| 2 | 200–299 | runic greatsword (glowing runes) | 4/4/5 | — |
| 3 | 300–399 | crystal soulblade (faceted crystal) | 5/5/6 | arc bolt 10% per landing strike |
| 4 | 400–499 | white-hot soulfire greatblade | 6/6/7 | arc bolt 35% per strike |
| 5 | 500+ | lightsaber throwing electric arcs | 7/7/8 | 2 arc bolts on EVERY landing strike + idle crackle |

- **Range**: +4% reach per tier, stacked on the orb ladder.
- **Electric proc** (all tiers): on any landing strike, 1% chance (`SWORD.ELECTRIC_CHANCE = 0.01`) to chain a blast that kills every enemy within `SWORD.ELECTRIC_RANGE = 20` u of the player (screen shake + hit-stop 0.12 s + message). The blast and arc bolts can both fire on the same strike.
- **Arc bolts** (tiers 3–5): pooled homing projectiles (pool of 8; 2 bolts × 3 steps = 6 max in flight). On a landing strike, roll `ARC_CHANCE[tier]`; spawn `ARC_BOLTS[tier]` bolts at the player aimed at the nearest ALIVE enemy within 20 u. Bolts fly at 24 u/s for 1.2 s, re-target the nearest alive enemy if their target dies, deal a flat 1 damage on impact, and fizzle at life end. They only target enemies (never props).
- **Evolution feedback**: on tier-up — toast (`Your blade awakens — Tier N`; final: `Your blade is whole — the lightsaber sings`), blade flash, and a 0.1 s non-blocking hit-stop. The form rebuilds on level start from the stored tier.
- **Form constraints** (binding taste rules): every blade is straight (no bends), the weapon floats (no hands/arms attached to the camera), it is never lit by the headlight (self-lit), and casts no shadow. Tier 5 adds exactly ONE extra camera-attached point light (budget §16).
- The blade color/identity stops following the orb-size color ladder at tier 3+ (the form owns its look); the orb ladder keeps driving size and range only.

---

## 8. Combat — the orb weapon

One collected orb = ONE 3-step sequence; ONE click = ONE step (each step aimed at the click-time camera direction).

- **Sequence**: step 1 and step 2 are normal orbs; step 3 (the last) is the explosive finisher. Steps 1–2 bounce up to 3 times off floors, ceilings, and walls (reflecting off the dominant axis) then fizzle on the next surface contact; the explosive step detonates on its FIRST contact with anything (floor, ceiling, wall, prop, enemy, or life end).
- **Ammo**: only the FIRST step of a NEW sequence costs 1 orb (`collectedOrbs--`); steps 2–3 of an open sequence are free. With 0 orbs, firing shows a "No orbs!" message. Holding LMB keeps stepping every `STEP_INTERVAL = 0.22 s`. The sequence stays open `SEQUENCE_WINDOW = 1.2 s` after the last step; a longer pause resets it.
- **Projectile**: speed 12.4 u/s, lifetime 2.5 s, radius 0.3, direct-hit damage = `round(1 × orbDamageMultiplier(orbs))` where `orbDamageMultiplier(orbs) = 1 + 0.02 × orbs` (+2% per held orb).
- **Explosion** (step 3): AOE damage `round(1 × orbDamageMultiplier)` to every enemy within `EXPLODE_RADIUS = 1.5` u of the blast point (only counts if the blast y < 2.6 — ground-level).
- **Breakables**: orb hits break breakables (and continue); the explosion does not double-hit.
- **Enemy projectiles** (magician orbs, archer arrows) are NOT broken by orbs — only by the sword swing (§7.1).
- Pooled projectiles (48 normal + 10 fireball slots), zero per-shot allocation.

**Fireball (FIREBALL buff)**: RMB hurls a free fiery projectile that explodes on first contact (same explosion rules, no ammo cost, `FIREBALL_COOLDOWN = 0.35 s` while held). The sword is hidden while the buff is active.

---

## 9. Combat — temporary buffs

One buff active at a time; picking a new one REPLACES the current, and the roll NEVER repeats the active effect (you always get a visibly different buff).

| # | Buff | Duration | Effect |
|---|---|---|---|
| 1 | BRIGHT | 30 s (cap 90) | level lights up (ambient ×2.5, fog density ×0.35); ALL enemies flee (no attacks) |
| 2 | FIREBALL | 30 s (cap 90) | RMB = free explosive fireball (0.35 s cooldown) |
| 3 | EMPOWERED | 30 s (cap 90) | sword +50% longer, move +20%, attack speed +20% |
| 4 | GODSPEED | 30 s (cap 90) | attack speed +50% AND move speed +50% |
| 5 | HUNTER | 30 s (cap 90) | spectral companion follows the player and lashes enemies (below) |

- **Sources**: breaking breakables (barrels/crates) rolls `BUFF.CHANCE = 6%` per break, increased by orbs held above 100 (`+0.05% per orb above 100`). Boss kills grant a buff of `BUFF.BOSS_DURATION = 300 s` (5 min), NOT capped by the 90 s ceiling.
- **Cap rule**: breakable buffs are hard-capped at `BUFF.MAX_DURATION = 90 s`; boss-kill buffs are uncapped.
- **Level carry**: an active buff carries to the next level at ×5 its remaining time (capped 90 s). Buffs do NOT carry across death/restart.
- **HUNTER companion**: HP 9999 (invulnerable), follows at 6.5 u/s keeping 2.5 u distance, attacks the nearest VISIBLE (line-of-sight) enemy within 7 u with a 2-damage beam; base interval 1.0 s divided by `clamp(collectedOrbs/100, 0.25, 5)` — more banked orbs = faster companion. Beam flash 0.35 s.

---

## 10. Enemies & spawning

### 10.1 Spawn system
Per level (non-boss): compute slots and build a spawn PLAN (data), then reveal one mob every `SPAWN_INTERVAL = 0.5 s` so level-start construction is spread out (the first mob reveals immediately).

- **Slots**: `min(round((2 + (level − 1)) × spawnMult), MAX_ALIVE 16)`; +2 slots if the level contains an ARENA. `spawnMult = 1.1^(level−1) × orbPowerMultiplier(collectedOrbs) + max(0, orbs−100)/100` — banked ammo raises enemy counts (the risk/reward loop).
- **Candidate cells**: any non-empty cell at BFS distance ≥ 6 from the entrance, EXCLUDING the exit room. Candidates are shuffled.
- **Type pick** per slot: biome weight column (§10.4) × room-enemy modifiers, weighted sample.
- **Rats**: a RAT roll spawns a pack of `2–3` rats at one cell (pack size clamped to rat cap 6 and to the live-body cap), each rat a separate body; 0 drops.
- **Elites**: 1-in-10 (`ELITE_CHANCE = 0.1`) per non-rat spawn, only for eligible types (ARMORED, ARCHER, BRUTE, WRAITH). In an ARENA, the FIRST spawn roll is guaranteed elite if its type is eligible.
- **Scaling** (all enemies, every level):
  - Move speed: `speedMult = (1 + 0.05 × (level−1)) × (1 + 0.1 × bossKills)`
  - Attack speed: `attackMult = (1 + 0.05 × floor((level−1)/3)) × (1 + 0.1 × bossKills)`
  - HP: `ceil(hp × (1 + ngPlus))` — +100% per NG+ cycle.
- **Live-body cap**: `MAX_ALIVE = 16` total living enemies (rats counted individually).
- **Boss levels**: the normal spawn plan is skipped; ONE boss spawns at the exit cell (§11).
- **BURN** (§12): not part of the plan; spawns later when the level is cleared.

### 10.2 Shared AI
- States: DORMANT → WAKING → CHASE → ATTACK → DEAD (boss/rat/burn have simplified variants).
- **Chase**: move toward the player when line-of-sight (2D ray vs collision boxes, 0.4 u step, 0.25 radius); when LOS is blocked, greedy 4-neighbor grid pathing toward the player's cell (re-evaluate every 0.3 s, skipping cells whose centers collide). All movement sub-stepped (0.08 u) with circle collisions (radius 0.35) after each sliver.
- **Attack**: when in range and cooldown ready (no LOS gate at point-blank — LOS only gates ranged attacks and long-range pursuit), run windup → swing → recover; the hit lands at swing progress ≥ 0.35 (melee) via an `onAttackHit` hook that deals the type's damage (respects i-frames) or fires the type's projectile. Cooldown set at the end of the cycle.
- **Death**: state DEAD → corpse animation → fade → dispose. On death: drop orbs (§10.5), 15% chance of a health drop, and a purple death burst. (The 1-in-10 elite check and drops are handled here.)
- **Flee (BRIGHT buff)**: all enemies run directly away at their scaled speed, no attacks.
- **Safe spawn**: while the countdown is active mobs stay idle (spawns still drain, bodies exist, but no tracking/attacking). Bosses are gated the same way.

### 10.3 Roster (base stats; all times in seconds)

| Enemy | HP | Speed | DMG | Range | Cycle (windup/swing/recover/cooldown) | Behavior notes | Drops |
|---|---|---|---|---|---|---|---|
| Skeleton | 2 | 2.6 | 1 | 1.6 | 0.35/0.25/0.4/1.2 | melee, no elite | 1 |
| Magician | 2 | 2.6 | 1 | cast 9 | same cycle | fires a slow red orb: 6.2 u/s, life 4 s, radius 0.3, 1 dmg; stops at 0.6×cast range; no elite | 1 |
| Armored Skeleton | 5 | 1.8 | 2 | 1.7 | 0.5/0.3/0.5/1.6 | tank; no block mechanic (armor is HP only) | 2 |
| Archer Skeleton | 2 | 2.4 | 1 | 10 | 0.5/0.1/0.4/1.8 | kites: stops at 8 u, retreats under 4 u at 2.0 u/s; fires a bone arrow 8 u/s, life 3 s, radius 0.15, 1 dmg; needs LOS to attack | 1 |
| Rat (pack) | 1 | 4.2 | 1 | 0.9 | instant/0.8 | packs of 2–3; straight-line chase (greedy step when LOS blocked); no elite; 0 drops | 0 |
| Brute | 8 | 1.2 | 3 | 2.4 | 1.2/0.3/1.2/2.5 | slam hits a ±50° cone (0.87 rad) in front, damage 3 (one-shots a 3-HP player); slow, kitable | 3 |
| Wraith | 2 | 2.4 | 1 | 0.9 | instant/1.0 | PHASES THROUGH WALLS — flies straight at the player, no pathing, no LOS, cannot be body-blocked; touch damage | 2 |

**Elites** (1-in-10; name + stat changes):

| Base | Elite name | HP | Speed | Drops | Notes |
|---|---|---|---|---|---|
| Armored | Warlord | 10 | ×1.3 | 3 | |
| Archer | Sharpshooter | 2 | — | 2 | fires a 2-arrow fan (±8°) |
| Brute | Ogre | 16 | ×1.2 | 4 | scale ×1.9 |
| Wraith | Banshee | 4 | ×1.4 | 3 | |

### 10.4 Spawn weights per biome (sum = 100; order Skeleton, Magician, Armored, Archer, Rat, Brute, Wraith)

| Enemy | STONE | CRYPT | FUNGAL | VOLCANIC | FROZEN | CRYSTAL | POISON | GOLDEN | FLOODED | EMBER |
|---|---|---|---|---|---|---|---|---|---|---|
| Skeleton | 45 | 25 | 30 | 20 | 25 | 30 | 15 | 20 | 20 | 10 |
| Magician | 10 | 10 | 10 | 10 | 10 | 15 | 10 | 10 | 15 | 10 |
| Armored | 15 | 10 | 10 | 25 | 20 | 15 | 10 | 25 | 10 | 25 |
| Archer | 15 | 15 | 5 | 15 | 25 | 20 | 10 | 20 | 15 | 15 |
| Rat | 10 | 5 | 40 | 10 | 10 | 10 | 45 | 10 | 25 | 5 |
| Brute | 5 | 5 | 5 | 20 | 10 | 10 | 10 | 15 | 15 | 35 |
| Wraith | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 10.5 Drops & score
Drop-on-kill: Skeleton 1, Magician 1, Armored 2, Archer 1, Rat 0, Brute 3, Wraith 2, BURN 2, elites base+1. Drops spawn at y 0.8 with ±0.4 u jitter, bob, and AUTO-COLLECT within 1.4 u. Each kill also rolls 15% for a full-heal pickup. The leaderboard scores orbs only.

---

## 11. Boss — the Spectral Lord

Every 7th level. One boss spawns at the exit cell (portal closed until it dies).

- **HP**: `ceil(4 × BOSS.HP_MULT 30)` = **120** (then NG+ HP scaling applies on top).
- **Variant**: one of 7 enemy-themed variants is picked randomly (Skeleton, Armored, Archer, Brute, Wraith, Rat, Magician) — different look/scale/label, identical AI. Labels: BONE LORD / IRON GHOUL / SPECTRAL HUNTER / ASH TITAN / SPECTRAL LORD / VERMIN KING / LICH ARCHMAGE.
- **AI** (self-contained, states CHASE/CHARGING/DEAD):
  - Drift toward the player at 2.2 u/s when farther than 2.5 u.
  - **Charge**: when off cooldown and within 14 u, telegraph then dash at `CHARGE_SPEED = 14 u/s` for `CHARGE_TIME = 0.9 s` along the locked direction; contact within 1.4 u deals `CHARGE_DMG = 1` (once per charge); cooldown `CHARGE_COOLDOWN = 3.2 s` (first charge comes early, ×0.6). Collision radius 0.9.
  - **Summon**: every `SUMMON_COOLDOWN = 6 s`, summons up to `SUMMON_COUNT = 3` projectile-firing wraiths at random candidate cells, capped at `MAX_MINIONS = 6` living summoned wraiths.
- **Defeat**: `bossKills++` (permanent +10% mob move/attack speed), a 5-minute uncapped buff, +1 permanent max heart (+1 heal), portal opens, message. Boss bar shows during the fight (fill color shifts green → amber → red at 50%/25%).

---

## 12. BURN — the final foe

A red-and-black burning figure that does NOT spawn at level start. It rises once the ENTIRE level is cleared (all other living enemies dead, spawn queue drained) — on non-boss, non-arena levels — as a final challenge.

- **HP**: `ceil(3 × 30 × (1 + ngPlus))` = 90 on NG 0 (boss-tier), then NG+ scaling.
- Speed 2.6, melee damage 1, range 1.3, cooldown 1.4 s. Chases straight-line (sub-stepped, collision-resolved like other mobs — it does NOT phase).
- **Ground fire**: while moving, every `FIRE_INTERVAL = 0.6 s` it spawns a fire patch at its position (pooled, visual-only — the patches do NOT damage the player).
- Drops 2 orbs. Dies like any enemy (purple burst). At most one per level.

*(The same pooled fire-patch system is also used by the electric chain blast — visual + light only.)*

---

## 13. Economy & pickups

- **Orbs**: only from kills (drop-on-kill) — none are placed on the map. Auto-collect within 1.4 u. Pickup: `collectedOrbs++` AND `soulsEarned++` (both; the second is the evolution counter). `totalOrbs` (per-level pickup count) exists but is not used for scoring.
- **Health pickups**: 15% per kill; full heal on pickup.
- **Buff pickups**: golden mystery pickup from broken breakables (6% + excess-orb bonus) — see §9. Also from boss kills (granted directly, not a pickup).
- **Breakables** (barrels/crates): HP 1, any damage source breaks them (sword arc, orb hit, stepping on them); no orb drops; 6% buff roll per break (+0.05%/orb above 100); debris + smoke. Max 3 breakables per room.

---

## 14. Difficulty & scaling summary (all binding)

| Source | Effect |
|---|---|
| Level | enemy move speed ×(1 + 0.05(level−1)); attack speed ×(1 + 0.05·floor((level−1)/3)); spawn slots +1/level (×spawnMult, cap 16); spawnMult ×1.1^(level−1) |
| Held orbs | sword scale +20%/10 orbs (cap ×4 at 150); orb damage +2%/orb; spawn multiplier ×orbPower; excess orbs >100 add +1 spawn multiplier per 100 and buff-drop chance |
| Boss kills | +10% mob move AND attack speed each (permanent, multiplicative) |
| NG+ | enemy HP ×(1 + ngPlus); run restarts at floor(level/2) keeping 90% of orbs |
| Timer | 180 s/level, ends the run |

---

## 15. HUD & state mapping (state → element; visuals free)

| Element | State it renders |
|---|---|
| ORBS counter | `collectedOrbs` (banked ammo) |
| Power suffix | sword scale (+% power) |
| Souls line | `soulsEarned` — TOTAL ONLY, no tier/progress (the blade form + toast convey the tier) |
| HP bar + number | `health` / `maxHealth` |
| Level title | `LEVEL n · NG+k — <biome label>` |
| Timer | `180 − levelTime` (m:ss; turns red under 30 s; NG+ suffix) |
| Combo pips | `sword.comboStep` (0–3) |
| Sprint bonus | `sprintSpeedMult` when > 1 |
| Buff badge | `buffEffect` + `buffTime` (m:ss or s; hidden when none) |
| Safe-spawn | `safeSpawn` countdown (big number) |
| Boss bar | boss `hp/maxHp` + variant label; hidden when no boss |
| Stats panel | LIVE tuning coefficients: DMG ×, Orb DMG, Orb AOE, Reach, Sword size, Atk speed, Move speed, Enemy HP ×, Mob speed ×, Spawns ×, Regen |
| Perf warning | degraded mode (§16), bottom-right, hidden at start |
| Damage flash | on any player hit |
| Messages | toasts (goal hints, evolution, ELECTRIC CHAIN, boss defeat, etc.) |
| Prompt | "Click to explore" when pointer unlocked |
| Exit prompt | shown only in the exit room AND portal open |
| Leaderboard | Tab / death screen |
| Loading/title | level, biome, buff, stats; fps gate §3 |

Death screen: stats (level reached, total time, souls, rank #) + Restart [N] / New Game+ [Y].

---

## 16. Performance budgets & degraded mode (binding)

Target: fluid gameplay with a **30 fps floor** on mid-range hardware.

- **Lights**: shadow-casting lights = 8 max (only the 8 torches nearest the player; re-evaluated every 0.5 s; 256px shadow maps). Total point lights per level: every biome must stay ≤ the heaviest existing biome — measured ceiling `LIGHT_CEILING.AVG = 154` average / `MAX = 199` peak (the heaviest biomes are VOLCANIC_DEPTHS and FROZEN_HALLS); torchless biomes (FUNGAL, POISON) must keep torch averages ≤ 10 and peaks ≤ 50. All non-torch lights are shadow-free. Every new light prop counts against the probe.
- **Torch placement**: one torch per exposed grid edge, spacing 16 u, y 2.5; `vaultOnly` biomes place torches only in VAULT rooms.
- **Draw calls ≤ 120**; prop instances ≤ 400/level (repeated decoratives MUST be InstancedMesh — one draw call per type); breakables ≤ 3/room individual meshes.
- **Pools (zero per-frame allocation)**: player orb projectiles 48 (+10 fireball), enemy arrows 10, magician orbs 12, arc bolts 8, pickup rings 8, explosion rings 8 + 6, fire patches 6, smoke 9, death bursts 3, sword sparks 1, trail sprites 1 per pool (3 pools), crackle 3, shockwaves 4, stalactites 60 (instanced), water pools 24 (instanced).
- **Textures**: procedural canvas only; ≤ 16 MB (11 biome sets × 3 × 256 px + shared).
- **Per-frame allocation: 0** — every particle/light/projectile is pooled.
- **Degraded mode (perf safeguard)**: if sustained fps < 30 for more than 10 s (EMA of frame rate; frame hitches > 0.25 s and the title screen excluded), the run enters degraded mode:
  1. `reduceDecorations(0.5)` — a random 50% of the CURRENT level's purely cosmetic props are hidden (rubble, skull piles, blood decals, anvils, chains, candles, ice crystals, mushrooms — their lights included), and the instanced water/stalactite meshes shed their tail instances (count halved).
  2. NEVER touched: hazards (lava/acid), breakables, interactives (sarcophagi), structural props (pillars/bookshelves), and biome light props (crystal clusters, wisps, altars).
  3. A small warning label appears bottom-right: "DEGRADED MODE — decorations reduced for performance".
  4. Once triggered, the run STAYS degraded — every subsequent level builds at 50% decorative density.

---

## 17. Leaderboard & persistence

- Stored in localStorage under one key; top 10 entries.
- Entry: `{ level, time (total run seconds), orbs (banked at death), ngPlus, date }`.
- **Ranking**: NG+ desc → level desc → total time asc → orbs desc. Rank 1 is the best run.
- Written on run end (death or timeout), not on level advance. Panel shows entries with the current run highlighted; `best()` exposes the top entry.

---

## 18. Verification suite (how a re-implementation proves parity)

Headless Node scripts (no browser needed except the smoke test). Expected results:

| Command | Expected |
|---|---|
| `node scripts/dungeon-check.mjs 40` | `broken=0/40` (world-geometry integrity over 40 seeds) |
| `node scripts/biome-check.mjs` | `biome-check: ALL GATES PASS` — 11 gates: sequence = 10 biomes; palettes have all 9 keys; the 5 new biomes' palette VALUES match the spec verbatim; spawn-weight columns sum to 100 with 7 entries; every biome has room modifiers; eligibility resolves (FLOODED_RUINS exempt from themed-room rule); per-biome eligible room weight ≥ 100; every room has PROPS_PER_ROOM; referenced light sources exist; TEMPLE modifier = {ARMORED 1.2}; light probe (default 10 seeds) keeps every biome ≤ avg 154 / max 199 and vaultOnly torch avg ≤ 10 / max ≤ 50 |
| `node scripts/weapon-check.mjs` | `weapon-check: ALL GATES PASS` — 12 gates: EVOLUTION block finite; tier math (0/99/100/199/200/500/999 → 0/0/1/1/2/5/5); damage ladder 2/2/3→7/7/8 + brute breakpoint (8 HP dies in 2 hits at tier 5, armored 5 dies in 1 at tier 3); arc table (lengths = MAX_TIER+1, T5 = 1.0/2, pool ≥ 6); ELECTRIC_CHANCE/RANGE finite + referenced in Game; blade length monotonic 0.76→1.0 + TIP_LOCAL = length × 0.79 + scale clamp ≥ 4; HUD `#souls-line` default exactly `Souls 0` and NO `#tier-pips`; six per-tier form builders + `_formMeshes` registry present; no Torus/TorusKnot geometry in PlayerSword; Game.js writes total-only souls; dungeon-check 0/40 |
| `node scripts/biome-light-probe.mjs` | reproduces the measured §16 table (25 seeds) |
| Headless browser smoke (CDP): boot the game, wait for level build | canvas + WebGL2; HUD ids present (`#orb-count`, `#souls-line`, `#perf-warning`, `#biome-label`, `#timer`, `#hp-fill`, `#combo-pips`, `#weapon-slot`, `#stats-panel`); `#souls-line` = `Souls 0`; `#perf-warning` hidden; biome label = `LEVEL 1 — …`; loading screen passes; timer advances; **zero JS exceptions** |

Additional invariants to hold in-game: memory stable over 3 descends (no texture/light/geometry leaks — the level teardown disposes every level-owned system, keeps the camera + sword + biome texture cache); the camera+sword survive level regens; `window.game` is exposed for QA.

---

## 19. Explicitly out of scope / non-goals

- **All graphic elements** (deliberate): colors, palette hexes, mesh geometry, prop recipes, particle visuals, post-processing look, HUD styling, textures, boss/appearance details, audio. The implementer has full freedom there, within the identity descriptions and the perf budgets above.
- No audio system (visual cues only).
- No save/continue — single-session runs; only the leaderboard persists (localStorage).
- No new frameworks/engines/assets — Vite + raw Three.js, procedural canvas textures only.
- No minimap rendering (`minimapVisible` flag exists but is unused).
- No charged attacks, blocking/parry, or weapon switching — the 3-hit combo is the only sword mode.
- No XP/talents/inventory — progression is orbs, souls, hearts, and NG+ only.
- No procedural non-rectangular rooms — grid-based rectangular rooms only.
- No multiplayer/co-op.
