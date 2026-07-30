# VOID DRIFT — ship selection / ready screen launch flow

## Observation

In this project, the ready screen is built by `StartScreen._build()`. Clicking a card calls `_pick(i)`, which sets `chosen=i` and updates the prompt to `READY — <LABEL> CONFIG LOADED\nPRESS SPACE OR CLICK TO LAUNCH`. However, `InputSystem` also calls `_pick(0)` automatically on Space if `chosen < 0`, then `_startRun()` on the next Space press. So the runtime state `GameState.game.selectedPreset` is only populated after an actual `_pick()`.

## Runtime probe recipe

```
(() => {
  const g = window.__game;
  if (!g) return 'NO __game';
  const GameState = window.GameState;
  return JSON.stringify({
    _chosen: g._startScreen?.chosen,
    selectedPreset: GameState?.game?.selectedPreset ? GameState.game.selectedPreset.label : null,
    _rootMounted: !!(g._startScreen && g._startScreen._root && g._startScreen._root.parentNode),
    isPaused: GameState?.game?.isPaused,
  });
})()
```

Expect `_chosen >= 0` and `selectedPreset != null` before pressing Space. If `_chosen == -1`, press Space once to auto-pick preset 0, then press Space again to launch.

## Symptom: ready screen does not advance on Space

Causes, in order:
1. `_chosen < 0` because no click or auto-pick happened. Solution: click a card or press Space once.
2. `_startScreen._root` not mounted. Solution: investigate `_showStartScreen()` / `mount()` flow.
3. `_startRun()` throws before setting `isPaused=false`. Solution: insert try/catch and check console.

## Material warnings

`THREE.Material: parameter 'emissiveIntensity'/'color' has value of undefined` often means optional preset constants are missing. Use guarded fallbacks in constructors:
- `S.WINGTIP_EMISSIVE == null ? 2.0 : S.WINGTIP_EMISSIVE`
- `S.ENGINE_COLOR || 0x44aaff`

## Fatal tick crash pattern

`TypeError: this.<method> is not a function` at `Game._tick` line:
1. grep for `<method>` across `src/`.
2. If only one call site exists, it is a stale invocation from removed internals; remove it.
3. If elsewhere defined, verify `this` binding at the call site.

## StartScreen 3D preview loop pattern

When StartScreen builds per-preset Three.js previews, they render black unless each preview renderer is driven by its own `requestAnimationFrame` loop. Store `{renderer, scene, camera, ship}` in `this._previews` and rotate/render each frame. Cancel the rAF in `destroy()` and dispose renderers/ships.

## New system registry must initialize from existing world state

A new system added to `Game.js` can appear to “do nothing” if its registry never sees already-spawned objects. After creating `WormholeSystem`, call `wormholes.init(chunkManager)` from `_startRun()` so current chunks seed the registry before gameplay starts. Same applies to any system that owns a live registry separate from chunk storage.

## Collision trigger needs explicit in-tick detection

A feature can be available in code yet never trigger because it relies on a small proximity radius or a separate update path that doesn’t run every tick. In the game loop, inspect `shipHits` from `checkShipCollisions()` for entity markers and handle teleport/effects there.

## Perf tuning priority for dense Three.js scenes

Highest-leverage knobs, in order:
1. Reduce per-chunk spawn counts (`ASTEROID_COUNT_VAR`, cloud/debris/collectible counts).
2. Reduce view distance and chunk shell (`SPAWN_AHEAD`, `CLEANUP_BEHIND`, `VIEW_DISTANCE`).
3. Reduce shared-bill sizes (`EXHAUST_POOL`, `EXPLOSION_COUNT`, shooting star `MAX_POINTS`).
4. Reduce geometry subdivision on high-count objects (`SphereGeometry` segments, instanced asteroid detail).
5. Only after the above, reduce post-processing intensity or bloom radius.
