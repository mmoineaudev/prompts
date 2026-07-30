# Black Hole System Integration Pattern

Session-tested approach for a supermassive black hole entity in a Three.js endless flyer.

## Files changed

- `src/level/BlackHoleSystem.js` — new file
- `src/core/Constants.js` — add `BLACK_HOLE` block after existing entities
- `src/core/Game.js` — import, construct, init, update, clearAll on restart, destroy on shutdown
- `src/level/AsteroidField.js` — accept optional gravity helper and apply to rotators

## Lifecycle contract

```js
// construction
this.blackHoles = new BlackHoleSystem(this.scene);
this.blackHoles.init();

// tick
this.blackHoles.update(shipPos, gameTime, dt);

// restart
this.blackHoles.clearAll();

// shutdown
this.blackHoles.destroy();
```

## Disposal safety

_remove() must dispose every created geometry/material, including:
- eventHorizon
- inner
- rim / disk / ring / ring2 if present

Forgetting any one prevents proper restart and leaks GPU memory.

## Visual readability at long range

- Increase base scale (`scaleBase = 10 + random*14` or higher) so the event horizon reads against the starfield.
- Add an inner bright rim torus at event-horizon radius with additive blending; this gives a sharp visible edge.
- Add a wider accretion disk torus for simple silhouette without expensive shaders.

## Gravity coupling

Use an explicit helper method exposed to other systems:

```js
blackHoles.applyGravityToWorld(position, dt);
```

Inject it into `AsteroidField.update(dt, gravityFn)` rather than importing `BlackHoleSystem` inside the asteroid module. A damping multiplier around 0.35 keeps asteroid drift subtle.

## Spawning discipline

- Alternate ahead/behind relative to last spawn direction to avoid building up permanent landmark clusters.
- Reset `_lastHoleSpawnDir` in `clearAll()` so restarts do not inherit stale state.
- Keep spawn distances in `Constants.BLACK_HOLE.SPAWN_MIN/MAX`; do not hardcode ranges inside `_trySpawn`.

## Pitfalls observed

1. Using `write_file` on shared `Constants.js` clobbers unrelated blocks; patch instead.
2. Referencing an undefined variable (`dir`) after refactoring spawn logic; re-read the file after patching.
3. Forgetting to clear new system state in `_restart()` and `shutdown()`; black holes survive restarts and leak if omitted.
