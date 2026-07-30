# Session ref: distance, collidables, shooting stars, wormholes, pacing

Repo: space-exploration-kimi-k3

## Distance bug
PhysicsSystem.updatePlayerPhysics() pre-stores px,py,pz then computes dx/dy/dz from current minus previous. The broken revision wrote dz as a stub/typo, causing collapsed or noisy distance accumulation.

## Planet collision omission
ChunkManager.getCollidables() iterated this._planets, which does not exist on ChunkManager — planets live on PlanetManager._planets. Fix: pass planets through the subsystem bundle and safe-read as this._sub.planets && this._sub.planets._planets.

## Wormhole rebuild
- Switched from single thin cylinder to outer shell + inner core.
- Length bumped to CHUNK.SIZE * 3.5; radii and segment counts raised.
- Eviction removes/disposes both meshes and both materials.
- Time update writes to outerMat.uniforms.uTime and innerMat.uniforms.uTime.
- Shader gained rim, rings, swirl, pulse, and view-space depth shading.

## Shooting star rebuild
- Trail shifts per frame so it visibly extends behind the head.
- Added white Sprite head glow, scaling with age.
- Longer lifetimes/range, smoother quadratic fade.
- Spawn relocated to a far shell around the ship: 5,000–17,000 units away, mostly forward+upward so meteors read as deep-space, not ship-local.
- Comet tail length increased to 140 units with larger head sizing so it survives perspective at those distances.

## Pacing / feel
- Raised ship MAX_SPEED/ACCELERATION/DECELERATION so flight feels faster.
- Extended weapon PROJECTILE_SPEED/RANGE so combat stays effective at the new speed.
- Increased NPC.MAX_COUNT, SPAWN_CHANCE, WANDER_SPAWN_CHANCE, and deterministic neighborhood from ±1 to ±2 cells so traffic appears immediately after launch.