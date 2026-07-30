# VOID DRIFT — Performance Tuning Seed (2026-07-22)

Use this when the game feels slow and the user wants fewer elements without removing content.

## Proven direction

- reduce non-asteroid entity types globally
- make one biome the dense asteroid belt instead of adding generic entities elsewhere
- cut nebula shells, particle budgets, view distances, and chunk shell size

## Known-good baseline values

```js
CHUNK.SPAWN_AHEAD = 3;
CHUNK.CLEANUP_BEHIND = 2;
CHUNK.ASTEROID_COUNT_VAR = 2;
CHUNK.KEEP_OUT_RADIUS = 280;

NPC.MAX_COUNT = 80;
NPC.VIEW_DISTANCE = 20000;
NPC.SPAWN_CHANCE = 0.38;
NPC.WANDER_SPAWN_CHANCE = 0.70;
NPC.TRAIL_POOL = 180;

PLANET.VIEW_DISTANCE = 14000;
PLANET.SPAWN_CHANCE = 0.18;

BLACK_HOLE.MAX_ACTIVE = 4;
BLACK_HOLE.VIEW_DISTANCE = 34000;
BLACK_HOLE.SPAWN_MAX = 28000;

WORMHOLE.SPAWN_CHANCE = 0.06;
WORMHOLE.VIEW_DISTANCE = 20000;
WORMHOLE.MAX_SPAWN_DIST = 18000;

SHOOTING_STAR.CHECK_INTERVAL = 1.0;
SHOOTING_STAR.SPAWN_CHANCE = 0.35;

PARTICLES.EXHAUST_POOL = 80;
PARTICLES.EXPLOSION_COUNT = 30;
```

## Dense belt seed

One sparse zone:
```js
{ name: 'Glass Rift', min: 10800, max: 13800, asteroidDensity: 0.10, debrisCount: 0,
  nebulaColors: [0x22cc77, 0x66ffaa, 0x116644],
  entities: ['cloud'] }
```

One dense belt:
```js
{ name: 'Drift Belt', min: 2400, max: 7000, asteroidDensity: 2.50, debrisCount: 1,
  nebulaColors: [0xaa6633, 0x885522, 0xcc7744],
  entities: ['asteroid','asteroid','asteroid','asteroid','asteroid','debris'] }
```
