# Void Drift — preset material-parameter warnings / console errors

Date: 2026-07-22
Project: `space-exploration-kimi-k3`

## Observed console errors

- `THREE.Material: parameter 'emissiveIntensity' has value of undefined.`
  - trace: `MeshStandardMaterial -> PlayerShip.js:34 -> Game.js:236`
- `THREE.Material: parameter 'color' has value of undefined.`
  - trace: `SpriteMaterial -> PlayerShip.js:125 -> Game.js:255`
- `[Game] Fatal tick error: TypeError: this._enforceBlackHoleGravity is not a function`
  - at `Game._tick` after black-hole system integration

## Root causes

1. Missing top-level `Constants.SHIP` keys: `ENGINE_COLOR`, `ACCENT_COLOR`, `ACCENT_INTENSITY`, `ACCENT_DISTANCE`, `HEADLIGHT_INTENSITY`, `HEADLIGHT_DISTANCE`, `WINGTIP_EMISSIVE`.
2. `PlayerShip.js` passes `p.engine` correctly, but flame shader `uColor` and glow sprite `color` read `S.ENGINE_COLOR` directly; when `S.ENGINE_COLOR` is `undefined`, Three.js warns.
3. Stale undefined method `_enforceBlackHoleGravity` left in `Game._tick()` after refactor; bound `applyGravityToWorld` was the intended replacement.
4. `CollectibleSystem.generateChunk()` did not set `mesh.userData.chunkKey`, so `clearChunk()` silently failed and collectibles leaked across biomes.

## Verified fixes

- `src/core/Constants.js:59-64` — added default `SHIP` tooltip/lights fields and per-preset overrides:
  - `engineColor`, `headlightIntensity`, `headlightDistance`, `accentColor`, `accentIntensity`, `accentDistance`, `wingtipEmissive`
- `src/gameplay/PlayerShip.js:81,96` — flame shader/glow now use `p.engineColor || S.ENGINE_COLOR || 0x44aaff`
- `src/core/Game.js:297` — replaced stale `_enforceBlackHoleGravity(dt)` with bound `this.blackHoles.applyGravityToWorld.bind(this.blackHoles)` plus defensive typeof guard
- `src/level/CollectibleSystem.js:53-59` — `mesh.userData.chunkKey` and item `chunkKey` field set at spawn time

## Commits

- `76f409c` — define preset light/flame defaults and use preset engine color
- `74eb3b7` — fatal tick crash binding fixes
- `75df611` — biome 3D cloud shells, entity variety, filtered spawns
- `bc57c3b` — four distinct ship designs

## Verification

```bash
cd ~/Documents/games-benchmarks/space-exploration-kimi-k3
npm run build
```

Build exits 0 after changes. In-browser verification requires manual interaction in pointer-lock state; static verification is preferred for confirming absence of undefined-parameter paths.