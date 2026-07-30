---
name: threejs-browser-space-game
description: |
  Workflow for building, debugging, and evolving Three.js browser space/exploration games.
  Covers runtime error triage, biome-variety patterns, preset-specific ship geometry, and safe
  callback wiring in a browser Vite/ESM codebase.
version: 1.0.0
author: Hermes Agent
license: MIT
tags: [threejs, space-game, vite, browser-game, biome, debugging]
triggers:
  - "Three.js space game"
  - "browser space game"
  - "space exploration game"
  - "biome variety"
  - "runtime error threejs"
  - "fatal tick error"
  - "ship preset geometry"
---

# threejs-browser-space-game

> Patterns for building and debugging a live Three.js browser space-exploration game.

## When to use

- A Vite-based Three.js space/exploration game with chunk streaming, biomes,
  NPCs, collectibles, black holes, shooting stars, and ship presets.
- Runtime debugging when the game reports fatal tick errors or console
  material warnings during play.
- Feature work that crosses systems: biome variety, entity allowlists,
  preset-specific geometry, callback binding across modules.

## Runtime error triage (browser live build)

1. **Build first**: `npm run build` must exit 0 before any live inspection.
2. **Read the exact stack trace**: note file:line for every frame.
3. **Inspect the failing source directly**: read the exact region around
   the reported line. The right move is usually a small surgical patch,
   not a broad rewrite.
4. **Rebuild** after every fix.
5. **Verify in-page surgically**: if you must inspect live state, prefer
   one targeted in-page read of object counts / scene graph over
   screenshots or repeated keypresses.

### Pitfall: avoid browser-probe loops after fatal errors

A common failure mode is cycling screenshots/presses after a fatal
tick error. That usually adds noise without signal. The faster path
is direct source inspection + rebuild, because the stack trace already
names the file:line that needs fixing.

## Biome variety pattern

Core idea: each biome declares allowed entity types in one place, and
spawn/clearpaths honor that allowlist.

### Canonical data shape

```
BIOME.ZONES: [
  {
    name: 'Open Space',
    entities: ['asteroid', 'debris', 'crystal', 'boost'],
    ...
  },
  ...
]
```

### Required wiring after refactor

- `BiomeGenerator.getBiomeParams()` must return `entities: zone.entities || []`.
- `ChunkManager._spawnChunk()` must build `const allowed = new Set(params.entities || [])`
  and only call spawn if `allowed.has(type)`.
- Any `*System.generateChunk(...)` that tags chunk-owned objects must
  receive `chunkKey` in its signature; otherwise `clearChunk(key)` will
  silently leak objects across biomes.
- After introducing a new allowed type, add it to the biome allowlist
  and a matching spawn branch in `ChunkManager._spawnChunk()`.

## Preset-specific ship geometry

- Store shape name + visual tuning fields on each preset in `Constants.SHIP.PRESETS`.
- `PlayerShip.init()` branches on `p.shape` and builds a distinct hull
  per preset; shared nacelle/light/flame packages can be placed by
  passing position/size params.
- All material parameters read from preset fields when available; global
  `Constants.SHIP` keys are fallbacks only. This avoids
  `THREE.Material` warnings about `undefined` params.

## Safe callback wiring across systems

When passing an instance method as a callback:

- Bind at the call site: `.bind(this.<instance>)`
- Do NOT rely only on a guard inside the callee; binding is the real
  fix, guards are breadcrumbs.
- After moving/renaming a method, search for all call sites and update
  them. Stale invocations of deleted methods are silent landmines.

## Common failure signatures

- `ReferenceError: X is not defined` after refactor: check both callee
  signature and all call sites.
- `TypeError: this._method is not a function` / unbound `this` inside
  a callback: bind at the call site.
- `MeshStandardMaterial` / `THREE.Material` warning about undefined
  param: define the constant on the preset or config object, with a
  safe numeric fallback, before constructing the material.
- Biome entities leaking across zones after `clearChunk`: verify
  `generateChunk` receives `chunkKey` and tags spawned meshes with it.

## Verification checklist

- `npm run build` exits 0.
- No stale call sites to deleted methods remain.
- Every `*System.generateChunk` that creates chunk-owned objects
  assigns `userData.chunkKey = chunkKey`.
- Every biome allowlisted type has a spawn branch in `_spawnChunk` and
  a matching cleanup in `_evictChunk`.
- Preset-specific material lights/flames read preset fields first,
  global fallbacks second.

## References

- `references/console-error-triage.md` — exact error transcripts and
  fixes observed in browser space-game debugging sessions.