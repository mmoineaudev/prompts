# Space Explorer Session Notes — 2026-07-21

## Camera / visuals
- Headlight sizing: intensity 1.2, angle `Math.PI/6`, distance 35, target z -15 works well for cockpit-forward feel without swallowing HUD.
- Scene readability: `BACKGROUND_COLOR: 0x111827`, `FOG_DENSITY: 0.0008` is the sweet spot. Pure black + dense fog hides geometry.
- 3/4 framing: camera above+behind, aim slightly below ship center with `LOOK_OFFSET_Y` and `LOOK_OFFSET_Z` so ship lands in lower screen half.
- Mouse-wheel zoom: clamp 1–3, reset on restart.

## Controls
- Pointer-lock “choose direction” mode is preferred over raw screen-NDC because rotation feel becomes decoupled from cursor position.
- Invert first: `-mouseX` yaw, `+mouseY` pitch in screen NDC.

## Chunking 2D→3D
- Change `chunkSeed(x, z)` → `chunkSeed(x, y, z)` using a 3-coord hash with distinct multipliers per axis.
- Change `getChunkRNG(cx, cz)` → `getChunkRNG(cx, cy, cz)`.
- Spawn loop: 3D nested loop `dx, dy, dz` with `dy = (near origin) ? -1..1 : -SPAWN_AHEAD..SPAWN_AHEAD`.
- Cleanup: signed-axis bounds, not `Math.abs() && AND`.
- When expanding to 3D, reduce per-chunk counts because active box count grows fast.

## Object counts tuning
- Base asteroid count `1 + Math.floor(rng() * 12)` per chunk.
- Biome densities reduced: Open Space 0.35, Asteroid Belt 0.8, Nebula Corridor 0.2, Wormhole 0.05.
- Wider chunks, smaller window: `WIDTH/HEIGHT/LENGTH: 280`, `SPAWN_AHEAD: 2`.

## New spawn type: CollectibleSystem
- `spawnCrystals(center, count, rng)` → green octahedrons, +50 score, reach 3.5.
- `spawnRuins(center, count, rng)` → brown tetrahedrons, +20 score, reach 3.5.
- Set `mesh.visible = true` at spawn; in `update()`, skip already-collected/non-visible items. Do NOT toggle visibility inside update.

## Bugs fixed this session
1. Debris clear skipped instanced meshes → leak on restart.
2. 3D chunk cleanup used `Math.abs() && AND` → stale chunks never evicted in all directions.
3. `chunkSeed` ignored `y` → identical content at same x/z regardless of height.
4. Camera look target math didn’t actually use `LOOK_OFFSET_Y/Z`.
5. `checkProjectileCollisions()` allocated `new THREE.Sphere()` per projectile → GC pressure.
6. Multiple near-duplicate cold-start scripts caused test confusion; trimmed verification to single run.
